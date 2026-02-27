# Oracle-X 产品架构（双端 + Web）

## 产品形态

### 1. Web App（分析端）
- Next.js 14 + React 18 实时行情 + K 线图
- 技术指标面板（RSI/MACD/BB/ATR）
- AI 流式分析弹窗 + 三级风险建议
- Decision Log 看板（筛选/导出/复盘）
- 12 个后端 API 路由

### 2. Chrome Extension（拦截端）
- 自动注入 8 大交易平台页面
- 监听买入/卖出按钮点击 → 触发冷静层
- 调用视觉 AI 分析截图
- Side Panel 流式分析展示
- **设置页面**配置 API/风险/平台参数

### 3. Desktop App（管理端）
- 用户配置：AI API Key、风险档位、冷静时间
- 全局监控：截图 AI 检测 + 按钮监听
- 钱包分析：ETH/BSC/SOL 链上交易
- CSV 导入：支持 7+ 交易所
- 风险引擎：综合评分 + 优化建议
- 系统托盘 + 开机自启

## 数据流

```
[交易平台页面]
      ↓ 按钮点击拦截
[Chrome Extension] → 截图 → 视觉 AI 分析
      ↓ 决策
[冷静层弹窗] ←→ [Desktop App]
      ↓
[决策日志] → 本地存储

[Web App] ←→ [Next.js API]
      ↓
[Binance] + [Twitter] + [AI 引擎]
```

## 下一阶段开发

### P1 增强
1. `/api/analyze` 输出更结构化的阶段事件
2. Side Panel 增加"分析阶段"可视化
3. 完善错误态文案与重试策略

### P2 交付
1. Desktop DMG 打包
2. Extension release 打包
3. 准备 release 版本标签
