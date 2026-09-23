# Quay Next task state

Updated September 23, 2026 for the first read-only slice on `docs/quay-ui-next-2026-09-22`. Implementation commit: `5874f61948fc65d174bfdc7ffece632ee54a546c`. Exact commands and outcomes are in [IMPLEMENTATION-STARTER.md](IMPLEMENTATION-STARTER.md). These task states apply the existing [execution plan](../EXECUTION.md); they do not waive its pass criteria.

| Task | State | Commit | Tests/evidence | Remaining gate |
| --- | --- | --- | --- | --- |
| QN-00 inventory and contracts | In progress | `5874f6194` | Public repository, tag, manifest, and report contracts used by the slice | Complete source-backed feature/auth parity, route/API, capability, and role inventories and their evidence files. |
| QN-01 live preview | In progress | `5874f6194` | Exact repository allowlist, write-blocking fixture tests, public quay.io namespace/repository/tag/artifact/report reads | Human-participated genuine sign-in and authorized private read; complete preview policy/security acceptance. |
| QN-02 shell and visual system | In progress | `5874f6194` | Separate build, responsive light/dark shell, rendered desktop/mobile review; existing standalone/plugin builds pass | Complete navigation/global jump, token/contrast and accessibility evidence, measured bundle baseline and all required visual states. |
| QN-03 transport and identity | In progress | `5874f6194` | Typed read transport, validation, session-generation and cancellation tests | Full CSRF/mutation, capability and host identity contracts; private multi-account and provider behavior. |
| QN-04 repository workbench | In progress | `5874f6194` | Public namespace listing, scoped response-page filter, bounded cursor/history behavior, live `projectquay/quay` selection | Full inventory-backed search, recent/starred, private repositories, and role/capability states. |
| QN-05 tags and artifact detail | In progress | `5874f6194` | Real tag pages, exact digest and platform inspection, immutable copy; Chromium/WebKit history, focus and clipboard tests | All specified algorithm, sparse/multi-platform, deep-link and private acceptance cases. |
| QN-06 security and OCI evidence | In progress | `5874f6194` | Explicit live digest-scoped report and paginated findings; no index-wide verdict inferred | Full report-state/coverage model and OCI relationships/capability inventory. |
| QN-07 safe mutations and access | Not run | — | Default live preview blocks repository writes | Implement and test authorized writes, permissions, teams, robots and reconciliation in approved scope. |
| QN-08 authentication parity | Not run | — | Native sign-in path exists in launcher; no sign-in exercised | Complete auth inventory and redesigned flows, provider/host tests, and private acceptance. |
| QN-09 remaining feature parity | Not run | — | — | Implement and test inventoried builds, mirrors, activity, quotas, billing and administration. |
| QN-10 security, accessibility, performance | In progress | `5874f6194` | Unit/fixture/policy checks and Chromium/WebKit rendered tests pass; Firefox is infrastructure-blocked | Full adversarial, screen-reader, zoom/contrast, Firefox and measured performance/security acceptance. |
| QN-11 production integration | Not run | — | Separate Next build does not break existing standalone/plugin builds | Production routing, host/plugin integration, headers, deployment and rollback tests. |
| QN-12 release acceptance | Not run | — | First-slice evidence and gaps recorded | Complete every required feature/auth matrix and acceptance gate before a release claim. |

Next work follows the existing dependency graph: finish QN-00 inventories and missing contract evidence, then close QN-01 private/auth acceptance with human participation while completing the independently testable QN-02–QN-06 gates. Keep Firefox as an infrastructure blocker until it runs on a working browser host. Do not interpret the public read-only preview as authorization for live writes.

## Presentation revision 2 — integration checkpoint

The approved composition is now specified in [VISUAL-REVISION-2.md](../VISUAL-REVISION-2.md) and [MOBILE-V2.md](../MOBILE-V2.md). The code delta was prepared against `b1d8ae900ef53825b01393a16078934a66ac5de4`; it builds on, rather than replaces, the first read-only slice above.

| Work | Integration state | Evidence boundary |
| --- | --- | --- |
| V2-01 baseline-aware bundle | Integrated in `0c7d6caf8` | SHA-256 verified; installer dry run and apply passed without touching the dirty lockfile or ZIPs. |
| V2-02/V2-03 shell, workbench, repository preview | Implemented and rendered in `0c7d6caf8` | Actual locked-dependency build, light/dark desktop/mobile captures and scoped public preview reviewed. |
| V2-04 platform/size/visibility presentation | Public read behavior validated in `0c7d6caf8` | Bounded visible-row metadata, request cancellation/deduplication, digest-specific size and explicit reports tested; native login unchanged. |
| V2-05 mobile/browser acceptance | Chromium/WebKit passed; Firefox infrastructure-blocked | 109 full browser tests passed with one intentional WebKit permission skip; 32 V2 tests passed after final observer-assertion fix. Screen-reader/private acceptance remains. |
| V2-06 final evidence | Recorded | Exact new commands, render measurements, live public data, limitations and local artifact paths are in [VISUAL-REVISION-2.md](VISUAL-REVISION-2.md). |

The QN task history above remains in progress. QN-07–QN-12 are not completed by this presentation revision. The existing dirty lockfile and ZIP remain outside the presentation delta.

## Rendered-reference alignment

After the owner compared the running UI with the planning image, `abb272c49830241ef5b60d2b31f649f7c533eee8` aligned the first desktop viewport around a compact repository list, right overview and task footer. The demo overview is passive; the live overview requires an explicit allowlisted selection. Exact geometry, light/dark and mobile captures, locked-dependency tests, and the public read-only launch are recorded in [VISUAL-ALIGNMENT.md](VISUAL-ALIGNMENT.md). This is a presentation correction within QN-02–QN-05; it does not close the outstanding QN gates above.
