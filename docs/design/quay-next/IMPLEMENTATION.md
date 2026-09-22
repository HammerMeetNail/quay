# Quay Next implementation examples

These examples are implementation seeds, not a claim that the application is finished. Preserve the security and capability requirements in [ARCHITECTURE.md](ARCHITECTURE.md). Extract the examples into the indicated files, compile them against the actual lockfile, add the specified tests, and resolve integration differences without weakening the contracts.

## 1. Target structure and script interface

```text
web/
  src/next/
    main.tsx
    app/NextApp.tsx
    app/routes.tsx
    app/runtime.ts
    app/providers.tsx
    components/RegistryShell.tsx
    components/QueryRegion.tsx
    components/EvidenceLabel.tsx
    components/PullCommand.tsx
    features/repositories/
    features/artifacts/
    features/access/
    features/activity/
    features/automation/
    features/settings/
    features/account/
    features/admin/
    lib/api/{client.ts,contracts.ts,paths.ts,errors.ts}
    lib/auth/{session.ts,reauthentication.ts,provider-navigation.ts}
    lib/capabilities/
    lib/references/
    styles/{tokens.css,layout.module.css}
  tools/next-preview/
    policy.mjs
    policy.test.mjs
    live-preview.mjs
  next-tests/
    unit/
    contract-server/
    browser/
    live/
  playwright/e2e/next/              # true deployed black-box tests, no API stubs
  webpack.next.js
  tsconfig.next.json
  vitest.next.config.ts
  playwright.next.contract.config.ts
  playwright.next.live.config.ts
  dist-next/                        # ignored build output
```

Do not duplicate package management into a nested application with a second inconsistent lockfile. Pin the package-manager version using the repository's existing convention; use a supported Node release compatible with the installed toolchain and record it. Do not change the old build entry as a side effect.

Implement these script names and document their inputs:

| Script | Required behavior |
| --- | --- |
| `next:dev` | Local deterministic contract server plus new UI watch build; unmistakable Demo data banner |
| `next:build` | Production static bundle with configurable validated basename/public path |
| `next:build:preview` | Same production-style bundle for `/__quay_next_preview__/`, no eval/HMR or inline executable bootstrap |
| `next:preview` | Isolated interactive browser against quay.io; scoped read policy by default |
| `next:typecheck` | Strict TypeScript check of new app and its shared contracts |
| `next:unit` | Pure logic/parser/state-machine tests with Vitest |
| `next:policy` | `node --test tools/next-preview/policy.test.mjs` |
| `next:browser` | Deterministic Playwright contract/visual/accessibility suite outside the real E2E directory |
| `next:live` | Explicitly enabled live read-contract suite with safe artifact defaults |
| `next:e2e` | New UI tests against a deployed real Quay backend using existing black-box conventions |
| `next:budget` | Bundle and controlled-browser performance budget checks |
| `next:check` | Typecheck, pure tests, policy, deterministic browser, build, and budgets; does not pretend to run unavailable live/staging suites |

Build configuration must emit an asset manifest mapping public asset-relative names to output-relative files. Use webpack compilation assets, not a recursive copy of the repository. Exclude source maps, secrets, environment files, test fixtures, and arbitrary filesystem paths. Ensure the HTML references only manifest-listed assets and includes a static root element carrying its preview-mode/basename metadata. No token is needed in the build environment.

## 2. Domain types and an honest PatternFly table

Avoid importing existing resource modules merely to reuse their interfaces if those modules initialize global auth/HTTP state. Put new, normalized domain types in a side-effect-free module. Unknown API values are normalized explicitly rather than cast into these types.

```tsx
// src/next/features/artifacts/ArtifactTable.tsx
import React from 'react';
import {Button, Label} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';

export type ScanEvidence =
  | {kind: 'not-requested'}
  | {kind: 'unsupported'; reason: string}
  | {kind: 'pending'}
  | {kind: 'unavailable'; reason: string}
  | {kind: 'partial'; covered: number; total: number}
  | {kind: 'reported'; critical: number; high: number; other: number;
     reportTime: string | null; retrievedAt: string};

export interface ArtifactRow {
  tag: string;
  digest: string;
  platforms: readonly string[];
  modifiedLabel: string;
  modifiedIso: string | null;
  sizeLabel: string;
  scan: ScanEvidence;
}

export function scanText(evidence: ScanEvidence): string {
  switch (evidence.kind) {
    case 'not-requested': return 'Not loaded';
    case 'unsupported': return 'Not supported';
    case 'pending': return 'Scanning';
    case 'unavailable': return 'Report unavailable';
    case 'partial': return `${evidence.covered}/${evidence.total} platforms covered`;
    case 'reported': {
      if (evidence.critical > 0) return `${evidence.critical} critical`;
      if (evidence.high > 0) return `${evidence.high} high`;
      if (evidence.other > 0) return `${evidence.other} other findings`;
      return 'No vulnerabilities reported';
    }
  }
}

interface Props {
  rows: readonly ArtifactRow[];
  isUpdating: boolean;
  onInspect: (row: ArtifactRow) => void;
  onCopy: (row: ArtifactRow) => void;
}

export const ArtifactTable: React.FC<Props> = ({
  rows, isUpdating, onInspect, onCopy,
}) => (
  <Table aria-label="Tags and artifacts" aria-busy={isUpdating} variant="compact">
    <Thead>
      <Tr>
        <Th scope="col">Tag</Th>
        <Th scope="col">Digest</Th>
        <Th scope="col">Platforms</Th>
        <Th scope="col">Tag updated</Th>
        <Th scope="col">Size</Th>
        <Th scope="col">Security evidence</Th>
        <Th scope="col">Actions</Th>
      </Tr>
    </Thead>
    <Tbody>
      {rows.map(row => (
        <Tr key={`${row.tag}\u0000${row.digest}`}>
          <Td dataLabel="Tag">
            <Button variant="link" isInline onClick={() => onInspect(row)}
              data-testid="artifact-inspect"
              aria-label={`Inspect ${row.tag}`}>
              {row.tag}
            </Button>
          </Td>
          <Td dataLabel="Digest">
            <code title={row.digest} aria-label={row.digest}>
              {row.digest.length > 28 ? `${row.digest.slice(0, 25)}…` : row.digest}
            </code>
          </Td>
          <Td dataLabel="Platforms">
            {row.platforms.length ? row.platforms.join(', ') : 'Not reported'}
          </Td>
          <Td dataLabel="Tag updated">
            {row.modifiedIso
              ? <time dateTime={row.modifiedIso}>{row.modifiedLabel}</time>
              : 'Not reported'}
          </Td>
          <Td dataLabel="Size">{row.sizeLabel}</Td>
          <Td dataLabel="Security evidence"><Label>{scanText(row.scan)}</Label></Td>
          <Td dataLabel="Actions">
            <Button variant="plain" onClick={() => onCopy(row)}
              aria-label={`Copy digest-pinned pull command for ${row.tag}`}
              data-testid="artifact-copy-command">
              Copy
            </Button>
          </Td>
        </Tr>
      ))}
    </Tbody>
  </Table>
);
```

This is a compact-mode example, not a directive to force compact density for every user. The page owns empty/error/loading states, a persistent toolbar, safe clipboard error feedback, URL-backed drawer selection, and responsive column priority. Color/icon treatment must use the normalized evidence state, retain text, and never turn unsupported or unrequested evidence green. Add a details link alongside the drawer interaction for normal open-in-new-tab behavior.

The UI should not collapse all report information to the highest severity in the drawer; the table's short label leads to the full severity distribution, affected packages, and platform coverage. A report retrieval timestamp must never be relabeled as the scanner's generation time.

### Scoped token aliases

```css
/* src/next/styles/tokens.css; verify names against the installed PF6 token set. */
.quay-next {
  --quay-surface: var(--pf-t--global--background--color--primary--default);
  --quay-text: var(--pf-t--global--text--color--regular);
  --quay-border: var(--pf-t--global--border--color--default);
  color: var(--quay-text);
}

.quay-workspace {
  display: grid;
  gap: 1rem;
  min-width: 0;
  padding: 1.5rem;
}

.quay-command {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid var(--quay-border);
  border-radius: 0.375rem;
  padding: 0.75rem 1rem;
  background: var(--quay-surface);
}

.quay-command code { overflow-wrap: anywhere; }

@media (max-width: 48rem) {
  .quay-workspace { padding: 1rem; }
}

@media (prefers-reduced-motion: reduce) {
  .quay-next { scroll-behavior: auto; }
}
```

Use the official PF6 theme mechanism and component APIs, not guessed internal selectors. Import `@patternfly/react-core/dist/styles/base.css` once in the new entry. The repository owns a small typography/spacing/composition layer, not a fork of PatternFly CSS.

## 3. Same-origin JSON client seed

The client below deliberately does not redirect, retry, persist tokens, replay mutations, or assume that a 401 always means the same thing. The auth state machine and resource catalog decide how to react. The OpenShift bearer adapter is separate; do not shoehorn a host token into a global browser variable.

```ts
// src/next/lib/api/client.ts
export type Parser<T> = (value: unknown) => T;
export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: 'http_error' | 'fresh_login_required' |
      'preview_operation_blocked',
  ) {
    super(`Request failed (${status})`);
    this.name = 'ApiError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorCode(value: unknown): ApiError['code'] {
  if (!isRecord(value)) return 'http_error';
  if (value.title === 'fresh_login_required' || value.error_type === 'fresh_login_required') {
    return 'fresh_login_required';
  }
  return value.error_type === 'preview_operation_blocked'
    ? 'preview_operation_blocked' : 'http_error';
}

async function boundedJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw new Error('Empty JSON response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('Response exceeds this operation’s size limit');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(data)) as unknown; }
  catch { throw new Error('Invalid JSON response'); }
}

export class SessionJsonClient {
  private csrf: string | undefined;
  private csrfFlight: Promise<string> | undefined;
  private epoch = 0;

  get generation(): number { return this.epoch; }

  resetIdentity(): void {
    this.epoch += 1;
    this.csrf = undefined;
    this.csrfFlight = undefined;
    // The owning SessionProvider also cancels requests and clears QueryClient/form state.
  }

  private assertEpoch(epoch: number): void {
    if (epoch !== this.epoch) throw new DOMException('Identity changed', 'AbortError');
  }

  private async raw(
    path: string, init: RequestInit, epoch: number,
    signal?: AbortSignal, maxBytes = 4 * 1024 * 1024,
  ): Promise<unknown> {
    this.assertEpoch(epoch);
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
      throw new Error('Only application-owned relative API paths are allowed');
    }
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin || url.username || url.password || url.hash) {
      throw new Error('Cross-origin API request rejected');
    }
    if (!(url.pathname.startsWith('/api/v1/') || url.pathname === '/api/v1/repository' ||
          url.pathname === '/config' || url.pathname === '/csrf_token')) {
      throw new Error('Unknown API surface');
    }
    const aborter = new AbortController();
    const relayAbort = (): void => aborter.abort(signal?.reason);
    if (signal?.aborted) relayAbort();
    signal?.addEventListener('abort', relayAbort, {once: true});
    const timer = setTimeout(() => aborter.abort(new Error('Request timeout')), 15000);
    try {
      const response = await fetch(url, {
        ...init, credentials: 'same-origin', mode: 'same-origin',
        redirect: 'error', cache: 'no-store', signal: aborter.signal,
      });
      this.assertEpoch(epoch);
      const rotated = response.headers.get('X-Next-CSRF-Token');
      if (rotated && rotated.length <= 512 && !/[\r\n]/.test(rotated)) this.csrf = rotated;
      const contentType = response.headers.get('content-type') ?? '';
      const isJson = /^application\/(?:json|[a-z0-9.+-]+\+json)(?:;|$)/i.test(contentType);
      const value = response.status === 204 ? undefined
        : isJson ? await boundedJson(response, maxBytes) : undefined;
      this.assertEpoch(epoch);
      if (!response.ok) throw new ApiError(response.status, errorCode(value));
      if (response.status !== 204 && !isJson) throw new Error('Expected JSON response');
      return value;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', relayAbort);
    }
  }

  private getCsrf(): Promise<string> {
    if (this.csrf) return Promise.resolve(this.csrf);
    if (this.csrfFlight) return this.csrfFlight;
    const epoch = this.epoch;
    const flight = this.raw('/csrf_token', {method: 'GET'}, epoch).then(value => {
      this.assertEpoch(epoch);
      if (!isRecord(value) || typeof value.csrf_token !== 'string' ||
          !value.csrf_token.length || value.csrf_token.length > 512 ||
          /[\r\n]/.test(value.csrf_token)) throw new Error('Invalid CSRF response');
      this.csrf = value.csrf_token;
      return value.csrf_token;
    });
    this.csrfFlight = flight;
    const clear = (): void => { if (this.csrfFlight === flight) this.csrfFlight = undefined; };
    void flight.then(clear, clear);
    return flight;
  }

  async request<T>(
    path: string, parse: Parser<T>,
    options: {method?: Method; body?: unknown; signal?: AbortSignal; maxBytes?: number} = {},
  ): Promise<T> {
    const epoch = this.epoch;
    const method = options.method ?? 'GET';
    const headers = new Headers({Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest'});
    if (method !== 'GET') headers.set('X-CSRF-Token', await this.getCsrf());
    this.assertEpoch(epoch);
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    const value = await this.raw(path, {
      method, headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }, epoch, options.signal, options.maxBytes);
    return parse(value);
  }
}
```

Production integration requirements for this seed: only typed catalog operations may call `request`; enforce endpoint-specific request/response schemas and limits; add prompt cancellation while an individual caller awaits the shared CSRF promise without cancelling other callers; cancel transport requests at identity changes; test rotation ordering; normalize network/timeout/protocol errors into accessible UI states. Preserve the backend's exact trailing slashes rather than relying on redirects. Auth return handling, host-token refresh, 429 backoff for safe reads, and reauthentication intent handling belong in their explicit adapters/state machines, not hidden global interceptors.

Do not weaken `redirect: 'error'` globally when one endpoint redirects. Verify the canonical contract or add a specifically audited operation. Do not log raw response bodies or errors containing credentials. Unknown fields may be ignored; missing identity/permission fields must never produce extra privileges.

### Bounded page contract and Query4 usage

```ts
// src/next/features/artifacts/tags.ts
import {useQuery} from '@tanstack/react-query';
import {ApiError, isRecord, SessionJsonClient} from '../../lib/api/client';

interface TagRecord { name: string; manifest_digest: string; }
interface TagPage { page: number; has_additional: boolean; tags: TagRecord[]; }

function parseTagPage(value: unknown): TagPage {
  if (!isRecord(value) || !Number.isSafeInteger(value.page) ||
      typeof value.page !== 'number' || typeof value.has_additional !== 'boolean' ||
      !Array.isArray(value.tags) || value.tags.length > 1000) {
    throw new Error('Unexpected tag-page contract');
  }
  const tags = value.tags.map((tag: unknown): TagRecord => {
    if (!isRecord(tag) || typeof tag.name !== 'string' ||
        typeof tag.manifest_digest !== 'string') throw new Error('Unexpected tag record');
    return {name: tag.name, manifest_digest: tag.manifest_digest};
  });
  return {page: value.page, has_additional: value.has_additional, tags};
}

function repositoryPath(namespace: string, repository: string): string {
  const components = [namespace, ...repository.split('/')];
  if (components.some(part => !/^[a-z0-9][a-z0-9._-]*$/.test(part))) {
    throw new Error('Unsupported repository identifier');
  }
  return components.map(encodeURIComponent).join('/');
}

export function useTagPage(
  client: SessionJsonClient, namespace: string, repository: string,
  page: number, filter: string,
) {
  const path = repositoryPath(namespace, repository);
  const query = new URLSearchParams({page: String(page), limit: '25', onlyActiveTags: 'true'});
  if (filter) query.set('filter_tag_name', filter);
  return useQuery({
    queryKey: ['next', window.location.origin, client.generation, 'tags', path, page, filter],
    queryFn: ({signal}) => client.request(`/api/v1/repository/${path}/tag/?${query}`, parseTagPage, {signal}),
    keepPreviousData: true,
    staleTime: 15000,
    retry: (failures, error) => failures < 2 && error instanceof ApiError &&
      error.status >= 500 && error.status <= 599,
  });
}
```

The example parser only shows fields needed to demonstrate pagination. Extend it into the full normalized domain model with source-verified optional fields; do not replace `unknown` with `as Tag[]`. Validate page/filter input before the hook and use the verified backend first-page convention. If previous-page data remains visible during a page transition, label that state and disable bulk mutations against it. No client-side sort may masquerade as global server ordering.

## 4. Live-preview policy: runnable, narrow, fail-closed seed

This policy intentionally allows one selected repository plus its namespace listing. The final workbench can support an explicit launcher-owned namespace/repository allowlist, but not a frontend-controlled arbitrary proxy scope. Add exact-match tests before expanding it. New algorithms and endpoints require reviewed validation; rejection does not mean the backend can never support them.

The following example and its 29-test suite were executed locally while preparing this plan. That is policy-function evidence only, not live Quay or browser-auth evidence.

```js
// tools/next-preview/policy.mjs
export const LIVE_ORIGIN = 'https://quay.io';

export function parseScope(value) {
  if (typeof value !== 'string' || value.length > 512) {
    throw new Error('Set QUAY_LIVE_REPOSITORY to namespace/repository');
  }
  const parts = value.split('/');
  if (parts.length < 2 || parts.some(p => !/^[a-z0-9][a-z0-9._-]*$/.test(p))) {
    throw new Error('Invalid repository scope');
  }
  return {namespace: parts[0], repository: parts.slice(1).join('/')};
}

function queryMatches(url, fields, required = []) {
  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    const validate = fields[key];
    if (!Object.hasOwn(fields, key) || values.length !== 1 ||
        typeof validate !== 'function' || !validate(values[0])) return false;
  }
  return required.every(key => url.searchParams.has(key));
}

const boundedText = max => value => value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const integer = (min, max) => value => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
const bool = value => value === 'true' || value === 'false';

export function isApprovedRead(rawUrl, method, scope) {
  if (method !== 'GET') return false;
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.origin !== LIVE_ORIGIN || url.username || url.password || url.hash) return false;
  if (/%(?:2f|5c|2e|25)/i.test(url.pathname)) return false;
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return false; }
  if (path.includes('\\') || path.includes('%')) return false;
  if (['/config', '/csrf_token', '/api/v1/user/'].includes(path)) {
    return queryMatches(url, {});
  }
  if (path === '/api/v1/repository') {
    return queryMatches(url, {
      namespace: value => value === scope.namespace,
      public: value => value === 'true',
      last_modified: bool,
      next_page: boundedText(8192),
    }, ['namespace', 'public']);
  }
  const base = `/api/v1/repository/${scope.namespace}/${scope.repository}`;
  if (path === base) {
    return queryMatches(url, {includeStats: bool, includeTags: value => value === 'false'});
  }
  if (path === `${base}/tag/`) {
    return queryMatches(url, {
      page: integer(0, 1000000), limit: integer(1, 100),
      onlyActiveTags: value => value === 'true',
      specificTag: boundedText(128), filter_tag_name: boundedText(128),
    });
  }
  if (!path.startsWith(`${base}/manifest/`)) return false;
  const tail = path.slice(`${base}/manifest/`.length);
  const match = /^(sha256:[a-f0-9]{64}|sha512:[a-f0-9]{128})(\/security|\/labels)?$/.exec(tail);
  if (!match) return false;
  return match[2] === '/security'
    ? queryMatches(url, {vulnerabilities: value => value === 'true'})
    : queryMatches(url, {});
}
```

### Policy tests

```js
// tools/next-preview/policy.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {isApprovedRead, parseScope} from './policy.mjs';
const scope = parseScope('acme/nested/app');
const base = 'https://quay.io/api/v1/repository/acme/nested/app';
const digest = `sha256:${'a'.repeat(64)}`;
const checks = [
  ['scoped detail', base, 'GET', true],
  ['tag page', `${base}/tag/?page=1&limit=25&onlyActiveTags=true`, 'GET', true],
  ['namespace list', 'https://quay.io/api/v1/repository?namespace=acme&public=true', 'GET', true],
  ['scan', `${base}/manifest/${digest}/security?vulnerabilities=true`, 'GET', true],
  ['encoded digest colon', `${base}/manifest/${digest.replace(':', '%3A')}`, 'GET', true],
  ['SHA512', `${base}/manifest/sha512:${'a'.repeat(128)}`, 'GET', true],
  ['delete', base, 'DELETE', false],
  ['retag', `${base}/tag/latest`, 'PUT', false],
  ['signout', 'https://quay.io/api/v1/signout', 'POST', false],
  ['signin in preview', 'https://quay.io/api/v1/signin', 'POST', false],
  ['side-effect GET', 'https://quay.io/api/v1/user/assignedauthorization', 'GET', false],
  ['neighboring repo', `${base}-other`, 'GET', false],
  ['namespace mismatch', 'https://quay.io/api/v1/repository?namespace=acme2&public=true', 'GET', false],
  ['missing namespace', 'https://quay.io/api/v1/repository?public=true', 'GET', false],
  ['duplicate query', `${base}/tag/?page=1&page=2`, 'GET', false],
  ['unknown query', `${base}?url=https://example.com`, 'GET', false],
  ['prototype query', `${base}?toString=x`, 'GET', false],
  ['oversized page', `${base}/tag/?limit=100000`, 'GET', false],
  ['scheme', base.replace('https:', 'http:'), 'GET', false],
  ['host suffix', base.replace('quay.io', 'quay.io.example.com'), 'GET', false],
  ['userinfo', base.replace('https://', 'https://user:pass@'), 'GET', false],
  ['fragment', `${base}#secret`, 'GET', false],
  ['encoded slash', base.replace('nested/app', 'nested%2Fapp'), 'GET', false],
  ['double encoded slash', base.replace('nested/app', 'nested%252Fapp'), 'GET', false],
  ['bad percent', `${base}/manifest/%GG`, 'GET', false],
  ['unsupported digest', `${base}/manifest/md5:${'a'.repeat(32)}`, 'GET', false],
  ['malformed digest', `${base}/manifest/sha256:123`, 'GET', false],
  ['unreviewed v2', 'https://quay.io/v2/acme/nested/app/tags/list', 'GET', false],
];
for (const [name, url, method, expected] of checks) {
  test(name, () => assert.equal(isApprovedRead(url, method, scope), expected));
}
test('reject invalid scope', () => {
  for (const value of ['acme', 'acme/../app', 'acme/app;id', 'acme/app\n', '', null]) {
    assert.throws(() => parseScope(value));
  }
});
```

Extend these with property-based or generated URL cases, encoded dot segments, Unicode/control characters, duplicate namespace parameters, query lengths, write-body mismatches, and any added operation. The policy is deliberately independent of the UI so frontend state cannot silently broaden it.

## 5. Static-asset overlay launcher seed

This launcher is not a production server or a login proxy. It starts a browser context and serves only build assets at a virtual preview prefix. The native login phase passes through to the real site; preview pages are closed before that policy is relaxed. It does not read or export cookies.

Requirements before running: build the new entry, emit `dist-next/asset-manifest.json`, install the workspace's Playwright browser, and set `QUAY_LIVE_REPOSITORY`. Run only trusted local source. Implement the deterministic overlay integration tests described below before using an account with valuable repositories.

```js
// tools/next-preview/live-preview.mjs
import {chromium} from '@playwright/test';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';
import {LIVE_ORIGIN, parseScope, isApprovedRead} from './policy.mjs';

const prefix = '/__quay_next_preview__/';
const scope = parseScope(process.env.QUAY_LIVE_REPOSITORY ?? 'projectquay/quay');
const dist = await realpath(path.resolve('dist-next'));
const headers = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': [
    "default-src 'none'", "script-src 'self'", "style-src 'self'",
    "style-src-attr 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'",
    "connect-src 'self'", "base-uri 'none'", "object-src 'none'",
    "frame-ancestors 'none'", "form-action 'self'",
  ].join('; '),
};
const contentTypes = {
  '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
};

async function insideDist(relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative)) throw new Error('Invalid asset manifest');
  const resolved = await realpath(path.resolve(dist, relative));
  if (!resolved.startsWith(`${dist}${path.sep}`)) throw new Error('Asset escaped build directory');
  return resolved;
}

async function loadBuild() {
  const manifest = JSON.parse(await readFile(path.join(dist, 'asset-manifest.json'), 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid manifest');
  const assets = new Map();
  for (const [name, relative] of Object.entries(manifest)) {
    if (!/^assets\/[a-zA-Z0-9._/-]+$/.test(name) || name.split('/').includes('..')) {
      throw new Error('Invalid public asset name');
    }
    const contentType = contentTypes[path.extname(name)];
    if (!contentType) throw new Error('Unapproved asset type');
    assets.set(`${prefix}${name}`, {file: await insideDist(relative), contentType});
  }
  return {assets, index: await insideDist('index.html')};
}

let build = await loadBuild();
let mode = 'preview';
const browser = await chromium.launch({headless: false});
const context = await browser.newContext({serviceWorkers: 'block', acceptDownloads: false});
const terminal = createInterface({input: stdin, output: stdout});

async function closePages() {
  for (const page of context.pages()) await page.close();
}

await context.route('**/*', async route => {
  const request = route.request();
  if (mode === 'native') {
    // Only genuine site/provider pages exist in this phase; local SPA is never served.
    await route.continue();
    return;
  }
  const url = new URL(request.url());
  const asset = url.origin === LIVE_ORIGIN ? build.assets.get(url.pathname) : undefined;
  if (request.method() === 'GET' && asset && !url.search) {
    await route.fulfill({status: 200, path: asset.file, contentType: asset.contentType, headers});
    return;
  }
  if (request.method() === 'GET' && url.origin === LIVE_ORIGIN &&
      url.pathname.startsWith(prefix) && !url.pathname.startsWith(`${prefix}assets/`) &&
      request.isNavigationRequest() && request.resourceType() === 'document') {
    await route.fulfill({status: 200, path: build.index, contentType: 'text/html', headers});
    return;
  }
  if (isApprovedRead(request.url(), request.method(), scope)) {
    await route.continue(); // No body rewriting, API stubbing, or credential injection.
    return;
  }
  if (url.origin === LIVE_ORIGIN) {
    await route.fulfill({status: 403, headers: {'cache-control': 'no-store'},
      json: {error_type: 'preview_operation_blocked'}});
  } else {
    await route.abort('blockedbyclient');
  }
});

await context.routeWebSocket('**/*', route => {
  if (mode === 'native') route.connectToServer();
  else void route.close();
});

async function openPreview() {
  await closePages();
  mode = 'preview';
  build = await loadBuild();
  const page = await context.newPage();
  const repositoryPath = [scope.namespace, ...scope.repository.split('/')].map(encodeURIComponent).join('/');
  await page.goto(`${LIVE_ORIGIN}${prefix}repository/${repositoryPath}`);
  return page;
}

async function nativeLogin() {
  await closePages(); // Do this before relaxing the network policy.
  mode = 'native';
  const page = await context.newPage();
  await page.goto(`${LIVE_ORIGIN}/signin`);
  await terminal.question('Complete normal sign-in in the browser, then press Enter here. ');
  // Do not inspect the password, provider response, cookies, or token-bearing URLs.
  await openPreview();
}

try {
  console.log('Trusted local UI code will use this isolated browser session. Repository writes are blocked in preview.');
  if (process.argv.includes('--login')) await nativeLogin();
  else await openPreview();
  for (;;) {
    const command = (await terminal.question('Preview: login / reload / quit > ')).trim();
    if (command === 'quit') break;
    if (command === 'login') await nativeLogin();
    else if (command === 'reload') await openPreview();
  }
} finally {
  terminal.close();
  await context.close();
  await browser.close();
  // Deliberately do not invoke Quay signout or export storageState.
}
```

Before treating this as the production-quality preview tool, add controlled termination for Ctrl-C/browser close; safe error reporting without token-bearing URLs; startup/asset-size limits; manifest completeness checks; session-presence feedback after login; automated verification that every preview page is closed before native mode; and explicit multi-repository/namespace policy support. Catch route-handler errors and abort safely rather than leaving requests hanging. No `ignoreHTTPSErrors`, certificate replacement, `--disable-web-security`, persistent user profile, or cookie transfer may be added to make a test pass.

The main application must expose preview limitations clearly. The example does not allow global search, all namespaces, avatar fetches, notifications, or distribution blob downloads until their exact endpoints and privacy implications are reviewed. These are policy omissions to implement deliberately, not reasons to replace the allowlist with `/api/**`.

Native login verifies that the new app can consume a real Quay browser session. It does not test the redesigned login UI. QN-08 adds a separate auth-evaluation profile with narrowly allowed auth operations and genuine provider navigation. No repository writes are enabled by that profile.

### Required overlay integration tests

Use a local HTTP fixture origin only in a separate test-only harness configuration. Do not allow an environment variable to turn the live runner into an arbitrary-target proxy. The fixture server records received methods and returns a test session cookie, CSRF token, rotated token, and deterministic API response. Verify that local HTML executes with the fixture origin, a real browser fetch reaches the fixture server with the expected cookie, CSRF rotation works, and blocked methods never reach the server. Verify an unknown asset cannot read a local source/env file or escape via a symlink. Verify native/preview switching closes existing pages and workers, external requests and websockets are blocked during preview, and a page-level route cannot accidentally replace the live policy.

These are harness/contract tests, not Quay black-box E2E. Actual production-auth and deployed-header tests remain required.

## 6. Behavior-test examples and coverage expectations

### A genuine deployed UI test

The existing Quay Playwright E2E tree must exercise a deployed new entry with a real backend. Use the project's existing fixtures and test tags. No `page.route()` API fixtures, direct database seeding, or fixed shared test resources.

```ts
// Illustrative body for web/playwright/e2e/next/repository.spec.ts.
// Integrate the existing authenticated fixtures and an API-created disposable repo.
// nextPage, repository, and knownDigest are supplied by the new scoped fixture adapter.
test('copies the selected immutable artifact reference', {
  tag: ['@critical', '@repository', '@next'],
}, async ({nextPage, repository, knownDigest}) => {
  await nextPage.goto(repository.nextUrl);
  const table = nextPage.getByRole('table', {name: 'Tags and artifacts'});
  await expect(table).toBeVisible();
  const row = table.getByRole('row').filter({hasText: repository.fixtureTag});
  await row.getByRole('button', {name: `Inspect ${repository.fixtureTag}`}).click();
  await expect(nextPage.getByRole('dialog', {name: /artifact details/i})).toBeVisible();
  await expect(nextPage.getByTestId('artifact-full-digest')).toHaveText(knownDigest);
  await nextPage.getByRole('button', {name: /copy digest-pinned pull command/i}).click();
  await expect(nextPage.getByRole('status')).toContainText('Copied');
  // Assert the actual clipboard through browser-supported permissions/test integration,
  // not only a success toast. The expected value contains knownDigest in full.
});
```

This test body is intentionally not a standalone file: the agent must provide the imports, typed scoped fixtures, clipboard assertion, API-based setup/cleanup, and actual application selectors. Do not delete the clipboard assertion merely because a toast is easier to test. Use role/name queries for behavior and stable `data-testid` for technical values; never PF-generated IDs or positional CSS selectors.

### Pure unit cases

Test parsers, reference builders, query keys, pagination reducers, capability normalization, evidence aggregation, and the auth state machine with Vitest. Example assertions should include:

```ts
expect(scanText({kind: 'unavailable', reason: 'scanner offline'})).toBe('Report unavailable');
expect(scanText({kind: 'partial', covered: 1, total: 2})).toBe('1/2 platforms covered');
expect(scanText({kind: 'reported', critical: 0, high: 0, other: 0,
  reportTime: null, retrievedAt: '2026-09-22T00:00:00Z'})).toBe('No vulnerabilities reported');
// No branch returns 'Safe', 'Verified', or a fabricated scan timestamp.
```

Component/form/navigation behavior belongs in Playwright. Use the deterministic contract server for exhaustive failure-state and visual tests outside `web/playwright/`; retain actual-backend E2E as the release evidence. A mock returning a made-up API field is not proof quay.io provides that field.

### Evidence to retain per task

Record exact commands, result, scope, and environment. For browser tests, record viewport, theme, browser version, target mode, and whether responses came from fixtures or Quay. Screenshots from private live repositories and traces containing sessions are not committed. Coverage reports must name exclusions and the code paths actually exercised.

When preparing this plan, the local Node policy example completed **29 tests, 29 passed, 0 failed**. The environment exposed the Playwright Python package but not its required Chromium executable. Therefore browser-overlay execution, React/PatternFly compilation, live auth, private repository behavior, and all proposed release suites are **not run**, not passed. Re-run and expand the examples in the actual development checkout.

Next: [EXECUTION.md](EXECUTION.md).
