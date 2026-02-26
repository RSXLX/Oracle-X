/**
 * Oracle-X Desktop - Decision Logger
 * 决策日志持久化
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class DecisionLogger {
  constructor() {
    this.logPath = path.join(app.getPath('userData'), 'decision-logs.json');
    this.logs = [];
    this.maxLogs = 1000;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.logPath)) {
        const data = fs.readFileSync(this.logPath, 'utf-8');
        this.logs = JSON.parse(data);
      }
    } catch (err) {
      console.error('[Logger] Load error:', err);
      this.logs = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.logPath, JSON.stringify(this.logs, null, 2));
    } catch (err) {
      console.error('[Logger] Save error:', err);
    }
  }

  /**
   * 添加决策日志
   */
  add(entry) {
    const log = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    
    this.logs.unshift(log);
    
    // 限制数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }
    
    this.save();
    return log;
  }

  /**
   * 获取日志
   */
  get(limit = 50) {
    return this.logs.slice(0, limit);
  }

  /**
   * 获取今日日志
   */
  getToday() {
    const today = new Date().toDateString();
    return this.logs.filter(l => new Date(l.createdAt).toDateString() === today);
  }

  /**
   * 清除日志
   */
  clear() {
    this.logs = [];
    this.save();
  }
}

module.exports = { DecisionLogger };
