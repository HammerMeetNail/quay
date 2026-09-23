import React, {useEffect, useRef, useState} from 'react';
import {Alert, Button, Drawer, DrawerContent, DrawerContentBody, DrawerPanelContent, Label, TextInput} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {Link, useLocation, useNavigate, useParams, useSearchParams} from 'react-router-dom';
import {useRead, useSession} from './data';
import {ContractError, digest as validateDigest, exactTag, formatDate, inspectorMode, namespace, pageNumber, parseRepository, parseTags, repoPath, repository, supportedDigest, tagsPath, type Tag} from './model';
import {Inspector} from './Inspector';
import {RequestState, useNarrow, useWorkspace} from './Shared';

const inspectionSession = crypto.randomUUID();
interface ReturnPoint {session: string; url: string; tag: string; scroll: number;}
function readReturnPoint(value: unknown): ReturnPoint | null {
  if (!value || typeof value !== 'object' || !('inspection' in value)) return null;
  const p = value.inspection;
  if (!p || typeof p !== 'object' || !('session' in p) || p.session !== inspectionSession || !('url' in p) || typeof p.url !== 'string' || !p.url.startsWith('/') || p.url.startsWith('//') || !('tag' in p) || typeof p.tag !== 'string' || !('scroll' in p) || typeof p.scroll !== 'number') return null;
  return p as ReturnPoint;
}
export const RepositoryPage: React.FC = () => {
  const params = useParams(); const {runtime} = useSession();
  const ns = namespace(params.namespace ?? ''); const repo = repository(params['*'] ?? '');
  if (!runtime.repositories.includes(`${ns}/${repo}`)) return <Alert isInline variant="warning" title="This repository is outside the launcher-approved preview scope. Add it to QUAY_NEXT_REPOSITORIES and restart the launcher." />;
  return <Repository key={`${ns}/${repo}`} ns={ns} repo={repo} />;
};
const Repository: React.FC<{ns: string; repo: string}> = ({ns, repo}) => {
  const location = useLocation(); const navigate = useNavigate(); const [query, setQuery] = useSearchParams();
  const {ref, width, root} = useWorkspace(); const narrow = useNarrow();
  const [search, setSearch] = useState(query.get('q') ?? ''); const [inputError, setInputError] = useState('');
  const restore = useRef<ReturnPoint | null>(null);
  const page = pageNumber(query.get('page'));
  const filter = query.get('q') ?? ''; if (filter) exactTag(filter);
  const selected = query.get('artifact'); if (selected) validateDigest(selected);
  const selectedName = query.get('selectedTag') ?? ''; if (selectedName) exactTag(selectedName);
  const inline = inspectorMode(width, root, query.get('full') === '1') === 'inline';
  const details = useRead(`/api/v1/repository/${repoPath(ns, repo)}?includeTags=false`, value => {
    const parsed = parseRepository(value);
    if (parsed.namespace !== ns || parsed.name !== repo) throw new ContractError('Repository identity mismatch.');
    return parsed;
  });
  const tags = useRead(tagsPath(ns, repo, page, filter), parseTags);
  useEffect(() => setSearch(filter), [filter]);
  useEffect(() => {
    if (!selected && restore.current) {
      const point = restore.current; restore.current = null;
      requestAnimationFrame(() => {
        (document.getElementById(`qn-tag-${point.tag}`) ?? document.getElementById('qn-tag-search'))?.focus({preventScroll: true});
        window.scrollTo({top: point.scroll});
      });
    }
  }, [selected]);
  const selectionUrl = (tag: Tag): string => {const next = new URLSearchParams(query); next.set('artifact', tag.digest); next.set('selectedTag', tag.name); next.delete('full'); next.delete('target'); return `${location.pathname}?${next}`;};
  const existingReturn = readReturnPoint(location.state);
  const selectionState = (tag: Tag): {inspection: ReturnPoint} => ({inspection: existingReturn ?? {session: inspectionSession, url: location.pathname + location.search, tag: tag.name, scroll: window.scrollY}});
  const close = (): void => {
    const point = readReturnPoint(location.state);
    if (point) {restore.current = point; navigate(-1);}
    else {const next = new URLSearchParams(query); next.delete('artifact'); next.delete('selectedTag'); next.delete('full'); next.delete('target'); setQuery(next, {replace: true});}
  };
  const searchTags = (event: React.FormEvent): void => {
    event.preventDefault();
    try {if (search) exactTag(search); setInputError(''); const next = new URLSearchParams(); if (search) next.set('q', search); setQuery(next);}
    catch (error) {setInputError(error instanceof Error ? error.message : 'Invalid tag.');}
  };
  const changePage = (n: number): void => {const next = new URLSearchParams(query); next.set('page', String(n)); next.delete('artifact'); next.delete('selectedTag'); next.delete('full'); next.delete('target'); setQuery(next);};
  const tagLink = (tag: Tag): React.ReactNode => supportedDigest(tag.digest) ? <Link id={`qn-tag-${tag.name}`} to={selectionUrl(tag)} state={selectionState(tag)} replace={Boolean(selected && existingReturn)}>{tag.name}</Link> : <span>{tag.name} · unsupported digest</span>;
  const platformText = (tag: Tag): string => tag.children !== null ? `${tag.children} advertised` : tag.index ? 'Multi-platform index' : 'Not reported';
  const table = <>
    <form className="qn-toolbar" onSubmit={searchTags}>
      <div className="qn-search"><label htmlFor="qn-tag-search">Search exact tag</label><TextInput id="qn-tag-search" value={search} onChange={(_event, value) => setSearch(value)} aria-describedby="qn-tag-help" /></div>
      <Button type="submit" variant="secondary">Search</Button>
      {filter && <Button variant="link" onClick={() => setQuery(new URLSearchParams())}>Clear search</Button>}
    </form>
    <p className="qn-muted" id="qn-tag-help">Searches this repository for a complete tag name. Select a tag to inspect or copy its exact reference.</p>
    {inputError && <Alert isInline variant="warning" title={inputError} />}
    <RequestState loading={tags.isLoading} error={tags.error} retry={() => void tags.refetch()} />
    {tags.data && (narrow ? <ul className="qn-records" aria-label="Tags and artifacts">{tags.data.tags.map(tag => <li key={`${tag.name}:${tag.digest}`}>
      <h3>{tagLink(tag)}</h3><code className="qn-identifier">{tag.digest}</code><dl><dt>Platforms</dt><dd>{platformText(tag)}</dd><dt>Tag updated</dt><dd>{formatDate(tag.modified)}</dd><dt>Evidence</dt><dd>Not loaded</dd></dl>
    </li>)}</ul> : <Table aria-label="Tags and artifacts"><Thead><Tr><Th>Tag / digest</Th><Th>Platforms</Th>{!selected && <Th>Tag updated</Th>}<Th>Evidence</Th></Tr></Thead><Tbody>
      {tags.data.tags.map(tag => <Tr className="qn-row" key={`${tag.name}:${tag.digest}`}>
        <Td dataLabel="Tag / digest"><div className={`qn-identity ${selected === tag.digest ? 'qn-inspected' : ''}`}>{tagLink(tag)}<code>{tag.digest.slice(0, 19)}…{tag.digest.slice(-6)}</code>{selected === tag.digest && <span className="qn-muted">Under inspection</span>}</div></Td>
        <Td dataLabel="Platforms">{platformText(tag)}</Td>{!selected && <Td dataLabel="Tag updated">{formatDate(tag.modified)}</Td>}<Td dataLabel="Evidence">Not loaded</Td>
      </Tr>)}
    </Tbody></Table>)}
    {tags.isSuccess && tags.data.tags.length === 0 && <Alert isInline variant="info" title={filter ? 'No matching active tag.' : 'No active tags on this page.'} />}
    <div className="qn-pagination"><span>Page {page} · {tags.data?.tags.length ?? 0} tags loaded</span><Button variant="secondary" isDisabled={page === 1 || tags.isFetching} onClick={() => changePage(page - 1)}>Previous</Button><Button variant="secondary" isDisabled={!tags.data?.more || tags.isFetching} onClick={() => changePage(page + 1)}>Next</Button></div>
  </>;
  const inspector = selected ? <Inspector key={selected} ns={ns} repo={repo} digest={selected} tag={tags.data?.tags.find(t => t.name === selectedName)} tagName={selectedName} inline={inline} close={close} /> : null;
  return <div ref={ref} className="qn-workspace">
    <div><Link to={`/repositories/${ns}`}>← Repositories</Link><h1>{ns} / {repo}</h1></div>
    <RequestState loading={details.isLoading} error={details.error} retry={() => void details.refetch()} />
    {details.data && <><div className="qn-status-line"><Label>{details.data.visibility}</Label><span>{details.data.state}</span><span>Preview · repository writes blocked</span></div><p className="qn-description">{details.data.description}</p></>}
    <p className="qn-muted">Tags &amp; artifacts · Access, automation, and mutation workflows are not implemented in this first slice.</p>
    {selected && !inline ? inspector : <Drawer isInline isExpanded={Boolean(selected)}>
      <DrawerContent panelContent={selected ? <DrawerPanelContent defaultSize="24rem">{inspector}</DrawerPanelContent> : null}>
        <DrawerContentBody>{table}</DrawerContentBody>
      </DrawerContent>
    </Drawer>}
  </div>;
};
