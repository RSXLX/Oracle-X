/**
 * Oracle-X Desktop v2.1 - 最终整合版 (SQLite)
 * 包含所有功能模块，数据存储使用 SQLite
 */

const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, Menu, Tray, net } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== 网络代理配置 =====
const envPath = path.join(__dirname, '.env.local');
const proxyConfig = {};
try {
  const proxyContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of proxyContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('HTTPS_PROXY=') || trimmed.startsWith('HTTP_PROXY=')) {
      const eqIdx = trimmed.indexOf('=');
      proxyConfig.url = trimmed.slice(eqIdx + 1).trim();
    }
  }
} catch (e) { }

// 设置 Node.js 全局代理
if (proxyConfig.url) {
  process.env.HTTPS_PROXY = proxyConfig.url;
  process.env.HTTP_PROXY = proxyConfig.url;
  process.env.https_proxy = proxyConfig.url;
  process.env.http_proxy = proxyConfig.url;
  console.log('[Proxy] Global proxy configured:', proxyConfig.url);
}

// 读取 .env.local 配置
function loadEnvConfig() {
  const envPath = path.join(__dirname, '.env.local');
  const config = {};
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        config[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
  } catch (e) {
    console.warn('[Main] .env.local not found');
  }
  return config;
}

const envConfig = loadEnvConfig();

// 模块导入
const Database = require('./data/database');
const { GlobalAppMonitor, MONITOR_MODES } = require('./monitor/monitor');
const { ScreenshotAnalyzer } = require('./analyzer/screenshot-analyzer');
const { TrayManager } = require('./system/tray-manager');
const { AutoStartManager } = require('./system/auto-start');
const { NotificationManager } = require('./system/notification-manager');
const { WalletAnalyzer } = require('./analyzer/wallet-analyzer');
const { EnhancedCSVImporter } = require('./data/csv-importer');
const { MarketDataService } = require('./data/market-data');
const { RiskEngine } = require('./analyzer/risk-engine');
const { DataExporter } = require('./data/data-exporter');
const { HotkeyManager } = require('./system/hotkey-manager');
const { AITradeAnalyzer } = require('./analyzer/ai-trade-analyzer');
const { InterceptionEngine } = require('./core/interception-engine');
const { SettingsStorage } = require('./data/settings-storage');
const { StatsTracker } = require('./system/stats-tracker');
const { DecisionLogger } = require('./data/decision-logger');

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
let settingsStorage = null;
let statsTracker = null;
let decisionLogger = null;
let interceptionEngine = null;
let db = null;

// 默认设置（从 .env.local 读取 AI 配置）
let settings = {
  aiProvider: 'minimax',
  apiKey: envConfig.AI_API_KEY || '',
  apiBaseUrl: envConfig.AI_BASE_URL || 'https://mydmx.huoyuanqudao.cn/v1',
  aiModel: envConfig.AI_MODEL || 'MiniMax-M2.5-highspeed',
  monitorMode: 'manual',  // 默认手动模式（不自动截图/监控）
  targetApps: ['Binance', 'OKX', 'Bybit', 'Coinbase'],
  cooldown: 5,
  enableBlock: true,
  minimizeToTray: true,
  autoStart: false,
  notifications: true,
  autoMonitorEnabled: false,  // 自动监控默认关闭
  etherscanApiKey: '',
  bscscanApiKey: '',
};

// ==================== 全局异常处理 ====================
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection:', reason);
});

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

async function initAll() {
  // ===== 初始化 SQLite 数据库 =====
  try {
    db = await Database.init();
    console.log('[Oracle-X] Database ready');
  } catch (err) {
    console.error('[Oracle-X] Database init failed:', err.message);
    // SQLite 不会失败（除非磁盘满），仅记录日志
  }

  // ===== 设置存储 =====
  settingsStorage = new SettingsStorage(db);
  const savedSettings = await settingsStorage.load();
  if (savedSettings && Object.keys(savedSettings).length > 0) {
    settings = { ...settings, ...savedSettings };
  }


  // ===== 统计追踪 =====
  statsTracker = new StatsTracker(db);

  // ===== 决策日志 =====
  decisionLogger = new DecisionLogger(db);

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

  // 钱包分析（传入 db，使用 Blockscout API，无需 Key）
  walletAnalyzer = new WalletAnalyzer(db);

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

  // 拦截决策引擎
  interceptionEngine = new InterceptionEngine({
    db,
    marketData,
    riskEngine,
    decisionLogger,
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
                // 综合评估：交易习惯 + 市场分析
                if (interceptionEngine) {
                  try {
                    const report = await interceptionEngine.evaluate(result, appName);
                    await showSmartWarning(appName, report);
                  } catch (evalErr) {
                    console.error('[InterceptionEngine] Eval error, fallback:', evalErr.message);
                    await showFomoWarning(appName, result);
                  }
                } else {
                  await showFomoWarning(appName, result);
                }
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
            // 综合评估
            if (interceptionEngine) {
              try {
                const report = await interceptionEngine.evaluate(result, result.platform || 'Trading App');
                await showSmartWarning(result.platform || 'Trading App', report);
              } catch (evalErr) {
                console.error('[InterceptionEngine] Eval error, fallback:', evalErr.message);
                await showFomoWarning(result.platform || 'Trading App', result);
              }
            } else {
              await showFomoWarning(result.platform || 'Trading App', result);
            }
          }
        } catch (err) {
          console.error('[Analyzer] Error:', err.message);
        }
      }
    },
  });

  // 只有用户显式开启自动监控时才启动
  if (settings.autoMonitorEnabled && monitor) {
    const { PermissionManager } = require('./system/permission-manager');
    const permManager = new PermissionManager();
    const perms = await permManager.checkAll();

    if (perms.screenCapture) {
      monitor.start();
      console.log('[Oracle-X] Auto monitor started (permissions granted)');
    } else {
      console.log('[Oracle-X] Auto monitor skipped (no screen capture permission)');
      settings.autoMonitorEnabled = false;
    }
  }
}

function registerHotkeys() {
  // Cmd+Shift+O: 显示/隐藏主窗口
  const toggleRegistered = globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.hide();
      else { mainWindow.show(); mainWindow.focus(); }
    }
  });
  console.log('[Hotkey] Cmd+Shift+O registered:', toggleRegistered);

  // Cmd+Shift+S: 手动截图分析
  const screenshotRegistered = globalShortcut.register('CommandOrControl+Shift+S', async () => {
    console.log('[Hotkey] Cmd+Shift+S triggered');

    const { exec } = require('child_process');
    const fs = require('fs');
    const tmpFile = `/tmp/oraclex_${Date.now()}.png`;

    // 直接尝试截图（不预检权限，因为 screencapture 权限跟终端走）
    exec(`/usr/sbin/screencapture -x ${tmpFile}`, async (err) => {
      // 检查截图是否成功（文件存在且 > 0 字节）
      const fileExists = !err && fs.existsSync(tmpFile);
      const fileSize = fileExists ? fs.statSync(tmpFile).size : 0;

      if (!fileExists || fileSize === 0) {
        console.log('[Hotkey] Screenshot failed or empty (permission issue?)');
        // 截图失败 → 引导授权
        const { PermissionManager } = require('./system/permission-manager');
        const permManager = new PermissionManager();
        await permManager.requestScreenCapture(mainWindow);
        return;
      }

      console.log('[Hotkey] Screenshot saved:', tmpFile, `(${fileSize} bytes)`);

      // 通知用户正在分析
      if (notificationManager) {
        notificationManager.show('📸 截图已捕获', '正在进行 AI 分析...');
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('screenshot-captured', { path: tmpFile });
      }

      // AI 分析
      if (screenshotAnalyzer && settings.apiKey) {
        try {
          const result = await screenshotAnalyzer.analyze(tmpFile);
          console.log('[Hotkey] Analysis result:', result?.action || 'unknown');

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('screenshot-result', result);
          }
          if (notificationManager) {
            const emoji = result?.action === 'block' ? '🔴' : '✅';
            notificationManager.show(`${emoji} 分析完成`, result?.summary || '分析已完成');
          }
        } catch (analyzeErr) {
          console.error('[Hotkey] Analysis error:', analyzeErr.message);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('screenshot-error', { error: analyzeErr.message });
          }
          if (notificationManager) {
            notificationManager.show('❌ 分析失败', analyzeErr.message);
          }
        }
      } else {
        if (notificationManager) {
          notificationManager.show('📸 截图已保存', '请配置 AI API Key 以启用分析功能');
        }
      }

      // 清理临时截图文件
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    });
  });
  console.log('[Hotkey] Cmd+Shift+S registered:', screenshotRegistered);
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

/**
 * 智能风控弹窗（整合交易习惯 + 市场分析）
 */
async function showSmartWarning(appName, report) {
  const lines = [`平台: ${report.screenshot?.platform || appName}`];

  if (report.symbol) {
    lines.push(`品种: ${report.symbol}`);
  }

  // 实时市场行情
  if (report.marketInfo) {
    const m = report.marketInfo;
    const changeSign = m.change24h >= 0 ? '+' : '';
    lines.push(`当前价: ${m.price} ${m.currency || ''} (${changeSign}${m.change24h}%)`);
    lines.push(`24h 高/低: ${m.high24h} / ${m.low24h}`);
  }

  // 用户交易历史
  if (report.tradeHistory?.count > 0) {
    const h = report.tradeHistory;
    lines.push('');
    lines.push('📊 你的交易历史:');
    lines.push(`  交易 ${h.count} 次 | 买 ${h.buys} 卖 ${h.sells}`);
    if (h.lastTradeTime) lines.push(`  上次交易: ${h.lastTradeTime}`);
    if (h.pnlSummary) lines.push(`  累计盈亏: ${h.pnlSummary}`);
    if (h.recentFrequency) lines.push(`  近期频率: ${h.recentFrequency}`);
  }

  // 风险评估
  if (report.risk) {
    lines.push('');
    lines.push(`⚠️ 风险等级: ${report.risk.riskLabel} (${report.risk.score}/100)`);
    const recs = (report.risk.recommendations || []).slice(0, 3);
    for (const rec of recs) {
      lines.push(`  • ${rec.title}`);
    }
  }

  lines.push(`\n冷静期: ${settings.cooldown} 秒`);

  // 发送到前端展示
  if (mainWindow) {
    mainWindow.webContents.send('smart-warning', report);
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '⚠️ Oracle-X 智能风控',
    message: '检测到交易操作 — AI 综合分析',
    detail: lines.join('\n'),
    buttons: ['取消交易', '我已了解风险，继续'],
    defaultId: 0,
  });

  // 记录决策日志
  if (decisionLogger) {
    try {
      await decisionLogger.log({
        type: 'interception',
        appName,
        action: result.response === 1 ? 'proceed' : 'cancelled',
        detail: JSON.stringify({
          symbol: report.symbol,
          riskScore: report.risk?.score,
          riskLevel: report.risk?.riskLevel,
          hasTradeHistory: !!(report.tradeHistory?.count),
          hasMarketInfo: !!report.marketInfo,
        }),
      });
    } catch (logErr) {
      console.error('[DecisionLogger] Error:', logErr.message);
    }
  }

  return result.response === 1;
}

function setupIPC() {
  // ==================== 设置 ====================
  ipcMain.handle('getSettings', () => settings);
  ipcMain.handle('saveSettings', async (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    if (settingsStorage) await settingsStorage.save(settings);
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
  ipcMain.handle('listDecisionLogs', async (event, limit) => {
    if (!decisionLogger) return { items: [] };
    const items = await decisionLogger.get(limit || 50);
    return { items };
  });

  // ==================== 钱包 ====================
  ipcMain.handle('addWallet', async (event, address, chain, label) => {
    if (!walletAnalyzer) return null;
    return walletAnalyzer.addWallet(address, chain, label);
  });

  ipcMain.handle('removeWallet', async (event, address) => {
    if (!walletAnalyzer) return false;
    return walletAnalyzer.removeWallet(address);
  });

  ipcMain.handle('getWallets', async () => {
    if (!walletAnalyzer) return [];
    return walletAnalyzer.getWallets();
  });

  ipcMain.handle('getWalletTransactions', async (event, address, chain, limit) => {
    return walletAnalyzer.fetchTransactions(address, chain, limit);
  });

  ipcMain.handle('analyzeWallet', async (event, address, chain) => {
    const txs = await walletAnalyzer.fetchTransactions(address, chain, 100);
    return walletAnalyzer.analyzePattern(txs);
  });

  // AI 分析钱包交易模式
  ipcMain.handle('aiAnalyzeWallet', async (event, address, chain) => {
    const wallets = await walletAnalyzer.getWallets();
    const wallet = wallets.find(w => w.address === address.toLowerCase());
    // 优先从 DB 加载
    let txs = await walletAnalyzer.getWalletTransactionsFromDB(address);
    if (!txs.length) {
      txs = await walletAnalyzer.fetchTransactions(address, chain, 100);
    }
    return aiTradeAnalyzer.analyzeWalletPattern(txs, { address, chain });
  });

  // 钱包数据持久化（数据库已自动完成，保留接口兼容）
  ipcMain.handle('saveWalletData', () => true);
  ipcMain.handle('loadWalletData', async () => {
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

      // ===== 持久化导入的交易记录到数据库 =====
      const batchId = `imp_${Date.now().toString(36)}`;
      if (db && importResult.transactions?.length) {
        for (const tx of importResult.transactions) {
          const ts = tx.timestamp
            ? new Date(tx.timestamp).toISOString().slice(0, 19).replace('T', ' ')
            : null;

          await db.execute(
            `INSERT INTO transactions
             (source, import_batch, timestamp, symbol, ticker, market_type, currency, side, price, qty, total, fee, exchange, is_buy, raw_data)
             VALUES ('import', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              batchId,
              ts,
              tx.symbol || '',
              tx.ticker || '',
              tx.marketType || 'crypto',
              tx.currency || '',
              tx.side || '',
              tx.price || 0,
              tx.qty || 0,
              tx.total || 0,
              tx.fee || 0,
              tx.exchange || '',
              tx.isBuy ? 1 : 0,
              JSON.stringify({ rawTime: tx.rawTime, assetName: tx.assetName, symbolInfo: tx.symbolInfo, marketData: tx.marketData }),
            ]
          );
        }
        console.log(`[Import] Saved ${importResult.transactions.length} txs, batch: ${batchId}`);
      }

      return { ...importResult, analysis, risk: riskAssessment, batchId };
    } catch (err) {
      return { error: err.message };
    }
  });

  // ===== 查询历史导入批次 =====
  ipcMain.handle('getImportHistory', async () => {
    if (!db) return [];
    const [rows] = await db.execute(
      `SELECT import_batch, COUNT(*) as count, MIN(timestamp) as first_time, MAX(timestamp) as last_time, MAX(created_at) as imported_at, exchange, market_type
       FROM transactions WHERE source = 'import' GROUP BY import_batch, exchange, market_type ORDER BY imported_at DESC`
    );
    return rows;
  });

  // ===== 按批次查询交易记录 =====
  ipcMain.handle('getTransactionsByBatch', async (event, batchId) => {
    if (!db) return [];
    const [rows] = await db.execute(
      'SELECT * FROM transactions WHERE import_batch = ? ORDER BY timestamp ASC',
      [batchId]
    );
    return rows;
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

  // ==================== 权限管理 ====================
  ipcMain.handle('checkPermissions', async () => {
    const { PermissionManager } = require('./system/permission-manager');
    const permManager = new PermissionManager();
    return permManager.checkAll();
  });

  ipcMain.handle('toggleAutoMonitor', async (event, enable) => {
    if (enable) {
      // 开启自动监控前检查权限
      const { PermissionManager } = require('./system/permission-manager');
      const permManager = new PermissionManager();
      const ready = await permManager.requestForAutoMonitor(mainWindow);

      if (!ready) {
        return { success: false, reason: 'permissions_pending' };
      }

      settings.autoMonitorEnabled = true;
      if (monitor && !monitor.isRunning) {
        monitor.start();
      }
      return { success: true };
    } else {
      settings.autoMonitorEnabled = false;
      if (monitor) monitor.stop();
      return { success: true };
    }
  });

  // ==================== 截图 + AI 分析 ====================
  ipcMain.handle('takeScreenshot', async () => {
    const { exec } = require('child_process');
    const fs = require('fs');
    const tmpFile = `/tmp/oraclex_${Date.now()}.png`;

    // 1. 截图
    const screenshotOk = await new Promise((resolve) => {
      exec(`/usr/sbin/screencapture -x ${tmpFile}`, (err) => {
        const exists = !err && fs.existsSync(tmpFile);
        const size = exists ? fs.statSync(tmpFile).size : 0;
        resolve(exists && size > 0);
      });
    });

    if (!screenshotOk) {
      // 截图失败 → 引导授权
      const { PermissionManager } = require('./system/permission-manager');
      const permManager = new PermissionManager();
      await permManager.requestScreenCapture(mainWindow);
      return null;
    }

    console.log('[Screenshot] Captured:', tmpFile);

    // 2. 通知 renderer 已截图
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('screenshot-captured', { path: tmpFile });
    }

    // 3. AI 分析
    if (screenshotAnalyzer && settings.apiKey) {
      try {
        const result = await screenshotAnalyzer.analyze(tmpFile);
        console.log('[Screenshot] Analysis result:', result?.action || 'unknown');

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('screenshot-result', result);
        }

        // 清理临时文件
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

        return result;
      } catch (err) {
        console.error('[Screenshot] Analysis error:', err.message);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('screenshot-error', { error: err.message });
        }
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
        return { error: err.message };
      }
    }

    return { path: tmpFile };
  });

  // ==================== 实时分析（截图触发）====================
  ipcMain.handle('analyzeNow', async (event, data) => {
    if (!screenshotAnalyzer || !settings.apiKey) return { action: 'allow' };
    try {
      const { exec } = require('child_process');
      const tmpFile = `/tmp/oraclex_analyze_${Date.now()}.png`;
      return new Promise((resolve) => {
        exec(`/usr/sbin/screencapture -x ${tmpFile}`, async (err) => {
          if (err) return resolve({ action: 'allow' });
          const result = await screenshotAnalyzer.analyze(tmpFile);
          resolve(result);
        });
      });
    } catch (err) {
      return { error: err.message };
    }
  });

  // ==================== 窗口控制 ====================
  ipcMain.handle('minimize', () => mainWindow?.minimize());
  ipcMain.handle('maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('close', () => mainWindow?.hide());
}

app.whenReady().then(async () => {
  createWindow();
  setupIPC();
  await initAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

app.on('will-quit', async () => {
  globalShortcut.unregisterAll();
  if (monitor) monitor.stop();
  if (trayManager) trayManager.destroy();
  // 清理截图临时文件
  cleanupScreenshotFiles();
  // 关闭数据库连接
  await Database.close();
});

/**
 * 清理 /tmp 下的 oraclex 截图临时文件
 */
function cleanupScreenshotFiles() {
  try {
    const tmpDir = '/tmp';
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('oraclex_') && f.endsWith('.png'));
    const now = Date.now();
    let cleaned = 0;
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      const stat = fs.statSync(filePath);
      // 清理 10 分钟前的临时文件
      if (now - stat.mtimeMs > 10 * 60 * 1000) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
    if (cleaned > 0) console.log(`[Cleanup] Removed ${cleaned} temp screenshot files`);
  } catch (e) {
    // 忽略清理错误
  }
}

// 每 15 分钟清理一次临时文件
setInterval(cleanupScreenshotFiles, 15 * 60 * 1000);
