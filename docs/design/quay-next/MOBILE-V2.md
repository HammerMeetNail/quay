# Quay Next mobile contract — revision 2

Read [VISUAL-REVISION-2.md](VISUAL-REVISION-2.md) and the existing security/auth architecture first. This is an application adaptation, not a separate mobile client, new authentication system, or new backend.

## Layout

At 64 rem and below, remove the desktop sidebar. Use a compact header with menu, Quay identity, theme, and account. The live/demo/read-only identity stays visible on a quiet second line. It may wrap; never clip it into an ambiguous “Live” dot. There is no global search box competing with the page's scoped search.

The menu opens a PatternFly modal titled Registry navigation. It contains the namespace selector, actual working destinations, and session-only recent repositories. Escape/Close returns focus to the menu trigger. Only the visible navigation is mounted: do not keep a hidden desktop navigation and a second set of identical IDs in the modal. On selection, close the menu and navigate; on returning to desktop, close the modal.

At 48 rem and below, replace wide data tables with semantic lists of records, each with meaningful labels. Do not turn a table into a pile of unlabelled cells or rely on horizontal document scrolling.

```text
┌─────────────────────────────────────┐
│ ☰  QUAY                Theme  Me   │
│ Live quay.io · writes blocked       │
├─────────────────────────────────────┤
│ projectquay                         │
│ Repositories                        │
│ [Find a repository…              ]  │
│ [Registry order                 ▾] │
│ [All 25] [Public 17] [Private 8]     │
│ Loaded page only                    │
│                                     │
│ □ quay    ◉ Public                  │
│   Upstream release for Project Quay.│
│   Updated 2 hours ago          [→]  │
│ ─────────────────────────────────── │
│ □ mirror  ▣ Private · Mirror        │
│   Mirrored base images.             │
│   Updated yesterday            [→]  │
│                                     │
│ 25 shown · 25 loaded                │
│ [Previous]                   [Next] │
└─────────────────────────────────────┘
```

The wireframe uses synthetic counts and abstract icons; implement PatternFly icons and real response values. Public/private differ by glyph and words as well as color. Descriptions wrap; no hover-only information. The arrow is a labeled Preview repository action, distinct from the repository link that goes directly to tags.

## Inspection

A selected repository or artifact becomes the main content when the usable workspace cannot support the desktop split. It is not a modal with an invisible backdrop and not a narrow right drawer offscreen. Keep a visible Back to repositories/Back to tags control above the details. Route/URL state, filters, page/cursor, scroll position and the correct focus target survive the round trip.

```text
[Back to tags]
Artifact details: v2.8.1
projectquay/quay
sha256:<complete value wraps>

Pull target
[Index · automatic selection      ▾]
Container tool
[Podman                           ▾]

podman pull quay.io/projectquay/quay@
sha256:<complete value wraps>
[Copy immutable pull command]

Platforms
linux/amd64              Available
linux/arm64/v8           Unavailable

Security evidence
Select an available platform to inspect its report.

Metadata and raw manifest ▸
```

Do not replace the immutable command with a shorter mutable `:latest` reference. The command is selectable text if clipboard permission fails; the failure remains visible. A missing sparse child is not presented as successfully pullable. Changing target must clear stale copy status using the landed generation-ownership guard.

## Data presentation

For tags, show identity first, actual platform names next, then labeled size/evidence and update time. Visible index rows hydrate automatically within the shared four-request budget; scroll-ahead is bounded and shared digests are deduplicated. There is no extra click just to see common platform names. Render `linux/amd64` and `linux/arm64/v8`, not vendor logos. A long platform collection wraps or uses a labeled expand control accessible to touch and keyboard. Index download size says Per platform; selected child size says Compressed layers.

Avoid nested scroll areas. Raw JSON/log viewers may have their own clearly labeled keyboard-operable region because the content is genuinely two-dimensional; toolbars, records, descriptions, and full identity remain in the document flow. No fixed bottom CTA overlaps browser controls, selected text, or errors.

## Targets, focus, and validation

Touch-oriented controls have at least 44 CSS px-equivalent target floors, with space between unrelated actions. Keep form text at 1 rem so system scaling is respected. Do not shrink root font size, disable pinch zoom, or fix row heights to an idealized one-line fixture.

Test 320×800 and 390×844 small-phone cases; 768 and 1024 tablet layouts; portrait/landscape; 200% text size; real browser 200%/400% zoom; text-spacing overrides; dark/light/forced colors; reduced motion; keyboard and screen reader. A CSS text-size test is not a substitute for genuine browser zoom. Interactions must remain correct if a menu closes, a detail is switched, or a viewport crosses the split threshold during loading.

The added browser suite exercises record reflow, one navigation copy, modal focus return, page inspection/back behavior, and captures real fixture screenshots. Manual checks and rendered theme/contrast reviews remain required; no unrendered design receives a visual pass.
