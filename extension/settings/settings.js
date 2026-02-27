/**
 * Oracle-X Extension Settings
 * 读写 chrome.storage.local 管理用户配置
 */

const PLATFORMS = [
    { id: 'binance', name: 'Binance', emoji: '🟡' },
    { id: 'okx', name: 'OKX', emoji: '⚫' },
    { id: 'bybit', name: 'Bybit', emoji: '🟠' },
    { id: 'coinbase', name: 'Coinbase', emoji: '🔵' },
    { id: 'kraken', name: 'Kraken', emoji: '🟣' },
    { id: 'huobi', name: 'Huobi', emoji: '🔵' },
    { id: 'gate', name: 'Gate.io', emoji: '🟢' },
    { id: 'uniswap', name: 'Uniswap', emoji: '🦄' },
];

const DEFAULT_SETTINGS = {
    apiBaseUrl: 'http://localhost:3000',
    riskProfile: 'balanced',
    coolingTime: 20,
    enableNoFomoBlock: true,
    enabledPlatforms: PLATFORMS.map(p => p.id),
};

// === UI 初始化 ===

function renderPlatforms() {
    const grid = document.getElementById('platformsGrid');
    grid.innerHTML = PLATFORMS.map(p => `
    <label class="platform-toggle">
      <input type="checkbox" data-platform="${p.id}" checked />
      ${p.emoji} ${p.name}
    </label>
  `).join('');
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = isError ? 'toast error' : 'toast';
    setTimeout(() => { toast.className = 'toast hidden'; }, 2000);
}

// === Settings 读写 ===

async function loadSettings() {
    return new Promise((resolve) => {
        // eslint-disable-next-line no-undef
        chrome.storage.local.get('oraclexSettings', (result) => {
            resolve(result.oraclexSettings || { ...DEFAULT_SETTINGS });
        });
    });
}

async function saveSettings(settings) {
    return new Promise((resolve) => {
        // eslint-disable-next-line no-undef
        chrome.storage.local.set({ oraclexSettings: settings }, () => {
            // 同时写入 oraclexApiBaseUrl 以兼容旧版 background.js
            // eslint-disable-next-line no-undef
            chrome.storage.local.set({ oraclexApiBaseUrl: settings.apiBaseUrl }, resolve);
        });
    });
}

// === 填充 / 收集表单 ===

function fillForm(settings) {
    document.getElementById('apiBaseUrl').value = settings.apiBaseUrl || '';
    document.getElementById('riskProfile').value = settings.riskProfile || 'balanced';
    document.getElementById('coolingTime').value = settings.coolingTime || 20;
    document.getElementById('enableNoFomoBlock').checked = settings.enableNoFomoBlock !== false;

    const enabled = settings.enabledPlatforms || PLATFORMS.map(p => p.id);
    document.querySelectorAll('[data-platform]').forEach((cb) => {
        cb.checked = enabled.includes(cb.dataset.platform);
    });
}

function collectForm() {
    const enabledPlatforms = [];
    document.querySelectorAll('[data-platform]').forEach((cb) => {
        if (cb.checked) enabledPlatforms.push(cb.dataset.platform);
    });

    return {
        apiBaseUrl: document.getElementById('apiBaseUrl').value.trim() || DEFAULT_SETTINGS.apiBaseUrl,
        riskProfile: document.getElementById('riskProfile').value,
        coolingTime: Math.max(5, Math.min(120, parseInt(document.getElementById('coolingTime').value, 10) || 20)),
        enableNoFomoBlock: document.getElementById('enableNoFomoBlock').checked,
        enabledPlatforms,
    };
}

// === 事件绑定 ===

document.addEventListener('DOMContentLoaded', async () => {
    renderPlatforms();

    const settings = await loadSettings();
    fillForm(settings);

    document.getElementById('saveBtn').addEventListener('click', async () => {
        const data = collectForm();
        await saveSettings(data);
        showToast('✅ 设置已保存');
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        fillForm({ ...DEFAULT_SETTINGS });
        showToast('↺ 已重置为默认值');
    });
});
