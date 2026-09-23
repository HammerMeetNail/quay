# Page contract: repository and artifact inspection

Read [MASTER.md](../MASTER.md) first. This page replaces the original README's tags/inspector wireframes and the modal-inspector assumption in the earlier illustrative E2E test. Existing APIs, auth, immutable identities, and evidence rules remain authoritative.

## 1. The composition

Synthetic example, not actual quay.io data. The abbreviated hashes below must never be used as API identifiers or copied pull references.

```text
acme / payments                          Private · Write access    Manage repository
Payment processing service

Tags & artifacts       Activity       Automation
[Find tag…                                        ]    Filter this page    Display

TAG           DIGEST             PLATFORMS       UPDATED       EVIDENCE
v2.8.1        sha256:ab31…7d02    2 advertised    12 min        Not loaded
stable        sha256:ab31…7d02    2 advertised    12 min        Not loaded
v2.8.0        sha256:42c0…65ef    2 advertised    Yesterday     Not loaded

Page 1 · 25 tags loaded                                             Previous  Next
```

Do not show a large pull-command box before a user selects an artifact. It pushes the work below the fold and suggests a default that may not be appropriate. A quiet helper says **Select a tag to inspect or copy its exact reference**. Once selected, the command belongs next to the artifact and platform that determine it, inside the inspector.

Manage repository contains permitted Access and Settings destinations. Rare destructive commands belong within their appropriate settings or explicit artifact action flow, not beside the primary Copy action. Deep links to the existing proposed `view=access` and `view=settings` destinations continue to work.

## 2. Table density and field priority

The standard wide table exposes Tag, Digest, Platforms, Tag updated, Evidence, and contextual actions. Size is available as an additional column when its measurement is defined and the width allows it; the inspector always exposes available size semantics. The UI does not trade readable identity/evidence for a permanently cramped size column.

When an inline inspector narrows the table, combine tag and abbreviated digest into one identity cell and move lower-priority modified/size details into the inspector or an accessible row expansion. Platform and evidence remain understandable. On a narrow page, show labeled records rather than a squashed six-column table. Do not change table display rules in a way that removes its accessibility semantics without supplying an equivalent semantic record view.

The tag is a real link to the selected detail URL, so modifier-click and open-in-new-tab work. A router can present that URL as the inline inspector where space permits. An additional labeled Inspect button is acceptable when needed for clear disclosure behavior, but must not replace the real detail link. An empty area of the row is not the only action target.

A row's inspected state and its bulk-action checkbox are independent. Inspecting never silently adds the artifact to a destructive selection. Use repository + tag + observed full digest as the selection identity. If a tag moves, mark the association changed and retain the exact digest being inspected until the user deliberately follows the new target.

Tag search uses only the verified backend contract. Platform/scan filters are not global defaults: without server support, they are explicitly **Filter this page**, consider only already available data, and distinguish unknown evidence from matching/nonmatching known evidence. They must not trigger an unbounded scan fan-out. A disabled local filter explains missing data rather than inventing complete coverage.

## 3. Inspector hierarchy: no second row of tabs

```text
Artifact details: v2.8.1                    Open full page   Close
OCI image index
sha256:<complete digest, wrapping naturally>

Pull target
[Index · automatic platform selection ▾]
[podman pull quay.io/acme/payments@sha256:<complete digest>]
[Copy immutable pull command]

Platforms
linux/amd64    Available
linux/arm64    Child content unavailable

Security evidence
Partial coverage · 1 of 2 advertised platforms has a report
[Inspect linux/amd64 report]

Metadata ▸
Related artifacts ▸
History and tag association ▸
```

The inspector uses a named complementary region and PatternFly inline Drawer. It has no scrim and does not trap focus. Below the 72 rem usable workspace threshold, this content becomes the main detail page with Back to tags. The canonical artifact route always provides the full-page version. On small screens, do not add a fixed bottom Copy bar that hides text, focused controls, or errors.

Keep identity, media type, pull target, immutable command, and concise evidence coverage visible first. Platforms and report actions follow. Metadata, labels, annotations, layers, model card, history, and related artifacts use progressive disclosure. Do not nest another four-tab application inside the repository's tabs. Large vulnerability reports can open a full-page section anchored to the same digest/platform.

Use native headings and PatternFly disclosure components. A collapsed metadata section must not keep interactive descendants focusable. The same section must not be mounted once in a drawer and again in an invisible mobile page. Do not fetch a section simply because its tab/disclosure label was rendered.

## 4. Exact command behavior

The default selected pull target for an index is explicitly **Index · automatic platform selection**. Selecting a child changes the digest and labels the chosen OS/architecture/variant. Show availability separately; an advertised but unavailable sparse child is not a valid promise that the image can be pulled from this backend.

Copy immutable pull command is the inspector's primary action. Podman/Docker tool choice is a small secondary preference. A tag-based reference remains an explicitly labeled alternative: **Mutable tag reference**. Do not secretly switch between immutable and mutable references for visual brevity. Copied values contain the complete validated digest/reference, never ellipses, prompt symbols, comments, credentials, or a newline.

A successful copy announces what was copied and for which selected target. Clipboard failure shows a selectable full command and a persistent explanation. The reference remains text, not a shell execution feature. Continue using the architecture's validation and safe command builder, including supported digest algorithms and nested repository names.

## 5. Evidence that can be understood at a glance

Do not turn every data value into a colored pill. Platform names can be plain text; visibility can be a compact label; scan state needs a concise phrase with the relevant semantic icon. Reserve severity treatment for findings. Missing data is plain text, not an unexplained dash, disabled control, zero, or success color.

Show **Not loaded** until requested, **Scanning** for a real in-progress state, **Report unavailable** for an actual retrieval/scanner failure, and a precise unsupported explanation when applicable. A successfully retrieved zero-finding report says **No vulnerabilities reported**. A summary with one covered platform out of two states that coverage even if the covered platform has zero reported findings.

Two tags pointing to one digest share the same cached report. A row may note the shared digest, but **Same digest** is not itself a security verdict. Never replace the actual evidence state with that phrase. Scanner time and report retrieval time remain distinct. Signature presence, cryptographic verification, and scan findings stay separate fields.

Collections of platforms or related artifact types wrap or expose an operable `+n more` disclosure. Do not truncate an essential label to an unexplained fragment or supply its full value only on mouse hover.

## 6. React/PatternFly implementation seed: resilient identity

This is a presentation component, not a replacement for the API parser, trusted reference builder, copy-status handler, or permission checks. It uses the existing React/PatternFly stack and must be compiled in the actual web workspace. `immutableCommand` must already be produced by the validated command builder.

```tsx
import React, {useId} from 'react';
import {Button} from '@patternfly/react-core';
import styles from './ArtifactIdentity.module.css';

interface ArtifactIdentityProps {
  digest: string;
  targetLabel: string;
  immutableCommand: string;
  onCopy: (value: string, targetLabel: string) => void;
}

export const ArtifactIdentity: React.FC<ArtifactIdentityProps> = ({
  digest, targetLabel, immutableCommand, onCopy,
}) => {
  const commandId = useId();
  const targetId = useId();
  return (
    <section aria-label="Artifact identity" className={styles.identity}>
      <h3>Digest</h3>
      <code className={styles.identifier} data-testid="artifact-full-digest">
        {digest}
      </code>
      <p id={targetId}>{targetLabel}</p>
      <div className={styles.command}>
        <code id={commandId} className={styles.identifier}
          data-testid="artifact-immutable-command">
          {immutableCommand}
        </code>
        <Button type="button" variant="primary"
          aria-describedby={targetId}
          onClick={() => onCopy(immutableCommand, targetLabel)}
          data-testid="artifact-copy-immutable">
          Copy immutable pull command
        </Button>
      </div>
    </section>
  );
};
```

```css
/* Scope these rules to application-owned wrappers, not internal PF selectors. */
.identity,
.command {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--quay-space-md, 1rem);
  min-inline-size: 0;
}
.identifier {
  display: block;
  min-inline-size: 0;
  max-inline-size: 100%;
  overflow-wrap: anywhere;
  white-space: normal;
  unicode-bidi: plaintext;
}
```

The inspector parent supplies the correctly leveled h2 and landmark; adjust heading level when reusing the component in a different hierarchy. Use a single application copy-result status announcer, not one competing live region per table row. Do not use CSS ellipsis on the full inspector digest or command. Unexpected bidi/control characters must also be handled by the domain validator; this CSS is not a security sanitizer.

## 7. Acceptance additions

Verify inline landmark semantics and absence of `aria-modal`/focus trapping; narrow detail is a page, not an unannounced overlay. Verify focus returns to the originating row or a stable fallback after close/filter changes. Open an artifact, change the inspected row rapidly, resize through the threshold, and confirm the final digest, command, focus, and URL still agree.

Verify full-value copying and keyboard/touch access with a long nested repository name, SHA-256 and SHA-512 digests, a long platform variant, localized labels, missing data, and a sparse index. Test actual browser zoom and text spacing, not only screenshots at one width. Verify no platform/scan control implies a globally complete result when only one page is known.

The earlier `getByRole('dialog', {name: /artifact details/i})` example must be replaced with an assertion for the named complementary region in inline mode and the main detail heading in page mode. Real destructive confirmations remain modal and keep their dialog assertions.
