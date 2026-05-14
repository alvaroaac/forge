/**
 * linear.mjs — Linear API client for the `linear` skill.
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

function readAuthHeader(tokenPath = LINEAR_TOKEN_PATH) {
  if (process.env.LINEAR_API_KEY) {
    return process.env.LINEAR_API_KEY;
  }
  try {
    if (existsSync(tokenPath)) {
      const tokens = JSON.parse(readFileSync(tokenPath, 'utf-8'));
      if (tokens.access_token) {
        return `Bearer ${tokens.access_token}`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function getAuthHeader(tokenPath = LINEAR_TOKEN_PATH) {
  const authorization = readAuthHeader(tokenPath);
  if (authorization) return authorization;

  console.error(
    'ERROR: No Linear auth found.\n' +
    '  Option 1: Run `linear login` to authenticate via OAuth\n' +
    '  Option 2: Set LINEAR_API_KEY env var'
  );
  process.exit(1);
}

// ─── GraphQL helper ───────────────────────────────────────────────────────────

async function linearRequest(query, variables = {}, opts = {}) {
  const authorization = opts.authorization ?? getAuthHeader(opts.tokenPath);
  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.ok === false) {
    throw new Error(`Linear API HTTP ${res.status}`);
  }

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

  let cachedTeamId = null;

  function normalizeTitle(title) {
    // Escape the prefix for regex use, then strip it
    const escaped = titlePrefix.replace(/[[\]\\]/g, '\\$&');
    return title
      .replace(new RegExp(`^${escaped}\\s*`, 'i'), '')
      .trim()
      .toLowerCase();
  }

  async function getTeamId() {
    if (cachedTeamId) return cachedTeamId;
    const data = await linearRequest(`
      query($key: String!) {
        teams(filter: { key: { eq: $key } }) {
          nodes { id name key }
        }
      }
    `, { key: teamKey });
    const team = data.teams.nodes[0];
    if (!team) {
      throw new Error(`Team "${teamKey}" not found in Linear`);
    }
    cachedTeamId = team.id;
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

  /**
   * Partial update for an issue. Only provided fields are sent.
   *
   * @param {string} issueId
   * @param {{ title?: string, description?: string, stateId?: string, labelIds?: string[], assigneeId?: string }} patch
   * @returns {Promise<{ id: string, identifier: string }>}
   */
  async function updateIssue(issueId, patch) {
    const input = {};
    if (patch.title !== undefined) input.title = patch.title;
    if (patch.description !== undefined) input.description = patch.description;
    if (patch.stateId !== undefined) input.stateId = patch.stateId;
    if (patch.labelIds !== undefined) input.labelIds = patch.labelIds;
    if (patch.assigneeId !== undefined) input.assigneeId = patch.assigneeId;

    const data = await linearRequest(`
      mutation($issueId: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $issueId, input: $input) {
          success
          issue { id identifier }
        }
      }
    `, { issueId, input });

    if (!data.issueUpdate.success) {
      throw new Error(`Failed to update issue ${issueId}`);
    }
    return data.issueUpdate.issue;
  }

  async function updateIssueState(issueId, stateId) {
    await updateIssue(issueId, { stateId });
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
   * @param {{ title: string, description?: string, parentId?: string, stateId?: string, projectId?: string, projectMilestoneId?: string, labelIds?: string[] }} opts
   * @returns {Promise<{ id: string, identifier: string, url: string, title: string }>}
   */
  async function createIssue({ title, description, parentId, stateId, projectId, projectMilestoneId, labelIds }) {
    const teamId = await getTeamId();
    const input = { teamId, title };
    if (description) input.description = description;
    if (parentId) input.parentId = parentId;
    if (stateId) input.stateId = stateId;
    if (projectId) input.projectId = projectId;
    if (projectMilestoneId) input.projectMilestoneId = projectMilestoneId;
    if (labelIds && labelIds.length) input.labelIds = labelIds;

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

  /**
   * Finds a label by exact name, visible to the bound team.
   * Returns the first match or null. Searches team-scoped + workspace labels.
   *
   * @param {string} name
   * @returns {Promise<{ id: string, name: string } | null>}
   */
  async function findLabel(name) {
    const teamId = await getTeamId();
    const data = await linearRequest(`
      query($name: String!, $teamId: ID!) {
        issueLabels(
          filter: {
            name: { eq: $name }
            or: [
              { team: { null: true } }
              { team: { id: { eq: $teamId } } }
            ]
          }
        ) {
          nodes { id name }
        }
      }
    `, { name, teamId });
    return data.issueLabels.nodes[0] ?? null;
  }

  /**
   * Lists every label scoped to the bound team. Paginated.
   * Does NOT include workspace-level labels (team === null).
   *
   * @returns {Promise<Array<{ id: string, name: string, color: string, description: string | null, isGroup: boolean, parent: { id: string, name: string } | null }>>}
   */
  async function listTeamLabels() {
    const teamId = await getTeamId();
    const labels = [];
    let after = null;
    let hasNextPage = true;
    while (hasNextPage) {
      const data = await linearRequest(`
        query($teamId: ID!, $after: String) {
          issueLabels(
            first: 250
            after: $after
            filter: { team: { id: { eq: $teamId } } }
          ) {
            pageInfo { hasNextPage endCursor }
            nodes { id name color description isGroup parent { id name } }
          }
        }
      `, { teamId, after });
      labels.push(...data.issueLabels.nodes);
      hasNextPage = data.issueLabels.pageInfo.hasNextPage;
      after = data.issueLabels.pageInfo.endCursor;
    }
    return labels;
  }

  /**
   * Creates a label on the bound team.
   *
   * Note: `isGroup` must be passed explicitly — Linear silently creates a
   * non-group label otherwise, and child labels will fail with
   * "parent label is not a group".
   *
   * @param {{ name: string, color?: string, description?: string, parentId?: string, isGroup?: boolean }} opts
   * @returns {Promise<{ id: string, name: string, color: string, description: string | null, isGroup: boolean }>}
   */
  async function createLabel({ name, color, description, parentId, isGroup }) {
    const teamId = await getTeamId();
    const input = { teamId, name };
    if (color !== undefined) input.color = color;
    if (description !== undefined && description !== null) input.description = description;
    if (parentId !== undefined) input.parentId = parentId;
    if (isGroup !== undefined) input.isGroup = isGroup;

    const data = await linearRequest(`
      mutation($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel { id name color description isGroup }
        }
      }
    `, { input });

    if (!data.issueLabelCreate.success) {
      throw new Error(`Failed to create label "${name}"`);
    }
    return data.issueLabelCreate.issueLabel;
  }

  /**
   * Partial update for a label. Only provided fields are sent.
   * Useful for promoting a regular label to a group (isGroup: true),
   * re-parenting, renaming, or retiring (retiredAt: ISO string).
   *
   * @param {string} labelId
   * @param {{ name?: string, description?: string, color?: string, parentId?: string | null, isGroup?: boolean, retiredAt?: string }} patch
   * @returns {Promise<{ id: string, name: string, color: string, description: string | null, isGroup: boolean }>}
   */
  async function updateLabel(labelId, patch) {
    const input = {};
    if (patch.name !== undefined) input.name = patch.name;
    if (patch.description !== undefined) input.description = patch.description;
    if (patch.color !== undefined) input.color = patch.color;
    if (patch.parentId !== undefined) input.parentId = patch.parentId;
    if (patch.isGroup !== undefined) input.isGroup = patch.isGroup;
    if (patch.retiredAt !== undefined) input.retiredAt = patch.retiredAt;

    const data = await linearRequest(`
      mutation($id: String!, $input: IssueLabelUpdateInput!) {
        issueLabelUpdate(id: $id, input: $input) {
          success
          issueLabel { id name color description isGroup }
        }
      }
    `, { id: labelId, input });

    if (!data.issueLabelUpdate.success) {
      throw new Error(`Failed to update label ${labelId}`);
    }
    return data.issueLabelUpdate.issueLabel;
  }

  /**
   * Finds a workflow state by exact name on the bound team.
   * @param {string} name
   * @returns {Promise<{ id: string, name: string, type: string } | null>}
   */
  async function findState(name) {
    const teamId = await getTeamId();
    const data = await linearRequest(`
      query($teamId: ID!, $name: String!) {
        workflowStates(
          filter: {
            team: { id: { eq: $teamId } }
            name: { eq: $name }
          }
        ) {
          nodes { id name type }
        }
      }
    `, { teamId, name });
    return data.workflowStates.nodes[0] ?? null;
  }

  /**
   * Links two issues with a typed relation.
   *
   * @param {string} issueId         Internal UUID of the source issue
   * @param {string} relatedIssueId  Internal UUID of the target issue
   * @param {'related' | 'blocks' | 'duplicate'} type
   */
  async function createRelation(issueId, relatedIssueId, type) {
    const data = await linearRequest(`
      mutation($issueId: String!, $relatedIssueId: String!, $type: String!) {
        issueRelationCreate(
          input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: $type }
        ) {
          success
          issueRelation { id type }
        }
      }
    `, { issueId, relatedIssueId, type });

    if (!data.issueRelationCreate.success) {
      throw new Error(`Failed to create ${type} relation between ${issueId} and ${relatedIssueId}`);
    }
    return data.issueRelationCreate.issueRelation;
  }

  /**
   * Posts a plain markdown comment on an issue.
   *
   * @param {string} issueId  Internal UUID of the issue
   * @param {string} body     Markdown body
   */
  async function createComment(issueId, body) {
    const data = await linearRequest(`
      mutation($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
          comment { id url }
        }
      }
    `, { issueId, body });

    if (!data.commentCreate.success) {
      throw new Error(`Failed to create comment on ${issueId}`);
    }
    return data.commentCreate.comment;
  }

  /**
   * Returns the authenticated user's id, name, email.
   * @returns {Promise<{ id: string, name: string, email: string }>}
   */
  async function getCurrentUser() {
    const data = await linearRequest(`
      query {
        viewer { id name email }
      }
    `);
    return data.viewer;
  }

  /**
   * Non-fatal auth health check for UI status surfaces.
   *
   * @param {string} [tokenPath]
   * @returns {Promise<boolean>}
   */
  async function checkAuth(tokenPath = LINEAR_TOKEN_PATH) {
    const authorization = readAuthHeader(tokenPath);
    if (!authorization) return false;

    try {
      const data = await linearRequest(`
        query {
          viewer { id }
        }
      `, {}, { authorization });
      return typeof data.viewer?.id === 'string' && data.viewer.id.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Fetches a single issue with full detail by identifier (e.g. 'FUL-1').
   *
   * @param {string} identifier
   * @returns {Promise<{
   *   id: string,
   *   identifier: string,
   *   title: string,
   *   description: string | null,
   *   state: { name: string, type: string },
   *   priority: number,
   *   labels: { nodes: Array<{ name: string }> },
   *   url: string,
   *   updatedAt: string,
   * } | null>}
   */
  async function fetchIssueDetail(identifier) {
    const data = await linearRequest(`
      query($identifier: String!) {
        issue(id: $identifier) {
          id
          identifier
          title
          description
          state { name type }
          priority
          labels { nodes { name } }
          url
          updatedAt
        }
      }
    `, { identifier });
    return data.issue ?? null;
  }

  /**
   * All open issues assigned to assigneeId on the bound team.
   *
   * @param {string} assigneeId
   * @returns {Promise<Array<{
   *   id: string, identifier: string, title: string, description: string,
   *   state: { name: string, type: string },
   *   priority: number,
   *   labels: { nodes: Array<{ name: string }> },
   *   issueType: { name: string } | null,
   *   url: string, updatedAt: string,
   * }>>}
   */
  async function fetchAssignedIssues(assigneeId) {
    const data = await linearRequest(`
      query($assigneeId: ID!, $teamKey: String!) {
        issues(
          first: 250,
          filter: {
            assignee: { id: { eq: $assigneeId } }
            team: { key: { eq: $teamKey } }
            state: { type: { nin: ["completed", "canceled"] } }
          }
        ) {
          nodes {
            id identifier title description
            state { name type }
            priority
            labels { nodes { name } }
            url updatedAt
          }
        }
      }
    `, { assigneeId, teamKey });
    return data.issues.nodes;
  }

  return {
    getTeamId,
    getStateId,
    findIssues,
    updateIssueState,
    getIssue,
    getProjectAndMilestones,
    createIssue,
    findLabel,
    listTeamLabels,
    createLabel,
    updateLabel,
    findState,
    updateIssue,
    createRelation,
    createComment,
    getCurrentUser,
    checkAuth,
    fetchIssueDetail,
    fetchAssignedIssues,
  };
}
