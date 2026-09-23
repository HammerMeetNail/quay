import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {Alert, Button, Skeleton} from '@patternfly/react-core';
import {RegistryClient, ApiError, errorMessage} from '../lib/client';
import {
  parseConfig,
  parseIdentity,
  type Config,
  type Identity,
} from '../lib/domain';
import type {Runtime} from '../lib/runtime';
interface Session {
  client: RegistryClient;
  identity: Identity;
  config: Config;
  runtime: Runtime;
  refresh: () => void;
}
const SessionContext = createContext<Session | null>(null);
export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session provider missing.');
  return value;
}
export const SessionProvider: React.FC<{
  runtime: Runtime;
  children: React.ReactNode;
}> = ({runtime, children}) => {
  const authenticated = useRef(false);
  const [epoch, setEpoch] = useState(0);
  const [status, setStatus] = useState<{
    identity: Identity;
    config: Config;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: 15000,
            cacheTime: 300000,
          },
          mutations: {retry: false},
        },
      }),
    [epoch],
  );
  const refresh = useCallback(() => {
    authenticated.current = false;
    setStatus(null);
    setError(null);
    setEpoch((value) => value + 1);
  }, []);
  const client = useMemo(
    () =>
      new RegistryClient(
        window.location.origin,
        window.fetch.bind(window),
        () => {
          if (authenticated.current) refresh();
        },
      ),
    [epoch, refresh],
  );
  useEffect(() => {
    let active = true;
    async function bootstrap(): Promise<void> {
      try {
        const [config, identity] = await Promise.all([
          client.get({kind: 'config'}, parseConfig),
          client
            .get({kind: 'identity'}, parseIdentity)
            .catch((error: unknown) => {
              if (error instanceof ApiError && error.status === 401)
                return {kind: 'anonymous'} as const;
              throw error;
            }),
        ]);
        if (active) {
          authenticated.current = identity.kind === 'user';
          setStatus({config, identity});
        }
      } catch (error) {
        if (active) setError(errorMessage(error));
      }
    }
    void bootstrap();
    return () => {
      active = false;
      client.reset();
      void query.cancelQueries();
      query.clear();
    };
  }, [client, query]);
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > 5000) refresh();
    };
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);
  if (!status)
    return (
      <div className="qn-bootstrap">
        <h1>Quay Next</h1>
        <p>
          {runtime.mode === 'live'
            ? 'Live quay.io · repository writes blocked'
            : 'Demo data · no registry connection'}
        </p>
        {error ? (
          <Alert
            variant="danger"
            title="Could not establish the registry session"
            isInline
          >
            <p>{error}</p>
            <Button variant="secondary" onClick={refresh}>
              Retry connection
            </Button>
          </Alert>
        ) : (
          <>
            <p role="status">Checking registry and session…</p>
            <Skeleton width="75%" />
            <Skeleton width="60%" />
            <Skeleton width="85%" />
          </>
        )}
      </div>
    );
  return (
    <SessionContext.Provider value={{client, ...status, runtime, refresh}}>
      <QueryClientProvider client={query}>{children}</QueryClientProvider>
    </SessionContext.Provider>
  );
};
