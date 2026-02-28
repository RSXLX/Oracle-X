/**
 * Oracle-X Desktop - Notification Manager
 * 通知管理
 */

const { Notification } = require('electron');
const { I18nMain } = require('../i18n-main');

const i18n = new I18nMain();

class NotificationManager {
  constructor() {
    this.enabled = true;
  }

  /**
   * 设置语言
   */
  setLocale(lang) {
    i18n.setLocale(lang);
  }

  /**
   * 显示交易警告
   */
  showTradeWarning(appName, buttons = []) {
    if (!this.enabled || !Notification.isSupported()) return;

    const notification = new Notification({
      title: i18n.t('dialog.tradeWarningTitle'),
      body: i18n.t('dialog.tradeWarningBody', { app: appName }) + (buttons.length ? `\n${i18n.t('monitor.buttons')}: ${buttons.join(', ')}` : ''),
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
      title: i18n.t('dialog.riskMitigatedTitle'),
      body: i18n.t('dialog.riskMitigatedBody'),
    });

    notification.show();
  }

  /**
   * 显示统计摘要
   */
  showDailySummary(stats) {
    if (!this.enabled || !Notification.isSupported()) return;

    const notification = new Notification({
      title: i18n.t('dialog.dailySummaryTitle'),
      body: i18n.t('dialog.dailySummaryBody', { blocks: stats.blocks || 0, mitigated: stats.mitigated || 0 }),
    });

    notification.show();
  }

  /**
   * 通用通知
   */
  show(title, body) {
    if (!this.enabled || !Notification.isSupported()) return;

    const notification = new Notification({ title, body });
    notification.show();
    return notification;
  }

  /**
   * 启用/禁用通知
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

module.exports = { NotificationManager };
