import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyVersions } from './check-version.mjs';

test('accepts the current stable tag and rejects mismatched/malformed tags', () => {
  const version = verifyVersions();
  assert.equal(verifyVersions('.', `v${version}`), version);
  for (const tag of [version, 'v99.99.99', `v${version}-beta.1`, 'v01.2.0'])
    assert.throws(() => verifyVersions('.', tag));
});
test('detects mismatches in the installer, native package, and lockfiles', () => {
  const directory = mkdtempSync(join(tmpdir(), 'homebase-version-'));
  try {
    mkdirSync(join(directory, 'src-tauri'));
    const files = [
      'package.json',
      'package-lock.json',
      'src-tauri/Cargo.toml',
      'src-tauri/Cargo.lock',
      'src-tauri/tauri.conf.json',
    ];
    for (const target of [
      'src-tauri/tauri.conf.json',
      'src-tauri/Cargo.toml',
      'src-tauri/Cargo.lock',
      'package-lock.json',
    ]) {
      for (const file of files) copyFileSync(file, join(directory, file));
      const version = verifyVersions(directory);
      const path = join(directory, target);
      const original = readFileSync(path, 'utf8');
      const changed = target.endsWith('Cargo.lock')
        ? original.replace(
            /(name = "homebase"\r?\nversion = ")[^"]+/,
            (_match, prefix) => `${prefix}99.99.99`,
          )
        : original.replace(version, '99.99.99');
      writeFileSync(path, changed);
      assert.throws(() => verifyVersions(directory), undefined, target);
    }
  } finally {
    rmSync(directory, { recursive: true });
  }
});
