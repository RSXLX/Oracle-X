/**
 * Oracle-X Desktop - Main Process
 * 支持全局应用监听 + 截图 AI 分析 + 系统托盘
 */

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { GlobalAppMonitor, MONITOR_MODES } = require('./monitor');
const { ScreenshotAnalyzer } = require('./screenshot-analyzer');
const { TrayManager } = require('./tray-manager');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = isDev ? 3000 : 3000;

let mainWindow = null;
let trayManager = null;
let monitor = null;
let screenshotAnalyzer = null;

let settings = {
  aiProvider: 'stepfun',
  apiKey: '',
  apiBaseUrl: 'https://api.stepfun.com/v1',
  aiModel: 'step-1-8k',
  monitorMode: MONITOR_MODES.SCREENSHOT,
  targetApps: ['Binance', 'OKX', 'Bybit', 'Coinbase'],
  cooldown: 5,
  enableBlock: true,
  backendUrl: `http://localhost:${PORT}`,
  minimizeToTray: true,  // 关闭时最小化到托盘
};

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  
  mainWindow = new BrowserWindow({
    width: Math.min(900, width * 0.8),
    height: Math.min(800, height * 0.9),
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d1117',
    show: false,
    // 关闭时最小化到托盘
    closePolicy: settings.minimizeToTray ? 'hide' : undefined,
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Oracle-X] Desktop started');
  });

  // 初始化托盘
  trayManager = new TrayManager(mainWindow);
  trayManager.create();
}

function initScreenshotAnalyzer() {
  screenshotAnalyzer = new ScreenshotAnalyzer({
    visionProvider: settings.aiProvider,
    apiKey: settings.apiKey,
    apiBaseUrl: settings.apiBaseUrl,
    model: settings.aiModel,
  });
}

function initMonitor() {
  monitor = new GlobalAppMonitor({
    mode: settings.monitorMode,
    targetApps: settings.targetApps,
    
    onAppActivated: async (appName) => {
      console.log('[Monitor] App activated:', appName);
      if (mainWindow) mainWindow.webContents.send('app-activated', appName);
      if (settings.enableBlock) await showFomoWarning(appName);
    },
    
    onScreenshot: async (screenshotPath) => {
      console.log('[Monitor] Screenshot captured');
      if (screenshotAnalyzer && settings.apiKey) {
        try {
          const result = await screenshotAnalyzer.analyze(screenshotPath);
          console.log('[Analyzer] Result:', result);
          if (mainWindow) mainWindow.webContents.send('screenshot-analyzed', result);
          if (result.action === 'block' && settings.enableBlock) {
            await showFomoWarning(result.platform || 'Trading App', result);
          }
        } catch (err) {
          console.error('[Analyzer] Error:', err.message);
        }
      }
    },
  });
  
  monitor.start();
  console.log('[Monitor] Started');
}

async function showFomoWarning(appName, analysis = null) {
  const { dialog } = require('electron');
  
  let detail = `检测到您正在 ${appName} 交易\n\n冷静期: ${settings.cooldown} 秒`;
  if (analysis?.buttons?.length) detail += `\n\n检测到按钮: ${analysis.buttons.join(', ')}`;
  if (analysis?.riskLevel) detail += `\n\n风险等级: ${analysis.riskLevel.toUpperCase()}`;
  
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '⚠️ Oracle-X 警告',
    message: '检测到交易操作',
    detail,
    buttons: ['取消交易', '我确认冷静了，继续'],
    defaultId: 0,
    cancelId: 0,
  });
  
  console.log('[Oracle-X] Decision:', result.response === 1 ? 'CONTINUE' : 'CANCELLED');
  return result.response === 1;
}

function setupIPC() {
  ipcMain.handle('getSettings', () => settings);

  ipcMain.handle('saveSettings', (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    if (monitor) { monitor.targetApps = settings.targetApps; monitor.mode = settings.monitorMode; }
    if (screenshotAnalyzer) screenshotAnalyzer.configure({ visionProvider: settings.aiProvider, apiKey: settings.apiKey, apiBaseUrl: settings.apiBaseUrl, model: settings.aiModel });
    return true;
  });

  ipcMain.handle('testConnection', async () => {
    try { const res = await fetch(`${settings.backendUrl}/api/config-status`); return res.ok; } catch { return false; }
  });

  ipcMain.handle('listDecisionLogs', async (event, limit = 50) => {
    try { const res = await fetch(`${settings.backendUrl}/api/decision-log?limit=${limit}`); return await res.json(); } catch { return { items: [] }; }
  });

  ipcMain.handle('analyzeNow', async (event, data) => {
    try { const res = await fetch(`${settings.backendUrl}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return await res.json(); } catch { return { error: err.message }; }
  });

  ipcMain.handle('takeScreenshot', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
      exec(`screencapture -x ${tmpFile}`, (err) => resolve(err ? null : tmpFile));
    });
  });

  // 窗口控制
  ipcMain.handle('minimize', () => mainWindow?.minimize());
  ipcMain.handle('maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('close', () => mainWindow?.hide());
}

app.whenReady().then(() => {
  createWindow();
  setupIPC();
  initScreenshotAnalyzer();
  initMonitor();
});

app.on('window-all-closed', () => {
  // macOS 上不退出，保持托盘运行
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('before-quit', () => {
  if (monitor) monitor.stop();
  if (trayManager) trayManager.destroy();
});
