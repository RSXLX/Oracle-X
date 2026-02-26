# Oracle-X API Reference

## Market Data

### GET /api/market
Get market data for a symbol

```bash
curl "http://localhost:3000/api/market?symbol=BTCUSDT"
```

### POST /api/analyze
Analyze trading decision

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","direction":"LONG","marketData":{...}}'
```

## Decision

### POST /api/decision
Get NoFOMO decision

```bash
curl -X POST http://localhost:3000/api/decision \
  -H "Content-Type: application/json" \
  -d '{"symbol":"BTCUSDT","direction":"LONG","marketData":{}}'
```

## Logs

### GET /api/decision-log
Get decision history

```bash
curl "http://localhost:3000/api/decision-log?limit=50"
```

## Status

### GET /api/config-status
Check backend configuration

```bash
curl "http://localhost:3000/api/config-status"
```

## Data Sources (To be implemented)

### POST /api/market/analyze
Full market + sentiment analysis

### POST /api/trade/history
User trading history analysis

### POST /api/data/refine
Multi-source data aggregation

## Environment Variables

```
STEP_API_KEY=your_step_api_key
AI_BASE_URL=https://api.stepfun.com/v1
AI_MODEL=step-1-8k
RAPIDAPI_KEY=twitter_api_key
```
