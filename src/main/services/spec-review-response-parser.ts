import { cleanSpecMarkdown } from '../../shared/spec-markdown';
import type { SpecReviewResult, SpecReviewSummary } from '../../shared/types';
import { FORGE_REVIEW_SUMMARY_TAG, FORGE_REVISED_SPEC_TAG } from './spec-review-tags';

const MARKDOWN_FENCE_ONLY_RE = /^```(?:markdown|md)?\s*\n?([\s\S]*?)\n?```$/i;

function extractTaggedSection(
  response: string,
  tag: { open: string; close: string },
  label: string,
): string {
  const start = response.indexOf(tag.open);
  if (start < 0) {
    throw new Error(`Missing ${label} tag: ${tag.open}`);
  }

  const end = response.indexOf(tag.close, start + tag.open.length);
  if (end < 0) {
    throw new Error(`Missing ${label} tag: ${tag.close}`);
  }

  return response.slice(start + tag.open.length, end).trim();
}

function toSummaryRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  throw new Error('Invalid review summary JSON: expected object.');
}

function toStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`Invalid review summary JSON: ${fieldName} must be a string array.`);
  }
  return value;
}

function parseJsonObject(rawSummaryJson: string): Record<string, unknown> {
  try {
    return toSummaryRecord(JSON.parse(rawSummaryJson));
  } catch {
    throw new Error('Invalid review summary JSON.');
  }
}

function parseVerdict(value: unknown): SpecReviewSummary['verdict'] {
  if (value !== 'approved' && value !== 'changes_requested') {
    throw new Error('Invalid review summary JSON: verdict must be approved or changes_requested.');
  }
  return value;
}

function parseReviewerSummary(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Invalid review summary JSON: reviewerSummary must be a string.');
  }
  return value;
}

function parseCommentCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid review summary JSON: commentCount must be a number.');
  }
  return value;
}

function parseSummaryJson(rawSummaryJson: string): SpecReviewSummary {
  const summary = parseJsonObject(rawSummaryJson);

  return {
    verdict: parseVerdict(summary.verdict),
    reviewerSummary: parseReviewerSummary(summary.reviewerSummary),
    commentCount: parseCommentCount(summary.commentCount),
    appliedChanges: toStringArray(summary.appliedChanges, 'appliedChanges'),
    unresolvedComments: toStringArray(summary.unresolvedComments, 'unresolvedComments'),
  };
}

function cleanRevisedSpec(raw: string): string {
  const firstPass = cleanSpecMarkdown(raw).trim();
  const fenced = firstPass.match(MARKDOWN_FENCE_ONLY_RE);
  const unfenced = fenced?.[1]?.trim() ?? firstPass;
  return cleanSpecMarkdown(unfenced).trim();
}

export function parseSpecReviewResponse(response: string): SpecReviewResult {
  const summaryJson = extractTaggedSection(response, FORGE_REVIEW_SUMMARY_TAG, 'forge_review_summary');
  const rawSpec = extractTaggedSection(response, FORGE_REVISED_SPEC_TAG, 'forge_revised_spec');
  const content = cleanRevisedSpec(rawSpec);

  if (!content) {
    throw new Error('Invalid review response: empty revised spec.');
  }

  return {
    summary: parseSummaryJson(summaryJson),
    content,
  };
}
