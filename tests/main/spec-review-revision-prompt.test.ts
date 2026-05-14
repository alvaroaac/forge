import { describe, expect, it } from 'vitest';
import { buildSpecReviewRevisionPrompt } from '../../src/main/services/spec-review-revision-prompt';

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
});
