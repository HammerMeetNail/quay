# Page contract: access, settings, and authentication

Read [MASTER.md](../MASTER.md) and the auth-parity contract in [ARCHITECTURE.md](../../ARCHITECTURE.md). These are presentation refinements, not authorization to remove providers, change credentials, bypass challenges, or replace Quay authentication.

## 1. Sign-in without a marketing page

Use a single focused form with a maximum readable width near 28 rem and fluid narrow-screen gutters. Keep Quay identity and the actual registry host visible. No half-screen illustration, rotating feature panel, social-proof statistics, background motion, remote provider-logo fetch, or decorative security score.

Show the configured provider choices from the backend/runtime contract. In an SSO-only deployment, the provider action is the primary path and an unusable password form is absent. Where direct login is supported, keep username/password fields visible with persistent labels and correct autocomplete. The normal site and the opt-in local preview must remain visually distinguishable; a local preview notice must not claim to be an official deployed Quay UI.

Use one dominant submit action for the selected auth path. Provider names must be recognizable text, not unexplained icons. Password-manager fill and paste are allowed. Do not add a cognitive puzzle or a custom local MFA system. Preserve existing backend/IdP challenges, CAPTCHA, account completion, invitations, and recovery flows; report accessibility issues in those external flows rather than attempting to bypass them.

An inline error belongs next to its field, with an accessible relationship. Validate format on blur or submit, not with noisy error text on every keystroke. After a failed submission with multiple errors, focus a linked error summary while retaining each inline error. Do not disclose account existence beyond the backend's contract. Passwords and other secrets never enter persistence, URL state, logs, or telemetry. Nonsecret fields remain available after an ordinary validation error; clear secrets at identity boundaries and when the flow ends.

## 2. Fresh login is a continuation, not another sign-in page

For a backend step-up challenge, open a small PatternFly modal that explains the pending action and the exact required verification. Keep the original intent visible without exposing a credential or replaying it automatically. Cancel is always available and rejects the pending intent cleanly. After success, follow the existing architecture's reconciliation and explicit-resubmission rules for mutations.

A reauthentication modal is genuinely modal and traps focus appropriately; the artifact inspector is not. Finishing or cancelling returns focus to the relevant original action. Do not redirect away and lose a long access/settings form merely because a step-up flow was required.

Do not call remote logout as preview cleanup. Preserve the backend's real logout semantics and explain when they affect other sessions. A local disconnect does not falsely report token revocation or global logout.

## 3. Access as an understandable change

The Access page heading names the namespace or repository scope. Show people, teams, and robots in an aligned table with identity, role, grant source, and relevant actions. Direct and inherited permissions are visibly different. Do not imply that an inherited grant can be deleted locally or that a read-only account can grant a role.

Opening a grant/edit form does not replace the page with a large wizard for a simple task. Use a small form or scoped detail panel when there are few fields. A complicated bulk change may use explicit review. Default values are conservative and derived from the current contract; never preselect broad admin access for convenience.

Before applying a material permission change, show a plain-language summary such as: **Grant the release team write access to acme/payments**. Distinguish current state from proposed state. A successful toast does not replace refreshing the affected row from the authoritative backend. Partial or uncertain outcomes remain visible with individual results and safe next steps.

Disabled actions have an adjacent explanation or a focusable explanation affordance. A tooltip attached only to an unfocusable disabled button is not sufficient. Do not make the interface look writable merely because the account has permission when live-preview policy blocks the operation.

## 4. Settings and destructive actions

Group settings into General, Access-related defaults, Retention/immutability, Automation/notifications, and Danger where supported. Keep form sections visually simple: headings, helper text, fields, and a clear save action; no card nested inside a card for every setting.

Show unsaved nonsecret changes and handle navigation intentionally. Do not silently discard a long form on tab changes or claim a draft is saved on the backend when it only exists locally. Never persist secret fields to implement draft recovery.

Deletion, permanent expiration, and credential rotation explain scope, recoverability, and impact. Require the appropriate confirmation for irreversible actions, but do not add a confirmation modal to every harmless interaction. A confirmation remains open with its error on failure; a timeout is not shown as a successful deletion. Destructive selection and confirmation never rely on color alone.

Robot/token reveal is an explicit task, not a default column. Regeneration is separate from reveal. Do not auto-copy newly revealed credentials, leak them into screenshots, or imply that hiding a token invalidated it. Follow the existing backend response and one-time-display behavior exactly.

## 5. Acceptance additions

Test provider-only, direct-login, account-completion, invalid credentials, field errors, cancelled step-up, expired challenge, and remote logout failure. These cases use the real supported backend/provider environment where necessary; a fixture proves presentation only.

Test password-manager/paste compatibility, logical keyboard order, error-summary links, focus return, 320 px reflow, actual zoom, text spacing, dark mode, and forced colors. Test long team names, inherited grants, inaccessible actions with discoverable reasons, uncertain mutations, and secret-free diagnostics. Authentication parity and production authorization tests remain release gates.

Required tasks: QN-07 access/mutations, QN-08 authentication, QN-09 remaining settings, QN-10 quality gates. No new auth provider, token storage system, form framework, or animation dependency is introduced by this page contract.
