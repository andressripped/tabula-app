import React from 'react';
import type { Page } from '../App';
import './TabBar.css';

interface TabBarProps {
  pages: Page[];
  openPageIds: string[];
  activePageId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewPage: () => void;
}

const TabBar: React.FC<TabBarProps> = ({
  pages,
  openPageIds,
  activePageId,
  onSelectTab,
  onCloseTab,
  onNewPage
}) => {
  return (
    <div className="tab-bar">
      {openPageIds.map(id => {
        const page = pages.find(p => p.id === id);
        if (!page) return null;
        const isActive = id === activePageId;

        return (
          <div
            key={id}
            className={`tab ${isActive ? 'tab-active' : ''}`}
            onClick={() => onSelectTab(id)}
            title={page.title || 'Untitled'}
          >
            <span className="tab-icon">{page.icon || '📄'}</span>
            <span className="tab-title">{page.title || 'Untitled'}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(id);
              }}
              title="Cerrar pestaña"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        );
      })}

      <button className="tab-new" onClick={onNewPage} title="Nueva página">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};

export default TabBar;
