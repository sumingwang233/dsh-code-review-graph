#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const environment = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'code-review-graph', 'engine');
export const pythonIn = (dir: string) => join(dir, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
async function command(exe: string, args: string[], quiet = false): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(exe, args, { stdio: quiet ? 'ignore' : 'inherit', windowsHide: true });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${exe} exited ${code}`)));
  });
}
export async function prepare(source?: string, python?: string): Promise<void> {
  const engine = JSON.parse(await readFile(new URL('../engine.json', import.meta.url), 'utf8'));
  const pinned = source ?? engine.source;
  const stamp = join(environment, 'dsh-crg-source.json');
  if (await readFile(stamp, 'utf8').then(value => JSON.parse(value).source === pinned, () => false)) {
    try { await command(pythonIn(environment), ['-c', 'from code_review_graph.refactor import get_refactor_edit_plan'], true); console.log('CRG engine is already prepared.'); return; } catch {}
  }
  await mkdir(environment, { recursive: true });
  let uv = false;
  try { await command('uv', ['--version'], true); uv = true; } catch {}
  if (uv && !python) {
    await command('uv', ['venv', '--allow-existing', '--python', '>=3.10', environment]);
    await command('uv', ['pip', 'install', '--python', pythonIn(environment), pinned]);
  } else {
    let selected: { exe: string; args: string[] } | undefined;
    for (const candidate of python ? [{ exe: python, args: [] }] : [{ exe: 'python3', args: [] }, { exe: 'python', args: [] }, { exe: 'py', args: ['-3'] }]) {
      try { await command(candidate.exe, [...candidate.args, '-c', 'import sys; assert sys.version_info >= (3,10)'], true); selected = candidate; break; } catch {}
    }
    if (!selected) throw new Error('Install uv or real Python 3.10+; Windows Store aliases are not a Python runtime.');
    await command(selected.exe, [...selected.args, '-m', 'venv', environment]);
    await command(pythonIn(environment), ['-m', 'pip', 'install', pinned]);
  }
  await command(pythonIn(environment), ['-c', 'from code_review_graph.refactor import get_refactor_edit_plan'], true);
  await writeFile(stamp, JSON.stringify({ source: pinned }), 'utf8');
}
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  if (process.argv[2] !== 'prepare') { console.error('Usage: dsh-crg prepare [engine-source] [--python executable]'); process.exitCode = 2; }
  else {
    const args = process.argv.slice(3);
    const flag = args.indexOf('--python');
    const python = flag >= 0 ? args.splice(flag, 2)[1] : undefined;
    try { await prepare(args[0], python); } catch (error) { console.error(String(error)); process.exitCode = 1; }
  }
}
