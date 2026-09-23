const {test} = require('node:test');
const assert = require('node:assert/strict');
const p = require('../../.next-test-output/presentation.js');
const row = (name, visibility, modified, starred = null) => ({namespace:'acme', name, description:`The ${name} image`, visibility, modified, starred, state:'NORMAL'});
const rows = [row('worker','Private',20,true),row('base','Public',10,false),row('unknown','Not reported',null)];

test('parser only consumes genuine boolean star fields, never popularity counts', () => {
  for (const value of [undefined,null,0,5,'true',{},[]]) {
    const result = p.parseWorkbenchPage({repositories:[{namespace:'acme',name:'worker',is_starred:value,stars:42}],next_page:'opaque'});
    assert.equal(result.repositories[0].starred,null); assert.equal(result.next,'opaque');
  }
  for (const value of [true,false]) assert.equal(p.parseWorkbenchPage({repositories:[{namespace:'acme',name:'worker',is_starred:value}]}).repositories[0].starred,value);
});
test('all filters are exact and unknown visibility belongs only to all', () => {
  assert.deepEqual(p.visibleRepositories(rows,'','all','registry'), rows);
  assert.deepEqual(p.visibleRepositories(rows,'','public','registry').map(r=>r.name), ['base']);
  assert.deepEqual(p.visibleRepositories(rows,'','private','registry').map(r=>r.name), ['worker']);
  assert.deepEqual(p.visibleRepositories(rows,'','starred','registry').map(r=>r.name), ['worker']);
});
test('counts are scoped to supplied rows, not fabricated totals', () => {
  assert.deepEqual(p.pageCounts(rows), {all:3,public:1,private:1,starred:1});
  assert.deepEqual(p.pageCounts([]), {all:0,public:0,private:0,starred:0});
});
test('filter matches namespace, name and description without mutating source', () => {
  const before = JSON.stringify(rows);
  assert.equal(p.visibleRepositories(rows,'ACME/WORKER','all','registry').length,1);
  assert.equal(p.visibleRepositories(rows,'The base','public','registry').length,1);
  assert.equal(p.visibleRepositories(rows,'The base','private','registry').length,0);
  p.visibleRepositories(rows,'','all','name'); assert.equal(JSON.stringify(rows),before);
});
test('loaded-page sorts put unknown timestamps last and name is deterministic', () => {
  assert.deepEqual(p.visibleRepositories(rows,'','all','updated').map(r=>r.name),['worker','base','unknown']);
  assert.deepEqual(p.visibleRepositories(rows,'','all','name').map(r=>r.name),['base','unknown','worker']);
});
test('invalid URL display preferences fall back without broadening access', () => {
  for(const input of [null,'ALL','bad','__proto__']) { assert.equal(p.visibilityFilter(input),'all'); assert.equal(p.sortOrder(input),'registry'); }
});
test('markdown descriptions become readable plain text, not executable HTML', () => {
  assert.equal(p.descriptionText('Upstream [Project Quay](https://projectquay.io).'),'Upstream Project Quay.');
  assert.equal(p.descriptionText('![Logo](https://example.com/a.png) **Hello**'),'Logo Hello');
  assert.equal(p.descriptionText('<img src=x onerror=alert(1)>'),'<img src=x onerror=alert(1)>'); // Escaping is the React renderer's job.
  assert.equal(p.descriptionText('abc\u202edef'),'abcdef');
  assert.ok(p.descriptionText('a'.repeat(100000)).length <= 65536);
});
test('normal state is quiet, exceptions and unknown states are not hidden', () => {
  assert.equal(p.repositoryState('NORMAL'),null);
  assert.equal(p.repositoryState('READ_ONLY'),'Read only');
  assert.equal(p.repositoryState('MIRROR'),'Mirror');
  assert.equal(p.repositoryState('ORG_MIRROR'),'Organization mirror');
  assert.equal(p.repositoryState('MARKED_FOR_DELETION'),'Deletion pending');
  assert.equal(p.repositoryState('Not reported'),'State not reported');
  assert.equal(p.repositoryState('NEW_STATE'),'State: NEW_STATE');
  assert.equal(p.repositoryState('__proto__'),'State: __proto__');
  assert.equal(p.repositoryState('constructor'),'State: constructor');
});
test('timestamps distinguish missing, invalid, unix seconds and ISO strings', () => {
  assert.equal(p.timestamp(null),null); assert.equal(p.timestamp('broken'),null); assert.equal(p.timestamp(1),1000);
  assert.equal(p.timestamp('1970-01-01T00:00:01Z'),1000);
  assert.equal(p.relativeTime(null),'Not reported'); assert.equal(p.relativeTime(0,0),'Just now');
  assert.match(p.relativeTime(0,3600000),/hour/); assert.match(p.relativeTime(3600,0),/hour/);
});
test('platforms preserve OCI labels and prioritize actual amd64 and arm64', () => {
  const manifest={platforms:['windows/amd64','linux/arm64/v8','linux/ppc64le','linux/amd64','linux/amd64'].map(label=>({label,digest:'any'}))};
  assert.deepEqual(p.platformLabels(manifest),['linux/amd64','linux/arm64/v8','linux/ppc64le','windows/amd64']);
  assert.deepEqual(p.platformLabels(undefined),[]);
  assert.deepEqual(p.platformLabels({platforms:[]}),[]);
});
test('preview URL only selects a valid repository in the current namespace', () => {
  assert.equal(p.selectedRepository('acme/base/runtime','acme'),'base/runtime');
  for(const value of [null,'other/worker','acme','acme/../worker','acme/x;evil','acme/x\\y','acme/x%2fy','acme//worker']) assert.equal(p.selectedRepository(value,'acme'),null);
});
test('recent history is bounded, deduplicated, most-recent-first, and namespace-specific', () => {
  let list=[]; for(let i=0;i<10;i++) list=p.visitRepository(list,{namespace:'acme',name:`worker-${i}`});
  assert.equal(list.length,6); assert.equal(list[0].name,'worker-9');
  list=p.visitRepository(list,list[2]); assert.equal(list.length,6); assert.equal(list[0].name,'worker-7');
  list=p.visitRepository(list,{namespace:'other',name:'worker-7'}); assert.equal(list[0].namespace,'other'); assert.equal(list[1].namespace,'acme');
  assert.throws(()=>p.visitRepository(list,{namespace:'acme',name:'../bad'}));
});

test('automatic platform enrichment is capped and deduplicated even for oversized responses', () => {
  const tags = Array.from({length: 1000}, (_, i) => ({index:true, digest:`sha256:${i.toString(16).padStart(64,'0')}`}));
  const set = p.platformHydrationDigests(tags);
  assert.equal(set.size,25); assert.ok(set.has(tags[24].digest)); assert.equal(set.has(tags[25].digest),false);
  assert.equal(p.platformHydrationDigests([tags[0],tags[0],{index:true,digest:'invalid'},{index:false,digest:tags[1].digest}]).size,1);
  assert.equal(p.platformHydrationDigests([]).size,0);
});
