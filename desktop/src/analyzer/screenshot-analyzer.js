/**
 * Oracle-X Desktop - Screenshot AI Analyzer
 * 支持 MiniMax (免费中转) + OpenAI + Gemini
 */

const fs = require('fs');
const path = require('path');

// 从 .env.local 读取视觉 AI 配置（优先 VISION_*，回退 AI_*）
function loadScreenshotAIConfig() {
  // .env.local 在 desktop/ 根目录，而当前文件在 desktop/src/analyzer/
  const envPath = require('path').join(__dirname, '..', '..', '.env.local');
  const cfg = {
    apiKey: '', baseUrl: '', model: 'Kimi-K2.5',
    // 文本分析 fallback
    textApiKey: '', textBaseUrl: '', textModel: '',
  };
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq > 0) {
        const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
        // 视觉配置（火山方舟）
        if (k === 'VISION_API_KEY') cfg.apiKey = v;
        if (k === 'VISION_BASE_URL') cfg.baseUrl = v;
        if (k === 'VISION_MODEL') cfg.model = v;
        // 文本分析配置（MiniMax）— 作为 fallback
        if (k === 'AI_API_KEY') cfg.textApiKey = v;
        if (k === 'AI_BASE_URL') cfg.textBaseUrl = v;
        if (k === 'AI_MODEL') cfg.textModel = v;
      }
    }
  } catch (e) { /* ignore */ }
  // 如果没有独立的视觉配置，回退到文本配置
  if (!cfg.apiKey && cfg.textApiKey) {
    cfg.apiKey = cfg.textApiKey;
    cfg.baseUrl = cfg.textBaseUrl;
  }
  return cfg;
}

const _defaultAICfg = loadScreenshotAIConfig();

/**
 * 截图分析器
 */
class ScreenshotAnalyzer {
  constructor(options = {}) {
    this.provider = options.visionProvider || 'minimax';
    // 强制优先使用 .env.local 中针对视觉模型的专属配置
    this.apiKey = _defaultAICfg.apiKey || options.apiKey;
    this.apiBaseUrl = _defaultAICfg.baseUrl || options.apiBaseUrl;
    this.model = _defaultAICfg.model || options.model;

    this.buttonKeywords = [
      '买入', '卖出', '开多', '开空', '平多', '平空', '做多', '做空',
      'BUY', 'SELL', 'LONG', 'SHORT', 'BUY NOW', 'SELL NOW',
      'MARKET', 'LIMIT', 'CONFIRM', 'PLACE ORDER',
    ];
  }

  configure(config) {
    // 禁用外部覆盖，因为主进程传过来的是文本模型的配置
    // 如果想要动态配置视觉模型，需要在前端区分 aiModel 和 aiVisionModel
  }

  async analyze(screenshotPath) {
    if (!fs.existsSync(screenshotPath)) {
      throw new Error('Screenshot not found');
    }

    const imageBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });

    // 使用视觉 AI API（火山方舟 Responses API）
    const result = await this.callVisionAPI(imageBase64);

    return this.parseResult(result);
  }

  /**
   * 视觉 AI API 调用（火山方舟 Responses API 格式）
   */
  async callVisionAPI(imageBase64) {
    const endpoint = `${this.apiBaseUrl}/responses`;

    const requestBody = {
      model: this.model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_image', image_url: `data:image/png;base64,${imageBase64}` },
          { type: 'input_text', text: `分析这张截图。检测是否有交易相关按钮（买入、卖出、开多、开空、BUY、SELL、LONG、SHORT等）。同时尝试识别当前正在交易的品种代码。\n返回 JSON：{"hasTradingButtons":true/false,"buttons":["按钮1"],"platform":"平台名","symbol":"交易品种代码如BTCUSDT/600519/AAPL（无法识别则为null）","marketType":"crypto/a_share/us_stock/hk_stock（无法识别则为null）","riskLevel":"high/medium/low","action":"block/warn/allow"}` },
        ],
      }],
    };

    try {
      console.log('[VisionAPI] Calling:', endpoint, 'model:', this.model);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[VisionAPI] Error:', response.status, err);
        return this.fallbackResult();
      }

      const data = await response.json();

      // 火山方舟 Responses API 响应格式
      let content = '';
      if (data.output) {
        for (const item of data.output) {
          if (item.type === 'message' && item.content) {
            for (const c of item.content) {
              if (c.type === 'output_text') content += c.text;
            }
          }
        }
      }
      // 降级兼容 OpenAI 格式
      if (!content && data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      }

      console.log('[VisionAPI] Raw content:', content.slice(0, 200));
      return content || this.fallbackResult();
    } catch (err) {
      console.error('[VisionAPI] Request failed:', err.message);
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
