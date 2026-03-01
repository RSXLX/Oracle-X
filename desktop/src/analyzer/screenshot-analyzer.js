/**
 * Oracle-X Desktop - Screenshot AI Analyzer
 * 支持 MiniMax (免费中转) + OpenAI + Gemini
 */

const fs = require('fs');
const path = require('path');

// 从 .env.local 读取默认 AI 配置
function loadScreenshotAIConfig() {
  // .env.local 在 desktop/ 根目录，而当前文件在 desktop/src/analyzer/
  const envPath = require('path').join(__dirname, '..', '..', '.env.local');
  const cfg = { apiKey: '', baseUrl: 'https://mydmx.huoyuanqudao.cn/v1', model: 'MiniMax-M2.5-highspeed' };
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq > 0) {
        const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
        if (k === 'AI_API_KEY') cfg.apiKey = v;
        if (k === 'AI_BASE_URL') cfg.baseUrl = v;
        if (k === 'AI_MODEL') cfg.model = v;
      }
    }
  } catch (e) { /* ignore */ }
  return cfg;
}

const _defaultAICfg = loadScreenshotAIConfig();

/**
 * 截图分析器
 */
class ScreenshotAnalyzer {
  constructor(options = {}) {
    this.provider = options.visionProvider || 'minimax';
    this.apiKey = options.apiKey || _defaultAICfg.apiKey;
    this.apiBaseUrl = options.apiBaseUrl || _defaultAICfg.baseUrl;
    this.model = options.model || _defaultAICfg.model;

    this.buttonKeywords = [
      '买入', '卖出', '开多', '开空', '平多', '平空', '做多', '做空',
      'BUY', 'SELL', 'LONG', 'SHORT', 'BUY NOW', 'SELL NOW',
      'MARKET', 'LIMIT', 'CONFIRM', 'PLACE ORDER',
    ];
  }

  configure(config) {
    this.apiKey = config.apiKey || this.apiKey;
    this.apiBaseUrl = config.apiBaseUrl || this.apiBaseUrl;
    this.model = config.model || this.model;
  }

  async analyze(screenshotPath) {
    if (!fs.existsSync(screenshotPath)) {
      throw new Error('Screenshot not found');
    }

    const imageBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });

    // 使用 MiniMax 视觉 API
    const result = await this.callMiniMax(imageBase64);

    return this.parseResult(result);
  }

  /**
   * MiniMax 视觉 API (免费中转)
   */
  async callMiniMax(imageBase64) {
    const endpoint = `${this.apiBaseUrl}/chat/completions`;

    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
          { type: 'text', text: `分析这张截图。检测是否有交易相关按钮（买入、卖出、开多、开空、BUY、SELL、LONG、SHORT等）。同时尝试识别当前正在交易的品种代码。\n返回 JSON：{"hasTradingButtons":true/false,"buttons":["按钮1"],"platform":"平台名","symbol":"交易品种代码如BTCUSDT/600519/AAPL（无法识别则为null）","marketType":"crypto/a_share/us_stock/hk_stock（无法识别则为null）","riskLevel":"high/medium/low","action":"block/warn/allow"}` }
        ]
      }
    ];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 1000,
        })
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[MiniMax] Error:', err);
        return this.fallbackResult();
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error('[MiniMax] Request failed:', err.message);
      return this.fallbackResult();
    }
  }

  /**
   * 降级结果（返回对象）
   */
  fallbackResult() {
    return {
      hasTradingButtons: false,
      buttons: [],
      platform: 'unknown',
      symbol: null,
      marketType: null,
      riskLevel: 'low',
      action: 'allow'
    };
  }

  parseResult(content) {
    try {
      if (typeof content === 'object') return content;
      // 去除 markdown 代码块包裹（```json ... ```）
      let text = content.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[Analyzer] Parse error, using fallback');
    }
    return this.fallbackResult();
  }
}

module.exports = { ScreenshotAnalyzer };
