import React, {useEffect, useState, lazy, Suspense} from 'react';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {
  Alert,
  Button,
  FormSelect,
  FormSelectOption,
  Label,
  Nav,
  NavItem,
  NavList,
} from '@patternfly/react-core';
import {CubesIcon} from '@patternfly/react-icons';
import {useSession} from './Session';
import {namespace, repository} from '../lib/domain';
import {Workbench} from '../features/Workbench';
import {LoadingRows} from '../components/Primitives';
const RepositoryView = lazy(() =>
  import('../features/RepositoryView').then((module) => ({
    default: module.RepositoryView,
  })),
);
function route(path: string): {
  namespace: string;
  repository: string;
} | null {
  if (!path.startsWith('/repository/')) return null;
  try {
    const pieces = path
      .slice('/repository/'.length)
      .split('/')
      .map(decodeURIComponent);
    const ns = pieces.shift();
    if (!ns) return null;
    return {namespace: namespace(ns), repository: repository(pieces.join('/'))};
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
  const [showLogin, setShowLogin] = useState(false);
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
    apply();
    media.addEventListener('change', apply);
    try {
      localStorage.setItem('quay-next.theme', theme);
    } catch {
      /* Preference storage is optional. */
    }
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    document.title = 'Quay Next · registry workspace';
  }, []);
  const invalidScope =
    !runtime.namespaces.includes(scope) ||
    (runtime.mode === 'live' &&
      !!detail &&
      !runtime.repositories.includes(
        `${detail.namespace}/${detail.repository}`,
      ));
  const blockedAnon =
    identity.kind === 'anonymous' && config.anonymous === false;
  return (
    <div className="qn-app">
      <a href="#main-content" className="qn-skip">
        Skip to main content
      </a>
      <header className="qn-masthead">
        <Link to="/" className="qn-brand">
          <CubesIcon aria-hidden="true" /> <span>QUAY</span>
          <span className="qn-brand-next">NEXT</span>
        </Link>
        <span className="qn-environment">
          {runtime.mode === 'live'
            ? 'Live quay.io · repository writes blocked'
            : 'Demo data · no registry connection'}
        </span>
        <div className="qn-actions">
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
          >
            Theme: {theme}
          </Button>
          <Button
            className="qn-account"
            variant="secondary"
            onClick={() => setShowLogin((v) => !v)}
          >
            {identity.kind === 'user' ? identity.username : 'Sign in'}
          </Button>
        </div>
      </header>
      <div className="qn-layout">
        <nav className="qn-sidebar" aria-label="Registry navigation">
          <label htmlFor="namespace-scope">Namespace</label>
          <FormSelect
            id="namespace-scope"
            value={scope}
            onChange={(_, value) =>
              navigate(`/?namespace=${encodeURIComponent(value)}`)
            }
          >
            {runtime.namespaces.map((ns) => (
              <FormSelectOption key={ns} value={ns} label={ns} />
            ))}
          </FormSelect>
          <Nav aria-label="Workspace">
            <NavList>
              <NavItem isActive={location.pathname === '/'}>
                <Link
                  to={`/?namespace=${encodeURIComponent(scope)}`}
                  aria-current={location.pathname === '/' ? 'page' : undefined}
                >
                  Repositories
                </Link>
              </NavItem>
            </NavList>
          </Nav>
          <div className="qn-sidebar-note">
            <Label>First implementation</Label>
            <p>
              Browsing and inspection. Changes stay in your existing Quay tools.
            </p>
            <Button variant="link" isInline onClick={refresh}>
              Recheck session
            </Button>
          </div>
        </nav>
        <main id="main-content" className="qn-main" tabIndex={-1}>
          {showLogin && (
            <Alert
              variant="info"
              isInline
              title="Authentication stays on the genuine Quay site"
            >
              <p>
                {runtime.mode === 'live'
                  ? 'Type login in the preview terminal. Complete your usual password or identity-provider flow there, then return to this preview. To disconnect locally, quit the preview; that does not revoke the remote session.'
                  : 'Demo identities are synthetic. Run the live preview to use a real Quay account.'}
              </p>
              <Button
                variant="link"
                isInline
                onClick={() => setShowLogin(false)}
              >
                Dismiss instructions
              </Button>
            </Alert>
          )}
          {blockedAnon ? (
            <Alert
              variant="warning"
              isInline
              title="This registry requires sign-in"
            >
              Use the genuine sign-in flow from the preview terminal.
            </Alert>
          ) : invalidScope ? (
            <Alert
              variant="warning"
              isInline
              title="This repository is outside the approved preview scope"
            >
              <p>
                Restart the launcher with its exact namespace/repository path in
                QUAY_NEXT_REPOSITORIES. No request to this repository was sent.
              </p>
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
            <Workbench key={scope} scope={scope} />
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
    </div>
  );
};
