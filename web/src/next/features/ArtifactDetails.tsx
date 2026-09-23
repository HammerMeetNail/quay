import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import {
  Alert,
  Button,
  ExpandableSection,
  FormGroup,
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {useSession} from '../app/Session';
import {DownloadSize} from '../components/DataPresentation';
import {
  ContractError,
  dateLabel,
  evidenceLabel,
  immutableCommand,
  isDigest,
  parseEvidence,
  parseLabels,
  parseManifest,
  type Manifest,
  type Tag,
} from '../lib/domain';
import {
  Failure,
  LoadingRows,
  PageControls,
  useMedia,
} from '../components/Primitives';
const Security: React.FC<{
  ns: string;
  repo: string;
  hash: string;
}> = ({ns, repo, hash}) => {
  const {client, config} = useSession();
  const [requested, setRequested] = useState(false);
  const [page, setPage] = useState(0);
  const narrow = useMedia('(max-width: 48rem)');
  const query = useQuery({
    queryKey: ['evidence', ns, repo, hash],
    enabled: requested && config.scanner !== false,
    queryFn: ({signal}) =>
      client.get(
        {kind: 'security', namespace: ns, repository: repo, digest: hash},
        parseEvidence,
        signal,
      ),
  });
  const evidence = query.data;
  const findings = evidence?.kind === 'reported' ? evidence.findings : [];
  const shown = findings.slice(page * 25, (page + 1) * 25);
  return (
    <section className="qn-section" aria-labelledby="security-heading">
      <h3 id="security-heading">Security evidence</h3>
      {config.scanner === false ? (
        <p>Security scanning is disabled in this registry’s configuration.</p>
      ) : (
        <>
          <p>{evidenceLabel(evidence)}</p>
          <Button
            variant="secondary"
            isDisabled={query.isFetching}
            onClick={() => {
              setPage(0);
              if (requested) void query.refetch();
              else setRequested(true);
            }}
          >
            {query.isFetching
              ? 'Loading report…'
              : evidence
                ? 'Refresh report'
                : 'Load report for this digest'}
          </Button>
          {query.isError && <Failure error={query.error} />}
          {evidence && evidence.kind !== 'reported' && (
            <p>{evidence.description}</p>
          )}
          {evidence?.kind === 'reported' && (
            <>
              <p className="qn-secondary">
                Retrieved {dateLabel(evidence.retrievedAt)}. Scanner generation
                time is not supplied by this adapter. Findings apply only to the
                selected digest.
              </p>
              {shown.length > 0 &&
                (narrow ? (
                  <ul
                    className="qn-records"
                    aria-label="Vulnerability findings"
                  >
                    {shown.map((f, i) => (
                      <li key={i}>
                        <strong>{f.id}</strong>
                        <p>
                          {f.severity} · {f.package} {f.version}
                        </p>
                        <p>Fix: {f.fix ?? 'No fix reported'}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Table aria-label="Vulnerability findings" variant="compact">
                    <Thead>
                      <Tr>
                        <Th>Advisory</Th>
                        <Th>Severity</Th>
                        <Th>Package</Th>
                        <Th>Fix</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {shown.map((f, i) => (
                        <Tr key={`${f.id}-${f.package}-${i}`}>
                          <Td>
                            {f.url ? (
                              <a
                                href={f.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {f.id}
                              </a>
                            ) : (
                              f.id
                            )}
                          </Td>
                          <Td>{f.severity}</Td>
                          <Td>
                            {f.package}
                            <br />
                            {f.version}
                          </Td>
                          <Td>{f.fix ?? 'Not reported'}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                ))}
              {findings.length > 25 && (
                <PageControls
                  label={`${page * 25 + 1}–${Math.min(findings.length, (page + 1) * 25)} of ${findings.length} package findings`}
                  busy={false}
                  canPrevious={page > 0}
                  canNext={(page + 1) * 25 < findings.length}
                  previous={() => setPage((p) => p - 1)}
                  next={() => setPage((p) => p + 1)}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};
const Metadata: React.FC<{
  ns: string;
  repo: string;
  manifest: Manifest;
}> = ({ns, repo, manifest}) => {
  const {client} = useSession();
  const [expanded, setExpanded] = useState(false);
  const query = useQuery({
    queryKey: ['labels', ns, repo, manifest.digest],
    enabled: expanded,
    queryFn: ({signal}) =>
      client.get(
        {
          kind: 'labels',
          namespace: ns,
          repository: repo,
          digest: manifest.digest,
        },
        parseLabels,
        signal,
      ),
  });
  return (
    <ExpandableSection
      toggleText="Metadata and raw manifest"
      isExpanded={expanded}
      onToggle={(_, value) => setExpanded(value)}
    >
      {expanded && (
        <div className="qn-section">
          <h3>Labels</h3>
          {query.isError ? (
            <Failure error={query.error} />
          ) : query.isLoading ? (
            <p>Loading labels…</p>
          ) : query.data?.length ? (
            <dl className="qn-labels">
              {query.data.map((label, index) => (
                <React.Fragment key={index}>
                  <dt>{label.key}</dt>
                  <dd>{label.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          ) : (
            <p>No labels returned.</p>
          )}
          <h3>Raw manifest</h3>
          <pre
            className="qn-raw"
            role="region"
            aria-label="Raw manifest JSON"
            tabIndex={0}
          >
            <code>{manifest.raw}</code>
          </pre>
        </div>
      )}
    </ExpandableSection>
  );
};
export const ArtifactDetails: React.FC<{
  ns: string;
  repo: string;
  hash: string;
  tag?: Tag;
  page: boolean;
  close: () => void;
}> = ({ns, repo, hash, tag, page, close}) => {
  const {client, runtime} = useSession();
  const [params, setParams] = useSearchParams();
  const heading = useRef<HTMLHeadingElement>(null);
  const [tool, setTool] = useState<'podman' | 'docker'>('podman');
  const [copyResult, setCopyResult] = useState('');
  const [copyError, setCopyError] = useState(false);
  const copyGeneration = useRef(0);
  const query = useQuery({
    queryKey: ['manifest', ns, repo, hash],
    queryFn: async ({signal}) => {
      const result = await client.get(
        {kind: 'manifest', namespace: ns, repository: repo, digest: hash},
        parseManifest,
        signal,
      );
      if (result.digest !== hash)
        throw new ContractError(
          'The returned manifest digest does not match the selected artifact.',
        );
      return result;
    },
  });
  const manifest = query.data;
  const requestedTarget = params.get('target');
  const platform = manifest?.platforms.find(
    (p) => p.digest === requestedTarget,
  );
  const invalidTarget = !!requestedTarget && !platform;
  const target = platform?.digest ?? hash;
  const unavailable = tag?.presence[target] === false;
  const child = useQuery({
    queryKey: ['manifest', ns, repo, target],
    enabled: !!manifest && target !== hash && !unavailable && isDigest(target),
    queryFn: async ({signal}) => {
      const result = await client.get(
        {kind: 'manifest', namespace: ns, repository: repo, digest: target},
        parseManifest,
        signal,
      );
      if (result.digest !== target)
        throw new ContractError('The returned child digest does not match.');
      return result;
    },
  });
  const selectedManifest = target === hash ? manifest : child.data;
  const targetLabel =
    platform?.label ??
    (manifest?.index
      ? 'Index · automatic platform selection'
      : 'Selected image manifest');
  let command = '';
  try {
    command = immutableCommand(runtime.registryHost, ns, repo, target, tool);
  } catch {
    /* Unsupported digest remains visible but cannot be copied as a valid command. */
  }
  const canCopy =
    !!command && !!selectedManifest && !invalidTarget && !unavailable;
  useEffect(() => {
    heading.current?.focus();
  }, [hash, page]);
  useLayoutEffect(() => {
    setCopyResult('');
    setCopyError(false);
    // Clipboard writes cannot be cancelled; revoke ownership on selection changes and unmount.
    return () => {
      copyGeneration.current += 1;
    };
  }, [command, hash, requestedTarget, canCopy, targetLabel]);
  async function copy(): Promise<void> {
    if (!canCopy) return;
    const generation = ++copyGeneration.current;
    try {
      await navigator.clipboard.writeText(command);
      if (generation !== copyGeneration.current) return;
      setCopyError(false);
      setCopyResult(`Copied the immutable pull command for ${targetLabel}.`);
    } catch {
      if (generation !== copyGeneration.current) return;
      setCopyError(true);
      setCopyResult(
        'Clipboard access failed. Select and copy the complete command shown above.',
      );
    }
  }
  const Heading = page ? 'h1' : 'h2';
  return (
    <div
      className="qn-inspector"
      onKeyDown={(event) => {
        if (
          event.key === 'Escape' &&
          !event.defaultPrevented &&
          event.target === heading.current
        ) {
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="qn-inspector-header">
        <Heading ref={heading} tabIndex={-1} id="artifact-heading">
          Artifact details{tag ? `: ${tag.name}` : ''}
        </Heading>
        <Button variant="link" onClick={close}>
          {page ? 'Back to tags' : 'Close inspector'}
        </Button>
      </div>
      <p className="qn-secondary">
        {ns}/{repo}
      </p>
      <code className="qn-full-value" data-testid="artifact-full-digest">
        {hash}
      </code>
      {!page && (
        <Button
          component="a"
          variant="link"
          isInline
          href={`?${(() => {
            const q = new URLSearchParams(params);
            q.set('detail', 'page');
            return q.toString();
          })()}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open full page
        </Button>
      )}
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        manifest && (
          <>
            <p className="qn-secondary">{manifest.mediaType}</p>
            <section className="qn-section" aria-labelledby="pull-heading">
              <h3 id="pull-heading">Pull target</h3>
              {manifest.index && (
                <FormGroup label="Index or platform" fieldId="pull-target">
                  <FormSelect
                    id="pull-target"
                    value={requestedTarget ?? ''}
                    onChange={(_, value) =>
                      setParams(
                        (p) => {
                          value ? p.set('target', value) : p.delete('target');
                          return p;
                        },
                        {replace: true},
                      )
                    }
                  >
                    <FormSelectOption
                      value=""
                      label="Index · automatic platform selection"
                    />
                    {manifest.platforms.map((p) => (
                      <FormSelectOption
                        key={p.digest}
                        value={p.digest}
                        label={`${p.label}${tag?.presence[p.digest] === false ? ' · child unavailable' : ''}`}
                      />
                    ))}
                  </FormSelect>
                </FormGroup>
              )}
              {invalidTarget && (
                <Alert
                  variant="warning"
                  isInline
                  title="The requested platform is not part of this index. Select a valid pull target."
                />
              )}
              {unavailable && (
                <Alert
                  variant="warning"
                  isInline
                  title="This child is advertised but its content is not available here."
                />
              )}
              {target !== hash && child.isError && (
                <Failure error={child.error} />
              )}
              <FormGroup label="Container tool" fieldId="container-tool">
                <FormSelect
                  id="container-tool"
                  value={tool}
                  onChange={(_, value) => {
                    if (value === 'podman' || value === 'docker')
                      setTool(value);
                  }}
                >
                  <FormSelectOption value="podman" label="Podman" />
                  <FormSelectOption value="docker" label="Docker" />
                </FormSelect>
              </FormGroup>
              <div className="qn-command">
                <p>{targetLabel}</p>
                <code
                  className="qn-full-value"
                  data-testid="artifact-immutable-command"
                >
                  {command || 'Unsupported digest algorithm'}
                </code>
                <Button
                  variant="primary"
                  onClick={() => void copy()}
                  isDisabled={!canCopy}
                >
                  Copy immutable pull command
                </Button>
              </div>
              <p
                role={copyError ? 'alert' : 'status'}
                aria-live="polite"
                className={copyError ? 'qn-copy-error' : 'qn-secondary'}
              >
                {copyResult}
              </p>
              <div className="qn-artifact-size">
                <DownloadSize
                  index={selectedManifest?.index === true}
                  bytes={
                    selectedManifest?.compressedBytes ??
                    (target === hash ? (tag?.size ?? null) : null)
                  }
                />
              </div>
            </section>
            {manifest.index && (
              <section className="qn-section">
                <h3>Advertised platforms</h3>
                <ul className="qn-platforms">
                  {manifest.platforms.map((p) => (
                    <li key={p.digest}>
                      <span>{p.label}</span>
                      <span className="qn-secondary">
                        {tag?.presence[p.digest] === false
                          ? 'Child unavailable'
                          : tag?.presence[p.digest] === true
                            ? 'Content available'
                            : 'Availability not reported'}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="qn-secondary">
                  Reports are loaded one platform at a time. A report for one
                  child does not establish coverage for the whole index.
                </p>
              </section>
            )}
            {selectedManifest &&
            !selectedManifest.index &&
            !invalidTarget &&
            !unavailable ? (
              <Security key={target} ns={ns} repo={repo} hash={target} />
            ) : (
              <section className="qn-section">
                <h3>Security evidence</h3>
                <p>
                  {manifest.index
                    ? 'Select an available platform to inspect its report. No index-wide safety verdict is inferred.'
                    : 'A valid, available manifest is required.'}
                </p>
              </section>
            )}
            {tag?.signature && (
              <p>
                Signature artifact present. Cryptographic verification is not
                available in this preview.
              </p>
            )}
            {tag && (
              <p className="qn-secondary">
                Tag updated: {dateLabel(tag.modified)} · Immutable:{' '}
                {tag.immutable === null
                  ? 'not reported'
                  : tag.immutable
                    ? 'yes'
                    : 'no'}
              </p>
            )}
            <Metadata
              ns={ns}
              repo={repo}
              manifest={selectedManifest ?? manifest}
            />
          </>
        )
      )}
    </div>
  );
};
