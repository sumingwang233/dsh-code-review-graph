export const groups = ['context', 'review', 'refactor', 'export', 'advanced', 'all'] as const;
export type Workflow = typeof groups[number];
const context = ['build_or_update_graph_tool', 'get_minimal_context_tool', 'query_graph_tool', 'semantic_search_nodes_tool', 'list_graph_stats_tool', 'get_docs_section_tool'];
const members: Record<Exclude<Workflow, 'all'>, string[]> = {
  context,
  review: [...context, 'detect_changes_tool', 'get_review_context_tool', 'get_impact_radius_tool', 'get_affected_flows_tool', 'list_flows_tool', 'get_flow_tool', 'list_communities_tool'],
  refactor: [...context, 'refactor_tool', 'apply_refactor_tool', 'find_large_functions_tool', 'get_impact_radius_tool', 'get_affected_flows_tool', 'detect_changes_tool'],
  export: [...context, 'generate_wiki_tool', 'get_wiki_page_tool'],
  advanced: [...context, 'embed_graph_tool', 'run_postprocess_tool', 'list_repos_tool', 'cross_repo_search_tool', 'list_communities_tool', 'get_community_tool', 'get_architecture_overview_tool', 'get_hub_nodes_tool', 'get_bridge_nodes_tool', 'get_knowledge_gaps_tool', 'get_surprising_connections_tool', 'get_suggested_questions_tool', 'traverse_graph_tool', 'detect_changes_tool', 'list_flows_tool', 'get_flow_tool', 'find_large_functions_tool'],
};
export const skillWorkflow: Record<string, Workflow> = {
  'build-graph': 'advanced', 'debug-issue': 'review', 'explore-codebase': 'advanced',
  'refactor-safely': 'refactor', 'review-changes': 'review', 'review-delta': 'review', 'review-pr': 'review',
};
export const publicName = (raw: string): string => `mcp__code_review_graph__${raw}`;
export function exposed(workflow: Workflow, names: string[]): string[] {
  return workflow === 'all' ? names : names.filter(name => members[workflow].includes(name));
}
