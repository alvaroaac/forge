/**
 * worktree.mjs — Git worktree lifecycle for parallel task execution.
 *
 * Each parallel task gets an isolated worktree + temporary branch.
 * After the performer finishes, changes are cherry-picked back to the
 * milestone branch on the main worktree.
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a worktree manager bound to a specific repo and prefix.
 *
 * @param {{ repoRoot: string, worktreePrefix: string, commitPrefix: string }} opts
 */
export function createWorktreeManager({ repoRoot, worktreePrefix, commitPrefix }) {
  const WORKTREE_BASE = resolve(tmpdir(), `${worktreePrefix}-worktrees`);
  const BRANCH_PREFIX = `${worktreePrefix}/wt-task-`;
  const BRANCH_GLOB = `${worktreePrefix}/wt-*`;

  function createWorktree(taskId, baseBranch) {
    const branchName = `${BRANCH_PREFIX}${taskId}-${Date.now()}`;
    const worktreePath = resolve(WORKTREE_BASE, `task-${taskId}`);

    // Clean up any stale worktree at this path
    if (existsSync(worktreePath)) {
      try {
        execSync(`git worktree remove "${worktreePath}" --force`, {
          cwd: repoRoot,
          stdio: 'ignore',
        });
      } catch {
        rmSync(worktreePath, { recursive: true, force: true });
        execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
      }
    }

    mkdirSync(WORKTREE_BASE, { recursive: true });

    execSync(
      `git worktree add "${worktreePath}" -b "${branchName}" "${baseBranch}"`,
      { cwd: repoRoot, stdio: 'pipe' }
    );

    return { worktreePath, branchName };
  }

  function commitWorktreeChanges(worktreePath, taskId, taskTitle) {
    const status = execSync('git status --porcelain', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();

    if (!status) return null;

    execSync('git add -A', { cwd: worktreePath, stdio: 'pipe' });
    execSync(
      `git commit -m "${commitPrefix}: task ${taskId} — ${taskTitle.replace(/"/g, '\\"')}"`,
      { cwd: worktreePath, stdio: 'pipe' }
    );

    return execSync('git rev-parse HEAD', {
      cwd: worktreePath,
      encoding: 'utf-8',
    }).trim();
  }

  function mergeWorktreeTask(branchName, targetBranch) {
    try {
      const commits = execSync(
        `git log "${targetBranch}..${branchName}" --format="%H" --reverse`,
        { cwd: repoRoot, encoding: 'utf-8' }
      ).trim();

      if (!commits) {
        return { success: true, commitSha: null };
      }

      const commitList = commits.split('\n').filter(Boolean);

      for (const sha of commitList) {
        execSync(`git cherry-pick "${sha}"`, {
          cwd: repoRoot,
          stdio: 'pipe',
        });
      }

      const headSha = execSync('git rev-parse HEAD', {
        cwd: repoRoot,
        encoding: 'utf-8',
      }).trim();

      return { success: true, commitSha: headSha };
    } catch (err) {
      try {
        execSync('git cherry-pick --abort', { cwd: repoRoot, stdio: 'ignore' });
      } catch { /* already clean */ }

      return {
        success: false,
        error: `Cherry-pick failed for ${branchName}: ${err.message}`,
      };
    }
  }

  function removeWorktree(worktreePath, branchName) {
    try {
      execSync(`git worktree remove "${worktreePath}" --force`, {
        cwd: repoRoot,
        stdio: 'ignore',
      });
    } catch {
      if (existsSync(worktreePath)) {
        rmSync(worktreePath, { recursive: true, force: true });
      }
      execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });
    }

    if (branchName) {
      try {
        execSync(`git branch -D "${branchName}"`, {
          cwd: repoRoot,
          stdio: 'ignore',
        });
      } catch { /* branch may not exist */ }
    }
  }

  function cleanupAllWorktrees() {
    if (!existsSync(WORKTREE_BASE)) return;

    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: repoRoot,
        encoding: 'utf-8',
      });

      const paths = output
        .split('\n')
        .filter(l => l.startsWith('worktree '))
        .map(l => l.replace('worktree ', ''))
        .filter(p => p.startsWith(WORKTREE_BASE));

      for (const p of paths) {
        try {
          execSync(`git worktree remove "${p}" --force`, {
            cwd: repoRoot,
            stdio: 'ignore',
          });
        } catch { /* best effort */ }
      }
    } catch { /* best effort */ }

    try {
      rmSync(WORKTREE_BASE, { recursive: true, force: true });
    } catch { /* best effort */ }

    execSync('git worktree prune', { cwd: repoRoot, stdio: 'ignore' });

    try {
      const branches = execSync(`git branch --list "${BRANCH_GLOB}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
      }).trim();

      for (const b of branches.split('\n').filter(Boolean)) {
        const name = b.trim();
        try {
          execSync(`git branch -D "${name}"`, { cwd: repoRoot, stdio: 'ignore' });
        } catch { /* best effort */ }
      }
    } catch { /* best effort */ }
  }

  return {
    createWorktree,
    commitWorktreeChanges,
    mergeWorktreeTask,
    removeWorktree,
    cleanupAllWorktrees,
  };
}
