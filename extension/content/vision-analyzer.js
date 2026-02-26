/**
 * Oracle-X Vision Analyzer
 * 调用视觉 AI 分析交易页面截图
 */

const VISION_PROVIDERS = {
  // 阶跃星辰
  stepfun: {
    name: 'StepFun',
    endpoint: '/v1/chat/completions',
    model: 'step-1v',
    buildPayload: (image, prompt) => ({
      model: 'step-1v',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
      max_tokens: 1000,
    }),
    parseResponse: (data) => {
      try {
        const content = data.choices?.[0]?.message?.content || '';
        return JSON.parse(content);
      } catch {
        return null;
      }
    }
  },

  // OpenAI Vision
  openai: {
    name: 'OpenAI',
    endpoint: '/v1/chat/completions',
    model: 'gpt-4o',
    buildPayload: (image, prompt) => ({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ],
      max_tokens: 1000,
    }),
    parseResponse: (data) => {
      try {
        const content = data.choices?.[0]?.message?.content || '';
        return JSON.parse(content);
      } catch {
        return null;
      }
    }
  },

  // Google Gemini
  gemini: {
    name: 'Gemini',
    endpoint: '/v1beta/models/gemini-1.5-pro-vision:generateContent',
    buildPayload: (image, prompt) => ({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'image/png', data: image.replace('data:image/png;base64,', '') } }
          ]
        }
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
    }),
    parseResponse: (data) => {
      try {
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return JSON.parse(content);
      } catch {
        return null;
      }
    }
  }
};

const DEFAULT_PROMPT = `你是一个专业的加密货币交易助手。请分析这张交易平台的截图，提取以下信息并以 JSON 格式返回：

{
  "symbol": "交易对，如 BTC/USDT",
  "price": "当前价格",
  "direction": "long 或 short 或 unknown",
  "positionSize": "仓位大小（如有）",
  "leverage": "杠杆倍数（如有）",
  "confidence": 0-100 的置信度
}

如果无法识别某个字段，使用 null。`;

/**
 * 视觉分析器类
 */
class VisionAnalyzer {
  constructor(provider = 'stepfun', apiKey = '', baseUrl = '') {
    this.provider = provider;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.client = VISION_PROVIDERS[provider] || VISION_PROVIDERS.stepfun;
  }

  /**
   * 设置 API 凭证
   */
  setCredentials(apiKey, baseUrl) {
    this.apiKey = apiKey;
    if (baseUrl) this.baseUrl = baseUrl;
  }

  /**
   * 分析截图
   * @param {string} imageBase64 - base64 编码的图片
   * @returns {Promise<Object>} 分析结果
   */
  async analyze(imageBase64) {
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const payload = this.client.buildPayload(imageBase64, DEFAULT_PROMPT);

    try {
      const response = await fetch(`${this.baseUrl}${this.client.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vision API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const result = this.client.parseResponse(data);

      if (!result) {
        throw new Error('Failed to parse AI response');
      }

      return result;
    } catch (error) {
      console.error('[Oracle-X Vision] Analysis failed:', error);
      throw error;
    }
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.OracleXVisionAnalyzer = VisionAnalyzer;
}
