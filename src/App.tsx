import { useState, useEffect } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import EditorCanvas from './components/EditorCanvas';
import SettingsModal from './components/SettingsModal';

// Basic Types
export interface Block {
  id: string;
  type: 'p' | 'h1' | 'h2' | 'h3' | 'list' | 'todo';
  content: string;
  checked?: boolean; // For todo items
}

export interface Page {
  id: string;
  title: string;
  icon: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

// Initial empty page
const createEmptyPage = (): Page => ({
  id: crypto.randomUUID(),
  title: 'Untitled',
  icon: '📄',
  blocks: [{ id: crypto.randomUUID(), type: 'h1', content: '' }, { id: crypto.randomUUID(), type: 'p', content: '' }],
  createdAt: Date.now(),
  updatedAt: Date.now()
});

function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  
  // Settings & Updates State
  const [showSettings, setShowSettings] = useState(false);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'latest' | 'downloading' | 'ready' | 'error'>('idle');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tabula_pages');
    if (saved) {
      const parsedPages = JSON.parse(saved);
      setPages(parsedPages);
      if (parsedPages.length > 0) {
        setActivePageId(parsedPages[0].id);
      }
    } else {
      // First time user
      const initialPage = createEmptyPage();
      initialPage.title = 'Welcome to Tabula';
      initialPage.blocks = [
        { id: crypto.randomUUID(), type: 'h1', content: 'Welcome to Tabula' },
        { id: crypto.randomUUID(), type: 'p', content: 'A fast, local, private note-taking app.' },
        { id: crypto.randomUUID(), type: 'todo', content: 'Try pressing "/" to open the command menu', checked: false }
      ];
      setPages([initialPage]);
      setActivePageId(initialPage.id);
    }

    if (window.electronAPI) {
      window.electronAPI.onCheckingForUpdate(() => {
        setUpdateState('checking');
        setErrorMessage(null);
      });
      window.electronAPI.onUpdateAvailable(() => {
        setUpdateState('downloading');
        setDownloadPercent(0);
      });
      window.electronAPI.onUpdateNotAvailable(() => {
        setUpdateState('latest');
      });
      window.electronAPI.onDownloadProgress((percent) => {
        setUpdateState('downloading');
        setDownloadPercent(percent);
      });
      window.electronAPI.onUpdateDownloaded(() => {
        setUpdateState('ready');
      });
      window.electronAPI.onUpdateError((msg) => {
        setUpdateState('error');
        setErrorMessage(msg);
      });
    }
  }, []);

  // Autosave when pages change
  useEffect(() => {
    if (pages.length > 0) {
      localStorage.setItem('tabula_pages', JSON.stringify(pages));
    }
  }, [pages]);

  const activePage = pages.find(p => p.id === activePageId);

  const handleUpdatePage = (updatedPage: Page) => {
    setPages(pages.map(p => p.id === updatedPage.id ? { ...updatedPage, updatedAt: Date.now() } : p));
  };

  const handleCreatePage = () => {
    const newPage = createEmptyPage();
    setPages([newPage, ...pages]);
    setActivePageId(newPage.id);
  };

  const handleDeletePage = (id: string) => {
    const newPages = pages.filter(p => p.id !== id);
    setPages(newPages);
    if (activePageId === id) {
      setActivePageId(newPages.length > 0 ? newPages[0].id : null);
    }
  };

  const handleRestartApp = () => {
    if (window.electronAPI) {
      window.electronAPI.restartApp();
    }
  };

  const handleCheckForUpdates = () => {
    if (window.electronAPI) {
      window.electronAPI.checkForUpdates();
    }
  };

  return (
    <>
      <div className="titlebar">
        {/* We can put custom window controls here if needed, or just drag area */}
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '8px' }}>Tabula</div>
      </div>
      <div className="app-container">
        <Sidebar 
          pages={pages} 
          activePageId={activePageId} 
          onSelectPage={setActivePageId}
          onCreatePage={handleCreatePage}
          onDeletePage={handleDeletePage}
          onOpenSettings={() => setShowSettings(true)}
        />
        <div className="main-content">
          {activePage ? (
            <EditorCanvas key={activePage.id} page={activePage} onUpdate={handleUpdatePage} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              No page selected. Create one!
            </div>
          )}
        </div>
      </div>

      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        updateState={updateState}
        downloadPercent={downloadPercent}
        onCheckForUpdates={handleCheckForUpdates}
        onRestartApp={handleRestartApp}
        errorMessage={errorMessage}
      />
    </>
  );
}

export default App;
