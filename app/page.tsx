'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useBinanceKlines } from './hooks/useBinanceKlines';
import { useTechnicalIndicators } from './hooks/useTechnicalIndicators';
import { useDesktopAPI } from './hooks/useDesktopAPI';
import TimeframeSelector from './components/TimeframeSelector';
import IndicatorPanel from './components/IndicatorPanel';
import SentimentPanel from './components/SentimentPanel';
import styles from './page.module.css';

// 动态导入 K 线图（避免 SSR 问题）
const KlineChart = dynamic(() => import('./components/KlineChart'), { ssr: false });

// ============ 常量 ============
const SYMBOLS = ['ETHUSDT', 'BTCUSDT', 'SOLUSDT'] as const;
const SYMBOL_DISPLAY: Record<string, string> = {
  ETHUSDT: 'ETH/USDT',
  BTCUSDT: 'BTC/USDT',
  SOLUSDT: 'SOL/USDT',
};

// 用户画像（硬编码）
const USER_PROFILE = {
  type: 'Swing Trader',
  longWinRate: 62,
  shortWinRate: 41,
  risk: 'Medium',
  txCount: 147,
};

// FGI（硬编码，可以用 API 替换）
const FEAR_GREED = { value: 25, label: '极度恐惧' };

// ============ 主组件 ============
export default function Home() {
  const [symbol, setSymbol] = useState<typeof SYMBOLS[number]>('ETHUSDT');
  const [interval, setInterval] = useState('1h');

  // Hooks
  const { klines, stats, loading, connected, usingMock } = useBinanceKlines(symbol, interval);
  const indicators = useTechnicalIndicators(klines);
  const desktop = useDesktopAPI();

  const isNegative = parseFloat(stats.change24h) < 0;

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/icons/logo.svg" alt="Oracle-X Logo" className={styles.logoIcon} />
          <span className={styles.logoText}>Oracle-X</span>
        </div>
        <div className={styles.headerRight}>
          <select
            className={styles.symbolSelect}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value as typeof SYMBOLS[number])}
          >
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>{SYMBOL_DISPLAY[s]}</option>
            ))}
          </select>
          <div className={styles.priceDisplay}>
            <span className={styles.priceValue}>${stats.price}</span>
            <span className={`${styles.priceChange} ${isNegative ? styles.negative : styles.positive}`}>
              {isNegative ? '▼' : '▲'} {stats.change24h}%
            </span>
          </div>

          <div className={styles.connectionStatusRow}>
            <div className={`${styles.connectionStatus} ${connected ? styles.connected : ''}`}>
              {usingMock ? '⚠️ MOCK DATA' : (connected ? '● LIVE' : '○ OFFLINE')}
            </div>
            <div className={`${styles.connectionStatus} ${desktop.connected ? styles.connected : ''}`}
              title={desktop.connected ? 'Desktop HTTP 服务已连接' : 'Desktop 未连接'}>
              {desktop.connected ? '● Desktop' : '○ Desktop'}
            </div>
            <a className={styles.logLink} href="/decision-log">Decision Log</a>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className={styles.layout}>
        {/* Left: Chart */}
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <TimeframeSelector value={interval} onChange={setInterval} />
          </div>
          <div className={styles.chartContainer}>
            <KlineChart klines={klines} loading={loading} />
          </div>
        </div>

        {/* Right: Panel */}
        <div className={styles.panelSection}>
          {/* Twitter Sentiment */}
          <SentimentPanel symbol={symbol} />

          <IndicatorPanel
            indicators={indicators}
            userProfile={USER_PROFILE}
            fearGreedIndex={FEAR_GREED.value}
            fearGreedLabel={FEAR_GREED.label}
          />

          {/* Info Banner + Desktop Stats */}
          <div className={styles.tradeButtons}>
            {desktop.connected && desktop.stats ? (
              <div style={{ textAlign: 'center', width: '100%' }}>
                <p className={styles.tradeTip} style={{ marginBottom: '8px' }}>
                  🛡️ 拦截 {desktop.stats.totalInterceptions} 次 · 阻止 {desktop.stats.blocked} 次 · 放行 {desktop.stats.proceeded} 次
                </p>
                <p className={styles.tradeTip} style={{ fontSize: '11px', opacity: 0.6 }}>Data from Desktop SQLite · Auto-refresh 30s</p>
              </div>
            ) : (
              <p className={styles.tradeTip}>📊 Data Dashboard · {desktop.connected ? 'Desktop Connected' : 'Start Desktop for real-time stats'}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
