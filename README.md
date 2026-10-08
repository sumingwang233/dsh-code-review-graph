# dsh-code-review-graph

[English](README.en.md) · [能力对照](docs/capabilities.md) · [验证记录](docs/validation.md)

面向 DeepSeek Harness 的原生代码图谱插件。复用 [Code Review Graph](https://github.com/tirth8205/code-review-graph)
2.3.9 引擎，提供全部 30 个工具、5 个工作流 prompt、7 个技能，以及 Web／桌面侧栏交互图谱。
首版目标为 **0.1.0**；发布状态以 GitHub 和 npm 的实际公开版本为准。

支持 Windows、Linux、macOS；兼容基线固定为 DSH **0.1.5-rc.2、0.2.0-rc.2**。
Web 和命令行通过官方 CLI 安装，桌面版通过对应版本的原生插件管理器安装。Alpha 版本不在兼容承诺内。

## 安装

公开发布后：

```sh
dsh plugin --profile web add dsh-code-review-graph@0.1.0
npx dsh-code-review-graph@0.1.0 prepare
```

命令行入口将 `web` 替换为 `headless` 或你使用的普通 profile。
桌面版在插件管理器中安装 `dsh-code-review-graph@0.1.0`；桌面 profile 由应用持有，外部 CLI 不直接修改。
参考 [DSH 官方打包指南](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md)。

`prepare` 是主动触发的一次性依赖准备：优先复用 uv 或真实 Python 3.10+，在
`$DSH_HOME/code-review-graph/engine`（默认 `~/.dsh/code-review-graph/engine`）安装隔离引擎。
Windows Store 的 Python 占位程序不算可用运行时，可用 `--python /path/to/python` 明确指定。
正常启动和图谱调用不自动安装依赖、不下载嵌入模型、不默认使用云端服务。
没有本地嵌入依赖时，语义搜索使用引擎自带的 FTS／关键词降级。

源码开发安装：

```sh
npm ci
npm run typecheck
npm run build
npm pack
dsh plugin --profile web add ./dsh-code-review-graph-0.1.0.tgz
node dist/setup.js prepare ../code-review-graph
```

首版默认 Python 依赖固定在 [engine.json](engine.json) 记录的贡献 fork 精确提交，
因为只读编辑计划接口尚未由上游发行。上游正式发布接口后再改为官方依赖。

## 使用

会话工作目录必须是本地 Git 或 SVN 仓库。先调用 `crg_workflow` 选择：

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

首次图谱调用自动建图，之后增量监听。相同仓库的活跃 Agent 共享后端及监听进程；
最后一个 Agent 释放后清理进程。取消或超时会停止该仓库的共享后端；后续调用重新建立连接，
因此同仓库的并发调用也可能收到中断结果。失败和解析警告保留在结果中。

调用 `crg_visualize` 后打开右侧 **Code graph / 代码图谱** 页面，并点击刷新。
原渲染器的搜索、过滤、缩放、拖动、聚合、调用路径和下载保持可用。
支持 `mode`、文件／符号／变更／执行流种子、`path_from`／`path_to` 和深度；
`format` 可选 `html`、`json`、`graphml`、`cypher`、`obsidian`、`svg`。
命令行返回可打开的本地文件路径；SVG 需要引擎的 `[eval]` 可选依赖。
准备可选功能时，将 `engine.json` 中的确切源作为 `prepare` 参数，SVG 将包名改为
`code-review-graph[eval]`，本地向量则改为 `code-review-graph[embeddings]`。
模型文件需预先在本地准备；日常运行保持 Hugging Face/Transformers 离线。

图谱资产通过 DSH 已有工作区文件读取接口取得，兼容两版接口差异。
本地资源内联到限制权限的 iframe；不启动固定端口服务器、不公开数据库目录。

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
