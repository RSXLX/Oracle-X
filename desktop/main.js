/**
 * Oracle-X Desktop - Main Process
 * 支持全局应用监听 + Chrome Extension 功能
 */

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { GlobalAppMonitor, MONITOR_MODES } = require('./monitor');

// 开发环境配置
const isDev = process.env.NODE_ENV !== 'production';
const PORT = isDev ? 3000 : 3000;

// 全局状态
let mainWindow = null;
let monitor = null;
let settings = {
  // AI 配置
  aiProvider: 'stepfun',
  apiKey: '',
  apiBaseUrl: 'https://api.stepfun.com/v1',
  aiModel: 'step-1-8k',
  
  // 监控配置
  monitorMode: MONITOR_MODES.ACCESSIBILITY,
  targetApps: ['Binance', 'OKX', 'Bybit', 'Coinbase'],
  cooldown: 5,
  enableBlock: true,
  
  // 后端
  backendUrl: `http://localhost:${PORT}`,
};

/**
 * 创建主窗口
 */
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

  // 加载页面
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
}

/**
 * 初始化全局监听器
 */
function initMonitor() {
  monitor = new GlobalAppMonitor({
    mode: settings.monitorMode,
    targetApps: settings.targetApps,
    
    onAppActivated: async (appName) => {
      console.log('[Monitor] App activated:', appName);
      
      // 通知渲染进程
      if (mainWindow) {
        mainWindow.webContents.send('app-activated', appName);
      }
      
      // 如果启用阻断，发送警告
      if (settings.enableBlock) {
        await showFomoWarning(appName);
      }
    },
    
    onScreenshot: async (screenshotPath) => {
      console.log('[Monitor] Screenshot:', screenshotPath);
      
      // 可以在这里添加 AI 图像分析
      // 发送给后端进行视觉识别
    },
  });
  
  monitor.start();
  console.log('[Monitor] Global monitor started');
}

/**
 * 显示 FOMO 警告弹窗
 */
async function showFomoWarning(appName) {
  const { dialog, BrowserWindow } = require('electron');
  
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '⚠️ Oracle-X 警告',
    message: `检测到您正在 ${appName} 交易`,
    detail: `您确定要继续吗？\n\n冷静期: ${settings.cooldown} 秒\n\n等待时间过后，您可以继续操作。`,
    buttons: ['取消交易', '我确认冷静了，继续'],
    defaultId: 0,
    cancelId: 0,
    timeoutId: settings.cooldown,
  });
  
  console.log('[Oracle-X] User decision:', result.response === 1 ? 'CONTINUE' : 'CANCELLED');
  
  return result.response === 1;
}

// IPC 处理器
function setupIPC() {
  // 获取设置
  ipcMain.handle('getSettings', () => {
    return settings;
  });

  // 保存设置
  ipcMain.handle('saveSettings', (event, newSettings) => {
    settings = { ...settings, ...newSettings };
    
    // 更新监控器
    if (monitor) {
      monitor.targetApps = settings.targetApps;
      monitor.mode = settings.monitorMode;
    }
    
    return true;
  });

  // 测试后端连接
  ipcMain.handle('testConnection', async () => {
    try {
      const res = await fetch(`${settings.backendUrl}/api/config-status`);
      return res.ok;
    } catch {
      return false;
    }
  });

  // 获取决策日志
  ipcMain.handle('listDecisionLogs', async (event, limit = 50) => {
    try {
      const res = await fetch(`${settings.backendUrl}/api/decision-log?limit=${limit}`);
      return await res.json();
    } catch {
      return { items: [] };
    }
  });

  // 手动触发分析
  ipcMain.handle('analyzeNow', async (event, data) => {
    try {
      const res = await fetch(`${settings.backendUrl}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return await res.json();
    } catch (err) {
      return { error: err.message };
    }
  });

  // 截图
  ipcMain.handle('takeScreenshot', async () => {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
      exec(`screencapture -x ${tmpFile}`, (err) => {
        resolve(err ? null : tmpFile);
      });
    });
  });
}

// App 生命周期
app.whenReady().then(() => {
  createWindow();
  setupIPC();
  initMonitor();
});

app.on('window-all-closed', () => {
  if (monitor) {
    monitor.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
