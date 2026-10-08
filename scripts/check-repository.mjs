import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
const existing = tracked.filter(existsSync);
for (const path of ['.env', '.env.local', 'bun.lock', 'bun.lockb', 'src/App.css', 'supabase/functions/deploy-functions/index.ts']) {
  assert(!existing.includes(path), `${path} must not be versioned`);
}
assert(existing.includes('package-lock.json'));
assert(existing.includes('AGENTS.md') && existing.includes('supabase/AGENTS.md'));
const localDeno = JSON.parse(readFileSync('deno.json', 'utf8'));
const edgeDeno = JSON.parse(readFileSync('supabase/functions/deno.json', 'utf8'));
assert.deepEqual(edgeDeno.imports, localDeno.imports, 'Local and deployed Edge imports must match');
assert.equal(localDeno.nodeModulesDir, 'manual', 'Edge checks must not replace frontend npm dependencies');
assert.equal(edgeDeno.nodeModulesDir, 'auto', 'Edge bundling must resolve dependencies on the server');
const forbidden = /lo[v]able/i;
for (const path of existing) {
  if (/\.(png|jpg|jpeg|webp|ico|woff|woff2|svg)$/i.test(path)) continue;
  const content = readFileSync(path);
  if (content.includes(0)) continue;
  assert(!forbidden.test(path) && !forbidden.test(content.toString()), `Old provider reference in ${path}`);
}
console.log('Repository hygiene checks passed.');
