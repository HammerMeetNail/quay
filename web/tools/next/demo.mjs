import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { HEADERS, loadBuild, runtimeData } from './assets.mjs';
import { PREFIX } from './policy.mjs';
import { fixtureResponse } from './fixtures.mjs';
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function startDemo({ port = 4318, scenario = 'normal', buildDirectory = path.join(WEB, 'dist-next'), apiOnly = false } = {}) {
    if (!['normal', 'anonymous', 'empty', 'unavailable', 'no-scanner', 'hostile', 'pending'].includes(scenario))
        throw new Error('Unknown fixture scenario.');
    const build = apiOnly ? null : await loadBuild(buildDirectory);
    const requests = [];
    const server = http.createServer(async (req, res) => {
        const origin = `http://127.0.0.1:${server.address().port}`;
        function json(status, value) { res.writeHead(status, { ...HEADERS, 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
        try {
            if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site')
                return json(403, { error_type: 'local_origin_rejected' });
            if (req.method !== 'GET')
                return json(405, { error_type: 'demo_read_only' });
            const url = new URL(req.url, origin);
            if (url.pathname === '/healthz')
                return json(200, { ok: true, mode: 'demo' });
            if (url.pathname === `${PREFIX}runtime.json`)
                return json(200, runtimeData('demo', ['acme']));
            if (url.pathname === '/config' || url.pathname.startsWith('/api/')) {
                requests.push({ path: url.pathname, search: url.search, method: req.method });
                if (requests.length > 2000)
                    requests.shift();
                const [status, body] = fixtureResponse(url, scenario);
                return json(status, body);
            }
            const asset = build?.assets.get(url.pathname);
            if (asset && !url.search) {
                res.writeHead(200, { ...HEADERS, 'content-type': asset.contentType });
                res.end(await readFile(asset.file));
                return;
            }
            if (build && url.pathname.startsWith(PREFIX) && !url.pathname.startsWith(`${PREFIX}assets/`) && (req.headers.accept ?? '').includes('text/html')) {
                res.writeHead(200, { ...HEADERS, 'content-type': 'text/html; charset=utf-8' });
                res.end(await readFile(build.index));
                return;
            }
            json(404, { error_type: 'not_found' });
        }
        catch {
            if (!res.headersSent)
                json(500, { error_type: 'fixture_server_error' });
            else
                res.destroy();
        }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    return { server, requests, origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve())) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const app = await startDemo({ port: Number(process.env.QUAY_NEXT_PORT ?? 4318), scenario: process.env.QUAY_NEXT_DEMO_SCENARIO ?? 'normal' });
        console.log(`Demo data only: ${app.origin}${PREFIX}`);
        const stop = async () => { await app.close(); process.exit(0); };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
    }
    catch {
        console.error('Demo could not start. Build the UI first and check the port/scenario.');
        process.exitCode = 1;
    }
}
