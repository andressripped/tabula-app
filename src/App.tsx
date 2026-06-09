import { useState, useEffect, useCallback } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import EditorCanvas from './components/EditorCanvas';
import SettingsModal, { type AppSettings } from './components/SettingsModal';
import SearchPalette from './components/SearchPalette';
import DatabaseView from './components/DatabaseView';

// Basic Types
export interface Block {
  id: string;
  type: 'p' | 'h1' | 'h2' | 'h3' | 'list' | 'todo' | 'quote' | 'callout' | 'code' | 'divider' | 'image';
  content: string;
  checked?: boolean;
  language?: string;
  imageData?: string;
}

export interface Page {
  id: string;
  title: string;
  icon: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

const createEmptyPage = (): Page => ({
  id: crypto.randomUUID(),
  title: 'Untitled',
  icon: '📄',
  blocks: [{ id: crypto.randomUUID(), type: 'h1', content: '' }, { id: crypto.randomUUID(), type: 'p', content: '' }],
  createdAt: Date.now(),
  updatedAt: Date.now()
});

// ─── Theme application ──────────────────────────────────────
const ACCENT_MAP: Record<string, { accent: string; hover: string }> = {
  indigo:   { accent: '#6e5bfa', hover: '#8170fb' },
  blue:     { accent: '#007aff', hover: '#339aff' },
  pink:     { accent: '#ff2d55', hover: '#ff5070' },
  green:    { accent: '#30d158', hover: '#4de06e' },
  orange:   { accent: '#ff9f0a', hover: '#ffb340' },
  graphite: { accent: '#8e8e93', hover: '#a1a1a6' },
};

const FONT_MAP: Record<string, string> = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji'",
  serif: "Georgia, 'Times New Roman', Times, serif, 'Apple Color Emoji'",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace, 'Apple Color Emoji'",
};

function applySettings(settings: AppSettings) {
  const root = document.documentElement;
  
  // Theme
  if (settings.theme === 'light') {
    root.style.setProperty('--bg-primary', '#ffffff');
    root.style.setProperty('--bg-sidebar', '#f5f5f7');
    root.style.setProperty('--bg-elevated', '#e8e8ed');
    root.style.setProperty('--bg-hover', '#e0e0e5');
    root.style.setProperty('--border', 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--text-primary', '#1d1d1f');
    root.style.setProperty('--text-secondary', '#6e6e73');
    root.style.setProperty('--text-tertiary', '#aeaeb2');
  } else {
    root.style.setProperty('--bg-primary', '#0d0d0d');
    root.style.setProperty('--bg-sidebar', '#161616');
    root.style.setProperty('--bg-elevated', '#1c1c1e');
    root.style.setProperty('--bg-hover', '#242424');
    root.style.setProperty('--border', 'rgba(255, 255, 255, 0.06)');
    root.style.setProperty('--text-primary', '#f5f5f7');
    root.style.setProperty('--text-secondary', '#8e8e93');
    root.style.setProperty('--text-tertiary', '#48484a');
  }
  
  // Accent color
  const accentConfig = ACCENT_MAP[settings.accent] || ACCENT_MAP.indigo;
  root.style.setProperty('--accent', accentConfig.accent);
  root.style.setProperty('--accent-hover', accentConfig.hover);
  
  // Font
  const fontStack = FONT_MAP[settings.font] || FONT_MAP.sans;
  root.style.setProperty('--font-family', fontStack);
}

// ─── Export helpers ──────────────────────────────────────────
function pageToMarkdown(page: Page): string {
  let md = `# ${page.title}\n\n`;
  for (const block of page.blocks) {
    switch (block.type) {
      case 'h1': md += `# ${block.content}\n\n`; break;
      case 'h2': md += `## ${block.content}\n\n`; break;
      case 'h3': md += `### ${block.content}\n\n`; break;
      case 'p': md += `${block.content}\n\n`; break;
      case 'list': md += `- ${block.content}\n`; break;
      case 'todo': md += `- [${block.checked ? 'x' : ' '}] ${block.content}\n`; break;
      case 'quote': md += `> ${block.content}\n\n`; break;
      case 'callout': md += `> **Note:** ${block.content}\n\n`; break;
      case 'code': md += `\`\`\`${block.language || ''}\n${block.content}\n\`\`\`\n\n`; break;
      case 'divider': md += `---\n\n`; break;
      case 'image': md += block.imageData ? `![image](embedded)\n\n` : ''; break;
    }
  }
  return md;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const DEFAULT_SETTINGS: AppSettings = { theme: 'dark', accent: 'indigo', font: 'sans' };

function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [trash, setTrash] = useState<Page[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [zenMode, setZenMode] = useState(false);
  
  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'latest' | 'downloading' | 'ready' | 'error'>('idle');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tabula_pages');
    if (saved) {
      const parsedPages = JSON.parse(saved);
      setPages(parsedPages);
      if (parsedPages.length > 0) setActivePageId(parsedPages[0].id);
    } else {
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

    const savedFavs = localStorage.getItem('tabula_favorites');
    if (savedFavs) setFavoriteIds(JSON.parse(savedFavs));

    const savedTrash = localStorage.getItem('tabula_trash');
    if (savedTrash) setTrash(JSON.parse(savedTrash));

    const savedSettings = localStorage.getItem('tabula_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      applySettings(parsed);
    }

    if (window.electronAPI) {
      window.electronAPI.onCheckingForUpdate(() => { setUpdateState('checking'); setErrorMessage(null); });
      window.electronAPI.onUpdateAvailable(() => { setUpdateState('downloading'); setDownloadPercent(0); });
      window.electronAPI.onUpdateNotAvailable(() => { setUpdateState('latest'); });
      window.electronAPI.onDownloadProgress((percent) => { setUpdateState('downloading'); setDownloadPercent(percent); });
      window.electronAPI.onUpdateDownloaded(() => { setUpdateState('ready'); });
      window.electronAPI.onUpdateError((msg) => { setUpdateState('error'); setErrorMessage(msg); });
    }
  }, []);

  // Autosave
  useEffect(() => {
    if (pages.length > 0) localStorage.setItem('tabula_pages', JSON.stringify(pages));
  }, [pages]);
  useEffect(() => { localStorage.setItem('tabula_favorites', JSON.stringify(favoriteIds)); }, [favoriteIds]);
  useEffect(() => { localStorage.setItem('tabula_trash', JSON.stringify(trash)); }, [trash]);
  useEffect(() => { localStorage.setItem('tabula_settings', JSON.stringify(settings)); }, [settings]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
      // Ctrl+\ for Zen mode
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        setZenMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
    const pageToDelete = pages.find(p => p.id === id);
    if (pageToDelete) setTrash(prev => [pageToDelete, ...prev]);
    const newPages = pages.filter(p => p.id !== id);
    setPages(newPages);
    if (activePageId === id) setActivePageId(newPages.length > 0 ? newPages[0].id : null);
    setFavoriteIds(prev => prev.filter(fid => fid !== id));
  };

  const handleRestoreFromTrash = useCallback((id: string) => {
    const pageToRestore = trash.find(p => p.id === id);
    if (pageToRestore) {
      setPages(prev => [pageToRestore, ...prev]);
      setTrash(prev => prev.filter(p => p.id !== id));
      setActivePageId(pageToRestore.id);
    }
  }, [trash]);

  const handleDeleteFromTrash = useCallback((id: string) => {
    setTrash(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleEmptyTrash = useCallback(() => { setTrash([]); }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setFavoriteIds(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
  }, []);

  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    applySettings(newSettings);
  }, []);

  // Export handlers
  const handleExportMarkdown = useCallback(() => {
    if (!activePage) return;
    downloadFile(pageToMarkdown(activePage), `${activePage.title || 'untitled'}.md`, 'text/markdown');
  }, [activePage]);

  const handleExportJSON = useCallback(() => {
    downloadFile(JSON.stringify({ pages, favorites: favoriteIds }, null, 2), 'tabula-backup.json', 'application/json');
  }, [pages, favoriteIds]);

  const handleRestartApp = () => { if (window.electronAPI) window.electronAPI.restartApp(); };
  const handleCheckForUpdates = () => { if (window.electronAPI) window.electronAPI.checkForUpdates(); };

  return (
    <>
      <div className="titlebar">
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '8px' }}>Tabula</div>
      </div>
      <div className={`app-container ${zenMode ? 'zen-mode' : ''}`}>
        <Sidebar 
          pages={pages} 
          activePageId={activePageId} 
          favoriteIds={favoriteIds}
          trash={trash}
          onSelectPage={setActivePageId}
          onCreatePage={handleCreatePage}
          onDeletePage={handleDeletePage}
          onToggleFavorite={handleToggleFavorite}
          onRestoreFromTrash={handleRestoreFromTrash}
          onDeleteFromTrash={handleDeleteFromTrash}
          onEmptyTrash={handleEmptyTrash}
          onOpenSettings={() => setShowSettings(true)}
          onOpenSearch={() => setShowSearch(true)}
          onOpenDatabase={() => setShowDatabase(!showDatabase)}
          onExportMarkdown={handleExportMarkdown}
          onExportJSON={handleExportJSON}
        />
        <div className="main-content">
          {showDatabase ? (
            <DatabaseView pages={pages} onSelectPage={(id) => { setActivePageId(id); setShowDatabase(false); }} />
          ) : activePage ? (
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
        settings={settings}
        onSettingsChange={handleSettingsChange}
      />

      <SearchPalette
        pages={pages}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectPage={(id) => { setActivePageId(id); setShowSearch(false); }}
      />
    </>
  );
}

export default App;
