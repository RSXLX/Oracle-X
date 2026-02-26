'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from './page.module.css';

type DecisionAction = 'ALLOW' | 'WARN' | 'BLOCK';

interface DecisionLogItem {
  requestId: string;
  symbol: string;
  direction: string;
  decision: {
    action: DecisionAction;
    impulseScore: number;
    confidence: number;
    coolingSeconds: number;
    reasons: string[];
  };
  marketData: {
    price: string;
    change24h: string;
    fearGreedIndex: number | null;
  };
  createdAt: string;
}

interface DecisionLogResponse {
  count: number;
  items: DecisionLogItem[];
}

const ACTION_CLASS: Record<DecisionAction, string> = {
  ALLOW: 'allow',
  WARN: 'warn',
  BLOCK: 'block',
};

export default function DecisionLogPage() {
  const [items, setItems] = useState<DecisionLogItem[]>([]);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (nextLimit = limit) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/decision-log?limit=${nextLimit}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as DecisionLogResponse;
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchLogs(limit);
  }, [limit, fetchLogs]);

  const stats = useMemo(() => {
    const total = items.length;
    const allow = items.filter((x) => x.decision.action === 'ALLOW').length;
    const warn = items.filter((x) => x.decision.action === 'WARN').length;
    const block = items.filter((x) => x.decision.action === 'BLOCK').length;
    return { total, allow, warn, block };
  }, [items]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Decision Log</h1>
          <p>Oracle-X NoFOMO 决策审计记录</p>
        </div>
        <div className={styles.actions}>
          <Link href="/" className={styles.linkBtn}>← 返回主界面</Link>
          <button onClick={() => void fetchLogs(limit)} disabled={loading} className={styles.btn}>
            {loading ? '刷新中...' : '刷新'}
          </button>
        </div>
      </header>

      <section className={styles.kpis}>
        <div className={styles.kpi}><span>Total</span><strong>{stats.total}</strong></div>
        <div className={styles.kpi}><span>ALLOW</span><strong>{stats.allow}</strong></div>
        <div className={styles.kpi}><span>WARN</span><strong>{stats.warn}</strong></div>
        <div className={styles.kpi}><span>BLOCK</span><strong>{stats.block}</strong></div>
        <label className={styles.limitCtl}>
          最近
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
          条
        </label>
      </section>

      {error && <div className={styles.error}>加载失败：{error}</div>}

      <section className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>时间</th>
              <th>交易对</th>
              <th>方向</th>
              <th>动作</th>
              <th>Impulse</th>
              <th>置信度</th>
              <th>冷静(s)</th>
              <th>24h%</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>{loading ? '加载中...' : '暂无决策记录'}</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={`${item.requestId}-${item.createdAt}`}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td>{item.symbol}</td>
                  <td>{item.direction}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[ACTION_CLASS[item.decision.action]]}`}>
                      {item.decision.action}
                    </span>
                  </td>
                  <td>{item.decision.impulseScore}</td>
                  <td>{item.decision.confidence}</td>
                  <td>{item.decision.coolingSeconds}</td>
                  <td>{item.marketData.change24h}</td>
                  <td className={styles.reasons}>{(item.decision.reasons || []).slice(0, 2).join('；') || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
