/** Read-only transport for the first milestone. No generic mutation or token API. */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code = 'http_error') {
    super(code === 'preview_operation_blocked' ? 'This operation is outside the approved preview scope.' :
      status === 401 ? 'Sign in is required, or your session has expired.' :
      status === 403 ? 'Access was denied.' : status === 404 ? 'Not found or not accessible.' :
      status === 429 ? 'The registry is limiting requests. Try again later.' : `Registry request failed (${status}).`);
    this.name = 'ApiError'; this.status = status; this.code = code;
  }
}
export class ProtocolError extends Error { constructor(message: string) { super(message); this.name = 'ProtocolError'; } }

async function readJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new ProtocolError('The response was empty.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ProtocolError('The response exceeds the supported size.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)) as unknown; }
  catch { throw new ProtocolError('The registry returned invalid JSON.'); }
}

export class ReadClient {
  private readonly origin: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;
  private epoch = 0;
  private controllers = new Set<AbortController>();
  onUnauthorized: (() => void) | undefined;
  constructor(origin: string, options: {fetcher?: typeof fetch; timeoutMs?: number} = {}) {
    const url = new URL(origin);
    if (url.origin !== origin || url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new ProtocolError('Invalid API origin.');
    this.origin = origin; this.fetcher = options.fetcher ?? fetch; this.timeoutMs = options.timeoutMs ?? 15000;
  }
  get generation(): number { return this.epoch; }
  resetIdentity(): void {
    this.epoch++;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }
  async get<T>(path: string, parse: (value: unknown) => T, signal?: AbortSignal, maxBytes = 4 * 1024 * 1024): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(path) || /%(?:2f|5c|2e|25)/i.test(path.split('?')[0])) throw new ProtocolError('Invalid API path.');
    const url = new URL(path, this.origin);
    if (url.origin !== this.origin || url.hash || !(url.pathname === '/config' || url.pathname.startsWith('/api/v1/'))) throw new ProtocolError('Unsupported API surface.');
    const epoch = this.epoch;
    const controller = new AbortController(); this.controllers.add(controller);
    const abort = (): void => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, {once: true});
    const timer = setTimeout(abort, this.timeoutMs);
    try {
      const response = await this.fetcher(url.href, {method: 'GET', credentials: 'same-origin', mode: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: {Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest'}});
      if (epoch !== this.epoch || controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      const isJson = /^application\/(json|[a-z0-9.+-]+\+json)(;|$)/i.test(response.headers.get('content-type') ?? '');
      if (response.status === 401 && url.pathname !== '/api/v1/user/') this.onUnauthorized?.();
      if (!isJson) {
        await response.body?.cancel();
        if (!response.ok) throw new ApiError(response.status);
        throw new ProtocolError('Expected JSON; received another content type.');
      }
      const value = await readJson(response, maxBytes);
      if (epoch !== this.epoch || controller.signal.aborted) throw new DOMException('Request cancelled', 'AbortError');
      if (!response.ok) {
        const code = value !== null && typeof value === 'object' && 'error_type' in value && value.error_type === 'preview_operation_blocked' ? 'preview_operation_blocked' : 'http_error';
        throw new ApiError(response.status, code);
      }
      return parse(value);
    } finally {
      clearTimeout(timer); signal?.removeEventListener('abort', abort); this.controllers.delete(controller);
    }
  }
}
