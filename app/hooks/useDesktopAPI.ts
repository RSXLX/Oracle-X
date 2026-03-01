'use client';

import { useState, useEffect, useCallback } from 'react';

const DESKTOP_BASE = 'http://127.0.0.1:17891';

interface DesktopStats {
    totalInterceptions: number;
    blocked: number;
    proceeded: number;
}

interface DecisionLog {
    id: string;
    created_at: string;
    type: string;
    app_name: string;
    action: string;
    detail: string;
}

/**
 * 接入 Desktop 本地 HTTP 服务的 Hook
 * 自动检测 Desktop 连接状态，提供拦截统计和决策日志
 */
export function useDesktopAPI() {
    const [connected, setConnected] = useState(false);
    const [stats, setStats] = useState<DesktopStats | null>(null);
    const [logs, setLogs] = useState<DecisionLog[]>([]);
    const [loading, setLoading] = useState(true);

    // 检测 Desktop 连接
    const checkConnection = useCallback(async () => {
        try {
            const res = await fetch(`${DESKTOP_BASE}/api/ping`, { signal: AbortSignal.timeout(2000) });
            const data = await res.json();
            setConnected(data.ok === true);
            return data.ok === true;
        } catch {
            setConnected(false);
            return false;
        }
    }, []);

    // 获取统计概览
    const fetchStats = useCallback(async () => {
        try {
            const res = await fetch(`${DESKTOP_BASE}/api/stats`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (data.ok) setStats(data);
        } catch { /* Desktop 不可用时静默失败 */ }
    }, []);

    // 获取决策日志
    const fetchLogs = useCallback(async (limit = 20) => {
        try {
            const res = await fetch(`${DESKTOP_BASE}/api/decision-logs?limit=${limit}`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (data.ok) setLogs(data.items || []);
        } catch { /* Desktop 不可用时静默失败 */ }
    }, []);

    // 初始化：检测连接 → 拉取数据
    useEffect(() => {
        (async () => {
            setLoading(true);
            const ok = await checkConnection();
            if (ok) {
                await Promise.all([fetchStats(), fetchLogs()]);
            }
            setLoading(false);
        })();

        // 每 30 秒刷新一次
        const interval = setInterval(async () => {
            const ok = await checkConnection();
            if (ok) {
                await Promise.all([fetchStats(), fetchLogs()]);
            }
        }, 30000);

        return () => clearInterval(interval);
    }, [checkConnection, fetchStats, fetchLogs]);

    return { connected, stats, logs, loading, refresh: () => Promise.all([fetchStats(), fetchLogs()]) };
}
