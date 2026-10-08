import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { load, version } from './runtime.mjs';
import * as plugin from '../dist/index.js';
import { publicName, skillWorkflow } from '../dist/workflows.js';

test(`Released DSH ${version}: real session, real CRG, deterministic tools, no model`, { timeout: 240000 }, async () => {
  assert.ok(process.env.CRG_COMMAND, 'Set CRG_COMMAND to the prepared real engine executable');
  const temp = await mkdtemp(join(tmpdir(), 'dsh-crg-integration-'));
  const root = join(temp, 'repo'); await mkdir(root);
  const sibling = join(temp, 'authorized'); await mkdir(sibling);
  execFileSync('git', ['init', sibling], { stdio: 'ignore' });
  await writeFile(join(sibling, 'other.py'), 'def external():\n    return 42\n');
  execFileSync('git', ['init', root], { stdio: 'ignore' });
  const source = '\uFEFFdef total(a, b):\r\n    return a + b\r\n\r\ndef main():\r\n    return total(2, 3)\r\n';
  const changedSource = '\uFEFFdef total(a, b):\r\n    return a + b\r\n\r\ndef added():\r\n    return total(1, 1)\r\n';
  await writeFile(join(root, 'demo.py'), source);
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'fixture'], { cwd: root, stdio: 'ignore' });
  const [{ Context }, { default: Prompt }, { default: Tools }, { default: Agents }, { default: Skills }, { default: Sessions, SessionId }, { default: Projections }, { default: Fs }, { default: Policy }, { createScope }] = await Promise.all([
    load('cordis'), load('dsh-system-prompt'), load('dsh-tools'), load('dsh-agent'), load('dsh-skill'), load('dsh-session'), load('dsh-session-projection'), load('dsh-fs-local'), load('dsh-sandbox-policy'), load('dsh-scope'),
  ]);
  const ctx = new Context();
  await ctx.plugin(Prompt, {}); await ctx.plugin(Tools); await ctx.plugin(Agents); await ctx.plugin(Skills); await ctx.plugin(Sessions); await ctx.plugin(Projections); await ctx.plugin(Fs, {}); await ctx.plugin(Policy, { mode: 'workspace-write', workspaceRoot: root });
  const crg = ctx.plugin(plugin, { engineCommand: process.env.CRG_COMMAND, engineArgs: [], timeoutMs: 120000, authorizedRepos: [sibling], embeddingProviders: ['local'], embeddingEnv: [] });
  await crg;
  const skillNames = (await ctx.skills.list()).map(s => s.name).filter(n => n.startsWith('crg-'));
  assert.equal(skillNames.length, 7);
  assert.ok((await ctx.skills.get('crg-refactor-safely')).content.includes('mcp__code_review_graph__'));
  const transcript = { release: version, platform: process.platform, execution: 'Deterministic ToolRuntime.execute; real Session/AgentRegistry and CRG engine; no model inference', calls: [] };
  const agents = [];
  async function makeAgent(label, cwd = root) {
    let agent, scope, detach;
    const id = SessionId(label);
    const host = ctx.plugin(Object.assign(async inner => {
      const session = inner.sessions.create(id, { meta: { cwd } });
      agent = { id, session, options: {}, status: 'idle', inbox: {}, cancel() {}, send() {}, followup() {}, inject() {}, whenIdle: () => Promise.resolve() };
      scope = createScope(inner, agent); agent.ctx = scope.ctx;
      detach = await inner.agents.register(agent);
    }, { inject: ['sessions', 'agents', 'tools', 'systemPrompt'] }));
    await host; agents.push({ agent, scope, host, detach }); return agent;
  }
  let number = 0;
  async function invoke(agent, name, args = {}, signal = new AbortController().signal) {
    const result = await agent.ctx.tools.execute({ name, arguments: args, agent, callId: `crg-${++number}`, signal });
    transcript.calls.push({ agent: agent.id, name, args, result });
    return result;
  }
  const data = result => { assert.notEqual(result.isError, true, JSON.stringify(result)); return JSON.parse(result.content.find(c => c.type === 'text').text); };
  try {
    const a = await makeAgent('session-a'), b = await makeAgent('session-b');
    assert.equal((await invoke(a, publicName('list_graph_stats_tool'))).isError, true);
    data(await invoke(a, 'crg_workflow', { workflow: 'context' }));
    assert.equal((await invoke(b, publicName('list_graph_stats_tool'))).isError, true, 'workflow must be Agent-local');
    const stats = data(await invoke(a, publicName('list_graph_stats_tool')));
    assert.equal(stats.status, 'ok');
    assert.ok(JSON.stringify(stats).includes('Function'));
    for (const name of skillNames) {
      const skill = await ctx.skills.get(name);
      data(await invoke(a, 'crg_workflow', { workflow: skillWorkflow[name.slice(4)] }));
      for (const ref of new Set(skill.content.match(/mcp__code_review_graph__[a-z_]+_tool/g))) assert.ok(a.ctx.tools.get(ref, a.id), `${name} hides ${ref}`);
    }
    data(await invoke(b, 'crg_workflow', { workflow: 'all' }));
    data(await invoke(b, publicName('get_minimal_context_tool'), { task: 'understand total' }));
    const c = await makeAgent('session-c', sibling);
    data(await invoke(c, 'crg_workflow', { workflow: 'context' }));
    const otherStats = data(await invoke(c, publicName('list_graph_stats_tool')));
    assert.equal(otherStats.total_nodes, 2, 'Different repository must have a separate graph');
    const repos = data(await invoke(b, publicName('list_repos_tool'))).repos;
    assert.equal(repos.length, 2);
    const cross = data(await invoke(b, publicName('cross_repo_search_tool'), { query: 'external', repos: ['authorized'] }));
    assert.ok(cross.results.some(r => r.name === 'external'));
    assert.equal((await invoke(b, publicName('cross_repo_search_tool'), { query: 'private', repos: ['unauthorized'] })).isError, true);
    assert.equal((await invoke(b, publicName('semantic_search_nodes_tool'), { query: 'total', provider: 'openai' })).isError, true);
    assert.equal((await invoke(a, publicName('get_minimal_context_tool'), { task: 'bad', repo_root: temp })).isError, true);
    assert.equal((await invoke(a, publicName('get_minimal_context_tool'), { task: 'bad', changed_files: ['../escape.py'] })).isError, true);
    const outsideDocs = join(temp, 'outside-docs'); await mkdir(outsideDocs);
    await writeFile(join(outsideDocs, 'LLM-OPTIMIZED-REFERENCE.md'), '<section name="private">PRIVATE_FIXTURE</section>');
    await symlink(outsideDocs, join(root, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
    const escapedDocs = await invoke(a, publicName('get_docs_section_tool'), { section_name: 'private' });
    assert.equal(escapedDocs.isError, true);
    assert.match(JSON.stringify(escapedDocs), /Symlink|outside/);
    assert.ok(!JSON.stringify(escapedDocs).includes('PRIVATE_FIXTURE'));
    for (const name of ['review_changes', 'architecture_map', 'debug_issue', 'onboard_developer', 'pre_merge_check']) {
      const prompt = data(await invoke(a, 'crg_prompt', { name }));
      assert.ok(prompt.messages.length);
      for (const ref of new Set(JSON.stringify(prompt.messages).match(/mcp__code_review_graph__[a-z_]+_tool/g))) assert.ok(a.ctx.tools.get(ref, a.id), `${name} hides ${ref}`);
    }
    data(await invoke(a, publicName('get_architecture_overview_tool')));
    data(await invoke(a, publicName('get_review_context_tool'), { changed_files: ['demo.py'] }));
    data(await invoke(a, publicName('get_impact_radius_tool'), { changed_files: ['demo.py'] }));
    data(await invoke(a, publicName('get_affected_flows_tool'), { changed_files: ['demo.py'] }));
    data(await invoke(a, 'crg_visualize', { mode: 'full' }));
    assert.ok((await readFile(join(root, '.code-review-graph/graph.html'), 'utf8')).includes('<html'));
    for (const format of ['json', 'graphml', 'cypher', 'obsidian', 'svg']) data(await invoke(a, 'crg_visualize', { format }));
    data(await invoke(a, 'crg_visualize', { mode: 'full', path_from: 'main', path_to: 'total' }));
    await writeFile(join(root, 'demo.py'), changedSource);
    let updated = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const result = data(await invoke(b, publicName('semantic_search_nodes_tool'), { query: 'added' }));
      if (JSON.stringify(result.results).includes('added')) { updated = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    assert.ok(updated, 'watcher must incrementally index edits');
    await agents[0].host.dispose();
    data(await invoke(b, publicName('list_graph_stats_tool')));
    const preview = data(await invoke(b, publicName('refactor_tool'), { mode: 'rename', old_name: 'total', new_name: 'sum_values' }));
    assert.ok(preview.refactor_id, JSON.stringify(preview));
    data(await invoke(b, publicName('apply_refactor_tool'), { refactor_id: preview.refactor_id, dry_run: true }));
    const changed = data(await invoke(b, publicName('apply_refactor_tool'), { refactor_id: preview.refactor_id, dry_run: false }));
    assert.equal(changed.status, 'ok');
    assert.deepEqual(await readFile(join(root, 'demo.py')), Buffer.from(changedSource.replaceAll('total', 'sum_values')), 'Real DSH filesystem preserves BOM and CRLF');
    const stale = data(await invoke(b, publicName('refactor_tool'), { mode: 'rename', old_name: 'sum_values', new_name: 'old_plan' }));
    await writeFile(join(root, 'demo.py'), 'def replaced_by_user():\n    return 1\n');
    assert.equal((await invoke(b, publicName('apply_refactor_tool'), { refactor_id: stale.refactor_id, dry_run: false })).isError, true);
    assert.ok((await readFile(join(root, 'demo.py'), 'utf8')).includes('replaced_by_user'));
    data(await invoke(b, publicName('build_or_update_graph_tool')));
    const next = data(await invoke(b, publicName('refactor_tool'), { mode: 'rename', old_name: 'replaced_by_user', new_name: 'forbidden' }));
    assert.ok(next.refactor_id);
    b.session.append('sandbox/mode', { mode: 'read-only' });
    const refused = await invoke(b, publicName('apply_refactor_tool'), { refactor_id: next.refactor_id, dry_run: false });
    assert.equal(refused.isError, true);
    assert.match(JSON.stringify(refused), /read-only|permission|denied/i);
    assert.ok((await readFile(join(root, 'demo.py'), 'utf8')).includes('replaced_by_user'));
    b.session.append('sandbox/mode', { mode: 'workspace-write' });
    await writeFile(join(root, 'demo.py'), changedSource.replaceAll('total', 'sum_values'));
    data(await invoke(b, publicName('build_or_update_graph_tool')));
    data(await invoke(b, publicName('run_postprocess_tool')));
  } finally {
    for (const entry of agents) { await entry.host.dispose(); await entry.scope.dispose(); }
    await crg.dispose(); await ctx.fiber.dispose();
    await mkdir(resolve('test-results'), { recursive: true });
    await writeFile(resolve('test-results', `session-${version}-${process.platform}.json`), JSON.stringify(transcript, null, 2));
  }
});
