const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    const txt = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return JSON.parse(txt);
  } catch {
    return {
      apiBaseUrl: 'http://localhost:3000',
      profile: 'balanced',
      enableNoFomoBlock: true,
      decisionLogLimit: 50,
    };
  }
}

function saveSettings(next) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
}

async function fetchConfigStatus() {
  const settings = loadSettings();
  const base = settings.apiBaseUrl || 'http://localhost:3000';
  const res = await fetch(`${base}/api/config-status`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`config-status http ${res.status}`);
  }
  return await res.json();
}

async function fetchDecisionLogs(limit = 50) {
  const settings = loadSettings();
  const base = settings.apiBaseUrl || 'http://localhost:3000';
  const res = await fetch(`${base}/api/decision-log?limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`decision-log http ${res.status}`);
  }
  return await res.json();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 760,
    title: 'Oracle-X NoFOMO Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (_, next) => {
  saveSettings(next);
  return { ok: true };
});
ipcMain.handle('config-status:get', async () => await fetchConfigStatus());
ipcMain.handle('decision-log:list', async (_, limit) => await fetchDecisionLogs(limit));

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
