import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import Store from 'electron-store';
import { registerIpcHandlers } from './ipc/register.js';
import { DataStore, resolveDatabasePath } from './db/index.js';
import { SettingsManager } from './utils/settings.js';
import { RunExecutor } from './run/executor.js';

const isDev = !app.isPackaged || Boolean(process.env.VITE_DEV_SERVER_URL);

let mainWindow: BrowserWindow | null = null;
let dataStore: DataStore;
const settings = new SettingsManager();
let executor: RunExecutor;

const windowStateStore = new Store<{ width: number; height: number; x?: number; y?: number }>({
  name: 'window-state',
  defaults: { width: 1280, height: 800 },
});

function createWindow() {
  const bounds = windowStateStore.store;
  const preload = path.join(app.getAppPath(), 'dist/preload/index.js');
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', () => {
    if (!mainWindow) return;
    const newBounds = mainWindow.getBounds();
    windowStateStore.store = {
      width: newBounds.width,
      height: newBounds.height,
      x: newBounds.x,
      y: newBounds.y,
    };
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (isDev && devServer) {
    mainWindow.loadURL(devServer);
  } else {
    const indexHtml = path.join(app.getAppPath(), 'dist/renderer/index.html');
    mainWindow.loadFile(indexHtml);
  }
}

function setupCsp() {
  const policyParts = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "script-src 'self'",
    "connect-src 'self'",
  ];
  if (isDev) {
    policyParts.push('connect-src http://localhost:5173 ws://localhost:5173');
  }
  const csp = policyParts.join('; ');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });
}

function setupAutoUpdateScaffolding() {
  // Placeholder: auto-update intentionally disabled for security during development.
  if (isDev) {
    console.info('Auto-update check is disabled in development.');
  }
}

app.whenReady().then(() => {
  const dbPath = resolveDatabasePath(app.getPath('userData'), settings.get().databasePath || undefined);
  dataStore = new DataStore(dbPath);
  executor = new RunExecutor(dataStore, () => settings.get());

  registerIpcHandlers(() => mainWindow, dataStore, executor, settings);
  createWindow();
  if (!mainWindow) return;
  setupCsp();
  setupAutoUpdateScaffolding();

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow) {
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  dataStore?.close();
});
