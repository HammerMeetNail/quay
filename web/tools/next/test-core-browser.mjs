/** Browser contract checks of the actual TS client, without React or PatternFly.
 * These checks are NOT rendered-UI or live-quay.io verification.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { startDemo } from './demo.mjs';
import { PREFIX } from './policy.mjs';
import { hashes } from './fixtures.mjs';
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = await mkdtemp(path.join(os.tmpdir(), 'quay-browser-contract-'));
let app, browser;
let passed = 0;
try {
    const result = spawnSync(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['-p', 'tsconfig.next.core.json', '--module', 'ES2022', '--outDir', path.join(directory, 'assets')], { cwd: WEB, stdio: 'inherit' });
    if (result.status !== 0)
        throw new Error('Browser contract compilation failed.');
    const files = await readdir(path.join(directory, 'assets'));
    const manifest = {};
    for (const file of files) {
        let source = await readFile(path.join(directory, 'assets', file), 'utf8');
        source = source.replace(/from (["'])(\.\.?\/[^"']+)\1/g, (_, quote, name) => `from ${quote}${name}.js${quote}`);
        await writeFile(path.join(directory, 'assets', file), source);
        manifest[`assets/${file}`] = `assets/${file}`;
    }
    await writeFile(path.join(directory, 'assets', 'runner.js'), `import * as domain from './domain.js';import {RegistryClient} from './client.js';window.harness={domain,client:new RegistryClient(location.origin)};document.getElementById('state').textContent='Ready';`);
    manifest['assets/runner.js'] = 'assets/runner.js';
    await writeFile(path.join(directory, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Core browser contract harness — not the application UI</h1><p id="state">Starting</p><script type="module" src="${PREFIX}assets/runner.js"></script></body></html>`);
    await writeFile(path.join(directory, 'asset-manifest.json'), JSON.stringify(manifest));
    app = await startDemo({ port: 0, buildDirectory: directory });
    const { chromium } = await import(process.env.QUAY_NEXT_TEST_PLAYWRIGHT_MODULE ?? '@playwright/test');
    browser = await chromium.launch({ headless: true, ...(process.env.QUAY_NEXT_TEST_BROWSER ? { executablePath: process.env.QUAY_NEXT_TEST_BROWSER } : {}) });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(app.origin + PREFIX);
    await page.waitForFunction(() => window.harness);
    async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
    await check('local assets execute at the expected origin', async () => assert.equal(await page.evaluate(() => location.origin), app.origin));
    await check('same-origin client reads the synthetic identity', async () => assert.equal(await page.evaluate(async () => { const h = window.harness; return (await h.client.get({ kind: 'identity' }, h.domain.parseIdentity)).username; }), 'demo-user'));
    await check('repository cursor round trip', async () => assert.deepEqual(await page.evaluate(async () => { const h = window.harness; const first = await h.client.get({ kind: 'repositories', namespace: 'acme' }, h.domain.parseRepositories); const next = await h.client.get({ kind: 'repositories', namespace: 'acme', cursor: first.next }, h.domain.parseRepositories); return [first.repositories.length, next.repositories.length, next.next]; }), [25, 20, null]));
    await check('tag page and exact lookup', async () => assert.deepEqual(await page.evaluate(async () => { const h = window.harness; const p = await h.client.get({ kind: 'tags', namespace: 'acme', repository: 'payments', page: 1, exactTag: 'v2.8.1' }, h.domain.parseTags); return [p.page, p.tags.length, p.tags[0].name, p.more]; }), [1, 1, 'v2.8.1', false]));
    await check('index identity and platforms retained', async () => assert.equal(await page.evaluate(async (hash) => { const h = window.harness; return (await h.client.get({ kind: 'manifest', namespace: 'acme', repository: 'payments', digest: hash }, h.domain.parseManifest)).platforms.length; }, hashes.index), 2));
    await check('no scanner request before explicit action', async () => assert.equal(app.requests.filter(r => r.path.endsWith('/security')).length, 0));
    await check('explicit per-digest security report', async () => assert.match(await page.evaluate(async (hash) => { const h = window.harness; return h.domain.evidenceLabel(await h.client.get({ kind: 'security', namespace: 'acme', repository: 'payments', digest: hash }, h.domain.parseEvidence)); }, hashes.amd), /1 high/));
    await check('missing child is a 404 error, not a clean report', async () => assert.equal(await page.evaluate(async (hash) => { try {
        const h = window.harness;
        await h.client.get({ kind: 'manifest', namespace: 'acme', repository: 'payments', digest: hash }, h.domain.parseManifest);
        return 0;
    }
    catch (e) {
        return e.status;
    } }, hashes.arm), 404));
    await check('abort before fetch stays cancelled', async () => assert.equal(await page.evaluate(async () => { const a = new AbortController(); a.abort(); try {
        await window.harness.client.get({ kind: 'config' }, x => x, a.signal);
        return 'accepted';
    }
    catch (e) {
        return e.name;
    } }), 'AbortError'));
    await check('content security policy rejects inline script', async () => { await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'window.inlineExecuted=true'; document.body.append(script); }); assert.equal(await page.evaluate(() => window.inlineExecuted), undefined); });
    await check('content security policy rejects third-party fetch', async () => assert.equal(await page.evaluate(async () => { try {
        await fetch('https://example.invalid/nope');
        return 'allowed';
    }
    catch {
        return 'blocked';
    } }), 'blocked'));
    await check('demo backend rejects writes through real browser fetch', async () => assert.equal(await page.evaluate(async () => (await fetch('/api/v1/repository/acme/payments', { method: 'DELETE' })).status), 405));
    await check('unknown asset is not served as application HTML', async () => assert.equal(await page.evaluate(async () => (await fetch('/__quay_next_preview__/assets/missing.js')).status), 404));
    console.log(`${passed} browser core/HTTP contract checks passed. React/PF rendering and live auth are NOT covered.`);
}
finally {
    if (browser)
        await browser.close();
    if (app)
        await app.close();
    await rm(directory, { recursive: true, force: true });
}
