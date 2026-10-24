import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const lockfile = JSON.parse(
  await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'),
);

function versionOf(packageName) {
  const entry = lockfile.packages?.[`node_modules/${packageName}`];
  assert.ok(entry?.version, `package-lock.json must resolve ${packageName}`);
  return entry.version;
}

function compareVersions(left, right) {
  const a = left.replace(/^[^0-9]*/, '').split('.').map(Number);
  const b = right.replace(/^[^0-9]*/, '').split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0)) {
      return (a[index] ?? 0) - (b[index] ?? 0);
    }
  }
  return 0;
}

test('production lockfile resolves patched dependency floors', () => {
  const floors = {
    next: '15.5.28',
    sharp: '0.35.5',
    'source-map-js': '1.2.2',
    zod: '4.6.6',
  };

  for (const [packageName, floor] of Object.entries(floors)) {
    const actual = versionOf(packageName);
    assert.ok(
      compareVersions(actual, floor) >= 0,
      `${packageName} must resolve >= ${floor}; found ${actual}`,
    );
  }
});
