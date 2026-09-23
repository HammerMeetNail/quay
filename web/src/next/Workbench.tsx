import React, {useState, useEffect} from 'react';
import {Alert, Button, Label, TextInput} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {Link, useParams, useSearchParams} from 'react-router-dom';
import {useRead, useSession} from './data';
import {ContractError, namespace, pageNumber, parseRepositories, repoPath} from './model';
import {RequestState, useNarrow} from './Shared';

export const Workbench: React.FC = () => {
  const {runtime} = useSession(); const params = useParams();
  const ns = namespace(params.namespace ?? runtime.namespaces[0]);
  if (!runtime.namespaces.includes(ns)) return <Alert isInline variant="warning" title="Namespace not approved in the preview launcher." />;
  return <ScopedWorkbench key={ns} ns={ns} />;
};
const ScopedWorkbench: React.FC<{ns: string}> = ({ns}) => {
  const [query, setQuery] = useSearchParams(); const narrow = useNarrow(); const {runtime} = useSession();
  const repoLink = (ns: string, name: string): React.ReactNode => runtime.repositories.includes(`${ns}/${name}`) ? <Link to={`/repository/${repoPath(ns, name)}`}>{name}</Link> : <span>{name} <small>· outside preview scope</small></span>;
  const cursor = query.get('cursor') ?? '';
  if (cursor.length > 8192 || /[\u0000-\u001f\u007f]/.test(cursor)) throw new ContractError('Invalid cursor.');
  const slice = pageNumber(query.get('page')); const filter = query.get('q') ?? '';
  const [input, setInput] = useState(filter);
  useEffect(() => setInput(filter), [filter]);
  const search = new URLSearchParams({namespace: ns, public: 'true', last_modified: 'true'});
  if (cursor) search.set('next_page', cursor);
  const repos = useRead(`/api/v1/repository?${search}`, value => {
    const result = parseRepositories(value);
    if (result.repositories.some(r => r.namespace !== ns)) throw new ContractError('The repository response has an unexpected namespace.');
    return result;
  });
  const filtered = (repos.data?.repositories ?? []).filter(r => `${r.name} ${r.description}`.toLowerCase().includes(filter.toLowerCase()));
  const visible = filtered.slice((slice - 1) * 25, slice * 25);
  const repeatedCursor = Boolean(cursor && repos.data?.next === cursor);
  const paginate = (page: number): void => {const next = new URLSearchParams(query); next.set('page', String(page)); setQuery(next);};
  return <section className="qn-workspace">
    <div className="qn-page-title"><div><p className="qn-eyebrow">{ns}</p><h1>Repositories</h1></div><Label>Read-only preview</Label></div>
    <form className="qn-toolbar" onSubmit={event => {event.preventDefault(); const next = new URLSearchParams(query); input ? next.set('q', input) : next.delete('q'); next.delete('page'); setQuery(next);}}>
      <div className="qn-search"><label htmlFor="qn-repo-search">Filter loaded repositories</label><TextInput id="qn-repo-search" value={input} onChange={(_event, value) => setInput(value)} aria-describedby="qn-repo-help" /></div>
      <Button type="submit" variant="secondary">Filter</Button>
      {filter && <Button variant="link" onClick={() => {const next = new URLSearchParams(query); next.delete('q'); next.delete('page'); setQuery(next);}}>Clear filter</Button>}
    </form>
    <p className="qn-muted" id="qn-repo-help">This filter covers the currently loaded backend batch, not the entire registry. No manifests or scans are fetched for this list. Only launcher-approved repositories can be opened.</p>
    <RequestState loading={repos.isLoading} error={repos.error} retry={() => void repos.refetch()} />
    {repos.data && (narrow ? <ul className="qn-records" aria-label="Repositories">{visible.map(r => <li key={r.name}>
      <h2>{repoLink(r.namespace, r.name)}</h2><p>{r.description}</p><dl><dt>Visibility</dt><dd>{r.visibility}</dd><dt>State</dt><dd>{r.state}</dd></dl>
    </li>)}</ul> : <Table aria-label="Repositories"><Thead><Tr><Th>Repository</Th><Th>Visibility</Th><Th>State</Th></Tr></Thead><Tbody>{visible.map(r => <Tr className="qn-row" key={r.name}>
      <Td dataLabel="Repository"><div className="qn-identity">{repoLink(r.namespace, r.name)}{r.description && <span className="qn-description">{r.description}</span>}</div></Td><Td dataLabel="Visibility"><Label>{r.visibility}</Label></Td><Td dataLabel="State">{r.state}</Td>
    </Tr>)}</Tbody></Table>)}
    {repos.isSuccess && visible.length === 0 && <Alert isInline variant="info" title={filter ? 'No matching repositories in this loaded batch.' : 'No repositories on this page.'}><Button variant="link" onClick={() => {const next = new URLSearchParams(query); next.delete('page'); next.delete('q'); setQuery(next);}}>Show first page of this batch</Button></Alert>}
    {repeatedCursor && <Alert isInline variant="warning" title="The backend repeated its pagination cursor. Further loading is stopped." />}
    <div className="qn-pagination"><span aria-live="polite">{visible.length} shown · {repos.data?.repositories.length ?? 0} loaded{filter ? ` · ${filtered.length} match` : ''}</span>
      <Button variant="secondary" isDisabled={slice === 1 || repos.isFetching} onClick={() => paginate(slice - 1)}>Previous 25</Button>
      <Button variant="secondary" isDisabled={slice * 25 >= filtered.length || repos.isFetching} onClick={() => paginate(slice + 1)}>Next 25</Button>
      {repos.data?.next && <Button variant="secondary" isDisabled={repeatedCursor || repos.isFetching} onClick={() => {const next = new URLSearchParams(query); next.set('cursor', repos.data?.next ?? ''); next.delete('page'); setQuery(next);}}>Load next backend batch</Button>}
      {cursor && <Button variant="link" onClick={() => {const next = new URLSearchParams(query); next.delete('cursor'); next.delete('page'); setQuery(next);}}>First backend batch</Button>}
    </div>
  </section>;
};
