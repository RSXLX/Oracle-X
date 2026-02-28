/**
 * Oracle-X Desktop - System Tray Manager
 * 系统托盘管理，常驻后台运行
 */

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { I18nMain } = require('../i18n-main');

const i18n = new I18nMain();

class TrayManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
  }

  /**
   * 创建系统托盘
   */
  create() {
    const iconPath = path.join(__dirname, 'icons', 'icon.svg');
    let icon;

    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        icon = nativeImage.createEmpty();
      }
    } catch {
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('Oracle-X NoFOMO');

    this.updateContextMenu();

    this.tray.on('click', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide();
        } else {
          this.mainWindow.show();
          this.mainWindow.focus();
        }
      }
    });

    console.log('[Tray] System tray created');
  }

  /**
   * 设置语言
   */
  setLocale(lang) {
    i18n.setLocale(lang);
    this.updateContextMenu();
  }

  /**
   * 更新托盘菜单
   */
  updateContextMenu(stats = {}) {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Oracle-X NoFOMO',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: i18n.t('tray.todayBlock', { count: stats.todayBlock || 0 }),
        enabled: false,
      },
      {
        label: i18n.t('tray.mitigationRate', { rate: stats.mitigationRate || '0%' }),
        enabled: false,
      },
      { type: 'separator' },
      {
        label: i18n.t('tray.showWindow'),
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        },
      },
      {
        label: i18n.t('tray.screenshot'),
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.webContents.send('trigger-screenshot');
          }
        },
      },
      { type: 'separator' },
      {
        label: i18n.t('tray.quit'),
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.destroy();
          }
          require('electron').app.quit();
        },
      },
    ]);

    this.tray?.setContextMenu(contextMenu);
  }

  /**
   * 更新状态
   */
  updateStats(stats) {
    this.updateContextMenu(stats);
  }

  /**
   * 销毁托盘
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = { TrayManager };
