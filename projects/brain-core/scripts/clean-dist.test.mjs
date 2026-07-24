import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { cleanDist } from './clean-dist.mjs';

function createPackageFixture() {
  const packageRoot = mkdtempSync(path.join('/tmp', 'brain-core-clean-dist-'));
  const srcRoot = path.join(packageRoot, 'src');
  const distRoot = path.join(packageRoot, 'dist');
  mkdirSync(srcRoot, { recursive: true });
  mkdirSync(distRoot, { recursive: true });
  writeFileSync(path.join(srcRoot, 'sentinel.ts'), 'export const sentinel = true;\n');
  writeFileSync(path.join(distRoot, 'stale.js'), 'stale\n');
  return { packageRoot, srcRoot, distRoot };
}

test('removes only the package dist directory and preserves source', () => {
  const fixture = createPackageFixture();
  try {
    const result = cleanDist({ packageRoot: fixture.packageRoot });
    assert.equal(result.removed, true);
    assert.equal(existsSync(fixture.distRoot), false);
    assert.equal(readFileSync(path.join(fixture.srcRoot, 'sentinel.ts'), 'utf8'), 'export const sentinel = true;\n');
  } finally {
    rmSync(fixture.packageRoot, { recursive: true, force: true });
  }
});

test('refuses a cleanup target outside package dist', () => {
  const fixture = createPackageFixture();
  try {
    assert.throws(
      () => cleanDist({ packageRoot: fixture.packageRoot, target: fixture.srcRoot }),
      /Refusing to clean outside package dist/,
    );
    assert.equal(existsSync(path.join(fixture.srcRoot, 'sentinel.ts')), true);
    assert.equal(existsSync(path.join(fixture.distRoot, 'stale.js')), true);
  } finally {
    rmSync(fixture.packageRoot, { recursive: true, force: true });
  }
});

test('refuses a symbolic-link dist target', () => {
  const fixture = createPackageFixture();
  const outsideRoot = mkdtempSync(path.join('/tmp', 'brain-core-clean-dist-outside-'));
  try {
    rmSync(fixture.distRoot, { recursive: true, force: true });
    writeFileSync(path.join(outsideRoot, 'protected.txt'), 'keep\n');
    symlinkSync(outsideRoot, fixture.distRoot);

    assert.throws(
      () => cleanDist({ packageRoot: fixture.packageRoot }),
      /Refusing to clean symbolic-link dist target/,
    );
    assert.equal(readFileSync(path.join(outsideRoot, 'protected.txt'), 'utf8'), 'keep\n');
  } finally {
    rmSync(fixture.packageRoot, { recursive: true, force: true });
    rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test('returns safely when dist is absent', () => {
  const fixture = createPackageFixture();
  try {
    rmSync(fixture.distRoot, { recursive: true, force: true });
    const result = cleanDist({ packageRoot: fixture.packageRoot });
    assert.equal(result.removed, false);
    assert.equal(existsSync(path.join(fixture.srcRoot, 'sentinel.ts')), true);
  } finally {
    rmSync(fixture.packageRoot, { recursive: true, force: true });
  }
});
