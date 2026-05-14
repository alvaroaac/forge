import { FORGE_REVIEW_RESPONSE_TEMPLATE } from './spec-review-tags';

const SYSTEM = `You are a senior engineer revising a specification based on review feedback.
Apply feedback faithfully, keep the spec coherent, and avoid adding unrelated scope.

Return only the tagged output format requested by the user prompt.`;

export function buildSpecReviewRevisionPrompt(input: {
  originalSpecMarkdown: string;
  reviewFeedback: string;
}): { system: string; user: string } {
  const user = [
    'Revise the spec using the provided review feedback.',
    '',
    '## Original Spec Markdown',
    input.originalSpecMarkdown,
    '',
    '## Raw Review Feedback',
    input.reviewFeedback,
    '',
    'Return only the two tagged sections below, with no preamble and no extra tags:',
    '',
    FORGE_REVIEW_RESPONSE_TEMPLATE,
  ].join('\n');

  return { system: SYSTEM, user };
}
