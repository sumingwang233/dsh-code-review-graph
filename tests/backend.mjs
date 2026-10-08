import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { BackendPool, run } from '../dist/backend.js';

test('real workers share a canonical repository and terminate with their final owner', { timeout: 120000 }, async () => {
  assert.ok(process.env.CRG_COMMAND);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-crg-workers-')));
  execFileSync('git', ['init', root], { stdio: 'ignore' });
  await writeFile(join(root, 'main.py'), 'def greet():\n    return "hello"\n');
  const engine = { command: process.env.CRG_COMMAND, args: [], timeoutMs: 60000 };
  const pool = new BackendPool(engine);
  try {
    await pool.ensure(root, 'a', new AbortController().signal);
    const first = await pool.acquire(root, 'a'), second = await pool.acquire(root, 'b');
    assert.equal(first, second); const watcher = first.watcher;
    assert.ok(watcher.pid); assert.equal(first.owners.size, 2);
    await pool.release('a'); assert.equal(first.owners.size, 1); assert.equal(watcher.exitCode, null); assert.equal(watcher.signalCode, null);
    await pool.release('b'); assert.ok(watcher.exitCode !== null || watcher.signalCode !== null);
    pool.activate('a'); await pool.ensure(root, 'a', new AbortController().signal);
    const restarted = await pool.acquire(root, 'a'); assert.notEqual(restarted, first);
    const abort = new AbortController();
    const pending = pool.call(root, 'a', 'build_or_update_graph_tool', { repo_root: root, full_rebuild: true }, abort.signal);
    setTimeout(() => abort.abort(new Error('user cancelled')), 1);
    await assert.rejects(pending);
    await pool.ensure(root, 'c', new AbortController().signal);
    assert.notEqual(await pool.acquire(root, 'c'), restarted);
  } finally { await pool.dispose(); }
});

test('missing engine reports explicit preparation; no download is attempted', { timeout: 15000 }, async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-crg-missing-')));
  const pool = new BackendPool({ command: join(root, 'missing-crg'), args: [], timeoutMs: 1000 });
  try { await assert.rejects(pool.ensure(root, 'a', new AbortController().signal), /Set up engine.*crg-setup/); }
  finally { await pool.dispose(); }
});

test('command timeout terminates execution with an explicit error', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-crg-timeout-')));
  await assert.rejects(run({ command: process.execPath, args: [], timeoutMs: 50 }, ['-e', 'setInterval(()=>{},1000)'], root, new AbortController().signal), /abort/i);
});
