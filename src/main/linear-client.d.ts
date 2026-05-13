declare module '*.agents/skills/linear/reference/linear.mjs' {
  export interface LinearClient {
    getCurrentUser(): Promise<{ id: string; name: string; email: string }>;
    fetchAssignedIssues(assigneeId: string): Promise<
      Array<{
        id: string;
        identifier: string;
        title: string;
        description: string;
        state: { name: string; type: string };
        priority: number;
        labels: { nodes: Array<{ name: string }> };
        url: string;
        updatedAt: string;
      }>
    >;
  }

  export interface LinearClientOptions {
    teamKey: string;
    titlePrefix: string;
  }

  export function createLinearClient(options: LinearClientOptions): LinearClient;
}
