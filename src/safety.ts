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

const REPOSITORY_MARKERS = ['.git', '.svn'] as const;
/** Directories that never hold the workspace's own source, so scanning skips them. */
const SCAN_SKIP = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'bin', 'obj', '__pycache__', '.venv', 'venv', 'env', '.next', '.turbo', 'coverage']);
const SCAN_DEPTH = 3;
const SCAN_BUDGET = 2000;

async function isRepositoryRoot(dir: string): Promise<boolean> {
  for (const marker of REPOSITORY_MARKERS) {
    if (await stat(resolve(dir, marker)).then(() => true, () => false)) return true;
  }
  return false;
}

/**
 * Repositories nested under a workspace that is not itself a repository, so a
 * lab or monorepo-style root can still be analysed. A found repository is not
 * descended into, and the walk is bounded by depth and a directory budget.
 */
async function nestedRepositories(root: string): Promise<string[]> {
  const found: string[] = [];
  let budget = SCAN_BUDGET;
  let level = [root];
  for (let depth = 0; depth < SCAN_DEPTH && level.length > 0 && budget > 0; depth += 1) {
    const next: string[] = [];
    for (const dir of level) {
      if (budget <= 0) break;
      budget -= 1;
      if (await isRepositoryRoot(dir)) { found.push(dir); continue; }
      for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isDirectory() || entry.name.startsWith('.') || SCAN_SKIP.has(entry.name)) continue;
        next.push(join(dir, entry.name));
      }
    }
    level = next;
  }
  return found;
}

async function resolveRepository(cwd: string | undefined, configured?: string): Promise<string> {
  if (configured !== undefined && configured !== '') {
    if (!isAbsolute(configured)) throw new Error('repositoryRoot must be an absolute path');
    const root = await realpath(configured).catch(() => { throw new Error(`repositoryRoot does not exist: ${configured}`); });
    if (!(await stat(root)).isDirectory()) throw new Error(`repositoryRoot is not a directory: ${configured}`);
    if (await isRepositoryRoot(root)) return root;
    throw new Error(`repositoryRoot is not a Git or SVN repository: ${configured} (run git init there, or point it at the repository root)`);
  }
  if (!cwd || !isAbsolute(cwd)) throw new Error('This session has no local absolute workspace');
  const start = await realpath(cwd);
  if (!(await stat(start)).isDirectory()) throw new Error('Workspace is not a directory');
  for (let current = start; ; current = dirname(current)) {
    if (await isRepositoryRoot(current)) return current;
    const parent = dirname(current);
    if (parent === current) break;
  }
  const nested = await nestedRepositories(start);
  if (nested.length === 1) return nested[0];
  if (nested.length > 1) throw new Error(`Select a Git or SVN repository before using the graph: ${start} contains ${nested.length} repositories (${nested.join(', ')}); set repositoryRoot in the plugin config or open the session in one of them`);
  throw new Error(`Select a Git or SVN repository before using the graph: ${start} is not inside a Git or SVN repository and no repository was found beneath it (open the session at a repository root, or run git init there)`);
}

const repositoryCache = new Map<string, Promise<string>>();

/**
 * Resolve the repository a session works on: an explicit `repositoryRoot` wins,
 * then the nearest enclosing repository (git semantics), then the single
 * repository nested under the workspace.
 */
export async function repository(cwd: string | undefined, configured?: string): Promise<string> {
  const key = `${cwd ?? ''}\u0000${configured ?? ''}`;
  const cached = repositoryCache.get(key);
  if (cached !== undefined) return cached;
  const pending = resolveRepository(cwd, configured);
  repositoryCache.set(key, pending);
  try {
    return await pending;
  } catch (error) {
    repositoryCache.delete(key); // a later call may succeed after the workspace gains a repository
    throw error;
  }
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
