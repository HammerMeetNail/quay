import React, {useEffect, useRef, useState} from 'react';
import {Alert, Button, ExpandableSection, FormSelect, FormSelectOption} from '@patternfly/react-core';
import {Link, useLocation, useSearchParams} from 'react-router-dom';
import {useRead, useSession} from './data';
import {ContractError, immutableCommand, manifestPath, parseManifest, parseLabels, parseScan, supportedDigest, type Tag} from './model';
import {CopyCommand, RequestState} from './Shared';

interface Props {ns: string; repo: string; digest: string; tag: Tag | undefined; tagName: string; inline: boolean; close: () => void;}
export const Inspector: React.FC<Props> = ({ns, repo, digest, tag, tagName, inline, close}) => {
  const {runtime, features} = useSession();
  const location = useLocation();
  const heading = useRef<HTMLHeadingElement>(null);
  const [query, setQuery] = useSearchParams();
  const requestedTarget = query.get('target') ?? digest;
  const target = supportedDigest(requestedTarget) ? requestedTarget : digest;
  const [tool, setTool] = useState<'podman' | 'docker'>('podman');
  const [metadata, setMetadata] = useState(false);
  const [requestedScan, setRequestedScan] = useState<string | null>(null);
  const scanRequested = requestedScan === target;
  const [findingLimit, setFindingLimit] = useState(25);
  const path = manifestPath(ns, repo, digest);
  const manifest = useRead(path, value => {const parsed = parseManifest(value); if (parsed.digest !== digest) throw new ContractError('The returned manifest digest does not match the selection.'); return parsed;});
  const labels = useRead(`${path}/labels`, parseLabels, metadata);
  const targetMissing = tag?.presence[target] === false;
  const targetValid = supportedDigest(requestedTarget) && Boolean(manifest.data && (target === digest || manifest.data.platforms.some(p => p.digest === target)));
  const isIndexTarget = manifest.data?.index && target === digest;
  const scannerEnabled = features.SECURITY_SCANNER !== false;
  const canScan = manifest.isSuccess && targetValid && !isIndexTarget && !targetMissing && scannerEnabled;
  const scan = useRead(`${manifestPath(ns, repo, target)}/security?vulnerabilities=true`, parseScan, scanRequested && canScan, 16 * 1024 * 1024);
  const targetLabel = target === digest ? (manifest.data?.index ? 'Index · automatic platform selection' : tagName || 'Selected manifest') : manifest.data?.platforms.find(p => p.digest === target)?.label || 'Selected child manifest';
  const command = immutableCommand(runtime.registry, ns, repo, target, tool);
  const full = new URLSearchParams(location.search); full.set('full', '1');
  useEffect(() => {heading.current?.focus();}, [digest, inline]);
  const changeTarget = (next: string): void => {const params = new URLSearchParams(query); next === digest ? params.delete('target') : params.set('target', next); setQuery(params, {replace: true, state: location.state}); setRequestedScan(null); setFindingLimit(25);};
  const content = <>
    <div className="qn-detail-heading">
      <h2 ref={heading} tabIndex={-1} id="qn-artifact-heading">Artifact details{tagName ? `: ${tagName}` : ''}</h2>
      <Button variant="secondary" onClick={close}>{inline ? 'Close inspector' : 'Back to tags'}</Button>
    </div>
    {inline && <Link to={`${location.pathname}?${full}`} state={location.state} replace>Open full page</Link>}
    <code className="qn-identifier" data-testid="artifact-full-digest">{digest}</code>
    {!tag && tagName && <p className="qn-muted">Tag association has not been verified on the currently loaded page. The digest is the authoritative selection.</p>}
    {tag && tag.digest !== digest && <Alert isInline variant="warning" title="This tag now points to another digest. You are inspecting the original immutable artifact." />}
    <RequestState loading={manifest.isLoading} error={manifest.error} retry={() => void manifest.refetch()} />
    {manifest.data && <>
      <p className="qn-muted">{manifest.data.index ? 'Image index' : 'Manifest'} · {manifest.data.mediaType}</p>
      <label htmlFor="qn-pull-target">Pull target</label>
      <FormSelect id="qn-pull-target" value={target} onChange={(_event, value) => changeTarget(value)} aria-label="Pull target">
        <FormSelectOption value={digest} label={manifest.data.index ? 'Index · automatic platform selection' : 'Selected manifest'} />
        {manifest.data.platforms.map((p, i) => <FormSelectOption key={`${p.digest}:${i}`} value={p.digest} label={`${p.label}${tag?.presence[p.digest] === false ? ' · child unavailable' : ''}`} isDisabled={!supportedDigest(p.digest) || tag?.presence[p.digest] === false} />)}
      </FormSelect>
      <label htmlFor="qn-pull-tool">Command tool</label>
      <FormSelect id="qn-pull-tool" value={tool} onChange={(_event, value) => setTool(value === 'docker' ? 'docker' : 'podman')}>
        <FormSelectOption value="podman" label="Podman" /><FormSelectOption value="docker" label="Docker" />
      </FormSelect>
      {!targetValid ? <Alert isInline variant="warning" title="The requested pull target is not a supported child of this artifact. Select a valid target." /> : targetMissing ? <Alert isInline variant="warning" title="The selected child content is unavailable." /> : <CopyCommand command={command} target={targetLabel} />}
      {manifest.data.index && <section aria-label="Platforms"><h3>Advertised platforms</h3><ul className="qn-platforms">
        {manifest.data.platforms.map((p, i) => <li key={`${p.digest}:${i}`}><span>{p.label}</span><span className="qn-muted">{tag?.presence[p.digest] === false ? 'Child content unavailable' : tag?.presence[p.digest] === true ? 'Available' : 'Availability not reported'}</span></li>)}
      </ul><p className="qn-muted">Selecting a child pins the command to that child digest. No all-platform scan result is implied.</p></section>}
      <section aria-label="Security evidence"><h3>Security evidence</h3>
        {!scannerEnabled ? <p>Scanning is disabled for this deployment.</p> : isIndexTarget ? <p>Select an available child platform to request its report. Index-wide coverage has not been established.</p> : <>
          {!scanRequested && <p>Not loaded. Reports are fetched only when requested.</p>}
          <Button variant="secondary" onClick={() => {if (scanRequested) void scan.refetch(); else setRequestedScan(target);}} isDisabled={!canScan || scan.isFetching}>{scan.isFetching ? 'Loading report…' : scanRequested ? 'Refresh report' : 'Load scan report'}</Button>
          {scanRequested && <RequestState loading={scan.isLoading} error={scan.error} retry={() => void scan.refetch()} />}
          {scanRequested && scan.data && <div><p role="status">{scan.data.message}</p>
            <p className="qn-muted">Report retrieved {new Date(scan.dataUpdatedAt).toLocaleString()}. Scanner generation time is not supplied by this contract.</p>
            <ul className="qn-findings">{scan.data.findings.slice(0, findingLimit).map(f => <li key={JSON.stringify([f.package, f.version, f.advisory])}>
              <strong>{f.severity} · {f.advisory}</strong><span>{f.package} {f.version}</span><span>Fixed version: {f.fix}</span>
              {f.link && <span className="qn-identifier">Advisory URL: {f.link} (external navigation is disabled in live preview)</span>}
            </li>)}</ul>
            {scan.data.findings.length > findingLimit && <Button variant="link" onClick={() => setFindingLimit(n => n + 25)}>Show 25 more findings</Button>}
          </div>}
        </>}
      </section>
      {tag?.signaturePresent && <p>Signature artifact present. Cryptographic verification is not available in this preview.</p>}
      <ExpandableSection toggleText="Metadata and labels" isExpanded={metadata} onToggle={(_event, expanded) => setMetadata(expanded)}>
        {metadata && <div className="qn-stack">
          <p>Compressed layer size: {manifest.data.compressedBytes === null || manifest.data.index ? 'Not reported for this manifest/index' : `${manifest.data.compressedBytes.toLocaleString()} bytes`}</p>
          <p>Tag immutability: {tag?.immutable === true ? 'Enabled' : tag?.immutable === false ? 'Disabled' : 'Not reported'}</p>
          <RequestState loading={labels.isLoading} error={labels.error} retry={() => void labels.refetch()} />
          <dl>{labels.data?.map((label, i) => <React.Fragment key={i}><dt>{label.key}</dt><dd>{label.value}</dd></React.Fragment>)}</dl>
          {labels.isSuccess && labels.data.length === 0 && <p>No labels reported.</p>}
          <details><summary>Raw manifest JSON</summary><pre className="qn-raw" tabIndex={0} aria-label="Raw manifest JSON">{manifest.data.raw}</pre></details>
        </div>}
      </ExpandableSection>
    </>}
  </>;
  const escape = (event: React.KeyboardEvent): void => {
    // Do not steal Escape from menus, selects, or child interactions.
    if (event.key === 'Escape' && !event.defaultPrevented && event.target === heading.current) {event.preventDefault(); close();}
  };
  return inline ? <aside className="qn-inspector" aria-label="Artifact details" onKeyDown={escape}>{content}</aside> : <section className="qn-inspector qn-detail-page" aria-labelledby="qn-artifact-heading">{content}</section>;
};
