import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedRead, parseRepositories } from '../../tools/next/policy.mjs';
const scope = ['acme/nested/app', 'acme/payments'];
const base = 'https://quay.io/api/v1/repository/acme/nested/app';
const hash = `sha256:${'a'.repeat(64)}`;
const cases = [
    ['config', 'https://quay.io/config', 'GET', true], ['user', 'https://quay.io/api/v1/user/', 'GET', true], ['detail', base, 'GET', true],
    ['tags', `${base}/tag/?page=1&limit=25&onlyActiveTags=true`, 'GET', true], ['exact tag', `${base}/tag/?specificTag=v1`, 'GET', true],
    ['scan', `${base}/manifest/${hash}/security?vulnerabilities=true`, 'GET', true], ['manifest', `${base}/manifest/${hash.replace(':', '%3A')}`, 'GET', true], ['labels', `${base}/manifest/${hash}/labels`, 'GET', true],
    ['namespace list', 'https://quay.io/api/v1/repository?namespace=acme&public=true', 'GET', true],
    ['GET with side effect', 'https://quay.io/api/v1/user/assignedauthorization', 'GET', false], ['unapproved repo', base + '2', 'GET', false],
    ['unapproved endpoint', base + '/permissions/user/joe', 'GET', false], ['unapproved statistics', base + '/tag/latest/pull_statistics', 'GET', false],
    ['all namespaces', 'https://quay.io/api/v1/repository?public=true', 'GET', false], ['wrong namespace', 'https://quay.io/api/v1/repository?namespace=acme2&public=true', 'GET', false],
    ['double query', base + '?includeTags=false&includeTags=true', 'GET', false], ['extra query', base + '?url=http://evil', 'GET', false], ['prototype query', base + '?toString=x', 'GET', false],
    ['zero page', base + '/tag/?page=0', 'GET', false], ['big limit', base + '/tag/?limit=1000', 'GET', false], ['wrong tag syntax', base + '/tag/?specificTag=x%3Bwhoami', 'GET', false],
    ['encoded slash', base.replace('nested/app', 'nested%2fapp'), 'GET', false], ['double-encoded slash', base.replace('nested/app', 'nested%252fapp'), 'GET', false],
    ['traversal', base + '/../app', 'GET', false], ['encoded traversal', base + '/%2e%2e/app', 'GET', false], ['raw slash normalization', base.replace('nested/app', 'nested//app'), 'GET', false],
    ['bad percent', base + '/manifest/%GG', 'GET', false], ['fragment', base + '#token', 'GET', false], ['userinfo', base.replace('https://', 'https://user:pass@'), 'GET', false],
    ['wrong host', base.replace('quay.io', 'quay.io.evil.test'), 'GET', false], ['wrong scheme', base.replace('https:', 'http:'), 'GET', false],
    ['unapproved registry API', 'https://quay.io/v2/acme/nested/app/tags/list', 'GET', false], ['csrf not needed in read-only client', 'https://quay.io/csrf_token', 'GET', false],
    ['missing hash', base + '/manifest/sha256:123', 'GET', false], ['scan missing explicit query', `${base}/manifest/${hash}/security`, 'GET', false],
];
for (const [name, url, method, expected] of cases)
    test(name, () => assert.equal(approvedRead(url, method, scope), expected));
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'CONNECT'])
    test(`blocks ${method}`, () => assert.equal(approvedRead(base, method, scope), false));
for (const value of ['acme', 'acme/../app', 'acme//app', 'acme/app;id', '', 'a/', 'a/b\\c'])
    test(`invalid scope ${value}`, () => assert.throws(() => parseRepositories(value)));
test('default scope', () => assert.deepEqual(parseRepositories(), ['projectquay/quay']));
test('explicit scope deduplication', () => assert.deepEqual(parseRepositories('acme/app,acme/app,acme/nested/app'), ['acme/app', 'acme/nested/app']));
// Method fuzz sweep: only literal GET can pass.
test('method case and generated garbage cannot widen policy', () => { for (const method of ['get', 'Get', ...Array.from({ length: 100 }, (_, i) => `GET${i}`)])
    assert.equal(approvedRead(base, method, scope), false); });

// Each resource has a backend route that could capture a shorter repository.
for (const suffix of [
    'permissions/user/joe', 'permissions/team/devs', 'mirror', 'mirror/sync-now',
    'logs', 'aggregatelogs', 'exportlogs', 'trigger', 'trigger/id/sources',
    'build/id/logs', 'notification/id/test', 'authorizedemail/a', 'tokens/code',
    'signatures', 'autoprunepolicy/id', 'immutabilitypolicy/id',
    'changevisibility', 'changetrust', 'changestate', 'tag/latest', 'manifest/latest',
]) {
    for (const prefix of ['acme/app', 'acme/nested/app']) {
        const repository = `${prefix}/${suffix}`;
        test(`reject ambiguous repository ${repository}`, () => {
            assert.throws(() => parseRepositories(repository));
            // Policy remains closed even if a caller bypasses the config parser.
            for (const operation of ['', '/tag/', `/manifest/${hash}`, `/manifest/${hash}/labels`, `/manifest/${hash}/security?vulnerabilities=true`])
                assert.equal(approvedRead(`https://quay.io/api/v1/repository/${repository}${operation}`, 'GET', [repository]), false);
        });
    }
}
test('static mirror health endpoint cannot become repository detail', () => {
    assert.throws(() => parseRepositories('mirror/health'));
    assert.equal(approvedRead('https://quay.io/api/v1/repository/mirror/health', 'GET', ['mirror/health']), false);
});
for (const repository of ['acme/security', 'acme/labels', 'acme/nested/security', 'acme/nested/labels', 'acme/security/labels', 'acme/mirror', 'acme/trigger']) {
    test(`all approved operations for ${repository}`, () => {
        const repositories = parseRepositories(repository);
        for (const operation of ['', '?includeTags=false&includeStats=true', '/tag/?page=1&limit=25', `/manifest/${hash}`, `/manifest/${hash}/labels`, `/manifest/${hash}/security?vulnerabilities=true`])
            assert.equal(approvedRead(`https://quay.io/api/v1/repository/${repository}${operation}`, 'GET', repositories), true, operation);
    });
}
test('overlapping ordinary nested scopes match independently of configuration order', () => {
    for (const repositories of [['acme/app', 'acme/app/nested/security'], ['acme/app/nested/security', 'acme/app']])
        for (const repository of repositories)
            assert.equal(approvedRead(`https://quay.io/api/v1/repository/${repository}`, 'GET', repositories), true);
});
