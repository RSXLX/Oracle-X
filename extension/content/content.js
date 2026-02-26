/**
 * Oracle-X Content Script
 * 自动监听交易平台按钮点击，触发 FOMO 拦截
 */

(function() {
  'use strict';

  // 平台检测
  const PLATFORMS = {
    binance: {
      name: 'Binance',
      buyButton: '[class*="buyBtn"], button[data-bn-type="button"], .css-1ap5wc6',
      sellButton: '[class*="sellBtn"], button[data-bn-type="button"]',
      symbolSelector: '.symbolTitle, .css-1ap5wc6',
    },
    okx: {
      name: 'OKX',
      buyButton: '.trade-btn_buy, .buy-btn, [class*="buy-button"]',
      sellButton: '.trade-btn_sell, .sell-btn, [class*="sell-button"]',
      symbolSelector: '.symbol-name, .trade-coin',
    },
    bybit: {
      name: 'Bybit',
      buyButton: '.buy-btn, [class*="buyButton"]',
      sellButton: '.sell-btn, [class*="sellButton"]',
      symbolSelector: '.symbol-name, .trade-coin',
    },
    coinbase: {
      name: 'Coinbase',
      buyButton: '[data-testid="buy-button"], .buy-button',
      sellButton: '[data-testid="sell-button"], .sell-button',
      symbolSelector: '.asset-name, [data-testid="asset-name"]',
    },
  };

  // 检测当前平台
  function detectPlatform() {
    const hostname = window.location.hostname;
    for (const [key, platform] of Object.entries(PLATFORMS)) {
      if (hostname.includes(key)) {
        return { key, ...platform };
      }
    }
    return null;
  }

  // 创建拦截弹窗
  function createBlockerModal(platform, tradeType) {
    // 移除已存在的弹窗
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
            <p class="oraclex-platform">检测到 ${platform.name} ${tradeType === 'buy' ? '买入' : '卖出'} 操作</p>
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

    // 阻止原始点击事件
    return modal;
  }

  // 启动冷静倒计时
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

  // 初始化监听
  function init() {
    const platform = detectPlatform();
    if (!platform) return;

    console.log('[Oracle-X] Content script loaded for', platform.name);

    // 监听按钮点击
    document.addEventListener('click', function(e) {
      const target = e.target;
      
      // 检查是否点击了买入/卖出按钮
      const isBuyButton = target.closest(platform.buyButton);
      const isSellButton = target.closest(platform.sellButton);
      
      if (isBuyButton || isSellButton) {
        e.preventDefault();
        e.stopPropagation();
        
        const tradeType = isBuyButton ? 'buy' : 'sell';
        console.log('[Oracle-X] Detected', tradeType, 'click on', platform.name);
        
        const modal = createBlockerModal(platform, tradeType);
        startCooldown(modal, () => {
          // 冷静期结束后模拟点击
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
