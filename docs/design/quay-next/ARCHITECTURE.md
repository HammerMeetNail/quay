# Quay Next architecture, authentication, and security

Read [README.md](README.md) first. This document is normative for implementation unless a numbered architectural decision is explicitly amended with evidence. Examples are in [IMPLEMENTATION.md](IMPLEMENTATION.md); task gates are in [EXECUTION.md](EXECUTION.md).

## 1. Evidence and version baseline

Source baseline: `f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1` in `HammerMeetNail/quay`. Source inspection establishes the following; it does not establish which changes are deployed to quay.io.

| Source fact | Consequence |
| --- | --- |
| `web/package.json` declares React 18, PatternFly 6, Router 7, and TanStack Query 4 | Use those installed major versions initially; do not copy stale PF5/Router6 guidance or Query5-only APIs [S1] |
| Current frontend resources call `/config`, `/csrf_token`, and `/api/v1/*` | Preserve actual contracts and separate public, UI, and distribution API surfaces [S2–S5] |
| Session requests use `X-CSRF-Token`, with rotation through `X-Next-CSRF-Token` | Implement single-flight acquisition, rotation, and identity invalidation [S2, S6] |
| Reauthentication is signaled with `fresh_login_required` and verified through `/api/v1/signin/verify` | Preserve step-up authentication, but do not blindly replay every pending mutation [S2–S3] |
| External login starts at `/api/v1/externallogin/{service}` and returns `auth_url` | Backend remains responsible for provider selection, state, callback construction, and configured upstream PKCE [S3, S7] |
| The inspected signout implementation invalidates all sessions for that user | Do not call signout as automated live-preview cleanup; preserve and explain the actual behavior [S7] |
| Repository lists use `next_page`; tag lists use `page` and `has_additional` | Do not invent one pagination model or silently discard pages [S4–S5] |
| Tag resources expose manifest-list, sparse-child, immutability, and optional pull-statistics fields | Show these only when actually returned; fork support does not prove quay.io support [S5] |
| The existing Playwright suite prohibits backend mocks/intercepts and database seeding | Keep preview/contract harnesses separate from release black-box E2E tests [S8] |

The source ledger at the end links to the inspected files. Runtime evidence records the target origin, observation time, API shape, and enabled capabilities, never authentication secrets or private raw payloads.

## 2. Architectural decisions

### ADR-01: new entry, existing workspace

Create an independent application entry under `web/src/next/`, with its own route tree, QueryClient, auth transport, and styles. Use the existing web workspace and lockfile. Build it separately into `web/dist-next/`. Leave the old Angular application, existing React entry, and OpenShift plugin builds operational during migration.

Do not wrap the old pages in a new sidebar. Do not import the existing global Axios singleton, Recoil root, monolithic navigation tree, or application-wide side-effect modules into the new entry. Reuse audited pure parsers, formatting utilities, and contract knowledge selectively. Extract truly shared code only with tests for both consumers.

React 18 is sufficient for this design and supported by PatternFly 6 [S9]. A React, Router, Query, or bundler major upgrade is a separate change, not a prerequisite. Use Query4's `useQuery`/`useInfiniteQuery`; route-level `React.lazy`/`Suspense` is independent of the data-query version. Do not assume a `useSuspenseQuery` example works against Query4.

Use TypeScript strict mode. Start with native `fetch`, explicit runtime parsers, React Context/reducers for ephemeral UI/auth state, and TanStack Query for server state. No new Redux/Recoil/Zustand store is needed. Use the existing form library only where its value exceeds a small controlled form. Add a schema library only through a documented dependency decision; generated TypeScript types alone are not runtime validation.

### ADR-02: no new backend requirement for core journeys

The first release uses existing Quay endpoints. Unknown or unavailable functionality degrades explicitly. It does not become a new `/api/next/dashboard` dependency. Any future backend enhancement is optional and capability-gated; the core workbench remains useful without it.

Permission enforcement remains on Quay. Client permission checks improve usability but are not an authorization boundary. Browser feature flags are not authorization grants. A token, cookie, or `can_write` field does not let the UI override the backend.

### ADR-03: two development modes, one production auth model

Provide these clearly labeled modes:

| Mode | Backend | Authentication | Intended use |
| --- | --- | --- | --- |
| Fixture workbench | Deterministic local contract server | Synthetic identities | Visual development, error cases, accessibility, deterministic browser tests |
| Same-origin live preview | Unmodified quay.io | Genuine Quay session and normal identity-provider flow | Real repositories, real permissions, manual evaluation, opt-in live contract checks |
| Optional local API bridge | Fixed upstream quay.io | Anonymous or explicit management API token held by bridge | Ordinary-browser local public/API evaluation; not full browser-session parity |
| Production/canary | Existing Quay origin | Existing backend auth and configured identity providers | Deployment and final parity verification |

The first two are required. The optional bridge must not delay the same-origin live preview. The native browser session is the production model; API-token mode is a separate adapter, not a replacement login system.

### ADR-04: incremental cutover, no silent feature loss

Ship behind an opt-in route or deployment-controlled flag. Keep stable legacy links and a visible return-to-current-UI option during the canary. A temporary fallback is a migration state, not completed parity. The agent must maintain the capability inventory and cannot declare full replacement complete while required features still depend on old pages without an explicit product decision.

## 3. Real quay.io development without a Quay stack

### 3.1 Why a base-URL setting is insufficient

A localhost origin does not automatically inherit quay.io cookies or provider callbacks. Changing an Axios URL cannot turn one browser origin into another. CORS, cookie scope, CSRF, redirect allowlists, and provider registration must all be respected. Do not solve this by disabling browser security, exporting production cookies, stripping secure-cookie attributes, rewriting identity-provider callback URLs, or installing a local TLS interception certificate.

Quay's published external API documentation describes OAuth bearer access and a legacy fragment-token flow [S10]. That is not evidence that a new application authorization-code-plus-PKCE flow is available. The inspected backend also contains optional PKCE for Quay's upstream identity-provider login [S7]; these are two different OAuth relationships. Never conflate them. Current OAuth security guidance discourages unsafe implicit-token usage [S11].

### 3.2 Required solution: local static assets at the real origin

Build the SPA locally. Launch an isolated, headful Playwright browser context. Intercept only the preview document and exact build-manifest assets under:

```text
https://quay.io/__quay_next_preview__/
https://quay.io/__quay_next_preview__/assets/<build-produced-file>
```

Fulfill those requests from `web/dist-next`. All approved API requests continue through the browser to the real HTTPS backend. The page's origin remains quay.io. Normal session cookies, `/csrf_token`, CSRF rotation, and backend API enforcement therefore remain in play. Provider navigation and callbacks use the genuine backend host, not a forged localhost callback.

```text
Browser at https://quay.io/__quay_next_preview__/
  ├── preview HTML / exact static asset paths -> local dist-next files
  ├── /config, /csrf_token, approved /api/v1 reads -> real quay.io
  └── explicitly entered login flow -> real Quay / identity provider / callback

No local Quay • No database • No Redis • No scanner • No production cookie export
```

Playwright provides browser-context routing and static-response fulfillment [S12–S13]. This architecture must nevertheless pass an actual quay.io feasibility test before the agent builds the rest of the application around it. No successful live-auth test is claimed in this specification.

### 3.3 End-user workflow to implement

These commands are target scripts to be created, not commands already present in the baseline:

```bash
cd web
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm run next:build:preview
QUAY_LIVE_REPOSITORY=projectquay/quay pnpm run next:preview

# Explicitly enter native login in a dedicated browser context:
QUAY_LIVE_REPOSITORY=my_namespace/my_test_repository \
  pnpm run next:preview -- --login
```

The launcher explains that locally authored code will run with the selected account's session privileges. Use a least-privilege dedicated account when possible. The user performs passwords, SSO, MFA, CAPTCHA, and consent interactively in the genuine flow. The launcher does not collect those values. After login, the user explicitly resumes the preview, and the launcher verifies session presence through a same-origin user request without dumping the response.

The simplest implementation uses terminal commands `login`, `reload`, and `quit`. Before entering unrestricted native login, close all preview pages and workers. While in native mode, never serve the local SPA. Before returning to preview, close native pages, enable the preview request policy, and then load local assets. This prevents a background preview tab from gaining a temporarily unrestricted network policy.

Build assets use a fixed public path matching the preview prefix. Router basename is independent of the API origin. Rebuilding and reloading must not require rebuilding a backend. Add a watch-build command after the basic harness passes. Do not run a development websocket server under the live origin or use eval-based development bundles.

### 3.4 Safety rules for the preview harness

The preview defaults to **reviewed repository read operations**, not a blanket permission for every GET. Some existing GET handlers have side effects: the inspected assigned-authorization listing, for example, deletes related notifications [S7]. Start with a small route/method/query allowlist for `/config`, `/csrf_token`, `/api/v1/user/`, scoped repository listing, selected repository details, tags, manifests, labels, and scan reports. Expand only after source review and a policy test.

Block other API requests, unaudited distribution endpoints, websocket connections, service workers, and preview-origin requests to third parties. Return a distinguishable local `preview_operation_blocked` error; do not pretend it came from Quay. Do not modify allowed API responses. Do not use `page.route()` mocks inside live application tests. Keep synthetic policy responses and local asset substitution documented separately from backend evidence.

Interactive login is an explicitly separate mode because authentication changes session state. Account creation, password recovery, identity linking, token creation, billing, permission grants, and destructive actions are not silently allowed by the read-only label. To test the redesigned sign-in form, create a separate opt-in auth-evaluation policy allowing only the reviewed auth methods, bodies, providers, and redirects on a test account. Native login proves session interoperability; it does not by itself prove the new sign-in component.

Write evaluation requires an exact preauthorized test repository or namespace, a disposable test identity, an operation allowlist, and a ledger of resources created by the run. `QUAY_LIVE_ALLOW_WRITES=1` alone is insufficient. Match decoded structured identifiers exactly, not by substring. Validate create-request bodies as well as URL paths. Never delete an organization or arbitrary preexisting repository during live tests. Cleanup only resources created by the run and only after verifying ownership/scope.

Do not automatically call `/api/v1/signout` on exit: the inspected implementation invalidates all sessions [S7]. Closing the isolated context is not the same as remote logout or token revocation. A user-selected Quay logout must retain the backend's real semantics and warn when appropriate. A local API-token disconnect must not falsely claim global logout.

No storage-state export, HAR, video, tracing, request-body logs, cookie dumps, persistent profile, remote-debugging port exposure, or third-party telemetry in live mode by default. Treat any deliberately retained debugging artifact as sensitive and keep it out of Git. Browser isolation and network policy reduce mistakes; they are not a sandbox against malicious local source code or a replacement for backend authorization.

### 3.5 Limitations to report honestly

Browser-context routing does not intercept service-worker-owned traffic; disable service workers. Routing disables HTTP cache, so overlay timings do not establish production warm-cache performance [S12]. The overlay serves its own document headers, so it cannot prove deployed Quay CSP, CDN, cache-control, reverse-proxy, or rollout behavior. Test those in a real same-origin canary/staging deployment.

Some identity providers may restrict automated browser contexts. Do not bypass MFA, CAPTCHA, bot controls, or provider policy. Record an infrastructure limitation, retain anonymous/API development, and use an approved interactive/staging environment to complete the affected auth gate. The inability to test one enterprise identity provider on quay.io does not justify removing that provider from parity requirements.

### 3.6 Optional ordinary-browser localhost bridge

A small loopback bridge may serve the same SPA and forward narrowly approved API reads to a fixed `https://quay.io` target. Support anonymous use first. A management API token, when needed, is read by the bridge from a protected local file or operating-system secret store and retained server-side. Never pass it in a URL, command-line argument, `VITE_*`/bundled environment value, localStorage, or browser response.

Requirements: bind to loopback only; exact Host and Origin checks; no wildcard CORS; explicit local session/CSRF protection for credential setup; fixed upstream host; exact route/query/method allowlist; TLS verification; redirect denial or revalidation before forwarding credentials; timeouts and body limits; no credential/header logging; no arbitrary URL parameter; no API-token minting without consent. Browser navigation, webhooks, proxy settings, and forwarded headers cannot change the upstream target. A Go implementation uses `net/http`; a Node implementation must remain a small, audited server rather than another application platform.

This adapter is not advertised as full Quay session authentication. Public versus UI-only endpoints and scope requirements must be tested individually; an `internal_only` annotation must not itself be assumed to be an authorization rule. Do not promise that a robot registry credential is a general browser-login credential or that a management API token provides every account-management capability.

## 4. Authentication parity contract

### 4.1 Required inventory

Generate `docs/design/quay-next/evidence/auth-parity.md` during task QN-00. Inventory both the legacy and React flows, backend auth handlers, runtime `/config`, provider configuration, invitation/email links, account completion, and host-plugin behavior. Record the exact route, payload, cookies/headers, preconditions, error states, and test for each flow. Public config may be sanitized; never commit tokens, credentials, session cookies, authorization codes, or private account data.

Do not hardcode a list of social-login buttons from memory. The actual configured provider list is authoritative. No live provider list was established while writing this plan.

| Flow | Implementation contract | Verification environment |
| --- | --- | --- |
| Anonymous public browsing | Respect anonymous-access capability; distinguish loading from anonymous; suppress authenticated-only queries | Real quay.io public repo + deterministic states |
| Direct username/password | Preserve `POST /api/v1/signin`, validated fields, optional invite context, backend errors, password-manager behavior | Dedicated account + staging failures |
| LDAP-backed direct login | Same user-facing contract when the deployment config selects it; no frontend LDAP connection | LDAP-configured staging |
| Configured OAuth/OIDC provider | Start via backend external-login endpoint; navigate to returned URL; backend owns state, callback, scopes, and upstream PKCE | Each configured provider; quay.io where available |
| SSO-only deployment | Hide inappropriate direct-login affordances; preserve required redirects and account-completion steps | SSO-only staging |
| MFA, CAPTCHA, challenge/consent | Honor existing backend/IdP challenge; never simulate success or bypass it | Human-assisted approved flow + staging cases |
| Account creation and verification | Preserve feature gating, CAPTCHA, email verification, invitations, and post-registration prompts | Disposable users and test mail infrastructure |
| Recovery/reset | Preserve request, delivery, token redemption, expiry, and failure behavior; no credential logging | Test mail infrastructure; no unsolicited live emails |
| External identity attach/detach | Preserve backend actions and safe return routes; fresh-auth requirement where applicable | Disposable linked identities |
| CLI external-auth continuation | Preserve backend `kind: cli` and callback semantics | Supported CLI flow against authorized environment |
| Fresh login/step-up | Recognize backend challenge; one modal/flow; cancel/timeout terminates pending intents | Unit state machine + real staging session |
| Logout/expiry/account switch | Clear local state immediately; preserve actual remote signout semantics; no stale private-data flash | Multi-context staging + live manual session expiry where safe |
| Application consent/authorizations | Inventory existing consent, assigned authorization, revoke, and token management behavior | Disposable applications; not automated against personal apps |
| OpenShift/host integration | Preserve host-provided token acquisition and refresh before standalone anonymous handling | Actual supported host shell, not quay.io pretending to be that host |

If native second-factor or another auth flow exists in the inventory, it becomes a required row. If MFA is entirely provider-managed, do not invent a new TOTP/WebAuthn database or local bypass. A missing fixture or unavailable provider is **blocked**, not **passed** or silently **not applicable**.

### 4.2 Client auth state machine

```text
bootstrapping -> anonymous | authenticated | bootstrap-error
anonymous -> authenticating -> authenticated | auth-error
 authenticated -> reauthentication-required -> authenticated | cancelled | expired
 authenticated -> signing-out -> anonymous | locally-detached-with-remote-error
 any identity boundary -> increment session generation + cancel + clear sensitive state
```

Keep login failure, authorization failure, anonymous mode, expired session, and backend outage distinct. A 403 does not always mean sign in again. A 404 must not reveal a private repository that the backend intentionally conceals. An unknown auth response fails closed with a useful error.

Create the QueryClient and auth transport per session generation. Keys include backend identity and session generation, not bearer tokens. On logout/account switch: hide private views, cancel active requests, clear query and mutation caches, reset CSRF/host-token state, clear sensitive drawer/form state, and reject pending intents. Late responses from the old generation cannot repopulate the cache. Synchronize logout across tabs using a nonsecret event channel where appropriate.

CSRF acquisition is single-flight. Read `X-Next-CSRF-Token` on responses, including error responses where supplied. Clear the token after identity change. Do not treat CSRF tokens as durable credentials. Mutations are not automatically retried on network error, timeout, 401, or 403. A timeout can mean the operation committed but the response was lost: reconcile using a fresh read and expose the uncertainty.

For fresh-login challenges, suspend one user intent and complete reauthentication. GETs may be retried once. A mutation is resubmitted only after confirming that the backend rejected it before effects and that the original intent remains valid; otherwise show an explicit retry confirmation after refreshing state. Do not introduce an unbounded global queue that replays destructive operations after a delayed password prompt.

External URLs are treated as navigation, not arbitrary data for `fetch`. Validate configured auth destinations and supported schemes, but do not rewrite legitimate provider state/scopes/callback parameters. Return destinations are same-origin, application-owned relative paths, never arbitrary `next=https://...` inputs. Keep OAuth callback handling owned by the backend unless the inventory proves a particular client-side callback is required.

## 5. Data contract and information availability

### 5.1 Initial endpoint map

The table is verified against source, not a promise about the current quay.io deployment. Use `URLSearchParams` and encoded validated path segments. Preserve trailing slashes where required to avoid redirect-dependent mutation behavior.

| Purpose | Existing contract | New behavior |
| --- | --- | --- |
| Runtime config | `GET /config` | Normalize features/provider presentation; retain unknown fields only in safe diagnostics |
| Session identity | `GET /api/v1/user/` | Distinguish anonymous/401, authenticated, forbidden, and infrastructure failure |
| CSRF | `GET /csrf_token` -> `csrf_token` | Single-flight, memory only, identity-bound |
| Repository list | `GET /api/v1/repository?namespace=...&public=true&last_modified=true&next_page=...` -> `repositories`, `next_page` | One page at a time; opaque cursor preserved; exact scope and completeness visible |
| Repository detail | `GET /api/v1/repository/{namespace}/{repo}?includeStats=true&includeTags=false` | Permissions and state from response; avoid stats unless needed |
| Tags | `GET /api/v1/repository/{namespace}/{repo}/tag/?page=...&limit=...&onlyActiveTags=true` -> `tags`, `page`, `has_additional` | Page size 25 initially; verify first-page convention from backend and fixtures before hardcoding |
| Tag search | Same tag endpoint with `filter_tag_name` or `specificTag` where appropriate | Verify exact/pattern semantics; escaped input, bounded length, cancellation |
| Manifest | `GET /api/v1/repository/{namespace}/{repo}/manifest/{digest}` | Validate/parse `manifest_data` safely, preserve raw digest identity |
| Labels | `GET .../manifest/{digest}/labels` | Lazy detail section; untrusted text |
| Scan report | `GET .../manifest/{digest}/security?vulnerabilities=true` | Exact digest/platform evidence, bounded polling and response handling |
| Retag/expiration/immutability | `PUT .../tag/{tag}` with the appropriate existing payload | Explicit intent, permissions, concurrent-change checks, no blind retries |
| Restore | `POST .../tag/{tag}/restore` with `manifest_digest` | Explain recoverability and exact affected artifact |
| Expire/permanent deletion | Existing `.../tag/{tag}/expire` variants have different bodies | Preserve their distinct semantics; never reuse one generic delete call |
| Pull statistics | `GET .../tag/{tag}/pull_statistics` when supported | Optional; distinguish absent endpoint from zero pulls |

Create a machine-readable endpoint catalog containing method, path builder, query schema, body schema, response parser, auth requirements, side effects, capability, retry policy, and test. This is an application contract catalog, not a new backend API. API client calls cannot bypass it. Unverified endpoints are not enabled by guessing names.

Do not assume distribution `/v2/*` is interchangeable with management `/api/v1/*` or frontend-looking `/api/v2/*`. Registry bearer challenges, scopes, media types, and redirects require their own verified adapter. Referrers, signatures, SBOMs, provenance, model cards, and non-image OCI artifacts are shown when the backend exposes supported data. Unsupported evidence never blocks the fundamental repository/tag workflow.

### 5.2 Capability model

Normalize every optional capability into `supported`, `unsupported`, or `unknown`, with its evidence source. Feature flags, returned fields, and explicit contract probes contribute evidence; version-string comparison alone does not. Unauthorized is a fourth access outcome, not proof a capability does not exist. A 404 is ambiguous and must not automatically become a permanent global capability decision.

Capabilities are keyed by origin/deployment identity and, when permission-dependent, principal/scope. Cache discovery for a bounded period and refresh after auth changes or explicit retry. Unknown mutation capability means disabled with explanation. Avoid repeatedly probing unsupported features for every row.

### 5.3 Query and pagination rules

No startup fan-out across all namespaces. No eager recursion through every repository page. No N+1 scan requests for a 100-row table. Initially load config, identity, and the first useful data page; parallelize only independent work. After a row is opened, request its manifest and selected evidence. Deduplicate by origin + namespace + repository + digest + platform.

Default detail-request concurrency is four; prefetch only on clear user intent and cancel on navigation. Search is debounced around 250 ms and superseded requests are aborted. Retry safe reads at most twice with jitter and server `Retry-After` handling for 429/503; never retry authentication or mutations automatically. Pause polling in hidden tabs and stop after terminal scan/build states. Cap polling duration and expose manual refresh.

Repository cursors are opaque. Detect repeated cursors and duplicate items without looping forever. Tags use their own page contract; do not fabricate totals from `has_additional`. Preserve loaded-page position and display partial coverage. Do not announce aggregate counts across unloaded pages. Bulk selection is current page by default; all-matching selection is unavailable unless the backend supports an enforceable operation scope or a bounded explicit enumeration the user reviews.

Cache immutable metadata by full digest. Security reports can change as vulnerability intelligence changes, so a digest key does not justify infinite scan-report freshness. Tag-to-digest associations are mutable and short-lived. Keep the observed digest attached to a mutation intent; refresh before acting if it changed. A client preflight is not atomic compare-and-swap: where the backend lacks a concurrency precondition, disclose the residual race and require review for high-impact actions rather than claiming it is solved.

### 5.4 Digest, platform, and content rules

Use complete validated digests as identities; do not assume all digests are SHA-256 or exactly 64 hexadecimal characters. Maintain tested validators for backend-supported algorithms and an explicit unsupported-algorithm state. Abbreviation is presentation only. Never reconstruct an identity from abbreviated text.

An index digest, child-manifest digest, tag name, and platform are separate fields. A missing child is not an empty successful scan. Manifest `size` is not necessarily compressed image-layer size. Pull count, last pull, creation, tag modification, report generation, and UI fetch time are separate metrics.

Repository descriptions, labels, annotations, logs, vulnerability descriptions, model cards, and manifest strings are hostile input. Render plain text by default. For Markdown, disable raw HTML, sanitize links, disable remote images by default, and reject script/data/navigation schemes. Never render a JSON field using `dangerouslySetInnerHTML`. Parse large documents with size/depth limits; expensive processing moves off the critical render path.

## 6. Security acceptance requirements

| Threat | Required control | Required test evidence |
| --- | --- | --- |
| Stored/reflected XSS in registry metadata | Escaped React text; restricted Markdown; no raw HTML; navigation URL validation | Payload corpus in labels, descriptions, logs, advisory links, filenames, model cards |
| CSRF/session confusion | Same-origin transport, backend CSRF, rotation, identity generation, safe return paths | Missing/invalid/rotated CSRF; session expiry; account switch; reauth cancellation |
| Authorization mistakes | Backend enforcement plus conservative UI permission model | Anonymous/read/write/admin/restricted/read-only/superuser matrix; direct API denial tests in staging |
| Secret exposure | No tokens/passwords in browser persistence, URLs, logs, analytics, Git, default traces, or generated commands | Canary-secret scan of bundle, storage, console, reports, request diagnostics |
| Destructive production testing | Reviewed route/body allowlist, exact disposable scope, explicit opt-in, created-resource ledger | Negative policy tests including encoded paths, neighboring names, reused resource IDs |
| SSRF/token forwarding in optional bridge | Fixed target, strict local origin checks, no arbitrary URL or redirect credential forwarding | Host/Origin, DNS/redirect, query/path traversal and header-injection cases |
| Supply-chain compromise | Locked dependencies, frozen install, audited additions, reproducible artifacts, SBOM, supported patched runtime | Dependency/secret scans and documented remediation/accepted risk |
| Deceptive safety claims | Evidence states bound to digest/platform; unknown never zero | Missing, partial, stale, failed, unsupported, and signature-presence-only fixtures |
| Export/clipboard injection | Validated references; shell-safe command builder; CSV formula neutralization | Newlines, quotes, substitutions, control characters, formula-prefix payloads |

### Headers and browser policy

The standalone production build uses HTTPS, existing backend cookie protections, `X-Content-Type-Options: nosniff`, restrictive Referrer-Policy, and a tested CSP. A starting policy is:

```text
 default-src 'none';
 script-src 'self';
 style-src 'self';
 style-src-attr 'unsafe-inline';
 img-src 'self' data:;
 font-src 'self';
 connect-src 'self';
 base-uri 'none';
 object-src 'none';
 frame-ancestors 'none';
 form-action 'self';
```

This is a starting policy, not a claim it already works with every PatternFly component, provider, payment integration, or host shell. The inline-style-attribute exception exists for component layout styles, not inline scripts. Test and narrow it where feasible. No `unsafe-eval`, wildcard script sources, or broad inline-script allowance. Add narrowly justified provider/CAPTCHA/payment frame, script, and form destinations only on pages requiring them. Prefer external static runtime configuration or a nonce-protected bootstrap, never unsafe string interpolation. The plugin inherits its host's security model and cannot blindly install standalone framing rules.

CSP is defense in depth, not a substitute for correct escaping and authorization [S14]. Production headers are applied by the real server/proxy and tested there, not only in a preview-generated HTML document.

Keep frontend telemetry off by default for live private data. Any optional telemetry sends event names and nonidentifying timings, not repository names, URLs, usernames, labels, or artifact contents. Do not add third-party session replay.

## 7. Performance and operability budgets

These are initial acceptance budgets to measure on the new app; they are not current measurements. QN-02 records a baseline and explains any revision rather than silently weakening the target.

| Budget | Target |
| --- | --- |
| Initial repository route JavaScript | At most 350 KiB gzip, including React and necessary PatternFly code; optional feature chunks excluded but separately reported |
| Initial CSS | At most 150 KiB gzip, no duplicate PatternFly base stylesheet |
| Initial critical requests | Config + identity + first data page; at most four required management API calls for a useful initial view |
| Detail concurrency | At most four concurrent enrichment requests; digest-level deduplication |
| Rendering | At most one current table page mounted initially; no 10,000-row DOM or eager all-namespace loading |
| Interaction under controlled fixture | No visible input lag during search/filtering; interaction latency target below 200 ms |
| Controlled production-like page metrics | LCP at most 2.5 s, CLS at most 0.1, measured with declared device/network/cache conditions |
| Failure behavior | Visible bounded error state, retry where safe, no infinite spinner/promise, no retry storm |

Record cold and warm measurements separately. Overlay cache behavior disqualifies it from proving warm-cache budgets. Real quay.io latency is useful observational evidence, not a deterministic CI threshold. Use a production-built app against controlled representative responses for regressions, then compare real backend observations. Record 25-row, 100-row, large-namespace, multi-platform, and long-manifest cases.

## 8. Source ledger

All repository links below refer to the inspected baseline, not a moving branch.

- [S1: actual web dependency manifest](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/package.json)
- [S2: existing Axios/session behavior](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/src/libs/axios.ts)
- [S3: frontend authentication resource](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/src/resources/AuthResource.ts)
- [S4: repository contracts and current pagination](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/src/resources/RepositoryResource.ts)
- [S5: tag, manifest, scan, and mutation contracts](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/src/resources/TagResource.ts)
- [S6: backend CSRF enforcement](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/endpoints/csrf.py)
- [S7: backend sign-in, external login, recovery, signout, and authorization handling](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/endpoints/api/user.py)
- [S8: existing Playwright testing rules](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/playwright/AGENTS.md)
- [S9: official PatternFly development guide](https://www.patternfly.org/get-started/develop/)
- [S10: Quay external API and OAuth documentation](https://docs.quay.io/api/)
- [S11: OAuth 2.0 Security Best Current Practice, RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html)
- [S12: Playwright BrowserContext routing](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)
- [S13: Playwright Route fulfillment](https://playwright.dev/docs/api/class-route#route-fulfill)
- [S14: OWASP Content Security Policy guidance](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [S15: repository agent conventions](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/AGENTS.md)
- [S16: existing standalone routing and anonymous shell](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/src/routes/StandaloneMain.tsx)
- [S17: runtime config request](https://github.com/HammerMeetNail/quay/blob/f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1/web/src/resources/QuayConfig.ts)

Next: [IMPLEMENTATION.md](IMPLEMENTATION.md).
