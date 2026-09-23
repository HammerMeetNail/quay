import test from 'node:test';
import assert from 'node:assert/strict';
import {isApprovedRead, parseScope} from '../../tools/next/policy.mjs';
import {tagsPath, manifestPath} from '../../src/next/model.ts';
const scope = parseScope('demo/nested/app'); const base = 'https://quay.io/api/v1/repository/demo/nested/app'; const digest = 'sha256:' + 'a'.repeat(64);
const checks = [
 ['config','https://quay.io/config',true],['identity','https://quay.io/api/v1/user/',true],
 ['scoped detail',`${base}?includeTags=false`,true],['missing detail contract',base,false],
 ['tag page',`${base}/tag/?page=1&limit=25&onlyActiveTags=true`,true],
 ['namespace batch','https://quay.io/api/v1/repository?namespace=demo&public=true',true],
 ['unscoped batch','https://quay.io/api/v1/repository?public=true',false],
 ['scan',`${base}/manifest/${digest}/security?vulnerabilities=true`,true],
 ['encoded colon',`${base}/manifest/${digest.replace(':','%3A')}`,true],
 ['labels',`${base}/manifest/${digest}/labels`,true],
 ['neighbor',`${base}-other?includeTags=false`,false],['other repo','https://quay.io/api/v1/repository/demo/other?includeTags=false',false],
 ['side-effect GET','https://quay.io/api/v1/user/assignedauthorization',false],
 ['nested endpoint',`${base}/some/action?includeTags=false`,false],
 ['duplicate parameter',`${base}/tag/?page=1&page=2&limit=25&onlyActiveTags=true`,false],
 ['prototype property',`${base}?includeTags=false&toString=x`,false],
 ['unknown query',`${base}?includeTags=false&url=https://example.com`,false],
 ['wrong namespace','https://quay.io/api/v1/repository?namespace=demo2&public=true',false],
 ['userinfo',base.replace('https://','https://user:secret@')+'?includeTags=false',false],
 ['bad host',base.replace('quay.io','quay.io.example.com')+'?includeTags=false',false],
 ['wrong scheme',base.replace('https:','http:')+'?includeTags=false',false],
 ['encoded slash',base.replace('nested/app','nested%2Fapp')+'?includeTags=false',false],
 ['double-encoded slash',base.replace('nested/app','nested%252Fapp')+'?includeTags=false',false],
 ['unsupported digest',`${base}/manifest/md5:${'a'.repeat(32)}`,false],
 ['huge tag page',`${base}/tag/?page=1&limit=1000&onlyActiveTags=true`,false],
 ['page zero',`${base}/tag/?page=0&limit=25&onlyActiveTags=true`,false],
 ['invalid tag',`${base}/tag/?page=1&limit=25&onlyActiveTags=true&specificTag=a%0Ab`,false],
 ['no history sweep',`${base}/tag/?page=1&limit=25&onlyActiveTags=false`,false],
 ['v2 protocol','https://quay.io/v2/demo/nested/app/manifests/latest',false],
 ['auth mutation route','https://quay.io/api/v1/signout',false],
];
for (const [name,url,expected] of checks) test(name, () => assert.equal(isApprovedRead(url,'GET',scope),expected));
for (const method of ['POST','PUT','PATCH','DELETE','HEAD','OPTIONS','CONNECT','TRACE']) test(`blocks ${method}`, () => assert.equal(isApprovedRead('https://quay.io/config',method,scope),false));
for (const raw of ['', 'demo', 'demo/..', 'demo/app;id', 'demo/a\nb', 'demo/app,,demo/other']) test(`scope rejects ${JSON.stringify(raw)}`, () => assert.throws(() => parseScope(raw)));
test('scope deduplicates exact repo names', () => assert.deepEqual(parseScope('demo/app,demo/app').repositories,['demo/app']));
test('frontend paths and policy agree', () => {assert.equal(isApprovedRead(new URL(tagsPath('demo','nested/app',1,'v1'),'https://quay.io').href,'GET',scope),true); assert.equal(isApprovedRead(new URL(manifestPath('demo','nested/app',digest),'https://quay.io').href,'GET',scope),true);});
