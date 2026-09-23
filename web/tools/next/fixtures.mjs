import {createHash} from 'node:crypto';
import {parseScope} from './policy.mjs';
export const HASH = seed => 'sha256:' + createHash('sha256').update(seed).digest('hex');
export const INDEX = HASH('fixture-index');
export const AMD64 = HASH('fixture-amd64');
export const ARM64 = HASH('fixture-arm64');
export const fixtureRepos = ['payments', 'worker', 'base', 'empty', 'unavailable', 'nested/artifact-service', 'readonly', 'mirror'];
export const fixtureScope = parseScope(fixtureRepos.map(r => `demo/${r}`).join(','));
export const fixtureRuntime = {mode: 'fixture', ...fixtureScope};
const repo = name => ({namespace: 'demo', name, description: name === 'payments' ? 'Synthetic payment images. No production data.' : name === 'worker' ? '<img src=x onerror=alert(1)> renders as text, never HTML.' : `Fixture repository: ${name}`, is_public: name === 'base', state: name === 'readonly' ? 'READ_ONLY' : name === 'mirror' ? 'MIRROR' : 'NORMAL'});
export function fixtureReply(url) {
  const path = decodeURIComponent(url.pathname);
  if (path === '/config') return {features: {ANONYMOUS_ACCESS: true, SECURITY_SCANNER: true}};
  if (path === '/api/v1/user/') return {anonymous: false, username: 'demo'};
  if (path === '/api/v1/repository') return {repositories: fixtureRepos.map(repo), next_page: null};
  for (const name of fixtureRepos) {
    const base = `/api/v1/repository/demo/${name}`;
    if (path === base) return repo(name);
    if (path === `${base}/tag/`) {
      const page = Number(url.searchParams.get('page') || '1');
      let tags = name === 'empty' ? [] : Array.from({length: 35}, (_, i) => ({name: i === 0 ? 'v2.8.1' : i === 1 ? 'stable' : `v2.${35 - i}.0`, manifest_digest: i < 2 ? INDEX : HASH(`tag-${i}`), is_manifest_list: i < 2, last_modified: '2026-09-22T12:00:00Z', immutable: i === 0, ...(i < 2 ? {child_manifest_count: 2, child_manifests_presence: {[AMD64]: true, [ARM64]: false}, cosign_signature_tag: 'sha256-example.sig'} : {})}));
      const specific = url.searchParams.get('specificTag');
      if (specific) tags = tags.filter(t => t.name === specific);
      return {tags: tags.slice((page - 1) * 25, page * 25), page, has_additional: page * 25 < tags.length};
    }
    if (!path.startsWith(`${base}/manifest/`)) continue;
    const [digest, section] = path.slice(`${base}/manifest/`.length).split('/');
    if (section === 'security') return {status: 'scanned', data: {Layer: {Features: [{Name: 'example-package', Version: '1.0', Vulnerabilities: [{Name: 'EXAMPLE-ADVISORY', Severity: 'High', FixedBy: '1.1', Link: 'https://example.com/advisory'}]}]}}};
    if (section === 'labels') return {labels: [{key: 'org.opencontainers.image.description', value: '<script>not executable</script>'}, {key: 'example.fixture', value: 'Synthetic data, not a verified image.'}]};
    if (!section) return {digest, is_manifest_list: digest === INDEX, layers_compressed_size: digest === INDEX ? null : 12582912, manifest_data: JSON.stringify(digest === INDEX ? {schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: [{digest: AMD64, platform: {os: 'linux', architecture: 'amd64'}}, {digest: ARM64, platform: {os: 'linux', architecture: 'arm64'}}]} : {schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', layers: []}, null, 2)};
  }
  return null;
}
