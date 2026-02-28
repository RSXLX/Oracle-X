# Smart Intercept 测试清单

> 阶段 6 | 日期：2026-02-27

## 前置条件

1. Web App 在 `localhost:3000` 运行中（`npm run dev`）
2. `.env.local` 中 `STEP_API_KEY`、`AI_BASE_URL`、`AI_MODEL` 已配置
3. Chrome 浏览器 120+ 版本

## 测试 0：Extension 加载

**操作步骤：**
1. 打开 `chrome://extensions`
2. 开启「开发者模式」（右上角）
3. 点击「加载已解压的扩展程序」
4. 选择 `/Users/hmwz/AI项目/Oracle-X/extension/` 目录
5. 确认 Extension 加载成功，无红色报错

**预期结果：**
- [ ] Extension 列表中出现 "Oracle-X" 并显示启用状态
- [ ] 无 "Service Worker (Inactive)" 报错
- [ ] Console 中输出 `Oracle-X Service Worker initialized (Smart Intercept enabled)`

---

## 测试 1：设置页面

**操作步骤：**
1. 右键 Oracle-X 扩展图标 → 「选项」（或访问 Extension 详情页 → 扩展程序选项）

**预期结果：**
- [ ] 看到新增的「🎯 智能拦截 (Smart Intercept)」配置区
- [ ] 5 个新字段正常显示：开关、灵敏度、通知方式、缓存时间、超时时间
- [ ] 修改后点击「保存」，刷新页面后设置保留

---

## 测试 2：平台检测（Binance）

**操作步骤：**
1. 访问 `https://www.binance.com/zh-CN/trade/BTC_USDT`
2. 打开 DevTools Console

**预期结果：**
- [ ] Console 输出 `[Oracle-X] Detected platform: Binance`
- [ ] Console 输出 `[Oracle-X] Smart Intercept loaded for Binance`

---

## 测试 3：低风险拦截（气泡通知）

> 需要在市场相对平稳（24h 波动 < 5%）、首次操作时触发

**操作步骤：**
1. 在 Binance 现货交易页面
2. 确保没有设置杠杆
3. 点击「买入」按钮

**预期结果：**
- [ ] 按钮的默认操作被拦截（不会立即提交订单）
- [ ] 鼠标附近出现绿色气泡通知（✅ 风险较低 + 分数）
- [ ] 气泡 2 秒后自动消失
- [ ] 消失后交易被自动放行（原始买入操作执行）
- [ ] Console 输出 `[Oracle-X] Intercepted: buy on Binance`
- [ ] Console 输出 `[Oracle-X] Quick Score: { score: ..., level: 'low', ... }`

---

## 测试 4：中/高风险拦截（Side Panel 分析）

> 可通过快速连续点击（5分钟内 2+ 次同向操作）触发中风险

**操作步骤：**
1. 在 Binance 交易页面快速点击「买入」2-3 次（或设置灵敏度为「激进」）
2. 观察 Side Panel 是否自动打开

**预期结果：**
- [ ] Side Panel 自动弹出
- [ ] 显示 "🛡️ 交易已拦截 - AI 分析中..."
- [ ] 展示交易上下文卡片（平台名、交易对、价格、方向）
- [ ] 展示 Stage 1 快速评分及原因
- [ ] AI 分析文本流式展示
- [ ] 分析完成后出现结论 Badge（🟢/🟡/🔴）
- [ ] 出现「✅ 继续执行」和「❌ 取消交易」按钮

---

## 测试 5：用户决策 - 继续执行

**操作步骤：**
1. 在测试 4 的基础上，点击「✅ 继续执行」

**预期结果：**
- [ ] Side Panel 显示 "✅ 已放行，请在交易平台确认"
- [ ] 交易页面上的原始买入操作被执行
- [ ] 3 秒内再次点击同一按钮不会被重复拦截

---

## 测试 6：用户决策 - 取消交易

**操作步骤：**
1. 触发中/高风险拦截
2. 点击「❌ 取消交易」

**预期结果：**
- [ ] Side Panel 显示 "❌ 交易已取消"
- [ ] 交易页面上的买入操作不执行
- [ ] Console 输出 `[Oracle-X] Trade cancelled by user`

---

## 测试 7：降级场景 - API 不可用

**操作步骤：**
1. 停止 Web App（`ctrl+C` 终止 `npm run dev`）
2. 在交易平台触发中/高风险操作

**预期结果：**
- [ ] Side Panel 打开但 AI 分析失败或超时
- [ ] 超时（默认 5 秒）后交易自动放行
- [ ] 用户交易不被永久阻断

---

## 测试 8：气泡「查看详情」

**操作步骤：**
1. 触发低风险操作，看到气泡通知
2. 在气泡消失前快速点击「查看详情 ›」

**预期结果：**
- [ ] 气泡消失
- [ ] Side Panel 打开

---

## 测试 9：禁用智能拦截

**操作步骤：**
1. 进入设置页面，关闭「启用智能拦截分析」
2. 保存设置
3. 在交易平台点击买入/卖出

**预期结果：**
- [ ] Console 输出 `[Oracle-X] Smart Intercept is disabled`
- [ ] 交易按钮点击不被拦截，正常执行

---

## 已知限制

- Binance 等平台可能需要登录才能看到交易按钮
- 实际下单还需要账户余额和确认步骤，拦截发生在点击按钮的瞬间
- 不同平台的 DOM 结构可能已更新，选择器需要验证
