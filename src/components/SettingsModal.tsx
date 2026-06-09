import React, { useState } from 'react';
import logoImg from '../assets/logo.png';
import './SettingsModal.css';

export type ThemeMode = 'dark' | 'light';
export type AccentColor = 'indigo' | 'blue' | 'pink' | 'green' | 'orange' | 'graphite';
export type FontFamily = 'sans' | 'serif' | 'mono';

export interface AppSettings {
  theme: ThemeMode;
  accent: AccentColor;
  font: FontFamily;
}

const ACCENT_COLORS: { key: AccentColor; label: string; color: string }[] = [
  { key: 'indigo', label: 'Indigo', color: '#6e5bfa' },
  { key: 'blue', label: 'Blue', color: '#007aff' },
  { key: 'pink', label: 'Pink', color: '#ff2d55' },
  { key: 'green', label: 'Green', color: '#30d158' },
  { key: 'orange', label: 'Orange', color: '#ff9f0a' },
  { key: 'graphite', label: 'Graphite', color: '#8e8e93' },
];

const FONT_OPTIONS: { key: FontFamily; label: string; preview: string }[] = [
  { key: 'sans', label: 'Sans-Serif', preview: 'Inter, SF Pro' },
  { key: 'serif', label: 'Serif', preview: 'Georgia, Times' },
  { key: 'mono', label: 'Monospace', preview: 'SF Mono, Consolas' },
];

export interface AIModelStatus {
  embedding: 'idle' | 'loading' | 'ready';
  llm: 'idle' | 'loading' | 'ready' | 'generating';
}

export interface AIProgressDetail {
  progress: number;
  loaded: number;
  total: number;
  file: string;
}

export interface AIModelProgress {
  embedding: AIProgressDetail;
  llm: AIProgressDetail;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateState: 'idle' | 'checking' | 'latest' | 'downloading' | 'ready' | 'error';
  downloadPercent: number;
  onCheckForUpdates: () => void;
  onRestartApp: () => void;
  errorMessage: string | null;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  aiStatus: AIModelStatus;
  aiProgress: AIModelProgress;
  onInitEmbedding: () => void;
  onInitLLM: () => void;
  onCancelLLM: () => void;
  appVersion: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  updateState,
  downloadPercent,
  onCheckForUpdates,
  onRestartApp,
  errorMessage,
  settings,
  onSettingsChange,
  aiStatus,
  aiProgress,
  onInitEmbedding,
  onInitLLM,
  onCancelLLM,
  appVersion
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'appearance' | 'ai'>('appearance');

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-sidebar-menu">
            <div 
              className={`menu-item ${activeTab === 'appearance' ? 'active' : ''}`} 
              onClick={() => setActiveTab('appearance')}
            >
              Appearance
            </div>
            <div 
              className={`menu-item ${activeTab === 'ai' ? 'active' : ''}`} 
              onClick={() => setActiveTab('ai')}
            >
              Local AI
            </div>
            <div 
              className={`menu-item ${activeTab === 'about' ? 'active' : ''}`} 
              onClick={() => setActiveTab('about')}
            >
              About
            </div>
          </div>

          <div className="settings-main-panel">
            {activeTab === 'appearance' && (
              <div className="appearance-section">
                {/* Theme */}
                <div className="setting-group">
                  <h3>Theme</h3>
                  <div className="theme-switcher">
                    <button 
                      className={`theme-option ${settings.theme === 'dark' ? 'active' : ''}`}
                      onClick={() => onSettingsChange({ ...settings, theme: 'dark' })}
                    >
                      <div className="theme-preview dark-preview">
                        <div className="tp-sidebar" />
                        <div className="tp-content">
                          <div className="tp-line" /><div className="tp-line short" />
                        </div>
                      </div>
                      <span>Dark</span>
                    </button>
                    <button 
                      className={`theme-option ${settings.theme === 'light' ? 'active' : ''}`}
                      onClick={() => onSettingsChange({ ...settings, theme: 'light' })}
                    >
                      <div className="theme-preview light-preview">
                        <div className="tp-sidebar" />
                        <div className="tp-content">
                          <div className="tp-line" /><div className="tp-line short" />
                        </div>
                      </div>
                      <span>Light</span>
                    </button>
                  </div>
                </div>

                {/* Accent Color */}
                <div className="setting-group">
                  <h3>Accent Color</h3>
                  <div className="accent-grid">
                    {ACCENT_COLORS.map(ac => (
                      <button
                        key={ac.key}
                        className={`accent-swatch ${settings.accent === ac.key ? 'active' : ''}`}
                        style={{ '--swatch-color': ac.color } as React.CSSProperties}
                        onClick={() => onSettingsChange({ ...settings, accent: ac.key })}
                        title={ac.label}
                      >
                        <div className="swatch-circle" />
                        <span className="swatch-label">{ac.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <div className="setting-group">
                  <h3>Editor Font</h3>
                  <div className="font-options">
                    {FONT_OPTIONS.map(fo => (
                      <button
                        key={fo.key}
                        className={`font-option ${settings.font === fo.key ? 'active' : ''}`}
                        onClick={() => onSettingsChange({ ...settings, font: fo.key })}
                      >
                        <span className="font-option-label">{fo.label}</span>
                        <span className="font-option-preview">{fo.preview}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'about' && (
              <>
                <div className="about-section">
                  <div className="app-logo" style={{ background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <img src={logoImg} alt="Tabula Logo" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                  </div>
                  <div className="app-details">
                    <h2>Tabula</h2>
                    <p className="app-version">Version {appVersion} (Production)</p>
                    <p className="app-desc">A personal, local, ultra-fast note editor.</p>
                  </div>
                </div>

                <hr className="settings-divider" />

                <div className="updates-section">
                  <h3>Software Updates</h3>
                  
                  <div className="update-status-container">
                    {updateState === 'idle' && (
                      <p className="update-status-text">Check for new available versions.</p>
                    )}
                    {updateState === 'checking' && (
                      <div className="update-status-progress">
                        <div className="spinner" />
                        <span>Checking for updates...</span>
                      </div>
                    )}
                    {updateState === 'latest' && (
                      <p className="update-status-text success-text">Your app is up to date.</p>
                    )}
                    {updateState === 'downloading' && (
                      <div className="update-downloading-container">
                        <p className="update-status-text">Downloading update ({Math.round(downloadPercent)}%)...</p>
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${downloadPercent}%` }} />
                        </div>
                      </div>
                    )}
                    {updateState === 'ready' && (
                      <p className="update-status-text success-text">Update downloaded successfully.</p>
                    )}
                    {updateState === 'error' && (
                      <p className="update-status-text error-text">
                        Error: {errorMessage || 'Connection failed'}
                      </p>
                    )}
                  </div>

                  <div className="update-actions">
                    {updateState !== 'checking' && updateState !== 'downloading' && updateState !== 'ready' && (
                      <button className="primary-btn" onClick={onCheckForUpdates}>
                        Check for updates
                      </button>
                    )}
                    {updateState === 'ready' && (
                      <button className="accent-btn" onClick={onRestartApp}>
                        Restart to update
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'ai' && (
              <div className="ai-section">
                <div className="setting-group">
                  <h3>Búsqueda Semántica (IA Local)</h3>
                  <p className="setting-desc" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                    Busca notas usando conceptos y significados en lugar de coincidencia exacta de palabras. Utiliza un modelo liviano de embeddings (23 MB).
                  </p>
                  <div className="ai-model-status-container" style={{ marginTop: '10px' }}>
                    {aiStatus.embedding === 'idle' && (
                      <button className="primary-btn" onClick={onInitEmbedding}>
                        Activar Búsqueda Semántica
                      </button>
                    )}
                    {aiStatus.embedding === 'loading' && (
                      <div className="ai-model-loading" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="spinner" />
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {aiProgress.embedding.file ? `Cargando ${aiProgress.embedding.file.split('/').pop()}` : 'Cargando modelo de embeddings'} ({Math.round(aiProgress.embedding.progress)}%)...
                          </span>
                        </div>
                        {aiProgress.embedding.total > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                            {(aiProgress.embedding.loaded / (1024 * 1024)).toFixed(1)} MB / {(aiProgress.embedding.total / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        )}
                        <div className="progress-bar-bg" style={{ height: '6px', background: 'var(--bg-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div className="progress-bar-fill" style={{ width: `${aiProgress.embedding.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.1s ease-out' }} />
                        </div>
                      </div>
                    )}
                    {aiStatus.embedding === 'ready' && (
                      <span className="success-text" style={{ color: '#30d158', fontWeight: 500, fontSize: '14px' }}>✓ Búsqueda Semántica Activa (Offline)</span>
                    )}
                  </div>
                </div>

                <hr className="settings-divider" style={{ border: 'none', height: '1px', background: 'var(--border)', margin: '20px 0' }} />

                <div className="setting-group">
                  <h3>Asistente de IA Offline (Generador)</h3>
                  <p className="setting-desc" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '12px' }}>
                    Genera bloques de texto, ideas o estructuras como tablas directamente en tus notas sin enviar datos a internet. Requiere el modelo TinyLlama-1.1B (~350 MB cuantizado a 4-bit).
                  </p>
                  <div className="ai-model-status-container" style={{ marginTop: '10px' }}>
                    {aiStatus.llm === 'idle' && (
                      <button className="primary-btn" onClick={onInitLLM}>
                        Descargar Asistente de IA (~350 MB)
                      </button>
                    )}
                    {aiStatus.llm === 'loading' && (
                      <div className="ai-model-loading" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="spinner" />
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {aiProgress.llm.file ? `Descargando ${aiProgress.llm.file.split('/').pop()}` : 'Descargando modelo de lenguaje'} ({Math.round(aiProgress.llm.progress)}%)...
                          </span>
                        </div>
                        {aiProgress.llm.total > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '-4px' }}>
                            {(aiProgress.llm.loaded / (1024 * 1024)).toFixed(1)} MB / {(aiProgress.llm.total / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        )}
                        <div className="progress-bar-bg" style={{ height: '6px', background: 'var(--bg-hover)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div className="progress-bar-fill" style={{ width: `${aiProgress.llm.progress}%`, height: '100%', background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.1s ease-out' }} />
                        </div>
                        <button
                          onClick={onCancelLLM}
                          style={{
                            marginTop: '4px',
                            padding: '5px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            alignSelf: 'flex-start'
                          }}
                        >
                          Cancelar descarga
                        </button>
                      </div>
                    )}
                    {(aiStatus.llm === 'ready' || aiStatus.llm === 'generating') && (
                      <span className="success-text" style={{ color: '#30d158', fontWeight: 500, fontSize: '14px' }}>✓ Asistente de IA Listo (Escribe /ai en el editor)</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
