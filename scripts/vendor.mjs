// Copies the parts of three.js the scene uses (plus their transitive imports)
// into vendor/three so the site runs as plain static files with no bundler.
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/three');
const out = join(root, 'vendor/three');

const entries = [
  'build/three.module.js',
  'examples/jsm/environments/RoomEnvironment.js',
  'examples/jsm/postprocessing/EffectComposer.js',
  'examples/jsm/postprocessing/RenderPass.js',
  'examples/jsm/postprocessing/GTAOPass.js',
  'examples/jsm/postprocessing/UnrealBloomPass.js',
  'examples/jsm/postprocessing/OutputPass.js',
  'examples/jsm/geometries/RoundedBoxGeometry.js',
];

rmSync(out, { recursive: true, force: true });
const seen = new Set();
const queue = entries.map((e) => join(src, e));
while (queue.length) {
  const file = queue.pop();
  if (seen.has(file)) continue;
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    queue.push(resolve(dirname(file), m[1]));
  }
  const dest = join(out, relative(src, file));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, code);
}
console.log(`vendored ${seen.size} files into ${relative(root, out)}`);
