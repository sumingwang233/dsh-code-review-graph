## Platform name

DeepSeek Harness (DSH), the official `@deepseek-ai/dsh` agent harness.

## Link to the platform's MCP / configuration docs

Official, release-pinned documentation:

- [MCP client configuration, 0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/packages/mcp/mcp-client/README.md)
- [Plugin packaging and profiles, 0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/docs/user/develop/basic/publish.md)
- [Plugin packaging and profiles, 0.1.5-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/docs/user/develop/basic/publish.md)
- [Desktop installation ownership, 0.1.5-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.5-rc.2/apps/desktop/README.md#installation-ownership)
- [Desktop installation ownership, 0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.2.0-rc.2/apps/desktop/README.md#installation-ownership)

## Does the platform support MCP?

Yes: stdio and Streamable HTTP.

## Where does its MCP configuration live?

DSH uses Cordis plugin entries and YAML patch operations. Its configuration has no top-level `mcpServers` object or array.

The default home is `~/.dsh`, overridden by `DSH_HOME`. A profile lives at `$DSH_HOME/profiles/<profile>/`:

- `package.json` records dependencies and the ordered `dsh.profile.bundles` array of package names.
- `cordis.patch.yml` is the user's YAML patch layer.
- `$DSH_HOME/cordis.patch.yml` is the shared home-level patch layer.

A standard local MCP server can be inserted by a patch such as:

```yaml
- insert:
    - id: mcp-code-review-graph
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: code-review-graph
        transport: stdio
        command: code-review-graph
        args: ['serve']
```

The patch root is an array of operations; `insert` contains an array of plugin entries. `transport: stdio` is required in the client configuration. There is no server-entry `type` field. This example describes the official MCP schema; the proposed integration below would install a native bundle to handle session workspace binding and the complete workflow.

An installed native bundle appears in the profile manifest as follows; existing bundles and dependencies must be preserved:

```json
{
  "dependencies": {
    "dsh-code-review-graph": "0.1.0"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "dsh-code-review-graph"]
    }
  }
}
```

## Additional context

I would like to contribute a native DSH integration, using code-review-graph 2.3.9 as the feature baseline. Initial compatibility would cover DSH 0.1.5-rc.2 and 0.2.0-rc.2 on Windows, Linux and macOS, across Web, headless CLI and Desktop.

The proposed adapter repository is `sumingwang233/dsh-code-review-graph`, with an MIT-licensed, prebuilt npm package named `dsh-code-review-graph`. These are planned publication names; no package or repository has been published yet.

The adapter would reuse the Python engine and existing visualization renderer, and cover the current 30 tools, five workflow prompts and seven skills. It would:

- Expose tool groups on demand per Agent while keeping every capability available.
- Bind calls to the calling session's canonical workspace, remove model-supplied `repo_root`, validate file paths and limit cross-repository operations to explicitly authorized roots.
- Build on first graph use and share incremental maintenance among active sessions in the same repository.
- Present the existing interactive graph in native Web/Desktop sidebars, retaining exports and local assets; the CLI would produce a local HTML entry point.
- Provide an explicit dependency-preparation step and keep normal operation local by default, with cloud embeddings disabled unless configured by the user.

### Safe refactor integration

DSH plugins and MCP subprocesses run as Host code. The standard MCP bridge does not automatically sandbox Python source writes. The existing refactor dry-run returns bounded diffs rather than a complete structured edit plan.

I propose a small upstream read-only `get_refactor_edit_plan_tool(refactor_id, repo_root)` API, sharing the existing planning calculation and returning complete file paths, original-byte SHA-256 hashes, replacement content and edit counts. The plan must preserve UTF-8/BOM/newlines and fail on incomplete or invalid input. DSH would apply approved edits through its filesystem intent and policy mechanisms, rechecking paths and content freshness; it would not expose Python's direct source-writing executor.

The first adapter release would pin the exact public contribution commit containing this interface, then switch to an official engine release when available. This avoids claiming that unmodified PyPI 2.3.9 already provides the interface.

### Proposed upstream contribution

- Register DSH through the existing platform table and CLI choices, with a profile option defaulting to `web`.
- Use DSH's official native bundle installation/removal mechanisms. Ordinary profiles use `dsh plugin --profile <name> add/remove`; Desktop follows its release-specific ownership rules.
- Document the declarative extension needed to represent DSH's patch-operation and native-bundle configuration in the existing platform table, rather than adding an unrelated installer path.
- Preserve unrelated configuration, skip malformed configuration, ensure byte-idempotent reinstall and remove only CRG-owned integration content.
- Add lifecycle coverage and run the existing all-platform uninstall sweep, alongside the edit-plan tests.

### Validation and ownership

I have the released DSH CLI 0.1.5-rc.2 and Desktop 0.2.0-rc.2 installed. The implementation would include isolated automated testing across the declared versions, platforms and surfaces, plus a transcript from an actual released DSH session invoking a real CRG tool and returning graph data. That transcript would clearly identify deterministic automated execution without real-model inference; tools/list output or mocked tool results would not be used as invocation evidence.

I plan to maintain the adapter and document its explicitly tested compatibility versions. Implementation has not started; this issue opens the platform discussion requested by CONTRIBUTING.md. Feedback on the native-bundle approach and the read-only edit-plan API would be helpful before the implementation PR targeting `staging`.

## Testing

- [x] I have this tool installed and can test a pre-release integration.
