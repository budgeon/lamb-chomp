#!/usr/bin/env node
/**
 * Exercises .claude/hooks/pr-gate.mjs with sample PreToolUse payloads against
 * throwaway git repos in os.tmpdir().  Run: node .claude/hooks/pr-gate.selftest.mjs (not *.test.* so Jest skips it)
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'pr-gate.mjs');
const temps = [];

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'pr-gate-'));
  temps.push(dir);
  const g = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  g('init', '-q');
  g('config', 'user.email', 't@example.com');
  g('config', 'user.name', 't');
  writeFileSync(join(dir, '.gitignore'), '.delivery/\n');
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  g('add', '.');
  g('commit', '-qm', 'init');
  mkdirSync(join(dir, '.delivery'));
  return { dir, g, head: g('rev-parse', 'HEAD') };
}

function evidence(dir, { verify = 'PASS', review = 'APPROVE', commit }) {
  writeFileSync(join(dir, '.delivery/verify.md'), `# Verify\n\nCommit: ${commit}\n\nOverall: ${verify}\n`);
  writeFileSync(join(dir, '.delivery/review.md'), `# Review\n\n- Commit: \`${commit}\`\n- **Verdict:** ${review}\n`);
}

function run(cwd, command, env = {}) {
  const payload = {
    session_id: 'test',
    transcript_path: '/dev/null',
    cwd,
    permission_mode: 'default',
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command, description: 'x' },
    tool_use_id: 'toolu_test',
  };
  const e = { ...process.env, ...env };
  if (!('LAMBCHOMP_ALLOW_UNGATED_PR' in env)) delete e.LAMBCHOMP_ALLOW_UNGATED_PR;
  return spawnSync('node', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env: e });
}

let failed = 0;
function expect(name, r, code, re) {
  const ok = r.status === code && (!re || re.test(r.stderr));
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (exit ${r.status})${ok ? '' : `\n     stderr: ${r.stderr}`}`);
}

const PR = 'gh pr create --title "x" --body "y"';

try {
  {
    const { dir } = repo();
    expect('non-PR command passes through', run(dir, 'npm test'), 0);
    expect('gh pr view passes through', run(dir, 'gh pr view 3'), 0);
    expect('no evidence blocks', run(dir, PR), 2, /verify\.md not found[\s\S]*review\.md not found/);
    expect('block names the checked directory', run(dir, PR), 2, new RegExp(`Checked: \\S*${dir.split('/').pop()}`));
    expect('block suggests entering the worktree', run(dir, PR), 2, /EnterWorktree/);
  }
  {
    const { dir, head } = repo();
    evidence(dir, { commit: head });
    expect('fresh PASS + APPROVE allows', run(dir, PR), 0);
    expect('chained command still gated and allowed', run(join(dir, '.delivery'), `git push && ${PR}`), 0);
  }
  {
    const { dir, head } = repo();
    evidence(dir, { commit: head, verify: 'FAIL' });
    expect('verify FAIL blocks', run(dir, PR), 2, /Overall: FAIL/);
  }
  {
    const { dir, head } = repo();
    evidence(dir, { commit: head, review: 'REQUEST_CHANGES' });
    expect('review not APPROVE blocks', run(dir, PR), 2, /Verdict/);
  }
  {
    const { dir, g, head } = repo();
    evidence(dir, { commit: head });
    writeFileSync(join(dir, 'b.txt'), 'b\n');
    g('add', '.');
    g('commit', '-qm', 'second');
    expect('stale evidence blocks', run(dir, PR), 2, /stale/);
  }
  {
    const { dir, head } = repo();
    evidence(dir, { commit: head });
    writeFileSync(join(dir, 'a.txt'), 'changed\n');
    expect('dirty tree blocks', run(dir, PR), 2, /not clean/);
  }
  {
    const { dir } = repo();
    expect('bypass allows with warning', run(dir, PR, { LAMBCHOMP_ALLOW_UNGATED_PR: '1' }), 0, /WARNING/);
  }
  {
    const dir = mkdtempSync(join(tmpdir(), 'pr-gate-nogit-'));
    temps.push(dir);
    expect('non-git cwd blocks', run(dir, PR), 2, /not inside a git repository/);
  }
  {
    const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8' });
    expect('garbage stdin passes through', r, 0);
  }
} finally {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} failure(s)` : '\nall pr-gate tests passed');
process.exit(failed ? 1 : 0);
