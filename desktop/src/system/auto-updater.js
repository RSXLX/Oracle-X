/**
 * Oracle-X Desktop — 自动更新模块
 * 基于 electron-updater，通过 GitHub Releases 分发
 */
const { autoUpdater } = require('electron-updater');

let mainWindowRef = null;

function initAutoUpdater(mainWindow) {
    mainWindowRef = mainWindow;

    // 不自动下载，让用户确认
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] Update available:', info.version);
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            mainWindowRef.webContents.send('update-available', {
                version: info.version,
                releaseNotes: info.releaseNotes,
            });
        }
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[AutoUpdater] No updates available');
    });

    autoUpdater.on('download-progress', (progress) => {
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            mainWindowRef.webContents.send('update-progress', {
                percent: Math.round(progress.percent),
            });
        }
    });

    autoUpdater.on('update-downloaded', () => {
        console.log('[AutoUpdater] Update downloaded');
        if (mainWindowRef && !mainWindowRef.isDestroyed()) {
            mainWindowRef.webContents.send('update-downloaded');
        }
    });

    autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] Error:', err.message);
    });

    // 延迟 10 秒检查更新（避免启动时阻塞）
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => { });
    }, 10000);
}

function downloadUpdate() {
    autoUpdater.downloadUpdate().catch(() => { });
}

function installUpdate() {
    autoUpdater.quitAndInstall(false, true);
}

module.exports = { initAutoUpdater, downloadUpdate, installUpdate };
