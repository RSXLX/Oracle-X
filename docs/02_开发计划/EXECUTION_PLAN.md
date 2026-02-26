# Oracle-X 详细开发执行计划

## 当前进度
- ✅ Chrome Extension 自动拦截 (content_script)
- ✅ Desktop App 设置面板增强
- 🔄 进行中：多平台识别 + AI 分析

---

## 阶段一：多平台识别引擎 (Task 3)

### 1.1 创建平台检测模块
**文件**: `extension/content/platforms.js`
- 实现平台自动检测（Binance/OKX/Bybit/Coinbase/Kraken/Huobi/Gate/Uniswap）
- 每个平台的按钮选择器映射
- DOM 特征识别

### 1.2 测试各平台选择器
- 打开各交易平台页面
- 验证按钮选择器匹配正确

---

## 阶段二：视觉 AI 分析 (Task 4)

### 2.1 截图捕获
- 使用 chrome.tabs.captureVisibleTab() 捕获页面
- 提取交易对、价格信息

### 2.2 调用视觉 AI
- 支持多 AI 提供商：OpenAI Vision / Gemini Vision / StepFun Vision
- 解析返回的结构化数据

### 2.3 决策逻辑
- 根据分析结果判断是否需要拦截
- 生成风险评分

---

## 阶段三：Extension ↔ Desktop 通信

### 3.1 chrome.storage 同步
- Extension 写入拦截事件
- Desktop 读取并展示

### 3.2 实时事件推送
- 使用 chrome.runtime.sendMessage
- Desktop 监听并更新 UI

---

## 阶段四：验收测试 (Task 7-8)

### 4.1 Extension 测试
- 加载 unpacked extension
- 访问 Binance 测试拦截
- 验证弹窗显示

### 4.2 Desktop 测试
- 启动 Desktop App
- 验证设置保存
- 验证日志读取

---

## 执行命令

```bash
# 启动 Next.js 后端
cd Oracle-X && npm run dev

# 启动 Desktop App
cd desktop && npm run dev

# 加载 Extension
chrome://extensions/ → 加载已解压的扩展程序
```
