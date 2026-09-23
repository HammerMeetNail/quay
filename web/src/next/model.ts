/** Pure, runtime-validated contracts. Unknown evidence never becomes a clean scan. */
export const PREFIX = '/__quay_next_preview__/';
export type JsonObject = Record<string, unknown>;
export interface Runtime { mode: 'fixture' | 'live'; namespaces: string[]; repositories: string[]; registry: string; }
export interface Repository { namespace: string; name: string; description: string; visibility: 'Public' | 'Private' | 'Not reported'; state: string; }
export interface RepositoryPage { repositories: Repository[]; next: string | null; }
export interface Tag { name: string; digest: string; index: boolean | null; modified: string | null; immutable: boolean | null; children: number | null; presence: Record<string, boolean>; signaturePresent: boolean; }
export interface TagPage { tags: Tag[]; page: number; more: boolean; }
export interface Platform { digest: string; label: string; }
export interface Manifest { digest: string; mediaType: string; index: boolean; platforms: Platform[]; compressedBytes: number | null; raw: string; }
export interface Finding { package: string; version: string; advisory: string; severity: string; fix: string; link: string | null; }
export interface Scan { state: 'reported' | 'pending' | 'unsupported' | 'unavailable'; findings: Finding[]; message: string; }

export class ContractError extends Error {
  constructor(message = 'The backend returned an unsupported response shape.') { super(message); this.name = 'ContractError'; }
}
export function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new ContractError();
  return value as JsonObject;
}
export function text(value: unknown, max = 1024): string {
  if (typeof value !== 'string' || value.length > max) throw new ContractError();
  return value;
}
function optionalText(value: unknown, max = 1024): string { return value == null ? '' : text(value, max); }
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new ContractError();
  return value;
}
function count(value: unknown): number | null { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null; }
export function namespace(value: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{0,254}$/.test(value)) throw new ContractError('Unsupported namespace identifier.');
  return value;
}
export function repository(value: string): string {
  if (!value || value.length > 512 || value.split('/').some(p => !/^[a-z0-9]+(?:[._-]+[a-z0-9]+)*$/.test(p))) throw new ContractError('Unsupported repository identifier.');
  return value;
}
export function digest(value: string): string {
  if (!/^(sha256:[a-f0-9]{64}|sha512:[a-f0-9]{128})$/.test(value)) throw new ContractError('Unsupported or malformed digest. Only SHA-256 and SHA-512 are enabled.');
  return value;
}
export function supportedDigest(value: string): boolean { try { digest(value); return true; } catch { return false; } }
export function repoPath(ns: string, repo: string): string { return [namespace(ns), ...repository(repo).split('/')].map(encodeURIComponent).join('/'); }
export function manifestPath(ns: string, repo: string, value: string): string { return `/api/v1/repository/${repoPath(ns, repo)}/manifest/${encodeURIComponent(digest(value))}`; }
export function immutableCommand(registry: string, ns: string, repo: string, value: string, tool: 'podman' | 'docker'): string {
  if (!['podman', 'docker'].includes(tool) || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(registry)) throw new ContractError('Invalid command target.');
  return `${tool} pull ${registry}/${namespace(ns)}/${repository(repo)}@${digest(value)}`;
}
export function pageNumber(value: string | null): number {
  if (value === null) return 1;
  if (!/^[1-9][0-9]{0,5}$/.test(value)) throw new ContractError('Invalid page number.');
  return Number(value);
}
export function exactTag(value: string): string {
  if (!/^[\w][\w.-]{0,127}$/.test(value)) throw new ContractError('Enter a complete, valid tag name.');
  return value;
}
export function tagsPath(ns: string, repo: string, page: number, search: string): string {
  pageNumber(String(page));
  const query = new URLSearchParams({page: String(page), limit: '25', onlyActiveTags: 'true'});
  if (search) query.set('specificTag', exactTag(search));
  return `/api/v1/repository/${repoPath(ns, repo)}/tag/?${query}`;
}
export function safeLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function parseRuntime(value: unknown): Runtime {
  const v = object(value);
  if (v.mode !== 'fixture' && v.mode !== 'live') throw new ContractError('Unknown preview mode.');
  const namespaces = [...new Set(array(v.namespaces, 20).map(n => namespace(text(n))))];
  if (!namespaces.length) throw new ContractError('No approved namespaces.');
  const repositories = [...new Set(array(v.repositories, 50).map(item => {const parts = text(item, 768).split('/'); const ns = namespace(parts.shift() ?? ''); const repo = repository(parts.join('/')); if (!namespaces.includes(ns)) throw new ContractError('Repository outside configured namespaces.'); return `${ns}/${repo}`;}))];
  if (!repositories.length) throw new ContractError('No approved repositories.');
  return {mode: v.mode, namespaces, repositories, registry: v.mode === 'live' ? 'quay.io' : 'registry.example.test'};
}
export function parseUser(value: unknown): string | null {
  const v = object(value);
  if (v.anonymous === true) return null;
  if (v.anonymous !== false) throw new ContractError('Unknown identity state.');
  return namespace(text(v.username));
}
export function parseFeatures(value: unknown): JsonObject {
  const v = object(value);
  return v.features == null ? {} : object(v.features);
}
export function parseRepository(value: unknown): Repository {
  const v = object(value);
  return {namespace: namespace(text(v.namespace)), name: repository(text(v.name)), description: optionalText(v.description, 65536),
    visibility: v.is_public === true ? 'Public' : v.is_public === false ? 'Private' : 'Not reported', state: optionalText(v.state, 100) || 'Not reported'};
}
export function parseRepositories(value: unknown): RepositoryPage {
  const v = object(value);
  const next = v.next_page == null || v.next_page === '' ? null : text(v.next_page, 8192);
  if (next && /[\u0000-\u001f\u007f]/.test(next)) throw new ContractError('Invalid pagination cursor.');
  return {repositories: array(v.repositories, 1000).map(parseRepository), next};
}
export function parseTags(value: unknown): TagPage {
  const v = object(value);
  if (typeof v.page !== 'number' || !Number.isSafeInteger(v.page) || v.page < 1 || typeof v.has_additional !== 'boolean') throw new ContractError();
  return {page: v.page, more: v.has_additional, tags: array(v.tags, 100).map(item => {
    const t = object(item);
    const presence: Record<string, boolean> = Object.create(null) as Record<string, boolean>;
    if (t.child_manifests_presence != null) {
      for (const [key, present] of Object.entries(object(t.child_manifests_presence))) {
        if (typeof present !== 'boolean') throw new ContractError();
        presence[key] = present;
      }
    }
    return {name: exactTag(text(t.name, 128)), digest: text(t.manifest_digest, 256),
      index: typeof t.is_manifest_list === 'boolean' ? t.is_manifest_list : null,
      modified: typeof t.last_modified === 'string' ? text(t.last_modified, 100) : null,
      immutable: typeof t.immutable === 'boolean' ? t.immutable : null,
      children: count(t.child_manifest_count), presence,
      signaturePresent: typeof t.cosign_signature_manifest_digest === 'string' || typeof t.cosign_signature_tag === 'string'};
  })};
}
export function parseManifest(value: unknown): Manifest {
  const v = object(value);
  const raw = text(v.manifest_data, 4 * 1024 * 1024);
  let parsed: JsonObject;
  try { parsed = object(JSON.parse(raw)); } catch { throw new ContractError('Manifest JSON could not be decoded.'); }
  if (typeof v.is_manifest_list !== 'boolean') throw new ContractError('Manifest kind was not reported.');
  const platforms = v.is_manifest_list ? array(parsed.manifests, 500).map(item => {
    const child = object(item); const p = child.platform == null ? {} : object(child.platform);
    const label = [optionalText(p.os, 128), optionalText(p.architecture, 128), optionalText(p.variant, 128)].filter(Boolean).join('/');
    return {digest: text(child.digest, 256), label: label || 'Platform not reported'};
  }) : [];
  return {digest: text(v.digest, 256), mediaType: optionalText(parsed.mediaType, 256) || 'Not reported', index: v.is_manifest_list,
    platforms, compressedBytes: count(v.layers_compressed_size), raw};
}
export function parseLabels(value: unknown): {key: string; value: string}[] {
  return array(object(value).labels, 1000).map(item => { const v = object(item); return {key: text(v.key, 4096), value: text(v.value, 65536)}; });
}
export function parseScan(value: unknown): Scan {
  const v = object(value);
  const state = text(v.status, 100);
  if (state === 'queued') return {state: 'pending', findings: [], message: 'Queued for scanning. Refresh to check again.'};
  if (state === 'unsupported' || state === 'manifest_layer_too_large') return {state: 'unsupported', findings: [], message: state === 'unsupported' ? 'Scanning is not supported for this artifact.' : 'A layer exceeds the scanner size limit.'};
  if (state === 'failed') return {state: 'unavailable', findings: [], message: 'The scanner could not produce a report.'};
  if (state !== 'scanned') return {state: 'unavailable', findings: [], message: 'The scanner returned an unrecognized state.'};
  const features = array(object(object(v.data).Layer).Features, 20000);
  const findings: Finding[] = [];
  const seen = new Set<string>();
  for (const item of features) {
    const feature = object(item);
    const pkg = text(feature.Name, 4096); const version = text(feature.Version, 4096);
    for (const raw of feature.Vulnerabilities == null ? [] : array(feature.Vulnerabilities, 10000)) {
      const vuln = object(raw);
      const advisory = text(vuln.Name, 4096);
      const key = JSON.stringify([pkg, version, advisory]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (findings.length >= 20000) throw new ContractError('Report exceeds the supported finding count.');
      findings.push({package: pkg, version, advisory, severity: optionalText(vuln.Severity, 100) || 'Unknown', fix: optionalText(vuln.FixedBy, 4096) || 'Not reported', link: safeLink(vuln.Link)});
    }
  }
  return {state: 'reported', findings, message: findings.length ? `${findings.length} package/advisory findings reported` : 'No vulnerabilities reported'};
}
export function inspectorMode(width: number, rootSize: number, fullPage: boolean): 'inline' | 'page' {
  return !fullPage && Number.isFinite(width) && Number.isFinite(rootSize) && rootSize > 0 && width >= 72 * rootSize ? 'inline' : 'page';
}
export function formatDate(value: string | null): string {
  if (!value) return 'Not reported';
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? 'Not reported' : time.toLocaleString();
}
