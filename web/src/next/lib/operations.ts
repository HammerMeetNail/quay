import {
  repoPath,
  digest,
  tagName,
  namespace,
  ContractError,
  containsForbiddenCodePoint,
} from './domain';
export type Operation =
  | {
      kind: 'config';
    }
  | {
      kind: 'identity';
    }
  | {
      kind: 'repositories';
      namespace: string;
      cursor?: string | null;
    }
  | {
      kind: 'repository';
      namespace: string;
      repository: string;
    }
  | {
      kind: 'tags';
      namespace: string;
      repository: string;
      page: number;
      exactTag?: string;
    }
  | {
      kind: 'manifest' | 'security' | 'labels';
      namespace: string;
      repository: string;
      digest: string;
    };
export function operationPath(op: Operation): string {
  if (op.kind === 'config') return '/config';
  if (op.kind === 'identity') return '/api/v1/user/';
  if (op.kind === 'repositories') {
    const params = new URLSearchParams({
      namespace: namespace(op.namespace),
      public: 'true',
      last_modified: 'true',
    });
    if (op.cursor) {
      if (op.cursor.length > 8192 || containsForbiddenCodePoint(op.cursor))
        throw new ContractError('Invalid cursor.');
      params.set('next_page', op.cursor);
    }
    return `/api/v1/repository?${params}`;
  }
  const base = `/api/v1/repository/${repoPath(op.namespace, op.repository)}`;
  if (op.kind === 'repository') return `${base}?includeTags=false`;
  if (op.kind === 'tags') {
    if (!Number.isSafeInteger(op.page) || op.page < 1 || op.page > 1000000)
      throw new ContractError('Invalid page.');
    const params = new URLSearchParams({
      page: String(op.page),
      limit: '25',
      onlyActiveTags: 'true',
    });
    if (op.exactTag) params.set('specificTag', tagName(op.exactTag));
    return `${base}/tag/?${params}`;
  }
  const path = `${base}/manifest/${encodeURIComponent(digest(op.digest))}`;
  return op.kind === 'security'
    ? `${path}/security?vulnerabilities=true`
    : op.kind === 'labels'
      ? `${path}/labels`
      : path;
}
export function pageNumber(value: string | null): number {
  if (!value || !/^[1-9][0-9]{0,6}$/.test(value)) return 1;
  const page = Number(value);
  return page <= 1000000 ? page : 1;
}
export function shouldUseInspector(
  width: number,
  rootFont: number,
  forcePage: boolean,
): boolean {
  return (
    !forcePage &&
    Number.isFinite(width) &&
    Number.isFinite(rootFont) &&
    rootFont > 0 &&
    width / rootFont >= 72
  );
}
