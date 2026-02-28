# Desktop 改造 — 技术设计文档

> 版本：v2.0 | 日期：2026-02-28 | 状态：待审批

---

## 1. 改造 1：MySQL → SQLite

### 1.1 API 适配层设计

MySQL `pool.execute(sql, params)` 返回 `[rows, fields]`（异步）。
SQLite `db.prepare(sql).all(...params)` 返回 `rows`（同步）。

**适配策略**：创建包装器，保持 `db.execute(sql, params) → [rows]` 接口一致。

```javascript
// 新 database.js 核心接口
module.exports = {
  init(),        // 打开/创建 SQLite 文件 + 建表
  getPool(),     // 返回包装后的 db 对象（兼容 pool 调用方）
  close(),       // 关闭连接
};

// 包装器：让调用方无需修改
db.execute(sql, params) → Promise<[rows, []]>
```

### 1.2 SQL 语法转换

| MySQL 语法 | SQLite 替代 |
|-----------|------------|
| `AUTO_INCREMENT` | `AUTOINCREMENT` |
| `INT AUTO_INCREMENT PRIMARY KEY` | `INTEGER PRIMARY KEY AUTOINCREMENT` |
| `ENUM('import','chain')` | `TEXT CHECK(source IN ('import','chain'))` |
| `JSON DEFAULT NULL` | `TEXT DEFAULT NULL` |
| `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` | `TEXT DEFAULT (datetime('now'))` |
| `ON UPDATE CURRENT_TIMESTAMP` | 手动触发器（或省略） |
| `UNIQUE KEY idx_name (col1, col2)` | `UNIQUE (col1, col2)` |
| `INDEX idx_name (col)` | 单独 `CREATE INDEX` |
| `` \`key\` `` | `"key"` |

### 1.3 数据文件位置

```
~/Library/Application Support/Oracle-X/oraclex.db
```

使用 `app.getPath('userData')` 获取。

---

## 2. 改造 2：隐私权限分级

### 2.1 权限检查 API

```javascript
// Electron 内置 API
const { systemPreferences } = require('electron');

// 屏幕录制权限
systemPreferences.getMediaAccessStatus('screen')
// → 'granted' | 'denied' | 'not-determined'

// 辅助功能（需 osascript 测试）
// 尝试执行 osascript，成功=已授权
```

### 2.2 权限引导流程

```
用户开启"自动监控"
        │
        ▼
检查屏幕录制权限 ← getMediaAccessStatus('screen')
        │
   ┌────┴────┐
   │         │
  granted  denied/not-determined
   │         │
   ▼         ▼
 启动监控   弹出引导对话框
              │
         ┌────┴────┐
         │         │
      「去设置」  「取消」
         │         │
         ▼         ▼
   打开系统设置  保持关闭
```

### 2.3 引导对话框内容

```
标题：需要屏幕录制权限
内容：Oracle-X 需要「屏幕录制」权限来分析交易界面。

🔒 隐私保护承诺：
• 截图仅用于本地 AI 分析，分析后立即删除
• 不会上传到任何云服务器
• 您可以随时在设置中关闭此功能

按钮：[去系统设置授权] [暂不开启]
```

---

## 3. 代码变更清单

| # | 文件 | 类型 | 说明 |
|---|------|------|------|
| 1 | `desktop/database.js` | 重写 | MySQL → SQLite + 兼容包装器 |
| 2 | `desktop/main.js` | 修改 | 移除 MySQL 错误弹窗；集成权限引导 |
| 3 | `desktop/permission-manager.js` | 增强 | Electron API 权限检查 + 分级引导 |
| 4 | `desktop/monitor.js` | 修改 | 启动前检查权限 |
| 5 | `desktop/package.json` | 修改 | `mysql2` → `better-sqlite3` |

---

## 4. 开发任务

### Sprint 1：SQLite 迁移（核心）
- [ ] T1: 安装 `better-sqlite3`，移除 `mysql2`
- [ ] T2: 重写 `database.js`（SQLite + 兼容包装器）
- [ ] T3: 修改 `main.js` 初始化流程

### Sprint 2：权限引导
- [ ] T4: 增强 `permission-manager.js`（Electron API + 引导对话框）
- [ ] T5: 修改 `monitor.js`（启动前权限检查）
- [ ] T6: 修改 `main.js`（默认关闭自动监控 + 设置联动）

### Sprint 3：验证
- [ ] T7: `npm run dev` 启动验证
- [ ] T8: 功能验收（CSV 导入、设置保存、截图分析）

---

## 5. 验证计划

### 5.1 启动验证
```bash
cd /Users/hmwz/AI项目/Oracle-X/desktop
npm install
npm run dev
```
预期：应用正常启动，无 MySQL 错误。

### 5.2 功能验证（用户手动）
1. 应用启动后，检查 `~/Library/Application Support/Oracle-X/` 下是否生成 `oraclex.db`
2. 修改设置 → 关闭重开 → 设置保留
3. Cmd+Shift+S 手动截图 → 弹出分析结果（需配置 AI API Key）
4. 设置中开启"自动监控" → 弹出权限引导对话框
