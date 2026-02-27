# Oracle-X API Reference

## Market Data

### GET /api/market
聚合市场数据（ticker + 技术指标 + 情绪）

```bash
curl "http://localhost:3000/api/market?symbol=BTCUSDT"
```

**响应字段**：`ticker`、`indicators`、`sentiment`

---

### GET /api/klines
Binance K 线代理

```bash
curl "http://localhost:3000/api/klines?symbol=BTCUSDT&interval=1h&limit=100"
```

---

### GET /api/ticker
Binance 24h Ticker 代理

```bash
curl "http://localhost:3000/api/ticker?symbol=BTCUSDT"
```

---

## Analysis

### POST /api/analyze
AI 流式分析（SSE）

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","direction":"LONG","marketData":{"price":"50000","change24h":"2.5"}}'
```

**响应**：`text/event-stream`（SSE 流式返回 AI 分析文本）

---

### POST /api/recognize
截图视觉识别

```bash
curl -X POST http://localhost:3000/api/recognize \
  -H "Content-Type: application/json" \
  -d '{"image":"<base64>"}'
```

**响应字段**：`platform`、`symbol`、`tradeType`、`directionHint`

---

### POST /api/data/refine
多源数据聚合（K线 + 指标 + 情绪 + NoFOMO）

```bash
curl -X POST http://localhost:3000/api/data/refine \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","fearGreedIndex":50}'
```

**响应字段**：`ticker`、`indicators`、`klineSummary`、`sentiment`、`noFomo`

---

## Decision

### POST /api/decision
NoFOMO 冲动交易评估

```bash
curl -X POST http://localhost:3000/api/decision \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","direction":"LONG","marketData":{"price":"50000","change24h":"2.5"}}'
```

**响应字段**：`decision.action`（ALLOW/WARN/BLOCK）、`impulseScore`、`reasons`

---

### GET /api/decision-log
决策日志查询

```bash
curl "http://localhost:3000/api/decision-log?limit=50"
```

**响应字段**：`count`、`items[]`

---

## Trade History

### POST /api/trade/history
交易历史 CSV 分析

```bash
curl -X POST http://localhost:3000/api/trade/history \
  -H "Content-Type: application/json" \
  -d '{"csv":"symbol,side,price,quantity\nBTCUSDT,BUY,50000,0.1\nETHUSDT,SELL,3000,1"}'
```

**响应字段**：`stats`、`topSymbols`、`style`、`concentration`

---

## Sentiment

### GET /api/twitter
Twitter 情绪分析

```bash
curl "http://localhost:3000/api/twitter?symbol=BTCUSDT"
```

**响应字段**：`overallSentiment`、`confidencePercent`、`tweets[]`

---

## Status

### GET /api/health
健康检查

```bash
curl "http://localhost:3000/api/health"
```

**响应字段**：`status`（healthy/degraded）、`checks`

---

### GET /api/config-status
运行时配置状态

```bash
curl "http://localhost:3000/api/config-status"
```

**响应字段**：`aiApiKeyConfigured`、`aiBaseUrlConfigured`、`aiModelConfigured`、`rapidApiConfigured`

---

## Environment Variables

```bash
STEP_API_KEY=your_api_key        # AI API Key（必填）
AI_BASE_URL=https://...          # AI 网关地址
AI_MODEL=model_name              # 模型名称
AI_TEMPERATURE=0.3               # 温度参数
AI_MAX_TOKENS=1000               # 最大令牌数
AI_VISION_MODEL=vision_model     # 视觉模型
HTTP_PROXY=                      # HTTP 代理（可选）
RAPIDAPI_KEY=                    # Twitter API（可选）
```
