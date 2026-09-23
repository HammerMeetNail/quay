import {useQuery} from '@tanstack/react-query';
import {useSession} from '../app/Session';
import {ContractError, isDigest, parseManifest} from '../lib/domain';
import {RequestQueue} from '../lib/requestQueue';
import type {RegistryClient} from '../lib/client';

// One concurrency budget per identity-bound client, not per row or render.
const queues = new WeakMap<RegistryClient, RequestQueue>();
export function useManifestMetadata(
  ns: string,
  repo: string,
  hash: string,
  enabled: boolean,
) {
  const {client} = useSession();
  let queue = queues.get(client);
  if (!queue) {
    queue = new RequestQueue(4);
    queues.set(client, queue);
  }
  const scheduler = queue;
  return useQuery({
    queryKey: ['manifest', ns, repo, hash],
    enabled: enabled && isDigest(hash),
    queryFn: ({signal}) =>
      scheduler.run(async () => {
        const result = await client.get(
          {kind: 'manifest', namespace: ns, repository: repo, digest: hash},
          parseManifest,
          signal,
        );
        if (result.digest !== hash)
          throw new ContractError(
            'The registry returned a different manifest digest.',
          );
        return result;
      }, signal),
    staleTime: 300000,
  });
}
