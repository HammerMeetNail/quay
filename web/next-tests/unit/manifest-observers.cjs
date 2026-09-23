const {test} = require('node:test');
const assert = require('node:assert/strict');
const {QueryClient, QueryObserver} = require('@tanstack/react-query');
const {RequestQueue} = require('../../.next-test-output/requestQueue.js');

for (const shared of [false, true]) {
  test(`offscreen metadata ${shared ? 'preserves a shared inspector request' : 'cancels its queued network request'}`, async () => {
    const client = new QueryClient({defaultOptions: {queries: {retry: false, cacheTime: 0}}});
    const queue = new RequestQueue(1);
    let release;
    const blocker = queue.run(() => new Promise(resolve => { release = resolve; }));
    await Promise.resolve();
    let calls = 0;
    let requestSignal;
    const options = {
      queryKey: ['manifest', 'sample', 'repo', 'digest'],
      queryFn: ({signal}) => {
        requestSignal = signal;
        return queue.run(async () => { calls++; return 'platform metadata'; }, signal);
      },
    };
    const row = new QueryObserver(client, options);
    const removeRow = row.subscribe(() => {});
    let removeInspector;
    let fulfilled;
    if (shared) {
      const inspector = new QueryObserver(client, options);
      fulfilled = new Promise(resolve => {
        removeInspector = inspector.subscribe(result => { if (result.isSuccess) resolve(result.data); });
      });
    }
    // Models ActivePlatforms unmounting when IntersectionObserver leaves view.
    removeRow();
    assert.equal(requestSignal.aborted, !shared);
    release();
    await blocker;
    if (shared) assert.equal(await fulfilled, 'platform metadata');
    assert.equal(calls, shared ? 1 : 0);
    removeInspector?.();
    client.clear();
  });
}
