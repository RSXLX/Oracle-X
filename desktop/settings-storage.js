/**
 * Oracle-X Desktop - Settings Storage
 * 本地设置持久化
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SettingsStorage {
  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'oraclex-config.json');
    this.settings = {};
    this.load();
  }

  /**
   * 加载设置
   */
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        this.settings = JSON.parse(data);
        console.log('[Storage] Settings loaded');
      }
    } catch (err) {
      console.error('[Storage] Load error:', err);
      this.settings = {};
    }
    return this.settings;
  }

  /**
   * 保存设置
   */
  save(newSettings = {}) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2));
      console.log('[Storage] Settings saved');
      return true;
    } catch (err) {
      console.error('[Storage] Save error:', err);
      return false;
    }
  }

  /**
   * 获取设置
   */
  get(key = null) {
    if (key) return this.settings[key];
    return this.settings;
  }

  /**
   * 重置
   */
  reset() {
    this.settings = {};
    this.save();
  }
}

module.exports = { SettingsStorage };
