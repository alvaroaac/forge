export const IpcChannel = {
  AuthCheck: 'auth:check',
  LinearFetchIssues: 'linear:fetch-issues',
  LinearRefresh: 'linear:refresh',
  SpecGenerate: 'spec:generate',
  SpecStreamChunk: 'spec:stream-chunk',
  SpecGet: 'spec:get',
  ConfigGet: 'config:get',
  ConfigSet: 'config:set',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
