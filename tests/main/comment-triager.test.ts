import { describe, expect, it, vi } from 'vitest';
import {
  triageComments,
  type TriageCommentsInput,
  COMMENT_TRIAGE_TIMEOUT_MS,
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

  it('uses the shorter comment triage timeout', async () => {
    const streamClaude = vi.fn().mockResolvedValue('');
    await triageComments({ issueTitle: 't', issueDescription: 'd', comments: oneComment, streamClaude });
    expect(COMMENT_TRIAGE_TIMEOUT_MS).toBe(60_000);
    expect(streamClaude.mock.calls[0][0].timeoutMs).toBe(COMMENT_TRIAGE_TIMEOUT_MS);
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

describe('COMMENT_TRIAGER_SYSTEM_PROMPT — per-rule coverage', () => {
  it('Rule 1: defines what makes a comment RELEVANT', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('RELEVANT');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('technical detail');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('reproduction info');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('decisions');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('clarifications');
  });

  it('Rule 2: defines what makes a comment SKIPPED', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('SKIPPED');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('+1');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('scheduling');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('off-topic');
  });

  it("Rule 3: skips a whole thread that concludes with won't-do / rejected / decided against", () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain("won't do this");
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('rejected');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('decided against this');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('skip the whole thread');
  });

  it('Rule 4: handles long Slack threads with the four sub-behaviours', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('50+ messages');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('2000+ words');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Summarize the on-topic portion');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Strip per-message timestamps');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Collapse consecutive messages from the same author');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Preserve substantive technical content verbatim');
  });

  it('Rule 5: enumerates exactly the allowed reason vocabulary', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`bot`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain("`won't-do`");
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`noise`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`filler`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('`off-topic`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).not.toContain('`spam`');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).not.toContain('`duplicate`');
  });

  it('Rule 6: defines the empty-relevant output shape', () => {
    // The constant contains the escaped four-char sequence "\n" (backslash-n)
    // because it's the literal text instructing the LLM what to emit.
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('## Relevant Comments\\n_(none)_');
  });

  it('Rule 7: forbids preamble / postscript / wrapping code fences', () => {
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('Return only the two sections');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('No preamble');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('no postscript');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('no code');
    expect(COMMENT_TRIAGER_SYSTEM_PROMPT).toContain('fences wrapping the whole output');
  });
});

describe('triageComments — output contract shape (mocked LLM, parameterised)', () => {
  const oneComment = [
    { id: 'c-1', body: 'x', createdAt: '2026-05-01T00:00:00.000Z', authorName: 'Alice', isBot: false },
  ];

  it('returns whatever the LLM returned, untouched', async () => {
    const arbitraryShapes = [
      '## Relevant Comments\n_(none)_\n\n## Skipped Comments\n- Alice (noise): "+1".\n',
      '## Relevant Comments\n\n### Alice — 2026-05-01\nbody\n\n---\n\n## Skipped Comments\n- (none)\n',
      '## Relevant Comments\n_(none)_\n\n## Skipped Comments\n- Team (won\'t-do): rejected in thread.\n',
    ];
    for (const canned of arbitraryShapes) {
      const streamClaude = vi.fn().mockResolvedValue(canned);
      const out = await triageComments({
        issueTitle: 't',
        issueDescription: 'd',
        comments: oneComment,
        streamClaude,
      });
      expect(out).toBe(canned);
    }
  });

  it('reason-vocabulary leak detector: only allowed tags appear in the Skipped block', async () => {
    // The detector is the kind of thing that would run on a real LLM response.
    // Here we use a synthetic but realistic curated output.
    const canned =
      '## Relevant Comments\n_(none)_\n\n## Skipped Comments\n' +
      '- Alice (noise): "+1".\n' +
      "- Bob (filler): \"ack\".\n" +
      '- Carol (off-topic): unrelated to bug.\n' +
      "- Dan (won't-do): proposal rejected in thread.\n";
    const skippedBlock = canned.split('## Skipped Comments')[1] ?? '';
    const reasonMatches = skippedBlock.match(/\(([a-z'-]+)\):/gi) ?? [];
    expect(reasonMatches.length).toBeGreaterThan(0);
    const allowed = new Set(['(bot):', "(won't-do):", '(noise):', '(filler):', '(off-topic):']);
    for (const r of reasonMatches) {
      expect(allowed.has(r.toLowerCase())).toBe(true);
    }
  });
});
