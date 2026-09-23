export const ORIGIN = 'https://quay.io';
export const PREFIX = '/__quay_next_preview__/';
const component = /^[a-z0-9][a-z0-9._-]{0,254}$/;
const digest = /^(sha256:[a-f0-9]{64}|sha512:[a-f0-9]{128})$/;
export function parseNamespaces(value = 'projectquay') {
    const names = value.split(',').map(x => x.trim());
    if (!names.length || names.length > 50 || names.some(x => !component.test(x) || x === '.' || x === '..')) {
        throw new Error('QUAY_NEXT_NAMESPACES must be a comma-separated list of exact namespace names.');
    }
    return [...new Set(names)];
}
// Static backend resource segments can win over the repository path converter.
// Reserve them only after the first repository component, where a shorter valid
// repository could otherwise own the request (including slash redirects).
const resourceSegments = new Set([
    'tag', 'manifest', 'permissions', 'mirror', 'logs', 'aggregatelogs', 'exportlogs',
    'trigger', 'build', 'notification', 'authorizedemail', 'tokens', 'signatures',
    'autoprunepolicy', 'immutabilitypolicy', 'changevisibility', 'changetrust', 'changestate',
]);
function validRepository(value) {
    if (typeof value !== 'string')
        return false;
    const parts = value.split('/');
    return value.length <= 1280 && parts.length >= 2 && parts.slice(1).join('/').length <= 1024 &&
        parts.every(p => component.test(p) && p !== '.' && p !== '..') &&
        !parts.slice(2).some(p => resourceSegments.has(p)) && value !== 'mirror/health';
}
export function parseRepositories(value = 'projectquay/quay') {
    const repositories = value.split(',').map(x => x.trim());
    if (!repositories.length || repositories.length > 100 || repositories.some(x => !validRepository(x)))
        throw new Error('QUAY_NEXT_REPOSITORIES must contain exact namespace/repository paths.');
    return [...new Set(repositories)];
}
function query(url, validators, required = []) {
    if (url.search.length > 10000)
        return false;
    for (const key of url.searchParams.keys()) {
        if (!Object.hasOwn(validators, key) || url.searchParams.getAll(key).length !== 1 || !validators[key](url.searchParams.get(key)))
            return false;
    }
    return required.every(key => url.searchParams.has(key));
}
const bool = x => x === 'true' || x === 'false';
const integer = (min, max) => x => /^\d+$/.test(x) && Number(x) >= min && Number(x) <= max;
const bounded = max => x => x.length <= max && !/[\u0000-\u001f\u007f]/.test(x);
/** Only reviewed reads; GET is not a generic guarantee of no side effects. */
export function approvedRead(raw, method, repositories) {
    const names = [...new Set(repositories.map(x => x.split('/')[0]))];
    if (method !== 'GET' || typeof raw !== 'string' || /[\\\u0000-\u0020\u007f]/.test(raw))
        return false;
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        return false;
    }
    if (url.origin !== ORIGIN || url.username || url.password || url.hash)
        return false;
    const rawPath = raw.slice(raw.indexOf('://') + 3).replace(/^[^/]+/, '').split(/[?#]/)[0];
    if (rawPath.includes('//') || /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath) || /%(?:2e|2f|5c|25)/i.test(rawPath))
        return false;
    let path;
    try {
        path = decodeURIComponent(url.pathname);
    }
    catch {
        return false;
    }
    if (path.includes('%') || path.includes('\\'))
        return false;
    if (['/config', '/api/v1/user/'].includes(path))
        return query(url, {});
    if (path === '/api/v1/repository')
        return query(url, {
            namespace: x => names.includes(x), public: x => x === 'true', last_modified: bool, next_page: bounded(8192),
        }, ['namespace', 'public']);
    if (!path.startsWith('/api/v1/repository/'))
        return false;
    const rest = path.slice('/api/v1/repository/'.length);
    // Match the configured repository first: security and labels are also valid
    // repository names, and become operations only after manifest/<digest>.
    const repository = repositories.find(x => validRepository(x) &&
        (rest === x || rest.startsWith(`${x}/`)) &&
        (rest.slice(x.length) === '' || rest.slice(x.length) === '/tag/' ||
            /^\/manifest\/[^/]+(?:\/(?:security|labels))?$/.test(rest.slice(x.length))));
    if (!repository)
        return false;
    const suffix = rest.slice(repository.length);
    let operation = 'repository';
    if (suffix === '/tag/')
        operation = 'tags';
    else if (suffix) {
        const [, , hash, subresource] = suffix.split('/');
        if (!digest.test(hash))
            return false;
        operation = subresource || 'manifest';
    }
    if (operation === 'repository')
        return query(url, { includeTags: x => x === 'false', includeStats: bool });
    if (operation === 'tags')
        return query(url, {
            page: integer(1, 1000000), limit: integer(1, 100), onlyActiveTags: x => x === 'true',
            specificTag: x => /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(x),
        });
    if (operation === 'security')
        return query(url, { vulnerabilities: x => x === 'true' }, ['vulnerabilities']);
    return query(url, {});
}
