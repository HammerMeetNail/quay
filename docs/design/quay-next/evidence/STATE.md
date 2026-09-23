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
