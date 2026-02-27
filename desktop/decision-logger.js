/**
 * Oracle-X Desktop - Decision Logger (MySQL)
 * 决策日志持久化 → MySQL
 */

class DecisionLogger {
  constructor(db) {
    this.db = db;
  }

  /**
   * 添加决策日志
   */
  async add(entry) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await this.db.execute(
      'INSERT INTO decision_logs (id, created_at, type, app_name, action, detail) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        now,
        entry.type || '',
        entry.appName || '',
        entry.action || '',
        typeof entry.detail === 'object' ? JSON.stringify(entry.detail) : (entry.detail || ''),
      ]
    );

    return { id, createdAt: now, ...entry };
  }

  /**
   * 获取日志
   */
  async get(limit = 50) {
    const [rows] = await this.db.execute(
      'SELECT * FROM decision_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows;
  }

  /**
   * 获取今日日志
   */
  async getToday() {
    const [rows] = await this.db.execute(
      'SELECT * FROM decision_logs WHERE DATE(created_at) = CURDATE() ORDER BY created_at DESC'
    );
    return rows;
  }

  /**
   * 清除日志
   */
  async clear() {
    await this.db.execute('DELETE FROM decision_logs');
  }
}

module.exports = { DecisionLogger };
