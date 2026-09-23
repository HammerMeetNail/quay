import {chromium} from '@playwright/test';
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {LIVE_ORIGIN, PREFIX, parseScope} from './policy.mjs';
import {loadBuild} from './assets.mjs';
import {installPreviewRoutes} from './routing.mjs';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist-next');
const scope = parseScope(process.env.QUAY_NEXT_REPOSITORIES);
const runtime = {mode: 'live', ...scope};
let build = await loadBuild(directory); let mode = 'preview';
const browser = await chromium.launch({headless: false});
const context = await browser.newContext({serviceWorkers: 'block', acceptDownloads: false});
const terminal = createInterface({input: stdin, output: stdout});
let stopping = false;
const shutdown = async () => {if (stopping) return; stopping = true; terminal.close(); await context.close().catch(() => {}); await browser.close().catch(() => {});};
for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => {void shutdown();});
browser.on('disconnected', () => {stopping = true; terminal.close();});

await installPreviewRoutes(context, () => ({mode, build, runtime, scope}));
async function closePages() {
  for (let attempt = 0; attempt < 5 && context.pages().length; attempt++) {
    await Promise.all(context.pages().map(page => page.close()));
  }
  if (context.pages().length) throw new Error('Cannot safely leave the current browser phase.');
}
async function openPreview() {
  await closePages(); mode = 'preview'; build = await loadBuild(directory);
  const page = await context.newPage(); await page.goto(`${LIVE_ORIGIN}${PREFIX}`);
}
async function login() {
  await closePages(); // No local code remains while native auth networking is enabled.
  mode = 'native'; const page = await context.newPage(); await page.goto(`${LIVE_ORIGIN}/signin`);
  await terminal.question('Complete normal Quay sign-in/SSO/MFA in the browser, then press Enter here. ');
  if (!stopping) await openPreview();
}
try {
  console.log('Locally built code will run under your isolated quay.io session. Use a least-privilege account.');
  console.log(`Approved scope: ${scope.repositories.length} repositories in ${scope.namespaces.length} namespaces.`);
  console.log('Preview blocks repository writes, unapproved reads, and external navigation. No credential or trace exports are created.');
  if (process.argv.includes('--login')) await login(); else await openPreview();
  while (!stopping) {
    const command = (await terminal.question('login / reload / quit > ')).trim();
    if (command === 'quit') break;
    if (command === 'login') await login(); else if (command === 'reload') await openPreview();
  }
} catch {if (!stopping) {console.error('Preview stopped. Check browser installation, build output, and network availability. No authentication diagnostics were retained.'); process.exitCode = 1;}}
finally {await shutdown();} // Do not call Quay signout or export storageState.
