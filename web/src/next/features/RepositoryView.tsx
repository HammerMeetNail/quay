import React, {useEffect, useRef, useState} from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {
  Alert,
  Button,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  Form,
  FormGroup,
  TextInput,
} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {SearchIcon} from '@patternfly/react-icons';
import {useSession} from '../app/Session';
import {
  abbreviated,
  isDigest,
  parseRepositoryDetails,
  parseTags,
  parseEvidence,
  evidenceLabel,
  type Tag,
} from '../lib/domain';
import {pageNumber} from '../lib/operations';
import {descriptionText, platformHydrationDigests} from '../lib/presentation';
import {ArtifactDetails} from './ArtifactDetails';
import {
  Empty,
  Failure,
  LoadingRows,
  PageControls,
  useMedia,
} from '../components/Primitives';
import {
  DownloadSize,
  PlatformList,
  StateMark,
  UpdatedAt,
  VisibilityMark,
} from '../components/DataPresentation';
import {useManifestMetadata} from '../components/useManifestMetadata';
import {useWorkspaceWidth} from '../components/useWorkspaceWidth';

const EvidenceCell: React.FC<{ns: string; repo: string; tag: Tag}> = ({
  ns,
  repo,
  tag,
}) => {
  const {client} = useSession();
  const query = useQuery({
    queryKey: ['evidence', ns, repo, tag.digest],
    enabled: false,
    queryFn: ({signal}) =>
      client.get(
        {kind: 'security', namespace: ns, repository: repo, digest: tag.digest},
        parseEvidence,
        signal,
      ),
  });
  return (
    <span className="qn-evidence-text">
      {tag.index
        ? 'Per-platform reports'
        : query.isError
          ? 'Report unavailable'
          : evidenceLabel(query.data)}
    </span>
  );
};
const ActivePlatforms: React.FC<{ns: string; repo: string; digest: string}> = ({
  ns,
  repo,
  digest,
}) => {
  const metadata = useManifestMetadata(ns, repo, digest, true);
  return (
    <>
      <PlatformList
        manifest={metadata.data}
        index
        loading={metadata.isFetching}
        failed={metadata.isError}
      />
      {metadata.isError && !metadata.isFetching && (
        <Button variant="link" isInline onClick={() => void metadata.refetch()}>
          Retry platforms
        </Button>
      )}
    </>
  );
};
// Resolve only visible index rows (plus a short scroll-ahead margin). This does
// not download child manifests or scan reports. The queue and Query cache are shared.
const VisiblePlatforms: React.FC<{
  ns: string;
  repo: string;
  tag: Tag;
  enabled: boolean;
}> = ({ns, repo, tag, enabled}) => {
  const anchor = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = anchor.current;
    if (!node || !enabled || !tag.index) return;
    if (typeof IntersectionObserver === 'undefined') {
      // Conservative fallback: no eager page fan-out on an unsupported browser.
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((entry) => entry.isIntersecting));
      },
      {rootMargin: '160px 0px'},
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, tag.index]);
  // Unmount the observer offscreen: disabling it leaves queued requests alive.
  // Query owns cancellation, so other visible rows and the inspector keep a
  // shared digest request alive until its final observer leaves.
  return (
    <div ref={anchor} className="qn-platform-cell">
      {enabled && visible && tag.index && isDigest(tag.digest) ? (
        <ActivePlatforms ns={ns} repo={repo} digest={tag.digest} />
      ) : (
        <>
          <PlatformList index={tag.index} />
          {enabled &&
            tag.index &&
            isDigest(tag.digest) &&
            typeof IntersectionObserver === 'undefined' && (
              <Button variant="link" isInline onClick={() => setVisible(true)}>
                Load platforms
              </Button>
            )}
        </>
      )}
    </div>
  );
};
const TagRecord: React.FC<{
  ns: string;
  repo: string;
  tag: Tag;
  name: React.ReactNode;
  narrow: boolean;
  condensed: boolean;
  inspected: boolean;
  hydrate: boolean;
}> = ({ns, repo, tag, name, narrow, condensed, inspected, hydrate}) => {
  const identity = (
    <>
      <div className="qn-entity-line">
        {name}
        {tag.immutable === true && <span className="qn-state">Immutable</span>}
      </div>
      <code className="qn-secondary qn-digest-preview">
        {abbreviated(tag.digest)}
      </code>
    </>
  );
  const platforms = (
    <VisiblePlatforms ns={ns} repo={repo} tag={tag} enabled={hydrate} />
  );
  if (narrow)
    return (
      <li className={inspected ? 'qn-inspected' : ''}>
        {identity}
        <div className="qn-mobile-platforms">{platforms}</div>
        <dl className="qn-mobile-facts">
          <div>
            <dt>Image size</dt>
            <dd>
              <DownloadSize bytes={tag.size} index={tag.index} />
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>
              <EvidenceCell ns={ns} repo={repo} tag={tag} />
            </dd>
          </div>
        </dl>
        <p className="qn-secondary">
          Tag updated <UpdatedAt value={tag.modified} />
        </p>
      </li>
    );
  return (
    <Tr className={inspected ? 'qn-inspected' : ''}>
      <Td dataLabel="Tag / digest">{identity}</Td>
      <Td dataLabel="Platforms">{platforms}</Td>
      {!condensed && (
        <Td dataLabel="Image size">
          <DownloadSize bytes={tag.size} index={tag.index} />
        </Td>
      )}
      {!condensed && (
        <Td dataLabel="Tag updated">
          <UpdatedAt value={tag.modified} />
        </Td>
      )}
      <Td dataLabel="Evidence">
        <EvidenceCell ns={ns} repo={repo} tag={tag} />
      </Td>
    </Tr>
  );
};
export const RepositoryView: React.FC<{ns: string; repo: string}> = ({
  ns,
  repo,
}) => {
  const {client} = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = pageNumber(params.get('page'));
  const exact = params.get('tagSearch') ?? '';
  const [draft, setDraft] = useState(exact);
  const hash = params.get('artifact');
  const {ref: wrapper, inline} = useWorkspaceWidth(
    params.get('detail') === 'page',
  );
  const returnTo = useRef<{id: string; scroll: number} | null>(null);
  const tableHeading = useRef<HTMLHeadingElement>(null);
  const narrow = useMedia('(max-width: 48rem)');
  useEffect(() => setDraft(exact), [exact]);
  const details = useQuery({
    queryKey: ['repository', ns, repo],
    queryFn: ({signal}) =>
      client.get(
        {kind: 'repository', namespace: ns, repository: repo},
        parseRepositoryDetails,
        signal,
      ),
  });
  const tags = useQuery({
    queryKey: ['tags', ns, repo, page, exact],
    queryFn: ({signal}) =>
      client.get(
        {kind: 'tags', namespace: ns, repository: repo, page, exactTag: exact},
        parseTags,
        signal,
      ),
  });
  const selected = tags.data?.tags.find(
    (t) =>
      t.digest === hash && (!params.get('tag') || t.name === params.get('tag')),
  );
  const association = tags.data?.tags.find((t) => t.name === params.get('tag'));
  function inspect(
    event: React.MouseEvent<HTMLAnchorElement>,
    tag: Tag,
    index: number,
  ): void {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (!hash)
      returnTo.current = {id: `tag-link-${index}`, scroll: window.scrollY};
    const next = new URLSearchParams(params);
    next.set('artifact', tag.digest);
    next.set('tag', tag.name);
    next.delete('target');
    next.delete('detail');
    setParams(next, {replace: !!hash, state: location.state});
  }
  function changeCollection(change: (next: URLSearchParams) => void): void {
    const next = new URLSearchParams(params);
    change(next);
    ['artifact', 'tag', 'target', 'detail'].forEach((key) => next.delete(key));
    returnTo.current = null;
    setParams(next, {replace: !!hash, state: location.state});
    requestAnimationFrame(() => tableHeading.current?.focus());
  }
  function close(): void {
    if (returnTo.current) navigate(-1);
    else {
      // Preserve the landed direct-link/Forward focus recovery, without external-history navigation.
      returnTo.current = {id: 'tags-heading', scroll: window.scrollY};
      const next = new URLSearchParams(params);
      ['artifact', 'tag', 'target', 'detail'].forEach((key) =>
        next.delete(key),
      );
      setParams(next, {replace: true, state: location.state});
    }
  }
  useEffect(() => {
    if (hash || !returnTo.current) return;
    const restore = returnTo.current;
    returnTo.current = null;
    const frame = requestAnimationFrame(() => {
      (document.getElementById(restore.id) ?? tableHeading.current)?.focus();
      window.scrollTo({top: restore.scroll, behavior: 'instant'});
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  const link = (tag: Tag, index: number): React.ReactNode => {
    const q = new URLSearchParams(params);
    q.set('artifact', tag.digest);
    q.set('tag', tag.name);
    q.delete('target');
    return isDigest(tag.digest) ? (
      <Link
        id={`tag-link-${index}`}
        to={`${location.pathname}?${q}`}
        className="qn-entity"
        onClick={(event) => inspect(event, tag, index)}
        aria-current={
          hash === tag.digest && selected?.name === tag.name
            ? 'true'
            : undefined
        }
      >
        {tag.name}
      </Link>
    ) : (
      <span>{tag.name} · unsupported digest</span>
    );
  };
  const records = tags.data?.tags ?? [];
  const hydrationDigests = platformHydrationDigests(records);
  const hasIndexes = hydrationDigests.size > 0;
  const row = (tag: Tag, index: number): React.ReactNode => (
    <TagRecord
      key={`${tag.name}-${tag.digest}`}
      ns={ns}
      repo={repo}
      tag={tag}
      name={link(tag, index)}
      narrow={narrow}
      condensed={!!hash}
      inspected={hash === tag.digest && selected?.name === tag.name}
      hydrate={(!hash || isDigest(hash)) && hydrationDigests.has(tag.digest)}
    />
  );
  const content = (
    <section aria-labelledby="tags-heading" className="qn-repository-workspace">
      <div className="qn-heading">
        <div>
          <Link
            to={`/?namespace=${encodeURIComponent(ns)}`}
            className="qn-breadcrumb"
          >
            Repositories / {ns}
          </Link>
          <h1 id="tags-heading" ref={tableHeading} tabIndex={-1}>
            {repo}
          </h1>
          <p className="qn-description qn-clamp-two">
            {descriptionText(details.data?.description ?? '')}
          </p>
        </div>
        <div className="qn-inline-metadata">
          <VisibilityMark value={details.data?.visibility ?? 'Not reported'} />
          <span className="qn-secondary">{details.data?.access}</span>
        </div>
      </div>
      {details.isError && (
        <Failure error={details.error} retry={() => void details.refetch()} />
      )}
      {details.data && details.data.state !== 'NORMAL' && (
        <div className="qn-state-banner">
          <StateMark state={details.data.state} />
          <span className="qn-secondary">
            Repository writes are blocked in this preview.
          </span>
        </div>
      )}
      <div className="qn-tabs">
        <strong>Tags &amp; artifacts</strong>
        <span className="qn-secondary">
          Inspect a tag to copy an exact reference.
        </span>
      </div>
      <div className="qn-list-surface">
        <Form
          className="qn-toolbar qn-tag-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            changeCollection((p) => {
              draft ? p.set('tagSearch', draft) : p.delete('tagSearch');
              p.delete('page');
            });
          }}
        >
          <FormGroup fieldId="tag-search" className="qn-search-group">
            <label htmlFor="tag-search" className="qn-sr-only">
              Find an exact tag
            </label>
            <div className="qn-search-field">
              <SearchIcon aria-hidden="true" />
              <TextInput
                id="tag-search"
                value={draft}
                onChange={(_, value) => setDraft(value.slice(0, 128))}
                type="search"
                placeholder="Find an exact tag…"
              />
            </div>
          </FormGroup>
          <Button type="submit" variant="secondary">
            Find tag
          </Button>
          {exact && (
            <Button
              variant="link"
              onClick={() =>
                changeCollection((p) => {
                  p.delete('tagSearch');
                  p.delete('page');
                })
              }
            >
              Clear search
            </Button>
          )}
        </Form>
        {hasIndexes && (
          <p className="qn-metadata-toolbar qn-secondary">
            Actual platforms load for visible image indexes. Security reports
            stay on demand.
          </p>
        )}
        {tags.isLoading ? (
          <LoadingRows />
        ) : tags.isError ? (
          <Failure error={tags.error} retry={() => void tags.refetch()} />
        ) : !records.length ? (
          <Empty title={exact ? 'No matching tag' : 'No active tags'}>
            <p>
              {exact
                ? 'Exact-tag search is case-sensitive. Clear the search to browse active tags.'
                : 'Push an image with your normal container tooling, then refresh.'}
            </p>
          </Empty>
        ) : narrow ? (
          <ul className="qn-records" aria-label="Tags and artifacts">
            {records.map(row)}
          </ul>
        ) : (
          <Table
            role="table"
            aria-label="Tags and artifacts"
            variant="compact"
            className={`qn-table qn-tags-table ${hash ? 'qn-table--condensed' : ''}`}
          >
            <Thead>
              <Tr>
                <Th>Tag / digest</Th>
                <Th>Platforms</Th>
                {!hash && <Th>Image size</Th>}
                {!hash && <Th>Tag updated</Th>}
                <Th>Evidence</Th>
              </Tr>
            </Thead>
            <Tbody>{records.map(row)}</Tbody>
          </Table>
        )}
        <PageControls
          label={`Page ${page} · ${records.length} tags returned`}
          busy={tags.isFetching}
          canPrevious={page > 1}
          canNext={!!tags.data?.more}
          previous={() =>
            changeCollection((p) => p.set('page', String(page - 1)))
          }
          next={() => changeCollection((p) => p.set('page', String(page + 1)))}
        />
      </div>
    </section>
  );
  const validHash = hash && isDigest(hash) ? hash : null;
  const detail = validHash ? (
    <ArtifactDetails
      key={`${ns}/${repo}/${validHash}/${inline ? 'inline' : 'page'}`}
      ns={ns}
      repo={repo}
      hash={validHash}
      tag={selected}
      page={!inline}
      close={close}
    />
  ) : null;
  return (
    <div ref={wrapper} className="qn-workspace-measure">
      {hash && association && association.digest !== hash && (
        <Alert
          variant="warning"
          isInline
          title="This tag now points to a different digest"
        >
          You are still inspecting the exact digest in the URL, not the tag’s
          current target.
        </Alert>
      )}
      {hash && !validHash && (
        <Alert
          variant="warning"
          isInline
          title="Unsupported or invalid artifact digest"
        >
          <p>
            SHA-256 and SHA-512 are supported. This value will not be sent to
            the registry.
          </p>
          <Button onClick={close}>Back to tags</Button>
        </Alert>
      )}
      {detail && !inline ? (
        detail
      ) : (
        <Drawer isExpanded={!!detail} isInline>
          <DrawerContent
            panelContent={
              detail ? (
                <DrawerPanelContent defaultSize="24rem">
                  <aside aria-labelledby="artifact-heading">{detail}</aside>
                </DrawerPanelContent>
              ) : undefined
            }
          >
            <DrawerContentBody>{content}</DrawerContentBody>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};
