import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {loadBuild, localResponse, HEADERS} from '../../tools/next/assets.mjs';
import {startFixtureServer} from '../../tools/next/server.mjs';
import {fixtureRuntime} from '../../tools/next/fixtures.mjs';
import {PREFIX} from '../../tools/next/policy.mjs';
async function build(t) {
 const dir = await mkdtemp(path.join(tmpdir(),'qn-test-')); t.after(() => rm(dir,{recursive:true,force:true}));
 await mkdir(path.join(dir,'assets')); await writeFile(path.join(dir,'index.html'),'<html><body>fixture</body></html>'); await writeFile(path.join(dir,'assets','main.js'),'void 0;');
 await writeFile(path.join(dir,'asset-manifest.json'),JSON.stringify({'assets/main.js':'assets/main.js'})); return dir;
}
test('only manifest-listed assets are served',async t => {const b = await loadBuild(await build(t)); const url = `https://quay.io${PREFIX}`; assert.equal(localResponse(url+'assets/main.js','GET',false,'https://quay.io',b,fixtureRuntime).contentType,'text/javascript'); assert.equal(localResponse(url+'assets/.env','GET',false,'https://quay.io',b,fixtureRuntime),null); assert.equal(localResponse(url+'assets/main.js?query=x','GET',false,'https://quay.io',b,fixtureRuntime),null);});
test('deep links containing repository dots receive only the index',async t => {const b=await loadBuild(await build(t)); assert.equal(localResponse(`https://quay.io${PREFIX}repository/demo/app.v2?artifact=abc`,'GET',true,'https://quay.io',b,fixtureRuntime).contentType,'text/html');});
test('unknown fetch is not given SPA HTML',async t => {const b=await loadBuild(await build(t)); assert.equal(localResponse(`https://quay.io${PREFIX}.env`,'GET',false,'https://quay.io',b,fixtureRuntime),null);});
test('runtime is local data, not executable script',async t => {const b=await loadBuild(await build(t)); const r=localResponse(`https://quay.io${PREFIX}runtime.json`,'GET',false,'https://quay.io',b,fixtureRuntime); assert.equal(r.contentType,'application/json'); assert.equal(JSON.parse(r.body).mode,'fixture'); assert.ok(!HEADERS['content-security-policy'].includes('unsafe-eval'));});
test('manifest cannot name an arbitrary source file',async t => {const dir=await build(t); await writeFile(path.join(dir,'asset-manifest.json'),JSON.stringify({'assets/main.js':'../secret'})); await assert.rejects(loadBuild(dir));});
test('symlink escaping the build root is rejected',async t => {const dir=await build(t); const outer=await mkdtemp(path.join(tmpdir(),'qn-secret-')); t.after(()=>rm(outer,{recursive:true,force:true})); await writeFile(path.join(outer,'secret.js'),'secret'); await rm(path.join(dir,'assets','main.js')); await symlink(path.join(outer,'secret.js'),path.join(dir,'assets','main.js')); await assert.rejects(loadBuild(dir),/escaped/);});
test('source maps cannot be added to manifest',async t => {const dir=await build(t); await writeFile(path.join(dir,'asset-manifest.json'),JSON.stringify({'assets/main.js.map':'assets/main.js.map'})); await assert.rejects(loadBuild(dir));});
test('fixture server enforces Host Origin and GET-only policy',async t => {
 const instance=await startFixtureServer({directory:await build(t),port:0}); t.after(()=>instance.close());
 assert.equal((await fetch(instance.origin+'/config')).status,200);
 assert.equal((await fetch(instance.origin+'/config',{method:'POST'})).status,405);
 assert.equal((await fetch(instance.origin+'/config',{headers:{Origin:'https://evil.example'}})).status,403);
 const wrongHost = await new Promise((resolve, reject) => {const req = http.get(instance.origin + '/config', {headers: {Host: 'evil.example'}}, response => {response.resume(); resolve(response.statusCode);}); req.on('error', reject);});
 assert.equal(wrongHost,403);
 assert.equal((await fetch(instance.origin+'/api/v1/user/assignedauthorization')).status,404);
 const r=await fetch(instance.origin+PREFIX,{headers:{Accept:'text/html'}}); assert.equal(r.status,200); assert.equal(r.headers.get('x-content-type-options'),'nosniff');
});
test('fixture tag pagination and unavailable state are real HTTP responses',async t => {const instance=await startFixtureServer({directory:await build(t),port:0}); t.after(()=>instance.close()); const first=await(await fetch(instance.origin+'/api/v1/repository/demo/payments/tag/?page=1&limit=25&onlyActiveTags=true')).json(); assert.equal(first.tags.length,25); assert.equal(first.has_additional,true); const second=await(await fetch(instance.origin+'/api/v1/repository/demo/payments/tag/?page=2&limit=25&onlyActiveTags=true')).json(); assert.equal(second.tags.length,10); assert.equal(second.has_additional,false); assert.equal((await fetch(instance.origin+'/api/v1/repository/demo/unavailable?includeTags=false')).status,503);});
