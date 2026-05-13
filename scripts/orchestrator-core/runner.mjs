/**
 * runner.mjs — Claude Code CLI engine for the orchestrator.
 *
 * Uses `claude -p` (print mode) instead of the Agent SDK, so it runs
 * under the user's Claude Code subscription — no API key needed.
 *
 * All functions receive config (prompts, tools, repoRoot) as parameters
 * rather than importing from a project-specific config file.
 */

import { exec, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execAsync = promisify(exec);

const VERIFICATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const GENERATE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export class PromptTooLongError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PromptTooLongError';
  }
}

// ─── Claude CLI runner ───────────────────────────────────────────────────────

function runClaude(prompt, { systemPrompt, allowedTools, permissionMode, verbose = false, cwd }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      '--output-format', 'text',
      '--permission-mode', permissionMode,
      '--allowedTools', ...allowedTools,
      '--system-prompt', systemPrompt,
      '--no-session-persistence',
      '--verbose',
    ];

    const child = spawn('claude', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (verbose) process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (verbose) process.stderr.write(text);
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn claude CLI: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const combined = (stdout + stderr).toLowerCase();
        if (combined.includes('prompt is too long')) {
          reject(new PromptTooLongError(
            `Prompt too long for claude CLI (exit ${code}). Try reducing task context.`
          ));
        } else {
          reject(new Error(
            `claude CLI exited with code ${code}\nstderr: ${stderr.slice(-2000)}`
          ));
        }
      } else {
        resolve(stdout);
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Inject --run (disable watch mode) and --minWorkers=1 --maxWorkers=3 into
 * `yarn test` commands.
 */
function limitTestWorkers(command) {
  return command.split('&&').map(segment => {
    if (!/yarn test(?:\s|$)/.test(segment)) return segment;
    if (!segment.includes('--run')) {
      segment = segment.replace(/yarn test(?=\s|$)/, 'yarn test --run');
    }
    if (!segment.includes('--maxWorkers')) {
      segment = segment.replace(/yarn test(?=\s|$)/, 'yarn test --minWorkers=1 --maxWorkers=3');
    }
    return segment;
  }).join('&&');
}

/**
 * Wraps a command to source nvm and use the package's .nvmrc before execution.
 */
export function withNvm(command) {
  return `source "$NVM_DIR/nvm.sh" 2>/dev/null && nvm use --silent 2>/dev/null; ${command}`;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Run `yarn generate` in the specified package.
 */
export async function runGenerate(pkg, { repoRoot }) {
  try {
    const { stdout, stderr } = await execAsync(withNvm('yarn generate'), {
      cwd: resolve(repoRoot, pkg),
      shell: true,
      timeout: GENERATE_TIMEOUT_MS,
      env: { ...process.env, CI: 'true' },
    });
    return { exitCode: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message,
    };
  }
}

/**
 * Run the task's verification command directly via exec.
 */
export async function runVerification(task, { cwd }) {
  try {
    const command = withNvm(limitTestWorkers(task.verificationCommand));
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      shell: true,
      timeout: VERIFICATION_TIMEOUT_MS,
      env: { ...process.env, CI: 'true' },
    });
    return { exitCode: 0, stdout: stdout ?? '', stderr: stderr ?? '' };
  } catch (err) {
    if (err.killed || err.signal === 'SIGTERM') {
      return {
        exitCode: 1,
        stdout: err.stdout ?? '',
        stderr: `[TIMEOUT] Verification exceeded ${VERIFICATION_TIMEOUT_MS / 1000}s`,
      };
    }
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message,
    };
  }
}

/**
 * Run the task performer agent.
 */
export async function runTaskPerformer(task, attempt, progressPath, { cwd, systemPrompt, allowedTools }) {
  const prompt = buildTaskPrompt(task, attempt, progressPath);

  return runClaude(prompt, {
    systemPrompt,
    allowedTools,
    permissionMode: 'acceptEdits',
    verbose: true,
    cwd,
  });
}

/**
 * Run the QA reviewer agent.
 */
export async function runQAReviewer(task, verifyResult, progressPath, qaReviewPath, { cwd, systemPrompt, allowedTools, commitDiff }) {
  const prompt = buildQAPrompt(task, verifyResult, progressPath, qaReviewPath, commitDiff);

  const resultText = await runClaude(prompt, {
    systemPrompt,
    allowedTools,
    permissionMode: 'acceptEdits',
    verbose: true,
    cwd,
  });

  return parseQAResult(resultText);
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildTaskPrompt(task, attempt, progressPath) {
  const retryNote =
    attempt > 1
      ? `\nThis is attempt ${attempt}/3. Read the progress file first — it contains QA findings from previous attempts that you must address.\n`
      : '';

  return `\
You are implementing Task ${task.id}: ${task.title}
${retryNote}
## Task Description

**Summary:** ${task.summary}

**Related Files:**
${task.relatedFiles.length ? task.relatedFiles.map(f => `- \`${f}\``).join('\n') : '(none listed)'}

**Verification Command:** \`${task.verificationCommand}\`

${task.deps.length ? `**Depends on Tasks:** ${task.deps.join(', ')} (these are already implemented)` : ''}

## Progress File

Write your implementation summary and files changed to:
\`${progressPath}\`

Do not overwrite the Status/Attempt/Started/Updated header fields — append only to the
"## Implementation Summary", "## Files Changed", and "## Blockers" sections.

Begin by reading the related files, then implement the task.
`;
}

const MAX_OUTPUT_CHARS = 3000;

function truncateOutput(text) {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_OUTPUT_CHARS) return trimmed;
  const half = Math.floor(MAX_OUTPUT_CHARS / 2);
  return trimmed.slice(0, half) + '\n\n... [truncated] ...\n\n' + trimmed.slice(-half);
}

function buildQAPrompt(task, verifyResult, progressPath, qaReviewPath, commitDiff) {
  const exitCodeLine = `**Verification Exit Code:** ${verifyResult.exitCode}`;
  const stdoutSection = verifyResult.stdout.trim()
    ? `**Stdout:**\n\`\`\`\n${truncateOutput(verifyResult.stdout)}\n\`\`\``
    : '**Stdout:** (empty)';
  const stderrSection = verifyResult.stderr.trim()
    ? `**Stderr:**\n\`\`\`\n${truncateOutput(verifyResult.stderr)}\n\`\`\``
    : '**Stderr:** (empty)';

  return `\
Review the completed implementation of Task ${task.id}: ${task.title}

## Verification Result

**Command:** \`${task.verificationCommand}\`
${exitCodeLine}
${stdoutSection}
${stderrSection}

## Task Description

**Summary:** ${task.summary}

**Related Files:**
${task.relatedFiles.length ? task.relatedFiles.map(f => `- \`${f}\``).join('\n') : '(none listed)'}

${commitDiff ? `## Commit Diff (files changed by this task's commit)\n\n\`\`\`\n${commitDiff}\n\`\`\`\n\n**IMPORTANT:** Only review files listed in this commit diff. Any other changes in the working directory belong to other tasks and are NOT part of this review.\n` : ''}## Progress File (implementation summary written by the performer)

Read this file first: \`${progressPath}\`

## QA Review File

Write your full review to: \`${qaReviewPath}\`

Use this format:
\`\`\`markdown
# QA Review — Task ${task.id}: ${task.title}

**Status:** PASS or FAIL
**Reviewed:** <ISO timestamp>

## Criteria Checklist
- [x/✗] Verification exit code
- [x/✗] Implementation matches task description
- [x/✗] Tests written if required
- [x/✗] No hardcoded USD defaults
- [x/✗] No unrelated file changes

## Findings
<detailed notes, file paths, line numbers>
\`\`\`

## Instructions

Apply all QA criteria from your system prompt. Start with exit code check, then read the
related files and the progress file to verify the implementation.

Write your full review to the QA review file, then output exactly [STATUS: PASS] or [STATUS: FAIL] followed by a one-line summary.
`;
}

// ─── QA result parser ─────────────────────────────────────────────────────────

function parseQAResult(text) {
  const passMatch = text.match(/\[STATUS:\s*PASS\]/i);
  const failMatch = text.match(/\[STATUS:\s*FAIL\]/i);

  if (passMatch) {
    const findings = text.slice(passMatch.index + passMatch[0].length).trim();
    return { status: 'pass', findings };
  }
  if (failMatch) {
    const findings = text.slice(failMatch.index + failMatch[0].length).trim();
    return { status: 'fail', findings };
  }

  return {
    status: 'fail',
    findings: `QA reviewer did not output a clear [STATUS:] marker. Raw output:\n${text}`,
  };
}
