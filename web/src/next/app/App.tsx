import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {
  Alert,
  Button,
  FormSelect,
  FormSelectOption,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Nav,
  NavItem,
  NavList,
} from '@patternfly/react-core';
import {
  BarsIcon,
  CubesIcon,
  CubeIcon,
  DesktopIcon,
  MoonIcon,
  QuestionCircleIcon,
  SearchIcon,
  SunIcon,
  UserIcon,
} from '@patternfly/react-icons';
import {useSession} from './Session';
import {namespace, repository, repoPath} from '../lib/domain';
import {visitRepository, type RecentRepository} from '../lib/presentation';
import {Workbench} from '../features/Workbench';
import {LoadingRows, useMedia} from '../components/Primitives';
const RepositoryView = lazy(() =>
  import('../features/RepositoryView').then((module) => ({
    default: module.RepositoryView,
  })),
);
function route(path: string): {namespace: string; repository: string} | null {
  if (!path.startsWith('/repository/')) return null;
  try {
    const pieces = path
      .slice('/repository/'.length)
      .split('/')
      .map(decodeURIComponent);
    const ns = pieces.shift();
    return ns
      ? {namespace: namespace(ns), repository: repository(pieces.join('/'))}
      : null;
  } catch {
    return null;
  }
}
export const App: React.FC = () => {
  const {identity, runtime, config, refresh} = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const detail = route(location.pathname);
  const queryScope = new URLSearchParams(location.search).get('namespace');
  const scope =
    detail?.namespace ??
    (queryScope && runtime.namespaces.includes(queryScope)
      ? queryScope
      : runtime.initialNamespace);
  const mobile = useMedia('(max-width: 64rem)');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationTrigger = useRef<HTMLButtonElement>(null);
  const navigationFocusFrame = useRef<number | null>(null);
  // Only explicit modal dismissal restores its trigger. Route/breakpoint
  // changes cancel pending restoration so they retain their own focus target.
  useEffect(
    () => () => {
      if (navigationFocusFrame.current !== null)
        cancelAnimationFrame(navigationFocusFrame.current);
      navigationFocusFrame.current = null;
    },
    [mobile, location.key],
  );
  const closeNavigation = (): void => {
    setNavigationOpen(false);
    if (navigationFocusFrame.current !== null)
      cancelAnimationFrame(navigationFocusFrame.current);
    navigationFocusFrame.current = requestAnimationFrame(() => {
      navigationFocusFrame.current = null;
      navigationTrigger.current?.focus();
    });
  };
  const [controlsOpen, setControlsOpen] = useState(false);
  const [recent, setRecent] = useState<RecentRepository[]>([]);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      const value = localStorage.getItem('quay-next.theme');
      return value === 'dark' || value === 'light' ? value : 'system';
    } catch {
      return 'system';
    }
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {
      document.documentElement.classList.toggle(
        'pf-v6-theme-dark',
        theme === 'dark' || (theme === 'system' && media.matches),
      );
    };
    // Keep the existing preference key; private metadata is never persisted.
    apply();
    media.addEventListener('change', apply);
    try {
      localStorage.setItem('quay-next.theme', theme);
    } catch {
      /* Optional preference. */
    }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  const invalidScope =
    !runtime.namespaces.includes(scope) ||
    (runtime.mode === 'live' &&
      !!detail &&
      !runtime.repositories.includes(
        `${detail.namespace}/${detail.repository}`,
      ));
  const blockedAnon =
    identity.kind === 'anonymous' && config.anonymous === false;
  const detailNS = detail?.namespace;
  const detailRepo = detail?.repository;
  useEffect(() => {
    if (detailNS && detailRepo && !invalidScope)
      setRecent((history) =>
        visitRepository(history, {namespace: detailNS, name: detailRepo}),
      );
  }, [detailNS, detailRepo, invalidScope]);
  useEffect(() => {
    setNavigationOpen(false);
    document.title = detailRepo
      ? `${scope}/${detailRepo} · Quay Next`
      : 'Repositories · Quay Next';
  }, [location.pathname, scope, detailRepo]);
  useEffect(() => {
    if (!mobile) setNavigationOpen(false);
  }, [mobile]);
  const showControls = (): void => {
    setNavigationOpen(false);
    setControlsOpen(true);
  };
  const findRepository = useCallback((): void => {
    const input = document.getElementById('repository-search');
    if (input) {
      input.focus();
      return;
    }
    navigate(`/?namespace=${encodeURIComponent(scope)}`, {
      state: {focusRepositorySearch: true},
    });
  }, [navigate, scope]);
  useEffect(() => {
    const key = (event: KeyboardEvent): void => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !controlsOpen &&
        !navigationOpen
      ) {
        event.preventDefault();
        findRepository();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [findRepository, controlsOpen, navigationOpen]);
  const navigation = (
    <div className="qn-sidebar-content">
      <div className="qn-namespace">
        <label htmlFor="namespace-scope">Namespace</label>
        <FormSelect
          id="namespace-scope"
          value={scope}
          onChange={(_, value) => {
            setNavigationOpen(false);
            navigate(`/?namespace=${encodeURIComponent(value)}`);
          }}
        >
          {runtime.namespaces.map((ns) => (
            <FormSelectOption key={ns} value={ns} label={ns} />
          ))}
        </FormSelect>
      </div>
      <Nav aria-label="Workspace">
        <NavList>
          <NavItem isActive={location.pathname === '/'}>
            <Link
              to={`/?namespace=${encodeURIComponent(scope)}`}
              onClick={() => setNavigationOpen(false)}
              aria-current={location.pathname === '/' ? 'page' : undefined}
            >
              <CubeIcon aria-hidden="true" />
              <span>Repositories</span>
            </Link>
          </NavItem>
        </NavList>
      </Nav>
      {recent.length > 0 && (
        <section className="qn-recent" aria-labelledby="recent-heading">
          <div className="qn-section-title">
            <h2 id="recent-heading">Recent</h2>
            <Button variant="link" isInline onClick={() => setRecent([])}>
              Clear
            </Button>
          </div>
          <ul>
            {recent.map((row) => (
              <li key={`${row.namespace}/${row.name}`}>
                <Link
                  to={`/repository/${repoPath(row.namespace, row.name)}`}
                  onClick={() => setNavigationOpen(false)}
                >
                  <CubeIcon aria-hidden="true" />
                  <span>
                    {row.namespace}/{row.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="qn-sidebar-bottom">
        <span className="qn-connection-label">
          {runtime.mode === 'live'
            ? 'Connected to quay.io'
            : 'Local demonstration'}
        </span>
        <Button variant="link" isInline onClick={showControls}>
          Preview controls &amp; session
        </Button>
      </div>
    </div>
  );
  return (
    <div className="qn-app">
      <a href="#main-content" className="qn-skip">
        Skip to main content
      </a>
      <header className="qn-masthead">
        <div className="qn-brand-group">
          {mobile && (
            <Button
              innerRef={navigationTrigger}
              variant="plain"
              aria-label="Open navigation"
              aria-expanded={navigationOpen}
              icon={<BarsIcon aria-hidden="true" />}
              onClick={() => setNavigationOpen(true)}
            />
          )}
          <Link to="/" className="qn-brand">
            <CubesIcon aria-hidden="true" />
            <span>QUAY</span>
            <span className="qn-brand-next">NEXT</span>
          </Link>
        </div>
        <div className="qn-masthead-context">
          <span className="qn-environment" data-testid="environment-label">
            {runtime.mode === 'live'
              ? 'Live quay.io · repository writes blocked'
              : 'Demo data · no registry connection'}
          </span>
        </div>
        <div className="qn-actions">
          <Button
            variant="plain"
            className="qn-jump"
            aria-label="Find a repository"
            icon={<SearchIcon aria-hidden="true" />}
            onClick={findRepository}
          />
          <Button
            variant="plain"
            aria-label={`Theme: ${theme}. Change theme`}
            onClick={() =>
              setTheme(
                theme === 'system'
                  ? 'light'
                  : theme === 'light'
                    ? 'dark'
                    : 'system',
              )
            }
            icon={
              theme === 'dark' ? (
                <MoonIcon aria-hidden="true" />
              ) : theme === 'light' ? (
                <SunIcon aria-hidden="true" />
              ) : (
                <DesktopIcon aria-hidden="true" />
              )
            }
          />
          <Button
            variant="plain"
            className="qn-help"
            aria-label="Preview help"
            icon={<QuestionCircleIcon aria-hidden="true" />}
            onClick={showControls}
          />
          <Button
            variant="plain"
            className="qn-account"
            onClick={showControls}
            icon={<UserIcon aria-hidden="true" />}
          >
            <span>
              {identity.kind === 'user' ? identity.username : 'Sign in'}
            </span>
          </Button>
        </div>
      </header>
      <div className="qn-layout">
        {!mobile && (
          <nav className="qn-sidebar" aria-label="Registry navigation">
            {navigation}
          </nav>
        )}
        <main id="main-content" className="qn-main" tabIndex={-1}>
          {blockedAnon ? (
            <Alert
              variant="warning"
              isInline
              title="This registry requires sign-in"
            >
              <Button onClick={showControls}>Sign-in instructions</Button>
            </Alert>
          ) : invalidScope ? (
            <Alert
              variant="warning"
              isInline
              title="This repository is outside the approved preview scope"
            >
              <p>No request to this repository was sent.</p>
              <Button variant="link" onClick={showControls}>
                Preview scope instructions
              </Button>
              <Link to="/">Back to repositories</Link>
            </Alert>
          ) : detail ? (
            <Suspense fallback={<LoadingRows />}>
              <RepositoryView
                key={`${detail.namespace}/${detail.repository}`}
                ns={detail.namespace}
                repo={detail.repository}
              />
            </Suspense>
          ) : location.pathname === '/' ? (
            <Workbench key={scope} scope={scope} onScopeInfo={showControls} />
          ) : (
            <Alert
              variant="warning"
              isInline
              title="Page not available in this implementation"
            >
              <Link to="/">Back to repositories</Link>
            </Alert>
          )}
        </main>
      </div>
      {mobile && (
        <Modal
          className="qn-modal"
          variant="small"
          isOpen={navigationOpen}
          onClose={closeNavigation}
          aria-labelledby="mobile-navigation-heading"
        >
          <ModalHeader
            title="Registry navigation"
            labelId="mobile-navigation-heading"
          />
          <ModalBody>{navigationOpen && navigation}</ModalBody>
        </Modal>
      )}
      <Modal
        className="qn-modal"
        variant="small"
        isOpen={controlsOpen}
        onClose={() => setControlsOpen(false)}
        aria-labelledby="preview-controls-heading"
      >
        <ModalHeader
          title="Preview controls & session"
          labelId="preview-controls-heading"
        />
        <ModalBody>
          <div className="qn-modal-copy">
            <h3>Authentication stays on the genuine Quay site</h3>
            <p>
              {runtime.mode === 'live'
                ? 'Type login in the preview terminal, complete your usual password or identity-provider flow, then return to the preview.'
                : 'Demo identities and data are synthetic. Start the live launcher to use a real registry account.'}
            </p>
            <h3>Approved repository scope</h3>
            <p>
              To enable another repository, restart the launcher with its exact
              namespace/repository in <code>QUAY_NEXT_REPOSITORIES</code>.
              Changing the UI does not grant access.
            </p>
            <p>
              Quay continues to enforce your account’s permissions. Repository
              writes remain blocked in this preview, including star changes.
            </p>
            <h3>Disconnecting</h3>
            <p>
              Quit the preview to close this isolated browser. That does not
              revoke the remote session. The preview does not automatically sign
              out your other Quay sessions.
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary" onClick={() => setControlsOpen(false)}>
            Done
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setRecent([]);
              setControlsOpen(false);
              refresh();
            }}
          >
            Recheck session
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};
