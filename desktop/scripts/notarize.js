/**
 * Oracle-X — macOS Notarize Script
 * 在 electron-builder afterSign 钩子中执行
 *
 * 需要环境变量：
 *   APPLE_ID          - Apple 开发者账号邮箱
 *   APPLE_APP_SPECIFIC_PASSWORD - App 专用密码
 *   APPLE_TEAM_ID     - Apple Team ID
 */
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;

    // 仅 macOS 需要公证
    if (electronPlatformName !== 'darwin') return;

    const appName = context.packager.appInfo.productFilename;
    const appPath = `${appOutDir}/${appName}.app`;

    const appleId = process.env.APPLE_ID;
    const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
    const teamId = process.env.APPLE_TEAM_ID;

    if (!appleId || !appleIdPassword || !teamId) {
        console.warn('[Notarize] Skipping — missing APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID');
        return;
    }

    console.log('[Notarize] Starting notarization for:', appPath);

    await notarize({
        appPath,
        appleId,
        appleIdPassword,
        teamId,
    });

    console.log('[Notarize] Done!');
};
