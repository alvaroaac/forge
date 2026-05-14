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

function parseSummaryJson(rawSummaryJson: string): SpecReviewSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawSummaryJson);
  } catch {
    throw new Error('Invalid review summary JSON.');
  }

  const summary = toSummaryRecord(parsed);
  if (summary.verdict !== 'approved' && summary.verdict !== 'changes_requested') {
    throw new Error('Invalid review summary JSON: verdict must be approved or changes_requested.');
  }
  if (typeof summary.reviewerSummary !== 'string') {
    throw new Error('Invalid review summary JSON: reviewerSummary must be a string.');
  }
  if (typeof summary.commentCount !== 'number' || !Number.isFinite(summary.commentCount)) {
    throw new Error('Invalid review summary JSON: commentCount must be a number.');
  }

  return {
    verdict: summary.verdict,
    reviewerSummary: summary.reviewerSummary,
    commentCount: summary.commentCount,
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
