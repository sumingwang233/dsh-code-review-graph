# 0.1.1

修复 DSH Web／桌面客户端的原生加载和图谱侧栏显示：

- Client 发行文件改用 DSH 官方 closure-factory 格式，解决 `Cannot use import statement outside a module`。
- 侧栏正文按插件 provider ID 注册，解决打开图谱后显示“这类内容还没有可用的查看方式”。
- 浏览器回归直接执行发行文件；补充真实 Windows Desktop 0.2.0-rc.2 的隔离安装、启用、图谱读取、搜索、HTML 导出和卸载／重装验证。

桌面安装 `dsh-code-review-graph@0.1.1`，完成后点击“立即启用”。已有旧版先通过
原生插件管理器卸载；安装状态尚未确认时先核对状态。

用户报告的 pnpm 十分钟无输出超时未能复现。相同旧包及原有依赖组合均可正常安装；
本次修复不代表该安装器超时已解决。其他桌面平台／版本未整机实测，详细范围见
[验证记录](validation.md)。没有运行模型推理，也未修改用户的 DSH 配置。

## English

- Emit the Client in DSH's native closure-factory format, fixing `Cannot use import statement outside a module` in the actual loader.
- Register the sidebar body under the plugin provider ID, fixing the unavailable-view fallback when opening a graph.
- Execute the published Client in browser regressions; add isolated installation, enablement, native graph reading/search/HTML export, removal and reinstallation checks using the actual Windows Desktop 0.2.0-rc.2 application.

Install `dsh-code-review-graph@0.1.1` in the native Desktop plugin manager, then
choose **Enable now**. Remove an existing old version through that manager first;
reconcile an unconfirmed installation before proceeding.

The reported ten-minute pnpm no-output timeout did not reproduce with the same
old package and dependency combination. This release does not claim to resolve
that installer timeout. Other Desktop platforms/releases have not been tested as
complete applications. See [validation](validation.md) for scope. No model
inference or changes to the user's DSH configuration were involved.
