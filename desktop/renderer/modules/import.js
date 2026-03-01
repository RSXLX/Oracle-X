/**
 * Oracle-X Desktop — CSV/XLSX 导入 + AI 买卖点分析 + 导出报告
 */

// ==================== 文件导入（CSV / XLSX）====================
async function importFile() {
    const statusEl = document.getElementById('csvStatus');
    statusEl.innerHTML = `<div class="loading">${t('common.importing')}</div>`;

    try {
        const result = await window.oracleDesktop.importFile();

        if (result.error) {
            statusEl.innerHTML = `<span class="error">${result.error}</span>`;
            return;
        }

        statusEl.innerHTML = `<span class="success">${t('csv.importedCount', { count: result.count, format: result.format })}</span>`;
        currentTransactions = result.transactions;

        // 启用 AI 分析按钮
        const aiBtn = document.getElementById('aiAnalyzeBtn');
        if (aiBtn) aiBtn.disabled = false;

        // 显示分析
        if (result.analysis && !result.analysis.error) {
            renderCSVAnalysis(result.analysis);
        }

        // 显示交易明细
        renderCSVTransactions(result.transactions);
    } catch (err) {
        statusEl.innerHTML = `<span class="error">${err.message}</span>`;
    }

    // 刷新历史导入列表
    await loadImportHistory();
}

function renderCSVAnalysis(a) {
    const stats = a.stats || {};
    const pnl = a.pnl;
    const el = document.getElementById('csvAnalysis');

    // 基础统计卡片
    let html = `
    <div class="stats-grid">
      <div class="stat"><span class="stat-label">${t('csv.totalTrades')}</span><span class="stat-value">${stats.totalTrades || 0}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.tradeStyle')}</span><span class="stat-value">${a.style || '?'}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.riskLevel')}</span><span class="stat-value">${a.riskLevel || 'low'}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.symbols')}</span><span class="stat-value">${stats.uniqueSymbols || 0}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.totalVolume')}</span><span class="stat-value">${(stats.totalVolume || 0).toFixed(0)}</span></div>
      <div class="stat"><span class="stat-label">${t('csv.totalFees')}</span><span class="stat-value">${(stats.totalFees || 0).toFixed(2)}</span></div>
    </div>
  `;

    // 盈亏分析卡片
    if (pnl?.hasPairs) {
        const pnlColor = pnl.netPnl >= 0 ? '#3fb950' : '#f85149';
        const pnlSign = pnl.netPnl >= 0 ? '+' : '';
        html += `
      <h3 style="margin-top:16px;">${t('csv.pnlTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.realizedPnl')}</span><span class="stat-value" style="color:${pnlColor}">${pnlSign}${pnl.totalPnl.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.netPnl')}</span><span class="stat-value" style="color:${pnlColor}">${pnlSign}${pnl.netPnl.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.pnlPct')}</span><span class="stat-value" style="color:${pnlColor}">${pnl.pnlPct.toFixed(2)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.pairsCount')}</span><span class="stat-value">${pnl.pairsCount}</span></div>
      </div>

      <h3 style="margin-top:12px;">${t('csv.winRateTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.winRate')}</span><span class="stat-value">${pnl.winRate.toFixed(1)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.winLoss')}</span><span class="stat-value">${pnl.wins}/${pnl.losses}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.avgWin')}</span><span class="stat-value" style="color:#3fb950">${pnl.avgWin.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.avgLoss')}</span><span class="stat-value" style="color:#f85149">${pnl.avgLoss.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.profitFactor')}</span><span class="stat-value">${pnl.profitFactor === Infinity ? '∞' : pnl.profitFactor.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.winLossStreak')}</span><span class="stat-value">${pnl.streaks.maxWinStreak}/${pnl.streaks.maxLossStreak}</span></div>
      </div>

      <h3 style="margin-top:12px;">${t('csv.holdTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.avgHold')}</span><span class="stat-value">${formatHoldTime(pnl.holdPeriod.avgHours)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.medianHold')}</span><span class="stat-value">${formatHoldTime(pnl.holdPeriod.medianHours)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.intraday')}</span><span class="stat-value">${pnl.holdPeriod.buckets.intraday}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.shortTerm')}</span><span class="stat-value">${pnl.holdPeriod.buckets.short}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.mediumTerm')}</span><span class="stat-value">${pnl.holdPeriod.buckets.medium}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.longTerm')}</span><span class="stat-value">${pnl.holdPeriod.buckets.long}</span></div>
      </div>

      <h3 style="margin-top:12px;">${t('csv.positionTitle')}</h3>
      <div class="stats-grid">
        <div class="stat"><span class="stat-label">${t('csv.maxTradeRatio')}</span><span class="stat-value">${pnl.positionSizing.maxTradeRatio.toFixed(1)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.maxSymbolRatio')}</span><span class="stat-value">${pnl.positionSizing.maxSymbolRatio.toFixed(1)}%</span></div>
        <div class="stat"><span class="stat-label">${t('csv.avgTradeSize')}</span><span class="stat-value">${pnl.positionSizing.avgTradeSize.toFixed(2)}</span></div>
        <div class="stat"><span class="stat-label">${t('csv.feeRatio')}</span><span class="stat-value">${pnl.costEfficiency.feeToVolumeRatio.toFixed(3)}%</span></div>
      </div>
    `;
    } else if (pnl && !pnl.hasPairs) {
        html += `<div class="insight-info" style="margin-top:12px;">${t('csv.pnlMessage', { message: pnl.message })}</div>`;
    }

    // Top 交易品种
    if (a.topSymbols?.length) {
        html += `
      <h3 style="margin-top:12px;">${t('csv.topSymbols')}</h3>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        ${a.topSymbols.slice(0, 5).map(s => `<span class="ai-pattern">${s.symbol} (${s.trades} ${t('csv.trades')})</span>`).join('')}
      </div>
    `;
    }

    // 洞察
    if (a.insights?.length) {
        html += `
      <div class="insights" style="margin-top:12px;">
        ${a.insights.map(i => `<div class="insight-${i.type}">${i.text}</div>`).join('')}
      </div>
    `;
    }

    el.innerHTML = html;
    window.currentAnalysis = a;
}

// 存储 CSV 交易数据用于分页
let csvTxData = [];

function renderCSVTransactions(txs, page = 1) {
    const tbody = document.getElementById('csvTbody');
    if (!txs?.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="muted">${t('common.noData')}</td></tr>`;
        renderPagination('csvTxPagination', 0, 20, 1, () => { });
        return;
    }

    csvTxData = txs;
    const perPage = 20;
    const start = (page - 1) * perPage;
    const pageData = txs.slice(start, start + perPage);

    const marketLabels = {
        crypto: t('marketLabels.crypto'),
        a_share: t('marketLabels.a_share'),
        us_stock: t('marketLabels.us_stock'),
        hk_stock: t('marketLabels.hk_stock'),
        forex: t('marketLabels.forex'),
        futures: t('marketLabels.futures'),
        other: t('marketLabels.other'),
    };

    tbody.innerHTML = pageData.map(tx => `
    <tr>
      <td>${tx.timestamp ? new Date(tx.timestamp).toLocaleString() : tx.rawTime || '-'}</td>
      <td>${tx.symbol || tx.ticker || '-'}${tx.assetName ? ` <small>${tx.assetName}</small>` : ''}</td>
      <td><span class="badge">${marketLabels[tx.marketType || tx.market_type] || '-'}</span></td>
      <td><span class="badge badge-${tx.isBuy || tx.is_buy ? 'allow' : 'block'}">${tx.isBuy || tx.is_buy ? t('csv.buy') : t('csv.sell')}</span></td>
      <td>${tx.price?.toFixed(2) || '-'}</td>
      <td>${tx.qty?.toFixed(4) || '-'}</td>
      <td>${tx.total?.toFixed(2) || '-'}</td>
      <td>${tx.currency || '-'}</td>
    </tr>
  `).join('');

    renderPagination('csvTxPagination', txs.length, perPage, page, (p) => {
        renderCSVTransactions(csvTxData, p);
    });
}

document.getElementById('importFileBtn')?.addEventListener('click', importFile);

// ==================== AI 分析买卖点 ====================
async function aiAnalyzeTrades() {
    if (!currentTransactions?.length) {
        alert(t('csv.importFirst'));
        return;
    }

    const card = document.getElementById('aiAnalysisCard');
    const resultEl = document.getElementById('aiAnalysisResult');
    card.style.display = 'block';
    resultEl.innerHTML = `<div class="loading">${t('csv.aiAnalyzing')}</div>`;

    // 禁用按钮
    const btn = document.getElementById('aiAnalyzeBtn');
    if (btn) btn.disabled = true;

    try {
        const result = await window.oracleDesktop.aiAnalyzeTrades(currentTransactions);
        renderAIAnalysis(result);
    } catch (err) {
        resultEl.innerHTML = `<p class="error">${t('csv.aiFailed')}: ${err.message}</p>`;
    } finally {
        if (btn) btn.disabled = false;
    }
}

function renderAIAnalysis(data) {
    const el = document.getElementById('aiAnalysisResult');

    if (!data || data.error) {
        el.innerHTML = `<p class="error">${data?.error || t('csv.aiFailed')}</p>`;
        return;
    }

    let html = '<div class="ai-result">';

    if (data.summary) {
        html += `<div class="ai-section"><h4>${t('csv.aiSummary')}</h4><div class="ai-summary">${data.summary}</div></div>`;
    }
    if (data.buyPoints?.length) {
        html += `<div class="ai-section"><h4>${t('csv.aiBuyPoints')}</h4>`;
        data.buyPoints.forEach(p => {
            html += `<div class="ai-point buy">
        <div class="point-time">${p.time || ''} · ${p.symbol || ''} · ¥${p.price || ''}</div>
        <div class="point-detail">${p.analysis || ''}</div>
      </div>`;
        });
        html += '</div>';
    }
    if (data.sellPoints?.length) {
        html += `<div class="ai-section"><h4>${t('csv.aiSellPoints')}</h4>`;
        data.sellPoints.forEach(p => {
            html += `<div class="ai-point sell">
        <div class="point-time">${p.time || ''} · ${p.symbol || ''} · ¥${p.price || ''}</div>
        <div class="point-detail">${p.analysis || ''}</div>
      </div>`;
        });
        html += '</div>';
    }
    if (data.tradingPatterns?.length) {
        html += `<div class="ai-section"><h4>${t('csv.aiPatterns')}</h4><div>${data.tradingPatterns.map(p => `<span class="ai-pattern">${p}</span>`).join('')}</div></div>`;
    }
    if (data.riskAssessment) {
        html += `<div class="ai-section"><h4>${t('csv.aiRisk')}</h4><div class="insight-warning">${data.riskAssessment}</div></div>`;
    }
    if (data.suggestions?.length) {
        html += `<div class="ai-section"><h4>${t('csv.aiSuggestions')}</h4>${data.suggestions.map(s => `<div class="ai-suggestion">${s}</div>`).join('')}</div>`;
    }
    if (data.rawContent) {
        html += `<div class="ai-section"><h4>${t('csv.aiRawContent')}</h4><pre style="white-space:pre-wrap;color:#8b949e;font-size:12px;">${data.rawContent.slice(0, 1000)}</pre></div>`;
    }

    html += '</div>';
    el.innerHTML = html;
}

document.getElementById('aiAnalyzeBtn')?.addEventListener('click', aiAnalyzeTrades);

// ==================== 导出报告 ====================
async function exportReport() {
    const analysis = window.currentAnalysis;
    if (!analysis) {
        alert(t('csv.noExportData'));
        return;
    }

    const report = generateReport(analysis);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'oraclex-report.md';
    a.click();
    URL.revokeObjectURL(url);
}

function generateReport(analysis) {
    const stats = analysis.stats || {};
    const pnl = analysis.pnl;
    const marketLabels = {
        crypto: t('marketLabelsFull.crypto'),
        a_share: t('marketLabelsFull.a_share'),
        us_stock: t('marketLabelsFull.us_stock'),
        hk_stock: t('marketLabelsFull.hk_stock'),
        forex: t('marketLabelsFull.forex'),
        futures: t('marketLabelsFull.futures'),
        other: t('marketLabelsFull.other'),
    };

    let report = `# ${t('report.title')}

${t('report.generated')}: ${new Date().toLocaleString()}

${t('report.style')}: ${analysis.style} | ${t('report.risk')}: ${analysis.riskLevel}

${t('report.tradesCount')}: ${stats.totalTrades} | ${t('report.amount')}: ${stats.totalVolume?.toFixed(2)} | ${t('report.symbolsCount')}: ${stats.uniqueSymbols}
`;

    // 盈亏分析
    if (pnl?.hasPairs) {
        const sign = pnl.netPnl >= 0 ? '+' : '';
        report += `
## ${t('report.pnlTitle')}

- ${t('report.realizedPnl')}: ${sign}${pnl.totalPnl.toFixed(2)}
- ${t('report.netPnl')}: ${sign}${pnl.netPnl.toFixed(2)}
- ${t('report.pnlPct')}: ${pnl.pnlPct.toFixed(2)}%
- ${t('report.pairsCount')}: ${pnl.pairsCount}

## ${t('report.winRateTitle')}

- ${t('report.winRate')}: ${pnl.winRate.toFixed(1)}%
- ${t('report.winLossCount')}: ${pnl.wins}/${pnl.losses}
- ${t('report.avgWin')}: ${pnl.avgWin.toFixed(2)}
- ${t('report.avgLoss')}: ${pnl.avgLoss.toFixed(2)}
- ${t('report.profitFactor')}: ${pnl.profitFactor === Infinity ? '∞' : pnl.profitFactor.toFixed(2)}
- ${t('report.maxWinStreak')}: ${pnl.streaks.maxWinStreak}
- ${t('report.maxLossStreak')}: ${pnl.streaks.maxLossStreak}

## ${t('report.holdTitle')}

- ${t('report.avgHold')}: ${formatHoldTime(pnl.holdPeriod.avgHours)}
- ${t('csv.intraday')}: ${pnl.holdPeriod.buckets.intraday} | ${t('csv.shortTerm')}: ${pnl.holdPeriod.buckets.short} | ${t('csv.mediumTerm')}: ${pnl.holdPeriod.buckets.medium} | ${t('csv.longTerm')}: ${pnl.holdPeriod.buckets.long}

## ${t('report.positionTitle')}

- ${t('report.maxTradeRatio')}: ${pnl.positionSizing.maxTradeRatio.toFixed(1)}%
- ${t('report.maxSymbolRatio')}: ${pnl.positionSizing.maxSymbolRatio.toFixed(1)}%
- ${t('report.feeRatio')}: ${pnl.costEfficiency.feeToVolumeRatio.toFixed(3)}%
`;
    }

    // 市场分布
    if (analysis.marketTypeBreakdown && Object.keys(analysis.marketTypeBreakdown).length > 0) {
        report += `\n## ${t('report.marketDistribution')}\n`;
        for (const [mt, count] of Object.entries(analysis.marketTypeBreakdown)) {
            report += `- ${marketLabels[mt] || mt}: ${count} ${t('csv.trades')}\n`;
        }
    }

    if (analysis.topSymbols?.length) {
        report += `\n## ${t('report.topSymbols')}\n` + analysis.topSymbols.map(s =>
            `- ${s.symbol} [${marketLabels[s.marketType] || ''}]: ${s.trades} ${t('csv.trades')}, ${s.volume?.toFixed(2)}`
        ).join('\n');
    }

    if (analysis.insights?.length) {
        report += `\n\n## ${t('report.insights')}\n` + analysis.insights.map(i => `- [${i.type}] ${i.text}`).join('\n');
    }

    return report;
}

document.getElementById('exportReportBtn')?.addEventListener('click', exportReport);

// ==================== 历史导入 ====================
async function loadImportHistory() {
    try {
        const history = await window.oracleDesktop.getImportHistory();
        const select = document.getElementById('importHistorySelect');
        if (!select) return;

        select.innerHTML = `<option value="">${t('csv.historySelect')}</option>`;
        for (const batch of history) {
            const time = batch.imported_at ? new Date(batch.imported_at).toLocaleString() : t('common.unknown');
            const option = document.createElement('option');
            option.value = batch.import_batch;
            option.textContent = `${batch.exchange || t('common.unknown')} · ${batch.count} ${t('csv.trades')} · ${time}`;
            select.appendChild(option);
        }
    } catch (err) {
        console.error('Load import history error:', err);
    }
}

async function loadHistoryBatch() {
    const select = document.getElementById('importHistorySelect');
    const batchId = select?.value;
    if (!batchId) { alert(t('csv.selectBatch')); return; }

    const infoEl = document.getElementById('importHistoryInfo');
    infoEl.innerHTML = `<div class="loading">${t('common.loading')}</div>`;

    try {
        const txs = await window.oracleDesktop.getTransactionsByBatch(batchId);
        currentTransactions = txs;
        infoEl.innerHTML = `<span class="success">${t('csv.historyLoaded', { count: txs.length })}</span>`;

        // 启用 AI 分析按钮
        const aiBtn = document.getElementById('aiAnalyzeBtn');
        if (aiBtn) aiBtn.disabled = false;

        renderCSVTransactions(txs);
    } catch (err) {
        infoEl.innerHTML = `<span class="error">${t('common.loadFailed')}: ${err.message}</span>`;
    }
}

document.getElementById('loadHistoryBtn')?.addEventListener('click', loadHistoryBatch);
