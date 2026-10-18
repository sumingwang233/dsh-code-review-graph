import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Regression guard for the "request/header carries non-JSON-serializable data"
// crash: DSH snapshots every registered tool schema into the session log with a
// lossless-JSON writer that rejects `undefined`, sparse arrays, symbol keys and
// non-plain objects anywhere in the value. capabilities.json omits `required`
// for most tools, so assigning `schema.required = schema.required?.filter(...)`
// used to leave an own `required: undefined` key behind and kill the turn the
// moment a workflow revealed such a tool. Load the real artifact, capture what
// it registers, and hold every schema to that invariant.

const config = {
  engineCommand: 'noop', engineArgs: [], timeoutMs: 120000,
  authorizedRepos: [], embeddingProviders: ['local'], embeddingEnv: [],
};

async function registrations() {
  const { apply } = await import('../dist/index.js');
  const { groups, exposed, publicName } = await import('../dist/workflows.js');
  const tools = [];
  const noop = () => () => {};
  const ctx = {
    effect: fn => { fn(); return noop; }, inject: () => noop, on: () => noop,
    emit: () => {}, waterfall: async (_name, value) => value,
    fs: {}, sandboxPolicy: {}, agents: { list: () => [] },
    systemPrompt: { section: () => noop }, skills: { register: () => noop },
    tools: { register: (definition) => { tools.push(definition); return noop; }, restrict: () => noop },
  };
  await apply(ctx, config);
  return { tools, groups, exposed, publicName, caps: JSON.parse(await readFile(new URL('../capabilities.json', import.meta.url))) };
}

/** Return the first path that would be lost by JSON.stringify, or undefined. */
function lossy(value, path = '$', seen = new Set()) {
  if (value === null) return undefined;
  const kind = typeof value;
  if (kind === 'boolean' || kind === 'string') return undefined;
  if (kind === 'number') return Number.isFinite(value) && !Object.is(value, -0) ? undefined : path;
  if (kind !== 'object') return path;
  if (seen.has(value)) return path;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) return path;
      for (let index = 0; index < value.length; index += 1) {
        const nested = lossy(value[index], `${path}[${index}]`, seen);
        if (nested) return nested;
      }
      return undefined;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== Object.prototype) return path;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') return path;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) return path;
      const nested = lossy(descriptor.value, `${path}.${key}`, seen);
      if (nested) return nested;
    }
    return undefined;
  } finally {
    seen.delete(value);
  }
}

test('every registered tool schema survives the session log lossless-JSON writer', async () => {
  const { tools } = await registrations();
  assert.ok(tools.length >= 33, `expected the full tool surface, got ${tools.length}`);
  const lossyTools = tools.map(tool => [tool.name, lossy(tool.parameters)]).filter(([, path]) => path);
  assert.deepEqual(lossyTools, [], `schemas with undefined/unsafe values: ${JSON.stringify(lossyTools)}`);
  for (const tool of tools) {
    assert.deepEqual(JSON.parse(JSON.stringify(tool.parameters)), tool.parameters, `${tool.name} does not survive a JSON round-trip`);
  }
});

test('tools whose capabilities omit required register no required key at all', async () => {
  const { tools, caps } = await registrations();
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const optional = caps.tools.filter(tool => tool.name !== 'get_refactor_edit_plan_tool' && !Array.isArray(tool.inputSchema.required));
  assert.ok(optional.length > 0, 'fixture expectation: most capabilities omit required');
  for (const capability of optional) {
    const registered = byName.get(`mcp__code_review_graph__${capability.name}`);
    assert.ok(registered, `${capability.name} was not registered`);
    assert.equal(Object.hasOwn(registered.parameters, 'required'), false, `${capability.name} registers an own required key`);
  }
});

test('repo_root is stripped from every model-facing schema', async () => {
  const { tools } = await registrations();
  const leaked = tools.filter(tool => JSON.stringify(tool.parameters).includes('repo_root')).map(tool => tool.name);
  assert.deepEqual(leaked, []);
  for (const tool of tools) assert.ok(!(tool.parameters.required ?? []).includes('repo_root'), tool.name);
});

test('every workflow reveal keeps the whole schema surface serializable', async () => {
  const { tools, groups, exposed, publicName } = await registrations();
  const byName = new Map(tools.map(tool => [tool.name, tool]));
  const raw = [...byName.keys()].map(name => name.replace(/^mcp__code_review_graph__/, ''));
  for (const workflow of groups) {
    const revealed = exposed(workflow, raw).map(name => byName.get(publicName(name)) ?? byName.get(name));
    assert.ok(revealed.length > 0, `${workflow} reveals nothing`);
    assert.deepEqual(revealed.filter(Boolean).map(tool => [tool.name, lossy(tool.parameters)]).filter(([, path]) => path), [], `${workflow} reveals a lossy schema`);
    assert.deepEqual(revealed.filter(tool => !tool), [], `${workflow} names an unregistered tool`);
  }
});

test('the real DSH writer accepts every schema it would log', async t => {
  // Cross-check with @deepseek-ai/dsh-util-values â€?the exact function that threw
  // "session event ... carries non-JSON-serializable data". Skipped when the DSH
  // test runtime has not been prepared (npm run prepare:tests).
  const runtime = await import('./runtime.mjs').catch(() => undefined);
  let snapshotJsonValue;
  try { ({ snapshotJsonValue } = await runtime.load('dsh-util-values')); }
  catch { return t.skip('DSH test runtime not prepared'); }
  const { tools } = await registrations();
  const rejected = tools.filter(tool => snapshotJsonValue(tool.parameters) === undefined).map(tool => tool.name);
  assert.deepEqual(rejected, [], `DSH would refuse to log these schemas: ${rejected.join(', ')}`);
});
