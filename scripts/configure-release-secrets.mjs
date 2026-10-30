import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = 'seutje/Homebase';
const key = join(homedir(), '.tauri', 'homebase-updater.key');
const auth = spawnSync('gh', ['auth', 'status'], {
  windowsHide: true,
  encoding: 'utf8',
});
if (auth.status !== 0)
  throw new Error(
    'GitHub CLI is missing or not authenticated. Install gh and run gh auth login, or set the two secrets in repository settings.',
  );
for (const [name, path] of [
  ['TAURI_SIGNING_PRIVATE_KEY', key],
  ['TAURI_SIGNING_PRIVATE_KEY_PASSWORD', `${key}.password`],
]) {
  // Exact file bytes through stdin: no added newline, command-line value, or logging.
  const result = spawnSync('gh', ['secret', 'set', name, '--repo', repo], {
    input: readFileSync(path),
    windowsHide: true,
  });
  if (result.status !== 0)
    throw new Error(
      `Could not set ${name} on ${repo}. Check gh authentication and repository admin access.`,
    );
  console.log(`Configured ${name} on ${repo}.`);
}
