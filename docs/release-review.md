# 0.1.0 发行审阅检查点

上游平台请求已提交：[CRG #1100](https://github.com/tirth8205/code-review-graph/issues/1100)。
当前交付为本地可审阅实现与安装包，尚未创建远程适配仓库、推送贡献分支、发布 npm 或提交 PR。

## 可审阅内容

- [中文说明](../README.md) 与 [English README](../README.en.md)：安装、工作流、图谱、权限、准备依赖与卸载。
- [能力对应表](capabilities.md)：30 个工具、5 个提示、7 个技能及原生分组。
- [验证记录](validation.md)：测试范围、真实发行版会话证据与限制。
- [上游 PR 英文正文](upstream-pr.md)：平台安装器、只读编辑计划接口、生命周期与路径防护改动。
- 安装包：项目根目录 `dsh-code-review-graph-0.1.0.tgz`。
- 安装包校验：[package-checks.json](package-checks.json)。

独立插件目录：`D:\Official\Dsh_Plugin_Dev\dsh-code-review-graph`。
上游贡献目录：`D:\Official\Dsh_Plugin_Dev\code-review-graph`，分支 `feat/dsh-integration`。
引擎锁定提交：`9eba19ffaa60fda02a459a844067e5c190c9013d`，精确依赖见 [engine.json](../engine.json)。

本地已验证两版真实 DSH 的 Session/AgentRegistry/ToolRuntime 与真实 CRG 引擎；
每版保留 52 次调用记录，其中 9 次是预期的权限或边界拒绝。Python 回归集 805 项通过，
4 项因 Windows 符号链接权限跳过。图谱组件、原生 Web/headless 安装生命周期、依赖准备、
重构哈希检查与 BOM/CRLF 保留均已通过。npm 依赖审计未报告漏洞。

Linux/macOS 的 CI 尚待授权后运行。浏览器测试挂载了原生 Web/Desktop 共享 Client，
但尚未启动完整 DSH Web 服务或 Electron 桌面应用。实际模型及向量模型推理未运行。
这些是当前证据的限制；不能将组件和协议测试描述为整机或真实模型验收。

## 待集中授权的远程操作

1. 创建公开仓库 `sumingwang233/dsh-code-review-graph`，推送 `main`。
2. 创建或复用公开贡献 fork `sumingwang233/code-review-graph`，推送 `feat/dsh-integration`，
   使锁定的引擎提交可公开下载。
3. 运行插件的六个 OS/DSH 组合及上游的三个 OS CI 作业；失败时修复并重跑。
4. 确认两组 CI 全部通过及公开引擎源可安装后，发布 npm `dsh-code-review-graph@0.1.0`。
5. 向原项目 `staging` 创建正式 PR，关联 #1100、CI 链接和验证证据，并附加到本聊天。

远程确认依据是你提供的 `AGENTS.md` 及已批准执行计划的第 3、4 步。
CI 失败时暂停 npm 发布。若上游认为确定性会话证据不足，应按其评审意见补充，不能预先
声称满足其贡献证据要求。
