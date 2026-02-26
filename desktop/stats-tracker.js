/**
 * Oracle-X Desktop - Statistics Tracker
 * 统计追踪
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class StatsTracker {
  constructor() {
    this.statsPath = path.join(app.getPath('userData'), 'oraclex-stats.json');
    this.stats = {
      totalBlocks: 0,
      totalMitigations: 0,
      totalAnalyses: 0,
      dailyStats: {},
      appStats: {},
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.statsPath)) {
        const data = fs.readFileSync(this.statsPath, 'utf-8');
        this.stats = JSON.parse(data);
      }
    } catch (err) {
      console.error('[Stats] Load error:', err);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2));
    } catch (err) {
      console.error('[Stats] Save error:', err);
    }
  }

  /**
   * 记录阻断
   */
  recordBlock(appName) {
    const today = new Date().toISOString().split('T')[0];
    
    this.stats.totalBlocks++;
    this.stats.dailyStats[today] = this.stats.dailyStats[today] || { blocks: 0, mitigated: 0, analyses: 0 };
    this.stats.dailyStats[today].blocks++;
    this.stats.appStats[appName] = this.stats.appStats[appName] || { blocks: 0, mitigated: 0 };
    this.stats.appStats[appName].blocks++;
    
    this.save();
  }

  /**
   * 记录化解
   */
  recordMitigation(appName) {
    const today = new Date().toISOString().split('T')[0];
    
    this.stats.totalMitigations++;
    this.stats.dailyStats[today] = this.stats.dailyStats[today] || { blocks: 0, mitigated: 0, analyses: 0 };
    this.stats.dailyStats[today].mitigated++;
    this.stats.appStats[appName] = this.stats.appStats[appName] || { blocks: 0, mitigated: 0 };
    this.stats.appStats[appName].mitigated++;
    
    this.save();
  }

  /**
   * 记录分析
   */
  recordAnalysis() {
    const today = new Date().toISOString().split('T')[0];
    
    this.stats.totalAnalyses++;
    this.stats.dailyStats[today] = this.stats.dailyStats[today] || { blocks: 0, mitigated: 0, analyses: 0 };
    this.stats.dailyStats[today].analyses++;
    
    this.save();
  }

  /**
   * 获取今日统计
   */
  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const d = this.stats.dailyStats[today] || { blocks: 0, mitigated: 0, analyses: 0 };
    
    return {
      blocks: d.blocks,
      mitigated: d.mitigated,
      analyses: d.analyses,
      mitigationRate: d.analyses > 0 ? Math.round((d.analyses - d.blocks) / d.analyses * 100) : 0,
    };
  }

  /**
   * 获取总统计
   */
  getTotalStats() {
    return {
      totalBlocks: this.stats.totalBlocks,
      totalMitigations: this.stats.totalMitigations,
      totalAnalyses: this.stats.totalAnalyses,
    };
  }
}

module.exports = { StatsTracker };
