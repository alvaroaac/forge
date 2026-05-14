export const IpcChannel = {
  AuthCheck: 'auth:check',
  LinearFetchIssues: 'linear:fetch-issues',
  LinearFetchIssueDetail: 'linear:fetch-issue-detail',
  LinearRefresh: 'linear:refresh',
  SpecGenerate: 'spec:generate',
  SpecLaunchReview: 'spec:launch-review',
  SpecStreamChunk: 'spec:stream-chunk',
  SpecGenerateDone: 'spec:generate-done',
  SpecGenerateError: 'spec:generate-error',
  SpecGet: 'spec:get',
  SpecWrite: 'spec:write',
  ConfigGet: 'config:get',
  ConfigSet: 'config:set',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
