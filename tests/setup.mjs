import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { prepare } from '../dist/setup.js';
test('cancelled preparation stops before launching installers', async () => {
  const controller = new AbortController(); controller.abort(new Error('fixture cancellation'));
  await assert.rejects(prepare(undefined, undefined, { signal: controller.signal }), /fixture cancellation/);
});
test('explicit dependency preparation uses an isolated, repeatable engine', { timeout: 180000 }, async () => {
  const home = await mkdtemp(join(tmpdir(), 'dsh-crg-setup-'));
  const env = { ...process.env, DSH_HOME: home };
  const args = [resolve('dist/setup.js'), 'prepare', ...(process.env.CRG_SOURCE ? [process.env.CRG_SOURCE] : [])];
  execFileSync(process.execPath, args, { env, stdio: 'pipe', windowsHide: true, timeout: 150000 });
  const stamp = join(home, 'code-review-graph/engine/dsh-crg-source.json');
  const before = await readFile(stamp);
  const text = execFileSync(process.execPath, args, { env, encoding: 'utf8', stdio: 'pipe', windowsHide: true });
  assert.ok(text.includes('already prepared')); assert.deepEqual(await readFile(stamp), before);
});
