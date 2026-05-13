import { useEffect } from 'react';

import type { Issue, Spec } from '../../shared/types';
import { DetailTab } from './detail-tab';
import { IconClose, IconExternal } from './icons';
import { LabelBadge } from './label-badge';
import { PriorityChip } from './priority-chip';
import { SpecTab } from './spec-tab';

export type DrawerTab = 'detail' | 'spec';

type SpecDrawerProps = {
  issue: Issue | null;
  tab: DrawerTab;
  setTab: (tab: DrawerTab) => void;
  onClose: () => void;
  spec: Spec | null;
  streaming: string;
  isStreaming: boolean;
  onGenerate: () => void;
  onCopy: (content: string) => void;
};

function useEscClose(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);
}

export function SpecDrawer({
  issue,
  tab,
  setTab,
  onClose,
  spec,
  streaming,
  isStreaming,
  onGenerate,
  onCopy,
}: SpecDrawerProps) {
  useEscClose(onClose);

  const open = issue !== null;

  return (
    <>
      <div className={`drawer-scrim ${open ? 'drawer-scrim-open' : ''}`} onClick={onClose} />
      <aside className={`drawer ${open ? 'drawer-open' : ''}`}>
        {issue ? (
          <>
            <div className="drawer-head">
              <div className="drawer-head-row1">
                <span className="mono drawer-id">{issue.id}</span>
                <span className="drawer-title">{issue.title}</span>
                <button className="icon-btn" type="button" onClick={onClose} title="Close (Esc)">
                  <IconClose size={14} />
                </button>
              </div>
              <div className="drawer-head-row2">
                <PriorityChip priority={issue.priority} />
                {issue.labels.map((label) => (
                  <LabelBadge key={label} label={label} />
                ))}
                <span style={{ flex: 1 }} />
                <a className="btn-ghost" href={issue.url} target="_blank" rel="noreferrer">
                  Linear <IconExternal size={10} stroke={2} />
                </a>
              </div>
              <div className="drawer-tabs">
                <button
                  className={`drawer-tab ${tab === 'detail' ? 'drawer-tab-active' : ''}`}
                  type="button"
                  onClick={() => setTab('detail')}
                >
                  Detail
                </button>
                <button
                  className={`drawer-tab ${tab === 'spec' ? 'drawer-tab-active' : ''}`}
                  type="button"
                  onClick={() => setTab('spec')}
                >
                  Spec
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {tab === 'detail' ? (
                <DetailTab issue={issue} />
              ) : (
                <SpecTab
                  issue={issue}
                  spec={spec}
                  streaming={streaming}
                  isStreaming={isStreaming}
                  onGenerate={onGenerate}
                  onCopy={onCopy}
                />
              )}
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
