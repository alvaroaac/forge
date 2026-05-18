import { useEffect, useRef, useState } from 'react';

import type { Issue, SpecReviewSummary } from '../shared/types';
import { RightPanel } from './components/right-panel';
import { SpecDrawer, type DrawerTab } from './components/spec-drawer';
import { TriageDrawer } from './components/triage-drawer';
import { TopBar } from './components/top-bar';
import { IssueListPanel, type Tab } from './components/issue-list-panel';
import { useAuthStatus } from './hooks/use-auth-status';
import { useConfig } from './hooks/use-config';
import { useIssues } from './hooks/use-issues';
import { useSpecStream } from './hooks/use-spec-stream';
import { useTriageStream } from './hooks/use-triage-stream';

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

function formatSync(ts: number): string {
  if (!ts) {
    return '—';
  }

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s ago`;
  }

  return `${Math.floor(elapsedSeconds / 60)}m ago`;
}

export function App() {
  const auth = useAuthStatus();
  const config = useConfig();
  const { issues, lastSync, refresh } = useIssues();
  const [tab, setTab] = useState<Tab>('Todo');
  const [drawer, setDrawer] = useState<{ issue: Issue; tab: DrawerTab } | null>(null);
  const [claudeModel, setClaudeModel] = useState(DEFAULT_CLAUDE_MODEL);
  const [reviewedContent, setReviewedContent] = useState<string | null>(null);
  const [reviewSummary, setReviewSummary] = useState<SpecReviewSummary | null>(null);
  const [isReviewPending, setIsReviewPending] = useState(false);
  const [reviewErrorMessage, setReviewErrorMessage] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const drawerIssueId = drawer?.issue.id ?? null;
  const {
    spec,
    streaming,
    streamStatus,
    isStreaming,
    errorMessage,
    generate: generateSpec,
  } = useSpecStream(drawerIssueId);
  const specIds = useRef(new Set<string>());
  const currentDrawerIssueId = useRef<string | null>(null);
  const activeReviewIssueId = useRef<string | null>(null);

  useEffect(() => {
    currentDrawerIssueId.current = drawerIssueId;
  }, [drawerIssueId]);

  useEffect(() => {
    if (config?.claudeModel) {
      setClaudeModel(config.claudeModel);
    }
  }, [config?.claudeModel]);

  useEffect(() => {
    if (tab !== 'Triage' || viewerId !== null) {
      return;
    }

    void (async () => {
      const nextViewerId = await window.forge.linear.getViewerId();
      setViewerId(nextViewerId ?? null);
    })();
  }, [tab, viewerId]);

  useEffect(() => {
    if (!drawerIssueId || !spec) {
      return;
    }

    specIds.current.add(drawerIssueId);
  }, [drawerIssueId, spec]);

  useEffect(() => {
    if (!drawerIssueId) {
      return;
    }

    let cancelled = false;
    const requestedIssueId = drawerIssueId;

    const hydrateDrawerIssue = async () => {
      try {
        const freshIssue = await window.forge.linear.fetchIssueDetail(requestedIssueId);
        if (cancelled || !freshIssue) {
          return;
        }

        setDrawer((current) => {
          if (!current || current.issue.id !== requestedIssueId) {
            return current;
          }
          return { ...current, issue: freshIssue };
        });
      } catch {
        // Keep cached issue fields when detail fetch fails.
      }
    };

    void hydrateDrawerIssue();

    return () => {
      cancelled = true;
    };
  }, [drawerIssueId]);

  useEffect(() => {
    activeReviewIssueId.current = null;
    setReviewedContent(null);
    setReviewSummary(null);
    setIsReviewPending(false);
    setReviewErrorMessage(null);
  }, [drawerIssueId]);

  const hasSpecFor = (id: string) => {
    return specIds.current.has(id) || (drawerIssueId === id && !!spec);
  };

  const onOpen = (issue: Issue, which: DrawerTab) => {
    setDrawer({ issue, tab: which });
  };

  const onCopy = (content: string) => {
    void navigator.clipboard.writeText(content);
  };

  const onClaudeModelChange = (nextModel: string) => {
    setClaudeModel(nextModel);
    void window.forge.config.set({ claudeModel: nextModel });
  };

  const onGenerateSpec = () => {
    void window.forge.config.set({ claudeModel });
    setReviewedContent(null);
    setReviewSummary(null);
    setReviewErrorMessage(null);
    void generateSpec(claudeModel);
  };

  const onLaunchReviewSpec = async (content: string) => {
    if (!drawerIssueId || isReviewPending) {
      return;
    }

    const requestedIssueId = drawerIssueId;
    activeReviewIssueId.current = requestedIssueId;
    setIsReviewPending(true);
    setReviewErrorMessage(null);

    try {
      const result = await window.forge.spec.launchReview(requestedIssueId, content, claudeModel);
      if (
        activeReviewIssueId.current !== requestedIssueId ||
        currentDrawerIssueId.current !== requestedIssueId
      ) {
        return;
      }
      setReviewedContent(result.content);
      setReviewSummary(result.summary);
    } catch (error) {
      if (
        activeReviewIssueId.current !== requestedIssueId ||
        currentDrawerIssueId.current !== requestedIssueId
      ) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Review launch failed';
      setReviewErrorMessage(message);
    } finally {
      if (
        activeReviewIssueId.current === requestedIssueId &&
        currentDrawerIssueId.current === requestedIssueId
      ) {
        activeReviewIssueId.current = null;
        setIsReviewPending(false);
      }
    }
  };

  const onWriteSpec = (content: string) => {
    if (!drawerIssueId) {
      return;
    }

    specIds.current.add(drawerIssueId);
    void window.forge.spec.write(drawerIssueId, content);
  };

  const setDrawerTab = (nextTab: DrawerTab) => {
    if (!drawer) {
      return;
    }

    setDrawer({ ...drawer, tab: nextTab });
  };

  return (
    <div className="app">
      <TopBar auth={auth} teamKey={config?.linearTeamKey ?? '—'} lastSync={formatSync(lastSync)} />

      <div className="zones">
        <IssueListPanel
          issues={issues}
          tab={tab}
          setTab={setTab}
          onOpen={onOpen}
          activeId={drawerIssueId}
          hasSpecFor={hasSpecFor}
          onRefresh={refresh}
          mineOnly={mineOnly}
          onMineOnlyChange={setMineOnly}
          viewerId={viewerId}
        />
        <RightPanel auth={auth} />
      </div>

      {drawer?.issue?.status === 'triage' && drawer.tab === 'spec' ? (
        <TriageDrawerContainer
          issue={drawer.issue}
          canGenerate={auth.computron}
          onClose={() => setDrawer(null)}
        />
      ) : (
        <SpecDrawer
          issue={drawer?.issue ?? null}
          tab={drawer?.tab ?? 'spec'}
          setTab={setDrawerTab}
          onClose={() => setDrawer(null)}
          spec={spec}
          streaming={streaming}
          streamStatus={streamStatus}
          reviewedContent={reviewedContent}
          reviewSummary={reviewSummary}
          isReviewPending={isReviewPending}
          reviewStatusMessage={isReviewPending ? 'Review in progress...' : null}
          reviewErrorMessage={reviewErrorMessage}
          isStreaming={isStreaming}
          errorMessage={errorMessage}
          claudeModel={claudeModel}
          onClaudeModelChange={onClaudeModelChange}
          onGenerate={onGenerateSpec}
          onLaunchReview={onLaunchReviewSpec}
          onWrite={onWriteSpec}
          onCopy={onCopy}
        />
      )}
    </div>
  );
}

type TriageDrawerContainerProps = {
  issue: Issue;
  canGenerate: boolean;
  onClose: () => void;
};

function TriageDrawerContainer({ issue, canGenerate, onClose }: TriageDrawerContainerProps) {
  const { brief, streaming, isStreaming, errorMessage, generate } = useTriageStream(issue.id);

  return (
    <TriageDrawer
      issue={issue}
      brief={brief}
      streaming={streaming}
      isStreaming={isStreaming}
      errorMessage={errorMessage}
      onGenerate={() => void generate()}
      canGenerate={canGenerate}
      onClose={onClose}
    />
  );
}
