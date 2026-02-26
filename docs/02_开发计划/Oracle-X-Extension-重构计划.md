# Oracle-X Extension 重构实施计划

## 阶段一：Extension 核心架构

### Task 1: 重构 content_script 实现自动监听
**Files:**
- Modify: `extension/background.js`
- Modify: `extension/manifest.json`

**Step 1:** 添加 content_script 注入配置到 manifest.json
**Step 2:** 创建 extension/content.js 实现 DOM 监听
**Step 3:** 添加 MutationObserver 监听交易按钮点击
**Step 4:** 测试监听功能

---

### Task 2: 实现自动拦截弹窗
**Files:**
- Create: `extension/content/inject.js`
- Create: `extension/content/styles.css`

**Step 1:** 创建拦截弹窗 HTML/CSS
**Step 2:** 实现按钮点击拦截逻辑
**Step 3:** 添加冷静层倒计时 UI

---

## 阶段二：多平台支持

### Task 3: 多平台识别引擎
**Files:**
- Create: `lib/platform-detector.ts`

**Step 1:** 定义支持的交易平台列表（Binance, OKX, Bybit, Coinbase）
**Step 2:** 实现 URL + DOM 特征识别
**Step 3:** 添加平台特定的按钮选择器映射

---

### Task 4: 多模态 AI 分析
**Files:**
- Modify: `extension/background.js`
- Create: `lib/vision-analyzer.ts`

**Step 1:** 实现截图捕获逻辑
**Step 2:** 调用视觉 AI API 分析截图
**Step 3:** 提取交易对、价格、仓位信息

---

## 阶段三：用户配置

### Task 5: Extension 设置页
**Files:**
- Create: `extension/settings.html`
- Create: `extension/settings.js`
- Create: `extension/settings.css`

**Step 1:** 创建设置页面 UI
**Step 2:** 实现 API Key 配置输入
**Step 3:** 添加风险档位选择
**Step 4:** 实现 chrome.storage 保存/读取

---

### Task 6: 配置持久化
**Files:**
- Modify: `extension/background.js`

**Step 1:** 添加配置读取逻辑
**Step 2:** 实现配置验证
**Step 3:** 添加默认配置

---

## 阶段四：验收测试

### Task 7: 本地打包测试
**Files:**
- N/A

**Step 1:** 加载 unpacked extension 到 Chrome
**Step 2:** 测试 Binance 页面监听
**Step 3:** 测试拦截弹窗显示
**Step 4:** 验证配置保存

---

### Task 8: 文档更新
**Files:**
- Modify: `README.md`
- Create: `docs/EXTENSION_USAGE.md`

**Step 1:** 更新 README 安装说明
**Step 2:** 创建详细使用文档
