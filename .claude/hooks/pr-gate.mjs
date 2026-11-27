#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (matcher: Bash). Blocks `gh pr create` unless the
 * delivery evidence for the current HEAD is in place:
 *
 *   .delivery/verify.md  has a line  `Overall: PASS`
 *   .delivery/review.md  has a line  `Verdict: APPROVE`
 *   both have a line `Commit: <sha>` equal to `git rev-parse HEAD`
 *   the working tree is clean
 *
 * Mentions inside quoted strings or heredoc bodies (a commit message, say) are
 * ignored, unless the command runs a string as shell code (`bash -c`, `eval`).
 *
 * Exit 2 blocks the tool call (stderr goes to Claude); exit 0 allows.
 * Bypass for non-feature PRs: LAMBCHOMP_ALLOW_UNGATED_PR=1 (prints a warning).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PR_CREATE = /\bgh\s+pr\s+(create|new)\b/;
const SHELL_STRING = /\b(?:ba|z|da)?sh\s+-\w*c\b|\beval\b/;

/**
 * The command with heredoc bodies and quoted strings blanked out, so text that
 * only mentions `gh pr create` (a commit message, a file written with a heredoc)
 * does not trip the gate. When the command runs a string as shell code
 * (`bash -c "…"`, `eval`), strings are kept: they may be the real command.
 */
function codeOnly(cmd) {
  if (SHELL_STRING.test(cmd)) return cmd;
  return cmd
    .replace(/(?<!<)<<-?[ \t]*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$|\))/g, '<<HEREDOC')
    .replace(/'[^']*'|"(?:\\[\s\S]|[^"\\])*"/g, "''");
}

let raw = '';
try {
  raw = readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let input;
try {
  input = JSON.parse(raw);
} catch {
  process.exit(0); // not our business; never break unrelated tool calls
}

const command = input?.tool_input?.command;
if (input?.tool_name !== 'Bash' || typeof command !== 'string' || !PR_CREATE.test(codeOnly(command))) {
  process.exit(0);
}

if (process.env.LAMBCHOMP_ALLOW_UNGATED_PR === '1') {
  process.stderr.write(
    'pr-gate: WARNING: LAMBCHOMP_ALLOW_UNGATED_PR=1, allowing `gh pr create` without verify/review evidence.\n',
  );
  process.exit(0);
}

const block = (problems) => {
  const checked = top ?? cwd;
  process.stderr.write(
    'pr-gate: blocked `gh pr create`. Missing delivery evidence:\n' +
      problems.map((p) => `  - ${p}\n`).join('') +
      `Checked: ${checked} (the session's working directory; a \`cd\` inside the command is not followed).\n` +
      'If the run lives in a worktree, switch the session into it (EnterWorktree with its path) and retry.\n' +
      'Otherwise run verification and review for the current HEAD first.\n' +
      'For non-feature PRs only, set LAMBCHOMP_ALLOW_UNGATED_PR=1.\n',
  );
  process.exit(2);
};

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const cwd = typeof input.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
let top = null;
let head;
try {
  top = git(['rev-parse', '--show-toplevel'], cwd);
  head = git(['rev-parse', 'HEAD'], top);
} catch {
  block([`${cwd} is not inside a git repository with a commit`]);
}

const problems = [];

function readEvidence(name) {
  try {
    return readFileSync(join(top, '.delivery', name), 'utf8');
  } catch {
    problems.push(`.delivery/${name} not found`);
    return null;
  }
}

/** Value of the `Key: value` lines (ignores leading markdown like "- " or "**"). */
function values(text, key) {
  const re = new RegExp(`^[\\s>*_\\-]*${key}:[*_]*\\s*(\\S+?)[*_\`]*\\s*$`, 'gim');
  return [...text.matchAll(re)].map((m) => m[1].replace(/^`|`$/g, ''));
}

function requireMarker(name, text, key, want) {
  const found = values(text, key);
  if (found.length === 0) problems.push(`.delivery/${name} has no "${key}: ${want}" line`);
  else if (found.some((v) => v !== want)) problems.push(`.delivery/${name} says "${key}: ${found.join(', ')}", need "${key}: ${want}"`);
}

function requireCommit(name, text) {
  const found = values(text, 'Commit');
  if (found.length === 0) problems.push(`.delivery/${name} has no "Commit: <sha>" line`);
  else if (found.some((v) => v.toLowerCase() !== head)) {
    problems.push(`.delivery/${name} is stale: Commit ${found.join(', ')} != HEAD ${head}`);
  }
}

const verify = readEvidence('verify.md');
if (verify !== null) {
  requireMarker('verify.md', verify, 'Overall', 'PASS');
  requireCommit('verify.md', verify);
}
const review = readEvidence('review.md');
if (review !== null) {
  requireMarker('review.md', review, 'Verdict', 'APPROVE');
  requireCommit('review.md', review);
}

try {
  const dirty = git(['status', '--porcelain'], top);
  if (dirty) {
    const lines = dirty.split('\n');
    problems.push(`working tree is not clean (${lines.length} change(s), e.g. ${lines.slice(0, 3).map((l) => l.trim()).join('; ')})`);
  }
} catch (e) {
  problems.push(`could not read git status: ${e.message}`);
}

if (problems.length) block(problems);
process.exit(0);
