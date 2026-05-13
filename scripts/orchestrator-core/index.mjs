/**
 * orchestrator-core/index.mjs — Generic orchestration engine.
 *
 * Exports a single `runOrchestrator(config, cliOptions)` function that runs
 * the full task execution loop. All project-specific values come through
 * the config parameter.
 */

import { createInterface } from 'node:readline';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

import { parseTasks, topoSort } from './task-parser.mjs';
import { createProgressManager } from './progress.mjs';
import { createLinearClient } from './linear.mjs';
import { runTaskPerformer, runGenerate, runVerification, runQAReviewer, PromptTooLongError } from './runner.mjs';
import { createWorktreeManager } from './worktree.mjs';

export { PromptTooLongError };

export class HaltError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HaltError';
  }
}

// ─── Prompt helper ────────────────────────────────────────────────────────────

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function getCurrentBranch(repoRoot) {
  return execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim();
}

function branchExists(name, repoRoot) {
  try {
    execSync(`git rev-parse --verify "${name}"`, { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function hasUncommittedChanges(repoRoot) {
  const status = execSync('git status --porcelain', { cwd: repoRoot, encoding: 'utf-8' }).trim();
  return status.length > 0;
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
    .replace(/-$/, '');
}

function branchMatchesTask(branch, taskId, issue) {
  const lower = branch.toLowerCase();
  if (issue?.identifier && lower.includes(issue.identifier.toLowerCase())) return true;
  if (lower.includes(`task-${taskId}`) || lower.includes(`/${taskId}`)) return true;
  return false;
}

// ─── Progress file patching ───────────────────────────────────────────────────

function patchProgressFile(progressPath, patches) {
  let content = readFileSync(progressPath, 'utf-8');

  if (patches.status) {
    content = content.replace(/^\*\*Status:\*\*\s*.+$/m, `**Status:** ${patches.status}`);
  }

  content = content.replace(
    /^\*\*Updated:\*\*\s*.+$/m,
    `**Updated:** ${new Date().toISOString()}`
  );

  if (patches.verification) {
    const { command, exitCode, stdout, stderr } = patches.verification;
    const output = [stdout, stderr].filter(Boolean).join('\n').trim() || '(no output)';
    const section =
      `**Command:** \`${command}\`\n` +
      `**Exit Code:** ${exitCode}\n` +
      `**Output:**\n\`\`\`\n${output}\n\`\`\``;
    content = content.replace(
      /^## Verification\n[\s\S]*?(?=\n## QA Review\b|\n*$)/m,
      `## Verification\n${section}\n`
    );
  }

  if (patches.qa) {
    const section =
      `**Status:** ${patches.qa.status}\n` +
      `**Notes:** ${patches.qa.findings}`;
    content = content.replace(
      /^## QA Review\n[\s\S]*?(?=\n## Blockers\b|\n*$)/m,
      `## QA Review\n${section}\n`
    );
  }

  if (patches.blockers) {
    content = content.replace(
      /^## Blockers\n[\s\S]*$/m,
      `## Blockers\n${patches.blockers}\n`
    );
  }

  writeFileSync(progressPath, content, 'utf-8');
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

/**
 * Run the full orchestration loop.
 *
 * @param {object} config           All project-specific configuration
 * @param {object} cliOptions       CLI flags
 * @param {string} [cliOptions.task]      Single task ID to run
 * @param {number} [cliOptions.milestone] Max milestone to run
 * @param {boolean} [cliOptions.dryRun]   Dry run mode
 * @param {boolean} [cliOptions.serial]   Force serial execution
 */
export async function runOrchestrator(config, cliOptions = {}) {
  const {
    projectName,
    repoRoot,
    planPath,
    progressBase,
    milestoneTasks,
    milestoneLinearIds,
    milestoneNames,
    linearTeamKey,
    linearTitlePrefix,
    codegenPackages,
    taskPerformerSystemPrompt,
    qaReviewerSystemPrompt,
    performerAllowedTools,
    qaAllowedTools,
    prBaseBranch,
    worktreePrefix,
    envPrefix,
    commitPrefix,
  } = config;

  const SINGLE_TASK = cliOptions.task ?? null;
  const DRY_RUN = cliOptions.dryRun ?? false;
  const SERIAL_MODE = cliOptions.serial ?? false;
  const MAX_MILESTONE = cliOptions.milestone ?? null;
  const MAX_PARALLEL = parseInt(process.env[`${envPrefix}_MAX_PARALLEL`] ?? '3', 10);

  // Create sub-managers
  const progress = createProgressManager({ progressBase, milestoneTasks });
  const linear = createLinearClient({ teamKey: linearTeamKey, titlePrefix: linearTitlePrefix });
  const worktrees = createWorktreeManager({ repoRoot, worktreePrefix, commitPrefix });

  // Runner options
  const performerOpts = { systemPrompt: taskPerformerSystemPrompt, allowedTools: performerAllowedTools };
  const qaOpts = { systemPrompt: qaReviewerSystemPrompt, allowedTools: qaAllowedTools };

  // ─── Codegen detection ──────────────────────────────────────────────────────

  function detectCodegenNeeded(changedFiles) {
    const result = [];
    for (const { pkg, patterns } of codegenPackages) {
      const needed = changedFiles.some(f =>
        f.startsWith(pkg + '/') && patterns.some(p => f.includes(p))
      );
      if (needed) result.push(pkg);
    }
    return result;
  }

  // ─── Linear helpers ─────────────────────────────────────────────────────────

  async function safeLinearUpdate(issueId, stateId, label) {
    if (!issueId || !stateId || DRY_RUN) return;
    try {
      await linear.updateIssueState(issueId, stateId);
    } catch (err) {
      console.warn(`  [linear] WARN: could not update to ${label}: ${err.message}`);
    }
  }

  // ─── Branch management ──────────────────────────────────────────────────────

  async function ensureMilestoneBranch(milestoneNum) {
    if (DRY_RUN) return;

    const linearId = milestoneLinearIds[milestoneNum] ?? '';
    const suggested = linearId
      ? `${linearId.toLowerCase()}-${worktreePrefix}-milestone-${milestoneNum}`
      : `${worktreePrefix}/milestone-${milestoneNum}`;

    const current = getCurrentBranch(repoRoot);

    if (current.toLowerCase().includes(`milestone-${milestoneNum}`) ||
        (linearId && current.toLowerCase().includes(linearId.toLowerCase()))) {
      console.log(`Branch: ${current} (matches milestone ${milestoneNum})\n`);
      return;
    }

    console.log(`\n  Current branch: ${current}`);
    console.log(`  Running milestone ${milestoneNum} — all tasks will use a single branch.\n`);
    console.log(`  Options:`);
    console.log(`    [c] Create and switch to: ${suggested}`);
    if (branchExists(suggested, repoRoot)) {
      console.log(`         (branch already exists — will switch to it)`);
    }
    console.log(`    [k] Keep current branch (${current})`);

    const answer = await prompt('\n  Choice (c/k): ');

    if (answer.toLowerCase() === 'c') {
      if (hasUncommittedChanges(repoRoot)) {
        console.log('  Stashing uncommitted changes...');
        execSync(`git stash push -m "${worktreePrefix}-orchestrator: auto-stash before milestone branch"`, { cwd: repoRoot });
      }
      if (branchExists(suggested, repoRoot)) {
        execSync(`git checkout "${suggested}"`, { cwd: repoRoot, stdio: 'inherit' });
      } else {
        execSync(`git checkout -b "${suggested}"`, { cwd: repoRoot, stdio: 'inherit' });
      }
      console.log(`  Switched to: ${suggested}\n`);
    } else {
      console.log(`  Keeping: ${current}\n`);
    }
  }

  async function ensureTaskBranch(task, issue) {
    if (DRY_RUN || MAX_MILESTONE !== null) return;

    const current = getCurrentBranch(repoRoot);

    if (branchMatchesTask(current, task.id, issue)) {
      console.log(`  Branch: ${current} (matches task)`);
      return;
    }

    const slug = slugify(task.title);
    const suggested = issue?.identifier
      ? `${issue.identifier.toLowerCase()}-${slug}`
      : `${worktreePrefix}/task-${task.id}-${slug}`;

    console.log(`\n  Current branch: ${current}`);
    console.log(`  This doesn't appear to relate to task ${task.id}${issue ? ` (${issue.identifier})` : ''}.`);
    console.log(`\n  Options:`);
    console.log(`    [c] Create and switch to: ${suggested}`);
    if (branchExists(suggested, repoRoot)) {
      console.log(`         (branch already exists — will switch to it)`);
    }
    console.log(`    [s] Switch to an existing branch (you'll type the name)`);
    console.log(`    [k] Keep current branch (${current})`);

    const answer = await prompt('\n  Choice (c/s/k): ');

    if (answer.toLowerCase() === 'c') {
      if (hasUncommittedChanges(repoRoot)) {
        console.log('  Stashing uncommitted changes...');
        execSync(`git stash push -m "${worktreePrefix}-orchestrator: auto-stash before branch switch"`, { cwd: repoRoot });
      }
      if (branchExists(suggested, repoRoot)) {
        execSync(`git checkout "${suggested}"`, { cwd: repoRoot, stdio: 'inherit' });
      } else {
        execSync(`git checkout -b "${suggested}"`, { cwd: repoRoot, stdio: 'inherit' });
      }
      console.log(`  Switched to: ${suggested}`);
    } else if (answer.toLowerCase() === 's') {
      const branchName = await prompt('  Branch name: ');
      if (!branchName) {
        console.log('  No branch name provided. Keeping current branch.');
        return;
      }
      if (hasUncommittedChanges(repoRoot)) {
        console.log('  Stashing uncommitted changes...');
        execSync(`git stash push -m "${worktreePrefix}-orchestrator: auto-stash before branch switch"`, { cwd: repoRoot });
      }
      if (branchExists(branchName, repoRoot)) {
        execSync(`git checkout "${branchName}"`, { cwd: repoRoot, stdio: 'inherit' });
      } else {
        execSync(`git checkout -b "${branchName}"`, { cwd: repoRoot, stdio: 'inherit' });
      }
      console.log(`  Switched to: ${branchName}`);
    } else {
      console.log(`  Keeping branch: ${current}`);
    }
  }

  // ─── PR creation ────────────────────────────────────────────────────────────

  async function createMilestonePR(milestoneNum, passed) {
    const branch = getCurrentBranch(repoRoot);
    const milestoneName = milestoneNames[milestoneNum] ?? `Milestone ${milestoneNum}`;

    const issueRefs = passed
      .filter(({ issue }) => issue?.identifier)
      .map(({ task, issue }) => `- ${issue.identifier}: ${task.title}`)
      .join('\n');

    const taskSummaries = passed.map(({ task }) => {
      const prog = progress.readProgress(task.id);
      const summary = prog?.raw?.match(/## Implementation Summary\n([\s\S]*?)(?=\n## |$)/)?.[1]?.trim() ?? '(no summary)';
      return `### Task ${task.id}: ${task.title}\n${summary}`;
    }).join('\n\n');

    const prTitle = `${linearTitlePrefix} Milestone ${milestoneNum}: ${milestoneName}`;

    const prBody = `## Resolves
${issueRefs}

## Description
${projectName} — Milestone ${milestoneNum}: ${milestoneName}

${taskSummaries}

## Type of Change
- New feature

## Checklist
- [x] Tested the change locally (automated QA per task)
- [ ] Added/adjusted relevant Unit testing
- [ ] Added/adjusted relevant documentation
`;

    console.log('\n  Committing all changes...');
    try {
      execSync('git add -A', { cwd: repoRoot, stdio: 'inherit' });
      const commitMsg = `${commitPrefix}: Milestone ${milestoneNum} — ${milestoneName}\n\nTasks: ${passed.map(({ task }) => task.id).join(', ')}`;
      execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: repoRoot, stdio: 'inherit' });
    } catch (err) {
      console.warn('  [git] WARN: commit failed (maybe nothing to commit)');
    }

    console.log('  Pushing branch...');
    try {
      execSync(`git push -u origin "${branch}"`, { cwd: repoRoot, stdio: 'inherit' });
    } catch (err) {
      console.error(`  [git] ERROR: push failed: ${err.message}`);
      return;
    }

    console.log('\n── PR Preview ──────────────────────────────────────────────');
    console.log(`Title: ${prTitle}\n`);
    console.log(prBody);
    console.log('───────────────────────────────────────────────────────────\n');

    const prAnswer = await prompt('Create PR with this description? (y/e/N) [e = edit title & description]: ');

    if (prAnswer.toLowerCase() === 'n' || !prAnswer.trim()) {
      console.log('  PR not created. Branch has been pushed — create it manually.');
      return;
    }

    let finalTitle = prTitle;
    let finalBody = prBody;

    if (prAnswer.toLowerCase() === 'e') {
      const newTitle = await prompt(`  Title [${prTitle}]: `);
      if (newTitle.trim()) finalTitle = newTitle.trim();

      console.log('  Enter new body (end with a line containing only "EOF"):');
      const bodyLines = [];
      let line;
      while ((line = await prompt('')) !== 'EOF') {
        bodyLines.push(line);
      }
      if (bodyLines.length > 0) finalBody = bodyLines.join('\n');
    }

    console.log('  Creating PR...');
    try {
      const finalBodyEscaped = finalBody.replace(/'/g, "'\\''");
      const result = execSync(
        `gh pr create --title '${finalTitle.replace(/'/g, "'\\''")}' --body '${finalBodyEscaped}' --base ${prBaseBranch}`,
        { cwd: repoRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log(`  PR created: ${result.trim()}`);
    } catch (err) {
      console.error(`  [gh] ERROR: PR creation failed: ${err.stderr ?? err.message}`);
      console.log('  You can create the PR manually. The branch has been pushed.');
    }
  }

  // ─── Parallel batch runner ──────────────────────────────────────────────────

  async function runPerformerInWorktree(task, { issueMap, inProgressStateId }) {
    const progressPath = progress.getProgressPath(task.id);
    const issueKey = `task ${task.id}: ${task.title}`.trim().toLowerCase();
    const issue = issueMap.get(issueKey);

    const baseBranch = getCurrentBranch(repoRoot);
    let worktreePath, branchName;

    try {
      ({ worktreePath, branchName } = worktrees.createWorktree(task.id, baseBranch));
    } catch (err) {
      return { task, issue, worktreePath: null, branchName: null, error: err };
    }

    const existing = progress.readProgress(task.id);
    const started = existing?.started ?? new Date().toISOString();

    await safeLinearUpdate(issue?.id, inProgressStateId, 'In Progress');

    progress.writeProgress(task.id, {
      title: task.title,
      status: 'in-progress',
      attempt: 1,
      started,
      summary: '(pending — performer will fill this in)',
      filesChanged: [],
      verification: null,
      qa: null,
      blockers: null,
    });

    console.log(`  [wt:${task.id}] Performer starting in worktree...`);
    try {
      await runTaskPerformer(task, 1, progressPath, { cwd: worktreePath, ...performerOpts });

      const sha = worktrees.commitWorktreeChanges(worktreePath, task.id, task.title);
      if (!sha) {
        console.log(`  [wt:${task.id}] Performer made no changes`);
      } else {
        console.log(`  [wt:${task.id}] Performer done, committed ${sha.slice(0, 8)}`);
      }

      return { task, issue, worktreePath, branchName, error: null };
    } catch (err) {
      return { task, issue, worktreePath, branchName, error: err };
    }
  }

  async function runBatchParallel(tasks, { issueMap, inProgressStateId, doneStateId, doneIds, milestoneNewlyPassed }) {
    const taskCount = tasks.length;
    console.log(`\n  ── Running ${taskCount} tasks in parallel (worktrees, max ${MAX_PARALLEL} concurrent)...`);

    const results = [];
    for (let i = 0; i < taskCount; i += MAX_PARALLEL) {
      const chunk = tasks.slice(i, i + MAX_PARALLEL);
      const chunkResults = await Promise.allSettled(
        chunk.map(task => runPerformerInWorktree(task, { issueMap, inProgressStateId }))
      );
      results.push(...chunkResults);
    }

    const targetBranch = getCurrentBranch(repoRoot);
    const merged = [];
    const failed = [];

    let didStash = false;
    if (hasUncommittedChanges(repoRoot)) {
      console.log('  Stashing uncommitted changes before merge phase...');
      execSync(`git stash push -m "${worktreePrefix}-orchestrator: auto-stash before cherry-pick merge"`, { cwd: repoRoot, stdio: 'pipe' });
      didStash = true;
    }

    for (const result of results) {
      if (result.status === 'rejected') {
        failed.push({ task: null, error: result.reason });
        continue;
      }

      const { task, issue, worktreePath, branchName, error } = result.value;

      if (error) {
        console.error(`  [wt:${task.id}] Performer failed: ${error.message}`);
        const progressPath = progress.getProgressPath(task.id);
        patchProgressFile(progressPath, {
          status: 'blocked',
          blockers: `Performer failed: ${error.message}`,
        });
        failed.push({ task, error });
        if (worktreePath) worktrees.removeWorktree(worktreePath, branchName);
        continue;
      }

      console.log(`  [wt:${task.id}] Merging changes...`);
      const mergeResult = worktrees.mergeWorktreeTask(branchName, targetBranch);
      worktrees.removeWorktree(worktreePath, branchName);

      if (!mergeResult.success) {
        console.error(`  [wt:${task.id}] Merge failed: ${mergeResult.error}`);
        const progressPath = progress.getProgressPath(task.id);
        patchProgressFile(progressPath, {
          status: 'blocked',
          blockers: `Cherry-pick merge failed: ${mergeResult.error}`,
        });
        failed.push({ task, error: new Error(mergeResult.error) });
        continue;
      }

      if (mergeResult.commitSha) {
        console.log(`  [wt:${task.id}] Merged (${mergeResult.commitSha.slice(0, 8)})`);
      } else {
        console.log(`  [wt:${task.id}] Merged (no changes)`);
      }
      merged.push({ task, issue, commitSha: mergeResult.commitSha });
    }

    if (didStash) {
      console.log('  Restoring stashed changes...');
      try {
        execSync('git stash pop', { cwd: repoRoot, stdio: 'pipe' });
      } catch (err) {
        console.warn('  [git] WARN: stash pop had conflicts — may need manual resolution');
        console.warn(`  ${err.message?.slice(-300)}`);
      }
    }

    if (merged.length === 0) {
      return { passed: [], failed };
    }

    // Phase 3: Codegen
    const mergedWithCommits = merged.filter(m => m.commitSha);
    const mergedNoCommits = merged.filter(m => !m.commitSha);

    // Auto-pass tasks where performer made no changes (nothing to verify)
    for (const { task, issue } of mergedNoCommits) {
      const progressPath = progress.getProgressPath(task.id);
      const m = progress.milestoneOf(task.id) ?? 0;
      console.log(`\n  ── Task ${task.id}: no changes — auto-pass`);
      patchProgressFile(progressPath, {
        status: 'pass',
        qa: { status: 'PASS', findings: 'No changes made by performer — auto-passed (no commit to verify)' },
      });
      doneIds.add(task.id);
      if (!milestoneNewlyPassed.has(m)) milestoneNewlyPassed.set(m, []);
      milestoneNewlyPassed.get(m).push({ task, issue });
    }

    if (mergedWithCommits.length === 0) {
      return { passed: mergedNoCommits, failed };
    }

    const changedFiles = execSync(`git diff --name-only HEAD~${mergedWithCommits.length}..HEAD`, {
      cwd: repoRoot,
      encoding: 'utf-8',
    }).trim().split('\n');

    const codegenPkgs = detectCodegenNeeded(changedFiles);
    let codegenFailed = false;

    for (const pkg of codegenPkgs) {
      console.log(`  Running yarn generate in ${pkg} (schema/graphql changes detected)...`);
      const genResult = await runGenerate(pkg, { repoRoot });
      if (genResult.exitCode !== 0) {
        console.error(`  [generate] FAIL in ${pkg}: exit code ${genResult.exitCode}`);
        if (genResult.stderr) console.error(`  ${genResult.stderr.slice(-500)}`);
        codegenFailed = true;
      } else {
        console.log(`  ${pkg} generate complete`);
      }
    }

    if (codegenFailed) {
      for (const { task } of mergedWithCommits) {
        const progressPath = progress.getProgressPath(task.id);
        patchProgressFile(progressPath, {
          status: 'blocked',
          blockers: 'Codegen (yarn generate) failed — verification skipped to avoid stale type errors',
        });
        failed.push({ task, error: new Error('Codegen failed') });
      }
      return { passed: [], failed };
    }

    // Phase 4: Verification + QA (only for tasks that produced commits)
    const passed = [...mergedNoCommits];

    for (const { task, issue, commitSha } of mergedWithCommits) {
      const progressPath = progress.getProgressPath(task.id);
      const qaReviewPath = progress.getQAReviewPath(task.id);
      const m = progress.milestoneOf(task.id) ?? 0;

      console.log(`\n  ── Verify+QA: Task ${task.id}`);

      console.log(`  Verifying: ${task.verificationCommand}`);
      const verifyResult = await runVerification(task, { cwd: repoRoot });
      console.log(`  Exit code: ${verifyResult.exitCode}`);

      patchProgressFile(progressPath, {
        verification: {
          command: task.verificationCommand,
          exitCode: verifyResult.exitCode,
          stdout: verifyResult.stdout,
          stderr: verifyResult.stderr,
        },
      });

      // Get commit-scoped diff for QA (so it reviews actual changes, not working directory)
      let commitDiff = '';
      if (commitSha) {
        try {
          commitDiff = execSync(`git diff ${commitSha}~1..${commitSha} --stat`, {
            cwd: repoRoot,
            encoding: 'utf-8',
          }).trim();
        } catch { /* best effort */ }
      }

      console.log('  Running QA reviewer...');
      let qa = { status: 'pass', findings: '(skipped)' };
      try {
        qa = await runQAReviewer(task, verifyResult, progressPath, qaReviewPath, { cwd: repoRoot, commitDiff, ...qaOpts });
      } catch (err) {
        if (err instanceof PromptTooLongError) {
          console.error(`  [qa] FATAL: ${err.message}`);
          patchProgressFile(progressPath, { status: 'blocked', blockers: err.message });
          failed.push({ task, error: err });
          continue;
        }
        console.error(`  [qa] ERROR: ${err.message}`);
        qa = { status: 'fail', findings: `QA reviewer error: ${err.message}` };
      }
      console.log(`  QA: ${qa.status.toUpperCase()}`);
      console.log(`  QA review file: ${qaReviewPath}`);

      patchProgressFile(progressPath, {
        qa: { status: qa.status.toUpperCase(), findings: qa.findings },
      });

      if (qa.status === 'pass') {
        patchProgressFile(progressPath, { status: 'pass' });
        doneIds.add(task.id);
        if (!milestoneNewlyPassed.has(m)) milestoneNewlyPassed.set(m, []);
        milestoneNewlyPassed.get(m).push({ task, issue });
        passed.push({ task, issue });
        console.log(`  Task ${task.id} PASS`);
      } else {
        console.log(`  Findings: ${qa.findings}`);
        patchProgressFile(progressPath, { status: 'blocked', blockers: qa.findings });
        failed.push({ task, error: new Error(`QA failed: ${qa.findings}`) });
      }
    }

    return { passed, failed };
  }

  // ─── Serial task runner ─────────────────────────────────────────────────────

  async function runTask(task, { issueMap, inProgressStateId }) {
    const progressPath = progress.getProgressPath(task.id);
    const qaReviewPath = progress.getQAReviewPath(task.id);
    const issueKey = `task ${task.id}: ${task.title}`.trim().toLowerCase();
    const issue = issueMap.get(issueKey);

    if (!issue) {
      console.warn(`  [linear] WARN: no Linear issue found for task ${task.id} ("${task.title}")`);
    }

    await ensureTaskBranch(task, issue);

    const existing = progress.readProgress(task.id);
    const started = existing?.started ?? new Date().toISOString();

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`\n  ── Attempt ${attempt}/3`);

      await safeLinearUpdate(issue?.id, inProgressStateId, 'In Progress');

      progress.writeProgress(task.id, {
        title: task.title,
        status: 'in-progress',
        attempt,
        started,
        summary: '(pending — performer will fill this in)',
        filesChanged: [],
        verification: null,
        qa: null,
        blockers: null,
      });

      console.log('  Running task performer...');
      if (!DRY_RUN) {
        try {
          await runTaskPerformer(task, attempt, progressPath, { cwd: repoRoot, ...performerOpts });
        } catch (err) {
          if (err instanceof PromptTooLongError) {
            console.error(`  [performer] FATAL: ${err.message}`);
            patchProgressFile(progressPath, { status: 'blocked', blockers: err.message });
            throw new HaltError(`Task ${task.id} blocked: prompt too long for performer agent`);
          }
          console.error(`  [performer] ERROR: ${err.message}`);
          patchProgressFile(progressPath, {
            status: 'in-progress',
            blockers: `Performer agent error on attempt ${attempt}: ${err.message}`,
          });
          if (attempt < 3) continue;
          patchProgressFile(progressPath, { status: 'blocked' });
          throw new HaltError(`Task ${task.id} blocked: performer failed on all 3 attempts`);
        }
      } else {
        console.log('  [dry-run] skipping performer');
      }

      // Codegen
      if (!DRY_RUN) {
        const changedFiles = execSync('git diff --name-only HEAD~1..HEAD', { cwd: repoRoot, encoding: 'utf-8' }).trim().split('\n');
        const codegenPkgs = detectCodegenNeeded(changedFiles);
        let codegenFailed = false;

        for (const pkg of codegenPkgs) {
          console.log(`  Running yarn generate in ${pkg} (schema/graphql changes detected)...`);
          const genResult = await runGenerate(pkg, { repoRoot });
          if (genResult.exitCode !== 0) {
            console.error(`  [generate] FAIL in ${pkg}: exit code ${genResult.exitCode}`);
            if (genResult.stderr) console.error(`  ${genResult.stderr.slice(-500)}`);
            codegenFailed = true;
          } else {
            console.log(`  ${pkg} generate complete`);
          }
        }

        if (codegenFailed) {
          patchProgressFile(progressPath, {
            status: 'in-progress',
            blockers: `Codegen (yarn generate) failed on attempt ${attempt}`,
          });
          if (attempt < 3) {
            console.log('  Codegen failed — retrying...');
            continue;
          }
          patchProgressFile(progressPath, { status: 'blocked' });
          throw new HaltError(`Task ${task.id} BLOCKED: codegen failed on all 3 attempts`);
        }
      }

      // Verification
      console.log(`  Verifying: ${task.verificationCommand}`);
      let verifyResult = { exitCode: 0, stdout: '(dry-run)', stderr: '' };
      if (!DRY_RUN) {
        verifyResult = await runVerification(task, { cwd: repoRoot });
      }
      console.log(`  Exit code: ${verifyResult.exitCode}`);

      patchProgressFile(progressPath, {
        verification: {
          command: task.verificationCommand,
          exitCode: verifyResult.exitCode,
          stdout: verifyResult.stdout,
          stderr: verifyResult.stderr,
        },
      });

      // QA
      console.log('  Running QA reviewer...');
      let qa = { status: 'pass', findings: '(dry-run)' };
      if (!DRY_RUN) {
        try {
          qa = await runQAReviewer(task, verifyResult, progressPath, qaReviewPath, { cwd: repoRoot, ...qaOpts });
        } catch (err) {
          if (err instanceof PromptTooLongError) {
            console.error(`  [qa] FATAL: ${err.message}`);
            patchProgressFile(progressPath, { status: 'blocked', blockers: err.message });
            throw new HaltError(`Task ${task.id} blocked: prompt too long for QA reviewer`);
          }
          console.error(`  [qa] ERROR: ${err.message}`);
          qa = { status: 'fail', findings: `QA reviewer error: ${err.message}` };
        }
      }
      console.log(`  QA: ${qa.status.toUpperCase()}`);
      console.log(`  QA review file: ${qaReviewPath}`);
      if (qa.status === 'fail') console.log(`  Findings: ${qa.findings}`);

      patchProgressFile(progressPath, {
        qa: { status: qa.status.toUpperCase(), findings: qa.findings },
      });

      if (qa.status === 'pass') {
        patchProgressFile(progressPath, { status: 'pass' });
        console.log(`  Task ${task.id} PASS`);
        return { status: 'pass', issue };
      }

      if (attempt === 3) {
        patchProgressFile(progressPath, { status: 'blocked' });
        throw new HaltError(
          `Task ${task.id} BLOCKED after 3 attempts.\nFindings:\n${qa.findings}`
        );
      }

      console.log('  QA failed — retrying...');
    }
  }

  // ─── Main loop ──────────────────────────────────────────────────────────────

  // Register SIGINT handler
  const sigintHandler = () => {
    console.log('\nSIGINT received — cleaning up worktrees...');
    worktrees.cleanupAllWorktrees();
    process.exit(130);
  };
  process.on('SIGINT', sigintHandler);

  try {
    const nameDisplay = projectName.length <= 40
      ? projectName.padEnd(40)
      : projectName.slice(0, 40);
    console.log('\n' + '='.repeat(62));
    console.log(`  ${nameDisplay} Orchestrator`);
    console.log('='.repeat(62) + '\n');

    if (DRY_RUN) console.log('[DRY RUN — no agents or verification will execute]\n');

    // 1. Parse task graph
    const allTasks = parseTasks(planPath);
    const batches = topoSort(allTasks);
    console.log(`Parsed ${allTasks.length} tasks across ${batches.length} topo batches.`);

    // 2. Determine which tasks to run
    let tasksToRun;
    if (SINGLE_TASK) {
      tasksToRun = allTasks.filter(t => t.id === SINGLE_TASK);
      if (tasksToRun.length === 0) {
        console.error(`ERROR: task "${SINGLE_TASK}" not found. Available: ${allTasks.map(t => t.id).join(', ')}`);
        process.exit(1);
      }
    } else if (MAX_MILESTONE !== null) {
      const allowed = new Set(
        Object.entries(milestoneTasks)
          .filter(([n]) => Number(n) <= MAX_MILESTONE)
          .flatMap(([, ids]) => [...ids])
      );
      tasksToRun = allTasks.filter(t => allowed.has(t.id));
    } else {
      tasksToRun = allTasks;
    }

    // 3. Load progress
    const progressMap = progress.loadAllProgress(allTasks.map(t => t.id));
    const doneIds = new Set(
      [...progressMap.entries()]
        .filter(([, p]) => p.status === 'pass')
        .map(([id]) => id)
    );
    const alreadyDone = tasksToRun.filter(t => doneIds.has(t.id)).length;
    console.log(`Already done: ${alreadyDone}/${tasksToRun.length} tasks.\n`);

    // 4. Connect to Linear
    let inProgressStateId = null;
    let doneStateId = null;
    let issueMap = new Map();

    if (!DRY_RUN) {
      const MAX_LINEAR_RETRIES = 2;
      for (let linearAttempt = 0; linearAttempt <= MAX_LINEAR_RETRIES; linearAttempt++) {
        console.log('Connecting to Linear...');
        try {
          const teamId = await linear.getTeamId();
          [inProgressStateId, doneStateId] = await Promise.all([
            linear.getStateId(teamId, 'In Progress'),
            linear.getStateId(teamId, 'In Review'),
          ]);
          issueMap = await linear.findIssues();
          console.log(`Linear: ${issueMap.size} issues found, states resolved.\n`);
          break;
        } catch (err) {
          console.warn(`\n[linear] ERROR: Could not connect — ${err.message}\n`);

          if (linearAttempt < MAX_LINEAR_RETRIES) {
            console.log('  Linear auth may have expired. Options:');
            console.log('    [r] Run `linear login` to refresh, then retry');
            console.log('    [s] Skip Linear integration (continue without status updates)');
            const answer = await prompt('\n  Choice (r/s): ');

            if (answer.toLowerCase() === 'r') {
              console.log('\n  Running `linear login`...\n');
              try {
                execSync('linear login', { stdio: 'inherit' });
                console.log('');
              } catch (loginErr) {
                console.warn(`  [linear] login failed: ${loginErr.message}`);
              }
              continue;
            }
          }

          console.warn('[linear] Continuing without Linear updates.\n');
          break;
        }
      }
    }

    // 5. Print plan
    const pendingTasks = tasksToRun.filter(t => !doneIds.has(t.id));
    console.log(`Tasks to run: ${pendingTasks.length}`);
    for (const t of tasksToRun) {
      const status = doneIds.has(t.id) ? 'done' : 'pending';
      const m = progress.milestoneOf(t.id);
      const mLabel = m ? `[M${m}]` : '[M?]';
      console.log(`  ${mLabel} ${String(t.id).padEnd(4)} ${t.title} — ${status}`);
    }
    console.log('');

    if (DRY_RUN) {
      console.log('Dry run complete. No tasks executed.');
      return;
    }

    // 6. Milestone branch setup
    if (MAX_MILESTONE !== null) {
      await ensureMilestoneBranch(MAX_MILESTONE);
    }

    // 7. Main loop
    let currentMilestone = null;
    const milestoneStartTime = {};
    const milestoneNewlyPassed = new Map();

    async function runMilestoneGate(m) {
      const elapsed = milestoneStartTime[m]
        ? ((Date.now() - milestoneStartTime[m]) / 1000 / 60).toFixed(1)
        : '?';
      const passed = milestoneNewlyPassed.get(m) ?? [];

      if (passed.length === 0) {
        console.log('\n' + '='.repeat(62));
        console.log(`Milestone ${m} — all tasks already completed (previous session)`);
        console.log('='.repeat(62));

        console.log('\n  Options:');
        console.log('    [c] Continue to next milestone');
        console.log('    [p] Create PR for this milestone anyway');
        const answer = await prompt('\n  Choice (c/p): ');

        if (answer.toLowerCase() !== 'p') {
          console.log('  Skipping milestone gate — continuing.\n');
          return;
        }
      } else {
        console.log('\n' + '='.repeat(62));
        console.log(`Milestone ${m} — all tasks QA-passed (${elapsed}min)`);
        console.log('='.repeat(62));
        console.log('\nReview the following tasks before approving:\n');

        for (const { task, issue } of passed) {
          const progressPath = progress.getProgressPath(task.id);
          console.log(`  Task ${task.id}: ${task.title}`);
          if (issue?.url) console.log(`    Linear: ${issue.url}`);
          console.log(`    Progress: ${progressPath}`);
        }

        console.log('\nReview the code changes (git diff, progress files, Linear issues).');
        console.log('\n  Options:');
        console.log('    [y] Approve milestone, mark tasks In Review, and create PR');
        console.log('    [d] Already done — PR was created/merged in a previous session');
        console.log('    [n] Stop and review manually');
        const answer = await prompt('\n  Choice (y/d/n): ');

        if (answer.toLowerCase() === 'd') {
          console.log('  Milestone already handled — continuing.\n');
          return;
        }

        if (answer.toLowerCase() !== 'y') {
          console.log('Milestone not approved. Stopping.');
          process.exit(0);
        }
      }

      console.log('\nMarking tasks In Review in Linear...');
      for (const { task, issue } of passed) {
        await safeLinearUpdate(issue?.id, doneStateId, 'In Review');
        console.log(`  ${task.id}: ${task.title}`);
      }

      await createMilestonePR(m, passed);
    }

    for (const batch of batches) {
      const batchTasks = batch.filter(t => tasksToRun.some(r => r.id === t.id));
      if (batchTasks.length === 0) continue;

      const firstPendingTask = batchTasks.find(t => !doneIds.has(t.id)) ?? batchTasks[0];
      const batchMilestone = progress.milestoneOf(firstPendingTask.id) ?? 0;

      if (batchMilestone !== currentMilestone && currentMilestone !== null) {
        const prevTasks = tasksToRun.filter(t => progress.milestoneOf(t.id) === currentMilestone);
        const allPrevDone = prevTasks.every(t => doneIds.has(t.id));

        if (allPrevDone) {
          await runMilestoneGate(currentMilestone);

          if (MAX_MILESTONE !== null && currentMilestone >= MAX_MILESTONE) {
            console.log(`\nReached --milestone ${MAX_MILESTONE}. Stopping.`);
            return;
          }
        }
      }

      if (batchMilestone !== currentMilestone) {
        currentMilestone = batchMilestone;
        if (!milestoneStartTime[batchMilestone]) milestoneStartTime[batchMilestone] = Date.now();
        console.log(`\n── Milestone ${batchMilestone} ────────────────────────────────────────────`);
      }

      for (const task of batchTasks.filter(t => doneIds.has(t.id))) {
        console.log(`\n  Task ${task.id}: ${task.title}`);
        console.log('  already done — skipping');
      }

      const pendingBatchTasks = batchTasks.filter(t => !doneIds.has(t.id));
      if (pendingBatchTasks.length === 0) continue;

      if (pendingBatchTasks.length === 1 || SERIAL_MODE || DRY_RUN) {
        for (const task of pendingBatchTasks) {
          const m = progress.milestoneOf(task.id) ?? 0;

          if (m !== currentMilestone) {
            if (currentMilestone !== null) {
              const prevTasks = tasksToRun.filter(t => progress.milestoneOf(t.id) === currentMilestone);
              const allPrevDone = prevTasks.every(t => doneIds.has(t.id));
              if (allPrevDone) {
                await runMilestoneGate(currentMilestone);
                if (MAX_MILESTONE !== null && currentMilestone >= MAX_MILESTONE) {
                  console.log(`\nReached --milestone ${MAX_MILESTONE}. Stopping.`);
                  return;
                }
              }
            }
            currentMilestone = m;
            if (!milestoneStartTime[m]) milestoneStartTime[m] = Date.now();
            console.log(`\n── Milestone ${m} ────────────────────────────────────────────`);
          }

          console.log(`\n  Task ${task.id}: ${task.title}`);

          try {
            const result = await runTask(task, { issueMap, inProgressStateId });
            doneIds.add(task.id);
            if (!milestoneNewlyPassed.has(m)) milestoneNewlyPassed.set(m, []);
            milestoneNewlyPassed.get(m).push({ task, issue: result.issue });
          } catch (err) {
            if (err instanceof HaltError) {
              console.error('\n' + '!'.repeat(62));
              console.error('HALT: ' + err.message);
              console.error('!'.repeat(62));
              process.exit(1);
            }
            throw err;
          }
        }
      } else {
        for (const task of pendingBatchTasks) {
          console.log(`\n  Task ${task.id}: ${task.title} — queued for parallel`);
        }

        try {
          const { passed, failed } = await runBatchParallel(
            pendingBatchTasks,
            { issueMap, inProgressStateId, doneStateId, doneIds, milestoneNewlyPassed }
          );

          if (failed.length > 0) {
            const failedIds = failed.map(f => f.task?.id ?? '?').join(', ');
            console.error('\n' + '!'.repeat(62));
            console.error(`HALT: ${failed.length} task(s) failed in parallel batch: ${failedIds}`);
            for (const { task, error } of failed) {
              if (task) console.error(`  Task ${task.id}: ${error.message}`);
            }
            console.error('!'.repeat(62));
            process.exit(1);
          }
        } catch (err) {
          console.error('\n' + '!'.repeat(62));
          console.error('HALT: Parallel batch error: ' + err.message);
          console.error('!'.repeat(62));
          process.exit(1);
        }
      }
    }

    // Gate for the final milestone
    if (currentMilestone !== null) {
      await runMilestoneGate(currentMilestone);
    }

    const total = tasksToRun.length;
    const done = tasksToRun.filter(t => doneIds.has(t.id)).length;
    console.log(`\nAll done. ${done}/${total} tasks approved and marked Done.\n`);

  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}
