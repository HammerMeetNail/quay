# Implementation state — September 23, 2026

Base: plan commit `2b2ff21f65ca8a0876b8de48f96e994e7fccada5`.
Implementation branch: `feat/quay-next-readonly-2026-09-23`.

## Current delivery

An independent, read-only React/PatternFly prototype plus strict domain contracts, same-origin read transport, exact live-read policy, safe static-asset overlay launcher, synthetic local HTTP server, and automated tests. No existing production entry or backend file is changed. The skill-refined design remains the target.

`web/NEXT.md` is the executable handoff. Commands use `node next.mjs ...` rather than modifying the existing workspace manifest/lockfile in this first increment. No dependencies, external skills, or protected agent/CI files are added. Node 22.16+ is needed for the native TypeScript test runner.

## Evidence

- `cd web && node next.mjs test`: 157 tests passed, zero failed. Covers domain validation, evidence states, exact references, request cancellation/identity races, policy negatives, asset containment, and real local HTTP fixture behavior.
- TypeScript 5.8.3 `tsc --noEmit --strict --target ES2022 --module ESNext --lib ES2022,DOM src/next/model.ts src/next/client.ts`: passed using the available TypeScript compiler.
- `transpileModule` syntax pass over all nine `.ts`/`.tsx` application files: zero diagnostics. This is not a full dependency-aware compilation.
- `node next.mjs build`: exited nonzero because workspace dependencies were unavailable. Outbound package access was unavailable. No successful full build is claimed.
- `node next.mjs harness` using the available Playwright driver and system Chromium: two tests were infrastructure-blocked at navigation by `net::ERR_BLOCKED_BY_ADMINISTRATOR`. No policy bypass was attempted. Initial teardown waiting was fixed to close fixture connections on failure; the functional browser assertions still could not run.
- `node next.mjs browser`: not run. Nine authored UI tests require a complete build.
- Real quay.io requests through the new browser harness, private repositories, login/SSO/MFA, production headers, original builds, accessibility/performance measurements and coverage percentages: not run.

The initial unit run exposed an invalid Host-header test assumption: Fetch rewrote the supplied Host header. The test now uses raw local HTTP for that case; it still asserts a 403 and passes. No security assertion was weakened.

## Task gates

| Task | State | Remaining work |
| --- | --- | --- |
| QN-00 | Partial | Baseline contracts checked for this slice; complete legacy/API/auth/feature inventory still needed |
| QN-01 | Partial / blocked | Policy and HTTP tests pass; actual browser overlay and live auth must be verified in an authorized environment |
| QN-02 | Partial / blocked | New shell/build entry written; full dependency-aware build, screenshots, visual review pending |
| QN-03 | Partial | Read-only transport/identity boundaries; full CSRF mutation and host-auth adapters pending |
| QN-04 | Implemented, UI unverified | Scoped batches/search/25-row list; stars/recents and complete workbench parity pending |
| QN-05 | Implemented, UI unverified | Tags/detail/target/copy; browser focus/history/zoom verification pending |
| QN-06 | Partial | On-demand scan and metadata; aggregate platform coverage and other OCI relationships pending |
| QN-07 | Not started | Mutations and access management |
| QN-08 | Not started for replacement UI | Native login handoff exists; redesigned auth and complete parity not implemented |
| QN-09 | Not started | Remaining feature families |
| QN-10 | Partial | Pure security tests only; rendered accessibility, browser security, and budgets pending |
| QN-11 | Not started | Production routing/canary/plugin/rollback |
| QN-12 | Not complete | No release approval or default-UI replacement |

## Next unblocked work

Run the documented build/typecheck/browser commands with the fork's frozen dependency graph. Resolve integration findings before extending scope. Verify anonymous live browsing first. Human sign-in and approved private repository selection remain interactive. Default preview writes must stay blocked. Do not label this prototype production-ready or auth-parity-complete.
