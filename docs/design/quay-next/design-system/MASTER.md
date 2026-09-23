# Quay Next design system: quiet precision

**Revision:** UX refinement 1, 2026-09-22. **Status:** implementation contract, not a rendered or validated application.

This is the global visual and interaction contract. Read it once when starting a UI task, then read only the relevant file in `pages/`. Page rules may specialize presentation, but cannot weaken authentication, authorization, evidence accuracy, privacy, accessibility, or the live-preview restrictions in [ARCHITECTURE.md](../ARCHITECTURE.md).

This refinement applies the master-and-page-override workflow and relevant web guidance from `nextlevelbuilder/ui-ux-pro-max-skill`, pinned at `dcc40ff5133ef78276117db0cc34e7b83cc8aeba`. The chosen direction is our adaptation of its Minimalism & Swiss Style family, not an automatically generated recommendation. See [review, sources, and task amendments](../UX-REFINEMENT.md).

**Latest presentation authority:** [Visual revision 2](../VISUAL-REVISION-2.md) and [mobile revision 2](../MOBILE-V2.md) refine this master after the owner reviewed the rendered first slice and approved a new composition. Follow their scoped palette, repository preview, identity-embedded visibility, bounded visible-row platform hydration, and responsive navigation rules for this update. Historical page examples are retained for context; no visual override can weaken security, auth parity, identity isolation, or the live-read allowlist.

## 1. Decisions an implementing agent must not reinvent

Build a precise tool for finding, inspecting, and using artifacts. Use **React, PatternFly 6, and the existing compatible dependency graph**. All primary controls, forms, menus, tables, drawers, and dialogs use PatternFly components. Semantic HTML remains appropriate for headings, landmarks, text, and layout wrappers. Do not introduce a second component library.

The visual emphasis is: **artifact identity first, evidence second, administration on demand**. There are three visual planes: quiet application navigation, the primary work surface, and a contextual inspector. Do not wrap every region in another card. The work surface is a table or list, not a collection of metric tiles.

Use neutral PatternFly surfaces, a restrained brand/action accent, high-contrast text, and thin separators. Color is reserved for interaction or genuine status. No glass surfaces, neon terminal aesthetic, decorative gradients, giant headings, animated backgrounds, or ornamental status charts. Dark mode is a complete theme, not the only way to make the UI look technical.

Qualitative design intent, not measured scores or generator output: **low visual variance, minimal motion, high useful information density**. Density is obtained by removing redundant containers and controls, not by shrinking essential text or pointer targets.

## 2. Layout and type contract

Metrics are expressed in `rem` for implementation; CSS pixel equivalents below assume the browser's default 16 px root size. Use verified PatternFly semantic tokens and component variables where they provide the intended role. Quay-specific geometry belongs in named application tokens, never scattered magic numbers. Do not change the root font size to make the layout fit.

| Role | Target |
| --- | --- |
| Desktop masthead | Minimum 3.5 rem; may grow for wrapping, zoom, or a mandatory notice |
| Expanded primary navigation | 13 rem; four task categories, not a second organization tree |
| Content gutter | 1.5 rem desktop; 1 rem narrow layouts |
| Page title | 1.5 rem / 2 rem, weight 600; one semantic h1 per page |
| Section heading | 1.125 rem / 1.5 rem, weight 600 |
| Body and form input | 1 rem / 1.5 rem |
| Desktop table text | 0.875 rem / 1.25 rem; increase in touch-friendly presentation |
| Secondary metadata | At least 0.8125 rem / 1.125 rem; readable contrast, not faint gray |
| Prose measure | Approximately 65 characters; tables may use the available width |
| Spacing scale | 0.25, 0.5, 0.75, 1, 1.5, 2 rem |
| Comfortable row | Minimum 3 rem; height grows for real content |
| Compact row | Minimum 2.5 rem, fine-pointer use only; no fixed-height clipping |
| Touch-friendly row | Minimum 3.5 rem; essential controls at least 2.75 by 2.75 rem |
| Icon action, fine pointer | At least 2 by 2 rem; glyph stays appropriately small |
| Inspector | Target 24 rem beside at least 46 rem of useful primary content and a 1 rem gap |

Use the font families already supplied by the installed PatternFly release. Technical identifiers use its supported monospace stack. Do not import Google Fonts, another icon font, or remote assets merely because the skill's examples suggest them. Use only `@patternfly/react-icons` for interface icons. Keep official brand assets unchanged.

Numeric columns use tabular numerals and consistent alignment. Human names and prose wrap naturally. Repository paths, digests, and URLs use shrinkable grid/flex children and `overflow-wrap: anywhere`; do not apply `word-break: break-all` to prose. Abbreviated digests are presentation only. An explicit full-value and copy path must work with keyboard and touch; a `title` attribute alone is insufficient.

Do not set a global 1200 px maximum width on the application table just because a style template uses that value. Constrain prose and forms, not the workbench.

## 3. Theme and state semantics

PatternFly semantic tokens are the color source of truth. Quay aliases describe purpose, not hue. Examples: canvas, work-surface, text-primary, text-secondary, divider, interactive, inspected-row, evidence-warning. Bind aliases to the installed PF6 semantic token for that role and verify computed styles in both themes. Use documented component variables for local adjustments. No global overrides of generated `.pf-*` structure and no direct palette tokens in feature code.

Maintain an implementation token map with: application role, PF token/variable, computed light value, computed dark value, contrast pair, and test. This is generated from the actual installed CSS, not guessed from an online palette. Preserve forced-colors behavior; focus and selection must remain recognizable without background colors.

| Meaning | Presentation |
| --- | --- |
| Navigation/current context | Quiet background treatment plus a structural indicator and accessible current state |
| Artifact under inspection | Selected-row treatment independent of bulk-selection checkboxes |
| Primary action | At most one visually dominant action in the active task region; no requirement to invent one |
| Critical/high findings | Severity text and appropriate icon/token; not a generic green/red health score |
| No reported findings | Plain factual text; not a certification of safety |
| Unsupported/not requested | Neutral explanation; not success, disabled gray, or a numeric zero |
| Expired session | Authentication message and relevant next action; not a scanner or registry outage |
| Read-only live preview | Persistent environment identity; distinct from the account's actual backend role |
| Destructive action | Explicit language and scope; never the default emphasized list action |

Normal text must reach 4.5:1 contrast; large text and required non-text controls follow their applicable 3:1 criteria. Verify actual foreground/background/state combinations rather than inferring conformance from token names. WCAG 2.2 AA web target size is 24 by 24 CSS pixels or a valid exception; Quay's control targets deliberately exceed that floor. Native 44 pt / 48 dp measurements are not interchangeable with web CSS pixels.

## 4. Navigation without repeated furniture

The global shell contains registry identity, namespace scope, a compact jump action, notifications when permitted, and account controls. The workbench contains the actual repository search field. Do not render two equally prominent search inputs on the same screen. The global command palette is an optional shortcut, not an arbitrary command executor or the only way to navigate.

Primary navigation remains Repositories, Activity, Access, Settings. Clearly label the selected namespace for the latter three. Repository daily-work views are **Tags & artifacts, Activity, Automation**. Expose repository Access and Settings through a labeled **Manage repository** menu and the role/access affordance where permitted. Existing `view=access` and `view=settings` routes remain valid; this is a presentation change, not a backend change or removal of features.

Do not show empty navigation slots for disabled features. Explain permission or deployment restrictions at the relevant task boundary. Avoid ambiguous icon-only menus whose scope could mean registry, namespace, repository, or artifact.

## 5. Inspector and focus model

Use PatternFly's **inline Drawer** for desktop primary-detail inspection, with a named complementary landmark. It is non-modal: no scrim, no focus trap, no `aria-modal`, and no `role=dialog`. The table remains operable. True confirmations and the command palette use an actual modal dialog with appropriate focus containment.

Use inline inspection only when the workspace's usable width is at least 72 rem. This is the content width after navigation and gutters, not the entire browser viewport. Below that budget, show the same artifact content as the main full-page detail presentation with **Back to tags**. Do not squeeze two unusable panes onto a tablet. Do not maintain two hidden copies of sensitive detail content or focusable controls.

On intentional inspection, focus the inspector heading with `tabIndex=-1`. Background polling must never steal focus. Closing restores the original trigger if it still exists, otherwise a stable table heading or toolbar control. Narrow-page Back restores search, loaded page, and scroll position. At a breakpoint change, retain selection and focus on an equivalent control or the detail heading; do not lose the selected artifact.

The first inspection pushes a history entry. Switching inspected rows may replace that inspection entry. Closing uses recorded same-application history provenance; a directly opened deep link removes its detail parameters with `replace` instead of blindly navigating to an external previous site. The full-page artifact route remains available for opening in another tab.

Only one overlay owns focus at a time. Escape dismisses the topmost dismissible overlay first, not every open region. Escape closes the non-modal inspector only when focus is within it and no child interaction has already consumed the event; never globally steal Escape from a form or menu.

## 6. Information and interaction economy

Every control must answer an observable user need and have a real data source. Avoid page-wide filter controls for platform or scan state when the backend cannot search the full collection by that field. A deliberate local filter must say **Filter this page** and retain its honest scope. Never fetch all manifests merely to make a visually attractive filter work.

State changes are immediate in application logic. Motion is optional presentation. Use no entrance choreography for table rows and no GSAP dependency. Suggested application motion budgets are 100 ms for small feedback, 160 ms for opening and 120 ms for closing an inspector; prefer existing PF component behavior where appropriate. Reduced-motion mode removes nonessential transitions. Rapid interactions cancel previous transitions safely; correctness never waits for `animationend`.

Reserve space for loading content. Use static skeletons rather than perpetual shimmer by default. Do not add a minimum artificial delay to make a loader noticeable. On updates, keep valid existing data visible, identify its updating/stale state, and prevent mutations against a mismatched selection. Announce meaningful results once in a contextual status region, not every cell in a polling table.

Successful copying may give a short polite status. Errors, uncertain mutation outcomes, required decisions, and actionable warnings persist until resolved or deliberately dismissed. Do not copy a generic 3–5 second toast timeout onto all messages.

## 7. Responsive resilience

A narrow page preserves entity identity, evidence state, and the primary action. Move secondary fields into a meaningful detail region rather than hiding essential facts. Label each mobile record's fields; preserve table semantics for actual tables. Rich raw-manifest/log viewers may use a clearly labeled, keyboard-operable internal scroll region, but the application page must not scroll sideways.

Test widths 320, 360, 768, 1024, 1280, 1440, and 1536 CSS pixels. Also test real browser 200% and 400% zoom, text-spacing overrides, a 200% text-size scenario, keyboard-only use, forced colors, and reduced motion. A 320 px viewport screenshot is useful but is not proof that real 400% browser zoom works. WCAG's two-dimensional-content exceptions do not excuse clipped toolbars, controls, or individual text cells.

Only one sticky chrome row should occupy a narrow screen; turn off unnecessary sticky regions in short landscape viewports. Reserve space for necessary fixed content and keep focused controls visible. No nested dashboard scroll containers merely to mimic a desktop design tool.

## 8. Retrieval and delivery gates

- [Workbench](pages/workbench.md): repository discovery, scope, search, and list hierarchy.
- [Repository and artifact](pages/repository.md): tags, inspector, exact references, evidence, and responsive behavior.
- [Access and authentication](pages/access-and-auth.md): administrative forms, credentials, and auth presentation.

The [UX review](../UX-REFINEMENT.md) amends QN-02, QN-04, QN-05, QN-08, and QN-10 and supplies the pre-delivery checks. Existing architectural, security, auth-parity, API, and deployment gates still apply. The old examples' modal artifact assertion, hover-only digest disclosure, 36 px compact target, and generic platform/scan toolbar controls are superseded by this design contract.
