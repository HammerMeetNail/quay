const {test}=require('node:test');
const assert=require('node:assert/strict');
const {RequestQueue}=require('../../.next-test-output/requestQueue.js');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('page enrichment never exceeds four concurrent tasks',async()=>{
  const q=new RequestQueue(4); let active=0, peak=0;
  const results=await Promise.all(Array.from({length:25},(_,i)=>q.run(async()=>{ active++; peak=Math.max(peak,active); await delay(2); active--; return i; })));
  assert.equal(peak,4); assert.equal(active,0); assert.deepEqual(results,Array.from({length:25},(_,i)=>i));
});
test('aborted queued metadata never begins a network task',async()=>{
  const q=new RequestQueue(1), aborter=new AbortController(); let calls=0;
  const first=q.run(async()=>delay(15));
  const second=q.run(async()=>{calls++;},aborter.signal);
  const rejected=assert.rejects(second,{name:'AbortError'}); aborter.abort();
  await rejected; await first; assert.equal(calls,0);
  assert.equal(await q.run(async()=>42),42);
});
test('pre-aborted requests do not consume slots',async()=>{
  const q=new RequestQueue(1), controller=new AbortController(); controller.abort();
  await assert.rejects(q.run(async()=>{throw Error('must not execute');},controller.signal),{name:'AbortError'});
  assert.equal(await q.run(async()=>1),1);
});
test('failures release a slot and do not stall following work',async()=>{
  const q=new RequestQueue(1);
  const failed=q.run(async()=>{throw Error('failure');}); const next=q.run(async()=>7);
  await assert.rejects(failed,/failure/); assert.equal(await next,7);
});
test('queued tasks retain FIFO order',async()=>{
  const q=new RequestQueue(1), order=[];
  await Promise.all(Array.from({length:12},(_,i)=>q.run(async()=>{order.push(i); await delay(1);}))); assert.deepEqual(order,Array.from({length:12},(_,i)=>i));
});
test('an abort after acquiring a slot is observed before task invocation',async()=>{
  const q=new RequestQueue(1), controller=new AbortController(); let invoked=false;
  const result=q.run(async()=>{invoked=true;},controller.signal); controller.abort();
  await assert.rejects(result,{name:'AbortError'}); assert.equal(invoked,false);
});
test('bad concurrency values fail explicitly',()=>{
  for(const count of [0,-1,1.5,9,Infinity,NaN]) assert.throws(()=>new RequestQueue(count));
});
