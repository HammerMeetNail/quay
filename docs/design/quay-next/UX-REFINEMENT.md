# UX refinement review and implementation amendments

**Date:** 2026-09-22. **Plan before this refinement:** `512acb9b417984f91020b4b80549a579e0a43fd2`. **Skill reviewed:** `nextlevelbuilder/ui-ux-pro-max-skill` at `dcc40ff5133ef78276117db0cc34e7b83cc8aeba`.

## 1. What was used

Reviewed the skill definition, its web-oriented quick-reference rules, the scope warning in its native/mobile professional-rules reference, and the Minimalism & Swiss Style entry in its style catalog. Used those sources to refine Quay's existing design rather than treating the skill as permission to replace PatternFly or add a different stack.

The skill's important contribution here is a durable master design system, small page-specific contracts, explicit interaction/text-resilience rules, and a review-before-delivery loop. Its recommendations are design inputs, not proof that a UI is accessible, secure, fast, or suitable for Quay.

**No skill installation or CLI design-system generation was performed.** Direct source inspection was available; programmatic retrieval into the runtime was not. No generated ranking, palette match, or search-engine output is claimed. The chosen visual direction is a manual synthesis of the inspected guidance. No external skill code, package, dependency, hook, or agent instruction file was added to the Quay fork.

## 2. Accepted, adapted, and rejected guidance

| Skill input | Decision for Quay | Reason |
| --- | --- | --- |
| Master plus page overrides | Adopt in `docs/design/quay-next/design-system/` | Stable decisions with a small per-task context; no root-level skill installation required |
| Minimalism & Swiss Style | Adapt to a dense registry work surface | Strong alignment/type hierarchy, quiet surfaces, and useful data; not a spacious marketing page |
| Semantic design tokens | Use PatternFly's actual semantic tokens | Preserve theming and component compatibility rather than copying hex palettes |
| Font/icon suggestions | Keep the installed PatternFly font stack and icons | No Google Fonts, Lucide/Heroicons, or a second visual system |
| Touch and accessibility rules | Apply web CSS-pixel requirements and larger product targets | Native pt/dp rules and a generic 44-pixel claim are not interchangeable with WCAG web criteria |
| Progressive disclosure | Remove nested inspector tabs; reveal secondary sections on demand | Reduces simultaneous navigation choices without deleting capabilities |
| Compact text and label resilience | Make full identifiers, wrapping chips, and touch/keyboard disclosure explicit | Truncation plus a hover tooltip is insufficient for registry identifiers |
| Motion guidance | Small interruptible PF/CSS transitions; immediate semantic state changes | No GSAP, row entrance choreography, minimum artificial loader time, or animation-end correctness |
| Virtualize long lists | Keep the existing bounded 25-row page; profile before virtualizing | A blanket 50-item rule is not sufficient reason to add complexity or break table semantics |
| Brief toast durations | Apply only to nonessential acknowledgements | Errors, uncertain writes, and required decisions cannot disappear on an arbitrary timer |
| Dashboard and landing-page presets | Reject decorative metrics, hero sections, giant CTAs, and fixed marketing widths | Quay's default task is finding and using an artifact, not conversion or an executive dashboard |
| Screenshot review | Adopt with semantic, network, accessibility, and performance assertions | A screenshot cannot prove auth compatibility, safe writes, focus behavior, or API correctness |

The skill's `pro-rules.md` explicitly scopes itself to native/mobile interfaces. Web decisions above rely primarily on the quick reference and the relevant PatternFly/W3C sources, not indiscriminate application of that native checklist.

## 3. Concrete changes to the earlier plan

The first plan established the right repository-first architecture but left too much presentation freedom. This refinement makes the following changes normative:

1. **One work surface and one prominent search field.** Compact global Jump is secondary; the scoped list search is primary. Remove duplicate search furniture and do not fill the top of the page with metric cards.
2. **A smaller daily-work navigation.** Tags & artifacts, Activity, Automation stay visible. Repository Access and Settings move to a labeled Manage repository control while preserving direct routes and permissions.
3. **The command moves beside the selected artifact.** Do not allocate a large command box before selection or imply a default `latest` image.
4. **Non-modal desktop inspection.** Use an inline PatternFly Drawer/complementary region. With less than 72 rem usable content width, render the detail as a page. Do not incorrectly call the desktop inspector a modal dialog.
5. **Fewer simultaneous choices.** The inspector presents identity, target, command, platforms, and evidence before disclosing metadata/related/history sections. It does not recreate another four-tab application.
6. **Explicit row and target budgets.** Comfortable/compact/touch-friendly presentation grows for real text. Compact rows move from the earlier approximate 36 px to a 40 px minimum; touch controls keep a 44 CSS px floor.
7. **Honest filters and counts.** Platform or security filtering is not portrayed as globally complete unless an actual backend contract supports it. A local filter labels its page/loaded scope and never causes an unbounded enrichment sweep.
8. **Real full-value access.** Complete digests and commands wrap and can be copied. Truncated technical identifiers no longer rely solely on `title` hover behavior.
9. **Stronger responsive and interruption checks.** Add 320 px reflow, real 400% zoom, text-spacing tests, coarse-pointer targets, interrupted transitions, and breakpoint/focus continuity.

These decisions supersede conflicting presentation examples in the original README and IMPLEMENTATION.md, including the artifact `role=dialog` test assertion. They do not supersede backend security, auth parity, capability detection, state isolation, live-preview write restrictions, or deployment tests.

## 4. Amendments to the existing agent task graph

There is still one implementation sequence, QN-00 through QN-12. Do not create a parallel redesign project or re-plan the backend.

| Task | Additional work and pass criteria |
| --- | --- |
| QN-02 | Read MASTER plus the relevant page. Build a synthetic visual specimen covering long text, states, focus, density, and both themes before expanding the full application. Record actual PF token mappings. No external font/icon/animation dependency. |
| QN-04 | Apply the workbench hierarchy; verify one prominent scoped search, explicit local-filter scope, and no scanner requests for repository-list decoration. |
| QN-05 | Implement the non-modal/page inspector presentation, URL/history provenance, focus restoration, exact command placement, and full identifier display. Replace the old modal-inspector E2E assertion. |
| QN-07 | Apply grant-source clarity, scoped change review, discoverable disabled-action explanations, persistent uncertain outcomes, and safe secret display. |
| QN-08 | Apply the focused auth form, password-manager/paste compatibility, linked error summaries, and correct step-up modal behavior. Do not alter the required auth-flow matrix. |
| QN-10 | Add the checks below. Review screenshots without automatically accepting differences. Record layout, semantics, and network behavior separately. |
| QN-12 | Report which visual targets were actually rendered and reviewed, separately from pure helper tests and live backend evidence. |

**Context rule for agents:** read README and architecture/implementation constraints, then MASTER and one relevant page file. Read this review's task amendments and tests when implementing that task. Do not repeatedly load every page contract into the context. Do not regenerate or overwrite this curated design with a future skill output without reconciling changes explicitly.

## 5. Additional pre-delivery checks

These are proposed product/UI tests, not tests already run during this documentation refinement.

| Gate | Required evidence |
| --- | --- |
| Hierarchy | Settled 1440×900 workbench fixture exposes at least eight readable rows without cutting text; search/list dominate, not decorative panels |
| Inspector semantics | Named complementary region and usable table in inline mode; main detail heading with Back to tags in page mode; no invisible duplicate interactive detail |
| Focus/history | Intentional inspect/close, direct deep link, browser Back, row removed by filter, breakpoint transition, and child-menu Escape preserve correct focus and scope |
| Text | Long nested paths, complete SHA-256/SHA-512 values, long platform/status labels, pseudolocalized text, wrapping filter collections, and text-spacing overrides remain operable |
| Targets | Product controls meet the 32 px fine-pointer or 44 px touch target floor and do not overlap; user text sizing does not shrink target floors |
| Contrast | Actual rendered normal text, status, icons, boundaries, and focus states are measured in both themes and forced colors |
| Motion | Reduced motion and rapid inspect/switch/close do not leave stale content, wrong digest, invisible focused controls, or interaction blocked by animation |
| Copy | Clipboard contains the full selected immutable reference; failure presents a selectable fallback and persistent error; no ellipsis or secret appears in the copied command |
| Information scope | Page-only filtering cannot be confused with backend-global search; missing evidence is not zero or success; no hidden scanner request fan-out |
| Auth/forms | Password managers/paste, labels, inline errors, error-summary links, cancelled step-up, and expired sessions retain the intended semantics |
| Reflow | 320 px viewport plus real 200%/400% zoom and a text-scaling case; document has no horizontal overflow except a consciously isolated two-dimensional content region |

The wireframes are not visual signoff. Require actual PatternFly-rendered screenshots and a keyboard/screen-reader pass before declaring the design implemented. Automated accessibility scans do not replace those checks.

### Replacement browser assertions

Illustrative code for a deterministic browser/contract suite; use the existing real-backend E2E rules when moving the same behavior into release tests. The fixture repository, imports, selectors, and application route setup must be supplied by the implementing task.

```ts
// Wide workspace: inspector is a complementary region, not a modal dialog.
await page.setViewportSize({width: 1536, height: 960});
await page.getByRole('link', {name: 'v2.8.1', exact: true}).click();
const inspector = page.getByRole('complementary', {name: /artifact details/i});
await expect(inspector).toBeVisible();
await expect(page.getByRole('dialog', {name: /artifact details/i})).toHaveCount(0);
await expect(page.getByRole('table', {name: 'Tags and artifacts'})).toBeVisible();
await expect(inspector.getByTestId('artifact-full-digest')).toHaveText(knownDigest);

// Narrow presentation keeps the same identity; it does not leave two mounted copies.
await page.setViewportSize({width: 360, height: 800});
await expect(page.getByRole('main').getByRole('heading', {name: /artifact details/i})).toBeVisible();
await expect(page.getByTestId('artifact-full-digest')).toHaveCount(1);
await expect(page.getByTestId('artifact-full-digest')).toHaveText(knownDigest);
expect(await page.evaluate(() =>
  document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
)).toBe(true);
```

These assertions alone do not prove focus management or clipboard correctness. Add real keyboard traversal/return checks, clipboard verification, intermediate-width cases, and the remaining gates above. A test should not force `role=dialog` onto a component simply to preserve an old assertion.

## 6. Executed pure presentation-policy seed

The helper below was executed locally with Node **v22.16.0** and **22 tests passed, 0 failed**. This verifies only deterministic layout/density decisions and input rejection, not CSS, rendering, focus, PatternFly compatibility, accessibility conformance, authentication, or quay.io behavior.

The workspace width is measured after navigation/gutters. Use a workspace `ResizeObserver`/equivalent and the actual root font size; the width of the browser window alone is not the available pane width. Minimum CSS-pixel target/row floors prevent a smaller user-selected root font from shrinking controls below the product target. Larger text increases them. These are minimums, never fixed heights.

```js
// presentation.mjs — pure design-policy seed
export function resolvePresentation(input) {
  const {usableInlinePx, rootFontPx, hasArtifact, forceFullPage,
    coarsePointer, preferredDensity} = input;
  if (!Number.isFinite(usableInlinePx) || usableInlinePx < 0 ||
      !Number.isFinite(rootFontPx) || rootFontPx <= 0) {
    throw new TypeError('Expected valid measured workspace and root-font sizes');
  }
  if ([hasArtifact, forceFullPage, coarsePointer].some(value => typeof value !== 'boolean') ||
      !['comfortable', 'compact'].includes(preferredDensity)) {
    throw new TypeError('Expected explicit presentation preferences');
  }
  const detail = !hasArtifact ? 'none'
    : forceFullPage || usableInlinePx / rootFontPx < 72 ? 'page' : 'inline';
  const density = coarsePointer ? 'comfortable' : preferredDensity;
  const minRowRem = coarsePointer ? 3.5 : density === 'compact' ? 2.5 : 3;
  const minTargetRem = coarsePointer ? 2.75 : 2;
  return {
    detail,
    density,
    minRowRem,
    minTargetRem,
    minRowPx: Math.max(minRowRem * rootFontPx, coarsePointer ? 56 : density === 'compact' ? 40 : 48),
    minTargetPx: Math.max(minTargetRem * rootFontPx, coarsePointer ? 44 : 32),
  };
}
```

```js
// presentation.test.mjs — run: node --test presentation.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolvePresentation} from './presentation.mjs';
const base = {usableInlinePx: 1280, rootFontPx: 16, hasArtifact: true,
  forceFullPage: false, coarsePointer: false, preferredDensity: 'comfortable'};
const cases = [
  ['small root font preserves touch target floor', {rootFontPx: 12, coarsePointer: true}, {minTargetPx: 44, minRowPx: 56}],
  ['small root font preserves fine pointer target floor', {rootFontPx: 12, preferredDensity: 'compact'}, {minTargetPx: 32, minRowPx: 40}],
  ['no artifact on narrow screen', {usableInlinePx: 320, hasArtifact: false}, {detail: 'none'}],
  ['below content width threshold', {usableInlinePx: 1151}, {detail: 'page'}],
  ['exactly at content width threshold', {usableInlinePx: 1152}, {detail: 'inline'}],
  ['above content width threshold', {usableInlinePx: 1400}, {detail: 'inline'}],
  ['explicit full page wins on desktop', {forceFullPage: true}, {detail: 'page'}],
  ['touch overrides compact preference', {coarsePointer: true, preferredDensity: 'compact'}, {density: 'comfortable', minRowRem: 3.5, minTargetRem: 2.75}],
  ['fine pointer compact', {preferredDensity: 'compact'}, {density: 'compact', minRowRem: 2.5, minTargetRem: 2}],
  ['fine pointer comfortable', {}, {density: 'comfortable', minRowRem: 3, minTargetRem: 2}],
  ['larger text requires more content room', {usableInlinePx: 1152, rootFontPx: 20}, {detail: 'page'}],
  ['larger text threshold remains in rem', {usableInlinePx: 1440, rootFontPx: 20}, {detail: 'inline'}],
  ['unmeasured zero width stays conservative', {usableInlinePx: 0}, {detail: 'page'}],
  ['full page does not invent selection', {hasArtifact: false, forceFullPage: true}, {detail: 'none'}],
];
for (const [name, patch, expected] of cases) {
  test(name, () => {
    const actual = resolvePresentation({...base, ...patch});
    for (const [key, value] of Object.entries(expected)) assert.equal(actual[key], value);
  });
}
const invalid = [
  ['NaN content width', {usableInlinePx: NaN}],
  ['infinite content width', {usableInlinePx: Infinity}],
  ['negative content width', {usableInlinePx: -1}],
  ['zero root size', {rootFontPx: 0}],
  ['negative root size', {rootFontPx: -1}],
  ['NaN root size', {rootFontPx: NaN}],
  ['unknown density', {preferredDensity: 'tiny'}],
  ['nonboolean selection', {hasArtifact: 'true'}],
];
for (const [name, patch] of invalid) {
  test(name, () => assert.throws(() => resolvePresentation({...base, ...patch}), TypeError));
}
```

Integration must also handle hybrid pointer devices and an explicit comfortable-density preference. Do not infer touch solely from viewport width. Observe reduced motion separately; it must not affect selected data or navigation state. Translate this seed into the repository's strict TypeScript conventions and test the actual PF layout, not only this helper.

## 7. Sources

External guidance is referenced rather than vendored. The following skill links are pinned to the reviewed commit:

- [Skill definition and workflow](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/dcc40ff5133ef78276117db0cc34e7b83cc8aeba/.claude/skills/ui-ux-pro-max/SKILL.md): priorities, stack awareness, source-fit checks, master/page workflow, and recommendation boundaries.
- [Quick reference](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/dcc40ff5133ef78276117db0cc34e7b83cc8aeba/.claude/skills/ui-ux-pro-max/references/quick-reference.md): focus, reflow, labels, information hierarchy, interruption, forms, and state feedback.
- [Professional rules and scope notice](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/dcc40ff5133ef78276117db0cc34e7b83cc8aeba/.claude/skills/ui-ux-pro-max/references/pro-rules.md): native/mobile scope; not adopted wholesale as desktop-web rules.
- [Style catalog, Minimalism & Swiss Style](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/dcc40ff5133ef78276117db0cc34e7b83cc8aeba/src/ui-ux-pro-max/data/styles.csv): the manually selected visual family; catalog colors/framework examples are not Quay dependencies.
- [PatternFly design tokens](https://www.patternfly.org/foundations-and-styles/design-tokens/overview/) and [token development guidance](https://www.patternfly.org/tokens/develop-with-tokens/): semantic token use and theme-aware composition.
- [PatternFly Drawer guidelines](https://www.patternfly.org/components/drawer/design-guidelines/): inline versus overlay primary-detail behavior.
- [W3C target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum): web CSS-pixel requirements and exceptions.
- [W3C WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/): reflow, text resizing, focus, and relevant accessibility criteria.

The original architecture's source and evidence ledger remains in force. This revision does not claim the new UI was built, that a rendered screen was reviewed, or that live authentication or private repository operations were tested.
