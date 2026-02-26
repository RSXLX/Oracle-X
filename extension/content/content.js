/**
 * Oracle-X Content Script
 * 自动监听交易平台按钮点击，触发 FOMO 拦截
 */

(function() {
  'use strict';

  // 平台检测模块已通过 platforms.js 提供
  const PlatformDetector = window.OracleXPlatforms;

  // 创建拦截弹窗
  function createBlockerModal(platform, tradeType, tradeInfo) {
    const existing = document.getElementById('oraclex-blocker-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'oraclex-blocker-modal';
    modal.innerHTML = `
      <div class="oraclex-modal-overlay">
        <div class="oraclex-modal-content">
          <div class="oraclex-modal-header">
            <span class="oraclex-icon">🧊</span>
            <span class="oraclex-title">NoFOMO 冷静期</span>
          </div>
          <div class="oraclex-modal-body">
            <div class="oraclex-trade-info">
              <p><strong>平台：</strong>${platform.name}</p>
              <p><strong>交易对：</strong>${tradeInfo?.symbol || '未知'}</p>
              <p><strong>价格：</strong>${tradeInfo?.price || '未知'}</p>
              <p><strong>操作：</strong>${tradeType === 'buy' ? '买入' : '卖出'}</p>
            </div>
            <p class="oraclex-countdown">请等待 <span id="oraclex-timer">5</span> 秒冷静期</p>
            <div class="oraclex-progress">
              <div class="oraclex-progress-bar" id="oraclex-progress-bar"></div>
            </div>
          </div>
          <div class="oraclex-modal-footer">
            <button class="oraclex-btn oraclex-btn-primary" id="oraclex-proceed">继续执行</button>
            <button class="oraclex-btn oraclex-btn-secondary" id="oraclex-cancel">取消</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  // 冷静倒计时
  function startCooldown(modal, callback) {
    const timerEl = modal.querySelector('#oraclex-timer');
    const progressBar = modal.querySelector('#oraclex-progress-bar');
    const proceedBtn = modal.querySelector('#oraclex-proceed');
    const cancelBtn = modal.querySelector('#oraclex-cancel');

    let seconds = 5;
    const total = 5;

    const interval = setInterval(() => {
      seconds--;
      timerEl.textContent = seconds;
      progressBar.style.width = ((total - seconds) / total * 100) + '%';

      if (seconds <= 0) {
        clearInterval(interval);
        proceedBtn.disabled = false;
        proceedBtn.textContent = '继续执行';
        timerEl.textContent = '0';
      }
    }, 1000);

    proceedBtn.addEventListener('click', () => {
      clearInterval(interval);
      modal.remove();
      if (callback) callback();
    });

    cancelBtn.addEventListener('click', () => {
      clearInterval(interval);
      modal.remove();
    });
  }

  // 初始化
  function init() {
    const platform = PlatformDetector?.detectPlatform();
    if (!platform) {
      console.log('[Oracle-X] Not a supported trading platform');
      return;
    }

    console.log('[Oracle-X] Loaded for', platform.name);

    // 点击监听
    document.addEventListener('click', function(e) {
      const target = e.target;

      // 检测买入按钮
      const isBuyButton = target.closest(platform.buyButton);
      // 检测卖出按钮
      const isSellButton = target.closest(platform.sellButton);

      if (isBuyButton || isSellButton) {
        e.preventDefault();
        e.stopPropagation();

        const tradeType = isBuyButton ? 'buy' : 'sell';
        const tradeInfo = PlatformDetector?.getTradeInfo(platform);

        console.log('[Oracle-X] Detected', tradeType, 'on', platform.name, tradeInfo);

        const modal = createBlockerModal(platform, tradeType, tradeInfo);
        startCooldown(modal, () => {
          target.click();
        });
      }
    }, true);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
