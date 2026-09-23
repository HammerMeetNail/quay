import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadClient, ApiError, ProtocolError} from '../../src/next/client.ts';
const origin = 'https://quay.io';
const json = (data, status = 200) => new Response(JSON.stringify(data), {status, headers: {'content-type': 'application/json'}});
const identity = value => value;
test('read transport sets same-origin credentials and rejects redirects', async () => {
  let observed;
  const c = new ReadClient(origin, {fetcher: async (url, init) => {observed = {url, init}; return json({ok: true});}});
  assert.deepEqual(await c.get('/config', identity), {ok: true});
  assert.equal(observed.init.method, 'GET'); assert.equal(observed.init.credentials, 'same-origin'); assert.equal(observed.init.redirect, 'error'); assert.equal(observed.init.cache, 'no-store'); assert.equal(observed.init.headers.Authorization, undefined);
  assert.equal(typeof c.post, 'undefined');
});
for (const path of ['https://evil.example', '//evil.example', '/api/v1/repository/a\\b', '/config#token', '/v2/app', '/api/v1/repository/a%2Fb', '/api/v1/repository/a%252Fb', '/config\n']) test(`reject API path ${JSON.stringify(path)}`, async () => {let called = false; const c = new ReadClient(origin, {fetcher: async () => {called = true; return json({});}}); await assert.rejects(c.get(path, identity), ProtocolError); assert.equal(called, false);});
for (const status of [401,403,404,429,500]) test(`HTTP ${status} not retried`, async () => {let n = 0; const c = new ReadClient(origin, {fetcher: async () => {n++; return json({}, status);}}); await assert.rejects(c.get('/api/v1/user/', identity), error => error instanceof ApiError && error.status === status); assert.equal(n, 1);});
test('local policy denial is distinguishable', async () => {const c = new ReadClient(origin, {fetcher: async () => json({error_type: 'preview_operation_blocked'}, 403)}); await assert.rejects(c.get('/config', identity), error => error.code === 'preview_operation_blocked');});
test('HTML login/error body never interpreted as data', async () => {const c = new ReadClient(origin, {fetcher: async () => new Response('<script>secret</script>', {headers: {'content-type': 'text/html'}})}); await assert.rejects(c.get('/config', identity), ProtocolError);});
test('malformed JSON reports a bounded generic error', async () => {const c = new ReadClient(origin, {fetcher: async () => new Response('{secret', {headers: {'content-type': 'application/json'}})}); await assert.rejects(c.get('/config', identity), error => !error.message.includes('secret'));});
test('oversized body rejected', async () => {const c = new ReadClient(origin, {fetcher: async () => json({value: 'a'.repeat(1000)})}); await assert.rejects(c.get('/config', identity, undefined, 50), ProtocolError);});
test('identity reset rejects a late response even when fetch ignores cancellation', async () => {
  let finish; const c = new ReadClient(origin, {fetcher: () => new Promise(resolve => {finish = resolve;})});
  const promise = c.get('/config', identity); const rejected = assert.rejects(promise, error => error.name === 'AbortError'); c.resetIdentity(); finish(json({private: true})); await rejected; assert.equal(c.generation, 1);
});
test('timeout rejects a late result', async () => {const c = new ReadClient(origin, {timeoutMs: 5, fetcher: async () => {await new Promise(r => setTimeout(r, 15)); return json({private: true});}}); await assert.rejects(c.get('/config', identity), error => error.name === 'AbortError');});
test('caller cancellation propagates', async () => {const controller = new AbortController(); const c = new ReadClient(origin, {fetcher: async () => {controller.abort(); return json({});}}); await assert.rejects(c.get('/config', identity, controller.signal), error => error.name === 'AbortError');});
test('unauthorized protected read notifies session owner', async () => {let events = 0; const c = new ReadClient(origin, {fetcher: async () => json({},401)}); c.onUnauthorized = () => events++; await assert.rejects(c.get('/api/v1/repository/demo/app', identity)); assert.equal(events,1);});
test('anonymous identity check does not fire expiry callback', async () => {let events = 0; const c = new ReadClient(origin, {fetcher: async () => json({},401)}); c.onUnauthorized = () => events++; await assert.rejects(c.get('/api/v1/user/', identity)); assert.equal(events,0);});
test('parser rejects invalid success contract', async () => {const c = new ReadClient(origin, {fetcher: async () => json({})}); await assert.rejects(c.get('/config', () => {throw new Error('invalid contract');}), /invalid contract/);});
