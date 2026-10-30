import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(homedir(), '.tauri');
const privateKey = join(directory, 'homebase-updater.key');
const passwordFile = `${privateKey}.password`;
if ([privateKey, `${privateKey}.pub`, passwordFile].some(existsSync)) {
  throw new Error(
    'Homebase updater key files already exist. Preserve them; do not rotate a published updater key.',
  );
}
mkdirSync(directory, { recursive: true });
const password = randomBytes(32).toString('base64url');
writeFileSync(passwordFile, password, { flag: 'wx', mode: 0o600 });
// The CLI prints key material: capture it and never forward stdout/stderr.
const result = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/@tauri-apps/cli/tauri.js'),
    'signer',
    'generate',
    '--ci',
    '--password',
    password,
    '--write-keys',
    privateKey,
  ],
  { cwd: root, encoding: 'utf8', windowsHide: true },
);
if (result.status !== 0)
  throw new Error(
    'Key generation failed. CLI output was withheld to protect key material. Inspect the named files before retrying.',
  );
if (process.platform === 'win32') {
  const account = `${process.env.USERDOMAIN}\\${process.env.USERNAME}`;
  for (const path of [privateKey, passwordFile]) {
    const acl = spawnSync(
      'icacls.exe',
      [path, '/inheritance:r', '/grant:r', `${account}:(F)`, '*S-1-5-18:(F)'],
      { windowsHide: true, encoding: 'utf8' },
    );
    if (acl.status !== 0)
      throw new Error(
        'Keys were generated but their ACL could not be restricted. Check file permissions before using them.',
      );
  }
}
console.log(
  `Private key: ${privateKey}\nPassword file: ${passwordFile}\nPublic key: ${privateKey}.pub`,
);
