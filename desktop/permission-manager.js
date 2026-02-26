/**
 * Oracle-X 权限管理器
 * 检测并请求必要的系统权限
 */

const { exec } = require('child_process');
const { shell, dialog, app } = require('electron');

class PermissionManager {
  constructor() {
    this.permissions = [
      {
        name: '辅助功能',
        key: 'accessibility',
        check: () => this.checkAccessibility(),
        url: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      },
      {
        name: '屏幕录制',
        key: 'screenCapture',
        check: () => this.checkScreenCapture(),
        url: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      }
    ];
  }

  checkAccessibility() {
    try {
      execSync("osascript -e 'tell app \"System Events\" to get every process'", { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  checkScreenCapture() {
    try {
      execSync('/usr/sbin/screencapture -x /tmp/perm_test.png && rm /tmp/perm_test.png', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  checkUIOhook() {
    try {
      require('uiohook-napi');
      return true;
    } catch {
      return false;
    }
  }

  async checkAll() {
    const results = {};
    
    for (const perm of this.permissions) {
      results[perm.key] = perm.check();
    }
    
    results.uiohook = this.checkUIOhook();
    
    return results;
  }

  async requestMissing(mainWindow) {
    const results = await this.checkAll();
    const missing = [];
    
    for (const perm of this.permissions) {
      if (!results[perm.key]) {
        missing.push(perm);
      }
    }
    
    if (missing.length > 0 || !results.uiohook) {
      await this.showRequestDialog(mainWindow, missing, results);
    }
    
    return results;
  }

  showRequestDialog(mainWindow, missing, current) {
    return new Promise((resolve) => {
      let message = 'Oracle-X 需要以下权限才能正常工作:\n\n';
      
      if (!current.accessibility) {
        message += '• 辅助功能 - 检测交易按钮点击\n';
      }
      if (!current.screenCapture) {
        message += '• 屏幕录制 - 截图分析\n';
      }
      if (!current.uiohook) {
        message += '• 输入监控 - 监听鼠标点击\n';
      }
      
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '需要权限授权',
        message: 'Oracle-X 需要系统权限',
        detail: message,
        buttons: ['打开系统设置', '稍后再说'],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          // 打开辅助功能设置
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
        }
        resolve();
      });
    });
  }
}

module.exports = { PermissionManager };
