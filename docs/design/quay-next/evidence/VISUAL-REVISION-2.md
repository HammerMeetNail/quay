# Visual revision 2 — implementation evidence

## Preparation checkpoint

Prepared September 23, 2026 against `b1d8ae900ef53825b01393a16078934a66ac5de4`. This record supplements [the historical first slice](IMPLEMENTATION-STARTER.md) and [STATE.md](STATE.md); it does not erase or relabel earlier results.

Source supplied: redesigned shell, workbench, repository preview, responsive records/navigation, meaningful visibility, actual visible-row platform labels with bounded metadata reads, image-size presentation, and tests. Existing client, operations, native login, live allowlist, lockfiles and package manifest are not replaced. Artifact-detail edits are deliberately narrow so clipboard generation guards remain intact.

| Preparation check | Actual result | Limitation |
| --- | --- | --- |
| New pure presentation/queue tests | 20 passed | Compiled in a scratch tree with earlier core support checked against current interfaces; not a full current checkout |
| Source palette contrast tests | 18 passed | Declared color pairs, not browser-computed PF component states |
| Bundle installer tests | 14 passed | Temporary Git fixtures; no remote write |
| TS/JS syntax parsing | 13 files passed | Syntax only; no React/PF type resolution |
| New stylesheet parsing | 160 top-level rules, no top-level errors | No visual/browser conformance claim |
| Current-branch full build, new rendered UI, Playwright, live Quay | Not run during bundle preparation | npm DNS resolution was unavailable; must run during integration |

The generated design PNG is a composition reference. Its sample numbers, logos, `latest` command and safety badges are not implementation data or rendered test evidence. Consult [the updated visual plan](../VISUAL-REVISION-2.md) and [mobile contract](../MOBILE-V2.md).

## Integration result

Integrated September 23, 2026 on `docs/quay-ui-next-2026-09-22` in `HammerMeetNail/quay`. Source commit: `0c7d6caf80556dd640606679024c3e1bba54187b`. The checkout's unrelated `web/pnpm-lock.yaml` edit and both ZIP files were left unstaged and unmodified. The bundle was extracted under `/tmp/quay-next-v2-integration`, outside the checkout. All bundled SHA-256 checks passed. The installer dry run reported 23 destinations and no conflicts; its reviewed apply then completed without resetting or force-overwriting the branch.

The bundle revised the shell, repository workbench and preview, tag records, data presentation, responsive mobile navigation and styles. It preserved the existing read-only transport, genuine Quay sign-in route, allowlist and write blocking, and clipboard generation guards. During integration we corrected one-shot search focus, mobile navigation focus return, and offscreen manifest-observer cancellation. Regression tests now exercise those behaviors and shared digest ownership.

| Command / acceptance check | Result | Environment / notes |
| --- | --- | --- |
| `python3 /tmp/quay-next-v2-integration/quay-next-v2/apply_update.py --repo /Users/dave/git/forks/quay/quay` | Passed | Baseline, branch, fork remote, sources, dirty conflicts and 23 destinations checked; no writes. |
| Same command with `--apply` | Passed | Applied only declared destinations; preserved dirty lockfile and ZIP files. |
| `pnpm install --frozen-lockfile` with local pnpm 11.1.2 | Failed | pnpm reported `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` for overrides. No lockfile rewrite. |
| `npx --yes pnpm@10.28.0 install --frozen-lockfile` | Passed | Detached clean validation checkout under `/tmp/quay-next-v2-validation`; actual locked React/PatternFly dependencies, 1,310 packages; lockfile unchanged. |
| `npx --yes pnpm@10.28.0 run next:check` | Passed | Exact source commit copied to the clean checkout: 280 tests passed, zero failed/skipped/cancelled; Next webpack build completed with asset-size warnings. |
| `pnpm run next:browser:core` | Passed | 13 existing core HTTP/security checks. |
| `npx --yes pnpm@10.28.0 exec playwright test --config playwright.next.config.mjs --project=chromium --project=webkit` | Passed | Exact source commit: 109 passed, one intentional WebKit clipboard-permission skip; includes the tightened V2 observer regression. |
| `npx --yes pnpm@10.28.0 exec playwright test --config playwright.next.config.mjs --project=chromium --project=webkit next-tests/browser/visual-v2.spec.mjs` | Passed | Final 32 V2 tests after independent review tightened the cancellation timing and both-row placeholder assertion. |
| Full three-engine browser attempt | Infrastructure-blocked | Firefox Nightly launched but hung before tests started; Chromium and WebKit results above are independent completed runs. |
| `npx --yes pnpm@10.28.0 run build` and `run build-plugin` | Passed | Existing standalone and plugin entries built in the clean checkout; webpack emitted size warnings. An earlier build in the original checkout failed because its old `node_modules` was incomplete. |
| `npx --yes pnpm@10.28.0 run next:build:preview` | Passed | Preview production bundle built in the clean checkout. |
| `QUAY_NEXT_REPOSITORIES=projectquay/quay npx --yes pnpm@10.28.0 run next:preview` | Passed | Scoped real public quay.io read-only session; details below. |
| Light/dark desktop, tablet, mobile and state screenshots | Passed | 21 actual production-build fixture captures visually reviewed against the approved composition; six widths had no document horizontal overflow. |
| Browser-computed contrast and native zoom review | Partial | Sampled text/control ratios exceeded 4.5:1 in both themes. Native Chrome for Testing at 200% and 400% was visually inspected and restored to 100%; automated root-text scaling at 200% passed at 390 px. This does not replace full text-spacing or screen-reader acceptance. |
| Authorized private sign-in/provider flow and screen reader | Not run | Needs a participant with approved private access and a dedicated assistive-technology session. No cookie export or bypass was used. |

Local logs: `/tmp/quay-next-v2-integration/next-check-commit.log`, `browser-core.log`, `browser-commit-cw.log`, `build-clean.log`, `build-plugin-clean.log`, and `preview-build.log`. Review captures and measurements are under `/tmp/quay-next-v2-integration/screenshots/`; representative files are `light-workbench-1536.png`, `dark-workbench-1536.png`, `light-workbench-390.png`, `light-repository-preview-390.png`, `light-tag-list-390.png`, `light-artifact-inspection-390.png`, and `measurements.json`. These are local review artifacts, not committed test fixtures or private traces.

### Render and data review

The workbench now makes repository identity, description, visibility, loaded-page scope and preview actions readable without fabricated health or security summaries. Public/private status uses text and icon as well as color. At 320, 390 and 768 px, content reflows into records and a single modal navigation control; at 1024, 1440 and 1536 px it retains the desktop workbench. Light/dark workbench, repository preview, tag list and artifact inspection were visually reviewed. Empty, loading, failed and denied states were also captured. All 21 measured captures had `scrollWidth == viewport width`. Sample computed contrast ratios included light secondary text 5.98:1, light repository links 6.65:1, dark secondary text 9.53:1 and dark repository links 9.09:1; these samples are not a full accessibility audit.

The real public preview found 26 repositories in `projectquay`; only approved `projectquay/quay` details were opened. The repository description and tag list came from quay.io. Visible index rows displayed actual advertised platforms such as `linux/amd64`, `linux/arm64` and `linux/ppc64le` through bounded manifest reads; opening a row did not automatically download a scanner report. For tag `3.17-unstable`, the index digest was `sha256:14ca2907c933f4e69c379559f69f969f4b5b86f7ad7b6ef14299cbd43b5f6885`; its selected `linux/amd64` child digest was `sha256:adde5101bbe5a25810d65814b2f5a7f54daa0a55377353c481ebf3bc876b90d9`, with 302.8 MiB compressed size and an immutable pull command for that exact digest. An explicit “Load report for this digest” action returned 1 critical, 39 high and 544 package findings, labeled for the selected digest only. The preview blocked repository writes; no login or private resource was exercised.

Visible index rows share queued/cached manifest metadata; when every row leaves the viewport the request cancels, while an open inspector keeps the shared request alive. The fixture tests assert a single network request and no scanner fan-out. Index size stays qualified rather than misrepresented as a child or aggregate size. Unsupported and still-pending capabilities, including private auth, write actions, complete feature parity, Firefox, screen-reader review and production routing, remain governed by QN-00–QN-12 in [STATE.md](STATE.md). This presentation pass does not complete those gates.
