import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = path.join(packageRoot, '.build');
const compiledSource = path.join(buildRoot, 'projects', 'brain-core', 'src');
const distRoot = path.join(packageRoot, 'dist');

if (!existsSync(compiledSource)) {
  throw new Error(`Missing compiled Brain Core source tree: ${compiledSource}`);
}

cpSync(compiledSource, distRoot, { recursive: true });
rmSync(buildRoot, { recursive: true, force: true });
process.stdout.write(`brain-core-dist-flatten source=${compiledSource} target=${distRoot}\n`);
