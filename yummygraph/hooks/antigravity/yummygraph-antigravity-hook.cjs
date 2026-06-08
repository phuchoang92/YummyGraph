#!/usr/bin/env node
/**
 * YummyGraph Antigravity / Gemini CLI Hook Adapter
 *
 * Bridges the Gemini CLI hooks contract (also used by Antigravity 2.0 — see
 * https://geminicli.com/docs/hooks/reference/) to the same graph-aware
 * augmentation / staleness signals the Claude Code hook provides.
 *
 * Schema differences from the Claude adapter:
 *   - Events are BeforeTool / AfterTool (not PreToolUse / PostToolUse).
 *   - Tool names are snake_case (run_shell_command, search_file_content, glob).
 *   - BeforeTool cannot inject context — decision: "allow" provides no channel
 *     to surface text to the agent. Augmentation therefore runs in AfterTool,
 *     where `hookSpecificOutput.additionalContext` is appended to the tool
 *     result the agent sees.
 *   - Stale-index hints after git commit/merge/rebase/cherry-pick/pull are
 *     surfaced via the same `additionalContext` channel (so the agent reads
 *     them, not only the user) and mirrored to stderr for terminal users.
 *   - Stdin uses `tool_name`, `tool_input`, and `tool_response`
 *     (with `llmContent`, `returnDisplay`, optional `error`).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { acquireHookSlot } = require('./hook-lock.cjs');
const { hasYummyGraphDbLockedByYummyGraphServer } = require('./hook-db-lock-probe.cjs');
const { formatAnalyzeCommand } = require('./resolve-analyze-cmd.cjs');

function readInput() {
  try {
    const data = fs.readFileSync(0, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function isGlobalRegistryDir(candidate) {
  if (fs.existsSync(path.join(candidate, 'meta.json'))) return false;
  return (
    fs.existsSync(path.join(candidate, 'registry.json')) ||
    fs.existsSync(path.join(candidate, 'repos'))
  );
}

function walkForYummyGraphDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, '.yummygraph');
    if (fs.existsSync(candidate)) {
      if (!isGlobalRegistryDir(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findCanonicalRepoRoot(cwd) {
  try {
    const result = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf-8',
      timeout: 2000,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (result.error || result.status !== 0) return null;
    const commonDir = (result.stdout || '').trim();
    if (!commonDir || !path.isAbsolute(commonDir)) return null;
    return path.dirname(commonDir);
  } catch {
    return null;
  }
}

function findYummyGraphDir(startDir) {
  const cwd = startDir || process.cwd();
  const fromCwd = walkForYummyGraphDir(cwd);
  if (fromCwd) return fromCwd;
  const canonicalRoot = findCanonicalRepoRoot(cwd);
  if (canonicalRoot && canonicalRoot !== cwd) {
    return walkForYummyGraphDir(canonicalRoot);
  }
  return null;
}

function hasYummyGraphServerOwner(yummyGraphDir) {
  return hasYummyGraphDbLockedByYummyGraphServer(path.join(yummyGraphDir, 'lbug'), process.pid);
}

function extractAugmentContext(stderr) {
  const output = (stderr || '').trim();
  const marker = output.indexOf('[YummyGraph]');
  const debug = process.env.YUMMYGRAPH_DEBUG === '1' || process.env.YUMMYGRAPH_DEBUG === 'true';
  if (debug && output.length > 0) {
    // Emit the FULL discarded prefix (everything before the marker, or all of
    // it when no marker is present) so suppressed diagnostics — LadybugDB lock
    // warnings, parser errors, etc. — remain recoverable on the hook's own
    // stderr. Mirrors the Claude adapter's debug behavior.
    const discarded = marker === -1 ? output : output.slice(0, marker).trim();
    if (discarded.length > 0) {
      process.stderr.write(`[YummyGraph hook] augment stderr discarded prefix:\n${discarded}\n`);
    }
  }
  return marker === -1 ? '' : output.slice(marker).trim();
}

/**
 * Extract a usable search token from a tool invocation.
 *   - search_file_content / glob: top-level `pattern` (sometimes `query`).
 *   - run_shell_command: parse rg/grep argv, returning the first non-flag
 *     positional ≥ 3 chars.
 * Returns null when the tool is not a recognized search or the pattern is
 * too short.
 */
function extractPattern(toolName, toolInput) {
  if (toolName === 'search_file_content') {
    const q = toolInput.pattern || toolInput.query || '';
    return typeof q === 'string' && q.length >= 3 ? q : null;
  }

  if (toolName === 'glob') {
    const raw = toolInput.pattern || '';
    const match = raw.match(/[*\/]([a-zA-Z][a-zA-Z0-9_-]{2,})/);
    return match ? match[1] : null;
  }

  if (toolName === 'run_shell_command') {
    const cmd = toolInput.command || '';
    if (!/\brg\b|\bgrep\b/.test(cmd)) return null;

    const tokens = cmd.split(/\s+/);
    let foundCmd = false;
    let skipNext = false;
    const flagsWithValues = new Set([
      '-e',
      '-f',
      '-m',
      '-A',
      '-B',
      '-C',
      '-g',
      '--glob',
      '-t',
      '--type',
      '--include',
      '--exclude',
    ]);

    for (const token of tokens) {
      if (skipNext) {
        skipNext = false;
        continue;
      }
      if (!foundCmd) {
        if (/\brg$|\bgrep$/.test(token)) foundCmd = true;
        continue;
      }
      if (token.startsWith('-')) {
        if (flagsWithValues.has(token)) skipNext = true;
        continue;
      }
      const cleaned = token.replace(/['"]/g, '');
      return cleaned.length >= 3 ? cleaned : null;
    }
    return null;
  }

  return null;
}

function resolveCliPath() {
  const fromEnv = process.env.YUMMYGRAPH_HOOK_CLI_PATH;
  if (fromEnv !== undefined && String(fromEnv).trim() && fs.existsSync(String(fromEnv))) {
    return String(fromEnv);
  }
  let cliPath = path.resolve(__dirname, '..', '..', 'dist', 'cli', 'index.js');
  if (!fs.existsSync(cliPath)) {
    try {
      cliPath = require.resolve('yummygraph/dist/cli/index.js');
    } catch {
      cliPath = '';
    }
  }
  return cliPath;
}

function runYummyGraphCli(cliPath, args, cwd, timeout) {
  const isWin = process.platform === 'win32';
  if (cliPath) {
    return spawnSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf-8',
      timeout,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }
  return spawnSync(isWin ? 'npx.cmd' : 'npx', ['-y', 'yummygraph', ...args], {
    encoding: 'utf-8',
    timeout: timeout + 5000,
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function writeAdditionalContext(text) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'AfterTool',
        additionalContext: text,
      },
    }),
  );
}

function toolSucceeded(toolResponse) {
  if (!toolResponse || typeof toolResponse !== 'object') return true;
  if (toolResponse.error) return false;
  if (toolResponse.exit_code != null && Number(toolResponse.exit_code) !== 0) return false;
  return true;
}

/**
 * Compute the additionalContext for a tool result, if any.
 *   1. Graph augment for search-like tools (search_file_content, glob,
 *      run_shell_command-with-rg/grep) that completed successfully.
 *   2. Stale-index hint after a successful git commit/merge/rebase/cherry-
 *      pick/pull.
 * Returns null when nothing is to be appended.
 */
function buildAfterToolContext(input) {
  const cwd = input.cwd || process.cwd();
  if (!path.isAbsolute(cwd)) return null;
  const yummyGraphDir = findYummyGraphDir(cwd);
  if (!yummyGraphDir) return null;

  const toolName = input.tool_name || '';
  const toolInput = input.tool_input || {};
  const toolResponse = input.tool_response || {};
  const parts = [];

  if (toolSucceeded(toolResponse)) {
    const pattern = extractPattern(toolName, toolInput);
    if (pattern) {
      const augmentText = runAugment(yummyGraphDir, cwd, pattern);
      if (augmentText) parts.push(augmentText);
    }
  }

  if (toolName === 'run_shell_command' && toolSucceeded(toolResponse)) {
    const command = toolInput.command || '';
    if (/\bgit\s+(commit|merge|rebase|cherry-pick|pull)(\s|$)/.test(command)) {
      const hint = buildStaleIndexHint(yummyGraphDir, cwd);
      if (hint) {
        process.stderr.write(`${hint}\n`);
        parts.push(hint);
      }
    }
  }

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function runAugment(yummyGraphDir, cwd, pattern) {
  if (hasYummyGraphServerOwner(yummyGraphDir)) {
    process.stderr.write('[YummyGraph] augment skipped: MCP server owns DB\n');
    return '';
  }
  const release = acquireHookSlot(yummyGraphDir);
  if (!release) return '';
  const cliPath = resolveCliPath();
  try {
    const child = runYummyGraphCli(cliPath, ['augment', '--', pattern], cwd, 7000);
    if (!child.error && child.status === 0) {
      return extractAugmentContext(child.stderr || '');
    }
  } catch {
    /* graceful failure */
  } finally {
    release();
  }
  return '';
}

function buildStaleIndexHint(yummyGraphDir, cwd) {
  let currentHead = '';
  try {
    const headResult = spawnSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf-8',
      timeout: 3000,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    currentHead = (headResult.stdout || '').trim();
  } catch {
    return '';
  }
  if (!currentHead) return '';

  let lastCommit = '';
  let hadEmbeddings = false;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(yummyGraphDir, 'meta.json'), 'utf-8'));
    lastCommit = meta.lastCommit || '';
    hadEmbeddings = meta.stats && meta.stats.embeddings > 0;
  } catch {
    /* no meta — treat as stale */
  }

  if (currentHead === lastCommit) return '';

  const analyzeCmd = formatAnalyzeCommand({ embeddings: hadEmbeddings });
  return (
    `[YummyGraph] index is stale (last indexed: ${lastCommit ? lastCommit.slice(0, 7) : 'never'}). ` +
    `Run \`${analyzeCmd}\` to refresh the knowledge graph.`
  );
}

function handleAfterTool(input) {
  const context = buildAfterToolContext(input);
  if (context) writeAdditionalContext(context);
}

const handlers = {
  AfterTool: handleAfterTool,
};

function main() {
  try {
    const input = readInput();
    const handler = handlers[input.hook_event_name || ''];
    if (handler) handler(input);
  } catch (err) {
    if (process.env.YUMMYGRAPH_DEBUG) {
      console.error('YummyGraph antigravity hook error:', (err.message || '').slice(0, 200));
    }
  }
}

main();
