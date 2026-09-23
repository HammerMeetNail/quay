import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { ORIGIN, PREFIX, parseRepositories, approvedRead } from './policy.mjs';
import { HEADERS, loadBuild, runtimeData } from './assets.mjs';
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repositories = parseRepositories(process.env.QUAY_NEXT_REPOSITORIES);
const namespaces = [...new Set(repositories.map(x => x.split('/')[0]))];
let build = await loadBuild(path.join(WEB, 'dist-next'));
const browser = await chromium.launch({ headless: false });
// Never use a persistent profile, cookie export, ignoreHTTPSErrors or unsafe browser flags.
const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
const terminal = createInterface({ input: stdin, output: stdout });
let phase = 'preview';
let closing = false;
const closePages = async () => { for (const page of context.pages())
    await page.close(); };
async function shutdown() { if (closing)
    return; closing = true; terminal.close(); await context.close(); await browser.close(); }
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
browser.on('disconnected', () => terminal.close());
await context.route('**/*', async (route) => {
    try {
        if (phase === 'native') {
            await route.continue();
            return;
        }
        const request = route.request();
        const url = new URL(request.url());
        const own = url.origin === ORIGIN;
        if (own && request.method() === 'GET' && url.pathname === `${PREFIX}runtime.json` && !url.search) {
            await route.fulfill({ status: 200, headers: HEADERS, json: runtimeData('live', namespaces, repositories) });
            return;
        }
        const asset = own ? build.assets.get(url.pathname) : undefined;
        if (asset && request.method() === 'GET' && !url.search) {
            await route.fulfill({ status: 200, path: asset.file, contentType: asset.contentType, headers: HEADERS });
            return;
        }
        if (own && request.method() === 'GET' && request.isNavigationRequest() && request.resourceType() === 'document' && url.pathname.startsWith(PREFIX) && !url.pathname.startsWith(`${PREFIX}assets/`)) {
            await route.fulfill({ status: 200, path: build.index, contentType: 'text/html', headers: HEADERS });
            return;
        }
        if (approvedRead(request.url(), request.method(), repositories) && ['fetch', 'xhr'].includes(request.resourceType())) {
            // Playwright does not re-route every redirect hop. The trusted client
            // must use redirect: 'error'; this gate alone is not a redirect sandbox.
            // Keep browser-native same-origin, cookie and CORS enforcement: using
            // route.fetch here would move the request into the API request context.
            await route.continue();
            return;
        }
        if (own)
            await route.fulfill({ status: 403, headers: { 'cache-control': 'no-store' }, json: { error_type: 'preview_operation_blocked' } });
        else
            await route.abort('blockedbyclient');
    }
    catch {
        try {
            await route.abort('failed');
        }
        catch { /* The page may have closed. No sensitive URL logging. */ }
    }
});
await context.routeWebSocket('**/*', route => { if (phase === 'native')
    route.connectToServer();
else
    void route.close(); });
async function preview() {
    await closePages();
    phase = 'preview';
    build = await loadBuild(path.join(WEB, 'dist-next'));
    const page = await context.newPage();
    await page.goto(`${ORIGIN}${PREFIX}?namespace=${encodeURIComponent(namespaces[0])}`);
}
async function login() {
    // Destroy all local-UI pages and their workers before allowing genuine site/provider traffic.
    await closePages();
    phase = 'native';
    const page = await context.newPage();
    await page.goto(`${ORIGIN}/signin`);
    await terminal.question('Complete the genuine Quay/provider sign-in, including MFA, then press Enter here. ');
    await preview();
}
try {
    console.log(`Live quay.io, repository writes blocked. Allowed repository detail: ${repositories.join(', ')}`);
    console.log('Local code will receive your session privileges. Use trusted code and a least-privilege account.');
    console.log('No storage state, HAR, tracing, video or cookies are exported. Native mode is the real site, not read-only.');
    if (process.argv.includes('--login'))
        await login();
    else
        await preview();
    while (!closing) {
        const command = (await terminal.question('login / reload / quit > ')).trim();
        if (command === 'quit')
            break;
        if (command === 'login')
            await login();
        else if (command === 'reload')
            await preview();
    }
}
catch {
    if (!closing)
        console.error('Preview stopped. Check the build, browser installation and connectivity; no credentials were logged.');
}
finally {
    await shutdown();
}
// Deliberately do not call Quay signout: the backend may invalidate other sessions.
