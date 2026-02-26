/**
 * Oracle-X Storage Manager
 * Extension 与 Desktop 之间的数据同步
 */

const STORAGE_KEYS = {
  SETTINGS: 'oraclex_settings',
  DECISION_LOGS: 'oraclex_decision_logs',
  CURRENT_DECISION: 'oraclex_current_decision',
  STATS: 'oraclex_stats',
};

/**
 * 保存设置
 */
async function saveSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * 读取设置
 */
async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[STORAGE_KEYS.SETTINGS] || {});
      }
    });
  });
}

/**
 * 保存决策日志
 */
async function saveDecisionLog(log) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS.DECISION_LOGS, (result) => {
      const logs = result[STORAGE_KEYS.DECISION_LOGS] || [];
      logs.unshift(log); // 添加到开头
      // 只保留最近 500 条
      const trimmed = logs.slice(0, 500);
      
      chrome.storage.local.set({ [STORAGE_KEYS.DECISION_LOGS]: trimmed }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(true);
        }
      });
    });
  });
}

/**
 * 读取决策日志
 */
async function getDecisionLogs(limit = 50) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS.DECISION_LOGS, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        const logs = result[STORAGE_KEYS.DECISION_LOGS] || [];
        resolve(logs.slice(0, limit));
      }
    });
  });
}

/**
 * 更新统计数据
 */
async function updateStats(action) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS.STATS, (result) => {
      const stats = result[STORAGE_KEYS.STATS] || {
        todayBlocks: 0,
        todayAnalyzes: 0,
        totalBlocks: 0,
        totalAnalyzes: 0,
        lastDate: new Date().toDateString()
      };
      
      const today = new Date().toDateString();
      if (stats.lastDate !== today) {
        // 新的一天，重置统计
        stats.todayBlocks = 0;
        stats.todayAnalyzes = 0;
        stats.lastDate = today;
      }
      
      if (action === 'block') {
        stats.todayBlocks++;
        stats.totalBlocks++;
      }
      
      stats.todayAnalyzes++;
      stats.totalAnalyzes++;
      
      chrome.storage.local.set({ [STORAGE_KEYS.STATS]: stats }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(stats);
        }
      });
    });
  });
}

/**
 * 获取统计数据
 */
async function getStats() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(STORAGE_KEYS.STATS, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[STORAGE_KEYS.STATS] || {
          todayBlocks: 0,
          todayAnalyzes: 0,
          totalBlocks: 0,
          totalAnalyzes: 0,
          lastDate: new Date().toDateString()
        });
      }
    });
  });
}

// 导出
if (typeof window !== 'undefined') {
  window.OracleXStorage = {
    saveSettings,
    getSettings,
    saveDecisionLog,
    getDecisionLogs,
    updateStats,
    getStats,
  };
}
