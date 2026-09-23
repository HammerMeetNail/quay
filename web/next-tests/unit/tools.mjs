import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadBuild } from '../../tools/next/assets.mjs';
import { startDemo } from '../../tools/next/demo.mjs';
async function build() { const dir = await mkdtemp(path.join(os.tmpdir(), 'quay-next-test-')); await mkdir(path.join(dir, 'assets')); await writeFile(path.join(dir, 'index.html'), '<h1>Harness</h1>'); await writeFile(path.join(dir, 'assets/app.js'), 'console.log("fixture");'); await writeFile(path.join(dir, 'asset-manifest.json'), JSON.stringify({ 'assets/app.js': 'assets/app.js' })); return dir; }
test('build assets have exact manifest membership', async () => { const dir = await build(); try {
    const b = await loadBuild(dir);
    assert.equal(b.assets.size, 1);
    assert.equal(b.assets.has('/__quay_next_preview__/assets/app.js'), true);
    assert.equal(b.assets.has('/__quay_next_preview__/../secret'), false);
}
finally {
    await rm(dir, { recursive: true, force: true });
} });
test('symlink escape rejected', async () => { const dir = await build(); const outside = await mkdtemp(path.join(os.tmpdir(), 'quay-outside-')); try {
    await writeFile(path.join(outside, 'secret.js'), 'SECRET');
    await symlink(path.join(outside, 'secret.js'), path.join(dir, 'assets/secret.js'));
    await writeFile(path.join(dir, 'asset-manifest.json'), JSON.stringify({ 'assets/secret.js': 'assets/secret.js' }));
    await assert.rejects(loadBuild(dir));
}
finally {
    await rm(dir, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
} });
for (const extension of ['map', 'json', 'env', 'txt'])
    test(`unapproved asset ${extension}`, async () => { const dir = await build(); try {
        await writeFile(path.join(dir, 'asset-manifest.json'), JSON.stringify({ [`assets/leak.${extension}`]: 'assets/app.js' }));
        await assert.rejects(loadBuild(dir));
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    } });
test('demo server reads actual HTTP fixture responses and forbids writes', async () => {
    const app = await startDemo({ port: 0, apiOnly: true });
    try {
        let res = await fetch(app.origin + '/api/v1/repository?namespace=acme&public=true');
        assert.equal(res.status, 200);
        const first = await res.json();
        assert.equal(first.repositories.length, 25);
        assert.ok(first.next_page);
        res = await fetch(app.origin + '/api/v1/repository?namespace=acme&public=true&next_page=' + encodeURIComponent(first.next_page));
        assert.equal((await res.json()).repositories.length, 20);
        res = await fetch(app.origin + '/api/v1/repository/acme/payments/tag/?page=2&limit=25&onlyActiveTags=true');
        const page = await res.json();
        assert.equal(page.page, 2);
        assert.equal(page.tags.length, 25);
        assert.equal(page.has_additional, true);
        res = await fetch(app.origin + '/api/v1/repository/acme/payments', { method: 'DELETE' });
        assert.equal(res.status, 405);
        res = await fetch(app.origin + '/api/v1/user/', { headers: { Origin: 'https://evil.test' } });
        assert.equal(res.status, 403);
        const hostStatus = await new Promise((resolve, reject) => { http.get(app.origin + '/healthz', { headers: { Host: 'evil.test' } }, r => { r.resume(); resolve(r.statusCode); }).on('error', reject); });
        assert.equal(hostStatus, 403);
        res = await fetch(app.origin + '/healthz', { headers: { 'Sec-Fetch-Site': 'cross-site' } });
        assert.equal(res.status, 403);
    }
    finally {
        await app.close();
    }
});
test('demo serves entry only for document requests', async () => {
    const dir = await build();
    const app = await startDemo({ port: 0, buildDirectory: dir });
    try {
        let r = await fetch(app.origin + '/__quay_next_preview__/repository/acme/payments', { headers: { Accept: 'text/html' } });
        assert.equal(r.status, 200);
        assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
        r = await fetch(app.origin + '/__quay_next_preview__/assets/missing.js');
        assert.equal(r.status, 404);
        assert.doesNotMatch(await r.text(), /<h1>/);
        r = await fetch(app.origin + '/__quay_next_preview__/runtime.json');
        const runtime = await r.json();
        assert.equal(runtime.mode, 'demo');
        assert.equal(runtime.registryHost, 'registry.example.test');
    }
    finally {
        await app.close();
        await rm(dir, { recursive: true, force: true });
    }
});
for (const scenario of ['anonymous', 'empty', 'unavailable', 'no-scanner', 'hostile', 'pending'])
    test(`fixture scenario ${scenario}`, async () => { const app = await startDemo({ port: 0, apiOnly: true, scenario }); try {
        assert.equal((await fetch(app.origin + '/healthz')).status, 200);
    }
    finally {
        await app.close();
    } });
