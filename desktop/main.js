const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

const DEFAULT_SETTINGS = {
  aiProvider: 'stepfun',
  apiKey: '',
  apiBaseUrl: 'https://api.stepfun.com/v1',
  aiModel: 'step-1-8k',
  profile: 'balanced',
  decisionLogLimit: 50,
  enableNoFomoBlock: true,
  autoAnalyze: true,
  backendUrl: 'http://localhost:3000',
};

function loadSettings() {
  try {
    const txt = fs.readFileSync(SETTINGS_FILE, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(txt) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(next) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...DEFAULT_SETTINGS, ...next }, null, 2));
}

async function fetchConfigStatus() {
  const settings = loadSettings();
  const base = settings.backendUrl || 'http://localhost:3000';
  const res = await fetch(`${base}/api/config-status`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`config-status http ${res.status}`);
  return await res.json();
}

async function fetchDecisionLogs(limit = 50) {
  const settings = loadSettings();
  const base = settings.backendUrl || 'http://localhost:3000';
  const res = await fetch(`${base}/api/decision-log?limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`decision-log http ${res.status}`);
  return await res.json();
}

async function testConnection() {
  const settings = loadSettings();
  const base = settings.backendUrl || 'http://localhost:3000';
  try {
    const res = await fetch(`${base}/api/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
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
ipcMain.handle('connection:test', async () => await testConnection());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
