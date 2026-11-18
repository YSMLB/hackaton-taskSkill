import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [mode, ...args] = process.argv.slice(2);
for (const path of ['frontend/.env.local', '.env']) {
  if (existsSync(path)) process.loadEnvFile(path);
}
const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}
function start(command, args, env = process.env) {
  const child = spawn(command, args, { stdio: 'inherit', env, windowsHide: true });
  children.add(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => { children.delete(child); stop(code ?? 1); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

if (!process.env.STEPFLOW_BACKEND_URL) {
  const temp = mkdtempSync(join(tmpdir(), 'stepflow-'));
  const binary = join(temp, process.platform === 'win32' ? 'stepflow.exe' : 'stepflow');
  process.on('exit', () => rmSync(temp, { recursive: true, force: true }));
  const build = spawnSync('go', ['-C', 'backend', 'build', '-o', binary, '.'], { stdio: 'inherit', windowsHide: true });
  if (build.error) console.error(build.error.message);
  if (build.status !== 0) process.exit(build.status || 1);
  const port = process.env.BACKEND_PORT || '8080';
  process.env.STEPFLOW_BACKEND_URL = 'http://127.0.0.1:' + port;
  start(binary, [], { ...process.env, PORT: port });
}
start(process.execPath, ['node_modules/next/dist/bin/next', mode, 'frontend', ...args]);
