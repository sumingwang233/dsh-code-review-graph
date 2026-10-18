# 1.0.4

修复一个会导致会话在调用 `crg_workflow` / `crg_prompt` 之后整轮失败的缺陷，无功能变化。

## 缺陷

注册 MCP 工具时把输入的 JSON Schema 复制一份并剥掉 `repo_root`：

```ts
parameters.required = parameters.required?.filter(n => n !== 'repo_root');
```

`capabilities.json` 里多数工具没有 `required` 字段，于是这一行的右值求值为 `undefined`，
并被赋成一个**自有可枚举键** `required: undefined`。DSH 的会话日志会对每条事件做
无损 JSON 校验（`snapshotJsonValue`），`undefined` 直接判定为不可序列化：

```
session event "request/header" carries non-JSON-serializable data
```

第一次请求写 `request/header` 时这些工具还处于 workflow mask 屏蔽状态，所以不受影响；
一旦 `crg_workflow` 揭示它们，工具表发生变化，DSH 需要重记 `request/header`，
`append` 立即抛错，整轮以 `turn/end { kind: "error" }` 结束（连模型都没被调用）。

## 修复

```ts
// capabilities.json omits `required` for most tools, so a plain optional chain
// would assign `undefined` as an own key and break DSH's lossless-JSON session
// log ("session event \"request/header\" carries non-JSON-serializable data").
if (Array.isArray(parameters.required)) parameters.required = parameters.required.filter(n => n !== 'repo_root');
else delete parameters.required;
```

- 不是数组（未声明）就不产生这个键，而不是写一个值为 `undefined` 的键。
- `src/index.ts` 之外无同型反模式（`backend.ts` 的 `?.filter(...)` 由 `?? ''` 兜底）。

## 回归测试

新增 `tests/schema.test.mjs`（`node --test tests/*.test.mjs` 自动收集），用 stub Cordis
ctx 装载真实的 `dist/index.js`，对注册出来的全部工具定义施加与 DSH 会话日志同一套
无损 JSON 判定：

1. 所有注册 schema 可无损序列化，且 JSON round-trip 后结构相等；
2. `capabilities.json` 未写 `required` 的工具，注册后不得出现自有 `required` 键；
3. `repo_root` 不得出现在任何面向模型的 schema 中；
4. 六个 workflow 揭示的每个工具 schema 都干净，且揭示的名字都已注册；
5. 交叉验证：直接调用 `@deepseek-ai/dsh-util-values` 的 `snapshotJsonValue`
   （即当初抛错的函数本体），测试运行时未准备时自动 skip。

红→绿：在 1.0.3 的 `dist` 上第 4 条失败，`context` workflow 揭示的三个工具
（`build_or_update_graph_tool`、`get_minimal_context_tool`、`list_graph_stats_tool`）
报 `$.required`；`npm run build` 后 10 个用例全绿，`npm run typecheck` 为 0。

`npm test` 保持全部通过，工具数量、五个 prompt workflow、七个技能、`/crg-setup`
与 `/crg-graph` 均未改动。验证范围及证据限制见 [验证记录](validation.md)。

安装 `dsh-code-review-graph@1.0.4` 后重启 DSH 生效；此前因该缺陷中断的会话可以直接
继续（工具揭示状态是运行期内存态，重启后不会自动重放），但请先升级到本版本，
否则再次调用 `crg_workflow` / `crg_prompt` 仍会复现。

## English

Fixes a defect that failed the whole turn after `crg_workflow` / `crg_prompt`. No
behaviour change otherwise.

When registering MCP tools the plugin strips `repo_root` from a copy of the input
schema. Most tools in `capabilities.json` omit `required`, so the optional chain
evaluated to `undefined` and assigned it as an own key — `required: undefined`.
DSH validates every session event as lossless JSON (`snapshotJsonValue`), which
rejects `undefined`, so recording the `reason: "change"` `request/header` that
`crg_workflow` triggers threw
`session event "request/header" carries non-JSON-serializable data` and the turn
ended with `turn/end { kind: "error" }` before the model was ever called.

The fix only narrows `required` when it is an array and deletes the key otherwise.
`tests/schema.test.mjs` pins the invariant on the real built bundle, including a
cross-check against the real `snapshotJsonValue` validator, and fails on the 1.0.3
build (three `context`-revealed tools, path `$.required`).
