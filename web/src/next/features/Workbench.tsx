import React, {useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  Alert,
  Button,
  Drawer,
  DrawerContent,
  DrawerContentBody,
  DrawerPanelContent,
  FormGroup,
  FormSelect,
  FormSelectOption,
  TextInput,
} from '@patternfly/react-core';
import {Table, Thead, Tbody, Tr, Th, Td} from '@patternfly/react-table';
import {ArrowRightIcon, SearchIcon} from '@patternfly/react-icons';
import {useSession} from '../app/Session';
import {repoPath} from '../lib/domain';
import {
  descriptionText,
  pageCounts,
  parseWorkbenchPage,
  selectedRepository,
  sortOrder,
  visibilityFilter,
  visibleRepositories,
  type WorkbenchRepository,
  type VisibilityFilter,
} from '../lib/presentation';
import {
  Empty,
  Failure,
  LoadingRows,
  PageControls,
  useMedia,
} from '../components/Primitives';
import {
  RepositoryGlyph,
  StarredMark,
  StateMark,
  UpdatedAt,
  VisibilityMark,
} from '../components/DataPresentation';
import {useWorkspaceWidth} from '../components/useWorkspaceWidth';
import {RepositoryPreview} from './RepositoryPreview';

export const Workbench: React.FC<{scope: string; onScopeInfo?: () => void}> = ({
  scope,
  onScopeInfo,
}) => {
  const {client, runtime} = useSession();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const cursor = params.get('cursor');
  const filter = (params.get('q') ?? '').slice(0, 255);
  const visibility = visibilityFilter(params.get('visibility'));
  const order = sortOrder(params.get('sort'));
  const preview = selectedRepository(params.get('preview'), scope);
  const allowedPreview =
    !!preview &&
    (runtime.mode === 'demo' ||
      runtime.repositories.includes(`${scope}/${preview}`));
  const {ref, inline} = useWorkspaceWidth();
  const narrow = useMedia('(max-width: 48rem)');
  const heading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<{id: string; scroll: number} | null>(null);
  // Preserve the branch's cursor/history fix, including Back/Forward and filter changes.
  const pagination = location.state?.repositoryPagination as
    | {scope: string; cursor: string | null; previous: (string | null)[]}
    | undefined;
  const previous =
    pagination?.scope === scope &&
    pagination.cursor === cursor &&
    Array.isArray(pagination.previous)
      ? pagination.previous
      : [];
  const [errorLocation, setErrorLocation] = useState<string | null>(null);
  const cursorError = errorLocation === location.key;
  const query = useQuery({
    queryKey: ['repositories', scope, cursor],
    queryFn: ({signal}) =>
      client.get(
        {kind: 'repositories', namespace: scope, cursor},
        parseWorkbenchPage,
        signal,
      ),
  });
  const all = query.data?.repositories ?? [];
  const rows = visibleRepositories(all, filter, visibility, order);
  const counts = pageCounts(all);
  const hasStars = all.some((row) => row.starred !== null);
  const allowed = (row: WorkbenchRepository): boolean =>
    runtime.mode === 'demo' ||
    runtime.repositories.includes(`${row.namespace}/${row.name}`);
  const blockedCount = all.filter((row) => !allowed(row)).length;

  const update = (
    change: (next: URLSearchParams) => void,
    replace = true,
  ): void => {
    const next = new URLSearchParams(params);
    change(next);
    next.delete('preview');
    returnTo.current = null;
    setParams(next, {replace, state: location.state});
  };
  const move = (
    nextCursor: string | null,
    ancestry: (string | null)[],
  ): void => {
    setErrorLocation(null);
    returnTo.current = null;
    const next = new URLSearchParams(params);
    next.delete('preview');
    nextCursor ? next.set('cursor', nextCursor) : next.delete('cursor');
    setParams(next, {
      state: {
        ...location.state,
        repositoryPagination: {scope, cursor: nextCursor, previous: ancestry},
      },
    });
  };
  const inspect = (row: WorkbenchRepository): void => {
    if (!allowed(row)) {
      onScopeInfo?.();
      return;
    }
    if (!preview)
      returnTo.current = {
        id: `repo-preview-${repoPath(row.namespace, row.name)}`,
        scroll: window.scrollY,
      };
    const next = new URLSearchParams(params);
    next.set('preview', `${row.namespace}/${row.name}`);
    setParams(next, {replace: !!preview, state: location.state});
  };
  const close = (): void => {
    if (returnTo.current) navigate(-1);
    else {
      returnTo.current = {id: 'repositories-heading', scroll: window.scrollY};
      const next = new URLSearchParams(params);
      next.delete('preview');
      setParams(next, {replace: true, state: location.state});
    }
  };
  useEffect(() => {
    if (preview || !returnTo.current) return;
    const restore = returnTo.current;
    returnTo.current = null;
    const frame = requestAnimationFrame(() => {
      (document.getElementById(restore.id) ?? heading.current)?.focus();
      window.scrollTo({top: restore.scroll, behavior: 'instant'});
    });
    return () => cancelAnimationFrame(frame);
  }, [preview, location.key]);
  useEffect(() => {
    if (!location.state?.focusRepositorySearch) return;
    document.getElementById('repository-search')?.focus();
    // Consume the intent on its history entry before later list updates copy
    // that state. Preview headings and filter controls then keep their focus.
    const state = {...location.state};
    delete state.focusRepositorySearch;
    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      {replace: true, state},
    );
  }, [
    location.key,
    location.state,
    location.pathname,
    location.search,
    location.hash,
    navigate,
  ]);

  const identity = (row: WorkbenchRepository): React.ReactNode => (
    <div className="qn-repository-identity">
      <RepositoryGlyph />
      <div className="qn-identity-copy">
        <div className="qn-entity-line">
          {allowed(row) ? (
            <Link
              to={`/repository/${repoPath(row.namespace, row.name)}`}
              className="qn-entity"
            >
              {row.name}
            </Link>
          ) : (
            <span className="qn-entity">{row.name}</span>
          )}
          <StarredMark starred={row.starred} />
          <VisibilityMark value={row.visibility} />
        </div>
        <div className="qn-inline-metadata">
          <StateMark state={row.state} />
          {!allowed(row) && (
            <span className="qn-secondary qn-scope-note">
              Outside preview scope
            </span>
          )}
        </div>
        <p className="qn-description qn-clamp-two">
          {descriptionText(row.description) || 'No description provided.'}
        </p>
      </div>
    </div>
  );
  const previewButton = (row: WorkbenchRepository): React.ReactNode => (
    <Button
      variant="plain"
      id={`repo-preview-${repoPath(row.namespace, row.name)}`}
      onClick={() => inspect(row)}
      aria-label={
        allowed(row)
          ? `Preview ${row.name}`
          : `Explain preview scope for ${row.name}`
      }
      icon={<ArrowRightIcon aria-hidden="true" />}
    />
  );
  const filters: [VisibilityFilter, string][] = [
    ['all', 'All'],
    ['public', 'Public'],
    ['private', 'Private'],
    ...(hasStars ? [['starred', 'Starred'] as [VisibilityFilter, string]] : []),
  ];
  const content = (
    <section aria-labelledby="repositories-heading" className="qn-workbench">
      <div className="qn-heading">
        <div>
          <p className="qn-eyebrow">{scope}</p>
          <h1 id="repositories-heading" ref={heading} tabIndex={-1}>
            Repositories
          </h1>
          <p className="qn-secondary">
            Find an image. Choose a tag. Copy its exact reference.
          </p>
        </div>
      </div>
      <div className="qn-list-surface">
        <div className="qn-toolbar qn-workbench-toolbar">
          <FormGroup fieldId="repository-search" className="qn-search-group">
            <label htmlFor="repository-search" className="qn-sr-only">
              Filter repositories on this page
            </label>
            <div className="qn-search-field">
              <SearchIcon aria-hidden="true" />
              <TextInput
                id="repository-search"
                type="search"
                value={filter}
                placeholder="Find a repository…"
                aria-describedby="repository-scope-hint"
                onChange={(_, value) =>
                  update((p) => {
                    value ? p.set('q', value.slice(0, 255)) : p.delete('q');
                  })
                }
              />
            </div>
          </FormGroup>
          <FormGroup fieldId="repository-sort" className="qn-sort-group">
            <label htmlFor="repository-sort" className="qn-sr-only">
              Sort repositories on this page
            </label>
            <FormSelect
              id="repository-sort"
              value={order}
              aria-label="Sort repositories on this page"
              onChange={(_, value) =>
                update((p) => {
                  value === 'registry'
                    ? p.delete('sort')
                    : p.set('sort', value);
                })
              }
            >
              <FormSelectOption value="registry" label="Registry order" />
              <FormSelectOption
                value="updated"
                label="Recently updated · this page"
              />
              <FormSelectOption value="name" label="Name · this page" />
            </FormSelect>
          </FormGroup>
        </div>
        <div className="qn-filter-row">
          <div
            role="group"
            aria-label="Visibility filters for this page"
            className="qn-filter-group"
          >
            {filters.map(([value, label]) => (
              <Button
                key={value}
                variant="plain"
                className={`qn-filter ${visibility === value ? 'qn-filter--selected' : ''}`}
                aria-pressed={visibility === value}
                onClick={() =>
                  update((p) => {
                    value === 'all'
                      ? p.delete('visibility')
                      : p.set('visibility', value);
                  })
                }
              >
                {label} <span className="qn-filter-count">{counts[value]}</span>
              </Button>
            ))}
          </div>
          <span id="repository-scope-hint" className="qn-secondary">
            Loaded page only
          </span>
        </div>
        {query.isLoading ? (
          <LoadingRows />
        ) : query.isError ? (
          <Failure error={query.error} retry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <Empty
            title={
              all.length
                ? 'No matches on this page'
                : 'No repositories returned'
            }
          >
            <p>
              {all.length
                ? 'Change the filters or load another page.'
                : 'This namespace may be empty or have no repositories visible to your account.'}
            </p>
            {all.length > 0 && (
              <Button
                variant="secondary"
                onClick={() =>
                  update((p) => {
                    p.delete('q');
                    p.delete('visibility');
                  })
                }
              >
                Clear filters
              </Button>
            )}
          </Empty>
        ) : narrow ? (
          <ul className="qn-records" aria-label="Repositories">
            {rows.map((row) => (
              <li
                key={`${row.namespace}/${row.name}`}
                className={row.name === preview ? 'qn-inspected' : ''}
              >
                {identity(row)}
                <div className="qn-record-footer">
                  <span className="qn-secondary">
                    Updated <UpdatedAt value={row.modified} />
                  </span>
                  {previewButton(row)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Table
            className="qn-table qn-repository-table"
            role="table"
            aria-label="Repositories"
            variant="compact"
          >
            <Thead>
              <Tr>
                <Th>Repository</Th>
                <Th>Updated</Th>
                <Th>
                  <span className="qn-sr-only">Preview</span>
                </Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.map((row) => (
                <Tr
                  key={`${row.namespace}/${row.name}`}
                  className={row.name === preview ? 'qn-inspected' : ''}
                >
                  <Td dataLabel="Repository">{identity(row)}</Td>
                  <Td dataLabel="Updated">
                    <UpdatedAt value={row.modified} />
                  </Td>
                  <Td>{previewButton(row)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
        {cursorError && (
          <p role="alert">
            The registry repeated a pagination cursor. Pagination stopped to
            avoid a loop.
          </p>
        )}
        <PageControls
          label={`${rows.length} shown · ${all.length} loaded${query.isFetching && !query.isLoading ? ' · Updating…' : ''}`}
          busy={query.isFetching}
          canPrevious={!!cursor}
          canNext={!!query.data?.next && !cursorError}
          previous={() => move(previous.at(-1) ?? null, previous.slice(0, -1))}
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
      </div>
      <div className="qn-collection-footnote">
        {blockedCount > 0 && (
          <Button variant="link" isInline onClick={onScopeInfo}>
            {blockedCount} repositories outside the preview’s approved detail
            scope
          </Button>
        )}
        {cursor && (
          <Button variant="link" isInline onClick={() => move(null, [])}>
            Return to first response page
          </Button>
        )}
      </div>
    </section>
  );
  const panel =
    allowedPreview && preview ? (
      <RepositoryPreview
        ns={scope}
        repo={preview}
        page={!inline}
        close={close}
      />
    ) : null;
  return (
    <div ref={ref} className="qn-workspace-measure">
      {params.has('preview') && !allowedPreview && (
        <Alert
          variant="warning"
          isInline
          title="Repository preview is not available in this scope"
        >
          <p>No detail request was sent. Choose an approved repository.</p>
          <Button onClick={close}>Back to repositories</Button>
        </Alert>
      )}
      {panel && !inline ? (
        panel
      ) : (
        <Drawer isExpanded={!!panel} isInline>
          <DrawerContent
            panelContent={
              panel ? (
                <DrawerPanelContent defaultSize="24rem">
                  <aside aria-labelledby="repository-preview-heading">
                    {panel}
                  </aside>
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
