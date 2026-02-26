/**
 * Oracle-X 鼠标点击拦截器
 * 监听鼠标点击，识别交易按钮
 */

let uIOhook = null;
try {
  uIOhook = require('uiohook-napi');
} catch (e) {
  console.log('[MouseHook] uiohook not available:', e.message);
}

const { screenshot } = require('./screenshot-capture');

class MouseClickInterceptor {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.isProcessing = false;
    this.lastClickTime = 0;
    this.cooldown = 800; // 800ms 冷却
    this.isRunning = false;
    
    // 交易按钮关键词
    this.tradeKeywords = [
      '买入', '卖出', '开多', '开空', '确认下单', '买涨', '买跌',
      'BUY', 'SELL', 'LONG', 'SHORT', 'BUY NOW', 'SELL NOW',
      'Place Order', 'Confirm', 'Submit'
    ];
  }

  start() {
    if (!uIOhook) {
      console.log('[MouseHook] uiohook not available, skipping');
      return false;
    }
    
    if (this.isRunning) return true;
    
    try {
      uIOhook.on('mousedown', async (event) => {
        const now = Date.now();
        
        // 防抖
        if (this.isProcessing || (now - this.lastClickTime) < this.cooldown) {
          return;
        }
        
        this.lastClickTime = now;
        this.isProcessing = true;
        
        try {
          await this.handleClick(event.x, event.y, event.button);
        } finally {
          this.isProcessing = false;
        }
      });
      
      uIOhook.start();
      this.isRunning = true;
      console.log('[MouseHook] ✅ 鼠标监听已启动');
      return true;
    } catch (err) {
      console.error('[MouseHook] 启动失败:', err.message);
      return false;
    }
  }

  async handleClick(x, y, button) {
    // 只处理左键 (button = 1)
    if (button !== 1) return;
    
    console.log(`[MouseHook] 点击位置: (${x}, ${y})`);
    
    // 截取点击区域 (200x60)
    const region = { x: x - 100, y: y - 30, width: 200, height: 60 };
    
    // 回调
    if (this.callbacks.onClick) {
      this.callbacks.onClick(x, y, region);
    }
  }

  isTradeButton(text) {
    if (!text) return false;
    const upper = text.toUpperCase();
    return this.tradeKeywords.some(kw => upper.includes(kw.toUpperCase()));
  }

  stop() {
    if (uIOhook && this.isRunning) {
      try {
        uIOhook.stop();
        this.isRunning = false;
        console.log('[MouseHook] 已停止');
      } catch (e) {
        console.log('[MouseHook] 停止:', e.message);
      }
    }
  }
}

module.exports = { MouseClickInterceptor };
