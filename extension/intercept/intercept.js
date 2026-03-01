/**
 * Oracle-X 交易拦截页面脚本
 * 极速决策模式：Quick Score 即时显示，AI 分析后台加载
 */

let tradeData = null;
let decided = false;
let aiExpanded = false;

// ========== 初始化 ==========
async function init() {
    // 绑定事件
    document.getElementById('btnProceed').addEventListener('click', () => handleDecision(true));
    document.getElementById('btnCancel').addEventListener('click', () => handleDecision(false));
    document.getElementById('aiHeader').addEventListener('click', toggleAI);

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (decided) return;
        if (e.key === 'Enter' || e.key === 'y' || e.key === 'Y') handleDecision(true);
        if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') handleDecision(false);
    });

    // 从 session storage 读取拦截数据
    try {
        const result = await chrome.storage.session.get('oraclex_pending_intercept');
        const pending = result?.oraclex_pending_intercept;
        if (pending && pending.timestamp && (Date.now() - pending.timestamp < 30000)) {
            tradeData = pending;
            chrome.storage.session.remove('oraclex_pending_intercept');
            renderTradeInfo(pending);
        } else {
            document.getElementById('tradePair').textContent = '无待处理的交易拦截';
            document.getElementById('actionsDiv').style.display = 'none';
        }
    } catch (e) {
        console.error('[Intercept] Failed to read session:', e);
    }

    // 监听 AI 分析流
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'ANALYSIS_STREAM') {
            renderAIStream(msg.data.fullText);
        } else if (msg.type === 'ANALYSIS_COMPLETE') {
            renderAIComplete(msg.data.fullText);
        } else if (msg.type === 'ANALYSIS_ERROR') {
            renderAIError(msg.data.error);
        } else if (msg.type === 'TRADE_INTERCEPTED' && !tradeData) {
            tradeData = msg.data;
            renderTradeInfo(msg.data);
        }
    });
}

// ========== 渲染交易信息 ==========
function renderTradeInfo(data) {
    const { tradeContext, scoreResult } = data;
    const level = scoreResult.level;

    // 交易对
    document.getElementById('tradePair').textContent =
        tradeContext.rawSymbol || tradeContext.symbol;

    // 元信息
    const dirClass = tradeContext.direction === 'buy' ? 'direction-buy' : 'direction-sell';
    const dirText = tradeContext.direction === 'buy' ? '🟢 买入' : '🔴 卖出';
    let metaHTML = `
    <span class="trade-meta-item ${dirClass}">${dirText}</span>
    <span class="trade-meta-item">💰 ${tradeContext.price || '--'}</span>
    <span class="trade-meta-item">📊 ${tradeContext.platform}</span>
  `;
    if (tradeContext.leverage && tradeContext.leverage > 1) {
        metaHTML += `<span class="trade-meta-item leverage-warn">⚠️ ${tradeContext.leverage}x 杠杆</span>`;
    }
    // 交易类型标签
    const typeLabels = { 'spot': '💰 现货', 'perpetual': '📜 永续', 'futures': '📋 交割', 'margin': '⚡ 杠杆' };
    const orderType = tradeContext.orderType || scoreResult?.tradeType || null;
    if (orderType && typeLabels[orderType]) {
        metaHTML += `<span class="trade-meta-item">${typeLabels[orderType]}</span>`;
    }
    document.getElementById('tradeMeta').innerHTML = metaHTML;

    // 风险等级 Badge
    const badge = document.getElementById('levelBadge');
    const levelMap = {
        low: { text: '低风险', cls: 'badge-low' },
        medium: { text: '中风险', cls: 'badge-medium' },
        high: { text: '高风险', cls: 'badge-high' },
    };
    const lv = levelMap[level] || levelMap.medium;
    badge.textContent = lv.text;
    badge.className = 'header-badge ' + lv.cls;

    // 评分卡
    const card = document.getElementById('scoreCard');
    card.className = 'score-card score-card-' + level;
    const sv = document.getElementById('scoreValue');
    sv.textContent = scoreResult.score + ' 分';
    sv.className = 'score-value score-' + level;

    // 评分原因
    const reasons = scoreResult.reasons || [];
    document.getElementById('scoreReasons').innerHTML =
        reasons.map(r => '<span>' + r + '</span>').join('');
}

// ========== 用户决策 ==========
function handleDecision(proceed) {
    if (decided) return;
    decided = true;

    const tabId = tradeData?.tabId;
    chrome.runtime.sendMessage({
        type: 'USER_DECISION',
        data: { proceed, tabId }
    });

    const actionsDiv = document.getElementById('actionsDiv');
    if (proceed) {
        actionsDiv.innerHTML =
            '<div class="decided decided-proceed">' +
            '✅ 已放行，交易继续执行' +
            '<div class="auto-close-hint">窗口将在 2 秒后自动关闭</div>' +
            '</div>';
    } else {
        actionsDiv.innerHTML =
            '<div class="decided decided-cancel">' +
            '❌ 交易已取消' +
            '<div class="auto-close-hint">窗口将在 2 秒后自动关闭</div>' +
            '</div>';
    }

    setTimeout(() => window.close(), 2000);
}

// ========== AI 分析流式渲染 ==========
function toggleAI() {
    aiExpanded = !aiExpanded;
    document.getElementById('aiBody').classList.toggle('open', aiExpanded);
    document.getElementById('aiToggle').textContent = aiExpanded ? '▲ 收起' : '▼ 展开';
}

function renderAIStream(text) {
    document.getElementById('aiLoading').style.display = 'none';
    document.getElementById('aiContent').innerHTML = formatMarkdown(text);
    document.getElementById('aiStatusText').textContent = 'AI 分析中...';
}

function renderAIComplete(text) {
    document.getElementById('aiLoading').style.display = 'none';
    document.getElementById('aiContent').innerHTML = formatMarkdown(text);
    document.getElementById('aiStatusText').textContent = '✅ AI 分析完成';
    if (!aiExpanded) toggleAI();
}

function renderAIError(error) {
    document.getElementById('aiLoading').style.display = 'none';
    document.getElementById('aiContent').innerHTML =
        '<span style="color:#f6465d">AI 分析失败: ' + error + '</span>';
    document.getElementById('aiStatusText').textContent = '❌ AI 分析失败';
}

function formatMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>')
        .replace(/#{1,3}\s(.*)/g, '<strong style="color:#58a6ff">$1</strong><br>');
}

// 启动
document.addEventListener('DOMContentLoaded', init);
