# PR title

Add native DeepSeek Harness target and read-only refactor edit plans

# PR body

Closes #1100.

DeepSeek Harness needs a native bundle to retain Agent-local tool selection,
its workspace graph sidebar, and permission-controlled refactor writes. This
adds the `dsh` platform target and delegates installation/removal to DSH's native
plugin manager. The adapter is maintained separately at
https://github.com/sumingwang233/dsh-code-review-graph, targeting CRG 2.3.9 and
the exact DSH releases 0.1.5-rc.2 and 0.2.0-rc.2.

- Add `--dsh-profile` (default `web`) to install/init/uninstall. A DSH-only init
  does not install legacy hooks or instruction files. Reinstall leaves an
  already registered bundle byte-identical. Removal delegates only this owned
  bundle to DSH; malformed manifests and desktop-owned profiles remain intact.
- Register the native bundle in `PLATFORMS`. DSH stores an npm dependency plus
  `dsh.profile.bundles`, so the existing inventory delegates its lifecycle
  through `format="native-bundle"` instead of treating it as an MCP object.
- Add `get_refactor_edit_plan_tool`: a read-only, complete edit plan reusing the
  existing refactor calculation. It retains previews, checks stale edits, fails
  the whole plan for missing/invalid files, preserves BOM/newlines, and includes
  original byte hashes. The DSH adapter uses this internal API before submitting
  changes through file intents, session policy and `ctx.fs`.
- Confine source reads in build/review/flow paths to the canonical root, including
  cached graph paths. This closes a path through a linked parent directory that
  adapter argument checks alone cannot protect.
- Keep offline D3 rendering valid on Windows checkouts. Disable line-ending
  conversion for the vendored asset and accept normalized CRLF bytes only when
  the original pinned integrity hash verifies.
- Resolve the existing shell regression test's Bash executable through PATH
  before spawning it, so Windows does not select its System32 WSL launcher.
  Keep the full large-input assertion; no failure is skipped.

Validation records and release-tagged session transcripts are in the adapter's
`docs/validation.md` and `docs/evidence/`. They use actual released DSH
Session/AgentRegistry/ToolRuntime packages and a real CRG engine with
deterministic calls; **no real model inference was run**. The graph browser check
mounts the native client contribution with version-specific workspace-reader
fixtures; it does not launch the Electron desktop application. The upstream
reviewer decides whether this meets the platform evidence requirement.

Local checks cover native lifecycle, idempotence, malformed configuration,
desktop ownership, all 30 tools/five prompts/seven skills, incremental workers,
authorized cross-repository search, path boundaries, stale edit plans, permission
denial, BOM/CRLF writes, partial-failure recovery, and offline graph interaction.
Completed GitHub Actions matrices:

- [Adapter: all six Windows/Linux/macOS × DSH combinations passed](https://github.com/sumingwang233/dsh-code-review-graph/actions/runs/37716247823).
- [Core: all three OS jobs passed](https://github.com/sumingwang233/code-review-graph/actions/runs/37717599685), each with 808 passed and one platform-specific skip.

Adapter artifacts retain transcripts, browser/lifecycle reports and the tested
packages. The adapter's pinned engine commit has identical production code and
dependency metadata to the core CI head; later changes only affect CI/test
executable resolution. Full Web-server and Electron application launches,
actual language-model and embedding-model inference were not run.

See `docs/DSH.md` for installation, ownership and the edit-plan contract. Until
this API is released officially, the adapter pins an exact public contribution
fork commit rather than silently relying on a released engine that lacks it.
