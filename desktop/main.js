/**
 * Oracle-X Desktop - 最终整合版
 * 包含所有功能模块
 */

const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, Menu, Tray } = require('electron');
const path = require('path');

// 模块导入
const { GlobalAppMonitor, MONITOR_MODES } = require('./monitor');
const { ScreenshotAnalyzer } = require('./screenshot-analyzer');
const { TrayManager } = require('./tray-manager');
const { AutoStartManager } = require('./auto-start');
const { NotificationManager } = require('./notification-manager');
const { WalletAnalyzer } = require('./wallet-analyzer');
const { EnhancedCSVImporter } = require('./csv-importer');
const { MarketDataService } = require('./market-data');
const { RiskEngine } = require('./risk-engine');
const { DataExporter } = require('./data-exporter');
const { HotkeyManager } = require('./hotkey-manager');
const { AITradeAnalyzer } = require('./ai-trade-analyzer');

const isDev = process.env.NODE_ENV !== 'production';

let mainWindow = null;
let trayManager = null;
let autoStartManager = null;
let notificationManager = null;
let monitor = null;
let screenshotAnalyzer = null;
let walletAnalyzer = null;
let csvImporter = null;
let marketData = null;
let riskEngine = null;
let dataExporter = null;
let hotkeyManager = null;
let aiTradeAnalyzer = null;

// 默认设置（AI 配置硬编码）
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
};

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1000, width * 0.85),
    height: Math.min(900, height * 0.9),
    minWidth: 700,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0d1117',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    console.log('[Oracle-X] Started');
  });

  // 托盘
  trayManager = new TrayManager(mainWindow);
  trayManager.create();

  // 通知
  notificationManager = new NotificationManager();
  notificationManager.setEnabled(settings.notifications);
}

function initAll() {
  // 截图分析器
  screenshotAnalyzer = new ScreenshotAnalyzer({
    visionProvider: settings.aiProvider,
    apiKey: settings.apiKey,
    apiBaseUrl: settings.apiBaseUrl,
    model: settings.aiModel,
  });

  // 开机自启
  autoStartManager = new AutoStartManager();
  if (settings.autoStart) autoStartManager.enable();

  // 钱包分析
  walletAnalyzer = new WalletAnalyzer();
  walletAnalyzer.init();
  walletAnalyzer.loadFromLocal(); // 启动时加载已保存的钱包

  // CSV/XLSX 导入
  csvImporter = new EnhancedCSVImporter();

  // 市场数据
  marketData = new MarketDataService();

  // 风险引擎
  riskEngine = new RiskEngine();

  // 数据导出
  dataExporter = new DataExporter();

  // 快捷键
  hotkeyManager = new HotkeyManager();
  registerHotkeys();

  // AI 交易分析
  aiTradeAnalyzer = new AITradeAnalyzer({
    baseUrl: settings.apiBaseUrl,
    apiKey: settings.apiKey,
    model: settings.aiModel,
  });

  // 监控器
  monitor = new GlobalAppMonitor({
    mode: settings.monitorMode,
    targetApps: settings.targetApps,

    onAppActivated: async (appName) => {
      console.log('[Trigger] Trading action detected in:', appName);
      if (mainWindow) mainWindow.webContents.send('app-activated', appName);

      if (screenshotAnalyzer && settings.apiKey) {
        try {
          const { exec } = require('child_process');
          const tmpFile = '/tmp/oraclex_trigger_' + Date.now() + '.png';
          exec('/usr/sbin/screencapture -x ' + tmpFile, async (err) => {
            if (!err) {
              const result = await screenshotAnalyzer.analyze(tmpFile);
              console.log('[Analyzer] Result:', result);
              if (mainWindow) mainWindow.webContents.send('screenshot-result', result);

              if (result.action === 'block' && settings.enableBlock) {
                await showFomoWarning(appName, result);
              }
            }
          });
        } catch (err) {
          console.error('[Monitor] Screenshot error:', err.message);
        }
      } else if (settings.enableBlock) {
        await showFomoWarning(appName);
      }
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

function registerHotkeys() {
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });

  globalShortcut.register('CommandOrControl+Shift+S', async () => {
    const { exec } = require('child_process');
    const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
    exec(`/usr/sbin/screencapture -x ${tmpFile}`, async (err) => {
      if (!err && screenshotAnalyzer) {
        const result = await screenshotAnalyzer.analyze(tmpFile);
        if (mainWindow) mainWindow.webContents.send('screenshot-result', result);
      }
    });
  });
}

async function showFomoWarning(appName, analysis = null) {
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
  // ==================== 设置 ====================
  ipcMain.handle('getSettings', () => settings);
  ipcMain.handle('saveSettings', (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    if (monitor) { monitor.targetApps = settings.targetApps; monitor.mode = settings.monitorMode; }
    if (screenshotAnalyzer) screenshotAnalyzer.configure({ visionProvider: settings.aiProvider, apiKey: settings.apiKey, apiBaseUrl: settings.apiBaseUrl, model: settings.aiModel });
    if (autoStartManager && settings.autoStart) autoStartManager.toggle(settings.autoStart);
    if (notificationManager) notificationManager.setEnabled(settings.notifications);
    return true;
  });

  // ==================== 连接测试 ====================
  ipcMain.handle('testConnection', async () => {
    try {
      const res = await fetch('https://api.binance.com/api/v3/ping');
      return res.ok;
    } catch { return false; }
  });

  // ==================== 决策日志 ====================
  ipcMain.handle('listDecisionLogs', async () => ({ items: [] }));

  // ==================== 钱包 ====================
  ipcMain.handle('addWallet', (event, address, chain, label) => {
    const result = walletAnalyzer.addWallet(address, chain, label);
    walletAnalyzer.saveToLocal(); // 自动持久化
    return result;
  });

  ipcMain.handle('removeWallet', (event, address) => {
    const result = walletAnalyzer.removeWallet(address);
    walletAnalyzer.saveToLocal();
    return result;
  });

  ipcMain.handle('getWallets', () => walletAnalyzer.getWallets());

  ipcMain.handle('getWalletTransactions', async (event, address, chain, limit) => {
    const txs = await walletAnalyzer.fetchTransactions(address, chain, limit);
    walletAnalyzer.saveToLocal(); // 保存交易记录到本地
    return txs;
  });

  ipcMain.handle('analyzeWallet', async (event, address, chain) => {
    const txs = await walletAnalyzer.fetchTransactions(address, chain, 100);
    return walletAnalyzer.analyzePattern(txs);
  });

  // AI 分析钱包交易模式
  ipcMain.handle('aiAnalyzeWallet', async (event, address, chain) => {
    const wallet = walletAnalyzer.getWallets().find(w => w.address === address.toLowerCase());
    let txs = wallet?.transactions || [];
    if (!txs.length) {
      txs = await walletAnalyzer.fetchTransactions(address, chain, 100);
    }
    return aiTradeAnalyzer.analyzeWalletPattern(txs, { address, chain });
  });

  // 钱包数据持久化
  ipcMain.handle('saveWalletData', () => walletAnalyzer.saveToLocal());
  ipcMain.handle('loadWalletData', () => {
    walletAnalyzer.loadFromLocal();
    return walletAnalyzer.getWallets();
  });

  // ==================== 文件导入（CSV / XLSX）====================
  ipcMain.handle('importFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择交易记录文件',
      filters: [
        { name: '交易记录', extensions: ['csv', 'xlsx', 'xls'] },
        { name: 'CSV', extensions: ['csv'] },
        { name: 'Excel', extensions: ['xlsx', 'xls'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths[0]) {
      return { error: 'Cancelled' };
    }

    try {
      const importResult = await csvImporter.parseFile(result.filePaths[0]);
      const analysis = csvImporter.analyzePattern(importResult.transactions);
      const riskAssessment = riskEngine.assessRisk(analysis);
      return { ...importResult, analysis, risk: riskAssessment };
    } catch (err) {
      return { error: err.message };
    }
  });

  // AI 分析交易记录买卖点
  ipcMain.handle('aiAnalyzeTrades', async (event, transactions) => {
    return aiTradeAnalyzer.analyzeTrades(transactions);
  });

  // ==================== 市场数据 ====================
  ipcMain.handle('getMarketData', async (event, symbol) => await marketData.getSymbolInfo(symbol));
  ipcMain.handle('getTopSymbols', async (event, limit) => await marketData.getTopSymbols(limit));

  // ==================== 风险评估 ====================
  ipcMain.handle('assessRisk', (event, analysis) => riskEngine.assessRisk(analysis));

  // ==================== 导出 ====================
  ipcMain.handle('exportData', (event, data, format) => dataExporter.exportAnalysis(data, format));

  // ==================== 截图 ====================
  ipcMain.handle('takeScreenshot', async () => {
    const { exec } = require('child_process');
    return new Promise((resolve) => {
      const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
      exec(`/usr/sbin/screencapture -x ${tmpFile}`, (err) => resolve(err ? null : tmpFile));
    });
  });

  // ==================== 窗口控制 ====================
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
  initAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (monitor) monitor.stop();
  if (trayManager) trayManager.destroy();
  // 退出时自动保存钱包数据
  if (walletAnalyzer) {
    try { walletAnalyzer.saveToLocal(); } catch (e) { }
  }
});
