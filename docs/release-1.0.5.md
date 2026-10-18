# 1.0.5

修复「工作目录不是仓库时图谱工具直接拒绝」的问题，无其他功能变化。

## 缺陷

`repository(cwd)` 只看会话工作目录**自身**有没有 `.git` / `.svn`：

```ts
for (const marker of ['.git', '.svn']) {
  if (await stat(resolve(root, marker)).then(() => true, () => false)) return root;
}
throw new Error('Select a Git or SVN repository before using the graph');
```

两种常见布局因此完全用不了：

1. 会话开在仓库的**子目录**里 —— `git rev-parse --show-toplevel` 明明能成功，插件却拒绝；
2. 工作目录是「实验室／工作台根目录」，真正的仓库在其下若干层，例如
   `E:\REA-Lab` 与 `E:\REA-Lab\ClawsGO_REA\research-desk`。

报错本身也只有一句话，既不说检查了哪个目录，也不提示哪里可能有仓库。

## 修复

- 仓库根改为三级解析：显式 `repositoryRoot`（新增配置项，绝对路径，不存在或不是仓库都会明确报错）
  → 最近的**祖先**仓库（与 git 自身语义一致）→ 工作目录下**唯一**的嵌套仓库。
- 嵌套扫描有界：最多 3 层、目录预算 2000、跳过 `node_modules` / `dist` / `target` 等依赖与产物目录，
  并且不会进入已经找到的仓库。
- 找到多个嵌套仓库时不猜：报错列出全部候选，并建议设置 `repositoryRoot` 或换会话目录。
- 解析结果按 `(cwd, repositoryRoot)` 记忆化；**失败不缓存**，所以 `git init` 之后下一次调用立刻生效。
- `list_repos_tool` / `cross_repo_search_tool` 内的 `config.authorizedRepos.map(repository)` 改为
  `.map(path => repository(path))`：新签名的第二个参数是配置项，直接传函数引用会让数组下标被当成
  `repositoryRoot`。

## 回归测试

新增 `tests/repository.test.mjs`（8 个用例）：

1. 仓库子目录解析到仓库根；
2. `.svn` 工作副本同理；
3. 实验室根解析到唯一嵌套仓库；
4. 多个嵌套仓库时列出候选而不是猜；
5. 不进入 `node_modules`，也不进入已找到的仓库内部；
6. 完全没有仓库时给出可操作报错；
7. `repositoryRoot` 覆盖（有效 / 不存在 / 不是仓库 / 相对路径）；
8. 缺失或相对的工作目录被拒。

红→绿：在 1.0.4 的构建产物上第 1、3 条失败；`npm run build` 后 8/8，`npm test` 18/18 全绿，
`npm run typecheck` 为 0。

本机实测：`E:\REA-Lab` → `E:\REA-Lab\ClawsGO_REA\research-desk`；
`E:\REA-Lab\ClawsGO_REA\research-desk` → 自身；`C:\Users\sumingwang\.dsh` 与
`E:\REA-Lab\winrea\workspace` 仍按预期报错（这两处自身与上方都没有仓库）。

## English

Fixes graph tools refusing to run when the session workspace is not itself a repository.
No other behaviour change.

`repository(cwd)` only looked for `.git` / `.svn` in the workspace directory itself, so a
session opened in a subdirectory of a repository was rejected even though
`git rev-parse --show-toplevel` succeeds, and a lab-style root such as `E:\REA-Lab`, whose
repositories sit several levels down, could not be used at all. The error also named neither
the directory it checked nor the repository it should have used.

Resolution is now three-step: an explicit `repositoryRoot` config value (absolute path, with
its own error when missing or not a repository), otherwise the nearest enclosing repository,
otherwise the single repository nested under the workspace. The nested scan is bounded to
three levels and a 2000-directory budget, skips dependency and build directories, and never
descends into a repository it already found. Several nested repositories are reported as
candidates instead of being guessed. Results are memoised per `(cwd, repositoryRoot)` and
failures are not cached, so `git init` takes effect on the next call.
`tests/repository.test.mjs` pins the eight cases above.
