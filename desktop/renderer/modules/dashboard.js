/**
 * Oracle-X Desktop — 仪表盘模块（决策日志 + 截图分析 + 通知 + 侧边栏）
 */

// ==================== 决策日志 ====================
let allDecisionLogs = [];

async function refreshLogs() {
    try {
        const { items } = await window.oracleDesktop.listDecisionLogs(100);
        const el = document.getElementById('decisionLogs');
        if (!el) return;

        if (!items?.length) {
            el.innerHTML = `<p class="muted">${t('monitor.decisionLogEmpty')}</p>`;
            renderPagination('decisionLogsPagination', 0, 10, 1, () => { });
            return;
        }

        allDecisionLogs = items;
        renderDecisionLogsPage(1);
    } catch (err) {
        console.error('Load logs error:', err);
    }
}

function renderDecisionLogsPage(page) {
    const el = document.getElementById('decisionLogs');
    if (!el) return;

    const perPage = 10;
    const start = (page - 1) * perPage;
    const pageData = allDecisionLogs.slice(start, start + perPage);

    const actionLabels = { block: t('monitor.actionBlock'), warn: t('monitor.actionWarn'), allow: t('monitor.actionAllow') };
    el.innerHTML = pageData.map(log => {
        const time = log.created_at ? new Date(log.created_at).toLocaleString() : '-';
        const badge = log.action === 'block' ? 'block' : log.action === 'warn' ? 'warn' : 'allow';
        return `<div class="log-item">
      <span class="badge badge-${badge}">${actionLabels[log.action] || log.action || '-'}</span>
      <span>${log.app_name || '-'}</span>
      <span class="muted">${time}</span>
      ${log.detail ? `<small class="muted">${typeof log.detail === 'string' ? log.detail.slice(0, 80) : ''}</small>` : ''}
    </div>`;
    }).join('');

    renderPagination('decisionLogsPagination', allDecisionLogs.length, perPage, page, (p) => {
        renderDecisionLogsPage(p);
    });
}

// ==================== 截图分析核心逻辑 ====================
let analysisCount = 0;
let riskCount = 0;

// ==================== 堆叠通知系统 ====================
function pushNotification(title, body, type = 'info', duration = 5000) {
    const stack = document.getElementById('notificationStack');
    const item = document.createElement('div');
    item.className = `notification-item notif-${type}`;
    const time = new Date().toLocaleTimeString();
    item.innerHTML = `
    <span class="notif-time">${time}</span>
    <div class="notif-title">${title}</div>
    <div class="notif-body">${body}</div>`;
    item.addEventListener('click', () => {
        item.classList.add('fade-out');
        setTimeout(() => item.remove(), 300);
    });
    stack.appendChild(item);
    while (stack.children.length > 5) stack.firstChild.remove();
    setTimeout(() => {
        if (item.parentNode) {
            item.classList.add('fade-out');
            setTimeout(() => item.remove(), 300);
        }
    }, duration);
}

// ==================== 侧边栏面板 ====================
function openSidePanel() {
    document.getElementById('sidePanelOverlay').classList.add('open');
    document.getElementById('sidePanel').classList.add('open');
}
function closeSidePanel() {
    document.getElementById('sidePanelOverlay').classList.remove('open');
    document.getElementById('sidePanel').classList.remove('open');
}
document.getElementById('sidePanelOverlay')?.addEventListener('click', closeSidePanel);
document.getElementById('sidePanelClose')?.addEventListener('click', closeSidePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidePanel(); });

function showSidePanelLoading() {
    document.getElementById('sidePanelTitle').textContent = t('sidePanel.loadingTitle');
    document.getElementById('sidePanelBody').innerHTML = `
    <div style="text-align:center;padding:40px 0;">
      <div class="loading">${t('sidePanel.loading')}</div>
      <p style="color:#6e7681;font-size:12px;margin-top:16px;">${t('sidePanel.loadingHint')}</p>
    </div>`;
    document.getElementById('sidePanelActions').style.display = 'none';
    openSidePanel();
}

function renderSidePanelResult(result) {
    const action = result?.action || 'allow';
    const risk = result?.riskLevel || 'low';
    const platform = result?.platform || t('sidePanel.unidentified');
    const symbol = result?.symbol || result?.pair || t('sidePanel.unidentified');
    const buttons = result?.buttons || [];
    const hasTrade = result?.hasTradingButtons || false;
    const summary = result?.summary || '';

    const rc = {
        high: { bg: '#3a1a1a', border: '#dc2626', text: '#f87171', emoji: '🔴', label: t('sidePanel.riskHigh') },
        medium: { bg: '#3a2a1a', border: '#d97706', text: '#fbbf24', emoji: '🟡', label: t('sidePanel.riskMedium') },
        low: { bg: '#1a3a2a', border: '#16a34a', text: '#4ade80', emoji: '🟢', label: t('sidePanel.riskLow') },
    }[risk] || { bg: '#1a3a2a', border: '#16a34a', text: '#4ade80', emoji: '🟢', label: t('sidePanel.riskLow') };

    const symbolHtml = symbol !== t('sidePanel.unidentified') ? `<div class="detail-item"><span class="detail-label">交易品种</span><span class="detail-value">${symbol}</span></div>` : '';

    document.getElementById('sidePanelTitle').textContent = t('sidePanel.resultTitle', { emoji: rc.emoji, label: rc.label });

    // 市场行情卡片
    const mi = result?.marketInfo;
    let marketHtml = '';
    if (mi && mi.price) {
        const changeColor = mi.change24h >= 0 ? '#3fb950' : '#f85149';
        const changeSign = mi.change24h >= 0 ? '+' : '';
        const pricePos = mi.high24h && mi.low24h && mi.high24h !== mi.low24h
            ? ((mi.price - mi.low24h) / (mi.high24h - mi.low24h) * 100).toFixed(0) : null;
        marketHtml = `
      <div class="card" style="margin:0 0 12px 0;padding:12px;">
        <h2 style="font-size:14px;margin-bottom:8px;">📊 实时行情 · ${mi.symbol || symbol}</h2>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">当前价格</span><span class="detail-value" style="font-size:16px;font-weight:600;">${mi.currency === 'CNY' ? '¥' : '$'}${Number(mi.price).toLocaleString()}</span></div>
          <div class="detail-item"><span class="detail-label">24h 涨跌</span><span class="detail-value" style="color:${changeColor};font-weight:600;">${changeSign}${Number(mi.change24h).toFixed(2)}%</span></div>
          <div class="detail-item"><span class="detail-label">24h 最高</span><span class="detail-value">${mi.currency === 'CNY' ? '¥' : '$'}${Number(mi.high24h).toLocaleString()}</span></div>
          <div class="detail-item"><span class="detail-label">24h 最低</span><span class="detail-value">${mi.currency === 'CNY' ? '¥' : '$'}${Number(mi.low24h).toLocaleString()}</span></div>
          ${mi.volume24h ? `<div class="detail-item"><span class="detail-label">成交量</span><span class="detail-value">${Number(mi.volume24h).toLocaleString()}</span></div>` : ''}
          ${pricePos !== null ? `<div class="detail-item"><span class="detail-label">区间位置</span><span class="detail-value">${pricePos}%</span></div>` : ''}
        </div>
      </div>`;
    }

    // AI 建议卡片（增强样式）
    let summaryHtml = '';
    if (summary) {
        const summaryBg = risk === 'high' ? 'rgba(220,38,38,0.1)' : risk === 'medium' ? 'rgba(217,119,6,0.1)' : 'rgba(22,163,74,0.1)';
        const summaryBorder = risk === 'high' ? '#dc2626' : risk === 'medium' ? '#d97706' : '#16a34a';
        summaryHtml = `
      <div class="card" style="margin:0 0 12px 0;padding:12px;background:${summaryBg};border:1px solid ${summaryBorder}30;">
        <h2 style="font-size:14px;margin-bottom:6px;">🤖 AI 风控建议</h2>
        <p style="color:#e6edf3;font-size:13px;line-height:1.7;margin:0;">${summary}</p>
      </div>`;
    }

    document.getElementById('sidePanelBody').innerHTML = `
    <div class="analysis-detail-card" style="border:1px solid ${rc.border};background:${rc.bg};">
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">${t('sidePanel.platform')}</span><span class="detail-value">${platform}</span></div>
        ${symbolHtml}
        <div class="detail-item"><span class="detail-label">${t('sidePanel.riskLevel')}</span><span class="detail-value" style="color:${rc.text};">${rc.emoji} ${rc.label}</span></div>
        <div class="detail-item"><span class="detail-label">${t('sidePanel.tradeButtons')}</span><span class="detail-value">${hasTrade ? t('sidePanel.detected') : t('sidePanel.notDetected')}</span></div>
        <div class="detail-item"><span class="detail-label">${t('sidePanel.suggestedAction')}</span><span class="detail-value" style="color:${rc.text};">${action === 'block' ? t('sidePanel.actionBlock') : action === 'warn' ? t('sidePanel.actionWarn') : t('sidePanel.actionAllow')}</span></div>
      </div>
      ${buttons.length ? `<div style="margin-bottom:12px;"><span class="detail-label">${t('sidePanel.detectedButtons')}</span><div class="analysis-buttons-list" style="margin-top:6px;">${buttons.map(b => `<span class="analysis-button-tag">${b}</span>`).join('')}</div></div>` : ''}
    </div>
    ${marketHtml}
    ${summaryHtml}
    <div class="card" style="margin-top:0;">
      <h2 style="font-size:14px;">${t('sidePanel.detailTitle')}</h2>
      <div style="font-size:12px;color:#6e7681;">
        <div style="margin-bottom:4px;">${t('sidePanel.detailTime', { time: new Date().toLocaleString() })}</div>
        <div style="margin-bottom:4px;">${t('sidePanel.detailEngine')}</div>
        <div>${t('sidePanel.detailPrivacy')}</div>
      </div>
    </div>`;
    document.getElementById('sidePanelActions').style.display = (action === 'block' || action === 'warn') ? 'flex' : 'none';
    openSidePanel();
}

// 侧边栏操作按钮
document.getElementById('sidePanelBlock')?.addEventListener('click', () => {
    pushNotification(t('notification.tradeCancelled'), t('notification.tradeCancelledBody'), 'warning');
    closeSidePanel();
});
document.getElementById('sidePanelAllow')?.addEventListener('click', () => {
    pushNotification(t('notification.tradeAllowed'), t('notification.tradeAllowedBody'), 'success');
    closeSidePanel();
});

// ==================== 截图按钮 ====================
document.getElementById('screenshotBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('screenshotBtn');
    btn.disabled = true;
    btn.textContent = t('monitor.screenshotting');
    showSidePanelLoading();
    pushNotification(t('notification.screenshotting'), t('notification.screenshottingBody'), 'info', 3000);

    try {
        const result = await window.oracleDesktop.takeScreenshot();
        if (!result) {
            closeSidePanel();
            pushNotification(t('notification.screenshotFailed'), t('notification.screenshotFailedBody'), 'error');
        }
    } catch (err) {
        closeSidePanel();
        pushNotification(t('notification.analysisError'), err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = t('monitor.screenshotBtn');
    }
});

// 快捷键截图也打开侧边栏
if (window.oracleDesktop.onScreenshotCaptured) {
    window.oracleDesktop.onScreenshotCaptured(() => {
        showSidePanelLoading();
        pushNotification(t('notification.screenshotSuccess'), t('notification.screenshotSuccessBody'), 'info', 4000);
    });
}

// 分析结果 → 侧边栏 + 通知 + 记录
if (window.oracleDesktop.onScreenshotResult) {
    window.oracleDesktop.onScreenshotResult((result) => {
        renderSidePanelResult(result);
        addAnalysisLog(result);
        updateStats(result);
        const risk = result?.riskLevel || 'low';
        const label = risk === 'high' ? t('sidePanel.riskHigh') : risk === 'medium' ? t('sidePanel.riskMedium') : t('sidePanel.riskLow');
        const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
        const type = risk === 'high' ? 'error' : risk === 'medium' ? 'warning' : 'success';
        pushNotification(`${emoji} ${label} · ${result?.platform || t('sidePanel.unidentified')}`,
            result?.action === 'block' ? t('notification.suggestCancel') : t('notification.safeOperation'), type, 6000);
    });
}

// 分析错误
if (window.oracleDesktop.onScreenshotError) {
    window.oracleDesktop.onScreenshotError((data) => {
        closeSidePanel();
        pushNotification(t('notification.analysisFailed'), data?.error || t('common.error'), 'error');
    });
}

// ==================== 分析记录 ====================
function addAnalysisLog(result) {
    const logEl = document.getElementById('screenshotLog');
    if (logEl.querySelector('.muted')) logEl.innerHTML = '';

    const risk = result?.riskLevel || 'low';
    const emoji = risk === 'high' ? '🔴' : risk === 'medium' ? '🟡' : '🟢';
    const label = risk === 'high' ? t('sidePanel.riskHigh') : risk === 'medium' ? t('sidePanel.riskMedium') : t('sidePanel.riskLow');
    const platform = result?.platform || t('sidePanel.unidentified');
    const time = new Date().toLocaleTimeString();
    const action = result?.action || 'allow';

    const entry = document.createElement('div');
    entry.style.cssText = 'padding:8px 12px;margin-bottom:6px;border-radius:6px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:13px;cursor:pointer;transition:background 0.2s;';
    entry.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span>${emoji} <strong>${label}</strong> · ${platform}</span>
      <span style="color:#8b949e;font-size:11px;">${time}</span>
    </div>
    ${result?.buttons?.length ? `<div style="color:#8b949e;font-size:11px;margin-top:4px;">${t('monitor.buttons')}: ${result.buttons.join(', ')}</div>` : ''}
    <div style="color:${action === 'block' ? '#f87171' : '#8b949e'};font-size:11px;margin-top:2px;">→ ${action === 'block' ? t('monitor.blocked') : action === 'warn' ? t('monitor.warned') : t('monitor.allowed')}</div>`;
    entry.addEventListener('click', () => renderSidePanelResult(result));
    entry.addEventListener('mouseenter', () => entry.style.background = 'rgba(255,255,255,0.08)');
    entry.addEventListener('mouseleave', () => entry.style.background = 'rgba(255,255,255,0.04)');
    logEl.prepend(entry);
}

// ==================== 统计更新 ====================
function updateStats(result) {
    analysisCount++;
    const el1 = document.getElementById('todayAnalyses');
    if (el1) el1.textContent = analysisCount;
    if (result?.action === 'block' || result?.action === 'warn') {
        riskCount++;
        const el2 = document.getElementById('todayBlock');
        if (el2) el2.textContent = riskCount;
    }
    const rate = analysisCount > 0 ? Math.round((riskCount / analysisCount) * 100) : 0;
    const el3 = document.getElementById('mitigationRate');
    if (el3) el3.textContent = rate + '%';
}
