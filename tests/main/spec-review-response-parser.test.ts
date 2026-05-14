import { describe, expect, it } from 'vitest';
import { parseSpecReviewResponse } from '../../src/main/services/spec-review-response-parser';

describe('parseSpecReviewResponse', () => {
  it('parses valid tagged response into summary and revised spec', () => {
    const response = [
      '<forge_review_summary>',
      JSON.stringify({
        verdict: 'changes_requested',
        reviewerSummary: 'Two comments need follow-up.',
        commentCount: 2,
        appliedChanges: ['Clarified dependencies'],
        unresolvedComments: ['Need rollback section'],
      }),
      '</forge_review_summary>',
      '',
      '<forge_revised_spec>',
      '# Spec: FUL-101\n\n## Task Summary\nUpdated content.',
      '</forge_revised_spec>',
    ].join('\n');

    const parsed = parseSpecReviewResponse(response);
    expect(parsed.summary.verdict).toBe('changes_requested');
    expect(parsed.summary.commentCount).toBe(2);
    expect(parsed.content).toContain('# Spec: FUL-101');
  });

  it('rejects when summary tag is missing', () => {
    const response = [
      '<forge_revised_spec>',
      '# Spec: FUL-101\n\n## Task Summary\nUpdated content.',
      '</forge_revised_spec>',
    ].join('\n');

    expect(() => parseSpecReviewResponse(response)).toThrow(/forge_review_summary/);
  });

  it('rejects when revised spec tag is missing', () => {
    const response = [
      '<forge_review_summary>',
      JSON.stringify({
        verdict: 'approved',
        reviewerSummary: 'Looks good.',
        commentCount: 0,
        appliedChanges: [],
        unresolvedComments: [],
      }),
      '</forge_review_summary>',
    ].join('\n');

    expect(() => parseSpecReviewResponse(response)).toThrow(/forge_revised_spec/);
  });

  it('rejects invalid summary JSON', () => {
    const response = [
      '<forge_review_summary>',
      '{"verdict":"approved",',
      '</forge_review_summary>',
      '',
      '<forge_revised_spec>',
      '# Spec: FUL-101\n\n## Task Summary\nUpdated content.',
      '</forge_revised_spec>',
    ].join('\n');

    expect(() => parseSpecReviewResponse(response)).toThrow(/Invalid review summary JSON/i);
  });

  it('rejects empty revised spec', () => {
    const response = [
      '<forge_review_summary>',
      JSON.stringify({
        verdict: 'approved',
        reviewerSummary: 'Looks good.',
        commentCount: 0,
        appliedChanges: [],
        unresolvedComments: [],
      }),
      '</forge_review_summary>',
      '',
      '<forge_revised_spec>',
      '   ',
      '</forge_revised_spec>',
    ].join('\n');

    expect(() => parseSpecReviewResponse(response)).toThrow(/empty revised spec/i);
  });

  it('cleans markdown fences and preamble from revised markdown', () => {
    const response = [
      '<forge_review_summary>',
      JSON.stringify({
        verdict: 'approved',
        reviewerSummary: 'Looks good.',
        commentCount: 0,
        appliedChanges: ['Resolved typos'],
        unresolvedComments: [],
      }),
      '</forge_review_summary>',
      '',
      '<forge_revised_spec>',
      'Here is the revised draft:\n\n```markdown\n# Spec: FUL-101\n\n## Task Summary\nUpdated content.\n```',
      '</forge_revised_spec>',
    ].join('\n');

    const parsed = parseSpecReviewResponse(response);
    expect(parsed.content).toBe('# Spec: FUL-101\n\n## Task Summary\nUpdated content.');
  });
});
