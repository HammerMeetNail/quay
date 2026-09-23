/** Entirely synthetic API data. Never used by a live request path or application bundle. */
export const hashes = { index: `sha256:${'a'.repeat(64)}`, amd: `sha256:${'b'.repeat(64)}`, arm: `sha256:${'c'.repeat(64)}`, single: `sha256:${'d'.repeat(64)}` };
const modified = '2026-09-22T12:00:00Z';
const repos = ['payments', 'base-images/secure-runtime', 'worker', 'archive', 'empty', ...Array.from({ length: 40 }, (_, i) => `service-${String(i + 1).padStart(2, '0')}`)].map((name, i) => ({
    name, namespace: 'acme', description: i === 1 ? 'Reusable runtime images for multiple architectures.' : `Synthetic ${name} repository for UI evaluation.`,
    is_public: i % 3 === 0, state: ['NORMAL', 'MIRROR', 'READ_ONLY', 'MARKED_FOR_DELETION'][i % 4], last_modified: 1790078400 - i * 3600,
}));
const tags = Array.from({ length: 58 }, (_, i) => ({ name: i === 0 ? 'v2.8.1' : i === 1 ? 'stable' : `v2.7.${58 - i}`,
    manifest_digest: i < 2 ? hashes.index : hashes.single, is_manifest_list: i < 2, last_modified: modified, size: i < 2 ? null : 73400320, immutable: i === 0,
    ...(i < 2 ? { child_manifests_presence: { [hashes.amd]: true, [hashes.arm]: false }, cosign_signature_manifest_digest: hashes.single } : {}),
}));
export function fixtureResponse(url, scenario = 'normal') {
    const path = decodeURIComponent(url.pathname);
    const q = url.searchParams;
    if (path === '/config')
        return [200, { features: { ANONYMOUS_ACCESS: true, SECURITY_SCANNER: scenario !== 'no-scanner' }, config: { REGISTRY_TITLE: 'Quay Next' } }];
    if (path === '/api/v1/user/')
        return scenario === 'anonymous' ? [401, { error_type: 'unauthorized' }] : [200, { anonymous: false, username: 'demo-user', organizations: [{ name: 'acme' }] }];
    if (scenario === 'unavailable')
        return [503, { error_type: 'unavailable' }];
    if (path === '/api/v1/repository') {
        if (q.get('namespace') !== 'acme')
            return [404, { error_type: 'not_found' }];
        const cursor = q.get('next_page');
        if (cursor && !/^offset:\d+$/.test(cursor))
            return [400, { error_type: 'bad_cursor' }];
        const offset = Number(cursor?.slice(7) ?? 0);
        const list = scenario === 'empty' ? [] : repos;
        return [200, { repositories: list.slice(offset, offset + 25), next_page: offset + 25 < list.length ? `offset:${offset + 25}` : null }];
    }
    const base = '/api/v1/repository/acme/';
    if (!path.startsWith(base))
        return [404, { error_type: 'not_found' }];
    const rest = path.slice(base.length);
    const name = rest.split('/tag/')[0].split('/manifest/')[0];
    const repo = repos.find(r => r.name === name);
    if (!repo)
        return [404, { error_type: 'not_found' }];
    if (!rest.includes('/tag/') && !rest.includes('/manifest/'))
        return [200, { ...repo, can_admin: true, can_write: true, description: scenario === 'hostile' ? '<img src=x onerror="window.pwned=true">' : repo.description }];
    if (rest.endsWith('/tag/')) {
        const page = Number(q.get('page') ?? 1), limit = Number(q.get('limit') ?? 25);
        if (!Number.isSafeInteger(page) || page < 1 || limit < 1 || limit > 100)
            return [400, { error_type: 'bad_page' }];
        const source = name === 'empty' ? [] : tags;
        const list = q.has('specificTag') ? source.filter(t => t.name === q.get('specificTag')) : source;
        const offset = (page - 1) * limit;
        return [200, { page, has_additional: offset + limit < list.length, tags: list.slice(offset, offset + limit) }];
    }
    const tail = rest.split('/manifest/')[1];
    if (!tail)
        return [404, { error_type: 'not_found' }];
    const [hash, kind] = tail.split('/');
    if (!Object.values(hashes).includes(hash) || hash === hashes.arm)
        return [404, { error_type: 'not_found' }];
    if (kind === 'security') {
        if (scenario === 'no-scanner')
            return [404, { error_type: 'not_found' }];
        if (scenario === 'pending')
            return [200, { status: 'queued' }];
        if (hash === hashes.index)
            return [200, { status: 'unsupported' }];
        return [200, { status: 'scanned', data: { Layer: { Features: [{ Name: 'libexample', Version: '1.0.0', Vulnerabilities: hash === hashes.amd ? [{ Name: 'DEMO-2026-001', Severity: 'High', FixedBy: '1.0.1', Link: 'https://example.com/advisory/demo' }] : [] }] } } }];
    }
    if (kind === 'labels')
        return [200, { labels: [{ key: 'org.opencontainers.image.source', value: 'https://example.com/acme/payments' }, { key: 'description', value: scenario === 'hostile' ? '<script>window.pwned=true</script>' : 'Synthetic demonstration image' }] }];
    if (kind)
        return [404, { error_type: 'not_found' }];
    const index = hash === hashes.index;
    const manifest = index ? { schemaVersion: 2, mediaType: 'application/vnd.oci.image.index.v1+json', manifests: [{ digest: hashes.amd, platform: { os: 'linux', architecture: 'amd64' } }, { digest: hashes.arm, platform: { os: 'linux', architecture: 'arm64', variant: 'v8' } }] } : { schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json', layers: [] };
    return [200, { digest: hash, is_manifest_list: index, manifest_data: JSON.stringify(manifest, null, 2), ...(index ? {} : { layers_compressed_size: 73400320 }) }];
}
