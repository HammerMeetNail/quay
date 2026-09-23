const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('../../.next-test-output/domain.js');
const o = require('../../.next-test-output/operations.js');
const r = require('../../.next-test-output/runtime.js');
const sha = `sha256:${'a'.repeat(64)}`;
const sha512 = `sha512:${'b'.repeat(128)}`;
for (const value of ['acme', 'a', 'base-images', 'owner_2', 'my.namespace'])
    test(`namespace accepts ${value}`, () => assert.equal(d.namespace(value), value));
for (const value of ['../foo', '.', '..', 'A', 'a/b', 'foo;id', 'foo\n', '', 'x'.repeat(256)])
    test(`namespace rejects ${JSON.stringify(value)}`, () => assert.throws(() => d.namespace(value)));
for (const value of ['image', 'nested/path/image', 'a-b/c.d/e_f'])
    test(`nested repo ${value}`, () => assert.equal(d.repository(value), value));
for (const value of ['foo//bar', '/foo', 'foo/', 'foo/../bar', 'foo/./bar', 'foo\\bar', '$(whoami)', 'image\r\n'])
    test(`invalid repo ${JSON.stringify(value)}`, () => assert.throws(() => d.repository(value)));
for (const value of [sha, sha512])
    test(`digest ${value.slice(0, 6)}`, () => assert.equal(d.digest(value), value));
for (const value of ['sha256:abc', `sha256:${'A'.repeat(64)}`, `md5:${'a'.repeat(32)}`, `${sha};id`, `${sha}\n`])
    test(`invalid hash ${value.slice(-15)}`, () => assert.throws(() => d.digest(value)));
test('exact immutable commands never contain ellipsis or a newline', () => assert.equal(d.immutableCommand('quay.io', 'acme', 'nested/app', sha, 'podman'), `podman pull quay.io/acme/nested/app@${sha}`));
test('docker command', () => assert.equal(d.immutableCommand('quay.io', 'acme', 'app', sha512, 'docker'), `docker pull quay.io/acme/app@${sha512}`));
for (const host of ['quay.io;id', 'https://quay.io', 'evil.test/', 'user:pass@quay.io', 'quay.io\n'])
    test(`bad host ${host}`, () => assert.throws(() => d.immutableCommand(host, 'acme', 'app', sha, 'podman')));
test('runtime container tool validation', () => assert.throws(() => d.immutableCommand('quay.io', 'acme', 'app', sha, 'sh')));
test('abbreviation never changes source', () => { assert.equal(d.abbreviated('short'), 'short'); assert.match(d.abbreviated(sha), /…/); assert.equal(sha.length, 71); });
test('anonymous explicit state', () => assert.deepEqual(d.parseIdentity({ anonymous: true }), { kind: 'anonymous' }));
test('identity normalizes authorized scopes', () => assert.deepEqual(d.parseIdentity({ username: 'person', organizations: [{ name: 'acme' }, { name: 'acme' }] }), { kind: 'user', username: 'person', namespaces: ['person', 'acme'] }));
test('missing identity fails closed', () => assert.throws(() => d.parseIdentity({})));
test('config missing flags are unknown', () => assert.deepEqual(d.parseConfig({}), { anonymous: null, scanner: null, title: 'Quay' }));
test('permission strings do not grant admin', () => assert.equal(d.parseRepositoryDetails({ can_admin: 'true', can_write: 'true' }).access, 'Read access'));
test('missing repository list is a contract error', () => assert.throws(() => d.parseRepositories({})));
test('opaque cursor retained', () => assert.equal(d.parseRepositories({ repositories: [], next_page: 'a+/=&b' }).next, 'a+/=&b'));
test('zero numeric fields are not omitted', () => assert.equal(d.bytesLabel(0), '0 B'));
test('unknown bytes never zero', () => assert.equal(d.bytesLabel(null), 'Not reported'));
test('invalid bytes', () => assert.equal(d.bytesLabel(-1), 'Not reported'));
test('binary units', () => assert.equal(d.bytesLabel(1048576), '1.0 MiB'));
test('unknown date', () => assert.equal(d.dateLabel(null), 'Not reported'));
test('invalid date', () => assert.equal(d.dateLabel('not-a-date'), 'Not reported'));
const tag = { name: 'v1', manifest_digest: sha, is_manifest_list: true, child_manifests_presence: { [sha512]: false } };
test('tags require positive pages', () => assert.throws(() => d.parseTags({ tags: [], page: 0, has_additional: false })));
test('sparse presence and unknown immutable state', () => { const t = d.parseTags({ tags: [tag], page: 1, has_additional: true }).tags[0]; assert.equal(t.presence[sha512], false); assert.equal(t.immutable, null); assert.equal(t.signature, false); });
test('unsupported digest can be displayed without being fetchable', () => { const t = d.parseTags({ tags: [{ ...tag, manifest_digest: 'future:abc' }], page: 1, has_additional: false }).tags[0]; assert.equal(t.digest, 'future:abc'); assert.throws(() => o.operationPath({ kind: 'manifest', namespace: 'acme', repository: 'app', digest: t.digest })); });
test('manifest parsing retains index/child identity', () => { const m = d.parseManifest({ digest: sha, is_manifest_list: true, manifest_data: JSON.stringify({ manifests: [{ digest: sha512, platform: { os: 'linux', architecture: 'arm64', variant: 'v8' } }] }) }); assert.equal(m.platforms[0].label, 'linux/arm64/v8'); assert.equal(m.platforms[0].digest, sha512); assert.equal(m.compressedBytes, null); });
test('invalid inner manifest JSON', () => assert.throws(() => d.parseManifest({ digest: sha, is_manifest_list: false, manifest_data: '{' })));
test('oversized inner manifest', () => assert.throws(() => d.parseManifest({ digest: sha, is_manifest_list: false, manifest_data: ' '.repeat(2 * 1024 * 1024 + 1) })));
test('labels remain inert text', () => assert.deepEqual(d.parseLabels({ labels: [{ key: 'x', value: '<script>alert(1)</script>' }] }), [{ key: 'x', value: '<script>alert(1)</script>' }]));
for (const url of ['javascript:alert(1)', 'data:text/html,hello', 'http://example.com', 'https://user:pass@example.com', 'https://example.com\n', '/relative'])
    test(`unsafe advisory ${url}`, () => assert.equal(d.safeWebUrl(url), null));
test('https advisory', () => assert.equal(d.safeWebUrl('https://example.com/advisory'), 'https://example.com/advisory'));
for (const status of ['queued', 'indexing', 'scanning'])
    test(`pending ${status}`, () => assert.equal(d.evidenceLabel(d.parseEvidence({ status })), 'Scanning'));
for (const status of ['unsupported', 'not_supported'])
    test(`unsupported ${status}`, () => assert.equal(d.evidenceLabel(d.parseEvidence({ status })), 'Not supported'));
test('unknown scanner status is not zero findings', () => assert.equal(d.evidenceLabel(d.parseEvidence({ status: 'surprise' })), 'Report unavailable'));
test('missing Features is not a clean report', () => assert.throws(() => d.parseEvidence({ status: 'scanned', data: { Layer: {} } })));
test('explicit empty report uses factual language', () => assert.equal(d.evidenceLabel(d.parseEvidence({ status: 'scanned', data: { Layer: { Features: [] } } })), 'No vulnerabilities reported'));
test('unrequested evidence', () => assert.equal(d.evidenceLabel(undefined), 'Not loaded'));
test('report findings count package instances, not unique CVEs', () => { const value = d.parseEvidence({ status: 'scanned', data: { Layer: { Features: [{ Name: 'pkg', Version: '1', Vulnerabilities: [{ Name: 'DEMO', Severity: 'High', FixedBy: '2', Link: 'javascript:alert(1)' }] }] } } }); assert.equal(value.findings[0].url, null); assert.equal(value.findings[0].fix, '2'); assert.match(d.evidenceLabel(value), /1 high/); });
test('exact tag encoded, not filter syntax', () => { const p = o.operationPath({ kind: 'tags', namespace: 'acme', repository: 'nested/app', page: 1, exactTag: 'v1_amd64' }); assert.match(p, /specificTag=v1_amd64/); assert.match(p, /page=1/); assert.doesNotMatch(p, /filter_tag_name/); });
test('cursor cannot inject a query', () => assert.match(o.operationPath({ kind: 'repositories', namespace: 'acme', cursor: 'x&namespace=evil' }), /next_page=x%26namespace%3Devil/));
test('invalid tag page rejected', () => assert.throws(() => o.operationPath({ kind: 'tags', namespace: 'acme', repository: 'app', page: 0 })));
test('invalid cursor rejected', () => assert.throws(() => o.operationPath({ kind: 'repositories', namespace: 'acme', cursor: 'x\n' })));
for (const value of [null, '', '0', '-1', '01', '1e3', '1000001', '<script>'])
    test(`page input ${value}`, () => assert.equal(o.pageNumber(value), 1));
test('valid page', () => assert.equal(o.pageNumber('25'), 25));
for (const [width, font, forced, expected] of [[1152, 16, false, true], [1151, 16, false, false], [2304, 32, false, true], [1500, 16, true, false], [1000, 0, false, false], [NaN, 16, false, false], [1440, 20, false, true]])
    test(`inspector ${width}/${font}/${forced}`, () => assert.equal(o.shouldUseInspector(width, font, forced), expected));
test('demo runtime is explicit and synthetic', () => assert.equal(r.parseRuntime({ mode: 'demo', registryHost: 'registry.example.test', namespaces: ['acme'], initialNamespace: 'acme' }).mode, 'demo'));
test('live runtime requires exact repo scope', () => assert.throws(() => r.parseRuntime({ mode: 'live', registryHost: 'quay.io', namespaces: ['acme'], initialNamespace: 'acme' })));
test('runtime cannot claim arbitrary backend host', () => assert.throws(() => r.parseRuntime({ mode: 'live', registryHost: 'evil.example', namespaces: ['acme'], initialNamespace: 'acme', repositories: ['acme/app'] })));
test('runtime scope must fit namespaces', () => assert.throws(() => r.parseRuntime({ mode: 'live', registryHost: 'quay.io', namespaces: ['acme'], initialNamespace: 'acme', repositories: ['other/app'] })));
