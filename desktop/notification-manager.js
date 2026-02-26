/**
 * Oracle-X Desktop - Notification Manager
 * 通知管理
 */

const { Notification } = require('electron');

class NotificationManager {
  constructor() {
    this.enabled = true;
  }

  /**
   * 显示交易警告
   */
  showTradeWarning(appName, buttons = []) {
    if (!this.enabled || !Notification.isSupported()) return;

    const notification = new Notification({
      title: '⚠️ Oracle-X 警告',
      body: `检测到您正在 ${appName} 交易${buttons.length ? `\n按钮: ${buttons.join(', ')}` : ''}`,
      urgency: 'critical',
      timeoutType: 'never',
    });

    notification.show();
    return notification;
  }

  /**
   * 显示风险化解通知
   */
  showRiskMitigated() {
    if (!this.enabled || !Notification.isSupported()) return;

    const notification = new Notification({
      title: '✅ 风险化解',
      body: '您成功避免了 FOMO 交易！保持理性 💪',
    });

    notification.show();
  }

  /**
   * 显示统计摘要
   */
  showDailySummary(stats) {
    if (!this.enabled || !Notification.isSupported()) return;

    const notification = new Notification({
      title: '📊 今日 Oracle-X 统计',
      body: `阻断: ${stats.blocks || 0} 次 | 风险化解: ${stats.mitigated || 0} 次`,
    });

    notification.show();
  }

  /**
   * 启用/禁用通知
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

module.exports = { NotificationManager };
