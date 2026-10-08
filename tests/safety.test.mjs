import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkedPath, checkedData, sha256, scrubEnv } from '../dist/safety.js';
import { commitPlan } from '../dist/refactor.js';
import { exposed, publicName } from '../dist/workflows.js';
import { inlineGraph } from '../dist/html.js';
import { readAsset } from '../dist/client.js';

test('repository fence includes missing paths, symlinks and graph artifacts', async () => {
  const temp = await realpath(await mkdtemp(join(tmpdir(), 'dsh-crg-fence-')));
  const root = join(temp, 'repo'), outside = join(temp, 'outside');
  await mkdir(root); await mkdir(outside);
  await writeFile(join(outside, 'file.py'), 'outside');
  await assert.rejects(checkedPath(root, '../outside/file.py'), /outside/);
  assert.equal(await checkedPath(root, 'deleted.py', true), join(root, 'deleted.py'));
  await symlink(outside, join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkedPath(root, 'alias/file.py'), /Symlink/);
  await symlink(outside, join(root, '.code-review-graph'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkedData(root), /Symlink/);
  assert.deepEqual(scrubEnv({ PATH: 'path', OPENAI_BASE_URL: 'https://unrequested.invalid', SOME_API_KEY: 'secret' }), { PATH: 'path', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' });
});

test('all 30 tools have a workflow; internal edit plans never reach the model', async () => {
  const caps = JSON.parse(await readFile(new URL('../capabilities.json', import.meta.url)));
  const names = caps.tools.filter(t => t.name !== 'get_refactor_edit_plan_tool').map(t => t.name);
  assert.equal(names.length, 30); assert.equal(caps.prompts.length, 5);
  const visible = new Set(['context', 'review', 'refactor', 'export', 'advanced'].flatMap(w => exposed(w, names)));
  assert.deepEqual([...visible].sort(), [...names].sort());
  assert.equal(publicName('refactor_tool'), 'mcp__code_review_graph__refactor_tool');
});

test('iframe inlines local assets and has no network or origin privilege', async () => {
  const html = await inlineGraph('<html><head></head><body><script src="d3.min.js" onerror="cloud()"></script><script>window.d3 || document.write(\'<script src="https://d3js.org/d3.js"><\\/script>\');</script></body></html>', async () => '/* https://d3js.org */ window.ready=true; const dollar="$&";');
  assert.ok(html.includes('window.ready=true')); assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!html.includes('onerror='));
  assert.ok(html.includes('const dollar="$&"'));
  await assert.rejects(inlineGraph('<script src="../graph.db"></script>', async () => ''), /nonlocal/);
  await assert.rejects(inlineGraph('<script src="https://remote.invalid/d3.js"></script>', async () => ''), /nonlocal/);
  const signal = new AbortController().signal;
  assert.equal(await readAsset({ readBytes: async () => ({ ok: true, value: { data: new TextEncoder().encode('中文') } }) }, 'session', 'file', signal), '中文');
  assert.equal(await readAsset({ readAll: async () => ({ ok: true, value: { data: Buffer.from('中文').toString('base64') } }) }, 'session', 'file', signal), '中文');
});

test('refactor preflights every hash; stops on failure and returns a complete recovery patch', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-crg-edit-')));
  const paths = ['a.py', 'b.py'].map(p => join(root, p));
  for (const path of paths) await writeFile(path, '\uFEFFold\r\n');
  let writes = 0, deny = false, fail = false;
  const ctx = { sandboxPolicy: { resolve: () => ({ mode: deny ? 'read-only' : 'workspace-write', workspaceRoot: root }) }, waterfall: async () => undefined, emit() {}, fs: {
    resolve: async path => ({ targetKey: path, displayPath: path }),
    stat: async target => ({ type: 'file', version: sha256(await readFile(target.targetKey)) }),
    readBytes: async target => readFile(target.targetKey),
    writeText: async (target, value, intent) => {
      if (fail && writes === 1) throw new Error('simulated atomic write failure');
      assert.equal(intent.version, sha256(await readFile(target.targetKey)));
      await writeFile(target.targetKey, value); writes++; return { version: sha256(value) };
    },
  } };
  const exec = { agent: { session: {} }, signal: new AbortController().signal };
  const plan = { files: paths.map(path => ({ path, before_sha256: sha256('\uFEFFold\r\n'), after_content: '\uFEFFnew\r\n', edit_count: 1 })) };
  deny = true; await assert.rejects(commitPlan(ctx, exec, root, plan), /read-only/); assert.equal(writes, 0);
  deny = false;
  const stale = structuredClone(plan); stale.files[1].before_sha256 = sha256('stale');
  await assert.rejects(commitPlan(ctx, exec, root, stale), /Stale/); assert.equal(writes, 0);
  fail = true;
  const result = await commitPlan(ctx, exec, root, plan);
  assert.equal(result.status, 'partial_failure'); assert.deepEqual(result.files_modified, [paths[0]]);
  assert.deepEqual(result.recovery_patch.files, [{ path: paths[0], before_sha256: sha256('\uFEFFnew\r\n'), after_content: '\uFEFFold\r\n', edit_count: 1 }]);
  assert.equal(await readFile(paths[1], 'utf8'), '\uFEFFold\r\n');
});
