/**
 * Oracle-X 后台扫描器
 * 定时扫描屏幕，检测交易界面
 */

const { ScreenshotCapture } = require('./screenshot-capture');
const { VisionOCR } = require('./vision-ocr');

class BackgroundScanner {
  constructor(onTradeDetected) {
    this.callback = onTradeDetected;
    this.interval = null;
    this.lastDetected = false;
    this.capture = new ScreenshotCapture();
    this.ocr = new VisionOCR();
    
    // 交易界面关键词（同时出现说明是交易界面）
    this.tradeIndicators = {
      buy: ['买入', 'BUY', 'Long', '开多', '买涨', 'BUY NOW'],
      sell: ['卖出', 'SELL', 'Short', '开空', '卖跌', 'SELL NOW']
    };
  }

  start(intervalMs = 2000) {
    if (this.interval) return;
    
    console.log('[Scanner] 后台扫描已启动, 间隔:', intervalMs, 'ms');
    
    this.interval = setInterval(async () => {
      await this.scan();
    }, intervalMs);
  }

  async scan() {
    try {
      // 截取全屏
      const buffer = await this.capture.captureFullScreen();
      
      // OCR 识别（简化版）
      const result = await this.ocr.analyzeRegion(buffer, { x: 0, y: 0, width: 1920, height: 1080 });
      
      // 检测交易界面
      const hasTradeUI = this.detectTradeUI(result.text);
      
      // 状态变化时触发回调
      if (hasTradeUI && !this.lastDetected) {
        console.log('[Scanner] 📊 检测到交易界面');
        if (this.callback) {
          this.callback(result.text);
        }
      }
      
      this.lastDetected = hasTradeUI;
    } catch (err) {
      // 静默处理错误
    }
  }

  detectTradeUI(text) {
    if (!text) return false;
    
    const hasBuy = this.ocr.matchKeywords(text, this.tradeIndicators.buy).length > 0;
    const hasSell = this.ocr.matchKeywords(text, this.tradeIndicators.sell).length > 0;
    
    // 同时出现买卖，说明是交易界面
    return hasBuy && hasSell;
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('[Scanner] 已停止');
    }
  }
}

module.exports = { BackgroundScanner };
