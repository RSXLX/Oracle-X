/**
 * Oracle-X 快捷键管理器
 */

class HotkeyManager {
  constructor() {
    this.hotkeys = {
      'CommandOrControl+Shift+O': 'showWindow',
      'CommandOrControl+Shift+M': 'toggleMonitor',
      'CommandOrControl+Shift+S': 'takeScreenshot',
    };
    this.callbacks = {};
  }

  register(accelerator, action) {
    this.hotkeys[accelerator] = action;
  }

  on(action, callback) {
    this.callbacks[action] = callback;
  }

  trigger(action) {
    if (this.callbacks[action]) {
      this.callbacks[action]();
    }
  }

  getAll() {
    return Object.entries(this.hotkeys).map(([key, action]) => ({
      key,
      action,
      label: this.getLabel(action),
    }));
  }

  getLabel(action) {
    const labels = {
      showWindow: '显示/隐藏主窗口',
      toggleMonitor: '开启/关闭监控',
      takeScreenshot: '立即截图分析',
    };
    return labels[action] || action;
  }
}

module.exports = { HotkeyManager };
