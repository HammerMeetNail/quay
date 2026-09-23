/** Presentation-only adapters. They never authorize a request or synthesize registry metrics. */
import {
  array,
  record,
  parseRepositories,
  repoPath,
  isDigest,
  type Tag,
  type Repository,
  type RepositoryPage,
  type Manifest,
} from './domain';

export type VisibilityFilter = 'all' | 'public' | 'private' | 'starred';
export type SortOrder = 'registry' | 'name' | 'updated';
export interface WorkbenchRepository extends Repository {
  starred: boolean | null;
}
export interface WorkbenchPage extends RepositoryPage {
  repositories: WorkbenchRepository[];
}

export function parseWorkbenchPage(value: unknown): WorkbenchPage {
  const parsed = parseRepositories(value);
  const raw = array(record(value).repositories, 1000);
  return {
    ...parsed,
    repositories: parsed.repositories.map((repository, index) => {
      const star = record(raw[index]).is_starred;
      return {...repository, starred: typeof star === 'boolean' ? star : null};
    }),
  };
}
export function visibilityFilter(value: string | null): VisibilityFilter {
  return value === 'public' || value === 'private' || value === 'starred'
    ? value
    : 'all';
}
export function sortOrder(value: string | null): SortOrder {
  return value === 'name' || value === 'updated' ? value : 'registry';
}
export function visibleRepositories(
  rows: readonly WorkbenchRepository[],
  query: string,
  filter: VisibilityFilter,
  sort: SortOrder,
): WorkbenchRepository[] {
  const needle = query.slice(0, 255).toLocaleLowerCase();
  const result = rows.filter((row) => {
    const matches = `${row.namespace}/${row.name} ${row.description}`
      .toLocaleLowerCase()
      .includes(needle);
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'starred' && row.starred === true) ||
        (filter === 'public' && row.visibility === 'Public') ||
        (filter === 'private' && row.visibility === 'Private'))
    );
  });
  if (sort === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'updated')
    result.sort(
      (a, b) =>
        (b.modified ?? -Infinity) - (a.modified ?? -Infinity) ||
        a.name.localeCompare(b.name),
    );
  return result;
}
export function pageCounts(
  rows: readonly WorkbenchRepository[],
): Record<VisibilityFilter, number> {
  return {
    all: rows.length,
    public: rows.filter((r) => r.visibility === 'Public').length,
    private: rows.filter((r) => r.visibility === 'Private').length,
    starred: rows.filter((r) => r.starred === true).length,
  };
}

/** Readable plain-text excerpt; React, not this function, provides HTML escaping. */
export function descriptionText(markdown: string): string {
  return markdown
    .slice(0, 65536)
    .replace(/!\[([^\]\n]{0,512})\]\([^\n)]{1,2048}\)/g, '$1')
    .replace(/\[([^\]\n]{1,512})\]\([^\n)]{1,2048}\)/g, '$1')
    .replace(/[`*_#]/g, '')
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
export function repositoryState(value: string): string | null {
  if (value === 'NORMAL') return null;
  const known: Record<string, string> = {
    MIRROR: 'Mirror',
    ORG_MIRROR: 'Organization mirror',
    READ_ONLY: 'Read only',
    MARKED_FOR_DELETION: 'Deletion pending',
  };
  return Object.hasOwn(known, value)
    ? (known[value] ?? `State: ${value}`)
    : value === 'Not reported'
      ? 'State not reported'
      : `State: ${value}`;
}
export function timestamp(value: string | number | null): number | null {
  if (value === null) return null;
  const result = new Date(
    typeof value === 'number' ? value * 1000 : value,
  ).getTime();
  return Number.isFinite(result) ? result : null;
}
export function relativeTime(
  value: string | number | null,
  now = Date.now(),
): string {
  const time = timestamp(value);
  if (time === null || !Number.isFinite(now)) return 'Not reported';
  const seconds = (time - now) / 1000;
  if (Math.abs(seconds) < 60) return 'Just now';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  const [unit, divisor] = units.find(
    ([, count]) => Math.abs(seconds) >= count,
  ) ?? ['minute', 60];
  return new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'}).format(
    Math.trunc(seconds / divisor),
    unit,
  );
}
export function platformLabels(manifest: Manifest | undefined): string[] {
  if (!manifest) return [];
  // Match actual OCI descriptor labels. A Linux/arm64 image is not a macOS image.
  return [...new Set(manifest.platforms.map((p) => p.label))].sort((a, b) => {
    const rank = (label: string): number =>
      label === 'linux/amd64' ? 0 : label.startsWith('linux/arm64') ? 1 : 2;
    return rank(a) - rank(b) || a.localeCompare(b);
  });
}
export function selectedRepository(
  value: string | null,
  scope: string,
): string | null {
  if (!value) return null;
  try {
    const [namespace, ...parts] = value.split('/');
    if (namespace !== scope || parts.length === 0) return null;
    repoPath(namespace, parts.join('/'));
    return parts.join('/');
  } catch {
    return null;
  }
}
export interface RecentRepository {
  namespace: string;
  name: string;
}
export function visitRepository(
  history: readonly RecentRepository[],
  repository: RecentRepository,
): RecentRepository[] {
  repoPath(repository.namespace, repository.name);
  return [
    repository,
    ...history.filter(
      (r) => r.namespace !== repository.namespace || r.name !== repository.name,
    ),
  ].slice(0, 6);
}

/** Hard cap independent of the backend honoring the requested page limit. */
export function platformHydrationDigests(
  tags: readonly Tag[],
): ReadonlySet<string> {
  const result = new Set<string>();
  for (const tag of tags) {
    if (tag.index && isDigest(tag.digest)) result.add(tag.digest);
    if (result.size === 25) break;
  }
  return result;
}
