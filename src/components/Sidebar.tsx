import React, { useState } from 'react';
import type { Page } from '../App';
import './Sidebar.css';

interface SidebarProps {
  pages: Page[];
  activePageId: string | null;
  favoriteIds: string[];
  trash: Page[];
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onDeletePage: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRestoreFromTrash: (id: string) => void;
  onDeleteFromTrash: (id: string) => void;
  onEmptyTrash: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenDatabase: () => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  pages, 
  activePageId, 
  favoriteIds,
  trash,
  onSelectPage, 
  onCreatePage, 
  onDeletePage,
  onToggleFavorite,
  onRestoreFromTrash,
  onDeleteFromTrash,
  onEmptyTrash,
  onOpenSettings,
  onOpenSearch,
  onOpenDatabase,
  onExportMarkdown,
  onExportJSON
}) => {
  const [showTrash, setShowTrash] = useState(false);

  const favoritePages = pages.filter(p => favoriteIds.includes(p.id));
  const otherPages = pages.filter(p => !favoriteIds.includes(p.id));

  const renderPageItem = (page: Page) => (
    <div 
      key={page.id} 
      className={`page-item ${activePageId === page.id ? 'active' : ''}`}
      onClick={() => onSelectPage(page.id)}
    >
      <span className="page-icon">{page.icon || '📄'}</span>
      <span className="page-title">{page.title || 'Untitled'}</span>
      <div className="page-actions">
        <button 
          className={`pin-btn ${favoriteIds.includes(page.id) ? 'pinned' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(page.id);
          }}
          title={favoriteIds.includes(page.id) ? 'Unpin' : 'Pin to top'}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill={favoriteIds.includes(page.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </button>
        <button 
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDeletePage(page.id);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-profile">
          <div className="avatar" style={{ background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.png" alt="Tabula Logo" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
          </div>
          <span className="workspace-name">My Workspace</span>
        </div>
      </div>
      
      <div className="sidebar-actions">
        <button className="sidebar-action-btn" onClick={onOpenSearch}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Search</span>
          <span className="shortcut-hint">Ctrl P</span>
        </button>
        <button className="sidebar-action-btn" onClick={onOpenDatabase}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
          <span>Database</span>
        </button>
      </div>

      <div className="sidebar-content">
        {favoritePages.length > 0 && (
          <>
            <div className="section-label">Favorites</div>
            <div className="pages-list">
              {favoritePages.map(renderPageItem)}
            </div>
          </>
        )}

        <div className="section-label">{favoritePages.length > 0 ? 'Pages' : 'All Pages'}</div>
        <div className="pages-list">
          {otherPages.map(renderPageItem)}
        </div>
        
        <button className="new-page-btn" onClick={onCreatePage}>
          + New Page
        </button>

        {/* Export section */}
        <div className="section-label" style={{ marginTop: '16px' }}>Export</div>
        <button className="sidebar-action-btn small" onClick={onExportMarkdown}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          <span>Export as Markdown</span>
        </button>
        <button className="sidebar-action-btn small" onClick={onExportJSON}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Backup (JSON)</span>
        </button>
      </div>

      <div className="sidebar-footer">
        {/* Trash */}
        <button className="sidebar-action-btn trash-btn" onClick={() => setShowTrash(!showTrash)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          <span>Trash</span>
          {trash.length > 0 && <span className="trash-count">{trash.length}</span>}
        </button>

        {showTrash && trash.length > 0 && (
          <div className="trash-panel">
            <div className="trash-header">
              <span className="trash-title">Deleted Pages</span>
              <button className="trash-empty-btn" onClick={onEmptyTrash}>Empty</button>
            </div>
            {trash.map(page => (
              <div key={page.id} className="trash-item">
                <span className="trash-item-icon">{page.icon || '📄'}</span>
                <span className="trash-item-title">{page.title || 'Untitled'}</span>
                <div className="trash-item-actions">
                  <button className="trash-restore-btn" onClick={() => onRestoreFromTrash(page.id)} title="Restore">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                  </button>
                  <button className="trash-delete-btn" onClick={() => onDeleteFromTrash(page.id)} title="Delete permanently">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="settings-btn" onClick={onOpenSettings}>
          <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
