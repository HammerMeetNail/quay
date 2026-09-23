/** Deliberately exact repository allowlist: no arbitrary GET or configurable upstream. */
export const LIVE_ORIGIN = 'https://quay.io';
export const PREFIX = '/__quay_next_preview__/';
export function parseScope(value = 'projectquay/quay,projectquay/clair') {
  if (typeof value !== 'string' || value.length > 20000) throw new Error('Invalid QUAY_NEXT_REPOSITORIES.');
  const repositories = [...new Set(value.split(',').map(v => v.trim()))];
  if (!repositories.length || repositories.length > 50) throw new Error('Choose 1–50 exact repositories.');
  const namespaces = new Set();
  for (const full of repositories) {
    const [ns, ...parts] = full.split('/');
    if (!/^[a-z0-9][a-z0-9_-]{0,254}$/.test(ns) || parts.length === 0 || parts.join('/').length > 512 || parts.some(p => !/^[a-z0-9]+(?:[._-]+[a-z0-9]+)*$/.test(p))) throw new Error('Use namespace/repository, separated by commas.');
    namespaces.add(ns);
  }
  if (namespaces.size > 20) throw new Error('Choose at most 20 namespaces.');
  return {namespaces: [...namespaces], repositories};
}
function query(url, fields, required = []) {
  for (const key of url.searchParams.keys()) {
    if (!Object.hasOwn(fields, key) || url.searchParams.getAll(key).length !== 1 || !fields[key](url.searchParams.get(key))) return false;
  }
  return required.every(key => url.searchParams.has(key));
}
const integer = (min, max) => value => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
const bounded = max => value => value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
export function isApprovedRead(rawUrl, method, scope, origin = LIVE_ORIGIN) {
  if (method !== 'GET') return false;
  let url; try {url = new URL(rawUrl);} catch {return false;}
  if (url.origin !== origin || url.username || url.password || url.hash || /%(?:2f|5c|2e|25)/i.test(url.pathname)) return false;
  let path; try {path = decodeURIComponent(url.pathname);} catch {return false;}
  if (/[\\%\u0000-\u001f\u007f]/.test(path)) return false;
  if (['/config', '/api/v1/user/'].includes(path)) return query(url, {});
  if (path === '/api/v1/repository') return query(url, {namespace: value => scope.namespaces.includes(value), public: value => value === 'true', last_modified: value => value === 'true', next_page: bounded(8192)}, ['namespace', 'public']);
  for (const repo of scope.repositories) {
    const base = `/api/v1/repository/${repo}`;
    if (path === base) return query(url, {includeTags: value => value === 'false'}, ['includeTags']);
    if (path === `${base}/tag/`) return query(url, {page: integer(1, 1000000), limit: integer(1, 100), onlyActiveTags: value => value === 'true', specificTag: value => /^[\w][\w.-]{0,127}$/.test(value)}, ['page', 'limit', 'onlyActiveTags']);
    if (!path.startsWith(`${base}/manifest/`)) continue;
    const match = /^(sha256:[a-f0-9]{64}|sha512:[a-f0-9]{128})(\/security|\/labels)?$/.exec(path.slice(`${base}/manifest/`.length));
    if (!match) continue;
    return match[2] === '/security' ? query(url, {vulnerabilities: value => value === 'true'}, ['vulnerabilities']) : query(url, {});
  }
  return false;
}
