#!/usr/bin/env node
/*
 * NoFOMO decision simulation script
 * Usage: node scripts/simulate-nofomo.js
 */

const scenarios = [
  {
    name: 'Calm market / normal sentiment',
    body: {
      symbol: 'BTCUSDT',
      direction: 'LONG',
      marketData: {
        price: '68000',
        change24h: '1.4',
        volume: '100000',
        high24h: '68900',
        low24h: '66400',
        fearGreedIndex: 51,
        fearGreedLabel: 'Neutral',
        klines: null,
      },
    },
  },
  {
    name: 'Volatile market / greed high',
    body: {
      symbol: 'ETHUSDT',
      direction: 'LONG',
      marketData: {
        price: '4100',
        change24h: '8.5',
        volume: '230000',
        high24h: '4300',
        low24h: '3920',
        fearGreedIndex: 83,
        fearGreedLabel: 'Extreme Greed',
        klines: null,
      },
    },
  },
  {
    name: 'Panic market / fast drawdown',
    body: {
      symbol: 'SOLUSDT',
      direction: 'SHORT',
      marketData: {
        price: '120',
        change24h: '-11.2',
        volume: '340000',
        high24h: '141',
        low24h: '116',
        fearGreedIndex: 16,
        fearGreedLabel: 'Extreme Fear',
        klines: null,
      },
    },
  },
];

async function run() {
  const base = process.env.BASE_URL || 'http://localhost:3000';

  console.log(`Using API: ${base}`);
  for (const s of scenarios) {
    const res = await fetch(`${base}/api/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s.body),
    });

    const json = await res.json();
    console.log(`\n=== ${s.name} ===`);
    console.log(`status: ${res.status}`);
    console.log(JSON.stringify(json, null, 2));
  }

  const ticker = await fetch(`${base}/api/ticker?symbol=BTCUSDT`);
  console.log('\n=== Real ticker smoke test (BTCUSDT) ===');
  console.log('status:', ticker.status);
  const tj = await ticker.json();
  console.log('lastPrice:', tj.lastPrice, 'change24h:', tj.priceChangePercent);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
