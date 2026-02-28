/**
 * Oracle-X Desktop - System Tray Manager
 * 系统托盘管理，常驻后台运行
 */

const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
  }

  /**
   * 创建系统托盘
   */
  create() {
    // 创建托盘图标（使用内置图标）
    const iconPath = path.join(__dirname, 'icons', 'icon.png');
    let icon;
    
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        // 创建默认图标
        icon = nativeImage.createEmpty();
      }
    } catch {
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip('Oracle-X NoFOMO');
    
    this.updateContextMenu();
    
    // 点击托盘图标显示/隐藏窗口
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
   * 更新托盘菜单
   */
  updateContextMenu(stats = {}) {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🔮 Oracle-X NoFOMO',
        enabled: false,
      },
      { type: 'separator' },
      {
        label: `今日阻断: ${stats.todayBlock || 0}`,
        enabled: false,
      },
      {
        label: `风险化解: ${stats.mitigationRate || '0%'}`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: '显示主窗口',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        },
      },
      {
        label: '立即截图分析',
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.webContents.send('trigger-screenshot');
          }
        },
      },
      { type: 'separator' },
      {
        label: '退出',
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
