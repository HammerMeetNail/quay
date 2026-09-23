import {record, ContractError} from './domain';
import {operationPath, type Operation} from './operations';
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(
      status === 401
        ? 'Your session has expired.'
        : status === 403
          ? 'This request is not permitted.'
          : status === 404
            ? 'Not found or not accessible.'
            : status === 429
              ? 'The registry is rate limiting requests.'
              : `Registry request failed (${status}).`,
    );
    this.name = 'ApiError';
  }
}
export class SessionChanged extends Error {
  constructor() {
    super('The account context changed.');
    this.name = 'SessionChanged';
  }
}
export async function readJson(
  response: Response,
  limit = 4 * 1024 * 1024,
): Promise<unknown> {
  if (
    !/^application\/(?:json|[\w.+-]+\+json)(?:;|$)/i.test(
      response.headers.get('content-type') ?? '',
    )
  )
    throw new ContractError('Expected a JSON response.');
  if (!response.body) throw new ContractError('Empty response.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        throw new ContractError('Response too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const c of chunks) {
    joined.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder('utf-8', {fatal: true}).decode(joined),
    ) as unknown;
  } catch {
    throw new ContractError('Invalid JSON response.');
  }
}
/** Read-only by construction. Authentication remains on the actual Quay site. */
export class RegistryClient {
  private generation = 0;
  private controllers = new Set<AbortController>();
  constructor(
    private readonly origin: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
    private readonly onUnauthorized: () => void = () => undefined,
  ) {
    if (new URL(origin).origin !== origin)
      throw new Error('Expected an origin without a path.');
  }
  reset(): void {
    this.generation++;
    for (const c of this.controllers) c.abort();
    this.controllers.clear();
  }
  async get<T>(
    op: Operation,
    parse: (value: unknown) => T,
    signal?: AbortSignal,
  ): Promise<T> {
    const generation = this.generation;
    const controller = new AbortController();
    this.controllers.add(controller);
    const abort = (): void => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, 15000);
    try {
      if (controller.signal.aborted)
        throw new DOMException('Cancelled', 'AbortError');
      const response = await this.fetcher(
        new URL(operationPath(op), this.origin),
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          credentials: 'same-origin',
          mode: 'same-origin',
          redirect: 'error',
          cache: 'no-store',
          signal: controller.signal,
        },
      );
      if (generation !== this.generation) throw new SessionChanged();
      if (controller.signal.aborted)
        throw new DOMException('Cancelled', 'AbortError');
      if (response.status === 401 && op.kind !== 'identity')
        this.onUnauthorized();
      if (!response.ok) {
        let code = 'http_error';
        if ((response.headers.get('content-type') ?? '').includes('json')) {
          try {
            const data = record(await readJson(response, 65536));
            if (data.error_type === 'preview_operation_blocked')
              code = 'preview_operation_blocked';
          } catch {
            /* Never include raw response content in errors. */
          }
        }
        throw new ApiError(response.status, code);
      }
      const value = await readJson(
        response,
        op.kind === 'security' ? 8 * 1024 * 1024 : 4 * 1024 * 1024,
      );
      if (generation !== this.generation) throw new SessionChanged();
      if (controller.signal.aborted)
        throw new DOMException('Cancelled', 'AbortError');
      return parse(value);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      this.controllers.delete(controller);
    }
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'preview_operation_blocked')
    return 'The preview policy blocked this operation. Check the launcher’s allowed namespace.';
  if (error instanceof ApiError || error instanceof ContractError)
    return error.message;
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'The request was cancelled or timed out. Retry when the connection is ready.';
  return 'The registry could not be reached or the connection was interrupted. Retry to continue.';
}
