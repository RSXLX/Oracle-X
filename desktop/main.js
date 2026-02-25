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
    };
  }
}

function saveSettings(next) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 700,
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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
