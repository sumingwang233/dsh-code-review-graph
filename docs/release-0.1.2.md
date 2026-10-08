# 0.1.2

交互图谱可以直接操作，无需模型或工具参数：

- 右侧代码图谱页新增“准备引擎并生成图谱”和“更新图谱”按钮，首次主动操作自动准备隔离、固定版本的引擎。
- 新增真正的 DSH 用户命令 `/crg-setup`、`/crg-graph`，不接受参数、不运行模型。
- 支持取消、重试、解析警告和 HTML 导出；仍沿用当前会话的仓库绑定和已有后端生命周期。
- 中英文 README 改为界面优先，并解释高级工具选项。

桌面版通过原生插件管理器安装 `dsh-code-review-graph@0.1.2`，启用后在项目会话打开
右侧栏 → 新标签页 → 开始 → Code graph，点击“准备引擎并生成图谱”。首次需要联网及
uv 或真实 Python 3.10+；自定义引擎仍由用户自行准备。正常启动不下载依赖。

安装脚本受 pnpm 执行审批限制，因此准备入口在安装后的首次主动操作中；本版不添加
隐藏的 npm `postinstall`。验证范围及发行包证据见 [验证记录](validation.md)。

## English

- Generate/update the interactive graph directly from its native sidebar, without a model or JSON parameters.
- Add native `/crg-setup` and `/crg-graph` user commands. Both execute directly with no arguments.
- Prepare the isolated pinned engine on the first explicit UI action; retain cancellation, retry, parse warnings, HTML export and session-bound repository ownership.
- Update both READMEs with UI-first instructions and explanations of advanced options.

Install `dsh-code-review-graph@0.1.2` through the native Desktop manager, enable it,
then open the project session's right sidebar → New tab → Start → Code graph.
Click **Set up and generate graph**. First preparation needs network access and
uv or real Python 3.10+. Custom engines remain user-managed; ordinary startup
does not download dependencies. No hidden npm `postinstall` is added because
pnpm install scripts require execution approval. See [validation](validation.md).
