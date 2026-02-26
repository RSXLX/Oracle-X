/**
 * Oracle-X Desktop - Main Process (完整版 + 钱包)
 */

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { GlobalAppMonitor, MONITOR_MODES } = require('./monitor');
const { ScreenshotAnalyzer } = require('./screenshot-analyzer');
const { TrayManager } = require('./tray-manager');
const { AutoStartManager } = require('./auto-start');
const { NotificationManager } = require('./notification-manager');
const { WalletAnalyzer } = require('./wallet-analyzer');

const isDev = process.env.NODE_ENV !== 'production';
const PORT = isDev ? 3000 : 3000;

let mainWindow = null;
let trayManager = null;
let autoStartManager = null;
let notificationManager = null;
let monitor = null;
let screenshotAnalyzer = null;
let walletAnalyzer = null;

let settings = {
  aiProvider: 'minimax',
  apiKey: 'sk-cXCZzJiwtakwpzV9ZIY8m4UoaCSL4jnHbUkaCyAeItzOdBdq',
  apiBaseUrl: 'https://mydmx.huoyuanqudao.cn/v1',
  aiModel: 'MiniMax-M2.5-highspeed',
  monitorMode: MONITOR_MODES.SCREENSHOT,
  targetApps: ['Binance', 'OKX', 'Bybit', 'Coinbase'],
  cooldown: 5,
  enableBlock: true,
  minimizeToTray: true,
  autoStart: false,
  notifications: true,
  backendUrl: `http://localhost:${PORT}`,
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
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  
  trayManager = new TrayManager(mainWindow);
  trayManager.create();
  
  notificationManager = new NotificationManager();
  notificationManager.setEnabled(settings.notifications);
}

function initManagers() {
  screenshotAnalyzer = new ScreenshotAnalyzer({
    visionProvider: settings.aiProvider,
    apiKey: settings.apiKey,
    apiBaseUrl: settings.apiBaseUrl,
    model: settings.aiModel,
  });

  autoStartManager = new AutoStartManager();
  if (settings.autoStart) autoStartManager.enable();

  walletAnalyzer = new WalletAnalyzer();
  
  // 添加默认钱包（如有配置）
  if (settings.wallets) {
    for (const w of settings.wallets) {
      walletAnalyzer.addWallet(w.address, w.chain, w.label);
    }
  }

  monitor = new GlobalAppMonitor({
    mode: settings.monitorMode,
    targetApps: settings.targetApps,
    
    onAppActivated: async (appName) => {
      if (mainWindow) mainWindow.webContents.send('app-activated', appName);
      if (settings.enableBlock) await showFomoWarning(appName);
    },
    
    onScreenshot: async (screenshotPath) => {
      if (screenshotAnalyzer && settings.apiKey) {
        try {
          const result = await screenshotAnalyzer.analyze(screenshotPath);
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
}

async function showFomoWarning(appName, analysis = null) {
  const { dialog } = require('electron');
  let detail = `检测到您正在 ${appName} 交易\n\n冷静期: ${settings.cooldown} 秒`;
  if (analysis?.buttons?.length) detail += `\n\n按钮: ${analysis.buttons.join(', ')}`;
  
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '⚠️ Oracle-X 警告',
    message: '检测到交易操作',
    detail,
    buttons: ['取消交易', '继续'],
    defaultId: 0,
  });
  
  return result.response === 1;
}

function setupIPC() {
  // Settings
  ipcMain.handle('getSettings', () => settings);
  ipcMain.handle('saveSettings', (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    if (monitor) { monitor.targetApps = settings.targetApps; monitor.mode = settings.monitorMode; }
    if (screenshotAnalyzer) screenshotAnalyzer.configure({ visionProvider: settings.aiProvider, apiKey: settings.apiKey, apiBaseUrl: settings.apiBaseUrl, model: settings.aiModel });
    if (autoStartManager && settings.autoStart !== (settings.autoStart || false)) autoStartManager.toggle(settings.autoStart);
    if (notificationManager) notificationManager.setEnabled(settings.notifications);
    return true;
  });

  // Connection
  ipcMain.handle('testConnection', async () => {
    try { const res = await fetch(`${settings.backendUrl}/api/config-status`); return res.ok; } catch { return false; }
  });

  // Logs
  ipcMain.handle('listDecisionLogs', async (event, limit = 50) => {
    try { const res = await fetch(`${settings.backendUrl}/api/decision-log?limit=${limit}`); return await res.json(); } catch { return { items: [] }; }
  });

  // Wallet
  ipcMain.handle('addWallet', (event, address, chain, label) => {
    return walletAnalyzer.addWallet(address, chain, label);
  });
  
  ipcMain.handle('getWallets', () => {
    return walletAnalyzer.getWallets();
  });
  
  ipcMain.handle('getWalletTransactions', async (event, address, chain, limit = 50) => {
    return await walletAnalyzer.fetchTransactions(address, chain, limit);
  });
  
  ipcMain.handle('analyzeWallet', async (event, address, chain) => {
    const txs = await walletAnalyzer.fetchTransactions(address, chain, 100);
    return walletAnalyzer.analyzePattern(txs);
  });

  // Screenshot
  ipcMain.handle('takeScreenshot', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
      exec(`screencapture -x ${tmpFile}`, (err) => resolve(err ? null : tmpFile));
    });
  });

  // Window controls
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
  initManagers();
});

app.on('window-all-closed', () => {
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
