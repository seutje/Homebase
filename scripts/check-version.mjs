import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyVersions(root = '.', tag) {
  const json = (path) => JSON.parse(readFileSync(`${root}/${path}`, 'utf8'));
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  const cargo = readFileSync(`${root}/src-tauri/Cargo.toml`, 'utf8').match(
    /\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
  )?.[1];
  const cargoLock = readFileSync(`${root}/src-tauri/Cargo.lock`, 'utf8').match(
    /name = "homebase"\r?\nversion = "([^"]+)"/,
  )?.[1];
  const versions = {
    'package.json': pkg.version,
    'package-lock.json': lock.version,
    'package-lock root': lock.packages[''].version,
    'Cargo.toml': cargo,
    'Cargo.lock': cargoLock,
    'tauri.conf.json': json('src-tauri/tauri.conf.json').version,
  };
  const stable = '(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)';
  if (!new RegExp(`^${stable}$`).test(pkg.version))
    throw new Error(`Invalid stable version: ${pkg.version}`);
  for (const [file, version] of Object.entries(versions)) {
    if (version !== pkg.version)
      throw new Error(`${file}: expected ${pkg.version}, found ${version}`);
  }
  if (
    tag !== undefined &&
    (tag !== `v${pkg.version}` || !new RegExp(`^v${stable}$`).test(tag))
  )
    throw new Error(`Tag ${tag} must match v${pkg.version} exactly.`);
  return pkg.version;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  console.log(
    `Homebase ${verifyVersions('.', process.argv[2])}: versions${process.argv[2] ? ' and tag' : ''} match.`,
  );
}
