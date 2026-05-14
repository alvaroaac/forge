import { describe, expect, it } from 'vitest';
import { buildSpecReviewRevisionPrompt } from '../../src/main/services/spec-review-revision-prompt';

function extractTaggedSection(text: string, tagName: string): string {
  const open = `<${tagName}>`;
  const close = `</${tagName}>`;
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start < 0 || end < 0) return '';
  return text.slice(start + open.length, end).trim();
}

describe('buildSpecReviewRevisionPrompt', () => {
  it('includes original spec, raw review feedback, and required tagged response contract', () => {
    const originalSpec = '# Spec: FUL-99\n\n## Task Summary\nShip parser.';
    const reviewFeedback = '- Please clarify rollback behavior.';
    const prompt = buildSpecReviewRevisionPrompt({
      originalSpecMarkdown: originalSpec,
      reviewFeedback,
    });

    expect(prompt.user).toContain(originalSpec);
    expect(prompt.user).toContain(reviewFeedback);
    expect(prompt.user).toContain('<forge_review_summary>');
    expect(prompt.user).toContain('</forge_review_summary>');
    expect(prompt.user).toContain('<forge_revised_spec>');
    expect(prompt.user).toContain('</forge_revised_spec>');
    expect(prompt.user).toContain('Return only the two tagged sections');
  });

  it('includes a valid JSON summary example with the required verdict values documented', () => {
    const prompt = buildSpecReviewRevisionPrompt({
      originalSpecMarkdown: '# Spec',
      reviewFeedback: '- Looks good.',
    });

    const summaryExample = extractTaggedSection(prompt.user, 'forge_review_summary');
    expect(JSON.parse(summaryExample)).toMatchObject({
      verdict: 'changes_requested',
      reviewerSummary: 'string',
      commentCount: 0,
    });
    expect(prompt.user).toContain('either "approved" or "changes_requested"');
  });
});
