# Live preview first-open correction

Integrated September 23, 2026 on `HammerMeetNail/quay:docs/quay-ui-next-2026-09-22`. Source commit: `ee93eb68260e7ec6682bc23205c5d6e75d96716a`. This follows the [rendered-alignment record](VISUAL-ALIGNMENT.md); it does not replace earlier test or public-data evidence.

The owner reported that Chrome launched against real quay.io without a visible repository overview. Two conditions caused this: the launcher used Chromium's default headed window size, which could fall below the desktop overview breakpoint, and the initial live workbench deliberately showed only a selection placeholder. The launcher now opens a 1536 × 960 native window and remains responsive to user resizing. On the initial desktop page, the workbench displays the first exact repository supplied in `QUAY_NEXT_REPOSITORIES` when its namespace matches the current scope. This selection changes no URL, history entry or focus. It can display an approved repository absent from the current list page. A narrow window remains list-first.

The initial overview performs only that allowlisted repository detail read and its first tag-page read. It does not broaden the launcher allowlist or automatically request a manifest, scanner report, write operation, or other repository detail. Existing native sign-in and session behavior remain intact. An independent security review found no actionable issue in this scoped change.

| Check | Outcome | Notes |
| --- | --- | --- |
| `npx --yes pnpm@10.28.0 run next:check` | Passed | Clean validation checkout with actual frozen dependencies: 280 tests passed, zero failures/skips/cancellations; Next build completed with existing asset-size warnings. |
| `QUAY_NEXT_PORT=4319 npx --yes pnpm@10.28.0 exec playwright test --config playwright.next.alignment.config.mjs --project=chromium --project=webkit next-tests/browser/visual-v2.spec.mjs --grep 'live first approved overview remains list-first'` | Passed | Four narrow/different-namespace cases after fixing an incorrect test expectation: an out-of-scope repository renders as text, not a link. |
| Same Playwright command without `--grep` and spec path | Passed | Full rendered suite: 121 passed, one intentional WebKit clipboard-permission skip, zero failures. Live cases verify only the first exact approved repository's detail and first tag GETs, no URL/focus/history mutation, a repository beyond the first list page, and narrow-window suppression. |
| `QUAY_NEXT_REPOSITORIES=projectquay/quay npx --yes pnpm@10.28.0 run next:preview` | Passed | Real headed quay.io session opened at `?namespace=projectquay` with a visible `quay` overview. The overview showed Public visibility, Read access, the real description, and first-page tags including `3.17-unstable`. The namespace returned 26 repositories; the other 25 were outside approved detail scope. The session exited normally with `quit`. No login, private read or write was exercised. |

The first focused Chromium/WebKit run had 42 passes and two test failures because it expected `payments` to be a link when the test's allowlist placed it outside scope. The assertion was corrected to check visible repository text; the four affected cases and the complete suite then passed. This was a test expectation error, not a live authorization bypass.

The user's unrelated `web/pnpm-lock.yaml` edit and ZIPs remained unstaged and unchanged. Firefox, private sign-in/provider acceptance and full screen-reader review remain open as recorded in [STATE.md](STATE.md).
