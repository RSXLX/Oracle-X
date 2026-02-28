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
    backendUrl: 'http://localhost:3000',
    aiBaseUrl: 'https://mydmx.huoyuanqudao.cn/v1',
    aiApiKey: '',
    aiModel: 'MiniMax-M2.5-highspeed',
    aiVisionModel: 'MiniMax-M2.5-highspeed',
    riskProfile: 'balanced',
    coolingTime: 20,
    enableNoFomoBlock: true,
    enabledPlatforms: PLATFORMS.map(p => p.id),
    // Smart Intercept
    enableSmartIntercept: true,
    interceptSensitivity: 'balanced',
    lowRiskNotify: 'bubble',
    cacheExpiry: 300,
    apiTimeout: 5,
};

// === Desktop 连接状态 ===

const DESKTOP_API = 'http://127.0.0.1:17891';

async function checkDesktopStatus() {
    const statusEl = document.getElementById('desktopStatus');
    const dotEl = document.getElementById('desktopStatusDot');
    const textEl = document.getElementById('desktopStatusText');
    if (!statusEl) return;

    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 600);
        const res = await fetch(`${DESKTOP_API}/api/settings`, { signal: controller.signal });
        if (res.ok) {
            const desktop = await res.json();
            // 已连接
            statusEl.className = 'desktop-status connected';
            textEl.textContent = '🟢 已连接 Oracle-X Desktop – AI 配置由桌面端统一管理';
            // 自动填入 Desktop 配置，并设置只读
            if (desktop.aiBaseUrl) {
                document.getElementById('aiBaseUrl').value = desktop.aiBaseUrl;
                document.getElementById('aiBaseUrl').disabled = true;
            }
            if (desktop.aiApiKey) {
                document.getElementById('aiApiKey').value = '•••••• (来自 Desktop)';
                document.getElementById('aiApiKey').disabled = true;
            }
            if (desktop.aiModel) {
                document.getElementById('aiModel').value = desktop.aiModel;
                document.getElementById('aiModel').disabled = true;
            }
            return;
        }
    } catch { /* 连接失败 */ }

    // 未连接
    statusEl.className = 'desktop-status disconnected';
    textEl.textContent = '🔴 未连接 – 独立模式，请手动填写 AI 配置';
}

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
            // 同时单独存 key 可能会更方便 background 读取
            chrome.storage.local.set({
                oraclexBackendUrl: settings.backendUrl,
                oraclexAiBaseUrl: settings.aiBaseUrl,
                oraclexAiApiKey: settings.aiApiKey,
                oraclexAiModel: settings.aiModel,
                oraclexAiVisionModel: settings.aiVisionModel
            }, resolve);
        });
    });
}

// === 填充 / 收集表单 ===

function fillForm(settings) {
    document.getElementById('backendUrl').value = settings.backendUrl || '';
    document.getElementById('aiBaseUrl').value = settings.aiBaseUrl || '';
    document.getElementById('aiApiKey').value = settings.aiApiKey || '';
    document.getElementById('aiModel').value = settings.aiModel || '';
    document.getElementById('aiVisionModel').value = settings.aiVisionModel || '';

    document.getElementById('riskProfile').value = settings.riskProfile || 'balanced';
    document.getElementById('coolingTime').value = settings.coolingTime || 20;
    document.getElementById('enableNoFomoBlock').checked = settings.enableNoFomoBlock !== false;

    // Smart Intercept
    document.getElementById('enableSmartIntercept').checked = settings.enableSmartIntercept !== false;
    document.getElementById('interceptSensitivity').value = settings.interceptSensitivity || 'balanced';
    document.getElementById('lowRiskNotify').value = settings.lowRiskNotify || 'bubble';
    document.getElementById('cacheExpiry').value = settings.cacheExpiry || 300;
    document.getElementById('apiTimeout').value = settings.apiTimeout || 5;

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
        backendUrl: document.getElementById('backendUrl').value.trim() || DEFAULT_SETTINGS.backendUrl,
        aiBaseUrl: document.getElementById('aiBaseUrl').value.trim() || DEFAULT_SETTINGS.aiBaseUrl,
        aiApiKey: document.getElementById('aiApiKey').value.trim(),
        aiModel: document.getElementById('aiModel').value.trim() || DEFAULT_SETTINGS.aiModel,
        aiVisionModel: document.getElementById('aiVisionModel').value.trim() || DEFAULT_SETTINGS.aiVisionModel,
        riskProfile: document.getElementById('riskProfile').value,
        coolingTime: Math.max(5, Math.min(120, parseInt(document.getElementById('coolingTime').value, 10) || 20)),
        enableNoFomoBlock: document.getElementById('enableNoFomoBlock').checked,
        enabledPlatforms,
        // Smart Intercept
        enableSmartIntercept: document.getElementById('enableSmartIntercept').checked,
        interceptSensitivity: document.getElementById('interceptSensitivity').value,
        lowRiskNotify: document.getElementById('lowRiskNotify').value,
        cacheExpiry: Math.max(60, Math.min(600, parseInt(document.getElementById('cacheExpiry').value, 10) || 300)),
        apiTimeout: Math.max(3, Math.min(15, parseInt(document.getElementById('apiTimeout').value, 10) || 5)),
    };
}

// === 事件绑定 ===

document.addEventListener('DOMContentLoaded', async () => {
    renderPlatforms();
    checkDesktopStatus();

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
