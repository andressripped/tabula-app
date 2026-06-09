import React from 'react';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateState: 'idle' | 'checking' | 'latest' | 'downloading' | 'ready' | 'error';
  downloadPercent: number;
  onCheckForUpdates: () => void;
  onRestartApp: () => void;
  errorMessage: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  updateState,
  downloadPercent,
  onCheckForUpdates,
  onRestartApp,
  errorMessage
}) => {
  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Ajustes</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">
          <div className="settings-sidebar-menu">
            <div className="menu-item active">Acerca de</div>
          </div>

          <div className="settings-main-panel">
            <div className="about-section">
              <div className="app-logo">T</div>
              <div className="app-details">
                <h2>Tabula</h2>
                <p className="app-version">Versión 0.0.2 (Producción)</p>
                <p className="app-desc">Un editor de notas personal, local y ultra-rápido.</p>
              </div>
            </div>

            <hr className="settings-divider" />

            <div className="updates-section">
              <h3>Actualizaciones de software</h3>
              
              <div className="update-status-container">
                {updateState === 'idle' && (
                  <p className="update-status-text">Buscar nuevas versiones disponibles.</p>
                )}
                {updateState === 'checking' && (
                  <div className="update-status-progress">
                    <div className="spinner" />
                    <span>Buscando actualizaciones...</span>
                  </div>
                )}
                {updateState === 'latest' && (
                  <p className="update-status-text success-text">Tu aplicación está al día con la última versión.</p>
                )}
                {updateState === 'downloading' && (
                  <div className="update-downloading-container">
                    <p className="update-status-text">Descargando actualización ({Math.round(downloadPercent)}%)...</p>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${downloadPercent}%` }} />
                    </div>
                  </div>
                )}
                {updateState === 'ready' && (
                  <p className="update-status-text success-text">La actualización se descargó por completo.</p>
                )}
                {updateState === 'error' && (
                  <p className="update-status-text error-text">
                    Error al buscar actualizaciones: {errorMessage || 'Conexión fallida'}
                  </p>
                )}
              </div>

              <div className="update-actions">
                {updateState !== 'checking' && updateState !== 'downloading' && updateState !== 'ready' && (
                  <button className="primary-btn" onClick={onCheckForUpdates}>
                    Buscar actualizaciones
                  </button>
                )}
                {updateState === 'ready' && (
                  <button className="accent-btn" onClick={onRestartApp}>
                    Reiniciar para actualizar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
