/**
 * Oracle-X Desktop - 全局应用监听器
 * 使用 macOS Accessibility API 监听任意应用
 */

const { exec, spawn } = require('child_process');
const os = require('os');

// 监控目标应用
const TARGET_APPS = {
  'Binance': ['买入', '买入 BTC', 'BUY', 'Long', '开多'],
  'OKX': ['买入', '开多', 'Buy', 'Long'],
  'Bybit': ['买入开多', 'Buy', 'Long', 'Perpetual'],
  'Coinbase': ['Buy', 'Purchase', 'Add USD'],
  'TradingView': ['买入', 'Buy', 'Long Position'],
  'MetaTrader': ['买入', 'Buy', 'Market Order'],
};

// 监听模式
const MONITOR_MODES = {
  ACCESSIBILITY: 'accessibility',  // UI 元素监听
  SCREENSHOT: 'screenshot',       // 屏幕截图分析
  GLOBAL_KEY: 'global_key',       // 全局快捷键
};

/**
 * 全局应用监听器
 */
class GlobalAppMonitor {
  constructor(options = {}) {
    this.mode = options.mode || MONITOR_MODES.ACCESSIBILITY;
    this.targetApps = options.targetApps || Object.keys(TARGET_APPS);
    this.callbacks = {
      onButtonDetected: options.onButtonDetected || (() => {}),
      onAppActivated: options.onAppActivated || (() => {}),
      onScreenshot: options.onScreenshot || (() => {}),
    };
    this.isRunning = false;
    this.screenshotInterval = null;
  }

  /**
   * 启动监听
   */
  async start() {
    if (this.isRunning) return;
    
    console.log('[Monitor] Starting in mode:', this.mode);
    
    switch (this.mode) {
      case MONITOR_MODES.SCREENSHOT:
        await this.startScreenshotMonitor();
        break;
      case MONITOR_MODES.GLOBAL_KEY:
        await this.startGlobalKeyMonitor();
        break;
      default:
        await this.startAccessibilityMonitor();
    }
    
    this.isRunning = true;
  }

  /**
   * 停止监听
   */
  stop() {
    this.isRunning = false;
    
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    
    console.log('[Monitor] Stopped');
  }

  /**
   * Accessibility 模式 - 监听活动应用
   */
  async startAccessibilityMonitor() {
    // 使用 AppleScript 获取当前活动应用
    const checkActiveApp = () => {
      if (!this.isRunning) return;
      
      exec('osascript -e \'tell app "System Events" to get name of first process whose frontmost is true\'', 
        (err, stdout) => {
          if (err || !stdout) return;
          
          const appName = stdout.trim();
          
          // 检查是否是目标应用
          if (this.targetApps.some(t => appName.toLowerCase().includes(t.toLowerCase()))) {
            console.log('[Monitor] Target app detected:', appName);
            this.callbacks.onAppActivated(appName);
          }
        }
      );
    };

    // 每秒检查一次
    setInterval(checkActiveApp, 1000);
    checkActiveApp();
  }

  /**
   * 截图模式 - 定时截图 + AI 识别
   */
  async startScreenshotMonitor() {
    // 使用 screencapture 命令截图
    const takeScreenshot = () => {
      return new Promise((resolve, reject) => {
        const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
        
        exec(`screencapture -x ${tmpFile}`, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(tmpFile);
        });
      });
    };

    // 每 2 秒截图一次
    this.screenshotInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const screenshot = await takeScreenshot();
        this.callbacks.onScreenshot(screenshot);
      } catch (err) {
        console.warn('[Monitor] Screenshot failed:', err.message);
      }
    }, 2000);
  }

  /**
   * 全局快捷键模式
   */
  async startGlobalKeyMonitor() {
    // 使用 Hammock 或类似工具监听全局快捷键
    // 这里只是一个占位实现
    console.log('[Monitor] Global key mode - waiting for config');
  }

  /**
   * 获取支持的 App 列表
   */
  getSupportedApps() {
    return Object.keys(TARGET_APPS);
  }

  /**
   * 添加自定义监听规则
   */
  addRule(appName, keywords) {
    TARGET_APPS[appName] = keywords;
    this.targetApps.push(appName);
  }
}

module.exports = { GlobalAppMonitor, MONITOR_MODES, TARGET_APPS };
