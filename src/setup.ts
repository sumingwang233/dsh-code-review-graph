#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const environment = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'code-review-graph', 'engine');
export const pythonIn = (dir: string) => join(dir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
interface Preparation { signal?: AbortSignal; onProgress?: (text: string) => void }
async function command(exe: string, args: string[], quiet = false, options: Preparation = {}): Promise<void> {
  options.signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    let log = '';
    const child = spawn(exe, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, signal: options.signal });
    const capture = (bytes: Buffer) => { const text = bytes.toString(); log = (log + text).slice(-16000); if (!quiet) options.onProgress?.(text); };
    child.stdout.on('data', capture); child.stderr.on('data', capture);
    child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`${exe} exited ${code}: ${log}`)));
  });
}
export async function prepare(source?: string, python?: string, options: Preparation = {}): Promise<void> {
  options = { ...options, signal: AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(15 * 60 * 1000)]) };
  options.signal!.throwIfAborted();
  const execute = (exe: string, args: string[], quiet = false) => command(exe, args, quiet, options);
  const engine = JSON.parse(await readFile(new URL('../engine.json', import.meta.url), 'utf8'));
  const pinned = source ?? engine.source;
  const stamp = join(environment, 'dsh-crg-source.json');
  if (await readFile(stamp, 'utf8').then(value => JSON.parse(value).source === pinned, () => false)) {
    try { await execute(pythonIn(environment), ['-c', 'from code_review_graph.refactor import get_refactor_edit_plan'], true); options.onProgress?.('CRG engine is already prepared.'); return; } catch { options.signal!.throwIfAborted(); }
  }
  await mkdir(environment, { recursive: true });
  let uv = false;
  try { await execute('uv', ['--version'], true); uv = true; } catch { options.signal!.throwIfAborted(); }
  if (uv && !python) {
    await execute('uv', ['venv', '--allow-existing', '--python', '>=3.10', environment]);
    await execute('uv', ['pip', 'install', '--python', pythonIn(environment), pinned]);
  } else {
    let selected: { exe: string; args: string[] } | undefined;
    for (const candidate of python ? [{ exe: python, args: [] }] : [{ exe: 'python3', args: [] }, { exe: 'python', args: [] }, { exe: 'py', args: ['-3'] }]) {
      try { await execute(candidate.exe, [...candidate.args, '-c', 'import sys; assert sys.version_info >= (3,10)'], true); selected = candidate; break; } catch { options.signal!.throwIfAborted(); }
    }
    if (!selected) throw new Error('Install uv or real Python 3.10+; Windows Store aliases are not a Python runtime.');
    await execute(selected.exe, [...selected.args, '-m', 'venv', environment]);
    await execute(pythonIn(environment), ['-m', 'pip', 'install', pinned]);
  }
  await execute(pythonIn(environment), ['-c', 'from code_review_graph.refactor import get_refactor_edit_plan'], true);
  options.signal!.throwIfAborted();
  await writeFile(stamp, JSON.stringify({ source: pinned }), 'utf8');
}
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  if (process.argv[2] !== 'prepare') { console.error('Usage: dsh-crg prepare [engine-source] [--python executable]'); process.exitCode = 2; }
  else {
    const args = process.argv.slice(3);
    const flag = args.indexOf('--python');
    const python = flag >= 0 ? args.splice(flag, 2)[1] : undefined;
    try { await prepare(args[0], python, { onProgress: text => process.stdout.write(text.endsWith('\n') ? text : text + '\n') }); } catch (error) { console.error(String(error)); process.exitCode = 1; }
  }
}
