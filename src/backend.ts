import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { checkedData, scrubEnv } from './safety.ts';

export interface Engine { command: string; args: string[]; timeoutMs: number; env?: Record<string, string> }
const environment = (engine: Engine) => ({ ...scrubEnv(process.env), ...engine.env });
export function valueOf(result: unknown): Record<string, unknown> {
  const r = result as { isError?: boolean; structuredContent?: Record<string, unknown>; content?: { type: string; text?: string }[] };
  const text = r.content?.filter(x => x.type === 'text').map(x => x.text).join('\n') ?? '';
  if (r.isError) throw new Error(text || 'Engine tool failed');
  const value = r.structuredContent ?? (() => { try { return JSON.parse(text); } catch { return { text }; } })();
  if (value.status === 'error') throw new Error(String(value.error));
  return value;
}

export async function connect(engine: Engine, cwd: string): Promise<Client> {
  await checkedData(cwd);
  const transport = new StdioClientTransport({ command: engine.command, args: [...engine.args, 'serve', '--repo', cwd], cwd, env: environment(engine), stderr: 'pipe' });
  transport.stderr?.on('data', () => {});
  const client = new Client({ name: 'dsh-code-review-graph', version: '0.1.0' });
  try { await client.connect(transport); return client; }
  catch (error) { await transport.close(); throw new Error(`CRG engine unavailable. Run dsh-crg prepare explicitly. ${String(error)}`); }
}

async function stop(child?: ChildProcess): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill();
  });
}
interface Entry { client: Client; owners: Set<string>; ready?: Promise<void>; watcher?: ChildProcess; watchError?: string; queue: Promise<unknown>; update?: Record<string, unknown> }
export class BackendPool {
  private entries = new Map<string, Promise<Entry>>();
  private retired = new Set<string>();
  private closed = false;
  constructor(readonly engine: Engine) {}
  activate(owner: string): void { this.retired.delete(owner); }

  async acquire(root: string, owner: string): Promise<Entry> {
    if (this.closed || this.retired.has(owner)) throw new Error('Session has been released');
    let promise = this.entries.get(root);
    if (!promise) {
      promise = connect(this.engine, root).then(client => ({ client, owners: new Set<string>(), queue: Promise.resolve() }));
      this.entries.set(root, promise);
      promise.catch(() => { if (this.entries.get(root) === promise) this.entries.delete(root); });
    }
    const entry = await promise;
    if (this.closed || this.retired.has(owner)) throw new Error('Session has been released');
    entry.owners.add(owner);
    return entry;
  }

  async call(root: string, owner: string, name: string, args: Record<string, unknown>, signal: AbortSignal) {
    const entry = await this.acquire(root, owner);
    // One mutation at a time per SQLite graph; cancellation restarts this repository's shared worker.
    const work = entry.queue.catch(() => {}).then(async () => {
      signal.throwIfAborted();
      const cancel = () => { this.entries.delete(root); void stop(entry.watcher); void entry.client.close(); };
      signal.addEventListener('abort', cancel, { once: true });
      let result: unknown;
      try {
        await checkedData(root);
        if (entry.watchError) throw new Error(`Incremental watcher stopped: ${entry.watchError}`);
        result = await entry.client.callTool({ name, arguments: args }, undefined, { signal, timeout: this.engine.timeoutMs });
      } catch (error) {
        // A timed-out Python thread cannot safely be left mutating the graph.
        this.entries.delete(root); await stop(entry.watcher); await entry.client.close();
        throw error;
      } finally { signal.removeEventListener('abort', cancel); }
      // A normal tool error must not discard another call's pending refactor preview.
      valueOf(result);
      return result;
    });
    entry.queue = work;
    return work;
  }

  async ensure(root: string, owner: string, signal: AbortSignal): Promise<Record<string, unknown> | undefined> {
    const entry = await this.acquire(root, owner);
    entry.ready ??= (async () => {
      // An existing database can be stale after all sessions were closed.
      const update = valueOf(await this.call(root, owner, 'build_or_update_graph_tool', { repo_root: root }, signal));
      if (update.status === 'partial' || Array.isArray(update.warnings) && update.warnings.length) entry.update = update;
      signal.throwIfAborted();
      const watcher = spawn(this.engine.command, [...this.engine.args, 'watch', '--repo', root], { cwd: root, env: environment(this.engine), stdio: 'ignore', windowsHide: true });
      entry.watcher = watcher;
      await new Promise<void>((resolve, reject) => { watcher.once('spawn', resolve); watcher.once('error', reject); });
      watcher.on('error', error => { entry.watchError = String(error); });
      watcher.on('exit', (code, reason) => { if (entry.watcher === watcher) entry.watchError = `exit ${code ?? reason}`; });
    })().catch(error => { entry.ready = undefined; throw error; });
    await entry.ready;
    if (entry.watchError) throw new Error(`Incremental watcher stopped: ${entry.watchError}`);
    return entry.update;
  }

  async release(owner: string): Promise<void> {
    this.retired.add(owner);
    for (const [root, promise] of this.entries) {
      const entry = await promise.catch(() => undefined);
      if (!entry) continue;
      entry.owners.delete(owner);
      if (!entry.owners.size) { this.entries.delete(root); const watcher = entry.watcher; entry.watcher = undefined; await stop(watcher); await entry.client.close(); }
    }
  }

  async dispose(): Promise<void> {
    this.closed = true;
    const entries = [...this.entries.values()]; this.entries.clear();
    for (const promise of entries) {
      const entry = await promise.catch(() => undefined);
      if (entry) { const watcher = entry.watcher; entry.watcher = undefined; await stop(watcher); await entry.client.close(); }
    }
  }
}

export async function run(engine: Engine, args: string[], cwd: string, signal: AbortSignal): Promise<{ log: string }> {
  await checkedData(cwd);
  signal = AbortSignal.any([signal, AbortSignal.timeout(engine.timeoutMs)]);
  return new Promise((resolve, reject) => {
    let log = '';
    const child = spawn(engine.command, [...engine.args, ...args], { cwd, env: environment(engine), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, signal });
    const capture = (bytes: Buffer) => { log = (log + bytes.toString()).slice(-16000); };
    child.stdout?.on('data', capture); child.stderr?.on('data', capture);
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve({ log }) : reject(new Error(`Engine command exited ${code}: ${log}`)));
  });
}
