import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const compile = spawnSync(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['-p', 'tsconfig.next.core.json'], { cwd: web, stdio: 'inherit' });
if (compile.error || compile.status !== 0) {
    console.error('Core compilation failed. Install workspace dependencies and ensure tsc is on PATH.');
    process.exit(1);
}
const tests = readdirSync(path.join(web, 'next-tests/unit')).filter(x => /\.(?:cjs|mjs)$/.test(x)).map(x => `next-tests/unit/${x}`);
const result = spawnSync(process.execPath, ['--test', ...tests], { cwd: web, stdio: 'inherit' });
process.exit(result.status ?? 1);
