# Oracle-X 产品架构（双端）

## 产品形态

### 1. Chrome Extension（拦截端）
- 自动注入目标交易平台页面
- 监听买入/卖出按钮点击 → 触发冷静层
- 调用视觉 AI 分析截图
- 与 Desktop App 通信

### 2. Desktop App（管理端）
- 用户配置：AI API Key、风险档位、冷静时间
- 实时监控：拦截记录、决策日志
- 复盘分析：拦截率、误报率、收益追踪
- 数据持久化本地存储

## 数据流

```
[交易平台页面]
      ↓ 点击按钮
[Chrome Extension] → 截图 → 视觉 AI 分析
      ↓ 决策
[冷静层弹窗] ←→ [Desktop App]
      ↓
[决策日志] → 本地存储
```

## 下一阶段开发

### Desktop App 功能
1. 设置页：API Key、风险档位、冷静时间配置
2. 监控面板：实时拦截记录流
3. 复盘面板：统计图表（拦截率、趋势）

### 与 Extension 通信
- 使用 chrome.storage 或本地 Server 通信
- Extension 推送拦截事件 → Desktop 展示
