/**
 * Oracle-X Desktop - SQLite Database Manager
 * 零配置本地存储，兼容原 MySQL 接口
 */

const path = require('path');
const fs = require('fs');

let db = null;
let dbPath = null;

/**
 * 获取数据库文件路径
 * 优先使用 Electron 的 userData 目录
 */
function getDbPath() {
    try {
        const { app } = require('electron');
        const userDataPath = app.getPath('userData');
        return path.join(userDataPath, 'oraclex.db');
    } catch {
        // 非 Electron 环境（测试用）
        return path.join(__dirname, 'oraclex.db');
    }
}

/**
 * 建表 SQL（SQLite 语法）
 */
const TABLE_SCHEMAS = [
    // 设置表
    `CREATE TABLE IF NOT EXISTS settings (
    "key" TEXT PRIMARY KEY,
    "value" TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

    // 统计表
    `CREATE TABLE IF NOT EXISTS stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    blocks INTEGER DEFAULT 0,
    mitigated INTEGER DEFAULT 0,
    analyses INTEGER DEFAULT 0,
    app_name TEXT DEFAULT '',
    UNIQUE (date, app_name)
  )`,

    // 决策日志表
    `CREATE TABLE IF NOT EXISTS decision_logs (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    type TEXT,
    app_name TEXT,
    action TEXT,
    detail TEXT
  )`,
    `CREATE INDEX IF NOT EXISTS idx_decision_created ON decision_logs(created_at)`,

    // 钱包表
    `CREATE TABLE IF NOT EXISTS wallets (
    address TEXT PRIMARY KEY,
    chain TEXT NOT NULL DEFAULT 'ethereum',
    label TEXT DEFAULT '',
    balance REAL DEFAULT 0,
    balance_symbol TEXT DEFAULT '',
    tx_count INTEGER DEFAULT 0,
    added_at TEXT,
    last_updated TEXT
  )`,

    // 交易记录表
    `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT CHECK(source IN ('import','chain')) NOT NULL DEFAULT 'import',
    import_batch TEXT DEFAULT NULL,
    wallet_address TEXT DEFAULT NULL,
    hash TEXT DEFAULT '',
    timestamp TEXT,
    symbol TEXT DEFAULT '',
    side TEXT DEFAULT '',
    price REAL DEFAULT 0,
    qty REAL DEFAULT 0,
    total REAL DEFAULT 0,
    fee REAL DEFAULT 0,
    exchange TEXT DEFAULT '',
    chain TEXT DEFAULT '',
    is_buy INTEGER DEFAULT 0,
    is_incoming INTEGER DEFAULT NULL,
    "value" REAL DEFAULT 0,
    gas REAL DEFAULT 0,
    method TEXT DEFAULT '',
    raw_data TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`,
    `CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_address)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_batch ON transactions(import_batch)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transactions(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_tx_symbol ON transactions(symbol)`,
];

/**
 * MySQL 兼容包装器
 * 让调用方 db.execute(sql, params) 保持不变
 */
function createCompatWrapper(sqliteDb) {
    return {
        /**
         * 兼容 MySQL 的 pool.execute(sql, params) → [rows, fields]
         * SELECT → 返回 [rows, []]
         * INSERT/UPDATE/DELETE → 返回 [{ affectedRows, insertId }, []]
         */
        execute(sql, params = []) {
            // 将 MySQL 的 ? 占位符保持（SQLite 也使用 ?）
            const trimmed = sql.trim().toUpperCase();
            const isSelect = trimmed.startsWith('SELECT');

            try {
                if (isSelect) {
                    const stmt = sqliteDb.prepare(sql);
                    const rows = stmt.all(...params);
                    return Promise.resolve([rows, []]);
                } else {
                    const stmt = sqliteDb.prepare(sql);
                    const info = stmt.run(...params);
                    return Promise.resolve([{
                        affectedRows: info.changes,
                        insertId: info.lastInsertRowid,
                    }, []]);
                }
            } catch (err) {
                return Promise.reject(err);
            }
        },

        // 兼容 pool.getConnection()
        getConnection() {
            return Promise.resolve({
                release() { },
            });
        },

        // 直接访问底层 SQLite db
        _sqlite: sqliteDb,
    };
}

/**
 * 初始化数据库
 */
async function init() {
    const Database = require('better-sqlite3');

    dbPath = getDbPath();

    // 确保目录存在
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);

    // 性能优化
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // 建表
    for (const sql of TABLE_SCHEMAS) {
        db.exec(sql);
    }

    console.log('[Database] SQLite ready:', dbPath);

    return createCompatWrapper(db);
}

/**
 * 获取包装后的数据库对象
 */
function getPool() {
    if (!db) throw new Error('[Database] Not initialized. Call init() first.');
    return createCompatWrapper(db);
}

/**
 * 关闭数据库
 */
async function close() {
    if (db) {
        db.close();
        db = null;
        console.log('[Database] Connection closed');
    }
}

module.exports = { init, getPool, close };
