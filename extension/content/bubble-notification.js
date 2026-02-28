/**
 * Oracle-X Bubble Notification
 * 低风险场景下的轻量通知气泡，1秒后自动消失
 */

(function () {
    'use strict';

    const BUBBLE_ID = 'oraclex-bubble-notification';
    const AUTO_DISMISS_MS = 2000;
    let dismissTimer = null;

    let lastScoreResult = null;
    let lastTradeContext = null;

    /**
     * 创建气泡 DOM
     */
    function createBubbleElement(scoreResult, x, y) {
        // 移除旧的
        dismiss();

        const bubble = document.createElement('div');
        bubble.id = BUBBLE_ID;
        bubble.className = 'oraclex-bubble oraclex-bubble-enter';

        const levelEmoji = scoreResult.level === 'low' ? '✅' : scoreResult.level === 'medium' ? '⚠️' : '🔴';
        const levelText = scoreResult.level === 'low' ? '风险较低' : scoreResult.level === 'medium' ? '中等风险' : '高风险';
        const levelClass = `oraclex-bubble-${scoreResult.level}`;

        bubble.innerHTML = `
      <div class="oraclex-bubble-inner ${levelClass}">
        <div class="oraclex-bubble-header">
          <span class="oraclex-bubble-icon">${levelEmoji}</span>
          <span class="oraclex-bubble-title">Oracle-X</span>
          <span class="oraclex-bubble-score">${scoreResult.score}分</span>
        </div>
        <div class="oraclex-bubble-body">
          <span class="oraclex-bubble-level">${levelText}</span>
          <span class="oraclex-bubble-reason">${scoreResult.reasons[0] || ''}</span>
        </div>
        <div class="oraclex-bubble-footer">
          <span class="oraclex-bubble-expand" id="oraclex-bubble-expand">查看详情 ›</span>
        </div>
      </div>
    `;

        // 计算位置（不超出视窗）
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const bubbleW = 280;
        const bubbleH = 100;

        let left = Math.min(x + 10, viewW - bubbleW - 20);
        let top = y - bubbleH - 10;
        if (top < 10) top = y + 30;
        left = Math.max(10, left);

        bubble.style.cssText = `
      position: fixed;
      left: ${left}px;
      top: ${top}px;
      z-index: 2147483647;
      pointer-events: auto;
    `;

        document.body.appendChild(bubble);

        // 绑定"查看详情"点击 → 打开快速 intercept popup（不是慢的 Side Panel）
        const expandBtn = bubble.querySelector('#oraclex-bubble-expand');
        if (expandBtn) {
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismiss();
                if (typeof chrome !== 'undefined' && chrome.runtime && lastScoreResult) {
                    chrome.runtime.sendMessage({
                        type: 'INTERCEPT_TRADE',
                        data: {
                            tradeContext: lastTradeContext || { symbol: 'UNKNOWN', direction: 'buy', platform: 'Unknown' },
                            scoreResult: lastScoreResult
                        }
                    });
                }
            });
        }

        return bubble;
    }

    /**
     * 显示气泡通知
     * @param {Object} scoreResult - 评分结果 { score, level, reasons }
     * @param {number} x - 鼠标 X 坐标
     * @param {number} y - 鼠标 Y 坐标
     */
    function show(scoreResult, x, y, tradeContext) {
        lastScoreResult = scoreResult;
        lastTradeContext = tradeContext || null;
        createBubbleElement(scoreResult, x, y);

        // 自动消失
        if (dismissTimer) clearTimeout(dismissTimer);
        dismissTimer = setTimeout(() => {
            const el = document.getElementById(BUBBLE_ID);
            if (el) {
                el.classList.remove('oraclex-bubble-enter');
                el.classList.add('oraclex-bubble-exit');
                setTimeout(() => {
                    el.remove();
                }, 300);
            }
        }, AUTO_DISMISS_MS);
    }

    /**
     * 手动关闭气泡
     */
    function dismiss() {
        if (dismissTimer) {
            clearTimeout(dismissTimer);
            dismissTimer = null;
        }
        const el = document.getElementById(BUBBLE_ID);
        if (el) el.remove();
    }

    // 导出
    if (typeof window !== 'undefined') {
        window.OracleXBubble = {
            show,
            dismiss,
        };
    }
})();
