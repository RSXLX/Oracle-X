# Oracle-X 可演示版本清单（Demo Checklist）

> 目标：5-8 分钟内稳定演示“截图识别 → 交易前分析 → 风险结论”。

## 1) 环境准备（必须）

- [ ] Node.js 20+
- [ ] 已执行 `npm install`
- [ ] 已创建 `.env.local`
- [ ] `STEP_API_KEY` 已配置
- [ ] `AI_BASE_URL` 已配置（中转站建议使用 `/v1`）
- [ ] `AI_MODEL` 已配置（例如：`MiniMax M2.5-hignspeed`）

## 2) 后端可用性检查（必须）

- [ ] 启动服务：`npm run dev`
- [ ] 本地健康检查：打开 `http://localhost:3000`
- [ ] API 关键路由存在：
  - [ ] `POST /api/recognize`
  - [ ] `POST /api/analyze`（SSE）
  - [ ] `GET /api/ticker`
  - [ ] `GET /api/klines`

## 3) 代码质量门禁（建议）

- [ ] `npm run type-check` 通过
- [ ] `npm run build` 通过
- [ ] `npm run lint` 无阻断错误（warning 可接受）

## 4) Chrome 扩展联调（必须）

- [ ] 打开 `chrome://extensions`
- [ ] 开启开发者模式
- [ ] 加载 `extension/` 目录
- [ ] 点击扩展图标可打开 Side Panel
- [ ] 在扩展 Service Worker Console 执行（如需覆盖 API 地址）：

```js
chrome.storage.local.set({
  oraclexApiBaseUrl: 'http://localhost:3000'
});
```

> 如部署到公网服务，替换为对应地址（如 `https://xxx/v1` 所在服务的前端 API 域名，而不是直接 LLM 网关地址）。

## 5) 演示流程（推荐）

1. 打开交易页面（如 Binance 的 BTC/USDT）
2. 点击 Oracle-X 扩展图标
3. 展示“识别中” → 识别结果（平台、交易对）
4. 选择 LONG 或 SHORT
5. 展示 AI 流式分析文本
6. 展示最终风险结论 Badge（🟢/🟡/🔴）
7. 强调“AI 辅助决策，不替代用户下单”

## 6) 失败兜底（现场非常关键）

- [ ] 若截图识别失败：点 `Retry` 重试
- [ ] 若 Twitter 数据失败：继续主流程（不阻断分析）
- [ ] 若外网波动：提前准备录屏作为兜底素材
- [ ] 若模型网关不稳定：准备备用模型名（同网关可用模型）

## 7) 发布前确认（可选）

- [ ] 更新 `docs/PROJECT_STATUS.md`
- [ ] 提交代码并打 tag（如 `v0.1.1-demo`）
- [ ] 记录本次演示配置快照（模型、网关、时间）
