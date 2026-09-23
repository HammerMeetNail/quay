import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {HEADERS, loadBuild, localResponse} from './assets.mjs';
import {PREFIX, isApprovedRead} from './policy.mjs';
import {fixtureRuntime, fixtureReply, fixtureScope} from './fixtures.mjs';
export async function startFixtureServer({directory, port = 9001}) {
  let origin;
  const build = await loadBuild(directory);
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) {res.writeHead(403); res.end(); return;}
      if (req.method !== 'GET') {res.writeHead(405, {Allow: 'GET'}); res.end(); return;}
      const url = new URL(req.url, origin);
      if (url.pathname === '/') {res.writeHead(302, {Location: PREFIX}); res.end(); return;}
      if (isApprovedRead(url.href, req.method, fixtureScope, origin)) {
        if (url.pathname.includes('/unavailable')) {res.writeHead(503, {...HEADERS, 'content-type': 'application/json'}); res.end(JSON.stringify({error_type: 'fixture_unavailable'})); return;}
        const reply = fixtureReply(url);
        res.writeHead(reply ? 200 : 404, {...HEADERS, 'content-type': 'application/json'}); res.end(JSON.stringify(reply ?? {error_type: 'not_found'})); return;
      }
      const local = localResponse(url.href, req.method, req.headers['sec-fetch-dest'] === 'document' || (req.headers.accept ?? '').includes('text/html'), origin, build, fixtureRuntime);
      if (local) {res.writeHead(200, {...local.headers, 'content-type': local.contentType}); res.end(local.body); return;}
      res.writeHead(404, {...HEADERS, 'content-type': 'application/json'}); res.end(JSON.stringify({error_type: 'preview_operation_blocked'}));
    } catch {res.writeHead(503, {...HEADERS, 'content-type': 'text/plain'}); res.end('Build unavailable. Run node next.mjs build.');}
  });
  await new Promise((resolve, reject) => {server.once('error', reject); server.listen(port, '127.0.0.1', resolve);});
  origin = `http://127.0.0.1:${server.address().port}`;
  return {server, origin, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const instance = await startFixtureServer({directory: process.argv[2] ?? 'dist-next', port: Number(process.env.QUAY_NEXT_PORT ?? 9001)});
  console.log(`Demo data only: ${instance.origin}${PREFIX}`);
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => {void instance.close().then(() => process.exit(0));});
}
