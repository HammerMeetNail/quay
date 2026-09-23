import {
  array,
  namespace,
  record,
  text,
  repository,
  ContractError,
} from './domain';
export const BASENAME = '/__quay_next_preview__';
export interface Runtime {
  mode: 'demo' | 'live';
  registryHost: string;
  namespaces: string[];
  initialNamespace: string;
  repositories: string[];
}
export function parseRuntime(value: unknown): Runtime {
  const x = record(value);
  if (x.mode !== 'demo' && x.mode !== 'live')
    throw new ContractError('Unknown preview mode.');
  const names = array(x.namespaces, 50).map((v) => namespace(text(v, 255)));
  const initial = namespace(text(x.initialNamespace, 255));
  if (!names.length || !names.includes(initial))
    throw new ContractError('Missing allowed namespace.');
  const host = text(x.registryHost, 255);
  if (host !== (x.mode === 'live' ? 'quay.io' : 'registry.example.test'))
    throw new ContractError('Unexpected registry target.');
  const repositories = array(x.repositories ?? [], 100).map((v) =>
    repository(text(v, 1280)),
  );
  if (
    x.mode === 'live' &&
    (!repositories.length ||
      repositories.some((p) => !names.includes(p.split('/')[0] ?? '')))
  )
    throw new ContractError('Invalid live repository scope.');
  return {
    repositories,
    mode: x.mode,
    registryHost: host,
    namespaces: [...new Set(names)],
    initialNamespace: initial,
  };
}
