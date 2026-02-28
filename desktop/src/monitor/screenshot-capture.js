/**
 * Oracle-X 截图捕获模块
 * 使用 Electron desktopCapturer
 */

const { desktopCapturer, screen } = require('electron');

class ScreenshotCapture {
  constructor() {
    this.sources = null;
  }

  async getSources() {
    if (this.sources) return this.sources;
    
    try {
      this.sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });
      return this.sources;
    } catch (err) {
      console.error('[Screenshot] 获取屏幕源失败:', err.message);
      return [];
    }
  }

  async captureRegion(region) {
    const sources = await this.getSources();
    if (sources.length === 0) {
      throw new Error('No screen sources available');
    }

    // 获取主屏幕
    const primary = sources[0];
    const thumbnail = primary.thumbnail;
    
    // 裁剪区域
    const { x, y, width, height } = region;
    const cropped = thumbnail.crop({ x, y, width, height });
    
    // 转为 PNG buffer
    return cropped.toPNG();
  }

  async captureFullScreen() {
    const sources = await this.getSources();
    if (sources.length === 0) {
      throw new Error('No screen sources');
    }
    return sources[0].thumbnail.toPNG();
  }

  async saveRegion(region, filename) {
    const buffer = await this.captureRegion(region);
    const fs = require('fs');
    fs.writeFileSync(filename, buffer);
    return filename;
  }
}

module.exports = { ScreenshotCapture };
