import type { SpecReviewResult } from '../../shared/types';
import { parseSpecReviewResponse } from './spec-review-response-parser';
import { buildSpecReviewRevisionPrompt } from './spec-review-revision-prompt';

export interface SpecReviewModelInput {
  model: string;
  system: string;
  user: string;
}

export type RunSpecReviewModel = (input: SpecReviewModelInput) => Promise<string>;

export interface ReviseSpecWithReviewInput {
  model: string;
  originalSpecMarkdown: string;
  reviewFeedback: string;
  runModel: RunSpecReviewModel;
}

export async function reviseSpecWithReview(
  input: ReviseSpecWithReviewInput,
): Promise<SpecReviewResult> {
  const prompt = buildSpecReviewRevisionPrompt({
    originalSpecMarkdown: input.originalSpecMarkdown,
    reviewFeedback: input.reviewFeedback,
  });

  const response = await input.runModel({
    model: input.model,
    system: prompt.system,
    user: prompt.user,
  });

  return parseSpecReviewResponse(response);
}
