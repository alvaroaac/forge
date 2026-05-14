const SAFE_ISSUE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export function isSafeIssueId(issueId: string): boolean {
  return SAFE_ISSUE_ID.test(issueId);
}

export function assertSafeIssueId(issueId: string): void {
  if (!isSafeIssueId(issueId)) {
    throw new Error(`Unsafe issue id: ${issueId}`);
  }
}
