# Validation / 验证记录

## 1.0.4 发行验证

1.0.4 修复 1.0.3 的工具 schema 缺陷：`capabilities.json` 未声明 `required` 的工具在
注册时产生自有键 `required: undefined`，reject 后被 DSH 会话日志的无损 JSON 校验
拒绝，导致 `crg_workflow` / `crg_prompt` 揭示工具的那一轮以
`request/header` 序列化失败结束。本次在 Windows（Node 24）执行：

- 类型检查与 Host/Client 构建通过（prepack）。
- `npm test` 10 项全通过（新增 `tests/schema.test.mjs` 4 项 + 1 项与真实
  `@deepseek-ai/dsh-util-values` `snapshotJsonValue` 的交叉验证）。
- 红→绿对照：在 1.0.3 的构建产物上第 4 项失败，`context` workflow 揭示的
  `build_or_update_graph_tool`、`get_minimal_context_tool`、`list_graph_stats_tool`
  报 `$.required`；`npm run build` 后全部通过。
- 真实校验器直接验证：`{ required: undefined }` 被拒，删除该键或 `required: []` 均通过。
- 真实 DSH 会话集成、Web/headless 安装生命周期、浏览器组件与 Desktop 整机测试
  本次未重跑；除该 schema 修复外构建产物与 1.0.3 相同。
  发行包字节与 SHA-256 见 `docs/package-checks-1.0.4.json`。

1.0.4 fixes the 1.0.3 tool-schema defect: a tool whose `capabilities.json` entry omits
`required` registered an own `required: undefined` key, which DSH's lossless-JSON
session log rejects, failing the `crg_workflow` / `crg_prompt` turn at the
`request/header` append. On Windows (Node 24) this release ran typecheck + build,
`npm test` (10/10, including the new `tests/schema.test.mjs` and a cross-check
against the real `snapshotJsonValue`), and recorded the red→green comparison — on
the 1.0.3 bundle the third case fails on the three `context`-revealed tools with
path `$.required`. Real DSH session integration, install lifecycle, browser and
Desktop runs were not repeated; apart from this schema fix the build output matches
1.0.3. Package bytes and SHA-256 are recorded in `docs/package-checks-1.0.4.json`.

## 1.0.3 发行验证

1.0.3 是版本号更新发布：包版本由 0.1.2 更新为 1.0.3，代码与已验证的 0.1.2
一致，无行为变更。本次在 Windows（Node 24、Python 3.11）重新执行：

- TypeScript 类型检查与 Host/Client 构建通过（prepack）。
- 单元测试 5 项、setup 2 项通过；backend 3 项在真实 `prepare` 的隔离引擎上通过。
- 真实 DSH 0.1.5-rc.2、0.2.0-rc.2 会话集成各 1 项通过（真实 Session/AgentRegistry/ToolRuntime
  与真实 CRG 引擎，无模型推理）；隔离测试引擎额外安装 matplotlib，以满足 SVG 导出路径。
- 发行 tarball 的真实 Web/headless 安装生命周期与 Desktop 所有权拒绝通过。
- 浏览器组件与真实 Desktop 整机测试本次未重跑；其客户端代码与 0.1.2 相同，
  沿用 0.1.2 的记录。发行包字节与 SHA-256 见 `docs/package-checks-1.0.3.json`。

1.0.3 is a release-number update: the package moves from 0.1.2 to 1.0.3 with
identical code and no behaviour change. On Windows (Node 24, Python 3.11) this
release re-ran the TypeScript build, 5 unit tests, 2 setup tests, 3 backend
tests against a real prepared engine, both real DSH session integrations, and
the real Web/headless install lifecycle. Browser-component and Electron Desktop
runs were not repeated; their client code is unchanged from 0.1.2, whose records
remain applicable. Package bytes and SHA-256 are recorded in
`docs/package-checks-1.0.3.json`.

## 0.1.2 发行验证

0.1.2 的验证记录作为 [v0.1.2 发行页](https://github.com/sumingwang233/dsh-code-review-graph/releases/tag/v0.1.2)
附件保存，包含发行包 SHA-256、GitHub CI 结果和真实 Windows Desktop 证据。

- 两版真实 DSH 会话增加原生 `CommandRuntime.execute('/crg-graph')`，调用真实引擎，拒绝额外目录参数。
- 浏览器测试执行发行 Client，覆盖首次生成按钮、失败、取消、重试及原有图谱交互。
- 真实 Windows Desktop 0.2.0-rc.2 从空隔离引擎目录开始，通过图谱页按钮准备固定版本引擎，
  生成图谱，再经真实工作区文件接口读取、搜索和导出。测试不再提前用 CLI 生成图谱。
- Windows/Linux/macOS × DSH 0.1.5-rc.2、0.2.0-rc.2 的六项 CI 覆盖会话、浏览器、CLI 生命周期及依赖准备。
- 无真实模型推理；其他 Desktop 平台及版本未整机实测。原安装器超时仍未复现。

Release 0.1.2 evidence is attached to its release page, including the exact tarball hash,
six-job compatibility CI and the actual Windows Desktop run. Native commands run
the real engine without a model. Desktop setup/generation is driven by the native
button from an empty isolated engine directory. Browser command services remain
fixtures; they test the published Client, including failure/cancellation/retry.

## 0.1.1 验证快照 / Previous release snapshot

Local checkpoint: **2026-10-08**, Windows, Node **24.14.1**, Python **3.11.16**.
CRG base **2.3.9**; exact contribution engine commit is in `engine.json`.
DSH packages are the real published releases **0.1.5-rc.2** and **0.2.0-rc.2**.

0.1.1 修复了真实原生加载器才会暴露的两个问题：Client 发行文件必须使用
`window.__ModuleLoader__.load({ id, factory })`，侧栏正文必须按 provider ID 注册。
0.1.0 的浏览器测试重新打包了源文件，并错误地接受了按 kind 注册正文，未发现这两个问题。
回归测试现在直接执行发行 Client 文件，并检查 provider ID。

Windows 本地增加实际安装的 DSH Desktop **0.2.0-rc.2** 验证；三平台、两版 DSH
的 CI 覆盖原生运行时、CLI 和浏览器组件。Desktop 0.1.5-rc.2、Linux/macOS
桌面应用尚未整机实测。未运行真实模型推理。

## Results

| Check | Local result | Scope |
| --- | --- | --- |
| TypeScript and Host/Client build | Passed | ESM Host/CLI; native closure-factory browser Client |
| Plugin safety and native Client contracts | 5 passed | Root/linked-directory fences, all 30 tools, both readers, offline iframe, full refactor recovery; actual published Client executes as a classic script |
| Real engine worker lifecycle | 3 passed | Shared root worker, last owner cleanup, resumed owner, cancellation, timeout, missing engine |
| DSH 0.1.5-rc.2 session | Passed | 52 recorded deterministic tool calls, including 9 expected refusals |
| DSH 0.2.0-rc.2 session | Passed | Same native session and real engine checks |
| Browser graph on both readers | Passed | Full/file/community views, search results, filters, zoom, drag, community drill/back, HTML download; zero external requests and page errors |
| Native CLI lifecycle on both releases | Passed | Isolated web/headless profiles, add/readd/remove, bundle patch composition, retained user data, desktop profile ownership rejection |
| Explicit dependency preparation | Passed | Isolated real engine, read-only plan API probe, repeat preparation without package installation |
| Core Python regression set | 805 passed, 4 skipped | All changed platform/refactor/renderer/source-fence areas and their related regressions |
| Ruff for changed Python sources/tests | Passed | All modified Python files |
| Windows/Linux/macOS × both DSH releases | 6 CI jobs passed | Real pinned engine, isolated native installation, session calls, browser graph and explicit setup |
| Core Windows/Linux/macOS regression matrix | 3 CI jobs passed | 808 passed, 1 platform-specific skip on each OS |
| Windows Desktop 0.2.0-rc.2 | Passed | Actual packaged Electron application, native install/enable/remove/reinstall, graph reading/search/HTML download, unrelated configuration retained; no model |
| Other Desktop releases/platforms | Not run | Browser/CLI checks do not establish complete Electron coverage |
| Real model inference | Not run | Deterministic automation only, no paid inference jobs |

The four local core skips comprise three existing symlink checks requiring
Windows privileges (one uninstall case and two watcher cases) and a POSIX
executable-bit check. The plugin's directory-junction escape checks **did run
and pass** without those privileges. CI runners have symlink privileges: their
one skip is the POSIX executable-bit check on Windows, or the native Windows
path-semantics check on Linux/macOS.
SVG export passed with the explicitly prepared `[eval]` dependency set. Actual
embedding model inference is not included; optional dependencies/models must be
prepared explicitly.

## Session evidence

- [DSH 0.1.5-rc.2 transcript](https://github.com/sumingwang233/dsh-code-review-graph/blob/main/docs/evidence/session-0.1.5-rc.2-win32.json)
- [DSH 0.2.0-rc.2 transcript](https://github.com/sumingwang233/dsh-code-review-graph/blob/main/docs/evidence/session-0.2.0-rc.2-win32.json)

The test uses actual released Cordis, Session, AgentRegistry, ToolRuntime,
filesystem and session-policy packages; its Agents are created deterministically
without a model loop. Tools invoke the real Python CRG backend. It checks:

- Agent-local tool selection and independent repositories; first graph build;
  real watcher indexing after source changes; surviving owners after one exits.
- All five original prompts; context, review, impact, affected flows,
  architecture, cross-repository search and postprocessing results.
- Unauthorized repository/provider/root/path inputs and linked documentation;
  stale rename plans;
  native session read-only policy rejection; exact real BOM/CRLF preservation.
- HTML and JSON/GraphML/Cypher/Obsidian/SVG generation and a shortest-path view;
  all seven native skills are registered and their tool references are adapted.

Only test-directory paths are replaced by `<TEST_TMP>` for public evidence.
Where ToolRuntime returns both a structured value and identical rendered text,
the transcript retains the structured value and omits duplicate rendering;
error content is kept. Upstream reviewers decide whether deterministic evidence
satisfies their contribution requirement.

The Playwright browser harness executes **`dist/client.js` as published**, through
the native classic-script factory contract, and mounts its graph in Chromium.
Only the host services and each release's workspace reader are fixtures. It
checks provider ID/slot registration. This remains a component test, separate
from the real Desktop test.

## Desktop regression and reported timeout

- [Clean Desktop profile evidence](evidence/desktop-0.2.0-rc.2-win32-clean.json)
- [Existing dependency combination evidence](evidence/desktop-0.2.0-rc.2-win32-dependency-combination.json)

`tests/desktop.mjs` launches the actual installed Electron executable with a
temporary DSH_HOME, userData, HOME/USERPROFILE and APPDATA. It uses the native
plugin manager to install the packed tarball, enable it, uninstall it, reinstall
it and uninstall it again. It checks that existing dependencies, bundles and an
unrelated user setting survive. The real engine CLI builds a small Python graph;
the Desktop sidebar reads it through the actual workspace-file service, searches
it and exports the HTML through Electron's download pipeline. Session creation
is deterministic, without model inference. This complements the real DSH tool
session transcripts; it does not claim that the model drove the Desktop UI.

The official Desktop Host hardcodes port 19387. A test-only preload changes that
test process's listener to an OS-assigned port so the user's running Desktop is
untouched. Test windows stay hidden; the native welcome flow uses “Set up later”
without signing in, copying credentials or configuring a model key. No test
settings are written to the user's profile.

The reported pnpm log said `Done in 4.1s`, followed by the Host's 600000 ms
no-output timeout. The same 0.1.0 package completed successfully with bundled
Electron/pnpm, a clean native Desktop profile, and a native Desktop profile
containing the three existing plugins and package-manager policy files. The
latter reproduced the same `+98 -27` dependency change. The original hang has
**not been reproduced**. 0.1.1 fixes the two independently confirmed Client
defects and the missing regression coverage; it does not claim to fix that
unresolved package-manager timeout.

## Reproduction

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run prepare:tests
npm run test:backend
npm run test:integration
npx playwright install chromium
npm run test:browser
npm pack
npm run test:install
npm run test:setup
```

Provide `DSH_VERSION` and `CRG_COMMAND` in the **test child process environment**.
`CRG_COMMAND` points to a prepared real engine. Setup tests and normal
installation use the publicly available exact source in `engine.json`.
Test profiles use temporary
`DSH_HOME` values and never modify the user's DSH profiles or credentials.

For the separate real Desktop check, first run `npm pack`, set
`DSH_DESKTOP_EXECUTABLE` to a supported installed Desktop application and
`CRG_COMMAND` to a prepared real engine, then run `npm run test:desktop`.
`DSH_VERSION` must match the actual application version (default 0.2.0-rc.2).
Missing application/engine inputs fail explicitly. To reproduce a dependency
combination, additionally set `DSH_DESKTOP_PROFILE_FIXTURE` to a profile directory
and `DSH_DESKTOP_PNPM` to the application's bundled pnpm entry. Only
`package.json`, `pnpm-lock.yaml` and `pnpm-workspace.yaml` are copied to the
temporary profile. Evidence is written to `test-results/desktop-*.json` with the
tested package SHA-256 and native operation results.

Core regression command:

```sh
python -X utf8 -m pytest tests/test_cli_install.py tests/test_dsh.py tests/test_uninstall.py tests/test_refactor_edit_plan.py tests/test_refactor.py tests/test_skills.py tests/test_main.py tests/test_prompts.py tests/test_dsh_renderer.py tests/test_visualization.py tests/test_dsh_source_fence.py tests/test_incremental.py tests/test_flows.py tests/test_tools.py tests/test_review_utf8_content.py -q
```

The adapter's `.github/workflows/ci.yml` runs both exact releases on Windows,
Linux and macOS using a real pinned engine, isolated profile lifecycle, browser
checks and dependency preparation. The core's `dsh-platform.yml` runs the Python
contract/regression set on the same three OS families.

- [Historical 0.1.0 adapter CI: six combinations passed](https://github.com/sumingwang233/dsh-code-review-graph/actions/runs/37716247823), source `9c478191b743ecc443cc0eede5d67927a367d7ed`; the old browser harness missed the Client packaging/slot defects described above.
- [Core CI: all three OS jobs passed](https://github.com/sumingwang233/code-review-graph/actions/runs/37717599685), source `8ac789138463cd3b8282688bb94d682e90ca1df3`.

Each adapter CI artifact contains its native session transcript, browser report,
profile lifecycle report and tested package. Windows records 52 calls per
release; Linux/macOS record 53. Each transcript contains nine expected refusals.
Browser reports have zero external requests and page errors. The pinned engine
commit `9eba19ffaa60fda02a459a844067e5c190c9013d` has identical Python production
code and dependency metadata to the tested core head; later commits only adjust
CI and resolve the existing Bash regression test's executable path on Windows.
