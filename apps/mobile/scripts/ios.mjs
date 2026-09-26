import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [target, ...args] = process.argv.slice(2);
if (!['simulator', 'device'].includes(target)) {
  throw new Error('Usage: node scripts/ios.mjs simulator|device [Expo run:ios options]');
}
const cwd = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env, MEDIFYRX_IOS_TARGET: target };
const expo = fileURLToPath(import.meta.resolve('expo/bin/cli'));
function run(command, commandArgs, directory = cwd) {
  const result = spawnSync(command, commandArgs, { cwd: directory, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(`${cwd}/ios/Podfile`)) {
  run(process.execPath, [expo, 'prebuild', '--platform', 'ios', '--no-install']);
}
// Always resolve pods when switching targets: Expo's dependency cache cannot
// detect the environment-dependent autolinking configuration on its own.
run('pod', ['install'], `${cwd}/ios`);
if (!args.includes('--prepare-only')) {
  run(process.execPath, [expo, 'run:ios', '--no-install',
    ...(target === 'device' && !args.includes('--device') && !args.includes('-d') ? ['--device'] : []),
    ...args]);
}
