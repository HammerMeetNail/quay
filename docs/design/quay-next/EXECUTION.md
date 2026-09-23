# Quay Next agent execution plan

This is the implementation work order for [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), and [IMPLEMENTATION.md](IMPLEMENTATION.md). Do not replace implementation with another proposal. Do not declare success based on a static mockup, fabricated data, a green unit-test run alone, or a native login that never exercises the new auth UI.

**Current checkpoint (2026-09-23):** The first read-only repository/tag/artifact slice is committed at `5874f61948fc65d174bfdc7ffece632ee54a546c` on `docs/quay-ui-next-2026-09-22`. Public quay.io reads and Chromium/WebKit rendering were verified; Firefox launch is infrastructure-blocked, and private/authentication, write, full parity, accessibility/performance, and production gates remain open. See [task state](evidence/STATE.md) and [exact check outcomes](evidence/IMPLEMENTATION-STARTER.md). The QN-00–QN-12 work orders below remain the acceptance contract; partial implementation does not complete a task whose gates are still open.

**Revision 2 integration:** Execute V2-01–V2-06 in [VISUAL-REVISION-2.md](VISUAL-REVISION-2.md) as the current presentation pass within QN-02/QN-04/QN-05/QN-10. Use [MOBILE-V2.md](MOBILE-V2.md). Preserve the `b1d8ae900` checkpoint and historical test results; new UI results must be recorded separately. Do not restore the initial ZIP over the landed code, replace the locally modified lockfile, or call this presentation pass full parity. The owner has requested integration into the existing `docs/quay-ui-next-2026-09-22` fork branch; do not create a conflicting replacement branch solely because the original bootstrap template says to.

## 1. Working rules and agent authority

Read repository-root and applicable directory instructions before editing. Respect protected-file and CI conventions. Start from the plan branch and create an implementation branch; never push to `quay/quay` or merge into the user's default branch automatically. Use small, coherent commits with the repository's commit-message convention. Do not fabricate issue IDs. For a change without a supplied issue, use an appropriate `NO-ISSUE:` message.

Continue autonomously across tasks when acceptance criteria pass. Ask for human action only when a real credential/MFA/CAPTCHA/consent step, a protected-file approval, an explicitly scoped destructive test, or a final product/security release decision requires it. Never request passwords, cookies, or tokens in chat. Never weaken security, suppress a failing test, broaden live-write scope, or fabricate a missing API to avoid a blocker.

A blocked external provider does not stop unrelated implementation. Mark its gate blocked, state exactly what is needed, and continue independent tasks. It also does not allow a full auth-parity claim. Distinguish `passed`, `failed`, `not-run`, `blocked`, and justified `not-applicable` in every report.

### Persistent task state

Create `docs/design/quay-next/evidence/STATE.md` with a short table of task ID, state, commit, tests, and remaining blockers. Update it after each task, not after every tool call. Keep detailed evidence in small linked files. Do not fill the context window with the entire repository or every historical log; read the current task's contracts and relevant code.

Each completed task records:

```text
Task: QN-xx
Commit:
Files changed:
User-visible result:
Commands and outcomes:
Fixture / live / real staging evidence:
Capabilities tested:
Security and compatibility considerations:
Known limitations:
Next unblocked task:
```

No credentials, private account identifiers, raw private manifests, session-state files, live auth screenshots, or token-bearing URLs belong in these files. Use synthetic names for committed fixtures. Sanitize captured response shapes field by field rather than merely replacing one obvious token.

## 2. Dependency graph

```text
QN-00 inventory and contracts
  ├── QN-01 live-preview feasibility ───────────────┐
  └── QN-02 independent build and design system ─┐ │
                                                ▼ ▼
                                      QN-03 API/auth foundation
                                                │
                                      QN-04 repository workbench
                                                │
                                      QN-05 tags and artifact detail
                                                │
                           FIRST REAL-BACKEND EVALUATION MILESTONE
                                                │
                  ┌─────────────────────────────┼──────────────────────────┐
                  ▼                             ▼                          ▼
       QN-06 evidence and OCI       QN-07 writes and access      QN-08 auth parity
                  └─────────────────────────────┼──────────────────────────┘
                                                ▼
                                   QN-09 remaining feature parity
                                                │
                                   QN-10 hardening and accessibility
                                                │
                                   QN-11 production integration
                                                │
                                   QN-12 release acceptance
```

Testing is part of every task; QN-10 is an adversarial and cross-cutting pass, not the first time tests are written. QN-06, QN-07, and QN-08 can be worked in parallel only after their shared interfaces are stable and one owner controls integration.

## 3. Task work orders

### QN-00 — Inventory the real product and freeze contracts

**Depends on:** nothing. <br>
**Deliverables:** `evidence/baseline.md`, `evidence/api-contracts.md`, `evidence/auth-parity.md`, `evidence/feature-parity.md`, initial `evidence/STATE.md`.

Read `AGENTS.md`, applicable `web/AGENTS.md`, `web/playwright/AGENTS.md`, current manifests/lockfile, build entries, existing React routes/resources, legacy Angular routes/auth pages, backend auth/CSRF handlers, API documentation, and current CI configuration. Do not assume the React UI is the complete feature inventory.

Record the exact commit, installed major versions, Node/package-manager requirements, build commands, supported host/plugin modes, route prefixes, API methods and schemas, permission fields, repository states, pagination start/continuation semantics, and authentication return paths. Resolve stale guide examples against real source without silently changing existing agent instructions.

Build the full feature-parity table using the template below. Every required family has an owner/task, existing route/API evidence, capability gate, proposed destination, test, and migration status. Mark missing knowledge explicitly. Inspect error payloads and side effects; a GET endpoint is not automatically approved for live preview.

**Pass criteria:** no guessed endpoint is labeled verified; all existing user-facing families and auth flows have entries; source support versus live deployment support is clearly separated; no unrelated backend rewrite is proposed. The task does not require live credentials to inventory source.

### QN-01 — Prove the live-backend preview before depending on it

**Depends on:** QN-00. <br>
**Deliverables:** preview policy, launcher, asset-overlay fixture integration tests, `evidence/live-preview.md`.

Implement the narrow policy and local fixture-origin overlay test first. Verify asset-path/symlink containment, request-method/query restrictions, service-worker and websocket policy, native/preview phase isolation, cookie propagation, and CSRF rotation using the fixture server. Expand the policy only for source-reviewed operations. Keep this harness outside the existing no-intercept Quay E2E tree.

Then run a headed browser with a minimal local static page at the real quay.io preview origin. Read a known public repository and its tags using real browser API requests. With explicit user participation, complete native sign-in and open an authorized private repository. Record only outcome and sanitized contract differences. Do not store browser session state or submit a repository write.

**Commands:** `next:policy`, dedicated overlay fixture tests, `next:preview` with public scope; private/auth checks are explicit manual acceptance.

**Pass criteria:** no local Quay services; real public JSON reaches the UI; a normal account session can be consumed after actual login; blocked operations demonstrably do not reach the fixture backend; no TLS/CORS/browser-security bypass. Public and private/auth outcomes are separate gates. If a provider is inaccessible, document the limitation and retain a blocked auth gate, not a fabricated pass.

### QN-02 — Build the new shell and visual system independently

**Depends on:** QN-00. <br>
**Deliverables:** new webpack entry, strict TypeScript configuration, separate output, asset manifest, RegistryShell, common query/evidence/command components, token layer, deterministic contract server, visual baselines.

Use the existing React/PatternFly-compatible lockfile. Implement the four-category navigation, registry/environment identity, namespace selector, accessible global jump dialog, responsive shell, and light/dark/system theme. Build the workbench and artifact-drawer skeletons to the wireframes, not old route components. Add the new script interface from IMPLEMENTATION.md.

Give fixture mode an unavoidable Demo data indicator. Preserve status messages and unavailable-service/error surfaces. Supply loading, no-results, empty-namespace, denied, unavailable, and partial states. Do not introduce an initial chart/editor/payment dependency.

**Pass criteria:** new build/typecheck pass; existing standalone/plugin build commands remain functional; no Angular/old application shell is bundled into the new entry; representative desktop/mobile/light/dark screenshots exist and are reviewed against the design; bundle baseline is recorded with actual dependency attribution.

### QN-03 — Implement typed transport, identity, and capability boundaries

**Depends on:** QN-01 and QN-02 for final integration; pure transport work may start after QN-00. <br>
**Deliverables:** operation catalog, response parsers, session-generation model, CSRF client, capability adapter, QueryClient lifecycle, permission/state normalization.

Integrate `/config`, `/api/v1/user/`, and `/csrf_token`. Implement bounded JSON parsing, canonical paths, timeouts/cancellation, CSRF single-flight and rotation, typed errors, no mutation retries, and an explicit anonymous state. Query keys and caches must not cross account or target boundaries. Do not persist server data to localStorage.

Implement source-verified direct/external auth operations behind interfaces, but complete provider/account-flow coverage in QN-08. Keep host-token acquisition separate. Implement the preview limitation error separately from backend permission denial. Generalize the launcher-owned read scope sufficiently for the intended workbench without accepting arbitrary frontend URL/host inputs.

**Pass criteria:** identity-switch and late-response tests pass; old data cannot flash after logout; parallel mutations do not trigger duplicate CSRF fetches; cancelled callers do not corrupt other callers' token acquisition; auth/permission/network failures are distinguishable; unknown permissions and states never enable writes.

### QN-04 — Deliver the useful repository workbench

**Depends on:** QN-03. <br>
**Deliverables:** namespace contexts, repository table, recent/starred entry points, verified search, pagination, create-action capability presentation, URL state.

Load only the first relevant page. Preserve opaque cursors and partial coverage. Implement backend stars only using the verified contract; keep recent history session-only. Persist only nonsecret preferences such as density/theme/tool choice. Provide a useful anonymous public entry without sign-in loops.

Implement server search where verified, and label any loaded-page-only filtering honestly. Do not fetch every namespace to make a global dropdown or fake total. Show visibility, repository state, modification time, and meaningful descriptions from real data. Add explicit scope switching for the live runner or a launcher-approved namespace scope so clicking authorized rows is a coherent experience.

**Pass criteria:** actual public and authorized private repositories render in live mode; no fixture data appears there; no startup all-namespace fan-out; repeated cursors terminate with a diagnostic rather than loop; Back/Forward/refresh preserve state; keyboard/mobile interaction works.

### QN-05 — Deliver tag browsing, exact references, and artifact detail

**Depends on:** QN-04. <br>
**Deliverables:** tags-first repository workspace, page/search contract, URL-backed drawer/full-page detail, digest-safe reference builders, platform selection, metadata/labels sections.

Implement tag pagination according to the real backend's page convention and `has_additional`. Keep tag and digest identities separate. Implement index versus child platform selection, sparse-child presentation, optional size semantics, expiration/immutability indicators, and safe description/metadata rendering.

Create Podman/Docker reference builders with validated registry/repository/tag/digest/platform input, safe shell quoting, exact full-digest copying, and clipboard failure handling. Do not auto-select `latest` or claim all digest algorithms supported without validators. Preserve tag movement state and observed digest. Avoid scanning every row on initial render.

**Pass criteria:** the user can find a real tag, inspect an exact manifest/platform, and copy a valid immutable pull command without running Quay locally; drawer state survives refresh/deep-link; copy uses the full digest; SHA-256/SHA-512/unsupported-algorithm and sparse/multi-platform cases have tests. This is the first evaluation milestone, not full parity.

### QN-06 — Add security evidence and optional OCI relationships

**Depends on:** QN-05. <br>
**Deliverables:** scan report normalization/detail, per-platform evidence model, optional artifact/subject/referrer metadata, capability probes, adversarial content fixtures.

Use exact manifest digests for reports. Separate not-requested, pending, unsupported, unavailable, partial, stale/unknown-time, and reported states. Show affected package/version/advisory/fix only when provided. Deduplicate repeated digests and use bounded visible-only polling. Never synthesize repository-wide scan totals from incomplete rows.

Inventory the actual backend's OCI artifact/referrer/signature/SBOM/model-card capabilities. Implement supported views; mark unsupported views clearly. Signature presence is not verification. A trusted verification integration is optional and separately specified; do not invent a trusted result or shell out to arbitrary tooling to create one.

**Pass criteria:** missing/failed/partial evidence never looks clean; a multi-platform report states coverage correctly; unsafe metadata cannot execute or make uncontrolled external requests; unsupported features do not break core browsing; network enrichment stays within budget.

### QN-07 — Implement safe mutations and understandable access

**Depends on:** QN-05 and the QN-03 intent/permission foundation. <br>
**Deliverables:** create/retag/expiration/restore/immutability workflows, repository settings, effective-access views, team/robot/default-permission workflows, scoped mutation tests.

Reproduce existing API semantics, not the old page hierarchy. Recheck capability and permissions before enabling and submitting operations. Separate reversible expiration/removal from permanent deletion. Show exact scope and recoverability; require stronger confirmation for irreversible/bulk/credential actions. Mutations are disabled in the default live preview even when the real account can write.

Handle multi-item results individually: succeeded, failed, not attempted, and uncertain. Do not declare atomicity the backend does not offer. Stop or reconcile after auth/permission failure. Check changed tag-to-digest associations before acting; do not call a non-atomic preflight an atomic protection.

Implement people/teams/robots with direct/inherited grant provenance, effective roles, create/edit/remove, safe secret reveal/regeneration, and defaults according to the inventory. No bulk secret reveal. Restrict destructive testing to real staging or explicitly approved disposable live resources created by the run.

**Pass criteria:** permission-matrix negative tests pass at UI and backend boundaries; repeated clicks do not duplicate operations; uncertain network results are reconciled; partial bulk failures are accurately reported; default preview policy rejects all writes; no production object is mutated without specific authorization.

### QN-08 — Complete authentication parity, not just login appearance

**Depends on:** QN-03; can proceed beside QN-06/QN-07. <br>
**Deliverables:** redesigned login/account flows, complete auth-parity matrix, provider navigation/return handling, fresh-login intents, expiry/logout, host-plugin adapter/tests.

Implement every inventoried auth flow, including feature-gated direct login, configured OAuth/OIDC providers, SSO-only behavior, LDAP-backed login where relevant, account completion, invitations, verification/recovery/reset, CAPTCHA/challenges, external link/unlink, CLI continuation, consent/authorizations, and existing MFA semantics. Do not create new identity storage.

Use a dedicated opt-in auth-evaluation preview profile for the new sign-in form. Permit only audited auth requests and genuine provider navigation; do not implicitly permit repository writes. Test normal and cancelled/expired/invalid-state flows. Preserve the backend's OAuth state/PKCE responsibilities. Test fresh-login cancellation/timeouts and mutation reconciliation without blind replay.

Handle logout as a real remote operation with the inspected all-sessions semantics where that backend implements them, while clearing local state regardless of network outcome and reporting remote failure accurately. Preserve host token refresh behavior using the actual supported OpenShift/console host environment.

**Pass criteria:** every auth-parity row is passed in the environment capable of exercising it, or remains an explicit release blocker; direct login/provider login from the new component is tested, not only native login; no credentials in URLs/storage/logs/traces; no redirect loops; no bypassed MFA/CAPTCHA/provider controls.

### QN-09 — Finish the feature-parity inventory

**Depends on:** relevant QN-06/07/08 interfaces. <br>
**Deliverables:** builds/triggers/logs, mirroring, notifications, audit/activity, quotas/retention, account/application/billing, administrative areas, legacy link compatibility.

Implement remaining families identified in QN-00. Group related tasks into the new navigation rather than copying every old tab. Every feature uses verified contracts and capabilities; missing quay.io support is testable through its real supported deployment environment, not a made-up endpoint.

Retain useful errors, status banners, registry messages, contact/help/security pages, and existing external integration handoffs. Lazy-load billing/payment, logs, heavy editors, and administrative routes. Keep read-only/restricted/superuser behavior distinct.

**Pass criteria:** the parity ledger has no unowned feature; required workflows have end-to-end tests; temporary fallback entries are visible and do not count as complete; all old supported links reach the right new view or a documented, explicit compatibility handler.

### QN-10 — Adversarial security, accessibility, and performance pass

**Depends on:** all implemented feature families. <br>
**Deliverables:** security matrix results, accessibility report, coverage report, browser/theme baselines, measured performance/bundle report, dependency/secret-scan results.

Run the matrix below. Verify the actual production bundle does not include fixture handlers, test tokens, development servers, private samples, duplicate design-system styles, or unnecessary initial libraries. Exercise XSS in every untrusted text surface, unsafe navigation/reference/export cases, identity races, permission revocation, malformed/oversized responses, pagination edge cases, and reauth/network uncertainty.

Audit keyboard focus through menus, dialogs, drawers, pagination, and error states. Add automated accessibility checks plus manual keyboard and screen-reader passes. Test mobile width, 200% zoom, forced colors, dark mode, and reduced motion. Measure controlled performance with production assets; compare live behavior without calling overlay warm-cache results production proof.

**Pass criteria:** no unresolved exploitable critical/high issue in shipped code/dependencies; lower risks explicitly documented and approved; no serious/critical automated accessibility violations on required states; manual acceptance passes; coverage and budgets meet the thresholds below or a reviewed ADR explicitly explains a change.

### QN-11 — Integrate production routing, headers, canary, and rollback

**Depends on:** QN-10; infrastructure work may be prepared earlier. <br>
**Deliverables:** static-asset integration, route/caching/header rules, deployment-controlled canary switch, rollback runbook, standalone/plugin compatibility report.

Serve the new SPA on an opt-in same-origin route with hashed assets. Do not intercept API, distribution, auth, email, or callback routes with a blanket SPA fallback. Test deep links, auth returns, old links, relative asset resolution, CSP, cache headers, no-sniff, and actual cookie behavior through the real reverse proxy. Separate long-lived immutable asset caching from short-lived HTML/config policy.

Integrate checks using the repository's existing GitHub/Tekton/Konflux conventions rather than inventing an unrelated CI system. Respect protected-file authorization. Keep old entry points available through the canary. A rollback changes static-route selection and does not require a database migration or change container pull/push behavior.

**Pass criteria:** deployed black-box tests run without backend mocks; current standalone/plugin builds remain supported; canary can be disabled without data migration; browsers recover cleanly across asset versions; auth/provider/registry endpoints are unchanged; production security headers are tested at the edge.

### QN-12 — Final acceptance and handoff

**Depends on:** all required preceding gates. <br>
**Deliverables:** `evidence/ACCEPTANCE.md`, updated task/feature/auth ledgers, operator/developer instructions, known-limitations list, release recommendation.

Run the full acceptance suite and the five everyday tasks below. Provide exact commands and environment, links to commits, screenshots using synthetic/public data only, measured budgets, test/coverage summaries, and any blocked external integrations. Include a clean-checkout run-through of `next:build:preview` and `next:preview` against a real repository.

**Pass criteria:** the user can evaluate real quay.io data without a local Quay stack; the final design matches the user journeys; all required auth and feature-parity rows are genuinely complete; security/accessibility/deployment gates pass; no claim relies solely on fixture responses. Human approval is required to make the new entry the default product UI. Do not merge or deploy automatically.

## 4. Feature-parity ledger template

Create one row per actual feature/workflow; this list is a minimum inventory, not a substitute for source discovery.

| Family | New destination | Required scope/examples | Primary task |
| --- | --- | --- | --- |
| Repository discovery | Workbench | Public/private, namespaces, search, stars, pagination, shorthand links | QN-04 |
| Repository overview/metadata | Workspace header and detail | Description, visibility, state, status, available usage information | QN-05/07 |
| Tags/images/manifests | Tags and artifact detail | History, digest, multi-arch, sparse children, labels, expiry, immutability, restore/delete | QN-05/07 |
| Security/OCI artifacts | Evidence and Related views | Scan findings, supported artifact relationships, exact evidence semantics | QN-06 |
| Repository access | Access | Direct/inherited grants and effective roles | QN-07 |
| Organizations/teams | Namespace Access/Settings | Membership, invitations, roles, team sync/default grants where supported | QN-07/09 |
| Robots/tokens | Access and account security | Create/reveal/regenerate/revoke, exact scope, secret handling | QN-07/08 |
| Builds/triggers | Automation | Start/cancel/history/logs/configuration/provider handoffs | QN-09 |
| Repository/org mirroring | Automation/namespace settings | Status, scheduling, credentials, constraints, failure recovery | QN-09 |
| Notifications/webhooks | Scoped settings + notifications | Configure/test/delete, visibility, safe payload/error display | QN-09 |
| Usage/audit logs | Activity | Authorized filters, export, timestamps, actors, scope | QN-09 |
| Storage/quotas/retention | Namespace/repository settings | Accurate deduplication semantics, limits, policies, defaults | QN-09 |
| User profile/account | Account | Profile/email/password/preferences/verification and deployment-specific prompts | QN-08/09 |
| Auth and authorization lifecycle | Sign-in/account | All rows in ARCHITECTURE auth contract | QN-08 |
| OAuth applications/consent | Account/namespace application settings | Existing application management, consent, assigned auth, revocation | QN-08/09 |
| Billing/subscription | Lazy account/namespace billing | Existing plans/payment/invoice/account-state behavior where enabled | QN-09 |
| Superuser/read-only administration | Explicit Admin mode | User/org/repo operations, service keys, messages, logs, configuration where exposed | QN-09 |
| Registry communication/help | Shell and linked pages | Messages, maintenance/status, notification access, about/security/help | QN-02/09 |
| Host/plugin deployment | Host adapter | Routing, tokens, permissions, refresh, accessibility, feature scope | QN-08/11 |

Each real ledger row adds source path, exact endpoint contract, backend capability, role, new route, test identifier, status, and fallback/decision. Do not mark a feature unsupported merely because the currently selected quay.io account lacks permission.

## 5. Test strategy and explicit thresholds

### Separate the evidence layers

| Layer | Purpose | Rules |
| --- | --- | --- |
| Pure unit | Parsers, policy, query keys, references, reducers, capability/evidence/auth decisions | Vitest; no UI interaction tests disguised as pure units |
| Preview-policy unit | Exact route/method/query/scope decisions | Runnable Node tests; no network or credentials |
| Contract/browser harness | Failure states, synthetic auth races, design, accessibility, overlay mechanics | Playwright plus deterministic local HTTP server; outside real Quay E2E tree; clearly labeled fixtures |
| Live read contracts | Real response shapes and real browsing against quay.io | Explicit enablement, scoped requests, no mutations/credential artifacts by default |
| Real deployed E2E | User-visible workflows with actual Quay API/auth and production routing | Existing Playwright conventions; API-created scoped resources; no API stubs/database seeding |
| Security/deployment | CSP, authorization, secrets, provider behavior, edge routing | Actual relevant environment; blocked provider tests remain blockers |

Target at least **95% statements, lines, and functions and 90% branches** for new pure business/contract code; at least **95% branches** for auth/evidence/permission/reference logic. Exercise every security-policy decision through positive and negative cases. Exclude only generated/vendor/bootstrap code with an explicit list; do not exclude the difficult logic to meet a number. Coverage does not replace scenario coverage.

For UI behavior, require every feature/auth ledger row and every critical state below to have a passing Playwright test. Add browser-code coverage where feasible to identify untouched route/action paths; report it separately from Vitest coverage. No statement that the entire UI is 95% tested may be inferred from a pure-logic coverage report.

Required browser engines: Chromium, Firefox, and WebKit for deterministic/deployed core journeys, with actual supported Safari/enterprise-provider smoke coverage where possible. Live interactive auth can begin with Chromium; it is not the cross-browser release signoff. Record installed browser versions and OS.

### Critical scenario matrix

| Area | Required cases |
| --- | --- |
| Boot/config | Slow config, invalid config, no anonymous access, backend unavailable, unknown capability, independently failed optional service |
| Identity | Anonymous, direct login, invalid credentials, provider success/cancel/error, expired session, read-only/restricted roles, account switch, permission revocation |
| CSRF/reauth | Missing/invalid/rotated token, parallel acquisition, cancellation, stale token after account switch, fresh-login loop prevention, no duplicate mutation after timeout |
| Data isolation | Late previous-user response, multi-tab logout, private drawer clearing, no private data in persisted state, cache partition across target origins |
| Pagination/search | Empty page, multiple pages, duplicate/repeated cursor, backend page errors, unsupported global sort, search cancellation, filters changed mid-request |
| Artifact identity | Same digest under multiple tags, moved tag, SHA-256/SHA-512/unknown digest, nested repository name, index vs child, missing sparse child |
| Security evidence | No report, pending, unavailable, malformed report, partial platforms, stale/unknown scanner time, real zero reported findings, presence-only signature |
| Mutations | Read/admin/write roles, unknown repo state, read-only/mirror/deleting repository, stale selection, double click, changed tag, partial bulk failure, uncertain timeout result |
| Hostile input | HTML/script/event handlers, javascript/data URLs, SVG, Markdown links/images, CR/LF and shell substitutions, Unicode/control characters, oversized JSON/logs |
| Preview policy | Neighboring namespace/repo, encoded/double-encoded paths, duplicate queries, unapproved GET side effect, all write verbs, unknown files, symlink escape, phase switching |
| Navigation | Deep link, old query/hash link, Back/Forward, reserved backend route, external return URL, responsive drawer close/focus restoration |
| Accessibility | Keyboard-only core journeys, error summary, focus trap/return, screen-reader labels, zoom, forced colors, mobile, reduced motion, contrast |
| Deployment | New/old asset versions, CSP violations, cache policy, logout across entries, plugin tokens, callback preservation, rollback |

### Safe live-test operating rules

Public read tests can be run on demand with no account. Private read tests require an explicitly authorized identity and target. Live mutation tests are a distinct manual/approved pipeline profile with exact disposable scope. No live test should create unsolicited emails, alter billing, regenerate a real robot credential, revoke personal application access, invalidate a user's other sessions, or delete preexisting content as incidental setup/cleanup.

Third-party/provider availability can make tests nondeterministic. Use deterministic fixtures for exhaustive error scenarios and the real provider for integration acceptance. Retries must not hide an auth defect or resubmit an unsafe action. Mark environmental failures explicitly and preserve safe diagnostics.

## 6. Visual and user-acceptance review

Use a stable synthetic registry fixture containing an empty namespace, a normal private repo, a public repo, a mirror, read-only/deleting/unknown states, duplicate tags, multi-platform and sparse indexes, long names, missing metadata, and all evidence states. Capture screenshots at 360, 768, 1280, and 1536 px, with light/dark and representative error/drawer states.

Do not auto-accept screenshot changes after a failure. Review hierarchy, alignment, density, truncation, focus, status semantics, and whether the next action is obvious. Layout must not depend on one short repository name or idealized data.

Final acceptance tasks:

1. Start from a clean checkout and open a public quay.io repository with no Quay stack.
2. Sign in through a supported real flow and browse an authorized private repository without exporting credentials.
3. Find a tag, inspect its exact platform/digest, understand evidence coverage, and copy the correct full immutable command.
4. In an approved test environment, perform a permission change and a reversible tag operation, then inspect accurate state and activity; exercise denial/partial-failure paths.
5. Log out or switch identity, verify private data disappears, follow a legacy deep link, and demonstrate that rollback leaves backend/container operations unchanged.

An implementation that passes unit tests but still requires visiting several old tabs to answer these questions has not met the design brief.

## 7. Final handoff format

The agent's final implementation report must begin with what actually runs, the exact branch/commit, and the simplest preview commands. It must distinguish:

- Implemented and tested against fixtures.
- Verified against real public/private quay.io data.
- Verified against real staging/enterprise/host environments.
- Blocked, unsupported, or still using a temporary fallback.

Then provide the feature/auth matrices, test/coverage/budget results, security findings and resolutions, remaining limitations, and rollback instructions. A green `next:check` is not a replacement for real auth-parity or deployed E2E evidence.

## 8. Bootstrap prompt for the implementation agent

```text
Implement Quay Next in this repository.

Read the repository and applicable directory instructions, then read:
- docs/design/quay-next/README.md
- docs/design/quay-next/ARCHITECTURE.md
- docs/design/quay-next/IMPLEMENTATION.md
- docs/design/quay-next/EXECUTION.md

Create an implementation branch from the plan branch. Execute QN-00 onward,
maintaining docs/design/quay-next/evidence/STATE.md and committing coherent,
tested increments to my fork only. Do not merge the default branch or push upstream.

This is a new repository-first React/PatternFly experience, not a reskin of the old
route hierarchy. Keep existing builds and backend APIs compatible. First deliver
a working, polished real-quay.io repository/tag/detail workflow without a local
Quay stack. Prove the same-origin preview mechanism early; do not substitute fake
API data for live evidence.

Follow the auth-parity and security contracts. Never export cookies, put tokens in
the frontend, disable browser/TLS/CSRF protections, invent unavailable endpoints,
or allow default live repository writes. Human password/SSO/MFA/CAPTCHA/consent
steps are interactive and are not to be bypassed. Destructive testing requires
explicit disposable scope. Do not automatically log out my other Quay sessions.

Implement tests with each task. Keep deterministic contract tests distinct from
real backend E2E. Report passed/failed/not-run/blocked honestly; do not relax gates
to produce a green report. Continue independent work when an external integration
is blocked, but do not call auth or feature parity complete while it is blocked.

At each meaningful milestone give the working commands, commit, test evidence,
and next task. At final handoff provide the completed feature/auth matrices,
measured budgets, safe preview workflow, production integration, and rollback.
Do the implementation rather than writing a replacement plan.
```
