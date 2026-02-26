/**
 * Oracle-X Desktop - Global Monitor
 * 监听任意 App，点击交易按钮时触发
 */

const { exec } = require('child_process');

const MONITOR_MODES = {
  ACCESSIBILITY: 'accessibility',
  SCREENSHOT: 'screenshot',
  GLOBAL_KEY: 'global_key',
};

const TARGET_APPS = {
  'Binance': ['买入', 'BUY', 'Long', '开多', 'Sell', '卖出'],
  'OKX': ['买入', '开多', 'Buy', 'Long', 'Sell'],
  'Bybit': ['买入开多', 'Buy', 'Long', 'Perpetual'],
  'Coinbase': ['Buy', 'Purchase'],
  'TradingView': ['买入', 'Buy', 'Long Position'],
};

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
    this.lastCheck = 0;
  }

  async start() {
    if (this.isRunning) return;
    console.log('[Monitor] Starting in mode:', this.mode);
    
    switch (this.mode) {
      case MONITOR_MODES.ACCESSIBILITY:
        await this.startButtonMonitor();
        break;
      case MONITOR_MODES.SCREENSHOT:
        await this.startScreenshotMonitor();
        break;
      default:
        await this.startAccessibilityMonitor();
    }
    
    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    console.log('[Monitor] Stopped');
  }

  /**
   * 监听交易按钮点击
   */
  async startButtonMonitor() {
    const checkForTradeButton = () => {
      if (!this.isRunning) return;
      
      // 获取前台 App 名称
      exec("osascript -e 'tell app \"System Events\" to get name of first process whose frontmost is true'", 
        (err, stdout) => {
          if (err || !stdout) return;
          
          const appName = stdout.trim().toLowerCase();
          
          // 检查是否是目标 App
          const isTargetApp = this.targetApps.some(t => appName.includes(t.toLowerCase()));
          if (!isTargetApp) return;
          
          // 获取窗口中的文本内容
          exec(`osascript -e 'tell app "System Events" to get value of every UI element of front window of process "${stdout.trim()}"'`,
            (err2, stdout2) => {
              if (err2 || !stdout2) return;
              
              const text = stdout2.toLowerCase();
              
              // 检测交易按钮关键词
              const keywords = ['买入', 'buy', 'sell', '卖出', 'long', 'short', '开多', '开空', '确认下单', 'place order', 'confirm order', '提交订单'];
              const hasButton = keywords.some(k => text.includes(k.toLowerCase()));
              
              // 防抖：5秒内不重复触发
              const now = Date.now();
              if (hasButton && now - this.lastCheck > 5000) {
                this.lastCheck = now;
                console.log('[Monitor] Trading button detected in:', stdout.trim());
                this.callbacks.onAppActivated(stdout.trim());
              }
            }
          );
        }
      );
    };

    // 每1.5秒检查一次
    setInterval(checkForTradeButton, 1500);
    checkForTradeButton();
    console.log('[Monitor] Button click monitoring started');
  }

  /**
   * 截图模式
   */
  async startScreenshotMonitor() {
    const takeScreenshot = () => {
      return new Promise((resolve, reject) => {
        const tmpFile = `/tmp/oraclex_${Date.now()}.png`;
        exec(`/usr/sbin/screencapture -x ${tmpFile}`, (err) => {
          if (err) reject(err);
          else resolve(tmpFile);
        });
      });
    };

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
   * 兼容旧版
   */
  async startAccessibilityMonitor() {
    await this.startButtonMonitor();
  }

  getSupportedApps() {
    return Object.keys(TARGET_APPS);
  }

  addRule(appName, keywords) {
    TARGET_APPS[appName] = keywords;
    this.targetApps.push(appName);
  }
}

module.exports = { GlobalAppMonitor, MONITOR_MODES, TARGET_APPS };
