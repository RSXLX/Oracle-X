#!/usr/bin/env node
/*
 * Health check smoke test
 * Usage: node scripts/smoke-health.js
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  console.log(`Checking health: ${BASE}/api/health`);

  const res = await fetch(`${BASE}/api/health`);
  const json = await res.json();

  console.log('Status:', res.status);
  console.log('Result:', JSON.stringify(json, null, 2));

  const healthy = json.status === 'healthy';
  console.log(healthy ? '✅ System healthy' : '⚠️ System degraded');

  process.exit(healthy ? 0 : 1);
}

run().catch((err) => {
  console.error('Health check failed:', err);
  process.exit(1);
});
