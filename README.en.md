# dsh-code-review-graph

[简体中文](README.md) · [Capability map](docs/capabilities.md) · [Validation](docs/validation.md)

Native DeepSeek Harness tools and a Web/Desktop graph sidebar, powered by
[Code Review Graph](https://github.com/tirth8205/code-review-graph) **2.3.9**.
Preserves all 30 tools, five prompt workflows and seven skills. Patch **0.1.1**
fixes native Web/Desktop client loading and sidebar display, with actual Desktop application validation.
See the [0.1.1 release notes](docs/release-0.1.1.md).

Supports Windows, Linux and macOS, with exact DSH baselines **0.1.5-rc.2** and
**0.2.0-rc.2**. Alpha compatibility is outside the contract.

## Installation

Install the published npm package:

```sh
dsh plugin --profile web add dsh-code-review-graph@0.1.1
npx dsh-code-review-graph@0.1.1 prepare
```

Use `headless` or another ordinary profile for the command-line entrance. Desktop
profiles belong to the application: install through that release's native plugin
manager, using `dsh-code-review-graph@0.1.1`, then click **Enable now**. Uninstall
0.1.0 through the manager before upgrading. For an unconfirmed installation,
first use **Check installation status**. See the [official DSH publishing guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md).

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
dsh plugin --profile web add ./dsh-code-review-graph-0.1.1.tgz
node dist/setup.js prepare ../code-review-graph
```

## Workflows and graph

### First use on Desktop

1. Confirm **0.1.1** in the native plugin manager and enable both the bundle and
   its `code-review-graph` component. “Running” describes the DSH component; it
   does not confirm that the Python engine has been prepared.
2. Run this once in a system terminal. The explicit official npm registry avoids
   a mirror serving an older package:

   ```sh
   npx --yes --registry=https://registry.npmjs.org dsh-code-review-graph@0.1.1 prepare
   ```

   This requires uv or real Python 3.10+ and downloads the engine/dependencies on
   first preparation. If Desktop uses a custom `DSH_HOME`, the command must use
   the same directory.
3. Select your project workspace in DSH and create a session in its local Git/SVN
   repository. Running `cd` in a terminal does not change an existing session's
   repository binding.
4. Send this as an **ordinary chat message**:

   ```text
   Use code-review-graph to analyze this repository. Call crg_workflow with {"workflow":"context"},
   then mcp__code_review_graph__get_minimal_context_tool with {"task":"Explain the entry points, core modules and call relationships","base":"HEAD"}.
   Answer from actual tool results. Report the specific error if the tools or engine are unavailable.
   ```

The first graph query builds the graph automatically. Look for actual tool-call
records; mentioning a tool in prose does not establish that it ran. A new Git
repository needs an initial commit before using examples that refer to `HEAD`.

### Mentions, slash skills and model tools

There is no `@dsh-code-review-graph` mention target and no `/crg_workflow`,
`/crg_visualize` or `/dsh-code-review-graph` command. `crg_workflow`, `crg_prompt`
and `crg_visualize` are model tools. Ask the model to invoke them using the chat
examples here.

The **seven skills use `/crg-…` names**. Search `/crg-` in the session input, or
type the full skill name at the beginning of a message followed by your task:

```text
/crg-explore-codebase Explain this repository's entry points and core modules.
```

```text
/crg-review-changes Review uncommitted changes against HEAD; identify risks and missing tests.
```

| Skill | Purpose |
| --- | --- |
| `/crg-build-graph` | Build/update the graph and analyze structure |
| `/crg-explore-codebase` | Explore modules, dependencies and calls |
| `/crg-review-changes` | Review code changes |
| `/crg-review-delta` | Review subsequent changes incrementally |
| `/crg-review-pr` | Review a PR or branch diff |
| `/crg-debug-issue` | Trace a problem through call relationships |
| `/crg-refactor-safely` | Plan, preview and apply controlled refactors |

DSH caches the skill catalog per session. Create a new session after installing,
enabling or upgrading; search for `crg-`, rather than the npm package name. If
the menu is still empty, use the ordinary chat example above to check whether
`crg_workflow` is actually available. Both supported releases provide slash
skills: official source for
[0.1.5-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/client/ui-skill/src/client/index.ts)
and [0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-skill/src/client/index.ts).

### Workflow selection and common tasks

Ask the model to call `crg_workflow` with `context`,
`review`, `refactor`, `export`, `advanced`, or `all`. Restrictions are Agent-local
and affect only this plugin's tools. Original tools use the
`mcp__code_review_graph__` prefix. `crg_prompt` loads any of the original five
workflows and reveals the corresponding tools; skills use `crg-<original-name>`.

Two more ordinary chat examples:

```text
Call crg_prompt with {"name":"review_changes","base":"main"} and follow the returned workflow to review this branch.
```

```text
Call crg_visualize with {"mode":"full","format":"html"} to generate this repository's interactive graph, then report the generated path.
```

Replace `main` with an existing target branch; use `HEAD` for uncommitted changes.
The original context/change tools default to `HEAD~1`, which does not mean only
uncommitted changes. Specify the comparison ref when it matters.

First use builds the graph; subsequent file changes are indexed incrementally.
Active Agents in the same canonical repository share workers and watchers. The
last owner releases them. A cancelled or timed-out call stops that repository's
shared worker; another concurrent call may also be interrupted. Later calls
reconnect. Failures and partial parsing warnings are retained in results.

### Open the interactive graph

After `crg_visualize` generates `.code-review-graph/graph.html`, open the right
sidebar in the **same session**. Choose **Code graph / 代码图谱** from the
**New tab → Start** page, then **Refresh / 刷新**. The tool generates a file;
open the view manually. Building the graph alone does not generate its HTML.
If the entry is missing, check that 0.1.0 has been replaced and the new Client is
enabled. The original renderer retains search, filters, zoom, dragging,
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

### Why does Desktop still show 0.1.0 after an upgrade?

Check the actual installed package before assuming stale UI metadata. The
default Desktop profile's installed manifest is:

```text
~/.dsh/profiles/desktop/node_modules/dsh-code-review-graph/package.json
```

Its `version` is the installed version. The profile's own `package.json` records
a range such as `^0.1.0`: that range permits 0.1.1 but does not prove an upgrade.
Installation logs should also name 0.1.1 explicitly.

Official npm and npmmirror can have different `latest` versions. An unversioned
package name may still resolve to 0.1.0 on a stale mirror. An `npm install` in an
ordinary directory also does not update the application-owned Desktop profile.
Remove the old version through the native manager, then install the exact spec
`dsh-code-review-graph@0.1.1`. If your source lacks that version:

1. Download `dsh-code-review-graph-0.1.1.tgz` from the
   [v0.1.1 release](https://github.com/sumingwang233/dsh-code-review-graph/releases/tag/v0.1.1).
   Leave it compressed.
2. Enter its **absolute path** in the native **Add plugin** package-address
   field, for example `D:\Downloads\dsh-code-review-graph-0.1.1.tgz`, install it
   and choose **Enable now**.
3. Confirm that the installed package's `version` is 0.1.1 and create a new
   session. Do not modify the Desktop profile through an external CLI.

If the installed file already says 0.1.1, refresh the manager's metadata by
reopening Desktop after saving your work. Use `prepare` for a missing engine;
reinstalling the JavaScript plugin does not install the Python engine.

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
