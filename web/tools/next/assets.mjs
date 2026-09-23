import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {PREFIX} from './policy.mjs';
export const HEADERS = {
  'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; worker-src 'none'",
};
const types = {'.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'};
export async function loadBuild(directory) {
  const root = await realpath(directory);
  async function read(relative, limit) {
    const filename = await realpath(path.resolve(root, relative));
    if (!filename.startsWith(root + path.sep)) throw new Error('Build asset escaped its directory.');
    const info = await stat(filename);
    if (!info.isFile() || info.size > limit) throw new Error('Build asset exceeds size/type limits.');
    const buffer = await readFile(filename);
    if (buffer.byteLength > limit) throw new Error('Build asset grew beyond its limit.');
    return buffer;
  }
  const manifest = JSON.parse((await read('asset-manifest.json', 65536)).toString('utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || Object.keys(manifest).length > 256) throw new Error('Invalid build asset manifest.');
  const assets = new Map(); let total = 0;
  for (const [name, relative] of Object.entries(manifest)) {
    if (!/^assets\/[a-zA-Z0-9._-]+$/.test(name) || name !== relative || !types[path.extname(name)]) throw new Error('Unapproved build asset.');
    const body = await read(relative, 16 * 1024 * 1024); total += body.length;
    if (total > 64 * 1024 * 1024) throw new Error('Build exceeds preview size limit.');
    assets.set(PREFIX + name, {body, contentType: types[path.extname(name)]});
  }
  if (![...assets.keys()].some(name => name.endsWith('.js'))) throw new Error('No JavaScript entry in build.');
  return {assets, index: await read('index.html', 1024 * 1024)};
}
export function localResponse(rawUrl, method, documentRequest, origin, build, runtime) {
  let url; try {url = new URL(rawUrl);} catch {return null;}
  if (url.origin !== origin || method !== 'GET' || url.username || url.password || url.hash) return null;
  const json = {contentType: 'application/json', headers: HEADERS};
  if (url.pathname === `${PREFIX}runtime.json` && !url.search) return {...json, body: Buffer.from(JSON.stringify(runtime))};
  const asset = build.assets.get(url.pathname);
  if (asset && !url.search) return {...asset, headers: HEADERS};
  if (documentRequest && url.search.length < 20000 && url.pathname.startsWith(PREFIX) && !url.pathname.startsWith(`${PREFIX}assets/`) && !url.pathname.includes('%') && url.pathname !== `${PREFIX}runtime.json`) return {body: build.index, contentType: 'text/html', headers: HEADERS};
  return null;
}
