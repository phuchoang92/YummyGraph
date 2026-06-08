# YummyGraph

**Graph-powered code intelligence for AI agents.** Index any codebase into a knowledge graph, then query it via MCP or CLI.

Works with **Cursor**, **Claude Code**, **Antigravity** (Google), **Codex**, **Windsurf**, **Cline**, **OpenCode**, and any MCP-compatible tool.

[![npm version](https://img.shields.io/npm/v/yummygraph.svg)](https://www.npmjs.com/package/yummygraph)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)

---

## Why?

AI coding tools don't understand your codebase structure. They edit a function without knowing 47 other functions depend on it. YummyGraph fixes this by **precomputing every dependency, call chain, and relationship** into a queryable graph.

**Three commands to give your AI agent full codebase awareness.**

## Quick Start

```bash
# Index your repo (run from repo root)
npx yummygraph analyze
```

That's it. This indexes the codebase, installs agent skills, registers Claude Code hooks, and creates `AGENTS.md` / `CLAUDE.md` context files — all in one command.

> **On npm 11.x?** `npx` can crash during install (`Cannot destructure property 'package' of 'node.target'`). Use the pnpm form instead:
>
> ```bash
> pnpm --allow-build=@ladybugdb/core --allow-build=yummygraph --allow-build=tree-sitter dlx yummygraph@latest analyze
> ```
>
> See [Troubleshooting → `npx yummygraph` crashes with `node.target is null` (npm 11)](#cannot-destructure-property-package-of-nodetarget-as-it-is-null) for the full matrix (global install, npm downgrade).

To configure MCP for your editor, run `npx yummygraph setup` once — or set it up manually below.

`yummygraph setup` auto-detects your editors and writes the correct global MCP config. You only need to run it once.

### Editor Support

| Editor                   | MCP | Skills | Hooks (auto-augment)                                                                       | Support      |
| ------------------------ | --- | ------ | ------------------------------------------------------------------------------------------ | ------------ |
| **Claude Code**          | Yes | Yes    | Yes (PreToolUse)                                                                           | **Full**     |
| **Cursor**               | Yes | Yes    | Yes (postToolUse, [manual install](../yummygraph-cursor-integration/README.md#hook-install)) | **Full**     |
| **Antigravity** (Google) | Yes | Yes    | Yes (AfterTool, [Gemini CLI hooks schema](https://geminicli.com/docs/hooks/reference/))    | **Full**     |
| **Codex**                | Yes | Yes    | —                                                                                          | MCP + Skills |
| **Windsurf**             | Yes | —      | —                                                                                          | MCP          |
| **OpenCode**             | Yes | Yes    | —                                                                                          | MCP + Skills |

> **Claude Code** gets the deepest integration: MCP tools + agent skills + PreToolUse hooks that automatically enrich grep/glob/bash calls with knowledge graph context.

### Community Integrations

| Agent                | Install                      | Source                                                  |
| -------------------- | ---------------------------- | ------------------------------------------------------- |
| [pi](https://pi.dev) | `pi install npm:pi-yummygraph` | [pi-yummygraph](https://github.com/tintinweb/pi-yummygraph) |

## MCP Setup (manual)

If you prefer to configure manually instead of using `yummygraph setup`:

### Claude Code (full support — MCP + skills + hooks)

```bash
# macOS / Linux
claude mcp add yummygraph -- npx -y yummygraph@latest mcp

# Windows
claude mcp add yummygraph -- cmd /c npx -y yummygraph@latest mcp
```

### Codex (full support — MCP + skills)

```bash
codex mcp add yummygraph -- npx -y yummygraph@latest mcp
```

### Cursor / Windsurf

Add to `~/.cursor/mcp.json` (global — works for all projects):

```json
{
  "mcpServers": {
    "yummygraph": {
      "command": "npx",
      "args": ["-y", "yummygraph@latest", "mcp"]
    }
  }
}
```

### OpenCode

Add to `~/.config/opencode/config.json`:

```json
{
  "mcp": {
    "yummygraph": {
      "command": "npx",
      "args": ["-y", "yummygraph@latest", "mcp"]
    }
  }
}
```

## How It Works

YummyGraph builds a complete knowledge graph of your codebase through a multi-phase indexing pipeline:

1. **Structure** — Walks the file tree and maps folder/file relationships
2. **Parsing** — Extracts functions, classes, methods, and interfaces using Tree-sitter ASTs
3. **Resolution** — Resolves imports and function calls across files with language-aware logic
   - **Field & Property Type Resolution** — Tracks field types across classes and interfaces for deep chain resolution (e.g., `user.address.city.getName()`)
   - **Return-Type-Aware Variable Binding** — Infers variable types from function return types, enabling accurate call-result binding
4. **Clustering** — Groups related symbols into functional communities
5. **Processes** — Traces execution flows from entry points through call chains
6. **Search** — Builds hybrid search indexes for fast retrieval

The result is a **LadybugDB graph database** stored locally in `.yummygraph/` with full-text search and semantic embeddings.

## MCP Tools

Your AI agent gets these tools automatically:

| Tool             | What It Does                                                     | `repo` Param |
| ---------------- | ---------------------------------------------------------------- | ------------ |
| `list_repos`     | Discover all indexed repositories                                | —            |
| `query`          | Process-grouped hybrid search (BM25 + semantic + RRF)            | Optional     |
| `context`        | 360-degree symbol view — categorized refs, process participation | Optional     |
| `impact`         | Blast radius analysis with depth grouping and confidence         | Optional     |
| `detect_changes` | Git-diff impact — maps changed lines to affected processes       | Optional     |
| `rename`         | Multi-file coordinated rename with graph + text search           | Optional     |
| `cypher`         | Raw Cypher graph queries                                         | Optional     |

> With one indexed repo, the `repo` param is optional. With multiple, specify which: `query({query: "auth", repo: "my-app"})`.

## MCP Resources

| Resource                                | Purpose                                              |
| --------------------------------------- | ---------------------------------------------------- |
| `yummygraph://repos`                      | List all indexed repositories (read first)           |
| `yummygraph://repo/{name}/context`        | Codebase stats, staleness check, and available tools |
| `yummygraph://repo/{name}/clusters`       | All functional clusters with cohesion scores         |
| `yummygraph://repo/{name}/cluster/{name}` | Cluster members and details                          |
| `yummygraph://repo/{name}/processes`      | All execution flows                                  |
| `yummygraph://repo/{name}/process/{name}` | Full process trace with steps                        |
| `yummygraph://repo/{name}/schema`         | Graph schema for Cypher queries                      |

## MCP Prompts

| Prompt          | What It Does                                                              |
| --------------- | ------------------------------------------------------------------------- |
| `detect_impact` | Pre-commit change analysis — scope, affected processes, risk level        |
| `generate_map`  | Architecture documentation from the knowledge graph with mermaid diagrams |

## CLI Commands

```bash
yummygraph setup                   # Configure MCP for your editors (one-time)
yummygraph analyze [path]          # Index a repository (or update stale index)
yummygraph analyze --repair-fts    # Fast path: rebuild/verify only FTS indexes on existing index data
yummygraph analyze --force         # Full rebuild: re-parse + graph rebuild + FTS rebuild
yummygraph analyze --embeddings    # Enable embedding generation (slower, better search)
yummygraph analyze --skip-agents-md  # Preserve custom AGENTS.md/CLAUDE.md yummygraph section edits
yummygraph analyze --verbose       # Log skipped files when parsers are unavailable
yummygraph analyze --max-file-size 1024  # Skip files larger than N KB (default: 512, cap: 32768)
yummygraph analyze --worker-timeout 60  # Increase worker idle timeout for slow parses
yummygraph analyze --wal-checkpoint-threshold 67108864  # 64 MiB. Control LadybugDB WAL auto-checkpoint threshold (default: 67108864 = 64 MiB; -1 keeps Ladybug stock ~16 MiB)
yummygraph mcp                     # Start MCP server (stdio) — serves all indexed repos
yummygraph serve                   # Start local HTTP server (multi-repo) for web UI
yummygraph index                   # Register an existing .yummygraph/ folder into the global registry
yummygraph list                    # List all indexed repositories
yummygraph status                  # Show index status for current repo
yummygraph clean                   # Delete index for current repo
yummygraph clean --all --force     # Delete all indexes
yummygraph wiki [path]             # Generate LLM-powered docs from knowledge graph
yummygraph wiki --model <model>    # Wiki with custom LLM model (default: gpt-4o-mini)

# Direct graph queries — the same tools the MCP server exposes, no MCP daemon needed
yummygraph query "<concept>"                                    # Process-grouped hybrid search
yummygraph context <symbol> [--uid <uid> | --file <path>]       # 360° symbol view; flags disambiguate a shared name
yummygraph impact <symbol> [--uid <uid> | --file <path> | --kind <kind>]  # Blast radius; flags disambiguate a shared name
yummygraph detect-changes          # Map the working-tree diff to affected symbols and execution flows
yummygraph cypher "<query>"        # Run a raw Cypher query against the knowledge graph

# Repository groups (multi-repo / monorepo service tracking)
yummygraph group create <name>                                   # Create a repository group
yummygraph group add <group> <groupPath> <registryName>          # Add a repo to a group. <groupPath> is a hierarchy path (e.g. hr/hiring/backend); <registryName> is the repo's name from the registry (see `yummygraph list`)
yummygraph group remove <group> <groupPath>                      # Remove a repo from a group by its hierarchy path
yummygraph group list [name]                                     # List groups, or show one group's config
yummygraph group sync <name>                                     # Extract contracts and match across repos/services
yummygraph group contracts <name>  # Inspect extracted contracts and cross-links
yummygraph group query <name> <q>  # Search execution flows across all repos in a group
yummygraph group status <name>     # Check staleness of repos in a group
```

## Remote Embeddings

Set these env vars to use a remote OpenAI-compatible `/v1/embeddings` endpoint instead of the local model:

```bash
export YUMMYGRAPH_EMBEDDING_URL=http://your-server:8080/v1
export YUMMYGRAPH_EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
export YUMMYGRAPH_EMBEDDING_DIMS=1024          # optional, default 384
export YUMMYGRAPH_EMBEDDING_API_KEY=your-key   # optional, default: "unused"
yummygraph analyze . --embeddings
```

Works with Infinity, vLLM, TEI, llama.cpp, Ollama, LM Studio, or OpenAI. When unset, local embeddings are used unchanged.

## Multi-Repo Support

YummyGraph supports indexing multiple repositories. Each `yummygraph analyze` registers the repo in a global registry (`~/.yummygraph/registry.json`). The MCP server serves all indexed repos automatically.

## Supported Languages

TypeScript, JavaScript, Python, Java, C, C++, C#, Go, Rust, PHP, Kotlin, Swift, Ruby

### Language Feature Matrix

| Language   | Imports | Named Bindings | Exports | Heritage | Type Annotations | Constructor Inference | Config | Frameworks | Entry Points |
| ---------- | ------- | -------------- | ------- | -------- | ---------------- | --------------------- | ------ | ---------- | ------------ |
| TypeScript | ✓       | ✓              | ✓       | ✓        | ✓                | ✓                     | ✓      | ✓          | ✓            |
| JavaScript | ✓       | ✓              | ✓       | ✓        | —                | ✓                     | ✓      | ✓          | ✓            |
| Python     | ✓       | ✓              | ✓       | ✓        | ✓                | ✓                     | ✓      | ✓          | ✓            |
| Java       | ✓       | ✓              | ✓       | ✓        | ✓                | ✓                     | —      | ✓          | ✓            |
| Kotlin     | ✓       | ✓              | ✓       | ✓        | ✓                | ✓                     | —      | ✓          | ✓            |
| C#         | ✓       | ✓              | ✓       | ✓        | ✓                | ✓                     | ✓      | ✓          | ✓            |
| Go         | ✓       | —              | ✓       | ✓        | ✓                | ✓                     | ✓      | ✓          | ✓            |
| Rust       | ✓       | ✓              | ✓       | ✓        | ✓                | ✓                     | —      | ✓          | ✓            |
| PHP        | ✓       | ✓              | ✓       | —        | ✓                | ✓                     | ✓      | ✓          | ✓            |
| Ruby       | ✓       | —              | ✓       | ✓        | —                | ✓                     | —      | ✓          | ✓            |
| Swift      | —       | —              | ✓       | ✓        | ✓                | ✓                     | ✓      | ✓          | ✓            |
| C          | —       | —              | ✓       | —        | ✓                | ✓                     | —      | ✓          | ✓            |
| C++        | —       | —              | ✓       | ✓        | ✓                | ✓                     | —      | ✓          | ✓            |

**Imports** — cross-file import resolution · **Named Bindings** — `import { X as Y }` / re-export tracking · **Exports** — public/exported symbol detection · **Heritage** — class inheritance, interfaces, mixins · **Type Annotations** — explicit type extraction for receiver resolution · **Constructor Inference** — infer receiver type from constructor calls (`self`/`this` resolution included for all languages) · **Config** — language toolchain config parsing (tsconfig, go.mod, etc.) · **Frameworks** — AST-based framework pattern detection · **Entry Points** — entry point scoring heuristics

## Agent Skills

YummyGraph ships with skill files that teach AI agents how to use the tools effectively:

- **Exploring** — Navigate unfamiliar code using the knowledge graph
- **Debugging** — Trace bugs through call chains
- **Impact Analysis** — Analyze blast radius before changes
- **Refactoring** — Plan safe refactors using dependency mapping

Installed automatically by both `yummygraph analyze` (per-repo) and `yummygraph setup` (global).

## Requirements

- Node.js >= 18
- Git repository (uses git for commit tracking)

## Release candidates

Stable releases publish to the default `latest` dist-tag. When a pull request
with non-documentation changes merges into `main`, an automated workflow also
publishes a prerelease build under the `rc` dist-tag, so early adopters can
try in-flight fixes without waiting for the next stable cut. (Docs-only
merges are skipped.)

```bash
# Try the latest release candidate (pre-stable — may change at any time)
npm install -g yummygraph@rc
# — or —
npx yummygraph@rc analyze
```

Release-candidate versions follow the standard semver prerelease format
`X.Y.Z-rc.N`, where `X.Y.Z` is the next stable target (bumped from the
current `latest` by patch by default; `minor` or `major` when kicking off a
bigger cycle) and `N` increments per published rc. Example sequence:
`1.6.2-rc.1`, `1.6.2-rc.2`, …, then once `1.6.2` ships stable,
`1.6.3-rc.1`. See the [Releases page](https://github.com/abhigyanpatwari/YummyGraph/releases)
for the full list; stable `latest` is unaffected.

## Troubleshooting

### `Cannot destructure property 'package' of 'node.target' as it is null`

This error comes from **npm 11.x's arborist** while installing yummygraph (often via `npx`), before yummygraph code runs. It is triggered by platform-filtered `optionalDependencies` in native packages such as `onnxruntime-node` / `@huggingface/transformers` (used when indexing with `--embeddings`). YummyGraph cannot catch it at runtime — use one of these workarounds:

```bash
pnpm --allow-build=@ladybugdb/core --allow-build=yummygraph --allow-build=tree-sitter dlx yummygraph@latest analyze       # auto-selected when pnpm + npm 11+
npm install -g yummygraph@latest         # global install avoids per-run npx reify
yummygraph analyze                       # if already installed globally
```

On **pnpm 10+**, lifecycle scripts are blocked unless explicitly allowed — the resolver adds `--allow-build` for `@ladybugdb/core`, `yummygraph`, and `tree-sitter` automatically when it picks `pnpm dlx`.

If you must stay on npm 11.x without pnpm, downgrade npm toolchain-wide (last resort):

```bash
npm install -g npm@10.9.0
```

See [#1939](https://github.com/abhigyanpatwari/YummyGraph/issues/1939) and the original [#819](https://github.com/abhigyanpatwari/YummyGraph/issues/819) thread. An older variant of this crash (tree-sitter-dart tarball URL) was fixed in yummygraph v1.6.2+ ([#820](https://github.com/abhigyanpatwari/YummyGraph/pull/820)); if you still see install failures after upgrading, clear cache:

```bash
npm cache clean --force
npx yummygraph@latest analyze
```

### `ERR_DLOPEN_FAILED` / `lbugjs.node` missing (pnpm dlx, pnpx)

YummyGraph depends on `@ladybugdb/core`, whose native database addon
(`lbugjs.node`) is placed by a postinstall script. `pnpm dlx`, `pnpx`, and any
install run with `--ignore-scripts` skip lifecycle scripts, so the addon is
never put in place and the runtime crashes with `ERR_DLOPEN_FAILED`:

```
Error: dlopen(.../@ladybugdb/core/lbugjs.node, ...): tried: '...' (no such file)
  code: 'ERR_DLOPEN_FAILED'
```

Options that run install scripts:

```bash
# pnpm dlx with explicit build permission (one-off, no global install required)
pnpm --allow-build=@ladybugdb/core --allow-build=yummygraph --allow-build=tree-sitter \
  dlx yummygraph@latest serve

# npm: global install (recommended on npm 11+; bare npx may crash — see section above)
npm install -g yummygraph@latest
yummygraph serve

# npx (npm < 11, or after upgrading npm)
npx yummygraph@latest serve

# pnpm: global install with build scripts allowed (pnpm 10.2+; no approve-builds -g on pnpm 11+)
pnpm add -g --allow-build=@ladybugdb/core --allow-build=yummygraph --allow-build=tree-sitter yummygraph
yummygraph serve
```

### Installation fails with native module errors

Some optional language grammars (Dart, Kotlin, Swift) require native compilation. If they fail, YummyGraph still works — those languages will be skipped.

If `npm install -g yummygraph` fails on native modules:

```bash
# Ensure build tools are available (Linux/macOS)
# Ubuntu/Debian: sudo apt install python3 make g++
# macOS: xcode-select --install

# Retry installation
npm install -g yummygraph
```

### Analyze warns about unavailable FTS or VECTOR extensions

YummyGraph uses optional DuckDB extensions for BM25 and vector search. The `yummygraph serve` and MCP read paths only ever try to `LOAD` the extensions — they never block on a network install. The `analyze` command, by default, attempts one bounded out-of-process `INSTALL` if `LOAD` fails and proceeds even when that install times out, so the index is always written to disk; BM25/vector search degrade gracefully until the extensions become available.

Configure the behavior with two environment variables:

| Variable                                     | Values                       | Default             | Effect                                                                                                                                                                                                                                                                                   |
| -------------------------------------------- | ---------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `YUMMYGRAPH_LBUG_EXTENSION_INSTALL`            | `auto`, `load-only`, `never` | `auto`              | `auto` runs one bounded INSTALL if LOAD fails. `load-only` only uses already-installed extensions (recommended for offline / firewalled environments). `never` skips optional extensions entirely.                                                                                       |
| `YUMMYGRAPH_LBUG_EXTENSION_INSTALL_TIMEOUT_MS` | positive integer             | `15000`             | Wall-clock budget for the out-of-process `INSTALL` child before it is killed.                                                                                                                                                                                                            |
| `YUMMYGRAPH_WAL_CHECKPOINT_THRESHOLD`          | integer `>= -1`              | `67108864` (64 MiB) | LadybugDB WAL auto-checkpoint threshold during analyze (bytes). Auto-checkpoint remains enabled; `-1` keeps Ladybug's stock ~16 MiB. Larger thresholds reduce checkpoint frequency but increase the WAL size at rotation time — choose a smaller value on disk-constrained environments. |

```bash
# Offline/airgapped: never reach the network for extensions
YUMMYGRAPH_LBUG_EXTENSION_INSTALL=load-only npx yummygraph analyze

# Slow network: give extension downloads more time
YUMMYGRAPH_LBUG_EXTENSION_INSTALL_TIMEOUT_MS=30000 npx yummygraph analyze
```

### Analysis runs out of memory

For very large repositories:

```bash
# Increase Node.js heap size
NODE_OPTIONS="--max-old-space-size=16384" npx yummygraph analyze

# Exclude large directories
echo "vendor/" >> .yummygraphignore
echo "dist/" >> .yummygraphignore
```

### Large files are being skipped

By default the walker skips files larger than **512 KB** (see log line `Skipped N large files (>512KB)`). Raise the threshold via either the CLI flag or the environment variable — both accept a value in **KB**:

```bash
# CLI flag (takes precedence over the env var)
npx yummygraph analyze --max-file-size 2048     # skip only files > 2 MB

# Environment variable (persists across commands)
export YUMMYGRAPH_MAX_FILE_SIZE=2048
npx yummygraph analyze
```

Values above **32768 KB (32 MB)** are clamped to the tree-sitter parser ceiling; invalid values fall back to the 512 KB default with a one-time warning. When an override is active, `analyze` prints the effective threshold in its startup banner (e.g. `YUMMYGRAPH_MAX_FILE_SIZE: effective threshold 2048KB (default 512KB)`).

### Analyze reports a worker timeout

Worker parse timeouts are recoverable. YummyGraph retries stalled worker jobs with backoff, splits large jobs to isolate slow files, and quarantines a file that repeatedly crashes its worker (respawning the slot so the pool keeps going). If a large repository needs more time per worker job, use either:

```bash
# CLI flag, in seconds
npx yummygraph analyze --worker-timeout 60

# Environment variable, in milliseconds
export YUMMYGRAPH_WORKER_SUB_BATCH_TIMEOUT_MS=60000
npx yummygraph analyze
```

For repositories with very large source files, `YUMMYGRAPH_WORKER_SUB_BATCH_MAX_BYTES` controls the worker job byte budget. The default is **8388608 bytes (8 MB)**.

### Worker pool resilience tuning

Three env vars expose the pool's resilience layers (respawn budget, cumulative-timeout cap, circuit breaker). Defaults are tuned for typical repos; bump them when an analyze legitimately needs more retries, or lower them to fail-fast on a known-bad shape.

| Variable                                        | Default                 | Effect                                                                                                                |
| ----------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `YUMMYGRAPH_WORKER_MAX_RESPAWNS_PER_SLOT`         | `3`                     | Max replacement spawns per slot before the slot is dropped from the active rotation.                                  |
| `YUMMYGRAPH_WORKER_MAX_CUMULATIVE_TIMEOUT_MS`     | `5 × subBatchTimeoutMs` | Total retry wall-time budget per job before quarantining. Bounds exponentially-growing retry waits.                   |
| `YUMMYGRAPH_WORKER_CONSECUTIVE_FAILURE_THRESHOLD` | `max(3, poolSize)`      | Per-slot consecutive deaths before the pool's circuit breaker trips. After tripping, dispatches require a fresh pool. |

### Graph cleanup tuning

After scope resolution, analyze prunes inert block-local value symbols (a function-local `const`/`let`/`var` that ends up with only its structural `File→DEFINES` edge) to keep the graph focused on cross-symbol relationships. Module/file-scope symbols, class members, and any local with a real edge are always kept.

| Variable                             | Default | Effect                                                                                                  |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------- |
| `YUMMYGRAPH_KEEP_LOCAL_VALUE_SYMBOLS`  | unset   | Set to `1`/`true` to keep inert block-local value symbols instead of pruning them.                      |

Programmatic callers can pass `keepLocalValueSymbols: true` in `PipelineOptions` instead of setting the env var.

## Privacy

- All processing happens locally on your machine
- No code is sent to any server
- Index stored in `.yummygraph/` inside your repo (gitignored)
- Global registry at `~/.yummygraph/` stores only paths and metadata

## Web UI

YummyGraph also has a browser-based UI at [yummygraph.vercel.app](https://yummygraph.vercel.app) — 100% client-side, your code never leaves the browser.

**Local Backend Mode:** Run `yummygraph serve` and open the web UI locally — it auto-detects the server and shows all your indexed repos, with full AI chat support. No need to re-upload or re-index. The agent's tools (Cypher queries, search, code navigation) route through the backend HTTP API automatically.

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/)

Free for non-commercial use. Contact for commercial licensing.
