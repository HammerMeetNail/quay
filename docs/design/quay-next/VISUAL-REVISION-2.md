# Quay Next — visual revision 2: a calm repository workbench

**Prepared:** September 23, 2026.

**Integration baseline:** `b1d8ae900ef53825b01393a16078934a66ac5de4` on `HammerMeetNail/quay:docs/quay-ui-next-2026-09-22`.

**Design input:** the most recently approved dark desktop mockup in the design discussion. The image is a composition reference, not an API contract.

**Delivery:** a presentation update to the existing read-only implementation, plus mobile behavior and acceptance tests. Not a completed Quay replacement.

## 1. Preserve what already landed

The first implementation is `5874f61948fc65d174bfdc7ffece632ee54a546c`. The `b1d8ae900` documentation checkpoint correctly records public Quay reads and earlier Chromium/WebKit rendering, while leaving private/authentication, writes, full parity, accessibility/performance, Firefox, and production gates open. Do not revert these records to “no implementation exists.” Do not treat their earlier rendered results as evidence for this new presentation either.

Preserve the existing session/client/runtime/operation contracts; the live allowlist and launcher; cursor ancestry, Back/Forward behavior and direct-link focus recovery; clipboard-generation ownership; tag/digest validation; no blind mutation retries; explicit scan requests; and the existing tests. The bundle deliberately does not replace the lockfile, package manifest, launcher, HTTP client, or domain parser. Two browser-test selectors are updated to reflect changed copy; their assertions remain.

The existing uncommitted lockfile edit and ZIP reported by the owner are out of scope. Never run a blanket checkout/reset, overwrite them, or stage them as incidental cleanup.

## 2. Product decision: take the mockup's hierarchy, not its invented metrics

The new silhouette has a narrow persistent sidebar on desktop, a compact masthead, a single primary list surface, and a contextual repository/artifact inspector. It deliberately does not copy the promotional strip at the bottom of the mockup. Work pages are for work, not feature advertising.

A repository is a collection of artifacts. A single image size, platform, signature, or “Healthy” verdict cannot characterize that entire collection without a precisely defined artifact and report. The generated image blurred these levels. The implementation corrects that rather than turning decorative numbers into false product promises.

| Mockup element | Implementation decision |
| --- | --- |
| Public/private pills in a separate column | Globe + Public, lock + Private next to the repository name. Different glyphs, text, and restrained colors; never color alone. |
| Repeated NORMAL state column | Remove the column. Only meaningful exceptions appear beside the entity; unknown states remain visible. |
| Description as a wide independent column | Put a readable description under identity. Convert basic Markdown link syntax to plain text; never render raw HTML. Full description is in the repository preview. |
| Stars / popularity totals | No invented aggregate. Show the actual account's `is_starred` marker when present; expose a page-scoped Starred filter only when the response supplies the field. No star mutation in read-only preview. |
| Repository-wide platform and image-size columns | Move these to tags/artifacts, where the values have an exact identity. Repository preview links to those tags. |
| “Multi” or platform brand icons | Display actual OCI labels such as `linux/amd64` and `linux/arm64/v8`. An Apple logo is not an architecture label. |
| Repository health card | Remove it. Reports remain tied to the selected digest/platform; missing or partial evidence does not become green. |
| Large default `:latest` pull command | Remove it. The command appears after artifact selection, with the exact immutable digest and selected target. |
| Storage total and progress bar | Defer until an authorized quota/storage contract provides the measurement. Do not add image sizes to estimate registry usage. |
| Global package/digest/repository search | Do not advertise unsupported search. Keep a scoped repository filter and existing exact-tag lookup; global search remains a separate verified capability task. |
| Many administrative links | Feature-gated destinations when implemented, not a wall of dead buttons. Existing parity tasks are still required. |

The missing product quality was not more widgets. It was a clear separation between **the collection I am browsing**, **the exact artifact I intend to use**, and **the evidence about that artifact**.

## 3. Desktop layout

### 3.1 Shell

Use the existing Quay branding treatment, not the generated image's invented logo or avatar. Retain React and PatternFly 6. The header includes registry identity/read-only status, a compact Find repository action, theme control, help, and the authenticated account or Sign in. No huge authentication instruction banner appears over the settled page. Sign-in/help opens a real PatternFly modal on demand.

The sidebar holds namespace, working navigation, and up to six recently visited repositories. Recent history is memory-only and belongs to the mounted session; it must not persist private paths to localStorage. The only persistent preference added/retained here is the existing nonsecret theme key. Namespace scope is explicit and never broadens the launcher's approved repositories.

Use the existing guarded native login phase. This revision does not convert a help modal into a new credential form or claim auth parity. Keep the persistent live/demo label so synthetic and production data cannot be mistaken for one another.

### 3.2 Repository workbench

```text
QUAY NEXT     Live quay.io · repository writes blocked          Find  Theme  Account

Namespace        Repositories
projectquay      Find an image. Choose a tag. Copy its exact reference.

Repositories     [Find a repository…                  ] [Registry order ▾]
                 [All 25] [Public 17] [Private 8]        Loaded page only
Recent
projectquay/quay  Repository                                     Updated       Preview
                 □ quay  ◉ Public                               2 hours ago      →
                   Upstream release for Project Quay.
                 □ mirror  ▣ Private  Mirror                     Yesterday        →
                   Mirrored base images.

                 25 shown · 25 loaded                           Previous  Next
```

All names/counts in this wireframe are illustrative. In code, counts come only from the loaded response; they are not namespace totals. The search filters name, namespace, and description locally. Sorting is explicitly “this page.” Empty results, missing data, transport failure, and denied preview scope remain different states.

The repository name is a real link to tags, not a generic clickable row. A separate labeled preview action opens the repository inspector. This keeps the fast developer path to tags and adds exploration without forcing everybody through an overview page.

An out-of-preview repository remains visible with a compact explanation and a help action, but is not fetched. Preserve its actual description instead of replacing every description with a paragraph of launcher instructions. One shared scope note explains the limitation.

### 3.3 Repository preview

At the existing 72 rem usable-workspace threshold, the preview is a PatternFly inline Drawer with a complementary landmark. Below that threshold it is a main detail page with Back to repositories. The table remains usable in inline mode. No scrim or focus trap is added.

The preview loads exactly the selected repository details and its first tag page. It shows identity, visibility, repository state, access, complete description, a clear Browse tags & artifacts link, and up to five actual entries from the returned tag page. It calls those entries “Tags,” not “Latest releases,” because ordering and release status are not inferred. It makes no scanner requests and selects no default tag.

The selection lives in `?preview=namespace/repository`. First intentional selection pushes history; switching selected repositories replaces that detail entry. Closing restores the originating trigger when available. A directly opened link clears its own parameter rather than navigating to an unrelated prior website. Filtering/pagination changes clear inspection and preserve cursor ancestry.

## 4. Tags, platforms, image sizes, and artifact inspection

Keep tags as the default operational repository view. Identity is tag plus abbreviated digest with a real link to complete detail. The full value is always available and copyable in artifact inspection; display abbreviation never becomes an API identifier.

### Actual platforms, without one extra click per row

The existing tag response does not provide architecture names in this adapter. Resolve **visible index rows automatically**, with a short 160-pixel scroll-ahead margin. Users see actual names without opening each artifact or pressing a separate page action. Resolve only the current page's valid index digests, deduplicate shared digests in the existing Query cache, and limit the enrichment queue to four concurrent requests. Do not recursively fetch all tag pages, all child content, all namespaces, or scan reports. The workbench itself performs no manifest enrichment.

After hydration, show genuine `linux/amd64` and `linux/arm64...` labels first when present, followed by an operable “+n more platforms” disclosure for long collections. Preserve canonical labels, variants, and non-Linux platforms. For ordinary manifests whose architecture is not supplied by this contract, say “Platform not reported”; do not infer one from the browser's CPU or use an OS vendor logo.

This is a deliberate, bounded cost/UX tradeoff: at most 25 unique index reads as the user scrolls the current 25-tag page, concurrency four, usually fewer through digest deduplication. These reads are non-critical progressive enrichment: table identity and actions render first. This explicitly refines the earlier ban on row-level reads, without permitting unbounded prefetch or scan fan-out. Off-screen rows do not start new requests until they approach view; turning an observer inactive need not abort an already shared request used by another visible row or inspector. Navigation and identity cancellation use the existing client/query lifecycle. Abort queued work before it begins; a rejected task must release its slot. Without IntersectionObserver, expose a manual per-cell fallback rather than eagerly sweeping the page. Failed metadata has a visible retry; it is not represented as an empty platform set.

### Image size

Use a strong numeric value, a quieter unit, and the label **Compressed layers**. Avoid an arbitrary size progress bar, traffic-light threshold, or repository-wide “421 MB” that lacks an exact artifact. An index displays **Per platform**, not a sum of architecture download sizes. Child size becomes meaningful only after that child is selected and fetched. Zero supplied bytes are different from missing bytes.

In inline inspection, prioritize identity, platform, and evidence in the narrowed table; update time and size are available in the inspector. On a full-width table those additional columns remain visible. On a phone they become labeled metadata within the record.

### Evidence and copy

Retain the current `ArtifactDetails` data path and clipboard race fix. This update changes its presentation and size component, not its authorization or selection rules. Signatures are presence-only unless verified by a trusted mechanism. No index-wide safety verdict is inferred. Copy remains digest-pinned; unavailable sparse children and invalid targets cannot be copied as valid pull commands.

If a tag visible on the current page moves while an older digest remains selected, explicitly warn that the tag's target changed and retain the URL's exact digest. Do not silently switch the user's deployment reference.

## 5. Visual system

A small application-scoped semantic palette supplies the approved navy/charcoal character in dark mode and an equally deliberate light mode. Existing PF components inherit selected semantic token overrides from `.qn-app` and `.qn-modal`; feature code contains no palette literals. No second component library, remote font, icon collection, animation package, or generated CSS-selector patch is introduced.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f5f7fb` | `#0b131e` |
| Work surface | `#ffffff` | `#101c29` |
| Raised field/header | `#edf2f8` | `#172737` |
| Inspected/selected background | `#e7f1ff` | `#172f49` |
| Primary text | `#172b40` | `#edf3fa` |
| Secondary text | `#4c6175` | `#aabbd0` |
| Interactive text/action | `#075caf` | `#81c2ff` |
| Public marker | `#126a59` | `#6cd5b1` |
| Private marker | `#805400` | `#efc471` |

Visibility colors are non-severity categories, not evidence of image safety. The glyph and label preserve meaning in monochrome/forced colors. A normal state is quiet; a read-only/mirror/deleting or unknown state remains explicit. No colored pill is required for every value.

The masthead is approximately four rem; desktop sidebar thirteen rem. Main gutters are 1.5 rem, smaller on narrow screens. Work surfaces use restrained rounding and separators. Forms and disclosures retain PatternFly semantics. Table text is readable, not tiny; technical identity wraps where necessary. Real content may increase row height.

Automated palette tests cover text/action/visibility/favorite/error pairs on each intended surface and primary-action/control contrast. This is useful evidence, but not proof of actual PF-composed contrast, target geometry, or accessibility conformance. Inspect computed styles and actual screenshots after integration.

## 6. Mobile is a separate composition, not a shrunken desktop

See [MOBILE-V2.md](MOBILE-V2.md) for the viewport/interaction contract. The code removes the desktop sidebar below 64 rem and offers a real navigation modal. Below 48 rem, tables become labeled records. Only one interactive navigation/detail copy is mounted. Platform labels wrap, copy commands wrap completely, and inspector content becomes a main page. No persistent bottom marketing strip or copy bar hides content or focus.

## 7. Implementation sequence and acceptance

Do not restart QN-00–QN-12. Execute these bounded presentation tasks inside the current plan:

| Step | Files/behavior | Gate |
| --- | --- | --- |
| V2-01 integrate safely | Apply the baseline-aware bundle; preserve local lockfile/ZIP, existing client/launcher and historical evidence | Dry-run has no conflicts; diff only approved paths |
| V2-02 render shell/workbench | `App.tsx`, `Workbench.tsx`, shared presentation components/CSS | One main search; no permanent login banner; full descriptions on demand; real visibility/favorites; scoped counts/sort |
| V2-03 repository preview | `RepositoryPreview.tsx`, workspace-width hook | Inline complementary versus main-page behavior; bounded two-operation fetch; focus/history tests |
| V2-04 tag information | `RepositoryView.tsx`, metadata hook/queue, data components; narrow artifact-size patch | Actual OCI labels without an extra click; visible-row scheduling; deduplicated requests; size/evidence identity preserved |
| V2-05 mobile/a11y | Responsive records/nav/detail + existing browser suite and `visual-v2.spec.mjs` | 320/390/768/1024/1440/1536 px, keyboard, contrast, real zoom, text spacing, clipboard, reduced motion |
| V2-06 evidence and handoff | Add new results to v2 evidence, annotate STATE without deleting prior checks | Full app/build/test commands reported honestly; public/private/auth results separated; no full-parity claim |

Run the existing `next:check`, `next:browser:core`, `next:browser`, `build`, and `build-plugin`. New `next-tests/unit/*` and browser specs are discovered by the existing runners; no package or lockfile rewrite is necessary. Capture light/dark desktop and mobile screenshots from the actual production-built React/PF app, not from a separate HTML illustration. Review those before declaring the visual direction implemented. New screenshot attachments are review material, not automatic approval.

Then run the existing explicit read-only live preview against an approved public repository. Private sign-in and provider tests remain human-participated gates. A presentation-only update does not authorize production writes, token changes, session export, or security bypasses.

## 8. Deliberate omissions, not forgotten customer jobs

Full repository creation/deletion, tag mutation/retention, teams/robots/permissions, automation/builds/mirroring, quotas/billing, audit/activity, global search, credential management, and redesigned complete auth are still in QN-07–QN-12. Their navigation appears when real working capability/permission paths are implemented. Do not put misleading “coming soon” business metrics into the main task surface to imply parity.

Future growth should keep the same hierarchy: global/namespace context, repository task, exact artifact. A feature earns default-screen space by helping the current user decide or act—not merely because a backend field exists.

## 9. Sources and evidence boundaries

Baseline files were inspected at the pinned commit through GitHub, including `App.tsx`, `Workbench.tsx`, `RepositoryView.tsx`, `ArtifactDetails.tsx`, `domain.ts`, `operations.ts`, `Primitives.tsx`, the existing browser suite, and README/EXECUTION/STATE/MASTER. Source-derived facts are not a new live deployment observation.

Official integration references: [PatternFly Drawer](https://www.patternfly.org/components/drawer/), [PatternFly Modal](https://www.patternfly.org/components/modal/), and [PatternFly semantic tokens](https://www.patternfly.org/tokens/all-patternfly-tokens/). Test component props against the actual installed lockfile, not an assumed newest version. No implementation-time skill installation is required; this revision retains the curated earlier skill synthesis and the owner's approved composition.
