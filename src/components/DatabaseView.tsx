import React, { useState, useCallback } from 'react';
import type { Page } from '../App';
import './DatabaseView.css';

type ViewMode = 'table' | 'kanban';
type Status = 'Backlog' | 'In Progress' | 'Done';

interface DatabaseRow {
  pageId: string;
  status: Status;
  tags: string[];
  date: string;
}

interface DatabaseViewProps {
  pages: Page[];
  onSelectPage: (id: string) => void;
}

const STATUS_COLUMNS: Status[] = ['Backlog', 'In Progress', 'Done'];

const DatabaseView: React.FC<DatabaseViewProps> = ({ pages, onSelectPage }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [rows, setRows] = useState<Record<string, DatabaseRow>>(() => {
    const saved = localStorage.getItem('tabula_database');
    if (saved) return JSON.parse(saved);
    const initial: Record<string, DatabaseRow> = {};
    pages.forEach(p => {
      initial[p.id] = { pageId: p.id, status: 'Backlog', tags: [], date: new Date(p.createdAt).toISOString().split('T')[0] };
    });
    return initial;
  });

  // Keep rows in sync with pages
  const getRow = (pageId: string): DatabaseRow => {
    if (rows[pageId]) return rows[pageId];
    return { pageId, status: 'Backlog', tags: [], date: new Date().toISOString().split('T')[0] };
  };

  const updateRow = useCallback((pageId: string, updates: Partial<DatabaseRow>) => {
    setRows(prev => {
      const newRows = { ...prev, [pageId]: { ...getRow(pageId), ...updates, pageId } };
      localStorage.setItem('tabula_database', JSON.stringify(newRows));
      return newRows;
    });
  }, [rows]);

  const getPagesByStatus = (status: Status) => {
    return pages.filter(p => getRow(p.id).status === status);
  };

  const handleDragStart = (e: React.DragEvent, pageId: string) => {
    e.dataTransfer.setData('text/plain', pageId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: Status) => {
    e.preventDefault();
    const pageId = e.dataTransfer.getData('text/plain');
    if (pageId) {
      updateRow(pageId, { status });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <div className="database-view">
      <div className="database-header">
        <h2 className="database-title">Database</h2>
        <div className="view-toggle">
          <button 
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            Table
          </button>
          <button 
            className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/>
            </svg>
            Board
          </button>
        </div>
      </div>

      {viewMode === 'table' && (
        <div className="database-table-wrapper">
          <table className="database-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {pages.map(page => {
                const row = getRow(page.id);
                return (
                  <tr key={page.id}>
                    <td>
                      <span className="table-page-link" onClick={() => onSelectPage(page.id)}>
                        {page.icon || '📄'} {page.title || 'Untitled'}
                      </span>
                    </td>
                    <td>
                      <select
                        className={`status-select status-${row.status.toLowerCase().replace(' ', '-')}`}
                        value={row.status}
                        onChange={(e) => updateRow(page.id, { status: e.target.value as Status })}
                      >
                        {STATUS_COLUMNS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        className="date-input"
                        value={row.date}
                        onChange={(e) => updateRow(page.id, { date: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'kanban' && (
        <div className="kanban-board">
          {STATUS_COLUMNS.map(status => (
            <div 
              key={status} 
              className="kanban-column"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div className="kanban-column-header">
                <span className={`kanban-status-dot status-${status.toLowerCase().replace(' ', '-')}`} />
                <span className="kanban-column-title">{status}</span>
                <span className="kanban-column-count">{getPagesByStatus(status).length}</span>
              </div>
              <div className="kanban-column-body">
                {getPagesByStatus(status).map(page => (
                  <div
                    key={page.id}
                    className="kanban-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, page.id)}
                    onClick={() => onSelectPage(page.id)}
                  >
                    <span className="kanban-card-icon">{page.icon || '📄'}</span>
                    <div className="kanban-card-info">
                      <span className="kanban-card-title">{page.title || 'Untitled'}</span>
                      <span className="kanban-card-date">{getRow(page.id).date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DatabaseView;
