/**
 * Oracle-X Desktop - Screenshot AI Analyzer
 * 使用 AI 分析屏幕截图，识别交易按钮
 */

const fs = require('fs');
const path = require('path');

/**
 * 截图分析器
 */
class ScreenshotAnalyzer {
  constructor(options = {}) {
    this.visionProvider = options.visionProvider || 'stepfun';
    this.apiKey = options.apiKey || '';
    this.apiBaseUrl = options.apiBaseUrl || 'https://api.stepfun.com/v1';
    this.model = options.model || 'step-1-8k';
    
    // 交易按钮关键词
    this.buttonKeywords = [
      // 中文
      '买入', '卖出', '开多', '开空', '平多', '平空', '做多', '做空',
      '买涨', '买跌', '确认买入', '确认卖出', '下单', '市价', '限价',
      // 英文
      'BUY', 'SELL', 'LONG', 'SHORT', 'BUY NOW', 'SELL NOW',
      'MARKET', 'LIMIT', 'CONFIRM', 'PLACE ORDER', 'SUBMIT',
    ];
  }

  /**
   * 配置 API
   */
  configure(config) {
    this.apiKey = config.apiKey || this.apiKey;
    this.apiBaseUrl = config.apiBaseUrl || this.apiBaseUrl;
    this.model = config.model || this.model;
  }

  /**
   * 分析截图
   */
  async analyze(screenshotPath) {
    if (!fs.existsSync(screenshotPath)) {
      throw new Error('Screenshot not found');
    }

    // 读取图片为 base64
    const imageBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
    
    // 调用 AI 视觉 API
    const result = await this.callVisionAPI(imageBase64);
    
    return this.parseResult(result);
  }

  /**
   * 调用视觉 API
   */
  async callVisionAPI(imageBase64) {
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}` }
          },
          {
            type: 'text',
            text: `分析这张截图。检测是否有交易相关的按钮（买入、卖出、开多、开空、BUY、SELL、LONG、SHORT等）。\n返回 JSON 格式：\n{\n  "hasTradingButtons": true/false,\n  "buttons": ["按钮文本1", "按钮文本2"],\n  "platform": "检测到的交易平台",\n  "riskLevel": "high/medium/low",\n  "action": "建议的操作（block/warn/allow）"\n}`
          }
        ]
      }
    ];

    // 根据提供商选择不同的 API 调用方式
    switch (this.visionProvider) {
      case 'stepfun':
        return this.callStepFun(messages);
      case 'openai':
        return this.callOpenAI(messages);
      case 'gemini':
        return this.callGemini(imageBase64);
      default:
        return this.callStepFun(messages);
    }
  }

  /**
   * StepFun API
   */
  async callStepFun(messages) {
    const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
      })
    });

    if (!response.ok) {
      throw new Error(`StepFun API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * OpenAI API (GPT-4V)
   */
  async callOpenAI(messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0.3,
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Gemini API
   */
  async callGemini(imageBase64) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: '分析这张截图。检测是否有交易相关的按钮。返回 JSON。' },
            { inline_data: { mime_type: 'image/png', data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.3 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  /**
   * 解析 AI 返回结果
   */
  parseResult(content) {
    try {
      // 尝试提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[ScreenshotAnalyzer] Parse error:', e);
    }

    // 降级返回
    return {
      hasTradingButtons: false,
      buttons: [],
      platform: 'unknown',
      riskLevel: 'low',
      action: 'allow'
    };
  }

  /**
   * 简单图像识别（关键词匹配）
   */
  async simpleAnalyze(screenshotPath) {
    // 这个方法可以在没有 AI API 时使用简单的模式匹配
    // 目前只是占位实现
    return {
      hasTradingButtons: false,
      buttons: [],
      platform: 'unknown',
      riskLevel: 'low',
      action: 'allow'
    };
  }
}

module.exports = { ScreenshotAnalyzer };
