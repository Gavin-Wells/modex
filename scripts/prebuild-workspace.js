// Copyright ModelSwitch. Licensed under Apache-2.0.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prebuilt = path.join(root, 'resources', 'prebuilt');
const pythonDir = path.join(prebuilt, 'workspace_python');
const venvDir = path.join(prebuilt, 'workspace_venv');
const serverDir = path.join(root, 'server');
const env = {
  ...process.env,
  UV_PYTHON_INSTALL_DIR: pythonDir,
  UV_PROJECT_ENVIRONMENT: venvDir,
  UV_HTTP_TIMEOUT: '300',
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: serverDir,
    env,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed with status ${result.status}`);
  return result;
}

fs.mkdirSync(prebuilt, { recursive: true });
run('uv', ['python', 'install', '3.12']);
run('uv', [
  'sync',
  '--locked',
  '--no-dev',
  '--python',
  '3.12',
  '--python-preference',
  'only-managed',
]);
const venvPython = path.join(
  venvDir,
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
);
const realPython = fs.realpathSync(venvPython);
const relativePython = path.relative(prebuilt, realPython);
if (relativePython.startsWith('..') || path.isAbsolute(relativePython))
  throw new Error('Managed Python is outside the bundle');
const result = run(
  venvPython,
  ['-c', 'import sysconfig; print(sysconfig.get_paths()["purelib"])'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
);
const relativeSitePackages = path.relative(prebuilt, result.stdout.trim());
if (
  relativeSitePackages.startsWith('..') ||
  path.isAbsolute(relativeSitePackages)
)
  throw new Error('Workspace packages are outside the bundle');
run(venvPython, ['-m', 'babel.messages.frontend', 'compile', '-d', 'lang']);
fs.writeFileSync(
  path.join(prebuilt, 'workspace-runtime.json'),
  JSON.stringify(
    { python: relativePython, sitePackages: relativeSitePackages },
    null,
    2
  )
);
