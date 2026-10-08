# Validation / 验证记录

Local checkpoint: **2026-10-08**, Windows, Node **24.14.1**, Python **3.11.16**.
CRG base **2.3.9**; exact contribution engine commit is in `engine.json`.
DSH packages are the real published releases **0.1.5-rc.2** and **0.2.0-rc.2**.

Windows 本地验证已通过下列项目；Linux/macOS 的远程 CI 尚未运行。桌面版已检查
原生插件 ownership 规则及共享 Client 图谱组件，**尚未启动 Electron 应用进行整机实测**。
这些范围不同，不能把组件测试描述为桌面整机验收。未运行真实模型推理。

## Results

| Check | Local result | Scope |
| --- | --- | --- |
| TypeScript and Host/Client build | Passed | Prebuilt ESM Host, CLI, browser Client |
| Plugin safety contracts | 4 passed | Root/linked-directory fences, all 30 tools, both readers, offline iframe, full refactor recovery |
| Real engine worker lifecycle | 3 passed | Shared root worker, last owner cleanup, resumed owner, cancellation, timeout, missing engine |
| DSH 0.1.5-rc.2 session | Passed | 52 recorded deterministic tool calls, including 9 expected refusals |
| DSH 0.2.0-rc.2 session | Passed | Same native session and real engine checks |
| Browser graph on both readers | Passed | Full/file/community views, search results, filters, zoom, drag, community drill/back, HTML download; zero external requests and page errors |
| Native CLI lifecycle on both releases | Passed | Isolated web/headless profiles, add/readd/remove, bundle patch composition, retained user data, desktop profile ownership rejection |
| Explicit dependency preparation | Passed | Isolated real engine, read-only plan API probe, repeat preparation without package installation |
| Core Python regression set | 805 passed, 4 skipped | All changed platform/refactor/renderer/source-fence areas and their related regressions |
| Ruff for changed Python sources/tests | Passed | All modified Python files |
| Linux/macOS and remote matrix | Pending | Prepared six-job matrix; remote publication requires approval |
| Electron application launch | Not run | Native shared Client contribution and ownership are covered separately |
| Real model inference | Not run | Deterministic automation only, no paid inference jobs |

The four core skips are existing symlink checks requiring Windows privileges:
one graph-path case, one uninstall case, and two watcher cases. The plugin's
directory-junction escape checks **did run and pass** without those privileges.
SVG export passed with the explicitly prepared `[eval]` dependency set. Actual
embedding model inference is not included; optional dependencies/models must be
prepared explicitly.

## Session evidence

- [DSH 0.1.5-rc.2 transcript](evidence/session-0.1.5-rc.2-win32.json)
- [DSH 0.2.0-rc.2 transcript](evidence/session-0.2.0-rc.2-win32.json)

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

The Playwright harness imports the **actual native client contribution** and
mounts its graph in Chromium, using a fixture for each release's workspace asset
reader. It checks native sidebar identity/slot registration. This verifies the
shared Web/Desktop component, not an entire DSH Web server or Electron process.

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
`CRG_COMMAND` points to a prepared real engine. Before the fork is publicly
pushed, setup tests use a local `CRG_SOURCE` override; normal installation after
release uses the exact source in `engine.json`. Test profiles use temporary
`DSH_HOME` values and never modify the user's DSH profiles or credentials.

Core regression command:

```sh
python -X utf8 -m pytest tests/test_cli_install.py tests/test_dsh.py tests/test_uninstall.py tests/test_refactor_edit_plan.py tests/test_refactor.py tests/test_skills.py tests/test_main.py tests/test_prompts.py tests/test_dsh_renderer.py tests/test_visualization.py tests/test_dsh_source_fence.py tests/test_incremental.py tests/test_flows.py tests/test_tools.py tests/test_review_utf8_content.py -q
```

The adapter's `.github/workflows/ci.yml` runs both exact releases on Windows,
Linux and macOS using a real pinned engine, isolated profile lifecycle, browser
checks and dependency preparation. The core's `dsh-platform.yml` runs the Python
contract/regression set on the same three OS families. Neither workflow has run
remotely at this checkpoint. Before npm publication, push the approved source,
run both matrices, fix failures, and record their links and results here.
