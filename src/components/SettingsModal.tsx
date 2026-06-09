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
  onSettingsChange
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'appearance'>('appearance');

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
                    <p className="app-version">Version 0.0.8 (Production)</p>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
