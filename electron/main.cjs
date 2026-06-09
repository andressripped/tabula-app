const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Basic auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden', // Apple dark mode frameless style
    titleBarOverlay: {
      color: '#0d0d0d',
      symbolColor: '#f5f5f7',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: process.platform === 'win32'
      ? path.join(__dirname, '../dist/icon.ico')
      : path.join(__dirname, '../dist/logo.png'),
    show: false, // Wait until ready-to-show to avoid flickering
    backgroundColor: '#0d0d0d'
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle IPC calls for auto-updater
  ipcMain.on('check-for-updates', () => {
    autoUpdater.checkForUpdates();
  });

  // Return app version to renderer
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('checking-for-update');
  });

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update-available');
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('download-progress', progressObj.percent);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update-downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update-error', err.message);
  });

  ipcMain.on('restart-app', () => {
    autoUpdater.quitAndInstall();
  });

  // Handle right-click context menu for spellcheck and text actions
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Add spelling suggestions
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(new MenuItem({
        label: suggestion,
        click: () => mainWindow.webContents.replaceMisspelling(suggestion)
      }));
    }

    // Allow users to add misspelled word to dictionary
    if (params.misspelledWord) {
      menu.append(new MenuItem({
        label: 'Agregar al diccionario',
        click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }));
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }));
      }
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ label: 'Cortar', role: 'cut', enabled: params.editFlags.canCut }));
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy', enabled: params.editFlags.canCopy }));
      menu.append(new MenuItem({ label: 'Pegar', role: 'paste', enabled: params.editFlags.canPaste }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ label: 'Seleccionar todo', role: 'selectAll' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ label: 'Copiar', role: 'copy' }));
    }

    if (menu.items.length > 0) {
      menu.popup();
    }
  });

  return mainWindow;
}

app.whenReady().then(() => {
  createWindow();

  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
