/**
 * task-parser.mjs — Parse IMPLEMENTATION_PLAN.md → task graph + topo batches.
 *
 * Generic: works with any plan file that follows the ### Task ID: Title format.
 */

import { readFileSync } from 'fs';

// ─── Parse ───────────────────────────────────────────────────────────────────

/**
 * Parse IMPLEMENTATION_PLAN.md into an array of task objects.
 * @param {string} planPath  Absolute path to the plan file
 * @returns {Task[]}
 */
export function parseTasks(planPath) {
  const content = readFileSync(planPath, 'utf-8');
  const lines = content.split('\n');

  const sections = [];
  let current = null;

  for (const line of lines) {
    const headerMatch = line.match(/^### Task (\w+)(?:\s+`[^`]+`)?: (.+)/);
    if (headerMatch) {
      if (current) sections.push(current);
      current = {
        id: headerMatch[1].toLowerCase(),
        title: headerMatch[2].trim(),
        lines: [],
      };
    } else if (current) {
      if (line.trimEnd() === '---') {
        sections.push(current);
        current = null;
      } else {
        current.lines.push(line);
      }
    }
  }
  if (current) sections.push(current);

  const knownIds = new Set(sections.map(s => s.id));
  return sections.map(s => parseTaskSection(s, knownIds));
}

function parseTaskSection({ id, title, lines }, knownIds) {
  const fields = {};
  let key = null;
  let value = [];

  for (const line of lines) {
    const m = line.match(/^-\s+\*\*([^:*]+):\*\*\s*(.*)/);
    if (m) {
      if (key) fields[key] = value.join('\n').trim();
      key = m[1].trim().toLowerCase();
      value = [m[2]];
    } else if (key) {
      value.push(line);
    }
  }
  if (key) fields[key] = value.join('\n').trim();

  return {
    id,
    title,
    summary: fields['summary'] ?? '',
    verificationCommand: extractVerificationCommand(fields['verification'] ?? ''),
    relatedFiles: extractRelatedFiles(fields['related files'] ?? ''),
    deps: parseDeps(fields['depends on'] ?? '', knownIds),
    blocks: parseDeps(fields['blocks'] ?? '', knownIds),
  };
}

function extractVerificationCommand(text) {
  const m = text.match(/`([^`]+)`/);
  return m ? m[1].trim() : text.trim();
}

function extractRelatedFiles(text) {
  const matches = text.match(/`([^`]+)`/g) ?? [];
  return matches.map(s => s.replace(/`/g, '').trim());
}

/**
 * Parse a "Depends on" or "Blocks" field value into an array of task ID strings.
 */
function parseDeps(text, knownIds) {
  if (!text || text.trim() === '') return [];
  const ids = new Set();

  for (const m of text.matchAll(/\((\d+)-(\d+)\)/g)) {
    const lo = parseInt(m[1]);
    const hi = parseInt(m[2]);
    for (let i = lo; i <= hi; i++) {
      ids.add(String(i));
    }
    if (knownIds) {
      for (const kid of knownIds) {
        const numPrefix = parseInt(kid);
        if (!Number.isNaN(numPrefix) && numPrefix >= lo && numPrefix <= hi && kid !== String(numPrefix)) {
          ids.add(kid);
        }
      }
    }
  }

  for (const m of text.matchAll(/\bTasks?\s+([\w, ]+)/gi)) {
    for (const part of m[1].split(',')) {
      const id = part.trim().match(/^(\d+[a-z]?)$/i)?.[1];
      if (id) ids.add(id.toLowerCase());
    }
  }

  return [...ids];
}

// ─── Topological Sort ────────────────────────────────────────────────────────

/**
 * Group tasks into dependency-ordered batches using Kahn's algorithm.
 * @param {Task[]} tasks
 * @returns {Task[][]}
 */
export function topoSort(tasks) {
  const known = new Set(tasks.map(t => t.id));
  const done = new Set();
  const batches = [];

  while (done.size < tasks.length) {
    const batch = tasks.filter(
      t => !done.has(t.id) && t.deps.every(d => !known.has(d) || done.has(d))
    );

    if (batch.length === 0) {
      const remaining = tasks.filter(t => !done.has(t.id));
      throw new Error(
        `Dependency cycle detected! Stuck tasks: ${remaining.map(t => t.id).join(', ')}`
      );
    }

    batches.push(batch);
    for (const t of batch) done.add(t.id);
  }

  return batches;
}
