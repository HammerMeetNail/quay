import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Button, FormSelect, FormSelectOption, Label, Skeleton} from '@patternfly/react-core';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import {ReadClient} from './client';
import {PREFIX, ContractError, parseFeatures, parseRuntime, type Runtime} from './model';
import {SessionContext, readUser, type Session} from './data';
import {RepositoryPage} from './Repository';
import {Workbench} from './Workbench';

class ViewBoundary extends React.Component<{children: React.ReactNode}, {error: boolean}> {
  state = {error: false};
  static getDerivedStateFromError(): {error: boolean} {return {error: true};}
  render(): React.ReactNode {return this.state.error ? <Alert isInline variant="danger" title="This view could not be displayed. Check the repository identifier and URL parameters."><Link to="/">Return to repositories</Link></Alert> : this.props.children;}
}
const Shell: React.FC<{session: Session}> = ({session}) => {
  const location = useLocation(); const navigate = useNavigate();
  const [loginHelp, setLoginHelp] = useState(false); const [navigation, setNavigation] = useState(false);
  const [theme, setTheme] = useState(() => {try {return localStorage.getItem('quay-next.theme') ?? 'system';} catch {return 'system';}});
  const candidate = location.pathname.split('/')[2];
  const ns = session.runtime.namespaces.includes(candidate) ? candidate : session.runtime.namespaces[0];
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (): void => {const dark = theme === 'dark' || (theme !== 'light' && media.matches); document.documentElement.classList.toggle('pf-v6-theme-dark', dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light';};
    apply(); media.addEventListener('change', apply);
    try {localStorage.setItem('quay-next.theme', theme);} catch {/* Preference storage is optional. */}
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  return <div className="qn-app">
    <a className="qn-skip" href="#qn-main">Skip to content</a>
    <header className="qn-masthead"><Button variant="plain" onClick={() => setNavigation(v => !v)} aria-expanded={navigation} aria-controls="qn-navigation">Menu</Button>
      <Link to="/" className="qn-brand">QUAY <span>Next</span></Link>
      <Label color={session.runtime.mode === 'live' ? 'blue' : 'orange'}>{session.runtime.mode === 'live' ? 'Live quay.io · writes blocked' : 'Demo data · not quay.io'}</Label>
      <div className="qn-scope"><label htmlFor="qn-namespace">Namespace</label><FormSelect id="qn-namespace" value={ns} onChange={(_event, value) => navigate(`/repositories/${value}`)}>{session.runtime.namespaces.map(n => <FormSelectOption key={n} value={n} label={n} />)}</FormSelect></div>
      <div className="qn-account"><span>{session.user ?? 'Anonymous'}</span><Button variant="link" onClick={() => setLoginHelp(v => !v)}>Session help</Button></div>
      <label className="qn-theme">Theme<FormSelect aria-label="Theme" value={theme} onChange={(_event, value) => setTheme(value)}><FormSelectOption value="system" label="System" /><FormSelectOption value="light" label="Light" /><FormSelectOption value="dark" label="Dark" /></FormSelect></label>
    </header>
    <div className={`qn-body ${navigation ? 'qn-nav-open' : ''}`}>
      <nav id="qn-navigation" className="qn-nav" aria-label="Primary"><Link to={`/repositories/${ns}`} aria-current={location.pathname.startsWith('/repositories') ? 'page' : undefined}>Repositories</Link><p className="qn-muted">Read-only implementation preview. Administrative workflows are not included yet.</p></nav>
      <main id="qn-main" className="qn-main" tabIndex={-1}>
        {loginHelp && <Alert isInline variant="info" title="Authentication uses the native Quay flow">{session.runtime.mode === 'live' ? 'Enter login in the preview terminal. Complete the normal Quay sign-in or SSO flow, then return here. Enter quit to discard this isolated browser context. It does not remotely sign out your other sessions.' : 'This is a synthetic identity. Use the live preview launcher for real Quay authentication.'}</Alert>}
        {!session.user && session.features.ANONYMOUS_ACCESS === false ? <Alert isInline variant="info" title="This deployment requires sign-in. Use login in the preview terminal, then reload." /> : <ViewBoundary key={location.pathname}>
          <Routes><Route path="/" element={<Navigate to={`/repositories/${ns}`} replace />} /><Route path="/repositories/:namespace" element={<Workbench />} /><Route path="/repository/:namespace/*" element={<RepositoryPage />} /><Route path="*" element={<Alert isInline variant="info" title="This route is not implemented in the preview."><Link to="/">Repositories</Link></Alert>} /></Routes>
        </ViewBoundary>}
      </main>
    </div>
  </div>;
};
const AuthenticatedApp: React.FC<{session: Session; expire: () => void}> = ({session, expire}) => {
  const queryClient = useMemo(() => new QueryClient({defaultOptions: {queries: {retry: false, cacheTime: 300000}, mutations: {retry: false}}}), []);
  useEffect(() => {
    let checking = false; const controller = new AbortController();
    const invalidate = (): void => {session.client.resetIdentity(); void queryClient.cancelQueries(); queryClient.clear(); expire();};
    session.client.onUnauthorized = session.user ? invalidate : undefined;
    const check = async (): Promise<void> => {
      if (checking || document.visibilityState === 'hidden') return;
      checking = true;
      try {const user = await readUser(session.client, controller.signal); if (user !== session.user && !controller.signal.aborted) invalidate();}
      catch {/* An outage is not evidence of an anonymous identity. API errors remain visible. */}
      finally {checking = false;}
    };
    const focus = (): void => {void check();};
    window.addEventListener('focus', focus); const timer = setInterval(focus, 60000);
    return () => {clearInterval(timer); window.removeEventListener('focus', focus); controller.abort(); session.client.onUnauthorized = undefined; session.client.resetIdentity(); void queryClient.cancelQueries(); queryClient.clear();};
  }, [session, queryClient, expire]);
  return <SessionContext.Provider value={session}><QueryClientProvider client={queryClient}><BrowserRouter basename={PREFIX.slice(0, -1)}><Shell session={session} /></BrowserRouter></QueryClientProvider></SessionContext.Provider>;
};
export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null); const [error, setError] = useState(''); const [expired, setExpired] = useState(false);
  const expire = React.useCallback(() => setExpired(true), []);
  useEffect(() => {
    const controller = new AbortController(); const client = new ReadClient(window.location.origin);
    void (async () => {
      try {
        const response = await fetch(`${PREFIX}runtime.json`, {cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: controller.signal});
        if (!response.ok) throw new ContractError('Preview runtime configuration is missing.');
        const raw = await response.text(); if (raw.length > 16384) throw new ContractError('Runtime configuration exceeds the size limit.');
        const runtime: Runtime = parseRuntime(JSON.parse(raw) as unknown);
        if ((runtime.mode === 'live' && window.location.origin !== 'https://quay.io') || (runtime.mode === 'fixture' && !['127.0.0.1', 'localhost', '[::1]'].includes(window.location.hostname))) throw new ContractError('Preview mode/origin mismatch.');
        const [features, user] = await Promise.all([client.get('/config', parseFeatures, controller.signal), readUser(client, controller.signal)]);
        if (!controller.signal.aborted) setSession({client, runtime, features, user});
      } catch (reason) {if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not initialize the preview.');}
    })();
    return () => {controller.abort(); client.resetIdentity();};
  }, []);
  if (expired) return <div className="qn-bootstrap"><h1>Session changed</h1><Alert isInline variant="warning" title="Private views and cached data have been cleared. Use login in the preview terminal if needed, then reload." /><Button onClick={() => window.location.reload()}>Reload preview</Button></div>;
  if (!session) return <div className="qn-bootstrap"><h1>Quay Next</h1>{error ? <Alert isInline variant="danger" title={error}><Button onClick={() => window.location.reload()}>Reload</Button></Alert> : <><p>Connecting to the registry…</p><Skeleton screenreaderText="Loading runtime and identity" /><Skeleton /></>}</div>;
  return <AuthenticatedApp session={session} expire={expire} />;
};
