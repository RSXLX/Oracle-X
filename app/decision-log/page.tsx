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
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterAction, setFilterAction] = useState('');

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

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterSymbol && !item.symbol.toLowerCase().includes(filterSymbol.toLowerCase())) return false;
      if (filterAction && item.decision.action !== filterAction) return false;
      return true;
    });
  }, [items, filterSymbol, filterAction]);

  const stats = useMemo(() => {
    const total = filteredItems.length;
    const allow = filteredItems.filter((x) => x.decision.action === 'ALLOW').length;
    const warn = filteredItems.filter((x) => x.decision.action === 'WARN').length;
    const block = filteredItems.filter((x) => x.decision.action === 'BLOCK').length;
    const blockRate = total > 0 ? Math.round((block / total) * 100) : 0;
    const riskMitigated = block + warn;
    const mitigationRate = total > 0 ? Math.round((riskMitigated / total) * 100) : 0;
    return { total, allow, warn, block, blockRate, mitigationRate };
  }, [filteredItems]);

  const handleExport = useCallback((format: 'json' | 'csv') => {
    const data = filteredItems;
    let content: string;
    let mime: string;
    let filename: string;
    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      mime = 'application/json';
      filename = `oraclex-decisions-${Date.now()}.json`;
    } else {
      const headers = ['时间', '交易对', '方向', '动作', 'Impulse', '置信度', '冷静(s)', '24h%', '原因'];
      const rows = data.map(item => [
        new Date(item.createdAt).toLocaleString(),
        item.symbol,
        item.direction,
        item.decision.action,
        item.decision.impulseScore,
        item.decision.confidence,
        item.decision.coolingSeconds,
        item.marketData.change24h,
        (item.decision.reasons || []).join('; ')
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
      content = [headers.join(','), ...rows].join('\n');
      mime = 'text/csv';
      filename = `oraclex-decisions-${Date.now()}.csv`;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredItems]);

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

      <section className={styles.filters}>
        <input
          type="text"
          placeholder="搜索交易对..."
          value={filterSymbol}
          onChange={e => setFilterSymbol(e.target.value)}
          className={styles.filterInput}
        />
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className={styles.filterSelect}>
          <option value="">全部动作</option>
          <option value="ALLOW">ALLOW</option>
          <option value="WARN">WARN</option>
          <option value="BLOCK">BLOCK</option>
        </select>
        <button onClick={() => handleExport('json')} className={styles.exportBtn}>导出 JSON</button>
        <button onClick={() => handleExport('csv')} className={styles.exportBtn}>导出 CSV</button>
      </section>

      <section className={styles.kpis}>
        <div className={styles.kpi}><span>Total</span><strong>{stats.total}</strong></div>
        <div className={styles.kpi}><span>ALLOW</span><strong>{stats.allow}</strong></div>
        <div className={styles.kpi}><span>WARN</span><strong>{stats.warn}</strong></div>
        <div className={styles.kpi}><span>BLOCK</span><strong>{stats.block}</strong></div>
        <div className={`${styles.kpi} ${styles.highlight}`}><span>拦截率</span><strong>{stats.blockRate}%</strong></div>
        <div className={`${styles.kpi} ${styles.highlight}`}><span>风险化解</span><strong>{stats.mitigationRate}%</strong></div>
        <label className={styles.limitCtl}>
          最近
          <select value={limit} onChange={e => setLimit(Number(e.target.value))}>
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
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>{loading ? '加载中...' : '暂无决策记录'}</td>
              </tr>
            ) : (
              filteredItems.map((item) => (
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
