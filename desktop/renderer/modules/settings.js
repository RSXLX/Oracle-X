/**
 * Oracle-X Desktop — 设置面板
 */

// ==================== 设置 ====================
async function loadSettings() {
    try {
        const settings = await window.oracleDesktop.getSettings();
        if (settings) {
            document.getElementById('cooldown').value = settings.cooldown || 5;
            document.getElementById('enableBlock').checked = settings.enableBlock ?? true;
            document.getElementById('autoStart').checked = settings.autoStart ?? false;
            // AI 配置
            document.getElementById('aiBaseUrl').value = settings.apiBaseUrl || '';
            document.getElementById('aiApiKey').value = settings.apiKey || '';
            document.getElementById('aiModel').value = settings.aiModel || '';
            const tempSlider = document.getElementById('aiTemperature');
            tempSlider.value = settings.aiTemperature ?? 0.3;
            document.getElementById('aiTemperatureValue').textContent = tempSlider.value;
            document.getElementById('proxyUrl').value = settings.proxyUrl || '';
        }
    } catch (err) {
        console.error('Load settings error:', err);
    }
}

async function saveSettings() {
    try {
        await window.oracleDesktop.saveSettings({
            cooldown: parseInt(document.getElementById('cooldown').value) || 5,
            enableBlock: document.getElementById('enableBlock').checked,
            autoStart: document.getElementById('autoStart').checked,
            apiBaseUrl: document.getElementById('aiBaseUrl').value.trim(),
            apiKey: document.getElementById('aiApiKey').value.trim(),
            aiModel: document.getElementById('aiModel').value.trim(),
            aiTemperature: parseFloat(document.getElementById('aiTemperature').value) || 0.3,
            proxyUrl: document.getElementById('proxyUrl').value.trim(),
        });
        showStatus('saveBtn', t('common.saved'), 'success');
    } catch (err) {
        showStatus('saveBtn', t('common.saveFailed'), 'error');
    }
}

// Temperature 滑块实时显示
document.getElementById('aiTemperature')?.addEventListener('input', (e) => {
    document.getElementById('aiTemperatureValue').textContent = e.target.value;
});

// API Key 显示/隐藏
document.getElementById('toggleApiKeyBtn')?.addEventListener('click', () => {
    const input = document.getElementById('aiApiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
});

// 测试 AI 连接
document.getElementById('testAIBtn')?.addEventListener('click', async () => {
    const statusEl = document.getElementById('testAIStatus');
    statusEl.textContent = '⏳ 测试中...';
    statusEl.className = 'status-hint';
    try {
        const ok = await window.oracleDesktop.testAIConnection();
        if (ok) {
            statusEl.textContent = '✅ 连接成功';
            statusEl.className = 'status-hint status-success';
        } else {
            statusEl.textContent = '❌ 连接失败';
            statusEl.className = 'status-hint status-error';
        }
    } catch (err) {
        statusEl.textContent = '❌ ' + (err.message || '连接失败');
        statusEl.className = 'status-hint status-error';
    }
});

document.getElementById('saveBtn')?.addEventListener('click', saveSettings);
