export const FORGE_REVIEW_SUMMARY_TAG = {
  open: '<forge_review_summary>',
  close: '</forge_review_summary>',
} as const;

export const FORGE_REVISED_SPEC_TAG = {
  open: '<forge_revised_spec>',
  close: '</forge_revised_spec>',
} as const;

export const FORGE_REVIEW_RESPONSE_TEMPLATE = `${FORGE_REVIEW_SUMMARY_TAG.open}
{
  "verdict": "changes_requested",
  "reviewerSummary": "string",
  "commentCount": 0,
  "appliedChanges": ["string"],
  "unresolvedComments": ["string"]
}
${FORGE_REVIEW_SUMMARY_TAG.close}

${FORGE_REVISED_SPEC_TAG.open}
revised spec markdown here
${FORGE_REVISED_SPEC_TAG.close}`;
