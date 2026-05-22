import { describe, expect, it, vi } from 'vitest';
import {
  triageComments,
  type TriageCommentsInput,
  COMMENT_TRIAGER_MODEL,
  COMMENT_TRIAGER_SYSTEM_PROMPT,
} from '../../src/main/services/comment-triager';

describe('triageComments — empty input', () => {
  it('returns empty string without calling streamClaude when comments is []', async () => {
    const streamClaude = vi.fn();
    const out = await triageComments({
      issueTitle: 't',
      issueDescription: 'd',
      comments: [],
      streamClaude,
    });
    expect(out).toBe('');
    expect(streamClaude).not.toHaveBeenCalled();
  });
});

describe('triageComments — Claude invocation', () => {
  const oneComment: TriageCommentsInput['comments'] = [
    {
      id: 'c-1',
      body: 'hello',
      createdAt: '2026-05-01T00:00:00.000Z',
      authorName: 'Alice',
      isBot: false,
    },
  ];

  it('passes the pinned Haiku 4.5 model id', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(streamClaude.mock.calls[0][0].model).toBe('claude-haiku-4-5-20251001');
    expect(COMMENT_TRIAGER_MODEL).toBe('claude-haiku-4-5-20251001');
  });

  it('passes the constant system prompt unchanged', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(streamClaude.mock.calls[0][0].system).toBe(COMMENT_TRIAGER_SYSTEM_PROMPT);
  });

  it('renders the user prompt with title, description, and numbered comments', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({
      issueTitle: 'Order endpoint returns 500',
      issueDescription: 'Steps to repro: ...',
      comments: [
        {
          id: 'c-1',
          body: 'first body',
          createdAt: '2026-05-01T00:00:00.000Z',
          authorName: 'Alice',
          isBot: false,
        },
        {
          id: 'c-2',
          body: 'second body',
          createdAt: '2026-05-02T00:00:00.000Z',
          authorName: 'Bob',
          isBot: false,
        },
      ],
      streamClaude,
    });
    const userPrompt = streamClaude.mock.calls[0][0].user as string;
    expect(userPrompt).toContain('**Title:** Order endpoint returns 500');
    expect(userPrompt).toContain('Steps to repro: ...');
    expect(userPrompt).toContain('### 1. Alice — 2026-05-01T00:00:00.000Z');
    expect(userPrompt).toContain('first body');
    expect(userPrompt).toContain('### 2. Bob — 2026-05-02T00:00:00.000Z');
    expect(userPrompt).toContain('second body');
  });

  it('rethrows when streamClaude throws (caller is responsible for catching)', async () => {
    const streamClaude = vi.fn().mockRejectedValue(new Error('claude exited 1'));
    await expect(
      triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude }),
    ).rejects.toThrow('claude exited 1');
  });

  it('returns whatever streamClaude returns', async () => {
    const canned = '## Relevant Comments\n\n### Alice — 2026-05-01\nhello\n\n---\n\n## Skipped Comments\n- (none)';
    const streamClaude = vi.fn().mockResolvedValue(canned);
    const out = await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(out).toBe(canned);
  });
});
