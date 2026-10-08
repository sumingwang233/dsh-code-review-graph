# dsh-code-review-graph

[English](README.en.md) · [能力对照](docs/capabilities.md) · [验证记录](docs/validation.md)

面向 DeepSeek Harness 的原生代码图谱插件。复用 [Code Review Graph](https://github.com/tirth8205/code-review-graph)
2.3.9 引擎，提供全部 30 个工具、5 个工作流 prompt、7 个技能，以及 Web／桌面侧栏交互图谱。
当前版本为 **0.1.2**，支持一键准备引擎、生成交互图谱，以及无需模型的原生命令。
详见 [0.1.2 更新说明](docs/release-0.1.2.md)。

支持 Windows、Linux、macOS；兼容基线固定为 DSH **0.1.5-rc.2、0.2.0-rc.2**。
Web 和命令行通过官方 CLI 安装，桌面版通过对应版本的原生插件管理器安装。Alpha 版本不在兼容承诺内。

## 安装

安装已发布的 npm 包：

```sh
dsh plugin --profile web add dsh-code-review-graph@0.1.2
npx dsh-code-review-graph@0.1.2 prepare
```

命令行入口将 `web` 替换为 `headless` 或你使用的普通 profile。
桌面版在插件管理器中安装 `dsh-code-review-graph@0.1.2`，安装完成后点击“立即启用”。
已有 0.1.0 的用户先通过该管理器卸载旧版，再安装新版；尚未确认的安装先点击“核对安装状态”。
桌面 profile 由应用持有，外部 CLI 不直接修改。
参考 [DSH 官方打包指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md)。

`prepare` 是主动触发的一次性依赖准备：优先复用 uv 或真实 Python 3.10+，在
`$DSH_HOME/code-review-graph/engine`（默认 `~/.dsh/code-review-graph/engine`）安装隔离引擎。
Windows Store 的 Python 占位程序不算可用运行时，可用 `--python /path/to/python` 明确指定。
正常启动和模型工具调用不自动安装依赖、不下载嵌入模型、不默认使用云端服务。
没有本地嵌入依赖时，语义搜索使用引擎自带的 FTS／关键词降级。

源码开发安装：

```sh
npm ci
npm run typecheck
npm run build
npm pack
dsh plugin --profile web add ./dsh-code-review-graph-0.1.2.tgz
node dist/setup.js prepare ../code-review-graph
```

首版默认 Python 依赖固定在 [engine.json](engine.json) 记录的贡献 fork 精确提交，
因为只读编辑计划接口尚未由上游发行。上游正式发布接口后再改为官方依赖。

## 使用

### 桌面端第一次使用

交互图谱可以通过界面直接生成，**无需模型、聊天提示词或 JSON 参数**：

1. 启用插件，在你的 Git／SVN 项目工作区新建会话。
2. 打开右侧栏 → 新标签页 → 开始 → **Code graph / 代码图谱**。
3. 点击 **准备引擎并生成图谱**。插件在 DSH 的隔离目录一次性准备固定版本的
   Python 引擎，再解析当前会话的仓库并显示交互图谱。首次需要联网，以及 uv 或真实 Python 3.10+。
4. 后续点击 **更新图谱**；用搜索、过滤、缩放、拖动浏览，用 **导出 HTML** 保存可独立打开的图谱。
   操作期间可取消，失败后可重试；解析警告会显示在结果中。

也提供两个真正的 DSH 用户命令，均**不需要参数、不调用模型**：

| 命令 | 用途 |
| --- | --- |
| `/crg-setup` | 单独准备／检查本地图谱引擎 |
| `/crg-graph` | 首次准备引擎并生成图谱，之后更新图谱；返回本地 HTML 路径 |

七个原有 `/crg-…` 技能仍用于让模型分析代码。它们与上面两个直接执行的用户命令不同。
当前会话决定仓库路径，用户无需传入目录。自定义引擎配置由用户自行准备，按钮不会替换它。
DSH 的 pnpm 安装脚本需要额外执行审批，因此不把 Python 下载隐藏在 npm `postinstall` 中；
安装后的首次界面操作即可完成准备，日常启动和模型工具调用不自动下载依赖。
详见 [DSH 官方打包指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md#installing-from-github-the-build-script-catch)。

### 使用模型分析代码

图谱浏览不需要模型；需要模型解释结构或审查代码时，在聊天输入框直接使用技能，例如：

```text
/crg-explore-codebase 介绍当前仓库的入口、核心模块和调用关系。
```

先在 DSH 选择项目工作区；终端中 `cd` 不会改变已有会话绑定的仓库。
聊天里应出现实际工具调用记录；模型只提到工具名，不表示已经执行。

### `@`、`/` 和工具名的区别

本插件没有注册 `@dsh-code-review-graph` 引用目标，也没有 `/crg_workflow`、`/crg_visualize`
或 `/dsh-code-review-graph` 命令。`crg_workflow`、`crg_prompt`、`crg_visualize` 是供模型调用的工具，
可以通过上面的自然语言提示词明确要求模型使用。

除上面两个直接执行的命令外，还提供**七个 `crg-` 前缀的技能**。在会话输入框键入 `/crg-` 搜索，也可在消息开头
直接写完整技能名，再接任务描述，例如：

```text
/crg-explore-codebase 介绍当前仓库的入口和核心模块。
```

```text
/crg-review-changes 请审查当前未提交改动，以 HEAD 为基准，指出风险和缺失测试。
```

| 技能 | 用途 |
| --- | --- |
| `/crg-build-graph` | 建立／更新图谱并分析结构 |
| `/crg-explore-codebase` | 探索模块、依赖和调用关系 |
| `/crg-review-changes` | 审查代码变化 |
| `/crg-review-delta` | 对后续修改做增量复查 |
| `/crg-review-pr` | 审查 PR 或分支差异 |
| `/crg-debug-issue` | 沿调用关系定位问题 |
| `/crg-refactor-safely` | 规划、预览和受控重构 |

技能目录由 DSH 按会话缓存；安装、启用或升级后，先新建会话再搜索。菜单中应搜索 `crg-`，
不是 npm 包名。若仍无候选，先用上面的普通提示词确认 `crg_workflow` 是否实际可用。
DSH 的两版基线均提供技能斜杠入口，见官方源码
[0.1.5-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/packages/client/ui-skill/src/client/index.ts)、
[0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/client/ui-skill/src/client/index.ts)。

### 工作流和常用任务

需要明确选择工具范围时，在聊天中要求模型调用 `crg_workflow`，指定下面的 `workflow` 参数：

| 工作流 | 用途 |
| --- | --- |
| `context` | 精准上下文、搜索和建图 |
| `review` | 变化、影响范围、调用链及审查 |
| `refactor` | 安全重构、死代码、大函数 |
| `export` | Wiki 和导出 |
| `advanced` | 社区、架构、跨仓库、遍历和嵌入 |
| `all` | 展开全部 30 个工具 |

限制只作用于当前 Agent 的本插件工具，其他插件不受影响。
原工具名使用 `mcp__code_review_graph__` 前缀。`crg_prompt` 加载原有五个工作流并展开对应工具；
七个技能注册为 `crg-<原技能名>`。

另外两个可直接复制的普通聊天提示词：

```text
请调用 crg_prompt，参数为 {"name":"review_changes","base":"main"}，按返回的工作流审查当前分支的改动。
```

```text
请调用 crg_visualize，参数为 {"mode":"full","format":"html"}，生成当前仓库的交互代码图谱，并告诉我生成文件的路径。
```

`main` 要换成仓库实际存在的目标分支；审查当前未提交改动可用 `HEAD`。
原有上下文／变化工具的默认基准是 `HEAD~1`，并不等同于只看未提交改动，因此需要时应明确指定。

示例里的参数是给工具的选项，不是需要记忆的口令：`mode: "full"` 表示显示整个仓库，
`format: "html"` 表示生成可交互网页；新图谱按钮已选好这两个默认值。
`workflow: "context"` 是让模型先使用代码查询这一组工具，`task` 是你想让它分析的任务，
`base` 是审查时用来对比的 Git 分支或提交。日常使用只需描述任务；这些参数供精确控制时参考。

首次图谱调用自动建图，之后增量监听。相同仓库的活跃 Agent 共享后端及监听进程；
最后一个 Agent 释放后清理进程。取消或超时会停止该仓库的共享后端；后续调用重新建立连接，
因此同仓库的并发调用也可能收到中断结果。失败和解析警告保留在结果中。

### 打开交互图谱

在图谱页点击 **准备引擎并生成图谱**，之后点击 **更新图谱**，无需先发聊天消息。
**重新读取**只读取已有 HTML，适合模型调用 `crg_visualize` 生成文件后刷新页面。
图谱位于当前仓库的 `.code-review-graph/graph.html`；在生成它的同一会话中打开图谱页。
右侧入口缺失时，检查实际版本是否已升级，以及插件组件是否已启用。
原渲染器的搜索、过滤、缩放、拖动、聚合、调用路径和下载保持可用。
支持 `mode`、文件／符号／变更／执行流种子、`path_from`／`path_to` 和深度；
`format` 可选 `html`、`json`、`graphml`、`cypher`、`obsidian`、`svg`。
命令行返回可打开的本地文件路径；SVG 需要引擎的 `[eval]` 可选依赖。
准备可选功能时，将 `engine.json` 中的确切源作为 `prepare` 参数，SVG 将包名改为
`code-review-graph[eval]`，本地向量则改为 `code-review-graph[embeddings]`。
模型文件需预先在本地准备；日常运行保持 Hugging Face/Transformers 离线。

图谱资产通过 DSH 已有工作区文件读取接口取得，兼容两版接口差异。
本地资源内联到限制权限的 iframe；不启动固定端口服务器、不公开数据库目录。

### 安装了新版，管理器为什么仍显示 0.1.0？

先区分实际安装版本和界面缓存。默认桌面 profile 的实际包信息位于：

```text
~/.dsh/profiles/desktop/node_modules/dsh-code-review-graph/package.json
```

查看其中的 `version`；profile 自己的 `package.json` 只记录版本范围，例如 `^0.1.0`，
该范围允许 0.1.2，但不能证明实际已经升级。安装日志也应明确记录 0.1.2。

官方 npm 的 `latest` 和 npmmirror 的 `latest` 可能不同。镜像未同步时，输入不带版本号的包名
可能仍装到 0.1.0；在普通目录执行 `npm install` 也不会更新应用持有的桌面 profile。
使用桌面原生管理器卸载旧版，再安装明确的 `dsh-code-review-graph@0.1.2`。
若源里还没有这个版本，可按以下方式安装已验证的本地包：

1. 从 [v0.1.2 发行页](https://github.com/sumingwang233/dsh-code-review-graph/releases/tag/v0.1.2)
   下载 `dsh-code-review-graph-0.1.2.tgz`，无需解压。
2. 在桌面管理器的“添加插件”包地址输入文件的**绝对路径**，例如
   `D:\Downloads\dsh-code-review-graph-0.1.2.tgz`，完成安装并点击“立即启用”。
3. 核对实际包的 `version` 为 0.1.2，再新建会话。不要用外部 CLI 修改 `desktop` profile。

如果实际包已经是 0.1.2，才考虑管理器元数据尚未刷新；保存当前工作后重新打开应用再核对。
引擎未准备的错误用前面的 `prepare` 解决，重新安装 JavaScript 插件不会自动安装 Python 引擎。

## 权限和重构

模型不能指定 `repo_root`，执行器使用会话的规范化仓库路径，拒绝目录越界和逃逸符号链接。
`authorizedRepos` 默认为空；跨仓库查询只读取当前仓库及用户在 Host 配置中明确加入的仓库。
其他仓库需要先在自己的会话中建图。

`apply_refactor_tool` 的非预览操作先取得完整只读编辑计划，再通过 DSH 文件意图、会话策略和
`ctx.fs` 提交。写入前校验原始字节 SHA-256，拒绝过期计划。逐文件原子写入，保留 UTF-8、BOM 和换行；
中途失败会返回 `partial_failure`、已提交文件和完整 `recovery_patch`，不继续写入。
恢复前仍需检查补丁中的哈希，避免覆盖用户后续修改。

云端嵌入必须由用户在插件配置中显式加入 `embeddingProviders`，并通过 `embeddingEnv`
指定允许传给引擎的环境变量名称；默认只允许 `local`。不要将密钥写入配置文件。

## 验证和卸载

```sh
npm run prepare:tests
npm test
npm run test:integration
```

集成测试需用子进程环境 `CRG_COMMAND` 指向真实引擎；`DSH_VERSION` 选择两版之一。
记录真实发行版 DSH 会话的确定性工具调用，**未运行真实模型**。完整证据和测试边界见验证记录。
上游是否接受该证据由评审判断。

```sh
dsh plugin --profile web remove dsh-code-review-graph
```

卸载由 DSH 官方机制仅移除本插件依赖及 bundle，保留用户设置、其他插件、隔离引擎和仓库图谱。
桌面版使用原生管理器卸载。

MIT 许可，保留 Tirth Kanani 的上游版权。平台请求：[CRG #1100](https://github.com/tirth8205/code-review-graph/issues/1100)。
