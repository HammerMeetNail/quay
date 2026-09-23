# Quay Next — first implementation slice

This branch contains **application code**, not only a design specification. It adds an independent React / PatternFly 6 entry and leaves the existing Angular, React, plugin, and backend entries unchanged.

**Status: read-only prototype awaiting full workspace and live-backend validation.** Do not deploy it as the default Quay UI. The full auth/feature-parity plan remains in `docs/design/quay-next/`.

## Start locally

Use Node **22.16 or later** and the repository's existing pnpm setup:

```sh
cd web
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
node next.mjs dev
```

Open `http://127.0.0.1:9001/__quay_next_preview__/`. The banner says **Demo data · not quay.io**. The local Node fixture server requires no Quay, database, Redis, or scanner. It returns synthetic Quay-shaped responses over HTTP; it is not a replacement backend. Builds are production-style static bundles, not HMR. Restart `dev` after edits.

The fixture namespace is `demo`. Try `payments` for multi-platform inspection, `worker` for escaped hostile-looking text, `empty` for an empty repository, and `unavailable` for HTTP failure states.

## Run against real quay.io

```sh
# Exact repository allowlist, not a token or password.
QUAY_NEXT_REPOSITORIES=projectquay/quay,projectquay/clair node next.mjs preview

# For private repositories, use an account authorized to access those exact repos.
QUAY_NEXT_REPOSITORIES=my_namespace/my_repository node next.mjs preview --login
```

The headed Playwright browser loads local assets under the genuine quay.io origin. Reviewed API reads continue to the actual backend. The only upstream host is `https://quay.io`; no local TLS certificate, browser-security flag, cookie export, or token injection is used.

Enter `login` in the terminal to open normal Quay sign-in, including whichever identity-provider/challenge flow the live site exposes. Enter your credentials in that browser, not the terminal or chat. Complete the flow and press Enter in the terminal to return to the preview. The redesigned app reads the resulting session. **This does not yet implement or verify a redesigned sign-in UI.**

The preview's read policy permits only `/config`, session identity, scoped repository batches, the exact approved repository details, active-tag pages, manifests, labels, and scan reports. Other repositories in a batch are displayed as outside preview scope. To open them, add their exact names to `QUAY_NEXT_REPOSITORIES` and restart. Nested repository names are supported by validation/path builders.

Repository writes, token/credential-management APIs, unreviewed GET handlers, websockets, service workers, and external navigation are blocked **while the local preview is active**. The native phase is the real Quay site with its normal permissions; it is not a read-only copy of the site. The launcher closes preview pages before enabling native navigation and closes native pages before resuming local assets.

Use `reload` after rebuilding assets. Use `quit` to close the isolated browser context. This is not a remote logout or token revocation, and it deliberately does not call Quay signout (which may invalidate other sessions). The launcher never exports `storageState`, HAR, traces, or cookies. Local code still executes with the account's session authority: inspect the source and use a least-privilege test account.

## Implemented

- Separate React / PatternFly entry, namespace-scoped repository workbench, light/dark/system theme, and explicit fixture/live identity.
- Bounded repository batches with 25-row presentation and honest loaded-batch filtering.
- Backend exact-tag search, one-based active-tag pagination, immutable digest paths, and responsive table/record views.
- Non-modal desktop inspector and narrow full-detail presentation; URL-backed digest and platform target; full-value copy commands; sparse-child availability.
- On-demand scan reports and labels; explicit missing/unsupported/failed/queued evidence; no startup scan fan-out; plain-text metadata.
- Same-origin read-only client with size limits, cancellation, timeout, identity-generation rejection, and no retries or credential persistence.
- Exact live-read request policy, manifest-only static serving, bounded assets, loopback fixture-server Host/Origin checks, and restrictive document headers.
- Unit/HTTP tests, a real-browser overlay harness, and nine authored Playwright UI contract tests.

## Validation commands

```sh
node next.mjs test       # no npm dependencies needed; native Node TS stripping
node next.mjs typecheck  # requires installed workspace dependencies
node next.mjs build     # runs full typecheck before webpack
node next.mjs harness   # actual route installer against local HTTP in Chromium
node next.mjs browser   # build + nine fixture-backed UI tests, not Quay E2E
node next.mjs check     # unit/HTTP tests + full typecheck + build
```

The fixture/overlay tests deliberately live outside `web/playwright/e2e/`, whose real-backend/no-intercept rules remain unchanged. None of these commands runs destructive live tests.

### Results while authoring, September 23, 2026

| Check | Result |
| --- | --- |
| Native Node unit and local HTTP suite | **157 passed, 0 failed** |
| Strict TypeScript 5.8.3 check of `model.ts` and `client.ts` with ES2022/DOM libs | **Passed** |
| TS/TSX syntax transpilation of nine application source files | **0 syntax diagnostics**; not dependency-aware compilation |
| `node next.mjs build` | **Blocked:** workspace dependencies absent; package-network access unavailable |
| Browser overlay harness | **Infrastructure-blocked:** 2 navigation attempts fail with `ERR_BLOCKED_BY_ADMINISTRATOR` before the tested interaction |
| Nine React/PatternFly UI tests | **Not run:** no complete dependency install/build |
| Public/private quay.io browsing and native login through this code | **Not run** |
| Original frontend/plugin builds; production CSP/headers; auth/feature parity; accessibility and performance budgets | **Not run / incomplete** |

Do not reinterpret syntax transpilation as a successful React/PatternFly build, fixture data as live Quay verification, or a green unit suite as production security approval. No coverage percentage is claimed.

## Deliberately not implemented yet

There are no repository mutations, new credential forms, account creation/recovery UI, new provider callback handling, CSRF mutation client, application consent management, access/teams/robots administration, builds/mirrors UI, quotas/billing/admin UI, host/plugin integration, migration/rollback wiring, or complete accessibility/cross-browser signoff. Native login preserves use of the current site but is not proof of auth parity for the replacement.

Follow the refined design and task graph. Next, install the existing lockfile in an authorized development environment, run typecheck/build and the browser harness, correct any integration defects, and verify a public repository. Only then perform an explicitly authorized private-session evaluation. See `docs/design/quay-next/evidence/STATE.md` for the remaining gates.
