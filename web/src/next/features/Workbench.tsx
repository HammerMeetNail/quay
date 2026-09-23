import React, {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useLocation, useSearchParams} from 'react-router-dom';
import {Button, FormGroup, TextInput, Label} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {useSession} from '../app/Session';
import {
  dateLabel,
  parseRepositories,
  repoPath,
  type Repository,
} from '../lib/domain';
import {
  Empty,
  Failure,
  LoadingRows,
  PageControls,
  useMedia,
} from '../components/Primitives';
export const Workbench: React.FC<{
  scope: string;
}> = ({scope}) => {
  const {client, runtime} = useSession();
  const [params, setParams] = useSearchParams();
  const cursor = params.get('cursor');
  const filter = (params.get('q') ?? '').slice(0, 255);
  const location = useLocation();
  // Each browser history entry owns its ancestry, including when restored by Back/Forward.
  const pagination = location.state?.repositoryPagination as
    | {scope: string; cursor: string | null; previous: (string | null)[]}
    | undefined;
  const previous =
    pagination?.scope === scope && pagination.cursor === cursor
      ? pagination.previous
      : [];
  const [errorLocation, setErrorLocation] = useState<string | null>(null);
  const cursorError = errorLocation === location.key;
  const query = useQuery({
    queryKey: ['repositories', scope, cursor],
    queryFn: ({signal}) =>
      client.get(
        {kind: 'repositories', namespace: scope, cursor},
        parseRepositories,
        signal,
      ),
  });
  const narrow = useMedia('(max-width: 48rem)');
  const rows =
    query.data?.repositories.filter((r) =>
      `${r.namespace}/${r.name} ${r.description}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) ?? [];
  const allowed = (row: Repository): boolean =>
    runtime.mode === 'demo' ||
    runtime.repositories.includes(`${row.namespace}/${row.name}`);
  const name = (row: Repository): React.ReactNode =>
    allowed(row) ? (
      <Link
        to={`/repository/${repoPath(row.namespace, row.name)}`}
        className="qn-entity"
      >
        {row.name}
      </Link>
    ) : (
      <>
        <span className="qn-entity">{row.name}</span>
        <span className="qn-secondary">
          Outside the launcher’s approved detail scope
        </span>
      </>
    );
  const move = (next: string | null, ancestry: (string | null)[]): void => {
    setErrorLocation(null);
    setParams(
      (p) => {
        const updated = new URLSearchParams(p);
        if (next) updated.set('cursor', next);
        else updated.delete('cursor');
        return updated;
      },
      {
        state: {
          ...location.state,
          repositoryPagination: {scope, cursor: next, previous: ancestry},
        },
      },
    );
  };
  return (
    <section aria-labelledby="repositories-heading">
      <div className="qn-heading">
        <div>
          <p className="qn-eyebrow">{scope} / registry workspace</p>
          <h1 id="repositories-heading">Repositories</h1>
          <p className="qn-secondary">
            Find an image. Inspect its evidence. Copy the exact reference.
          </p>
        </div>
        <Label>Read-only preview</Label>
      </div>
      <div className="qn-toolbar">
        <FormGroup
          label="Filter this response page"
          fieldId="repository-search"
        >
          <TextInput
            id="repository-search"
            value={filter}
            type="search"
            placeholder="Repository name or description"
            onChange={(_, value) =>
              setParams(
                (p) => {
                  value ? p.set('q', value) : p.delete('q');
                  return p;
                },
                {replace: true, state: location.state},
              )
            }
          />
        </FormGroup>
        <p className="qn-secondary">
          Filters only the loaded response, not every repository in the
          registry.
        </p>
      </div>
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <Empty
          title={
            filter
              ? 'No matching repositories on this page'
              : 'No repositories returned'
          }
        >
          <p>
            {filter
              ? 'Change the filter or load another response page.'
              : 'This namespace may be empty or have no repositories visible to your account.'}
          </p>
        </Empty>
      ) : narrow ? (
        <ul className="qn-records" aria-label="Repositories">
          {rows.map((row) => (
            <li key={`${row.namespace}/${row.name}`}>
              {name(row)}
              <p>{row.description}</p>
              <dl>
                <dt>Visibility</dt>
                <dd>{row.visibility}</dd>
                <dt>State</dt>
                <dd>{row.state}</dd>
                <dt>Updated</dt>
                <dd>{dateLabel(row.modified)}</dd>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <Table role="table" aria-label="Repositories" variant="compact">
          <Thead>
            <Tr>
              <Th>Repository</Th>
              <Th>Visibility</Th>
              <Th>Updated</Th>
              <Th>State</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={`${row.namespace}/${row.name}`}>
                <Td dataLabel="Repository">
                  {name(row)}
                  <span className="qn-description">{row.description}</span>
                </Td>
                <Td dataLabel="Visibility">
                  <Label>{row.visibility}</Label>
                </Td>
                <Td dataLabel="Updated">{dateLabel(row.modified)}</Td>
                <Td dataLabel="State">{row.state}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      {cursorError && (
        <p role="alert">
          The registry repeated a pagination cursor. Pagination stopped to avoid
          a loop.
        </p>
      )}
      <PageControls
        label={`${rows.length} shown · ${query.data?.repositories.length ?? 0} repositories in this response`}
        busy={query.isFetching}
        canPrevious={!!cursor}
        canNext={!!query.data?.next && !cursorError}
        previous={() => {
          move(previous.at(-1) ?? null, previous.slice(0, -1));
        }}
        next={() => {
          const next = query.data?.next;
          if (!next) return;
          if (next === cursor || previous.includes(next)) {
            setErrorLocation(location.key);
            return;
          }
          move(next, [...previous, cursor]);
        }}
      />
      {cursor && (
        <Button
          variant="link"
          isInline
          onClick={() => {
            move(null, []);
          }}
        >
          Return to first response page
        </Button>
      )}
    </section>
  );
};
