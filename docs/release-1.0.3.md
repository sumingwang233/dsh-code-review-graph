# 1.0.3

版本号更新发布：npm 包版本由 0.1.2 更新为 1.0.3，功能与已验证的 0.1.2 一致，
无行为变更。

- 保留全部 30 个工具、5 个工作流 prompt、7 个技能。
- 保留一键准备引擎、生成/更新交互图谱，以及 `/crg-setup`、`/crg-graph` 两个
  不接受参数、不运行模型的原生命令。
- 引擎来源不变，仍为 [engine.json](engine.json) 记录的贡献提交；修改类操作继续
  先取完整只读编辑计划，再经 DSH 文件意图与会话策略提交。
- 发行包字节、SHA-256 与发布来源记录在 `docs/package-checks-1.0.3.json`
  （仓库文件，不随 npm 包分发）。

安装 `dsh-code-review-graph@1.0.3`，启用后在项目会话打开右侧栏 → 新标签页 →
开始 → Code graph，点击“准备引擎并生成图谱”。首次准备需要联网及 uv 或真实
Python 3.10+；正常启动不下载依赖。验证范围及证据限制见
[验证记录](validation.md)。

## English

Release-number update: the npm package version moves from 0.1.2 to 1.0.3 with no
behaviour change from the verified 0.1.2 bundle.

- Retains all 30 tools, five prompt workflows and seven skills.
- Retains one-click engine setup, graph generation/update, and the native
  `/crg-setup` and `/crg-graph` commands, which take no arguments and run no model.
- The engine source is unchanged: the contribution commit recorded in
  [engine.json](engine.json); file-modifying operations still fetch the complete
  read-only edit plan first and commit it through DSH file intents and session policy.
- Package bytes, SHA-256 and release provenance are recorded in
  `docs/package-checks-1.0.3.json` (repository file, not shipped in the npm package).

After installing `dsh-code-review-graph@1.0.3`, open the project session's right
sidebar → New tab → Start → Code graph and click **Set up and generate graph**.
First preparation needs network access and uv or real Python 3.10+; ordinary
startup does not download dependencies. See [validation](validation.md) for the
verified scope and its limits.
