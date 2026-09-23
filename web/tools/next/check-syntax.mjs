import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let files = 0;
let errors = 0;
function visit(dir) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) {
            visit(file);
            continue;
        }
        if (!/\.(tsx?|mjs|cjs)$/.test(file))
            continue;
        const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : /\.ts$/.test(file) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
        files++;
        for (const diagnostic of source.parseDiagnostics) {
            errors++;
            console.error(`${path.relative(web, file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
        }
    }
}
for (const dir of ['src/next', 'tools/next', 'next-tests'])
    visit(path.join(web, dir));
console.log(`${files} source/test files parsed; ${errors} syntax errors. This does not replace a dependency-aware typecheck.`);
process.exitCode = errors ? 1 : 0;
