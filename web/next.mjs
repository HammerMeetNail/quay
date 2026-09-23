#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {existsSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 16)) {console.error('Use Node 22.16+ for the dependency-free TypeScript unit runner.'); process.exit(1);}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {cwd: root, stdio: 'inherit', env: process.env});
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code ?? 'signal'}.`)));
  });
}
function bin(relative) {const result = path.join(root, 'node_modules', relative); if (!existsSync(result)) throw new Error('Workspace dependencies are missing. Run pnpm install --frozen-lockfile in web/.'); return result;}
const build = () => run([bin('webpack-cli/bin/cli.js'), '--config', 'webpack.next.cjs']);
const typecheck = () => run([bin('typescript/bin/tsc'), '-p', 'tsconfig.next.json']);
const unit = () => run(['--experimental-strip-types', '--test', ...readdirSync(path.join(root, 'next-tests/unit')).filter(name => name.endsWith('.test.mjs')).map(name => `next-tests/unit/${name}`)]);
try {
  const command = process.argv[2] ?? 'help';
  if (command === 'build') {await typecheck(); await build();}
  else if (command === 'typecheck') await typecheck();
  else if (command === 'test') await unit();
  else if (command === 'harness') await run(['--test', 'next-tests/harness.browser.mjs']);
  else if (command === 'check') {await unit(); await typecheck(); await build();}
  else if (command === 'dev') {await typecheck(); await build(); await run(['tools/next/server.mjs', 'dist-next']);}
  else if (command === 'preview') {await typecheck(); await build(); await run(['tools/next/preview.mjs', ...process.argv.slice(3)]);}
  else if (command === 'browser') {await typecheck(); await build(); await run([bin('@playwright/test/cli.js'), 'test', '--config', 'playwright.next.config.ts']);}
  else console.log('node next.mjs dev | preview [--login] | build | typecheck | test | harness | browser | check');
} catch (error) {console.error(error.message); process.exitCode = 1;}
