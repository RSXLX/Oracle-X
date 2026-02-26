/**
 * Oracle-X Desktop - Auto Start Manager
 * 开机自启动管理
 */

const { app } = require('electron');
const path = require('path');

class AutoStartManager {
  constructor() {
    this.appName = 'Oracle-X NoFOMO';
  }

  /**
   * 启用开机自启动
   */
  enable() {
    if (process.platform === 'darwin') {
      // macOS: 使用 Login Item API
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: ['--hidden'],
      });
      console.log('[AutoStart] Enabled for macOS');
    } else if (process.platform === 'win32') {
      // Windows: 使用注册表
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
      });
      console.log('[AutoStart] Enabled for Windows');
    }
  }

  /**
   * 禁用开机自启动
   */
  disable() {
    app.setLoginItemSettings({
      openAtLogin: false,
    });
    console.log('[AutoStart] Disabled');
  }

  /**
   * 检查当前状态
   */
  isEnabled() {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  }

  /**
   * 切换状态
   */
  toggle(enabled) {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
    return this.isEnabled();
  }
}

module.exports = { AutoStartManager };
