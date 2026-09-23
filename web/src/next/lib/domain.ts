/** Side-effect-free domain boundary. No backend payload is asserted into a trusted type. */
export class ContractError extends Error {
  constructor(message = 'The registry returned an unexpected response.') {
    super(message);
    this.name = 'ContractError';
  }
}
export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new ContractError();
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 4096): string {
  if (typeof value !== 'string' || value.length > max)
    throw new ContractError();
  return value;
}
export function optionalText(value: unknown, max = 4096): string | null {
  return value == null ? null : text(value, max);
}
export function array(value: unknown, max = 10000): unknown[] {
  if (!Array.isArray(value) || value.length > max) throw new ContractError();
  return value;
}
export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new ContractError();
  return value;
}
export function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new ContractError();
  return value;
}
export const DIGEST = /^(?:sha256:[a-f0-9]{64}|sha512:[a-f0-9]{128})$/;
export function isDigest(value: string): boolean {
  return DIGEST.test(value);
}
export function namespace(value: string): string {
  if (
    !/^[a-z0-9][a-z0-9._-]{0,254}$/.test(value) ||
    value === '.' ||
    value === '..'
  )
    throw new ContractError('Invalid namespace.');
  return value;
}
export function repository(value: string): string {
  if (value.length > 1024 || !value.length)
    throw new ContractError('Invalid repository path.');
  value.split('/').forEach(namespace);
  return value;
}
export function tagName(value: string): string {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(value))
    throw new ContractError('Invalid tag name.');
  return value;
}
export function digest(value: string): string {
  if (!isDigest(value))
    throw new ContractError(
      'This preview supports SHA-256 and SHA-512 references only.',
    );
  return value;
}
export function repoPath(ns: string, repo: string): string {
  return [namespace(ns), ...repository(repo).split('/')]
    .map(encodeURIComponent)
    .join('/');
}
export function immutableCommand(
  host: string,
  ns: string,
  repo: string,
  hash: string,
  tool: 'podman' | 'docker',
): string {
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+(?::[0-9]{1,5})?$/.test(
      host,
    )
  )
    throw new ContractError('Invalid registry host.');
  if (tool !== 'podman' && tool !== 'docker')
    throw new ContractError('Unsupported container tool.');
  // This alphabet contains no shell metacharacters. Never interpolate arbitrary metadata.
  repoPath(ns, repo);
  return `${tool} pull ${host}/${ns}/${repo}@${digest(hash)}`;
}
export function abbreviated(value: string): string {
  return value.length > 30 ? `${value.slice(0, 19)}…${value.slice(-8)}` : value;
}
export function dateLabel(value: string | number | null): string {
  if (value == null) return 'Not reported';
  const d = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isNaN(d.getTime())
    ? 'Not reported'
    : d.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'});
}
export function bytesLabel(bytes: number | null): string {
  if (bytes === null) return 'Not reported';
  if (!Number.isFinite(bytes) || bytes < 0) return 'Not reported';
  if (bytes < 1024) return `${bytes} B`;
  const power = Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** power).toFixed(1)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][power]}`;
}
export type Identity =
  | {
      kind: 'anonymous';
    }
  | {
      kind: 'user';
      username: string;
      namespaces: string[];
    };
export function parseIdentity(value: unknown): Identity {
  const x = record(value);
  if (x.anonymous === true) return {kind: 'anonymous'};
  const name = namespace(text(x.username, 255));
  const organizations =
    x.organizations == null
      ? []
      : array(x.organizations, 5000).map((v) =>
          namespace(text(record(v).name, 255)),
        );
  return {
    kind: 'user',
    username: name,
    namespaces: [...new Set([name, ...organizations])],
  };
}
export interface Config {
  anonymous: boolean | null;
  scanner: boolean | null;
  title: string;
}
export function parseConfig(value: unknown): Config {
  const x = record(value);
  const features = record(x.features ?? {});
  const config = record(x.config ?? {});
  const flag = (v: unknown): boolean | null =>
    typeof v === 'boolean' ? v : null;
  return {
    anonymous: flag(features.ANONYMOUS_ACCESS),
    scanner: flag(features.SECURITY_SCANNER),
    title: optionalText(config.REGISTRY_TITLE, 255) ?? 'Quay',
  };
}
export interface Repository {
  namespace: string;
  name: string;
  description: string;
  visibility: 'Public' | 'Private' | 'Not reported';
  state: string;
  modified: number | null;
}
export interface RepositoryPage {
  repositories: Repository[];
  next: string | null;
}
function parseRepository(value: unknown): Repository {
  const x = record(value);
  return {
    namespace: namespace(text(x.namespace, 255)),
    name: repository(text(x.name, 1024)),
    description: optionalText(x.description, 65536) ?? '',
    visibility:
      x.is_public === true
        ? 'Public'
        : x.is_public === false
          ? 'Private'
          : 'Not reported',
    state: optionalText(x.state, 128) ?? 'Not reported',
    modified: x.last_modified == null ? null : count(x.last_modified),
  };
}
export function parseRepositories(value: unknown): RepositoryPage {
  const x = record(value);
  return {
    repositories: array(x.repositories, 1000).map(parseRepository),
    next: optionalText(x.next_page, 8192) || null,
  };
}
export interface RepositoryDetails {
  description: string;
  visibility: string;
  state: string;
  access: string;
}
export function parseRepositoryDetails(value: unknown): RepositoryDetails {
  const x = record(value);
  return {
    description: optionalText(x.description, 65536) ?? '',
    visibility:
      x.is_public === true
        ? 'Public'
        : x.is_public === false
          ? 'Private'
          : 'Not reported',
    state: optionalText(x.state, 128) ?? 'Not reported',
    access:
      x.can_admin === true
        ? 'Admin access'
        : x.can_write === true
          ? 'Write access'
          : 'Read access',
  };
}
export interface Tag {
  name: string;
  digest: string;
  index: boolean;
  modified: string | null;
  size: number | null;
  immutable: boolean | null;
  presence: Record<string, boolean>;
  signature: boolean;
}
export interface TagPage {
  tags: Tag[];
  page: number;
  more: boolean;
}
export function parseTags(value: unknown): TagPage {
  const x = record(value);
  const page = count(x.page);
  if (page < 1) throw new ContractError('Invalid tag page.');
  const tags = array(x.tags, 1000).map((value) => {
    const t = record(value);
    const presence: Record<string, boolean> = Object.create(null) as Record<
      string,
      boolean
    >;
    if (t.child_manifests_presence != null)
      for (const [key, val] of Object.entries(
        record(t.child_manifests_presence),
      )) {
        if (isDigest(key) && typeof val === 'boolean') presence[key] = val;
      }
    return {
      name: tagName(text(t.name, 128)),
      digest: text(t.manifest_digest, 512),
      index: boolean(t.is_manifest_list),
      modified: optionalText(t.last_modified, 128),
      size: t.size == null ? null : count(t.size),
      immutable: typeof t.immutable === 'boolean' ? t.immutable : null,
      presence,
      signature:
        typeof t.cosign_signature_manifest_digest === 'string' ||
        typeof t.cosign_signature_tag === 'string',
    };
  });
  return {tags, page, more: boolean(x.has_additional)};
}
export interface Platform {
  digest: string;
  label: string;
}
export interface Manifest {
  digest: string;
  index: boolean;
  mediaType: string;
  platforms: Platform[];
  raw: string;
  compressedBytes: number | null;
}
export function parseManifest(value: unknown): Manifest {
  const x = record(value);
  const raw = text(x.manifest_data, 2 * 1024 * 1024);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new ContractError('Invalid manifest JSON.');
  }
  const data = record(parsed);
  const platforms =
    data.manifests == null
      ? []
      : array(data.manifests, 1000).map((v) => {
          const descriptor = record(v);
          const p = record(descriptor.platform ?? {});
          const parts = [
            optionalText(p.os, 128) ?? 'unknown OS',
            optionalText(p.architecture, 128) ?? 'unknown architecture',
            optionalText(p.variant, 128),
          ].filter(Boolean);
          return {digest: text(descriptor.digest, 512), label: parts.join('/')};
        });
  return {
    digest: text(x.digest, 512),
    index: boolean(x.is_manifest_list),
    mediaType: optionalText(data.mediaType, 512) ?? 'Media type not reported',
    platforms,
    raw,
    compressedBytes:
      x.layers_compressed_size == null ? null : count(x.layers_compressed_size),
  };
}
export interface LabelValue {
  key: string;
  value: string;
}
export function parseLabels(value: unknown): LabelValue[] {
  return array(record(value).labels, 10000).map((v) => {
    const x = record(v);
    return {key: text(x.key, 1024), value: text(x.value, 65536)};
  });
}
export interface Finding {
  id: string;
  severity: string;
  package: string;
  version: string;
  fix: string | null;
  url: string | null;
}
export type Evidence =
  | {
      kind: 'pending';
      description: string;
    }
  | {
      kind: 'unsupported';
      description: string;
    }
  | {
      kind: 'unavailable';
      description: string;
    }
  | {
      kind: 'reported';
      findings: Finding[];
      retrievedAt: string;
    };
export function containsForbiddenCodePoint(value: string, max = 0x1f): boolean {
  for (const character of value) {
    const point = character.charCodeAt(0);
    if (point <= max || point === 0x7f) return true;
  }
  return false;
}
export function safeWebUrl(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    containsForbiddenCodePoint(value, 0x20)
  )
    return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function parseEvidence(value: unknown): Evidence {
  const x = record(value);
  const status = text(x.status, 128).toLowerCase();
  if (['queued', 'scanning', 'indexing'].includes(status))
    return {
      kind: 'pending',
      description:
        'The registry reports that scanning is in progress. Refresh when ready.',
    };
  if (['unsupported', 'not_supported'].includes(status))
    return {
      kind: 'unsupported',
      description: 'The registry does not support scanning this artifact.',
    };
  if (status !== 'scanned')
    return {
      kind: 'unavailable',
      description: `No completed report was returned (status: ${status}).`,
    };
  const data = record(x.data);
  const layer = record(data.Layer);
  // Missing Features is not an empty successful report. No "Safe" inference.
  const features = array(layer.Features, 20000);
  const findings: Finding[] = [];
  for (const feature of features) {
    const f = record(feature);
    const pkg = text(f.Name, 2048);
    const version = text(f.Version, 2048);
    for (const vulnerability of array(f.Vulnerabilities ?? [], 20000)) {
      if (findings.length >= 50000)
        throw new ContractError('Report exceeds the supported finding count.');
      const v = record(vulnerability);
      findings.push({
        id: text(v.Name, 2048),
        severity: optionalText(v.Severity, 128) ?? 'Unknown',
        package: pkg,
        version,
        fix: optionalText(v.FixedBy, 2048) || null,
        url: safeWebUrl(v.Link),
      });
    }
  }
  return {kind: 'reported', findings, retrievedAt: new Date().toISOString()};
}
export function evidenceLabel(evidence: Evidence | undefined): string {
  if (!evidence) return 'Not loaded';
  if (evidence.kind === 'pending') return 'Scanning';
  if (evidence.kind === 'unsupported') return 'Not supported';
  if (evidence.kind === 'unavailable') return 'Report unavailable';
  if (!evidence.findings.length) return 'No vulnerabilities reported';
  const critical = evidence.findings.filter(
    (f) => f.severity === 'Critical',
  ).length;
  const high = evidence.findings.filter((f) => f.severity === 'High').length;
  return [
    critical ? `${critical} critical` : '',
    high ? `${high} high` : '',
    `${evidence.findings.length} package findings`,
  ]
    .filter(Boolean)
    .join(' · ');
}
