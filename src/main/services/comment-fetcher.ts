export interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  authorName: string;
  isBot: boolean;
}

export interface RawLinearComment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
  botActor: { id: string } | null;
}

export interface CommentsClient {
  fetchIssueComments(issueId: string): Promise<RawLinearComment[]>;
}

export function normalise(raw: RawLinearComment): LinearComment {
  return {
    id: raw.id,
    body: raw.body,
    createdAt: raw.createdAt,
    authorName: raw.user?.name ?? 'Unknown',
    isBot: raw.botActor !== null,
  };
}

export async function fetchAndFilterComments(
  client: CommentsClient,
  issueId: string,
): Promise<LinearComment[]> {
  const raw = await client.fetchIssueComments(issueId);
  return raw.map(normalise).filter((c) => !c.isBot);
}
