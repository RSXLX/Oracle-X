/**
 * Oracle-X Onboarding — 步骤导航与 AI 连接测试
 */

let currentStep = 0;
let aiConfigured = false;

function goStep(idx) {
    // 隐藏所有步骤
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.progress-dot').forEach((d, i) => {
        d.classList.remove('active');
        d.classList.toggle('done', i < idx);
    });

    // 切换到目标步骤
    document.getElementById(`step-${idx}`).classList.add('active');
    document.getElementById(`dot-${idx}`).classList.add('active');
    currentStep = idx;

    // 第 3 步时更新 AI 状态
    if (idx === 2) {
        updateAIStatus();
    }
}

async function testAI() {
    const baseUrl = document.getElementById('aiBaseUrl').value.trim();
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const model = document.getElementById('aiModel').value.trim();
    const status = document.getElementById('testStatus');
    const btn = document.getElementById('testBtn');

    if (!baseUrl || !apiKey) {
        status.textContent = '请填写 Base URL 和 API Key';
        status.className = 'test-status error';
        return;
    }

    btn.disabled = true;
    status.textContent = '正在测试连接...';
    status.className = 'test-status loading';

    try {
        // 通过 preload 暴露的 IPC 调用 main 进程保存并测试
        if (window.oracleDesktop) {
            await window.oracleDesktop.saveSettings({
                apiBaseUrl: baseUrl,
                apiKey: apiKey,
                aiModel: model || 'gpt-4o-mini',
            });
            const ok = await window.oracleDesktop.testAIConnection();
            if (ok) {
                status.textContent = '✓ 连接成功！AI 服务已就绪';
                status.className = 'test-status success';
                aiConfigured = true;
            } else {
                status.textContent = '✗ 连接失败，请检查配置';
                status.className = 'test-status error';
            }
        } else {
            // 无 preload — 直接 fetch 测试
            const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: model || 'gpt-4o-mini',
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 5,
                }),
                signal: AbortSignal.timeout(8000),
            });
            if (res.ok) {
                status.textContent = '✓ 连接成功！';
                status.className = 'test-status success';
                aiConfigured = true;
            } else {
                status.textContent = `✗ HTTP ${res.status}`;
                status.className = 'test-status error';
            }
        }
    } catch (err) {
        status.textContent = `✗ ${err.message}`;
        status.className = 'test-status error';
    } finally {
        btn.disabled = false;
    }
}

function updateAIStatus() {
    const icon = document.getElementById('aiStatusIcon');
    const text = document.getElementById('aiStatusText');
    if (aiConfigured) {
        icon.style.color = 'var(--ox-success)';
        icon.classList.add('done');
        text.textContent = 'AI 服务已配置';
    } else {
        icon.style.color = 'var(--ox-text-muted)';
        text.textContent = 'AI 服务未配置（可稍后在设置中配置）';
    }
}

async function finish() {
    // 保存 AI 配置（如果有输入）
    const baseUrl = document.getElementById('aiBaseUrl').value.trim();
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const model = document.getElementById('aiModel').value.trim();

    if (window.oracleDesktop) {
        const cfg = { onboardingCompleted: true };
        if (baseUrl) cfg.apiBaseUrl = baseUrl;
        if (apiKey) cfg.apiKey = apiKey;
        if (model) cfg.aiModel = model;
        await window.oracleDesktop.saveSettings(cfg);
        // 通知主进程完成 onboarding
        window.oracleDesktop.finishOnboarding();
    }
}

// 键盘导航
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentStep < 2) {
        goStep(currentStep + 1);
    } else if (e.key === 'Escape' && currentStep > 0) {
        goStep(currentStep - 1);
    }
});
