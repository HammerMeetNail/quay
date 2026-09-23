/** Tests the actual route installer in Chromium, against local synthetic HTTP only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {installPreviewRoutes} from '../tools/next/routing.mjs';
import {parseScope, PREFIX} from '../tools/next/policy.mjs';
import {HEADERS} from '../tools/next/assets.mjs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.QUAY_NEXT_PLAYWRIGHT_MODULE || '@playwright/test');
const scope = parseScope('demo/app');
const runtime = {mode: 'fixture', ...scope};
const build = {assets: new Map([[`${PREFIX}assets/main.js`, {contentType:'text/javascript',body:Buffer.from('document.documentElement.dataset.localAsset="loaded";')}]]), index: Buffer.from(`<!doctype html><html><head><script defer src="${PREFIX}assets/main.js"></script></head><body><h1>Local overlay specimen</h1></body></html>`)};

test('same-origin overlay reaches real fixture API with native cookies, and blocks unsafe requests', async t => {
  const reached = [];
  const server = http.createServer((req,res) => {
    reached.push({method:req.method,url:req.url,cookie:req.headers.cookie ?? ''});
    if (req.url === '/signin') {res.writeHead(200, {'content-type':'text/html','set-cookie':'fixture_session=synthetic; HttpOnly; SameSite=Lax; Path=/'}); res.end('<html><body>Native fixture login</body></html>'); return;}
    if (req.url === '/api/v1/user/') {res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({anonymous: !req.headers.cookie,username:'demo'}));return;}
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({source:'fixture-server'}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(()=>{server.closeAllConnections(); return new Promise(r=>server.close(r));});
  const browser = await chromium.launch({headless:true, executablePath:process.env.QUAY_NEXT_CHROMIUM || undefined});
  t.after(()=>browser.close());
  const context = await browser.newContext({serviceWorkers:'block',acceptDownloads:false});
  let mode='preview';
  await installPreviewRoutes(context,()=>({mode,scope,runtime,build}),origin, error => console.error('Fixture routing error:', error.message));
  let page=await context.newPage();
  const response=await page.goto(origin+PREFIX);
  assert.equal(await page.title(),'');
  assert.equal(await page.getByRole('heading',{name:'Local overlay specimen'}).count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.localAsset),'loaded');
  assert.equal(response.headers()['content-security-policy'],HEADERS['content-security-policy']);
  assert.equal(reached.some(r=>r.url.startsWith(PREFIX)),false,'local assets must not reach upstream');
  const body=await page.evaluate(async()=> (await fetch('/api/v1/repository/demo/app?includeTags=false')).json());
  assert.equal(body.source,'fixture-server');
  for (const [method,url] of [['DELETE','/api/v1/repository/demo/app'],['POST','/api/v1/signout'],['GET','/api/v1/user/assignedauthorization'],['GET','/api/v1/repository/demo/other?includeTags=false']]) {
    const before=reached.length;
    const blocked=await page.evaluate(async({method,url})=>{const r=await fetch(url,{method});return {status:r.status,data:await r.json()};},{method,url});
    assert.equal(blocked.status,403);assert.equal(blocked.data.error_type,'preview_operation_blocked');assert.equal(reached.length,before);
  }
  assert.equal(await page.evaluate(async()=>{try{await navigator.serviceWorker.register('/sw.js');return false;}catch{return true;}}),true);
  assert.equal(reached.some(r=>r.url==='/sw.js'),false);
  const oldPage=page;
  for(const current of context.pages()) await current.close();
  assert.equal(oldPage.isClosed(),true);
  mode='native';page=await context.newPage();await page.goto(origin+'/signin');
  assert.match(await page.textContent('body'),/Native fixture login/);
  for(const current of context.pages()) await current.close();
  mode='preview';page=await context.newPage();await page.goto(origin+PREFIX);
  const user=await page.evaluate(async()=> (await fetch('/api/v1/user/')).json());
  assert.equal(user.anonymous,false);
  assert.equal(reached.findLast(r=>r.url==='/api/v1/user/').cookie,'fixture_session=synthetic');
  const count=reached.length;
  const unknown=await page.evaluate(async prefix=> (await fetch(prefix+'assets/../../.env')).status,PREFIX);
  assert.equal(unknown,403);assert.equal(reached.length,count);
  await context.close();
});

test('external requests and websockets do not reach the fixture servers',async t=>{
  let externalHits=0,upgrades=0;
  const server=http.createServer((_req,res)=>{res.writeHead(200);res.end('upstream');});
  server.on('upgrade',(_req,socket)=>{upgrades++;socket.destroy();});
  const external=http.createServer((_req,res)=>{externalHits++;res.end('external');});
  await Promise.all([new Promise(r=>server.listen(0,'127.0.0.1',r)),new Promise(r=>external.listen(0,'127.0.0.1',r))]);
  t.after(()=>{server.closeAllConnections(); external.closeAllConnections(); return Promise.all([new Promise(r=>server.close(r)),new Promise(r=>external.close(r))]);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true,executablePath:process.env.QUAY_NEXT_CHROMIUM||undefined});t.after(()=>browser.close());
  const context=await browser.newContext({serviceWorkers:'block'});
  await installPreviewRoutes(context,()=>({mode:'preview',scope,runtime,build}),origin, error => console.error('Fixture routing error:', error.message));
  const page=await context.newPage();await page.goto(origin+PREFIX);
  const error=await page.evaluate(async target=>{try{await fetch(target);return false;}catch{return true;}},`http://127.0.0.1:${external.address().port}/secret`);
  assert.equal(error,true);assert.equal(externalHits,0);
  await page.evaluate(async url=>new Promise(resolve=>{const socket=new WebSocket(url);socket.onclose=()=>resolve(true);socket.onerror=()=>resolve(true);setTimeout(()=>{socket.close();resolve(true);},200);}),origin.replace('http:','ws:')+'/socket');
  assert.equal(upgrades,0);
  await context.close();
});
