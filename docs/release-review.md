# 0.1.0 发行审阅检查点

上游平台请求已提交：[CRG #1100](https://github.com/tirth8205/code-review-graph/issues/1100)。
已创建并推送[公开适配仓库](https://github.com/sumingwang233/dsh-code-review-graph)及
[公开引擎贡献分支](https://github.com/sumingwang233/code-review-graph/tree/feat/dsh-integration)。
插件六个 OS/DSH 组合及引擎三个 OS CI 作业均已通过。
[npm 0.1.0](https://www.npmjs.com/package/dsh-code-review-graph/v/0.1.0) 已公开发布；
下载的发行包与本地最终安装包的 SHA-256/SHA-512 均一致。
[上游正式 PR #1101](https://github.com/tirth8205/code-review-graph/pull/1101) 已提交至
`staging`，已关联当前聊天，等待维护者评审。

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
4 项因 Windows 符号链接权限或 POSIX 执行位检查跳过。图谱组件、原生 Web/headless 安装生命周期、依赖准备、
重构哈希检查与 BOM/CRLF 保留均已通过。npm 依赖审计未报告漏洞。

[插件 CI](https://github.com/sumingwang233/dsh-code-review-graph/actions/runs/37716247823)六项通过；
[引擎 CI](https://github.com/sumingwang233/code-review-graph/actions/runs/37717599685)三个系统各有
808 项通过、1 项按平台跳过。浏览器测试挂载了原生 Web/Desktop 共享 Client，
但尚未启动完整 DSH Web 服务或 Electron 桌面应用。实际模型及向量模型推理未运行。
这些是当前证据的限制；不能将组件和协议测试描述为整机或真实模型验收。

完整源码、安装包校验与真实发行版会话证据均可审阅。是否满足平台贡献的证据要求由
上游维护者评审决定。
