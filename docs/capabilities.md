# Capability map / 能力对应表

Baseline: CRG **2.3.9**, with the contribution fork's additional read-only edit
plan API. `capabilities.json` is captured from the real engine, rather than
maintained as a second handwritten schema.

功能基线为 CRG **2.3.9**。工具参数来自真实引擎；DSH 仅移除模型可指定的
`repo_root`，通过当前会话绑定仓库，并在执行器检查权限与路径。

All original tools are native DSH ToolDefinitions named
`mcp__code_review_graph__<original_name>`. The prefix preserves upstream workflow
references; it does not require configuring an external DSH MCP server.

`crg_workflow` offers `context`, `review`, `refactor`, `export`, `advanced`, and
`all`. The five task groups each include the six context tools. `all` exposes all
30 tools. Restrictions are scoped to one Agent and only this plugin's tools.
`crg_workflow`, `crg_prompt`, and `crg_visualize` remain available initially.

按需展开仅影响调用 Agent；其他 Agent 和其他插件不受影响。所有工作流均可使用
六个上下文基础工具，`all` 展开完整的 30 个工具。

| Original tool / 原工具 | Task group / 分组 | Behavior / 功能 |
| --- | --- | --- |
| `build_or_update_graph_tool` | context | Build and incremental update / 建图与增量更新 |
| `get_minimal_context_tool` | context | Task-focused code context / 精准任务上下文 |
| `query_graph_tool` | context | Node and relationship queries / 节点与关系查询 |
| `semantic_search_nodes_tool` | context | Semantic search with offline keyword fallback / 语义搜索及离线关键词回退 |
| `list_graph_stats_tool` | context | Graph statistics / 图谱统计 |
| `get_docs_section_tool` | context | Engine documentation / 引擎文档 |
| `detect_changes_tool` | review, refactor, advanced | Git change detection / 变更检测 |
| `get_review_context_tool` | review | Review context and source snippets / 审查上下文与源码片段 |
| `get_impact_radius_tool` | review, refactor | Change impact and call sites / 影响范围与调用位置 |
| `get_affected_flows_tool` | review, refactor | Affected execution flows / 受影响执行路径 |
| `list_flows_tool` | review, advanced | Flow inventory / 执行路径列表 |
| `get_flow_tool` | review, advanced | Flow details and bounded source / 执行路径详情 |
| `refactor_tool` | refactor | Rename preview, dead code, suggestions / 重命名预览、死代码与建议 |
| `apply_refactor_tool` | refactor | Preview or DSH-controlled file writes / 预览或受控文件修改 |
| `find_large_functions_tool` | refactor, advanced | Oversized function analysis / 大函数分析 |
| `generate_wiki_tool` | export | Repository wiki / 仓库知识库生成 |
| `get_wiki_page_tool` | export | Wiki page retrieval / 知识库页面查询 |
| `run_postprocess_tool` | advanced | Community, flow and embedding postprocessing / 社区、执行路径及嵌入后处理 |
| `embed_graph_tool` | advanced | Explicit authorized embedding / 主动授权的向量生成 |
| `list_repos_tool` | advanced | Only current and explicitly authorized roots / 当前及明确授权仓库 |
| `cross_repo_search_tool` | advanced | Search authorized repositories / 授权范围内跨仓库搜索 |
| `list_communities_tool` | review, advanced | Community inventory / 社区列表 |
| `get_community_tool` | advanced | Community details / 社区详情 |
| `get_architecture_overview_tool` | advanced | Architecture and coupling / 架构与耦合分析 |
| `get_hub_nodes_tool` | advanced | Central entities / 核心节点 |
| `get_bridge_nodes_tool` | advanced | Cross-community bridges / 跨社区桥接节点 |
| `get_knowledge_gaps_tool` | advanced | Coverage gaps / 知识缺口 |
| `get_surprising_connections_tool` | advanced | Unexpected relationships / 潜在关联 |
| `get_suggested_questions_tool` | advanced | Exploration questions / 探索问题建议 |
| `traverse_graph_tool` | advanced | Relationship traversal / 关系遍历 |

The internal `get_refactor_edit_plan_tool` is **not model-visible**. The Host
requests its full `files[{path,before_sha256,after_content,edit_count}]`, then
preflights every file and writes through native DSH file intents, policy and
`ctx.fs`. Presentation limits on rename previews never truncate the edit plan.
Failed writes return committed paths and a complete hash-guarded recovery patch.

内部编辑计划接口不向模型展开；提交前校验全部文件的原始字节哈希。每个文件原子
写入，保留 UTF-8、BOM 与换行。发生失败后停止后续写入，返回已提交文件和完整恢复补丁。

## Five prompts / 五个工作流提示

Call `crg_prompt` with `name` and optional `base`/`description`. Text comes from
the engine, with original tool names rewritten to their native DSH names.

| Prompt | Selected group / 自动展开 |
| --- | --- |
| `review_changes` | review |
| `architecture_map` | advanced |
| `debug_issue` | review |
| `onboard_developer` | advanced |
| `pre_merge_check` | all |

## Seven skills / 七个技能

Bundled upstream content is registered through DSH's native skill service. Each
skill begins by selecting the relevant workflow; runtime tool references are
rewritten consistently.

| Upstream skill | Native skill | Selected group |
| --- | --- | --- |
| build-graph | `crg-build-graph` | advanced |
| debug-issue | `crg-debug-issue` | review |
| explore-codebase | `crg-explore-codebase` | advanced |
| refactor-safely | `crg-refactor-safely` | refactor |
| review-changes | `crg-review-changes` | review |
| review-delta | `crg-review-delta` | review |
| review-pr | `crg-review-pr` | review |

## Graph and export / 图谱与导出

`crg_visualize` reuses the upstream renderer and CLI: full, file and community
views; file/symbol/changed-code/flow seeds; shortest paths; depth and size limits;
HTML, JSON, GraphML, Cypher, Obsidian, and optional SVG exports. SVG requires the
engine's optional visualization dependencies. The Web/Desktop client uses the
two released workspace readers and displays an offline sandboxed iframe.
Headless tools return the generated local path.

图谱侧栏保留搜索、过滤、缩放、拖动、聚合、路径视图和 HTML 下载。全部资源通过
工作区文件通道读取并内联；iframe 禁止同源访问和联网，不启动固定端口服务。
