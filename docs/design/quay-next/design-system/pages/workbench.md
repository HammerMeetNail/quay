# Page contract: repository workbench

Read [MASTER.md](../MASTER.md) first. This page specializes hierarchy and interactions, not security or API rules. All names and values in the composition below are synthetic examples.

## Composition

```text
QUAY   quay.io / Live preview                 [Jump to…]   Notifications   Account
       Repository writes blocked
───────────────────────────────────────────────────────────────────────────────
Repositories │ [Namespace: acme ▾]
Activity     │ Repositories                              Create repository
Access       │
Settings     │ [Search repositories within acme…                      ]
             │ All accessible   Starred   Recent          Filters   Display
             │
             │ REPOSITORY                    VISIBILITY   UPDATED      STATE
             │ payments                      Private      12 min       Normal
             │ Payment processing service
             │ worker                        Private      1 h          Read only
             │ Asynchronous job processing
             │ base                          Public       3 h          Mirror
             │ Shared runtime images
             │
             │ 25 repositories loaded                  Previous   Load next
```

The environment label is not a second full-width warning banner unless it needs to communicate an actionable problem. Its full meaning remains available at all widths. A narrow layout can wrap the masthead rather than truncate the target host or silently omit write protection.

## 1. Attention hierarchy

The entity list is the work surface. The heading establishes context; the namespace control scopes the list; search finds something within that scope. Create repository is a secondary button for an established workspace. It may become the primary empty-state action when creating the first repository is the next useful permitted task. No hero banner, storage donut, aggregate vulnerability score, duplicate organization directory, or oversized summary cards above the list.

Show the repository name prominently and its short description beneath when available. Within one namespace, do not repeat the full namespace in every row visually; preserve the full repository path in links, accessible descriptions where needed, and copy actions. In an all-accessible mixed-namespace result, include the namespace explicitly so same-named repositories are distinguishable. Missing descriptions do not become fake generated descriptions or empty second lines with forced height.

Use actual list-response fields for visibility, modified time, and state. Available storage data is an optional column with a defined measurement, not a guessed sum. The inspection list does not load manifests or scanner data to decorate repository rows.

## 2. Search and scope contract

There is one prominent local search field. Global Jump is a small masthead action and keyboard shortcut, not a second competing search box. Preserve OS/browser shortcuts and do not intercept text-entry shortcuts. Visible navigation remains sufficient without learning a shortcut.

The namespace selector shows the current scope with its name and type. Changing scope cancels old requests, resets incompatible page/filter state, and updates URL state atomically. Do not briefly show results from the previous namespace under the new heading. A request failure retains its scope; it is not relabeled an empty namespace.

Verified server search gets wording such as **Search repositories within acme**. Without an appropriate server contract, use **Filter loaded repositories** and show coverage beside the result count. Do not label client filtering as search across the registry. Apply the same rule to sorting and visibility/state filters. More advanced filters live behind one labeled filter control and display active removable values with explicit scope.

Filter chips wrap as a collection. A `+n filters` control, when needed, opens an accessible disclosure containing all omitted values; it is not inert text. Removing one filter keeps focus in the filter area and announces the resulting scope/count after the request settles. An unknown total is not shown as 0 or inferred from a page length.

Recent history remains memory/session-only and identity-bound. Backend stars require their verified mutation contract and are disabled by the default live read policy; the UI must explain that restriction rather than imply starring succeeded locally on the server. Do not persist private repository names to enable a cosmetic recent-items menu.

## 3. Table, actions, and responsiveness

Default desktop columns are repository, visibility, modified time, and state. Show optional columns only through Display. Use a plain data table, not an ARIA grid with invented keyboard behavior. Links are real links; modifier-click and open-in-new-tab work. A row hover is an affordance, not the only way to find or activate an action.

Current navigation/inspection and bulk selection are different concepts. Do not use a checked box merely to indicate the current repository. Avoid rendering unchecked bulk controls until the page actually offers an approved bulk task. Place rare row actions in a consistently labeled repository-actions menu rather than a line of unexplained icons.

On a narrow screen, use a labeled record presentation or accessible stacked table retaining name/path, visibility, state, and a readable modification label. Description and optional metadata may expand in flow. Keep all actions reachable by touch without hover. Long paths must wrap; do not add a horizontal application scrollbar or clip names to keep a prescribed row height.

## 4. Required states

| State | Content and action |
| --- | --- |
| Initial loading | Stable shell and search area with static row skeletons; no misleading empty-state message |
| No accessible repositories | Explain the scope; offer creation only with capability/permission, otherwise browse public or change scope |
| No matches | Preserve input and filters; offer Clear filters or change the search |
| Backend failure | Explain that loading failed, preserve context, offer retry; do not show 0 repositories |
| Partial pages | Identify loaded count and continuation, not an invented collection total |
| Scope access lost | Clear unauthorized records and explain permitted next steps; do not leak cached detail |
| Background refresh | Keep still-valid rows, mark updating state, announce meaningful completion once |
| Read-only preview | Browsing works; write controls explain the preview policy independently of backend role |

## 5. Acceptance additions

At 1440 by 900 with no exceptional global notice and a settled first page, at least eight readable repository rows should be visible in comfortable mode. This is a synthetic-fixture visual target, not a hard height rule that may clip real content or a promise about all translated text. No critical functionality may be hidden to meet it.

Test a mixed namespace result containing duplicate repository names, a very long nested path, absent descriptions, long localized labels, and read-only/mirror/unknown states. Validate scope switching while an old request completes. Verify that filtering a page cannot be mistaken for a global result and that initial repository display makes no scanner requests.

Required implementing tasks: QN-02 shared shell, QN-04 workbench, QN-10 visual/accessibility/performance checks. See [UX-REFINEMENT.md](../../UX-REFINEMENT.md) for exact gate amendments.
