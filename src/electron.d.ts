interface Window {
  electronAPI?: {
    onUpdateAvailable: (callback: () => void) => void;
    onUpdateDownloaded: (callback: () => void) => void;
    restartApp: () => void;
  };
}
