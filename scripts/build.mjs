import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const tempDir = join(root, '.tmp-esbuild');
mkdirSync(tempDir, { recursive: true });

const env = { ...process.env, TEMP: tempDir, TMP: tempDir };

function run(label, entry, args) {
  console.log(`\n[build] ${label}`);
  const result = spawnSync(process.execPath, [join(root, entry), ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.error) {
    console.error(`[build] ${label} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('typecheck', 'node_modules/typescript/bin/tsc', ['--noEmit']);
run('vite build', 'node_modules/vite/bin/vite.js', ['build']);
console.log('\n[build] OK');