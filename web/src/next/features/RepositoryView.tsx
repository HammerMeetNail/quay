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
  Label,
} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {useSession} from '../app/Session';
import {
  abbreviated,
  dateLabel,
  isDigest,
  parseRepositoryDetails,
  parseTags,
  parseEvidence,
  evidenceLabel,
  type Tag,
} from '../lib/domain';
import {pageNumber, shouldUseInspector} from '../lib/operations';
import {ArtifactDetails} from './ArtifactDetails';
import {
  Empty,
  Failure,
  LoadingRows,
  PageControls,
  useMedia,
} from '../components/Primitives';
const EvidenceCell: React.FC<{
  ns: string;
  repo: string;
  tag: Tag;
}> = ({ns, repo, tag}) => {
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
    <span>{tag.index ? 'Select a platform' : evidenceLabel(query.data)}</span>
  );
};
export const RepositoryView: React.FC<{
  ns: string;
  repo: string;
}> = ({ns, repo}) => {
  const {client} = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = pageNumber(params.get('page'));
  const exact = params.get('tagSearch') ?? '';
  const [draft, setDraft] = useState(exact);
  const hash = params.get('artifact');
  const [width, setWidth] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const returnTo = useRef<{
    id: string;
    scroll: number;
  } | null>(null);
  const tableHeading = useRef<HTMLHeadingElement>(null);
  const narrow = useMedia('(max-width: 48rem)');
  useEffect(() => setDraft(exact), [exact]);
  useEffect(() => {
    if (!wrapper.current) return;
    const node = wrapper.current;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const inline = shouldUseInspector(
    width,
    parseFloat(getComputedStyle(document.documentElement).fontSize),
    params.get('detail') === 'page',
  );
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
    setParams(next, {replace: !!hash});
  }
  function changeCollection(change: (next: URLSearchParams) => void): void {
    const next = new URLSearchParams(params);
    change(next);
    ['artifact', 'tag', 'target', 'detail'].forEach((key) => next.delete(key));
    returnTo.current = null;
    setParams(next, {replace: !!hash});
    requestAnimationFrame(() => tableHeading.current?.focus());
  }
  function close(): void {
    if (returnTo.current) navigate(-1);
    else {
      // Forward and direct links have no saved opener. Restore focus to
      // the collection after the detail controls have been removed.
      returnTo.current = {id: 'tags-heading', scroll: window.scrollY};
      setParams(
        (p) => {
          ['artifact', 'tag', 'target', 'detail'].forEach((key) =>
            p.delete(key),
          );
          return p;
        },
        {replace: true},
      );
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
        onClick={(e) => inspect(e, tag, index)}
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
  const content = (
    <section aria-labelledby="tags-heading">
      <div className="qn-heading">
        <div>
          <Link to={`/?namespace=${encodeURIComponent(ns)}`}>
            Repositories / {ns}
          </Link>
          <h1 id="tags-heading" ref={tableHeading} tabIndex={-1}>
            {repo}
          </h1>
          <p className="qn-description">{details.data?.description}</p>
        </div>
        <div className="qn-actions">
          <Label>{details.data?.visibility ?? 'Visibility loading'}</Label>
          <span>{details.data?.access}</span>
        </div>
      </div>
      {details.isError && (
        <Failure error={details.error} retry={() => void details.refetch()} />
      )}
      {details.data && details.data.state !== 'NORMAL' && (
        <Alert
          isInline
          variant="info"
          title={`Repository state: ${details.data.state}`}
        >
          This preview does not issue repository mutations.
        </Alert>
      )}
      <div className="qn-tabs">
        <strong>Tags &amp; artifacts</strong>
        <span className="qn-secondary">
          Select a tag to inspect its exact reference.
        </span>
      </div>
      <Form
        className="qn-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          changeCollection((p) => {
            draft ? p.set('tagSearch', draft) : p.delete('tagSearch');
            p.delete('page');
          });
        }}
      >
        <FormGroup label="Find an exact tag" fieldId="tag-search">
          <TextInput
            id="tag-search"
            value={draft}
            onChange={(_, value) => setDraft(value)}
            type="search"
            placeholder="For example, v2.8.1"
          />
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
      {tags.isLoading ? (
        <LoadingRows />
      ) : tags.isError ? (
        <Failure error={tags.error} retry={() => void tags.refetch()} />
      ) : !tags.data?.tags.length ? (
        <Empty title={exact ? 'No matching tag' : 'No active tags'}>
          <p>
            {exact
              ? 'Exact-tag search is case-sensitive. Clear the search to browse active tags.'
              : 'Push an image using your normal container tooling, then refresh.'}
          </p>
        </Empty>
      ) : narrow ? (
        <ul className="qn-records" aria-label="Tags and artifacts">
          {tags.data.tags.map((tag, i) => (
            <li key={`${tag.name}-${tag.digest}`}>
              {link(tag, i)}
              <code>{abbreviated(tag.digest)}</code>
              <dl>
                <dt>Artifact</dt>
                <dd>{tag.index ? 'Multi-platform index' : 'Manifest'}</dd>
                <dt>Tag updated</dt>
                <dd>{dateLabel(tag.modified)}</dd>
                <dt>Evidence</dt>
                <dd>
                  <EvidenceCell ns={ns} repo={repo} tag={tag} />
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <Table role="table" aria-label="Tags and artifacts" variant="compact">
          <Thead>
            <Tr>
              <Th>Tag / digest</Th>
              <Th>Artifact</Th>
              {!hash && <Th>Tag updated</Th>}
              <Th>Evidence</Th>
            </Tr>
          </Thead>
          <Tbody>
            {tags.data.tags.map((tag, i) => (
              <Tr
                key={`${tag.name}-${tag.digest}`}
                className={hash === tag.digest ? 'qn-inspected' : ''}
              >
                <Td dataLabel="Tag / digest">
                  {link(tag, i)}
                  <code className="qn-secondary qn-full-value">
                    {abbreviated(tag.digest)}
                  </code>
                </Td>
                <Td dataLabel="Artifact">
                  {tag.index ? 'Multi-platform index' : 'Manifest'}
                </Td>
                {!hash && (
                  <Td dataLabel="Tag updated">{dateLabel(tag.modified)}</Td>
                )}
                <Td dataLabel="Evidence">
                  <EvidenceCell ns={ns} repo={repo} tag={tag} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <PageControls
        label={`Page ${page} · ${tags.data?.tags.length ?? 0} tags returned`}
        busy={tags.isFetching}
        canPrevious={page > 1}
        canNext={!!tags.data?.more}
        previous={() =>
          changeCollection((p) => {
            p.set('page', String(page - 1));
          })
        }
        next={() =>
          changeCollection((p) => {
            p.set('page', String(page + 1));
          })
        }
      />
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
      {hash && !validHash ? (
        <Alert
          variant="warning"
          isInline
          title="Unsupported or invalid artifact digest"
        >
          <p>
            SHA-256 and SHA-512 are supported. The value will not be sent to the
            registry.
          </p>
          <Button onClick={close}>Back to tags</Button>
        </Alert>
      ) : null}
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
