/**
 * progress.mjs — Read/write per-task progress.md files.
 *
 * Files live at:
 *   {progressBase}/milestone-{n}/task-{id}/progress.md
 *
 * States: pending | in-progress | pass | blocked
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

/**
 * Create a progress manager bound to a specific base path and milestone map.
 *
 * @param {{ progressBase: string, milestoneTasks: Object<number, Set<string>> }} opts
 */
export function createProgressManager({ progressBase, milestoneTasks }) {

  function milestoneOf(taskId) {
    for (const [n, ids] of Object.entries(milestoneTasks)) {
      if (ids.has(taskId)) return Number(n);
    }
    return null;
  }

  function getProgressPath(taskId) {
    const m = milestoneOf(taskId);
    const milestoneDir = m ? `milestone-${m}` : 'unknown';
    return resolve(progressBase, milestoneDir, `task-${taskId}`, 'progress.md');
  }

  function getQAReviewPath(taskId) {
    const m = milestoneOf(taskId);
    const milestoneDir = m ? `milestone-${m}` : 'unknown';
    return resolve(progressBase, milestoneDir, `task-${taskId}`, 'qa-review.md');
  }

  function readProgress(taskId) {
    const path = getProgressPath(taskId);
    if (!existsSync(path)) return null;

    const raw = readFileSync(path, 'utf-8');
    const status = raw.match(/^\*\*Status:\*\*\s*(.+)$/m)?.[1]?.trim() ?? 'unknown';
    const attemptStr = raw.match(/^\*\*Attempt:\*\*\s*(\d+)\/\d+$/m)?.[1];
    const attempt = attemptStr ? parseInt(attemptStr, 10) : 1;
    const started = raw.match(/^\*\*Started:\*\*\s*(.+)$/m)?.[1]?.trim();

    return { status, attempt, started, raw };
  }

  function writeProgress(taskId, data) {
    const path = getProgressPath(taskId);
    mkdirSync(dirname(path), { recursive: true });

    const now = new Date().toISOString();
    const started = data.started ?? now;

    const lines = [
      `# Task ${taskId}: ${data.title}`,
      '',
      `**Status:** ${data.status}`,
      `**Attempt:** ${data.attempt}/3`,
      `**Started:** ${started}`,
      `**Updated:** ${now}`,
      '',
    ];

    lines.push('## Implementation Summary');
    lines.push(data.summary ?? '(pending)');
    lines.push('');

    lines.push('## Files Changed');
    if (data.filesChanged?.length) {
      for (const f of data.filesChanged) {
        lines.push(`- ${f}`);
      }
    } else {
      lines.push('(none yet)');
    }
    lines.push('');

    lines.push('## Verification');
    if (data.verification) {
      const { command, exitCode, output } = data.verification;
      lines.push(`**Command:** \`${command}\``);
      lines.push(`**Exit Code:** ${exitCode}`);
      lines.push('**Output:**');
      lines.push('```');
      lines.push(output ?? '');
      lines.push('```');
    } else {
      lines.push('(not run yet)');
    }
    lines.push('');

    lines.push('## QA Review');
    if (data.qa) {
      lines.push(`**Status:** ${data.qa.status}`);
      lines.push(`**Notes:** ${data.qa.notes}`);
    } else {
      lines.push('(not run yet)');
    }
    lines.push('');

    lines.push('## Blockers');
    lines.push(data.blockers ?? '(none)');
    lines.push('');

    writeFileSync(path, lines.join('\n'), 'utf-8');
  }

  function loadAllProgress(taskIds) {
    const map = new Map();
    for (const id of taskIds) {
      const p = readProgress(id);
      if (p) map.set(id, p);
    }
    return map;
  }

  return {
    milestoneOf,
    getProgressPath,
    getQAReviewPath,
    readProgress,
    writeProgress,
    loadAllProgress,
  };
}
