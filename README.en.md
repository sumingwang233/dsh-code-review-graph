# dsh-code-review-graph

[简体中文](README.md) · [Capability map](docs/capabilities.md) · [Validation](docs/validation.md)

Native DeepSeek Harness tools and a Web/Desktop graph sidebar, powered by
[Code Review Graph](https://github.com/tirth8205/code-review-graph) **2.3.9**.
Preserves all 30 tools, five prompt workflows and seven skills. Version **0.1.2**
adds one-click engine setup and graph generation, plus native commands without model inference.
See the [0.1.2 release notes](docs/release-0.1.2.md).

Supports Windows, Linux and macOS, with exact DSH baselines **0.1.5-rc.2** and
**0.2.0-rc.2**. Alpha compatibility is outside the contract.

## Installation

Install the published npm package:

```sh
dsh plugin --profile web add dsh-code-review-graph@0.1.2
npx dsh-code-review-graph@0.1.2 prepare
```

Use `headless` or another ordinary profile for the command-line entrance. Desktop
profiles belong to the application: install through that release's native plugin
manager, using `dsh-code-review-graph@0.1.2`, then click **Enable now**. Uninstall
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
dsh plugin --profile web add ./dsh-code-review-graph-0.1.2.tgz
node dist/setup.js prepare ../code-review-graph
```

## Workflows and graph

### First use on Desktop

Generate the interactive graph directly, **without a model, chat prompt or JSON parameters**:

1. Enable the plugin and create a session in your Git/SVN project workspace.
2. Open the right sidebar → New tab → Start → **Code graph / 代码图谱**.
3. Click **Set up and generate graph**. The plugin prepares the pinned Python
   engine in DSH's isolated directory, parses the session's repository and loads
   the graph. First preparation needs network access and uv or real Python 3.10+.
4. Use **Update graph** later, browse with search/filter/zoom/drag and save with
   **Export HTML**. Operations support cancellation and retry; parse warnings appear in the result.

Two native DSH user commands also run **without parameters or model inference**:

| Command | Purpose |
| --- | --- |
| `/crg-setup` | Prepare/check the local graph engine separately |
| `/crg-graph` | Prepare the engine on first use, generate/update the graph and return its local HTML path |

The original seven `/crg-…` skills still ask the model to analyze code; these two
user commands execute directly. The session determines the repository path.
Custom engines remain user-managed. Because DSH's pnpm install scripts require
additional execution approval, Python downloads are not hidden in `postinstall`.
The first explicit UI action completes setup; ordinary startup and model tool
calls do not download dependencies. See the
[official packaging guide](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md#installing-from-github-the-build-script-catch).

### Analyze code with a model

Browsing the graph does not require a model. For explanations or code review, use a skill in the chat input:

```text
/crg-explore-codebase Explain the entry points, core modules and call relationships.
```

Select the project workspace in DSH first; terminal `cd` does not change an existing session's binding. Actual tool-call records establish execution; mentioning a tool in prose does not.

### Mentions, slash skills and model tools

There is no `@dsh-code-review-graph` mention target and no `/crg_workflow`,
`/crg_visualize` or `/dsh-code-review-graph` command. `crg_workflow`, `crg_prompt`
and `crg_visualize` are model tools. Ask the model to invoke them using the chat
examples here.

Alongside the two direct user commands, the **seven model skills use `/crg-…` names**. Search `/crg-` in the session input, or
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

These parameters are tool options: `mode: "full"` means the entire repository;
`format: "html"` means an interactive web page. The new graph button supplies
both defaults. `workflow: "context"` reveals the code-query tools; `task`
describes what to analyze; `base` is the Git branch/commit used for comparison.
Ordinary users can describe their task in plain language instead of typing JSON.

First use builds the graph; subsequent file changes are indexed incrementally.
Active Agents in the same canonical repository share workers and watchers. The
last owner releases them. A cancelled or timed-out call stops that repository's
shared worker; another concurrent call may also be interrupted. Later calls
reconnect. Failures and partial parsing warnings are retained in results.

### Open the interactive graph

Click **Set up and generate graph** in the sidebar, then **Update graph** later.
No chat message is required. **Refresh / 重新读取** only reloads existing HTML,
which is useful after a model invokes `crg_visualize`. The file is
`.code-review-graph/graph.html`; open the graph in the same session that generated it.
If the entry is missing, check the installed version and enable the plugin component.
The original renderer retains search, filters, zoom, dragging,
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
a range such as `^0.1.0`: that range permits 0.1.2 but does not prove an upgrade.
Installation logs should also name 0.1.2 explicitly.

Official npm and npmmirror can have different `latest` versions. An unversioned
package name may still resolve to 0.1.0 on a stale mirror. An `npm install` in an
ordinary directory also does not update the application-owned Desktop profile.
Remove the old version through the native manager, then install the exact spec
`dsh-code-review-graph@0.1.2`. If your source lacks that version:

1. Download `dsh-code-review-graph-0.1.2.tgz` from the
   [v0.1.2 release](https://github.com/sumingwang233/dsh-code-review-graph/releases/tag/v0.1.2).
   Leave it compressed.
2. Enter its **absolute path** in the native **Add plugin** package-address
   field, for example `D:\Downloads\dsh-code-review-graph-0.1.2.tgz`, install it
   and choose **Enable now**.
3. Confirm that the installed package's `version` is 0.1.2 and create a new
   session. Do not modify the Desktop profile through an external CLI.

If the installed file already says 0.1.2, refresh the manager's metadata by
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
