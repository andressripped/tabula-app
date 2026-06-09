import React from 'react';
import type { Page } from '../App';
import './Sidebar.css';

interface SidebarProps {
  pages: Page[];
  activePageId: string | null;
  onSelectPage: (id: string) => void;
  onCreatePage: () => void;
  onDeletePage: (id: string) => void;
  updateStatus: 'idle' | 'available' | 'downloaded';
  onRestartApp: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  pages, 
  activePageId, 
  onSelectPage, 
  onCreatePage, 
  onDeletePage,
  updateStatus,
  onRestartApp
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-profile">
          <div className="avatar">T</div>
          <span className="workspace-name">My Workspace</span>
        </div>
      </div>
      
      <div className="sidebar-content">
        <div className="pages-list">
          {pages.map(page => (
            <div 
              key={page.id} 
              className={`page-item ${activePageId === page.id ? 'active' : ''}`}
              onClick={() => onSelectPage(page.id)}
            >
              <span className="page-icon">{page.icon || '📄'}</span>
              <span className="page-title">{page.title || 'Untitled'}</span>
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
          ))}
        </div>
        
        <button className="new-page-btn" onClick={onCreatePage}>
          + New Page
        </button>
      </div>

      {updateStatus !== 'idle' && (
        <div className="sidebar-footer">
          {updateStatus === 'available' && (
            <div className="update-status-banner">
              <span className="update-spinner">⚙️</span>
              <span>Descargando actualización...</span>
            </div>
          )}
          {updateStatus === 'downloaded' && (
            <button className="update-btn" onClick={onRestartApp}>
              🚀 Reiniciar para actualizar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;
