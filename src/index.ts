import type { Context } from '@deepseek-ai/cordis';
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-skill';
import type {} from '@deepseek-ai/dsh-system-prompt';
import z from '@deepseek-ai/schemastery';
import { Ajv } from 'ajv';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { homedir } from 'node:os';
import { BackendPool, run, valueOf, type Engine } from './backend.ts';
import { repository, checkedPath, sha256 } from './safety.ts';
import { commitPlan, type EditPlan } from './refactor.ts';
import { exposed, groups, publicName, skillWorkflow, type Workflow } from './workflows.ts';

export const name = 'code-review-graph';
export const inject = ['tools', 'agents', 'fs', 'sandboxPolicy', 'skills', 'systemPrompt'];
const engineDir = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'code-review-graph', 'engine');
export const Config = z.object({
  engineCommand: z.string().default(join(engineDir, process.platform === 'win32' ? 'Scripts/code-review-graph.exe' : 'bin/code-review-graph')),
  engineArgs: z.array(z.string()).default([]),
  timeoutMs: z.number().min(1000).default(120000),
  authorizedRepos: z.array(z.string()).default([]),
  embeddingProviders: z.array(z.string()).default(['local']),
  embeddingEnv: z.array(z.string()).default([]),
});
export interface Configuration { engineCommand: string; engineArgs: string[]; timeoutMs: number; authorizedRepos: string[]; embeddingProviders: string[]; embeddingEnv: string[] }
interface Capability { name: string; description?: string; inputSchema: Record<string, unknown> & { properties?: Record<string, unknown>; required?: string[] } }
export const output: ToolDefinition['output'] = {
  schema: { type: 'object', additionalProperties: true },
  render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
};

export async function apply(ctx: Context, config: Configuration): Promise<void> {
  const engine: Engine = { command: config.engineCommand, args: config.engineArgs, timeoutMs: config.timeoutMs, env: Object.fromEntries(config.embeddingEnv.filter(key => /^(OPENAI|GOOGLE|GEMINI|MINIMAX|VOYAGE|CRG)_/.test(key) && process.env[key] !== undefined).map(key => [key, process.env[key]!])) };
  const pool = new BackendPool(engine);
  const snapshot = JSON.parse(await readFile(new URL('../capabilities.json', import.meta.url), 'utf8')) as { tools: Capability[] };
  const tools = snapshot.tools.filter(t => t.name !== 'get_refactor_edit_plan_tool');
  const names = tools.map(t => t.name);
  const masks = new Map<string, () => void>();
  const ajv = new Ajv({ strict: false, allErrors: true });
  const life = new AbortController();
  ctx.effect(() => () => { life.abort(); for (const dispose of masks.values()) dispose(); return pool.dispose(); });
  const switchWorkflow = (agent: NonNullable<ToolRunContext['agent']>, workflow?: Workflow) => {
    pool.activate(agent.id);
    const available = workflow ? exposed(workflow, names) : [];
    masks.get(agent.id)?.();
    masks.set(agent.id, agent.ctx.tools.restrict({ deny: names.filter(n => !available.includes(n)).map(publicName) }));
    return available.map(publicName);
  };

  async function rootFor(exec: ToolRunContext) {
    if (!exec.agent) throw new Error('Graph tools require a session-owned agent');
    return repository(exec.agent.session.header.cwd);
  }

  async function invoke(raw: string, args: Record<string, unknown>, exec: ToolRunContext) {
    const root = await rootFor(exec);
    const owner = exec.agent!.id;
    const signal = AbortSignal.any([exec.signal, life.signal]);
    const providerKey = ['build_or_update_graph_tool', 'run_postprocess_tool'].includes(raw) ? 'embedding_provider' : 'provider';
    const provider = args[providerKey];
    if (raw === 'get_docs_section_tool') await checkedPath(root, 'docs/LLM-OPTIMIZED-REFERENCE.md', true);
    if (provider && (typeof provider !== 'string' || !config.embeddingProviders.includes(provider))) throw new Error('Embedding provider has not been authorized in plugin configuration');
    if (['semantic_search_nodes_tool', 'embed_graph_tool'].includes(raw) && !provider) args = { ...args, provider: 'local' };
    for (const key of ['file_path', 'file', 'path']) {
      if (typeof args[key] === 'string') await checkedPath(root, args[key] as string);
    }
    for (const key of ['changed_files', 'files']) {
      if (Array.isArray(args[key])) for (const path of args[key] as string[]) await checkedPath(root, path, true);
    }
    if (raw === 'list_repos_tool') {
      const roots = [...new Set([root, ...await Promise.all(config.authorizedRepos.map(repository))])];
      return { status: 'ok', repos: roots.map(path => ({ alias: roots.filter(r => basename(r) === basename(path)).length > 1 ? `${basename(path)}@${sha256(path).slice(0, 8)}` : basename(path), path })) };
    }
    if (raw === 'cross_repo_search_tool') {
      const roots = [...new Set([root, ...await Promise.all(config.authorizedRepos.map(repository))])];
      const aliases = roots.map(path => ({ path, alias: roots.filter(r => basename(r) === basename(path)).length > 1 ? `${basename(path)}@${sha256(path).slice(0, 8)}` : basename(path) }));
      const selected = Array.isArray(args.repos) ? args.repos as string[] : [];
      if (selected.some(n => !aliases.some(r => r.alias === n))) throw new Error('Repository is not authorized');
      const results: Record<string, unknown>[] = [];
      for (const { path: repo, alias } of aliases.filter(r => !selected.length || selected.includes(r.alias))) {
        if (repo !== root && !await stat(join(repo, '.code-review-graph/graph.db')).then(() => true, () => false)) throw new Error(`Build ${repo} in its own session first`);
        await pool.ensure(repo, owner, signal);
        const data = valueOf(await pool.call(repo, owner, 'semantic_search_nodes_tool', { query: args.query, kind: args.kind, limit: args.limit ?? 20, provider: 'local', repo_root: repo }, signal));
        for (const result of data.results as Record<string, unknown>[]) results.push({ ...result, repo: alias });
      }
      results.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
      const limit = Math.min(Number(args.max_results ?? 50), 100);
      return { status: 'ok', results: results.slice(0, limit), total: results.length, results_omitted: Math.max(0, results.length - limit), truncated: results.length > limit };
    }
    const graphUpdate = raw !== 'build_or_update_graph_tool' ? await pool.ensure(root, owner, signal) : undefined;
    if (raw === 'apply_refactor_tool' && !args.dry_run) {
      const plan = valueOf(await pool.call(root, owner, 'get_refactor_edit_plan_tool', { refactor_id: args.refactor_id, repo_root: root }, signal)) as unknown as EditPlan;
      const result = await commitPlan(ctx, exec, root, plan);
      if (result.status === 'ok') {
        try { return { ...result, graph_update: valueOf(await pool.call(root, owner, 'build_or_update_graph_tool', { repo_root: root }, signal)) }; }
        catch (error) { return { ...result, graph_update_error: String(error) }; }
      }
      return result;
    }
    if (raw === 'apply_refactor_tool') args = { ...args, dry_run: true };
    const result = valueOf(await pool.call(root, owner, raw, { ...args, repo_root: root }, signal));
    if (raw === 'build_or_update_graph_tool') await pool.ensure(root, owner, signal);
    return graphUpdate ? { ...result, graph_update: graphUpdate } : result;
  }

  for (const tool of tools) {
    const parameters = structuredClone(tool.inputSchema);
    delete parameters.properties?.repo_root;
    parameters.required = parameters.required?.filter(n => n !== 'repo_root');
    parameters.additionalProperties = false;
    const validate = ajv.compile(parameters);
    const definition = {
      name: publicName(tool.name), description: tool.description ?? tool.name, parameters, output,
      timeoutMs: config.timeoutMs,
      execute: async (args: unknown, exec: ToolRunContext) => {
        if (!validate(args)) throw new Error(ajv.errorsText(validate.errors));
        return invoke(tool.name, args as Record<string, unknown>, exec);
      },
    } as ToolDefinition;
    ctx.effect(() => ctx.tools.register(definition));
  }

  ctx.effect(() => ctx.tools.register({ name: 'crg_workflow', description: 'Select code graph tools: context, review, refactor, export, advanced or all. Begin with get_minimal_context.',
    parameters: { type: 'object', properties: { workflow: { type: 'string', enum: [...groups] } }, required: ['workflow'], additionalProperties: false }, output,
    execute: async (args, exec) => {
      const workflow = (args as { workflow: Workflow }).workflow;
      if (!groups.includes(workflow) || !exec.agent) throw new Error('Invalid workflow or missing agent');
      return { tools: switchWorkflow(exec.agent, workflow) };
    },
  }));

  const visualizationSchema = { type: 'object', properties: {
    mode: { type: 'string', enum: ['auto', 'file', 'community', 'full'] },
    format: { type: 'string', enum: ['html', 'json', 'graphml', 'cypher', 'obsidian', 'svg'] },
    seed_file: { type: 'array', items: { type: 'string' } }, seed_symbol: { type: 'string' }, seed_changed: { type: 'boolean' }, seed_changed_base: { type: 'string' }, seed_flow: { type: 'string' },
    path_from: { type: 'string' }, path_to: { type: 'string' }, depth: { type: 'integer', minimum: 0 }, render_depth: { type: 'integer', minimum: 0 }, max_nodes: { type: 'integer', minimum: 1 },
  }, additionalProperties: false };
  const validateVisualization = ajv.compile(visualizationSchema);
  ctx.effect(() => ctx.tools.register({ name: 'crg_visualize', description: 'Generate the local interactive graph for the DSH Code graph sidebar, or export HTML, JSON, GraphML, Cypher, Obsidian or SVG. Supports file, community, symbol, changed-code, flow and shortest-path views.',
    parameters: visualizationSchema, output,
    timeoutMs: config.timeoutMs,
    execute: async (value, exec) => {
      if (!validateVisualization(value)) throw new Error(ajv.errorsText(validateVisualization.errors));
      const args = value as Record<string, unknown>;
      const root = await rootFor(exec);
      const signal = AbortSignal.any([exec.signal, life.signal]);
      await pool.ensure(root, exec.agent!.id, signal);
      for (const path of (args.seed_file ?? []) as string[]) await checkedPath(root, path, true);
      const command = ['visualize', '--repo', root];
      for (const [key, value] of Object.entries(args)) {
        const flag = `--${key.replaceAll('_', '-')}`;
        if (Array.isArray(value)) for (const item of value) command.push(flag, String(item));
        else if (value === true) command.push(flag);
        else if (value !== undefined && value !== false) command.push(flag, String(value));
      }
      const { log } = await run(engine, command, root, signal);
      const format = String(args.format ?? 'html');
      return { status: 'ok', path: join(root, '.code-review-graph', format === 'obsidian' ? 'obsidian' : `graph.${format}`), ...(format === 'html' ? { sidebar: 'code-review-graph' } : {}), log };
    },
  }));
  const promptNames = ['review_changes', 'architecture_map', 'debug_issue', 'onboard_developer', 'pre_merge_check'];
  const promptSchema = { type: 'object', properties: { name: { type: 'string', enum: promptNames }, base: { type: 'string' }, description: { type: 'string' } }, required: ['name'], additionalProperties: false };
  const validatePrompt = ajv.compile(promptSchema);
  ctx.effect(() => ctx.tools.register({ name: 'crg_prompt', description: 'Load one of the five original CRG workflows and reveal its graph tools.', parameters: promptSchema, output,
    execute: async (args, exec) => {
      if (!validatePrompt(args) || !exec.agent) throw new Error('Invalid workflow prompt or missing agent');
      const { name, ...parameters } = args as { name: string; base?: string; description?: string };
      const workflow: Workflow = name === 'pre_merge_check' ? 'all' : name === 'review_changes' ? 'review' : name === 'debug_issue' ? 'review' : 'advanced';
      switchWorkflow(exec.agent, workflow);
      const root = await rootFor(exec);
      const { client } = await pool.acquire(root, exec.agent.id);
      const result = await client.getPrompt({ name, arguments: parameters }, { signal: AbortSignal.any([exec.signal, life.signal]), timeout: config.timeoutMs });
      return { ...result, messages: result.messages.map(message => ({ ...message, content: message.content.type === 'text' ? { ...message.content, text: message.content.text.replace(/\b([a-z_]+_tool)\b/g, raw => names.includes(raw) ? publicName(raw) : raw) } : message.content })) };
    },
  }));
  ctx.on('agent/created', ({ agent }) => { switchWorkflow(agent); return undefined; });
  ctx.on('agent/disposed', ({ agent }) => { masks.get(agent.id)?.(); masks.delete(agent.id); return pool.release(agent.id); });
  for (const agent of ctx.agents.list()) switchWorkflow(agent);
  ctx.effect(() => ctx.systemPrompt.section({ name: 'code-review-graph', order: 80, interpolate: false,
    text: 'Use crg_workflow to reveal task-specific local code graph tools, then get_minimal_context_tool before broader queries. Prefer minimal detail. crg_visualize opens the local graph in the Code graph sidebar. Refactors use session filesystem permissions.' }));

  const skillsDir = new URL('../skills/', import.meta.url);
  for (const slug of await readdir(skillsDir)) {
    const path = new URL(`${slug}/SKILL.md`, skillsDir);
    const body = await readFile(path, 'utf8');
    const content = body.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/\b([a-z_]+_tool)\b/g, raw => names.includes(raw) ? publicName(raw) : raw);
    if (!skillWorkflow[slug]) throw new Error(`Unmapped CRG skill: ${slug}`);
    ctx.effect(() => ctx.skills.register({ name: `crg-${slug}`, description: `Code review graph: ${slug}`, source: 'bundled', content: `First call crg_workflow with workflow "${skillWorkflow[slug]}". Tool names use mcp__code_review_graph__ prefixes.\n\n${content}` }));
  }
}
