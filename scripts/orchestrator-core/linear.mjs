/**
 * linear.mjs — Thin Linear API wrapper for the orchestrator.
 *
 * Auth: reads OAuth token from ~/.humanlayer/riptide/linear.json,
 * or falls back to LINEAR_API_KEY env var.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_TOKEN_PATH = join(homedir(), '.humanlayer', 'riptide', 'linear.json');

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getAuthHeader() {
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }
  if (existsSync(LINEAR_TOKEN_PATH)) {
    const tokens = JSON.parse(readFileSync(LINEAR_TOKEN_PATH, 'utf-8'));
    if (tokens.access_token) {
      return `Bearer ${tokens.access_token}`;
    }
  }
  console.error(
    'ERROR: No Linear auth found.\n' +
    '  Option 1: Run `linear login` to authenticate via OAuth\n' +
    '  Option 2: Set LINEAR_API_KEY env var'
  );
  process.exit(1);
}

// ─── GraphQL helper ───────────────────────────────────────────────────────────

async function linearRequest(query, variables = {}) {
  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error('Linear API error:', JSON.stringify(json.errors, null, 2));
    throw new Error(`Linear API error: ${json.errors[0]?.message}`);
  }
  return json.data;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a Linear client bound to a specific team and title prefix.
 *
 * @param {{ teamKey: string, titlePrefix: string }} opts
 */
export function createLinearClient({ teamKey, titlePrefix }) {

  function normalizeTitle(title) {
    // Escape the prefix for regex use, then strip it
    const escaped = titlePrefix.replace(/[[\]\\]/g, '\\$&');
    return title
      .replace(new RegExp(`^${escaped}\\s*`, 'i'), '')
      .trim()
      .toLowerCase();
  }

  async function getTeamId() {
    const data = await linearRequest(`
      query {
        teams(filter: { key: { eq: "${teamKey}" } }) {
          nodes { id name key }
        }
      }
    `);
    const team = data.teams.nodes[0];
    if (!team) {
      throw new Error(`Team "${teamKey}" not found in Linear`);
    }
    return team.id;
  }

  async function getStateId(teamId, stateName) {
    const data = await linearRequest(`
      query($teamId: ID!) {
        workflowStates(filter: { team: { id: { eq: $teamId } } }) {
          nodes { id name }
        }
      }
    `, { teamId });

    const state = data.workflowStates.nodes.find((s) => s.name === stateName);
    if (!state) {
      const available = data.workflowStates.nodes.map((s) => s.name).join(', ');
      throw new Error(`State "${stateName}" not found. Available: ${available}`);
    }
    return state.id;
  }

  async function findIssues() {
    const map = new Map();
    let after = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const data = await linearRequest(`
        query($after: String) {
          issues(
            first: 250
            after: $after
            filter: {
              title: { contains: "${titlePrefix}" }
              team: { key: { eq: "${teamKey}" } }
            }
          ) {
            pageInfo { hasNextPage endCursor }
            nodes { id identifier url title }
          }
        }
      `, { after });

      for (const issue of data.issues.nodes) {
        const key = normalizeTitle(issue.title);
        map.set(key, {
          id: issue.id,
          identifier: issue.identifier,
          url: issue.url,
          title: issue.title,
        });
      }

      hasNextPage = data.issues.pageInfo.hasNextPage;
      after = data.issues.pageInfo.endCursor;
    }

    return map;
  }

  async function updateIssueState(issueId, stateId) {
    const data = await linearRequest(`
      mutation($issueId: String!, $stateId: String!) {
        issueUpdate(id: $issueId, input: { stateId: $stateId }) {
          success
          issue { id identifier state { name } }
        }
      }
    `, { issueId, stateId });

    if (!data.issueUpdate.success) {
      throw new Error(`Failed to update state for issue ${issueId}`);
    }
  }

  /**
   * Fetches a single issue by identifier (e.g. 'ENG-82').
   * @param {string} identifier
   * @returns {Promise<{ id: string, identifier: string, title: string, url: string } | null>}
   */
  async function getIssue(identifier) {
    const data = await linearRequest(`
      query($identifier: String!) {
        issue(id: $identifier) {
          id identifier title url
        }
      }
    `, { identifier });
    return data.issue ?? null;
  }

  /**
   * Fetches a Linear project by name and returns its ID + milestone map.
   *
   * @param {string} projectName
   * @returns {Promise<{ projectId: string, milestoneMap: Record<string, string> }>}
   */
  async function getProjectAndMilestones(projectName) {
    const data = await linearRequest(`
      query($name: String!) {
        projects(filter: { name: { eq: $name } }) {
          nodes {
            id name
            projectMilestones { nodes { id name } }
          }
        }
      }
    `, { name: projectName });

    const project = data.projects.nodes[0];
    if (!project) {
      throw new Error(`Project "${projectName}" not found in Linear`);
    }

    const milestoneMap = {};
    for (const m of project.projectMilestones.nodes) {
      milestoneMap[m.name] = m.id;
    }
    return { projectId: project.id, milestoneMap };
  }

  /**
   * Creates a new Linear issue.
   *
   * @param {{ title: string, description?: string, parentId?: string, stateId?: string, projectId?: string, projectMilestoneId?: string }} opts
   * @returns {Promise<{ id: string, identifier: string, url: string, title: string }>}
   */
  async function createIssue({ title, description, parentId, stateId, projectId, projectMilestoneId }) {
    const teamId = await getTeamId();
    const input = { teamId, title };
    if (description) input.description = description;
    if (parentId) input.parentId = parentId;
    if (stateId) input.stateId = stateId;
    if (projectId) input.projectId = projectId;
    if (projectMilestoneId) input.projectMilestoneId = projectMilestoneId;

    const data = await linearRequest(`
      mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue { id identifier url title }
        }
      }
    `, { input });

    if (!data.issueCreate.success) {
      throw new Error('Failed to create issue');
    }
    return data.issueCreate.issue;
  }

  return { getTeamId, getStateId, findIssues, updateIssueState, getIssue, getProjectAndMilestones, createIssue };
}
