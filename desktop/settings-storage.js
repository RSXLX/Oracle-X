/**
 * Oracle-X Desktop - Settings Storage (MySQL)
 * 本地设置持久化 → MySQL
 */

class SettingsStorage {
  constructor(db) {
    this.db = db;
    this.settings = {};
  }

  /**
   * 加载所有设置
   */
  async load() {
    try {
      const [rows] = await this.db.execute('SELECT `key`, `value` FROM settings');
      this.settings = {};
      for (const row of rows) {
        try {
          this.settings[row.key] = JSON.parse(row.value);
        } catch {
          this.settings[row.key] = row.value;
        }
      }
      console.log('[Storage] Settings loaded from MySQL');
    } catch (err) {
      console.error('[Storage] Load error:', err.message);
      this.settings = {};
    }
    return this.settings;
  }

  /**
   * 保存设置
   */
  async save(newSettings = {}) {
    this.settings = { ...this.settings, ...newSettings };
    try {
      for (const [key, val] of Object.entries(this.settings)) {
        const value = typeof val === 'object' ? JSON.stringify(val) : String(val);
        await this.db.execute(
          'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
          [key, value, value]
        );
      }
      console.log('[Storage] Settings saved to MySQL');
      return true;
    } catch (err) {
      console.error('[Storage] Save error:', err.message);
      return false;
    }
  }

  /**
   * 获取设置
   */
  get(key = null) {
    if (key) return this.settings[key];
    return this.settings;
  }

  /**
   * 重置
   */
  async reset() {
    this.settings = {};
    try {
      await this.db.execute('DELETE FROM settings');
    } catch (err) {
      console.error('[Storage] Reset error:', err.message);
    }
  }
}

module.exports = { SettingsStorage };
