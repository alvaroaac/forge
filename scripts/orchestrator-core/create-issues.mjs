/**
 * create-issues.mjs — Generic Linear issue creator for orchestrated projects.
 *
 * Parses the implementation plan, previews all issues, and creates them in
 * Linear with proper parent/child relationships and project milestones.
 *
 * Exports a single `createLinearIssues(config)` function. Project-specific
 * wrappers call it with their config (same pattern as runOrchestrator).
 *
 * Usage from a project wrapper:
 *   import { createLinearIssues } from '../orchestrator-core/create-issues.mjs';
 *   createLinearIssues({ planPath, linearTeamKey, ... });
 */

import { createInterface } from 'node:readline';
import { parseTasks, topoSort } from './task-parser.mjs';
import { createLinearClient } from './linear.mjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function buildTaskDescription(task) {
  const parts = [];
  if (task.summary) parts.push(`**Summary:** ${task.summary}`);
  if (task.verificationCommand) parts.push(`**Verification:** \`${task.verificationCommand}\``);
  if (task.relatedFiles?.length) {
    parts.push(`**Related Files:**\n${task.relatedFiles.map(f => `- \`${f}\``).join('\n')}`);
  }
  if (task.deps?.length) parts.push(`**Depends on:** ${task.deps.join(', ')}`);
  return parts.join('\n\n');
}

// ─── Preview ─────────────────────────────────────────────────────────────────

function printPreview(milestoneGroups, titlePrefix) {
  console.log('\n' + '='.repeat(62));
  console.log('  Linear Issue Preview');
  console.log('='.repeat(62) + '\n');

  let totalTasks = 0;
  for (const { milestoneNum, milestoneName, tasks } of milestoneGroups) {
    console.log(`  Milestone ${milestoneNum}: ${milestoneName}`);
    console.log(`  Parent: ${titlePrefix} Milestone ${milestoneNum} — ${milestoneName}`);
    for (const task of tasks) {
      const deps = task.deps?.length ? ` (deps: ${task.deps.join(', ')})` : '';
      console.log(`    Sub: ${titlePrefix} Task ${task.id}: ${task.title}${deps}`);
      totalTasks++;
    }
    console.log('');
  }

  const parentCount = milestoneGroups.length;
  console.log(`Total: ${parentCount} parent issues + ${totalTasks} sub-issues = ${parentCount + totalTasks} issues\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Parse the implementation plan and create Linear issues.
 *
 * @param {object} config
 * @param {string} config.planPath             Path to implementation plan markdown
 * @param {string} config.linearTeamKey        Linear team key (e.g. 'ENG')
 * @param {string} config.linearTitlePrefix    Title prefix (e.g. '[P017]')
 * @param {string} config.linearProjectName    Linear project name for milestone linking
 * @param {Record<number, string>} config.milestoneNames  Milestone number → name
 * @param {Record<number, Set<string>>} config.milestoneTasks  Milestone number → task IDs
 * @param {Record<string, string>} [config.milestoneLinearNames]  Milestone number → Linear project milestone name (if different from milestoneNames)
 * @param {string} [config.defaultStatus]      Initial workflow status (default: 'Ready for Engineering')
 * @param {boolean} [config.dryRun]            Preview only, don't create issues
 */
export async function createLinearIssues(config) {
  const {
    planPath,
    linearTeamKey,
    linearTitlePrefix,
    linearProjectName,
    milestoneNames,
    milestoneTasks,
    milestoneLinearNames,
    defaultStatus = 'Ready for Engineering',
    dryRun = false,
  } = config;

  // 1. Parse tasks from the plan
  const allTasks = parseTasks(planPath);
  console.log(`Parsed ${allTasks.length} tasks from plan.\n`);

  // 2. Group tasks by milestone
  const milestoneGroups = [];
  for (const [numStr, taskIds] of Object.entries(milestoneTasks)) {
    const milestoneNum = Number(numStr);
    const milestoneName = milestoneNames[milestoneNum] ?? `Milestone ${milestoneNum}`;
    const tasks = allTasks.filter(t => taskIds.has(t.id));
    if (tasks.length > 0) {
      milestoneGroups.push({ milestoneNum, milestoneName, tasks });
    }
  }

  // 3. Preview
  printPreview(milestoneGroups, linearTitlePrefix);

  if (dryRun) {
    console.log('[DRY RUN] No issues created.\n');
    return;
  }

  // 4. Confirm
  const answer = await prompt('Create all issues? (y/N): ');
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.\n');
    return;
  }

  // 5. Connect to Linear
  const linear = createLinearClient({ teamKey: linearTeamKey, titlePrefix: linearTitlePrefix });

  const teamId = await linear.getTeamId();
  const stateId = await linear.getStateId(teamId, defaultStatus);

  let projectId = null;
  let milestoneMap = {};
  if (linearProjectName) {
    const project = await linear.getProjectAndMilestones(linearProjectName);
    projectId = project.projectId;
    milestoneMap = project.milestoneMap;
    console.log(`\nProject: ${linearProjectName} (${projectId})`);
    console.log(`Milestones: ${Object.keys(milestoneMap).join(', ')}`);
  }

  console.log(`Team: ${linearTeamKey} (${teamId})`);
  console.log(`Status: ${defaultStatus} (${stateId})\n`);

  // 6. Create issues
  const createdIssues = [];

  for (const { milestoneNum, milestoneName, tasks } of milestoneGroups) {
    // Resolve Linear project milestone
    const linearMilestoneName = milestoneLinearNames?.[milestoneNum] ?? milestoneName;
    const projectMilestoneId = milestoneMap[linearMilestoneName] ?? null;

    if (linearProjectName && !projectMilestoneId) {
      console.warn(`  WARN: Project milestone "${linearMilestoneName}" not found. Available: ${Object.keys(milestoneMap).join(', ')}`);
    }

    // Create milestone parent issue
    const parentTitle = `${linearTitlePrefix} Milestone ${milestoneNum} — ${milestoneName}`;
    const parentDescription = `**${milestoneName}**\n\n${tasks.length} tasks in this milestone.`;

    const parentIssue = await linear.createIssue({
      title: parentTitle,
      description: parentDescription,
      stateId,
      projectId,
      projectMilestoneId,
    });
    console.log(`  Parent: ${parentIssue.identifier} — ${parentIssue.title}`);
    console.log(`    ${parentIssue.url}`);
    createdIssues.push(parentIssue);

    // Create sub-issues
    for (const task of tasks) {
      const childTitle = `${linearTitlePrefix} Task ${task.id}: ${task.title}`;
      const childIssue = await linear.createIssue({
        title: childTitle,
        description: buildTaskDescription(task),
        stateId,
        projectId,
        projectMilestoneId,
        parentId: parentIssue.id,
      });
      console.log(`    Sub: ${childIssue.identifier} — ${childIssue.title}`);
      createdIssues.push(childIssue);
    }
    console.log('');
  }

  // Summary
  console.log('='.repeat(62));
  console.log(`Done! Created ${createdIssues.length} issues.`);
  console.log('='.repeat(62) + '\n');

  return createdIssues;
}
