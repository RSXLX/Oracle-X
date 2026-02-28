/**
 * Oracle-X Desktop - Local HTTP Service
 * 为 Extension 和 WebApp 提供本地配置同步与数据互通接口
 * 默认端口: 17891
 */

const http = require('http');

const LOCAL_SERVER_PORT = 17891;
let serverInstance = null;

/**
 * 启动本地 HTTP 服务
 * @param {object} settingsRef  - 引用 main.js 的 settings 对象
 * @param {object} marketData   - MarketDataService 实例
 * @param {object} decisionLogger - DecisionLogger 实例
 */
function startLocalServer(settingsRef, marketData, decisionLogger) {
    if (serverInstance) return;

    serverInstance = http.createServer(async (req, res) => {
        // CORS：允许 Extension 跨域访问
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        // 预检请求
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url, `http://localhost:${LOCAL_SERVER_PORT}`);
        const pathname = url.pathname;

        try {
            // ── GET /api/ping ──────────────────────────────────────────────
            if (req.method === 'GET' && pathname === '/api/ping') {
                res.writeHead(200);
                res.end(JSON.stringify({ ok: true, version: '2.1' }));
                return;
            }

            // ── GET /api/settings ──────────────────────────────────────────
            // 返回 Extension 需要的配置字段（不暴露无关字段）
            if (req.method === 'GET' && pathname === '/api/settings') {
                const s = settingsRef.current;
                res.writeHead(200);
                res.end(JSON.stringify({
                    aiBaseUrl: s.apiBaseUrl || '',
                    aiApiKey: s.apiKey || '',
                    aiModel: s.aiModel || '',
                    // 视觉模型：Desktop 暂无单独配置，复用 aiModel or 留空由 Extension 自填
                    aiVisionModel: s.aiVisionModel || '',
                    proxyUrl: s.proxyUrl || '',
                }));
                return;
            }

            // ── GET /api/ticker?symbol= ─────────────────────────────────────
            if (req.method === 'GET' && pathname === '/api/ticker') {
                const symbol = url.searchParams.get('symbol');
                if (!symbol) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'symbol required' }));
                    return;
                }
                try {
                    const data = await marketData.getSymbolInfo(symbol);
                    res.writeHead(200);
                    res.end(JSON.stringify(data));
                } catch (err) {
                    res.writeHead(502);
                    res.end(JSON.stringify({ error: err.message }));
                }
                return;
            }

            // ── POST /api/log-intercept ─────────────────────────────────────
            // Extension 将拦截决策日志写入 Desktop SQLite
            if (req.method === 'POST' && pathname === '/api/log-intercept') {
                const body = await readBody(req);
                let data;
                try {
                    data = JSON.parse(body);
                } catch {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'invalid json' }));
                    return;
                }

                if (decisionLogger) {
                    try {
                        await decisionLogger.add({
                            type: data.type || 'intercept_from_extension',
                            appName: data.appName || 'Chrome Extension',
                            action: data.action || 'unknown',
                            detail: typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || {}),
                        });
                    } catch (logErr) {
                        console.warn('[LocalServer] DecisionLogger error:', logErr.message);
                    }
                }

                res.writeHead(200);
                res.end(JSON.stringify({ ok: true }));
                return;
            }

            // ── POST /api/analyze ──────────────────────────────────────────
            // AI 风控分析代理（SSE 流式输出）
            if (req.method === 'POST' && pathname === '/api/analyze') {
                const body = await readBody(req);
                let data;
                try {
                    data = JSON.parse(body);
                } catch {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'invalid json' }));
                    return;
                }

                const { symbol, direction, marketData: md } = data;
                if (!symbol || !direction) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'symbol and direction required' }));
                    return;
                }

                const s = settingsRef.current;
                const aiBaseUrl = (s.apiBaseUrl || '').replace(/\/$/, '');
                const aiApiKey = s.apiKey || '';
                const aiModel = s.aiModel || '';

                if (!aiApiKey) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'AI API Key not configured in Desktop' }));
                    return;
                }

                // 构造统一 Prompt
                const dirLabel = direction === 'LONG' ? '做多' : '做空';
                let prompt = `请作为一名资深的加密货币交易员，对 ${symbol} 的 ${dirLabel} 交易进行风险评估。\n\n`;
                prompt += `【当前基础行情】\n价格: $${md?.price || '0'}\n24h涨跌: ${md?.change24h || '0'}%\n24h高/低: $${md?.high24h || '0'} / $${md?.low24h || '0'}\n24h成交量: ${md?.volume || '0'}\n\n`;
                prompt += `请综合上述数据，给出：\n1. 核心观点（看多/看空/震荡）\n2. 风险提示\n3. 最终操作建议（包含 🟢建议执行 或 🟡建议观望 或 🔴高风险）及简短理由。保持专业和简练。`;

                const systemPrompt = '你是一个冷静、客观、极度注重风险控制的顶级交易系统AI。你精通技术分析，总是试图寻找交易的潜在漏洞和高危信号。请直接输出分析内容，不要出现客套话。';

                try {
                    const aiRes = await fetch(`${aiBaseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${aiApiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: aiModel,
                            messages: [
                                { role: 'system', content: systemPrompt },
                                { role: 'user', content: prompt },
                            ],
                            temperature: 0.3,
                            max_tokens: 1000,
                            stream: true,
                        }),
                    });

                    if (!aiRes.ok) {
                        const errText = await aiRes.text();
                        res.writeHead(502);
                        res.end(JSON.stringify({ error: `AI upstream error: ${aiRes.status}`, detail: errText }));
                        return;
                    }

                    // SSE 流式透传
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    });

                    const reader = aiRes.body.getReader();
                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        res.write(chunk);
                    }

                    res.end();
                } catch (aiErr) {
                    console.error('[LocalServer] AI analyze error:', aiErr.message);
                    // 如果还没写入 header，返回 JSON 错误
                    if (!res.headersSent) {
                        res.writeHead(502);
                        res.end(JSON.stringify({ error: aiErr.message }));
                    } else {
                        res.end();
                    }
                }
                return;
            }

            // ── POST /api/recognize ────────────────────────────────────────
            // 视觉识别代理（截图 → 交易信息）
            if (req.method === 'POST' && pathname === '/api/recognize') {
                const body = await readBody(req);
                let data;
                try {
                    data = JSON.parse(body);
                } catch {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'invalid json' }));
                    return;
                }

                const screenshot = data.screenshot;
                if (!screenshot) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'screenshot required' }));
                    return;
                }

                const s = settingsRef.current;
                const aiBaseUrl = (s.apiBaseUrl || '').replace(/\/$/, '');
                const aiApiKey = s.apiKey || '';
                const visionModel = s.aiVisionModel || s.aiModel || '';

                if (!aiApiKey) {
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: 'AI API Key not configured in Desktop' }));
                    return;
                }

                const base64Data = screenshot.startsWith('data:') ? screenshot : `data:image/png;base64,${screenshot}`;

                const recognizePrompt = `你是一个专业的交易界面识别专家。请分析这张交易平台截图，提取以下信息：

1. **平台** (platform): 识别交易平台名称，如 Binance、OKX、Bybit、Coinbase、Uniswap 等
2. **交易对** (pair): 识别正在查看的交易对，如 BTC/USDT、ETH/USDT 等
3. **交易类型** (trade_type): 判断是现货(spot)、永续合约(perpetual)还是交割合约(futures)
4. **方向提示** (direction_hint): 如果界面上有明显的做多/做空按钮被选中或价格走势暗示，给出方向提示

请严格按以下 JSON 格式输出（不要添加任何其他文字）：
{
  "platform": "平台名称",
  "pair": "交易对（格式：BASE/QUOTE）",
  "trade_type": "spot|perpetual|futures",
  "direction_hint": "long|short|null",
  "confidence": 0-100之间的置信度
}

如果无法识别某个字段，使用 null。`;

                try {
                    const aiRes = await fetch(`${aiBaseUrl}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${aiApiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: visionModel,
                            messages: [{
                                role: 'user',
                                content: [
                                    { type: 'image_url', image_url: { url: base64Data } },
                                    { type: 'text', text: recognizePrompt },
                                ],
                            }],
                            temperature: 0.2,
                            max_tokens: 500,
                            stream: false,
                        }),
                    });

                    if (!aiRes.ok) {
                        const errText = await aiRes.text();
                        res.writeHead(502);
                        res.end(JSON.stringify({ error: `Vision AI error: ${aiRes.status}`, detail: errText }));
                        return;
                    }

                    const aiData = await aiRes.json();
                    const content = aiData.choices?.[0]?.message?.content || '';

                    let result;
                    try {
                        const jsonMatch = content.match(/\{[\s\S]*\}/);
                        result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
                    } catch {
                        result = null;
                    }

                    res.writeHead(200);
                    res.end(JSON.stringify(result || { platform: null, pair: null, trade_type: null, direction_hint: null, confidence: 0 }));
                } catch (aiErr) {
                    console.error('[LocalServer] Vision recognize error:', aiErr.message);
                    res.writeHead(502);
                    res.end(JSON.stringify({ error: aiErr.message }));
                }
                return;
            }

            // ── 404 ────────────────────────────────────────────────────────
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'not found' }));

        } catch (err) {
            console.error('[LocalServer] Error:', err.message);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'internal server error' }));
        }
    });

    serverInstance.listen(LOCAL_SERVER_PORT, '127.0.0.1', () => {
        console.log(`[Oracle-X] Local service started on http://127.0.0.1:${LOCAL_SERVER_PORT}`);
    });

    serverInstance.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.warn(`[LocalServer] Port ${LOCAL_SERVER_PORT} already in use, skipping.`);
        } else {
            console.error('[LocalServer] Error:', err.message);
        }
    });
}

function stopLocalServer() {
    if (serverInstance) {
        serverInstance.close();
        serverInstance = null;
        console.log('[LocalServer] Stopped.');
    }
}

/**
 * 读取 HTTP 请求 body
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

module.exports = { startLocalServer, stopLocalServer, LOCAL_SERVER_PORT };
