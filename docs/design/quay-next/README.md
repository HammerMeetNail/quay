# Quay Next: a registry workbench, not another administration console

**Status:** first read-only implementation slice on `docs/quay-ui-next-2026-09-22`; not a shipped application or feature/authentication parity. <br>
**Prepared/refined:** 2026-09-22. <br>
**Repository baseline:** `HammerMeetNail/quay`, `master` at `f6dfb18d6bfbbf99110ba40459cd3cc06a62d6a1`. <br>
**Required stack:** React, TypeScript, PatternFly 6. <br>
**Primary development target:** existing quay.io backend, without a local Quay, PostgreSQL, Redis, or Clair deployment. <br>
**Design refinement:** informed by `nextlevelbuilder/ui-ux-pro-max-skill` at `dcc40ff5133ef78276117db0cc34e7b83cc8aeba`; manually adapted to Quay and PatternFly, not an unreviewed generated template.

## Start here

This revision retains the original architecture and implementation task graph while making the visual design and interactions substantially more specific. The first read-only implementation slice landed in `5874f61948fc65d174bfdc7ffece632ee54a546c`; continue the remaining work from the [task state](evidence/STATE.md) and [implementation evidence](evidence/IMPLEMENTATION-STARTER.md), rather than producing a replacement plan.

| Read | Purpose |
| --- | --- |
| This README | Product direction, routes, user journeys, and scope |
| [Design-system MASTER](design-system/MASTER.md) | Global visual hierarchy, tokens, density, responsive behavior, focus, and motion |
| [Relevant page contract](#page-contracts) | Only the page being implemented; do not load every page into every task |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Auth parity, same-origin live preview, API contracts, security, capabilities, and budgets |
| [IMPLEMENTATION.md](IMPLEMENTATION.md) | Build/transport/preview/component seeds using the existing stack |
| [EXECUTION.md](EXECUTION.md) | Dependency-ordered tasks QN-00 through QN-12 and agent bootstrap prompt |
| [UX-REFINEMENT.md](UX-REFINEMENT.md) | Skill applicability decisions, amendments to those tasks, refined test examples, and source/evidence ledger |
| [Task state](evidence/STATE.md) | Current QN-00–QN-12 progress and remaining gates |
| [Implementation evidence](evidence/IMPLEMENTATION-STARTER.md) | Exact first-slice checks and public quay.io preview observations |

For presentation conflicts, MASTER plus the applicable page contract supersede earlier illustrative UI snippets. In particular, the desktop artifact inspector is non-modal, the compact-row minimum is no longer approximately 36 px, and global platform/scan filtering is not promised without a real backend contract. Architecture/security/auth rules cannot be weakened by a page override. Read the UX refinement's task amendments before executing QN-02 onward.

## 1. Product decision

Build a **repository-first, digest-centered registry workbench**. The user should immediately be able to find an image, identify the exact tag/digest/platform, understand available or missing evidence, copy a correct reference, and see the actions their permissions allow.

Do not map the old route hierarchy one-for-one into React. Do not make an organization directory the default landing page. Do not place a wall of metric cards or administrative tabs between the user and their artifacts. Keep advanced functionality accessible without making every screen an administration console.

**Visual direction: quiet precision.** Neutral PatternFly surfaces, restrained accent color, clear typography, aligned data, thin separators, and an uncluttered primary-detail workspace. Density comes from removing redundant UI, not tiny fonts. The interface supports light, dark, and system themes. No glassmorphism, neon terminal styling, decorative dashboard charts, external font imports, or new animation library.

### Non-goals

This project does not replace Quay's identity providers, authorization model, scanner, OCI distribution implementation, storage, database, or billing system. Core journeys cannot depend on deploying a new backend API to quay.io. A frontend rewrite is not proof that backend vulnerabilities are fixed. No AI assistant, new microfrontend platform, or second component/design library is required.

## 2. User journeys and acceptance targets

These are design targets, not measurements of the current product.

| Journey | Intended experience | Target |
| --- | --- | --- |
| Find a repository | Scoped workbench, search, recent/starred shortcuts | One search and one selection |
| Obtain a reproducible image reference | Choose artifact and copy its exact immutable command | At most two deliberate actions after opening a repository for the straightforward default-index case |
| Check platform support | Platform field or artifact inspector | No detour through an unrelated image-list page |
| Investigate a vulnerability | Exact digest/platform evidence with package and fix information where available | Preserve selection, filters, and return position |
| Expire/restore/retag | Contextual action plus explicit impact review | No unrelated settings navigation or silent destructive default |
| Grant access | Scope, effective role, direct/inherited provenance, proposed change | Understand the actual grant before submitting |
| Open a public image | Useful anonymous repository page when enabled | No authenticated-only fetch loop or unnecessary forced sign-in |
| Switch identity | Atomic private-state removal | No prior account data reappearing from a cache or late response |

## 3. Information architecture

### Global shell

One compact masthead contains Quay identity, registry/environment, a small global Jump action, permitted notifications, and account controls. The namespace selector provides personal, organizational, recent, and public contexts. The workbench itself gets the prominent scoped search field; do not duplicate equally prominent search boxes in the masthead and page.

Primary navigation is **Repositories, Activity, Access, Settings**. The last three clearly identify the selected namespace and respect capabilities. Superuser administration is a separately entered and labeled area, not regular navigation for all users. Organizations are contexts, not the default task.

A live preview always communicates **Live quay.io · repository writes blocked**. Fixture mode always communicates **Demo data**. Preserve backend notices and status messages without filling normal screens with unnecessary banners. Preview restrictions and the account's real backend role are distinct.

All-accessible views require bounded pagination and honest partial-results labeling. Do not fan out across every organization at startup to manufacture a complete-looking dashboard.

### Route contract

Routes are relative to a configurable application basename. Preview uses `/__quay_next_preview__/`; an initial production canary may use `/ui/next/`. No backend route moves.

```text
/                                      -> repository workbench
/repositories                          -> repository workbench
/repositories/:namespace               -> scoped workbench
/repository/:namespace/*                -> repository workspace
  ?view=tags                            -> default operational view
  ?view=activity                        -> repository activity
  ?view=automation                      -> builds, triggers, mirrors
  ?view=access                          -> repository access
  ?view=settings                        -> repository administration
  &artifact=<encoded-digest>            -> selected immutable artifact
  &platform=<encoded-platform>          -> explicitly selected platform
/artifact/:namespace/*                  -> canonical full-page artifact detail
/access/:namespace                     -> members, teams, robots, defaults
/activity/:namespace                   -> authorized audit/activity views
/settings/:namespace                   -> namespace administration
/account                               -> personal profile, security, applications
/signin                                -> redesigned sign-in entry
/admin/*                               -> explicitly gated administration
```

The canonical artifact-detail URL also carries its full digest and explicit platform as validated query state using the same `artifact`/`platform` contract; a repository path alone is not an immutable artifact identity. Parse wildcard repository names using tested utilities, retaining supported nested names. The visible daily-work tabs are Tags & artifacts, Activity, Automation; Access and Settings are reachable through Manage repository and their direct URLs.

Preserve legacy supported routes, shorthand namespace links, query/hash semantics, email links, and auth returns through a complete inventory. Reserved backend paths such as `/api`, `/v2`, `/oauth`, `/csrf_token`, `/config`, and recovery/callback routes never fall into the SPA catch-all.

URL state reconstructs search, filter scope, pagination, selected artifact, and platform. Credentials and OAuth secrets never enter that state. Use the design-system history rules for inspection/close so a directly opened link does not send the user to an arbitrary previous site.

## 4. Page contracts

### [Repository workbench](design-system/pages/workbench.md)

The repository list is the first useful screen. Name/description, visibility, modification, and state form a readable table. Search and filters disclose whether they operate on the backend collection or only loaded results. No manifest/scan fan-out is allowed to decorate repository rows. Create repository is secondary unless creation is the relevant empty-state task.

### [Repository and artifact inspection](design-system/pages/repository.md)

Repositories open on actual tags. Tag, digest, platform, updated time, and evidence are prioritized; optional fields use column management and detail disclosure. The exact pull command appears beside the selected artifact and platform, not as a large empty box above the table.

Wide workspaces use a non-modal inline inspector; narrow workspaces show the same content as a detail page. There is no nested four-tab interface inside the inspector. Identity and command come first, with security coverage, metadata, related artifacts, and history available progressively. Full digests and commands wrap and are copyable without hover-only access.

### [Access, settings, and authentication](design-system/pages/access-and-auth.md)

Access explains identity, scope, role, and grant source. Settings present clear sections and explicit impact/recoverability. Authentication is a focused, accessible form/provider flow with no marketing half-screen or replacement identity system. Real step-up and destructive confirmations are modal; ordinary artifact inspection is not.

## 5. Registry semantics that cannot be simplified away

A tag is mutable; a digest is the exact artifact identity. Index digests, child digests, platforms, and advertised versus available sparse content remain distinct. Do not assume `latest` or reduce supported algorithms to a SHA-256-shaped string. Abbreviation is presentation only.

A multi-platform index does not have a single download size equal to the sum of its child platforms. Show per-platform measurements with their actual definition. Tag modification, build time, pull time, scanner time, and UI retrieval time are separate. Do not invent missing data or approximate deduplicated storage by summing image sizes.

| Evidence state | Presentation |
| --- | --- |
| Not requested | Neutral Not loaded state |
| Unsupported | Explain artifact/deployment limitation |
| Queued/scanning | Real progress state with bounded visible-only polling |
| Failed/unavailable | Explicit failure plus safe retry |
| Zero findings in an available report | No vulnerabilities reported; never Safe |
| Findings | Severity, affected package/version, advisory, and fix where supplied |
| Incomplete multi-platform reports | State covered and uncovered children |
| Stale/unknown report time | Distinguish scanner time from retrieval time; fabricate neither |
| Signature artifact present | Signature present; not verified unless a trusted verification result exists |

A verification result must bind the digest, identity/issuer, trust policy, and verification time. A cosign-like tag or `trust_enabled` flag is not verification. Related artifacts, SBOMs, model cards, and provenance are capability-gated; absence of support must not break ordinary tag browsing.

Descriptions, labels, manifests, logs, advisory text, and model cards are untrusted content. Apply the architecture's rendering, URL, response-size, and content-handling restrictions. Visual polish never justifies executing raw HTML, loading arbitrary third-party images, or weakening CSP.

## 6. Feature completeness and complexity placement

The complete feature ledger remains in EXECUTION.md. Simpler navigation does not remove any requirement.

**Access:** people, teams, robots, direct/inherited roles, defaults, and exact change review. Secrets are revealed only deliberately and never enter list decoration, telemetry, copied URLs, screenshots, or persistent UI state.

**Automation:** builds, triggers, logs, repository mirrors, and organization mirrors with their real distinctions, operating state, failure recovery, and permissions. Logs remain untrusted text; mirrors are not presented as normal writable repositories.

**Settings:** metadata, expiration/retention, immutability, notifications/webhooks, and explicit destructive actions. Separate reversible operations from permanent deletion. Never offer Undo when the backend cannot undo the action.

**Activity:** authorized actor/action/target/timestamp records with explicit repository/namespace scope. Do not invent an all-registry timeline through request fan-out. Diagnostics never expose private payloads or credentials.

**Quotas, billing, accounts, and administration:** preserve existing supported capabilities and their permission/feature gates. Lazy-load billing/provider scripts and heavy administration/log tooling. A temporary old-UI fallback is a migration state, not completed parity.

## 7. Real-backend and implementation boundary

The first-slice launcher serves local static assets in an isolated browser at the real quay.io origin, with allowlisted reads continuing to the genuine backend. Public `projectquay/quay` browsing, tag/detail inspection, and a digest-scoped security report were verified without a local Quay stack. Private session use and provider behavior remain unverified. The optional localhost API bridge is not full browser-auth parity.

Default live preview remains repository-read-only under a reviewed allowlist; some GETs can have side effects. Authentication evaluation is explicit and separate. Mutations require an authorized disposable scope and the architecture's safeguards. Do not automatically invoke remote signout during cleanup.

The baseline declares React 18, PatternFly 6, React Router 7, and TanStack Query 4. Use the actual lockfile and compatible APIs, not stale guide versions or Query5-only snippets. A new independent frontend entry must not break existing standalone, legacy, or host/plugin builds.

## 8. Evidence and first delivery

The first delivery is a polished, real-quay.io repository/tag/detail experience. It is not a static screenshot, a fixture-only mockup, or the final feature-parity release. Execute the existing task graph with the [UX amendments](UX-REFINEMENT.md#4-amendments-to-the-existing-agent-task-graph).

This branch now contains the separate React/PatternFly read-only workbench, fixture server, and live launcher. Typecheck, fixture/unit tests, Chromium and WebKit rendered tests, existing standalone/plugin builds, and public live reads passed as recorded in the [implementation evidence](evidence/IMPLEMENTATION-STARTER.md). Firefox rendered tests are infrastructure-blocked on this host. Full accessibility and measured performance acceptance, live authentication, private-repository behavior, writes, and deployed security remain open. The earlier refinement's 22 pure Node tests are historical design evidence, not the current implementation result.

Use the agent bootstrap prompt at the end of EXECUTION.md. Its instruction to read this README now includes MASTER, the applicable page contract, and the UX task amendments. Continue implementing independently when an external integration is blocked, but never claim auth/feature parity or production readiness while a required gate is unverified.
