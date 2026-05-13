import { useEffect, useRef, useState } from 'react';

import type { Issue } from '../shared/types';
import { RightPanel } from './components/right-panel';
import { SpecDrawer, type DrawerTab } from './components/spec-drawer';
import { TopBar } from './components/top-bar';
import { IssueListPanel, type Tab } from './components/issue-list-panel';
import { useAuthStatus } from './hooks/use-auth-status';
import { useConfig } from './hooks/use-config';
import { useIssues } from './hooks/use-issues';
import { useSpecStream } from './hooks/use-spec-stream';

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
  const drawerIssueId = drawer?.issue.id ?? null;
  const { spec, streaming, isStreaming, generate } = useSpecStream(drawerIssueId);
  const specIds = useRef(new Set<string>());

  useEffect(() => {
    if (!drawerIssueId || !spec) {
      return;
    }

    specIds.current.add(drawerIssueId);
  }, [drawerIssueId, spec]);

  const hasSpecFor = (id: string) => {
    return specIds.current.has(id) || (drawerIssueId === id && !!spec);
  };

  const onOpen = (issue: Issue, which: DrawerTab) => {
    setDrawer({ issue, tab: which });
  };

  const onCopy = (content: string) => {
    void navigator.clipboard.writeText(content);
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
        />
        <RightPanel auth={auth} />
      </div>

      <SpecDrawer
        issue={drawer?.issue ?? null}
        tab={drawer?.tab ?? 'spec'}
        setTab={setDrawerTab}
        onClose={() => setDrawer(null)}
        spec={spec}
        streaming={streaming}
        isStreaming={isStreaming}
        onGenerate={generate}
        onCopy={onCopy}
      />
    </div>
  );
}
