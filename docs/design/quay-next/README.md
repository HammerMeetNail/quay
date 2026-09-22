# Quay Next: a registry workbench, not another administration console

**Status:** implementation specification, not a shipped application.  
**Prepared:** 2026-09-22.  
**Repository baseline:** `HammerMeetNail/quay`, `master` at `f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1`.  
**Required stack:** React, TypeScript, PatternFly 6.  
**Primary development target:** the existing quay.io backend, without a local Quay, PostgreSQL, Redis, or Clair deployment.

## Read this plan in order

1. This document defines the product, visual system, information architecture, and acceptance criteria.
2. [ARCHITECTURE.md](ARCHITECTURE.md) defines the application boundaries, real-backend preview, authentication parity, API contracts, and security requirements.
3. [IMPLEMENTATION.md](IMPLEMENTATION.md) provides concrete React/PatternFly, API-client, preview-runner, and testing examples.
4. [EXECUTION.md](EXECUTION.md) breaks the work into dependency-ordered, independently verifiable agent tasks and release gates.

An agent should implement these documents, not produce another planning document instead. The first delivery is a polished repository/tag browsing experience using real quay.io data. That delivery is explicitly not the final feature-parity release.

## 1. Product decision

Build a **repository-first, digest-centered registry workbench**. A user should immediately be able to answer:

- Where is the image or artifact I need?
- Which tag, digest, and platform am I actually looking at?
- What security evidence is available, missing, or stale?
- What command should I copy to use this exact artifact?
- What changed, and what can I safely do with my permissions?

Do not reproduce the existing navigation hierarchy with new components. Do not make an organization directory the default landing page. Do not hide everyday operations behind an overview screen or a wall of administrative tabs. Do not replace useful information with large decorative cards, charts, or empty whitespace.

The default experience is calm and information-dense. Advanced functionality remains available through scoped navigation, contextual actions, and direct links. Simpler navigation must not mean missing functionality.

### Non-goals

This project does not replace Quay's authorization model, identity providers, scanner, OCI distribution implementation, storage engine, database, or billing system. It does not introduce a new API that quay.io would need to deploy before the UI can work. It does not promise that a frontend rewrite fixes backend vulnerabilities. It does not require an AI assistant, a new design-system dependency, or a microfrontend platform.

## 2. User journeys and interaction budgets

These are acceptance targets, not measured results of the existing product.

| Journey | Intended experience | Acceptance target |
| --- | --- | --- |
| Returning developer finds a repository | Default workbench, namespace scope, recent/starred shortcuts, search | Repository reached with one search and one selection |
| Developer obtains a reproducible image reference | Open repository, choose tag, copy digest-pinned command | At most two deliberate actions after opening the repository |
| Developer checks ARM64 support | Platform column or artifact drawer | No detour through a separate image-list page |
| Operator investigates a vulnerability | Open scan summary, select exact platform, inspect affected package and fix | Preserve tag, digest, platform, filters, and return position |
| Maintainer updates or expires a tag | Contextual row action, explicit impact review | No navigation to unrelated settings; no silent destructive default |
| Organization administrator grants access | Scoped Access view, effective permissions, team/robot provenance | Explain what will change before submitting |
| Anonymous visitor opens a public image link | Useful repository page without a forced login wall when allowed | No authenticated-only requests or redirect loop |
| User switches accounts or registries | Identity changes atomically | Previous private data disappears immediately and cannot reappear from a late response |

## 3. Information architecture

### Global shell

Use one compact masthead with Quay branding, registry identity, a searchable namespace selector, global search/jump, notifications, and profile. The environment label is always visible. A live preview must say **Live quay.io · repository writes blocked**; fixture mode must say **Demo data**. Never make the two visually indistinguishable.

The primary navigation contains **Repositories**, **Activity**, **Access**, and **Settings**. The last three are scoped to the selected namespace and capabilities. A user without organizational access does not see a broken organizational Access screen. Public browsing uses a clear public scope. Superuser administration is an explicitly entered, separately labeled area, not normal navigation for everyone.

Organizations are contexts, not the user's first task. The namespace selector supports personal namespace, individual organizations, recent scopes, and public browsing. An all-accessible view is permitted only with bounded pagination and honest partial-results labeling; it must not fan out across every organization on startup.

### Route contract

Proposed routes below are relative to a configurable application basename. Preview uses `/__quay_next_preview__/`; an initial production canary can use `/ui/next/`. No backend route is moved.

```text
/                                      -> repository workbench
/repositories                          -> repository workbench
/repositories/:namespace               -> scoped workbench
/repository/:namespace/*                -> repository workspace
  ?view=tags                            -> default operational view
  ?view=activity                        -> relevant repository activity
  ?view=automation                      -> builds, triggers, mirrors
  ?view=access                          -> effective repository access
  ?view=settings                        -> repository administration
  &artifact=<encoded-digest>            -> shareable artifact drawer
  &platform=<encoded-platform>          -> explicitly selected platform
/artifact/:namespace/*                  -> full-page immutable artifact detail
/access/:namespace                     -> members, teams, robots, defaults
/activity/:namespace                   -> authorized audit/activity views
/settings/:namespace                   -> namespace administration
/account                               -> personal profile, security, sessions, applications
/signin                                -> redesigned sign-in entry
/admin/*                               -> explicitly gated administration
```

The wildcard repository portion must be parsed by a tested route utility, not guessed by splitting a digest or repository name on arbitrary slashes. Preserve supported nested repository names. Add a complete legacy-link map after inventorying existing routes, query parameters, hash fragments, shorthand namespace links, email links, and OAuth return routes. Reserved paths such as `/api`, `/v2`, `/oauth`, `/csrf_token`, `/config`, and existing backend account/recovery routes never fall into the SPA catch-all.

Use URL state for search, filters, page/cursor position, selected artifact, and platform. Refresh, Back, Forward, and copied links must reconstruct the view. A sensitive credential or OAuth result never belongs in that state. Unknown URL fields are ignored safely rather than executed or forwarded to a backend.

## 4. Screen specification

### 4.1 Repository workbench

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ QUAY   quay.io · Live preview   [Namespace: acme ▾]   [Jump to repository… ⌘K]   Me ▾ │
├──────────────┬─────────────────────────────────────────────────────────────────────┤
│ Repositories │ Repositories                                     [Create repository]│
│ Activity     │ Recent   Starred   All accessible                                    │
│ Access       │ [Search repositories…                       ] [Visibility ▾] [State ▾]│
│ Settings     │                                                                     │
│              │ Repository             Visibility    Updated       State             │
│              │ acme/payments          Private       12 minutes    Normal          › │
│              │ acme/worker            Private       1 hour        Read only       › │
│              │ acme/base              Public        3 hours       Mirror          › │
│              │                                                                     │
│              │ Showing 1–25 loaded results                  [Previous] [Load next]   │
│              │ Status and notices remain available without displacing the table.    │
└──────────────┴─────────────────────────────────────────────────────────────────────┘
```

Numbers and names in wireframes are illustrative, not live data.

The initial list uses fields already present in repository-list responses. It does not issue a security request for every repository or invent repository-wide vulnerability totals. Rows display name, short description, visibility, last modification, and repository state. Storage usage is an optional column when the backend provides a defined measurement. Stars use the existing backend contract where supported; recent history is session-only by default to avoid persisting private repository names on disk.

Search is a text field, not a complex query-language requirement. A command palette adds a power-user shortcut but never replaces visible navigation. Server-side search is used only where its actual API semantics are verified. Client-side filtering must say **Filter loaded results** and may not imply registry-wide search. Do not sort one fetched page while labeling the entire collection globally sorted.

No-data states distinguish no accessible repositories, no search matches, insufficient permission, backend unavailable, and partial results. A failed request is not an empty list. Show the user's next useful action, not a generic mascot or a spinner forever.

### 4.2 Repository workspace: tags first

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ acme / payments                         Private · Write access          [Actions ▾] │
│ Payment processing service                                                        │
│ [podman pull quay.io/acme/payments@sha256:…                          ] [Copy command]│
│ Tags & artifacts     Activity     Automation     Access     Settings                │
│ [Find tag…                         ] [Platform ▾] [Scan state ▾] [Columns]           │
├────────────────────────────────────────────────────────────────────────────────────┤
│ Tag              Digest           Platforms      Updated     Size       Security   │
│ v2.8.1           sha256:ab31…      amd64, arm64    12 min      Per arch   2 high     │
│ stable           sha256:ab31…      amd64, arm64    12 min      Per arch   Same digest│
│ v2.8.0           sha256:42c0…      amd64, arm64    Yesterday   Per arch   Not scanned│
│                                                                                            │
│ [Previous] [Next]                      Selected 0 · bulk controls appear on selection│
└────────────────────────────────────────────────────────────────────────────────────┘
```

The command is not constructed using `latest` by default. An initial repository without an explicitly selected tag shows a compact **Choose a tag to copy an exact reference** prompt. Once a tag is selected, present tag-based and digest-pinned commands; recommend the digest-pinned form for reproducibility. Remember the command-tool preference, not credentials. Support Podman and Docker initially; Kubernetes image reference is an optional text format, not another required tab.

Default columns: tag, abbreviated digest with full accessible value, platform summary, tag-updated timestamp, size with an accurate definition, scan state, and contextual actions. Add expiration, immutable state, artifact type, last pull, and pull count through column management only when supported. A duplicate digest is not a separate scan. Tag movement and image build time are different timestamps and must be labeled separately.

For a multi-platform index, do not sum platform sizes into a misleading download size. Show **Per platform** and expose compressed layer size on a selected child manifest when supplied. Sparse indexes distinguish advertised platforms from locally available child content. Unknown or unrecognized states remain visible and disable unsafe writes.

Rows offer a real link or labeled button; the entire row is not the only clickable control. The primary interaction opens a drawer with a URL-backed selection. Users can open the full detail in a new tab. Closing the drawer restores keyboard focus and table scroll position. Selection is stable by repository + tag + observed digest, not by row index.

### 4.3 Artifact detail drawer

```text
┌────────────────────────────────────────────────────┐
│ v2.8.1                           [Open full page] × │
│ sha256:ab31…                         [Copy digest]  │
│ OCI image index · 2 advertised platforms            │
│                                                    │
│ Pull reference                         [Copy]       │
│ [Index (automatic platform selection) ▾]            │
│                                                    │
│ Platforms      Security      Metadata      Related  │
│ linux/amd64    Available · 2 high · report retrieved │
│ linux/arm64    Available · not scanned               │
│                                                    │
│ Signature artifact present                         │
│ Cryptographic verification: not available           │
│                                                    │
│ Expiration: none reported   Immutable: enabled      │
│ Source revision: shown only if metadata supplies it │
└────────────────────────────────────────────────────┘
```

Do not overload a single green badge with scan status, signature presence, provenance, and policy compliance. These are independent evidence types. The detail view exposes the manifest/index digest, media type, subject/referrers if available, platform descriptors, size semantics, labels, annotations, layer metadata, tags referencing the digest, scanner evidence, and artifact relationships. Expensive sections load only when opened.

**Security evidence vocabulary:**

| State | Required language and behavior |
| --- | --- |
| Not requested | Neutral placeholder; do not imply a scan result |
| Unsupported | Explain that the artifact or deployment does not support this evidence |
| Queued/scanning | Show progress state; bounded polling only while visible |
| Failed/unavailable | Explain the failure and offer explicit retry |
| Report available, no reported findings | Say **No vulnerabilities reported**, not **Safe** |
| Findings available | Counts by severity with package, installed version, advisory, and fix where supplied |
| Partial multi-platform evidence | Show which children are covered and which are missing |
| Stale or timestamp unavailable | Distinguish scanner time from UI retrieval time; never fabricate scan age |
| Signature artifact found | Say **Signature present; not verified** unless a trusted verifier actually returns a verification result |

A verification result must be bound to the exact digest, identity/issuer, trust policy, and verification time. A cosign-like tag name or `trust_enabled` flag is not a cryptographic verdict. Do not download arbitrary blobs or execute a verifier in the browser merely to fill a badge. When unavailable on quay.io, show the limitation honestly and keep the core UI functional.

### 4.4 Access, automation, and administration

**Access:** one understandable view of people, teams, and robots, with role, scope, and provenance. Separate direct and inherited access; never imply an inherited grant can be removed locally. Show the effective change before applying it. Robot credentials are revealed only through explicit actions, never embedded in list responses, analytics, copied URLs, screenshots, or persistent UI state.

**Automation:** group builds, triggers, and mirrors by the user's task. Show operational state, most recent outcome, next meaningful action, and logs. Repository mirror and organization mirror are distinct capabilities. A read-only mirror is not presented as a normal writable repository. Build logs are untrusted text, not HTML.

**Settings:** group general information, retention/expiration, immutability policies, notifications/webhooks, and destructive actions. Put permanent deletion in an explicit danger section, separate from tag expiration and reversible removal. Show affected repository, tags/digests, time window, and recoverability. Do not offer an Undo button when the backend cannot undo the operation.

**Activity:** expose authorized logs and events with actor, action, target, and timestamp. No invented all-registry timeline or request fan-out to approximate one. Explicitly label namespace versus repository scope. Provide copyable request identifiers for failures without revealing credentials or private payloads.

**Quotas and billing:** show only measurements returned by the backend, with scope and timestamp. Do not add image sizes to approximate deduplicated storage. Billing stays lazy-loaded and permission-gated; payment-provider scripts are not part of the repository landing bundle. The final parity release must preserve existing account, billing, invitation, and administrative capabilities or record an explicitly approved product decision.

## 5. Visual system: sleek within PatternFly

Use PatternFly as the component system, not as a requirement to adopt every default page template. Compose its components into a distinct Quay experience. No MUI, Ant Design, Tailwind component library, or second icon set.

| Element | Design contract |
| --- | --- |
| Overall character | Neutral surfaces, strong typography, restrained blue accent, thin separators, minimal shadows |
| Masthead | Approximately 56 px high on desktop; explicit environment/identity rather than oversized branding |
| Navigation | Approximately 208 px open, collapsible; no more than four primary task categories |
| Main content | 24 px desktop gutters, 16 px small-screen gutters; table gets available width |
| Typography | PatternFly-supported font stack; 28 px page title, 20 px section title, 14–16 px body; monospace only for technical identifiers |
| Spacing | 4/8/12/16/24/32 px rhythm mapped to supported PatternFly tokens |
| Density | Approximately 48 px comfortable rows; explicit compact option near 36 px, with accessible focus and target areas |
| Corners | Restrained rounding, not pill-shaped panels everywhere |
| Surfaces | One primary work surface; avoid nested cards around every form, toolbar, and table |
| Color | Semantic PatternFly tokens; color never carries status without text/icon support |
| Theme | Light, dark, and system preference; no flash of the wrong theme; preferences contain no private data |
| Motion | Brief, functional transitions; honor reduced motion; no decorative entrances |
| Loading | Stable shell and skeleton rows; progressive independent sections; no blank page while identity/config loads |

Use PatternFly 6 semantic design tokens and documented component variables. Keep application styling in scoped modules; do not patch `.pf-*` selectors globally or rely on generated DOM structure. Import the PatternFly base styles once. Use `@patternfly/react-table` for table primitives. Tree-shake icons and lazy-load optional charts/editors. Theme values and screenshots are release artifacts, not ad hoc per-page CSS choices.

### Responsive and accessible behavior

At narrow widths, preserve tag/name, digest access, scan state, and actions. Move secondary metadata into an expandable region; do not require horizontal scrolling of the entire page. A detail drawer becomes a full-height sheet/page with a close control and correct focus management. Test 360, 768, 1280, and 1536 px widths, 200% zoom, keyboard-only use, dark mode, forced colors, and reduced motion. Target WCAG 2.2 AA. Automated accessibility checks are necessary but do not replace a keyboard and screen-reader acceptance pass.

The command palette uses an accessible dialog and list of navigation actions. It is not an arbitrary command executor. Forms use persistent labels, useful errors, password-manager-compatible autocomplete, and an error summary when multiple fields fail. Notifications are restrained, announced appropriately, and do not disappear before the user can read actionable information.

## 6. What makes this different from another cosmetic rewrite

The default page is useful work, not organization administration. Repository detail opens on actual artifacts, not a summary demanding another click. Tag, digest, and platform stay connected throughout the experience. The table and detail panel share URL state, so investigation does not discard context. Evidence is explicit rather than optimistic. Administrative complexity is moved out of the default path without discarding capabilities. Data loading is bounded by what is visible, not by how many organizations a user belongs to.

Acceptance should compare the new implementation with these user journeys and interaction budgets, not with whether every old tab has been recreated in the same order.

## 7. Implementation and evidence boundary

The researched fork already declares React 18, PatternFly 6, React Router 7, and TanStack Query 4. Some existing frontend guidance still describes earlier major versions. Use the actual locked dependency graph and current repository instructions; do not introduce incompatible v5 Query examples or migrate React simply to make the project sound newer. See the architecture decision and source ledger in [ARCHITECTURE.md](ARCHITECTURE.md).

This specification was prepared from source inspection and official technical documentation. Authenticated quay.io login, live private repository operations, the new UI build, and the full proposed tests have **not** been executed as part of writing the specification. Live `/config` and provider behavior must be captured by the first implementation task rather than guessed. The branch contains a plan, not a claim that any security or feature-parity gate has passed.

Proceed with [ARCHITECTURE.md](ARCHITECTURE.md), then [IMPLEMENTATION.md](IMPLEMENTATION.md), and execute the task graph in [EXECUTION.md](EXECUTION.md).
