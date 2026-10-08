# dsh-code-review-graph

[简体中文](README.md) · [Capability map](docs/capabilities.md) · [Validation](docs/validation.md)

Native DeepSeek Harness tools and a Web/Desktop graph sidebar, powered by
[Code Review Graph](https://github.com/tirth8205/code-review-graph) **2.3.9**.
Preserves all 30 tools, five prompt workflows and seven skills. The first release
target is **0.1.0**; check GitHub/npm for the actual published release status.

Supports Windows, Linux and macOS, with exact DSH baselines **0.1.5-rc.2** and
**0.2.0-rc.2**. Alpha compatibility is outside the contract.

## Installation

After public release:

```sh
dsh plugin --profile web add dsh-code-review-graph@0.1.0
npx dsh-code-review-graph@0.1.0 prepare
```

Use `headless` or another ordinary profile for the command-line entrance. Desktop
profiles belong to the application: install through that release's native plugin
manager. See the [official DSH publishing guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md).

`prepare` explicitly creates an isolated Python engine under
`$DSH_HOME/code-review-graph/engine` (default `~/.dsh/code-review-graph/engine`),
preferring uv or real Python 3.10+. Windows Store aliases are rejected; an explicit
`--python /path/to/python` is supported. Ordinary startup never installs packages,
downloads embedding models or automatically enables a cloud provider. Search
falls back to the engine's FTS/keyword search without optional embeddings.

The default engine source is an exact public contribution-fork commit recorded
in [engine.json](engine.json), needed until the read-only edit-plan API ships in
an official upstream release. For local development:

```sh
npm ci
npm run typecheck
npm run build
npm pack
dsh plugin --profile web add ./dsh-code-review-graph-0.1.0.tgz
node dist/setup.js prepare ../code-review-graph
```

## Workflows and graph

Start a session in a local Git/SVN repository. Call `crg_workflow` with `context`,
`review`, `refactor`, `export`, `advanced`, or `all`. Restrictions are Agent-local
and affect only this plugin's tools. Original tools use the
`mcp__code_review_graph__` prefix. `crg_prompt` loads any of the original five
workflows and reveals the corresponding tools; skills use `crg-<original-name>`.

First use builds the graph; subsequent file changes are indexed incrementally.
Active Agents in the same canonical repository share workers and watchers. The
last owner releases them. A cancelled or timed-out call stops that repository's
shared worker; another concurrent call may also be interrupted. Later calls
reconnect. Failures and partial parsing warnings are retained in results.

Call `crg_visualize`, open **Code graph / 代码图谱** in the right sidebar, then
refresh. The original renderer retains search, filters, zoom, dragging,
aggregation, paths and downloads. Supported options include `mode`,
file/symbol/changed-code/flow seeds, `path_from`/`path_to`, depth and node limits.
Export formats: HTML, JSON, GraphML, Cypher, Obsidian and SVG (optional engine
`[eval]` dependency set). Headless calls return local artifact paths. To prepare
optional dependencies, use the exact source from `engine.json` as the `prepare`
argument, changing the distribution name to `code-review-graph[eval]` for SVG or
`code-review-graph[embeddings]` for local vectors. Models must already be available
locally; daily operation keeps Hugging Face/Transformers offline.

Assets use DSH's existing workspace file reader, adapting only the two released
reader interfaces. Local assets are inlined into an iframe with scripts and
downloads enabled, without same-origin or network privilege. No fixed-port
server is started and no graph-database directory is exposed.

## Permissions and refactors

Model inputs cannot supply `repo_root`. Execution uses the session's canonical
repository, checks traversal/symlink boundaries, and only allows cross-repository
search over the current root plus user-configured `authorizedRepos`. Other roots
must first be built in their own sessions.

Non-preview `apply_refactor_tool` requests a complete read-only core edit plan,
checks original byte hashes and native file intents, then commits through
`ctx.fs.writeText` with session policy. Each file write is atomic, preserving
UTF-8, BOM and newlines. A failure stops subsequent writes and returns
`partial_failure`, committed paths and the complete `recovery_patch`. Recovery
must check its hashes before overwriting any later user changes.

Cloud embedding providers require explicit `embeddingProviders` authorization
and an `embeddingEnv` list naming the environment variables the engine may
receive. The default only permits `local`. Never put credentials in config files.

## Validation and removal

```sh
npm run prepare:tests
npm test
npm run test:integration
```

Set child-process `CRG_COMMAND` to a prepared real engine, and choose a supported
`DSH_VERSION`. Transcripts record deterministic calls in real released DSH
Session/AgentRegistry/ToolRuntime packages, with a real CRG backend and **no
model inference**. See validation records for results and limits; upstream
reviewers decide whether the evidence meets their contribution requirements.

```sh
dsh plugin --profile web remove dsh-code-review-graph
```

The native manager removes only this bundle and dependency, retaining user
settings, other plugins, the prepared engine and repository graph data. Desktop
uses its native manager for removal.

MIT licensed; upstream Tirth Kanani copyright retained.
Platform request: [CRG #1100](https://github.com/tirth8205/code-review-graph/issues/1100).
