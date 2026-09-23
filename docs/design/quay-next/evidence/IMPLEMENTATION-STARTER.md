# Quay Next implementation evidence — first read-only slice

Integrated September 23, 2026 on `docs/quay-ui-next-2026-09-22`. The branch started at design baseline `2b2ff21f65ca8a0876b8de48f96e994e7fccada5`; no newer remote commits were present. Push destination was verified as `HammerMeetNail/quay`.

## Implemented scope

The separate React/TypeScript/PatternFly entry under `web/src/next` supports namespace repository browsing, response-page filtering, server exact-tag search, tag pagination, inline desktop and full-page mobile artifact inspection, full digest and immutable pull commands, per-platform manifest and metadata inspection, and explicit digest-scoped security reports. Browser history, collection focus, and stale clipboard feedback are covered. The UI uses the existing design's restrained workbench layout.

The synthetic HTTP fixture and the isolated live quay.io launcher are read-only. The live launcher permits repository detail only for the exact configured repository and blocks repository writes. It uses the genuine Quay/provider authentication flow; private authenticated access was not exercised. This is a first read-only slice, **not** feature or authentication parity, production integration, or an approved release.

## Integration and deterministic checks

Commands below ran from the checkout, or from `web` where prefixed with `cd web &&`. `pnpm` for passing checks was pnpm 10.34.5, selected through its installed binary on `PATH`; this matches the repository's CI toolchain. The preexisting global pnpm 11.1.2 rejected the existing lockfile/override mismatch and then attempted a non-interactive module purge. `web/package.json` and `web/pnpm-lock.yaml` were aligned on the already-declared `node-forge` 1.4.0 override, after which the frozen install passed.

| Command | Outcome |
| --- | --- |
| `python3 /tmp/quay-next-bundle-20260923/quay-next-implementation/apply_bundle.py --repo /Users/dave/git/forks/quay/quay` | Passed dry run; 34 planned changes, no conflicts. |
| `python3 /tmp/quay-next-bundle-20260923/quay-next-implementation/apply_bundle.py --repo /Users/dave/git/forks/quay/quay --apply` | Passed; additive installation. |
| `python3 /tmp/quay-next-bundle-20260923/quay-next-implementation/test_apply_bundle.py -q` | Passed, 10 tests. |
| `cd web && pnpm install --frozen-lockfile` | Passed with pnpm 10.34.5 after lockfile alignment. The initial pnpm 11.1.2 attempt failed as described above. |
| `cd web && pnpm run next:check` | Passed: strict typecheck, syntax check, 240 core/unit/fixture/policy tests, and webpack build. Two size warnings: 797 KiB PatternFly CSS asset and 1.2 MiB entrypoint. |
| `cd web && pnpm exec playwright install chromium firefox webkit` | Passed; browser binaries installed. |
| `cd web && pnpm run next:browser:core` | Passed, 13 real-browser HTTP checks. |
| `cd web && pnpm run next:browser --project=chromium --project=webkit` | Passed, 77 tests, one intentionally skipped WebKit clipboard integration test, zero failures. Includes mobile widths, long identifiers, dark theme, focus/history, pagination, stale clipboard callbacks, copy failure, and read-only behavior. |
| `cd web && pnpm run next:browser` | Infrastructure-blocked in Firefox. The bundled Firefox fails a standalone headless and headed launch with `sandbox_extension_issue_file_to_process ... Operation not permitted`, graphics errors, and a 15-second launch timeout. Chromium and WebKit results are above; no browser protections were disabled. |
| `cd web && pnpm run build` | Passed with two existing asset/entrypoint size warnings. |
| `cd web && pnpm run build-plugin` | Passed with plugin-manifest no-extensions and asset size warnings. |
| `cd web && pnpm run next:build:preview` | Passed with the same two Next asset/entrypoint size warnings. |
| `cd web && ./node_modules/.bin/eslint src/next --ext .ts,.tsx` | Passed. |

Rendered Playwright fixture pages were inspected at 1440px desktop and 360px mobile in light and dark themes. The desktop table and complementary inspector, narrow full-page detail, visible mobile navigation, full digest/command wrapping, and lack of horizontal overflow matched the curated design's first-slice intent. Automated browser checks additionally covered 320–1536px layouts and focus/history transitions. Screen-reader and measured performance acceptance remain open.

## Read-only live quay.io verification

These exact commands ran from `web`:

```bash
pnpm run next:build:preview
QUAY_NEXT_REPOSITORIES=projectquay/quay pnpm run next:preview
```

The isolated launcher displayed `Live quay.io, repository writes blocked` and limited detail to `projectquay/quay`. In its browser, the real `projectquay` namespace returned 26 repositories. The `quay` detail returned tag pages, including `3.12.22` with OCI index digest `sha256:bcd57ff6d57e19af71bdb07d8ceadb7b3399ca2d4572e0ee00251ef332556f73`. Selecting `linux/amd64` showed child digest `sha256:3c1427712e0129030ecc6ec0f26176aac7e7c26654eba1f51de18b12836bd3f5`, its 558.0 MiB compressed layers, the full immutable Podman command, labels and raw manifest. Copy returned the live UI's success message. Explicitly loading the selected child digest's security report returned a digest-scoped finding summary and paginated package findings. No live write or sign-in was performed; the launcher exited with `quit`, leaving other Quay sessions alone.

## Remaining gaps and constraints

- Firefox rendered-browser checks remain infrastructure-blocked on this macOS host. Re-run them on a working browser host before claiming full cross-browser acceptance.
- The preview was verified only for public, unauthenticated reads. Genuine provider sign-in, private access, session changes, and authentication parity remain unverified.
- The launcher uses an exact repository allowlist and blocks write methods/routes. Its native browser forwarding does not inspect redirect destinations itself; the client rejects API redirects. Review redirect handling again before any broader repository scope or deployment.
- The first slice does not implement repository writes, teams/robots, administration, billing, build/mirror workflows, production host/plugin integration, rollback, or full accessibility/performance acceptance. Continue the QN-00–QN-12 parity ledger without marking those capabilities complete.
