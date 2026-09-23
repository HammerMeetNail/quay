import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { PREFIX } from './policy.mjs';
export const HEADERS = Object.freeze({
    'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
});
const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
export async function loadBuild(directory) {
    const dist = await realpath(directory);
    async function inside(relative) {
        if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).some(x => x === '..'))
            throw new Error('Invalid build path.');
        const file = await realpath(path.resolve(dist, relative));
        if (!file.startsWith(`${dist}${path.sep}`))
            throw new Error('Build path escaped output directory.');
        const info = await stat(file);
        if (!info.isFile() || info.size > 12 * 1024 * 1024)
            throw new Error('Invalid or oversized build asset.');
        return file;
    }
    const manifestFile = await inside('asset-manifest.json');
    if ((await stat(manifestFile)).size > 1024 * 1024)
        throw new Error('Oversized asset manifest.');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    if (!manifest || Array.isArray(manifest) || typeof manifest !== 'object')
        throw new Error('Invalid asset manifest.');
    const assets = new Map();
    for (const [name, relative] of Object.entries(manifest)) {
        if (!/^assets\/[a-zA-Z0-9_.\/-]+$/.test(name) || name.split('/').some(x => x === '..'))
            throw new Error('Invalid public asset name.');
        const contentType = types[path.extname(name)];
        if (!contentType)
            throw new Error('Unapproved asset type.');
        assets.set(`${PREFIX}${name}`, { file: await inside(relative), contentType });
    }
    if (!assets.size)
        throw new Error('Build contains no assets.');
    return { assets, index: await inside('index.html') };
}
export function runtimeData(mode, namespaces, repositories = []) {
    return { mode, namespaces, repositories, initialNamespace: namespaces[0], registryHost: mode === 'live' ? 'quay.io' : 'registry.example.test' };
}
