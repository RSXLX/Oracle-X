/**
 * Oracle-X Desktop - MySQL Database Manager
 * 统一数据库连接管理 + 表初始化
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

let pool = null;

/**
 * 读取 .env.local 配置
 */
function loadEnvConfig() {
    const envPath = path.join(__dirname, '.env.local');
    const config = {};
    try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                config[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
            }
        }
    } catch (e) {
        console.warn('[Database] .env.local not found, using defaults');
    }
    return config;
}

/**
 * 建表 SQL
 */
const TABLE_SCHEMAS = [
    // 设置表
    `CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(128) PRIMARY KEY,
    \`value\` TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,

    // 统计表
    `CREATE TABLE IF NOT EXISTS stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    blocks INT DEFAULT 0,
    mitigated INT DEFAULT 0,
    analyses INT DEFAULT 0,
    app_name VARCHAR(128) DEFAULT '',
    UNIQUE KEY idx_date_app (date, app_name)
  )`,

    // 决策日志表
    `CREATE TABLE IF NOT EXISTS decision_logs (
    id VARCHAR(32) PRIMARY KEY,
    created_at DATETIME NOT NULL,
    type VARCHAR(64),
    app_name VARCHAR(128),
    action VARCHAR(64),
    detail TEXT,
    INDEX idx_created (created_at)
  )`,

    // 钱包表
    `CREATE TABLE IF NOT EXISTS wallets (
    address VARCHAR(128) PRIMARY KEY,
    chain VARCHAR(32) NOT NULL DEFAULT 'ethereum',
    label VARCHAR(128) DEFAULT '',
    balance DOUBLE DEFAULT 0,
    balance_symbol VARCHAR(16) DEFAULT '',
    tx_count INT DEFAULT 0,
    added_at DATETIME,
    last_updated DATETIME
  )`,

    // 交易记录表（多市场支持）
    `CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source ENUM('import','chain') NOT NULL DEFAULT 'import',
    import_batch VARCHAR(64) DEFAULT NULL,
    wallet_address VARCHAR(128) DEFAULT NULL,
    hash VARCHAR(128) DEFAULT '',
    timestamp DATETIME,
    symbol VARCHAR(64) DEFAULT '',
    ticker VARCHAR(32) DEFAULT '',
    market_type ENUM('crypto','a_share','us_stock','hk_stock','forex','futures','other') DEFAULT 'crypto',
    currency VARCHAR(16) DEFAULT '',
    side VARCHAR(16) DEFAULT '',
    price DOUBLE DEFAULT 0,
    qty DOUBLE DEFAULT 0,
    total DOUBLE DEFAULT 0,
    fee DOUBLE DEFAULT 0,
    exchange VARCHAR(64) DEFAULT '',
    chain VARCHAR(32) DEFAULT '',
    is_buy BOOLEAN DEFAULT FALSE,
    is_incoming BOOLEAN DEFAULT NULL,
    \`value\` DOUBLE DEFAULT 0,
    gas DOUBLE DEFAULT 0,
    method VARCHAR(128) DEFAULT '',
    raw_data JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wallet (wallet_address),
    INDEX idx_batch (import_batch),
    INDEX idx_timestamp (timestamp),
    INDEX idx_symbol (symbol),
    INDEX idx_market_type (market_type)
  )`,

    // 迁移：为已有表添加新字段（拆成独立语句，兼容 MySQL 8.0）
    `ALTER TABLE transactions ADD COLUMN ticker VARCHAR(32) DEFAULT '' AFTER symbol`,
    `ALTER TABLE transactions ADD COLUMN market_type ENUM('crypto','a_share','us_stock','hk_stock','forex','futures','other') DEFAULT 'crypto' AFTER ticker`,
    `ALTER TABLE transactions ADD COLUMN currency VARCHAR(16) DEFAULT '' AFTER market_type`,
];

/**
 * 初始化数据库连接池并建表
 */
async function init() {
    const env = loadEnvConfig();

    pool = mysql.createPool({
        host: env.MYSQL_HOST || '127.0.0.1',
        port: parseInt(env.MYSQL_PORT) || 3306,
        user: env.MYSQL_USER || 'root',
        password: env.MYSQL_PASSWORD || '',
        database: env.MYSQL_DATABASE || 'oraclex',
        waitForConnections: true,
        connectionLimit: 5,
        charset: 'utf8mb4',
    });

    // 测试连接
    const conn = await pool.getConnection();
    console.log('[Database] Connected to MySQL');
    conn.release();

    // 建表
    for (const sql of TABLE_SCHEMAS) {
        try {
            await pool.execute(sql);
        } catch (err) {
            // ALTER TABLE ADD COLUMN IF NOT EXISTS 在部分 MySQL 版本不支持，忽略重复列错误
            if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
                console.log('[Database] Column already exists, skipping:', err.message);
            } else {
                throw err;
            }
        }
    }
    console.log('[Database] Tables initialized');

    return pool;
}

/**
 * 获取连接池
 */
function getPool() {
    if (!pool) throw new Error('[Database] Not initialized. Call init() first.');
    return pool;
}

/**
 * 关闭连接池
 */
async function close() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[Database] Connection closed');
    }
}

module.exports = { init, getPool, close };
