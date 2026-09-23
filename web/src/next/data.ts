import {createContext, useContext} from 'react';
import {useQuery} from '@tanstack/react-query';
import {ReadClient, ApiError} from './client';
import {parseUser, type Runtime, type JsonObject} from './model';

export interface Session {client: ReadClient; runtime: Runtime; user: string | null; features: JsonObject;}
export const SessionContext = createContext<Session | null>(null);
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Session provider is missing.');
  return session;
}
export function useRead<T>(path: string, parser: (value: unknown) => T, enabled = true, maxBytes?: number) {
  const {client} = useSession();
  return useQuery<T, Error>({
    queryKey: ['next', client.generation, path],
    queryFn: ({signal}) => client.get(path, parser, signal, maxBytes),
    enabled, retry: false, staleTime: 15000, refetchOnWindowFocus: false,
  });
}
export async function readUser(client: ReadClient, signal?: AbortSignal): Promise<string | null> {
  try { return await client.get('/api/v1/user/', parseUser, signal); }
  catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
}
