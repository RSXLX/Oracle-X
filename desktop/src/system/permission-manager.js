/**
 * Oracle-X 权限管理器
 * macOS 隐私权限分级检查与用户引导
 */

const { dialog, shell, systemPreferences } = require('electron');

class PermissionManager {
  constructor() {
    this.permissionCache = null;
  }

  /**
   * 检查屏幕录制权限
   * @returns {'granted'|'denied'|'not-determined'}
   */
  checkScreenCapture() {
    try {
      return systemPreferences.getMediaAccessStatus('screen');
    } catch {
      // Electron 版本不支持或非 macOS
      return 'not-determined';
    }
  }

  /**
   * 检查辅助功能权限（Accessibility）
   */
  checkAccessibility() {
    try {
      // macOS: systemPreferences.isTrustedAccessibilityClient(false)
      // false = 不弹系统提示
      return systemPreferences.isTrustedAccessibilityClient(false);
    } catch {
      return false;
    }
  }

  /**
   * 检查所有权限
   */
  async checkAll() {
    const screenCapture = this.checkScreenCapture();
    const accessibility = this.checkAccessibility();

    this.permissionCache = {
      screenCapture: screenCapture === 'granted',
      screenCaptureStatus: screenCapture,
      accessibility,
    };

    return this.permissionCache;
  }

  /**
   * 获取缓存的权限状态
   */
  getCached() {
    return this.permissionCache;
  }

  /**
   * 请求屏幕录制权限（引导用户到系统设置）
   */
  async requestScreenCapture(mainWindow) {
    const status = this.checkScreenCapture();

    if (status === 'granted') return true;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '需要屏幕录制权限',
      message: 'Oracle-X 需要「屏幕录制」权限来分析交易界面',
      detail: [
        '🔒 隐私保护承诺：',
        '',
        '• 截图仅用于本地 AI 分析，分析后立即删除',
        '• 不会上传到任何云服务器用于存储',
        '• 您可以随时在设置中关闭此功能',
        '',
        '操作步骤：',
        '1. 点击下方「去系统设置授权」',
        '2. 点击左下角「+」按钮',
        '3. 在应用列表中找到「Electron」（开发模式）',
        '   或「Oracle-X」（正式版）并添加',
        '4. 勾选开关后，重启应用即可生效',
      ].join('\n'),
      buttons: ['去系统设置授权', '暂不开启'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
      );
      return 'pending';
    }

    return false;
  }

  /**
   * 请求辅助功能权限
   */
  async requestAccessibility(mainWindow) {
    if (this.checkAccessibility()) return true;

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '需要辅助功能权限',
      message: 'Oracle-X 需要「辅助功能」权限来检测交易按钮',
      detail: [
        '此权限用于：',
        '• 检测前台应用中的交易按钮',
        '• 自动识别买入/卖出操作',
        '',
        '点击「去系统设置」后，请在列表中找到 Oracle-X 并勾选。',
      ].join('\n'),
      buttons: ['去系统设置授权', '暂不开启'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response === 0) {
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      );
      return 'pending';
    }

    return false;
  }

  /**
   * 自动监控开启前的完整权限引导
   * @returns {boolean} true=权限已就绪，可启动监控
   */
  async requestForAutoMonitor(mainWindow) {
    // 1. 检查屏幕录制
    const screenResult = await this.requestScreenCapture(mainWindow);
    if (!screenResult || screenResult === 'pending') {
      return false;
    }

    // 2. 检查辅助功能
    const a11yResult = await this.requestAccessibility(mainWindow);
    if (!a11yResult || a11yResult === 'pending') {
      return false; // 屏幕录制已有但辅助功能缺失
    }

    return true;
  }
}

module.exports = { PermissionManager };
