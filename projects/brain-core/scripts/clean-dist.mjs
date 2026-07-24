import { existsSync, lstatSync, realpathSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveExistingDirectory(directory) {
  return realpathSync(path.resolve(directory));
}

export function cleanDist({ packageRoot = DEFAULT_PACKAGE_ROOT, target } = {}) {
  const resolvedPackageRoot = resolveExistingDirectory(packageRoot);
  const expectedTarget = path.join(resolvedPackageRoot, 'dist');
  const resolvedTarget = path.resolve(target ?? expectedTarget);

  if (resolvedTarget !== expectedTarget) {
    throw new Error(`Refusing to clean outside package dist: ${resolvedTarget}`);
  }

  if (!existsSync(resolvedTarget)) {
    return { removed: false, target: resolvedTarget };
  }

  if (lstatSync(resolvedTarget).isSymbolicLink()) {
    throw new Error(`Refusing to clean symbolic-link dist target: ${resolvedTarget}`);
  }

  const realTarget = realpathSync(resolvedTarget);
  if (realTarget !== expectedTarget) {
    throw new Error(`Refusing to clean redirected dist target: ${realTarget}`);
  }

  rmSync(resolvedTarget, { recursive: true, force: true });
  return { removed: true, target: resolvedTarget };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const result = cleanDist();
  process.stdout.write(`brain-core-dist-clean removed=${result.removed} target=${result.target}\n`);
}
