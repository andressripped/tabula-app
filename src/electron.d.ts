interface Window {
  electronAPI?: {
    checkForUpdates: () => void;
    onCheckingForUpdate: (callback: () => void) => void;
    onUpdateAvailable: (callback: () => void) => void;
    onUpdateNotAvailable: (callback: () => void) => void;
    onDownloadProgress: (callback: (percent: number) => void) => void;
    onUpdateDownloaded: (callback: () => void) => void;
    onUpdateError: (callback: (errorMsg: string) => void) => void;
    restartApp: () => void;
  };
}
