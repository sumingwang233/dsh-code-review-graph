import { realpath, stat, lstat, readdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep, dirname, basename, join } from 'node:path';
import { createHash } from 'node:crypto';

export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');

export function contained(root: string, path: string): boolean {
  const part = relative(root, path);
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith(`..${sep}`));
}

export async function checkedPath(root: string, value: string, allowMissing = false): Promise<string> {
  const candidate = resolve(root, value);
  if (!contained(root, candidate)) throw new Error('Path is outside the authorized repository');
  let current = candidate;
  const suffix: string[] = [];
  while (allowMissing && !await lstat(current).then(() => true, () => false)) {
    suffix.unshift(basename(current)); current = dirname(current);
  }
  const canonical = join(await realpath(current), ...suffix);
  if (!contained(root, canonical)) throw new Error('Symlink escapes the authorized repository');
  return canonical;
}

export async function repository(cwd: string | undefined): Promise<string> {
  if (!cwd || !isAbsolute(cwd)) throw new Error('This session has no local absolute workspace');
  const root = await realpath(cwd);
  if (!(await stat(root)).isDirectory()) throw new Error('Workspace is not a directory');
  for (const marker of ['.git', '.svn']) {
    if (await stat(resolve(root, marker)).then(() => true, () => false)) return root;
  }
  throw new Error('Select a Git or SVN repository before using the graph');
}

export function scrubEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return { ...Object.fromEntries(Object.entries(env).filter(([key, value]) => value !== undefined && !/KEY|PASSWORD|SECRET|TOKEN|^(DSH|CRG|OPENAI|GOOGLE|GEMINI|MINIMAX|VOYAGE|HF)_/i.test(key))), HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' } as Record<string, string>;
}

export async function checkedData(root: string): Promise<void> {
  const dir = resolve(root, '.code-review-graph');
  if (!await lstat(dir).then(() => true, () => false)) return;
  await checkedPath(root, dir);
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) await checkedPath(root, join(entry.parentPath, entry.name));
  }
}
