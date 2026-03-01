/**
 * Oracle-X Desktop Renderer — 入口文件
 * 模块加载顺序：utils → settings → wallet → import → dashboard
 */

// i18n shorthand (全局共享)
const t = I18n.t.bind(I18n);

// 当前数据状态 (全局共享)
let currentTransactions = null;
let currentWalletIndex = -1;

// ==================== Tab 切换 ====================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});
