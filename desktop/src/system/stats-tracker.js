/**
 * Oracle-X Desktop - Statistics Tracker (MySQL)
 * 统计追踪 → MySQL
 */

class StatsTracker {
  constructor(db) {
    this.db = db;
  }

  /**
   * 记录阻断
   */
  async recordBlock(appName = '') {
    const today = new Date().toISOString().split('T')[0];
    await this.db.execute(
      `INSERT INTO stats (date, app_name, blocks, mitigated, analyses)
       VALUES (?, ?, 1, 0, 0)
       ON DUPLICATE KEY UPDATE blocks = blocks + 1`,
      [today, appName]
    );
  }

  /**
   * 记录化解
   */
  async recordMitigation(appName = '') {
    const today = new Date().toISOString().split('T')[0];
    await this.db.execute(
      `INSERT INTO stats (date, app_name, blocks, mitigated, analyses)
       VALUES (?, ?, 0, 1, 0)
       ON DUPLICATE KEY UPDATE mitigated = mitigated + 1`,
      [today, appName]
    );
  }

  /**
   * 记录分析
   */
  async recordAnalysis(appName = '') {
    const today = new Date().toISOString().split('T')[0];
    await this.db.execute(
      `INSERT INTO stats (date, app_name, blocks, mitigated, analyses)
       VALUES (?, ?, 0, 0, 1)
       ON DUPLICATE KEY UPDATE analyses = analyses + 1`,
      [today, appName]
    );
  }

  /**
   * 获取今日统计
   */
  async getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await this.db.execute(
      'SELECT SUM(blocks) as blocks, SUM(mitigated) as mitigated, SUM(analyses) as analyses FROM stats WHERE date = ?',
      [today]
    );
    const d = rows[0] || {};
    const blocks = d.blocks || 0;
    const mitigated = d.mitigated || 0;
    const analyses = d.analyses || 0;

    return {
      blocks,
      mitigated,
      analyses,
      mitigationRate: analyses > 0 ? Math.round((analyses - blocks) / analyses * 100) : 0,
    };
  }

  /**
   * 获取总统计
   */
  async getTotalStats() {
    const [rows] = await this.db.execute(
      'SELECT SUM(blocks) as totalBlocks, SUM(mitigated) as totalMitigations, SUM(analyses) as totalAnalyses FROM stats'
    );
    const d = rows[0] || {};
    return {
      totalBlocks: d.totalBlocks || 0,
      totalMitigations: d.totalMitigations || 0,
      totalAnalyses: d.totalAnalyses || 0,
    };
  }
}

module.exports = { StatsTracker };
