# Oracle-X 项目进度（2026-02-28 13:30）

## 本轮更新（2026-02-28）

### Smart Intercept v1.5.1 — Extension 验收修复
- 极速拦截弹窗 `intercept/intercept.html` + `intercept.js`
- `sidePanel.open()` → `windows.create()` 绕过用户手势限制
- 评分阈值调低（balanced: low 30→20, high 60→45）
- 杠杆评分加强（50x: 20→35, 20x: 18→25）
- 气泡「查看详情」→ 快速弹窗（替代 Side Panel 截图流程）
- CSP 合规：内联脚本拆分为独立 JS 文件

### Desktop v2.0 — 零配置改造
- **MySQL → SQLite**：`better-sqlite3` 零配置存储
  - 数据自动存储 `~/Library/Application Support/Oracle-X/oraclex.db`
  - 兼容包装器保持 `db.execute()` API 不变
- **隐私权限分级引导**：
  - 默认关闭自动监控，基础功能无需权限
  - 开启时弹出隐私说明 + 引导授权
  - 截图文件分析后即删

### Desktop v2.1 — 截图分析 UX 改造
- **侧边栏分析面板**（类似 Extension Side Panel）
  - 截图/快捷键触发后右侧滑出 400px 面板
  - 加载中显示旋转动画 → 分析完成展示结果
  - 4 格详情：平台识别 / 风险等级 / 交易按钮 / 建议操作
  - 高/中风险显示「取消/继续」操作按钮
  - ESC / 遮罩层关闭
- **堆叠通知系统**（右下角）
  - 多条通知同时堆叠显示（最多 5 条）
  - 渐变配色 + 自动 5 秒消失 + 点击关闭
- **分析记录列表**
  - 每次分析自动追加可点击条目
  - 点击回看侧边栏详情
- **统计面板**
  - 截图分析次数 / 风险检测 / 化解率 实时更新
- **变更文件**：
  - `renderer/styles.css` — 侧边栏 + 通知 CSS（+230 行）
  - `renderer/index.html` — 监控面板重做 + 侧边栏 HTML
  - `renderer/renderer.js` — 截图结果渲染 + 事件处理重写
  - `preload.js` — 新增 `onScreenshotResult/Captured/Error` 事件
  - `main.js` — `takeScreenshot` IPC 改为完整截图+分析流程

---

## 当前状态

- **分支**：`main`
- **版本**：v2.0

## 已实现能力

### Web App（Next.js）
- 实时价格/K线 + 技术指标面板
- AI 分析弹窗（流式）+ 风险 Badge
- Twitter 情绪面板 + Decision Log 看板
- 12 个 API 路由

### Chrome Extension
- 8 大交易平台 + localhost 测试支持
- Smart Intercept 两阶段智能分析 v1.5.1
  - 三级风险：气泡(≤20) → 弹窗(21-45) → 强警告(>45)
  - 极速弹窗 + 键盘快捷键 + 自动关窗
- Side Panel 流式分析 + NoFOMO 冷静层
- 设置页面（API/风险/平台/智能拦截配置）

### Desktop App（Electron）v2.1
- **零配置启动**（SQLite 替代 MySQL）
- **隐私权限分级引导**
- **侧边栏分析面板**（截图→AI分析→滑出展示）
- **堆叠通知系统**（多条同时显示）
- **分析记录可回看**
- 全局快捷键（Cmd+Shift+O/S）
- 钱包分析（ETH/BSC/SOL）
- CSV/XLSX 导入
- 系统托盘 + 开机自启

## 工程状态

- Web App `npm run build` ✅
- Extension Smart Intercept ✅ 已验收
- Desktop SQLite + 权限引导 ✅ 已验证启动
- Desktop 侧边栏 + 通知 ✅ 已实现
- 本地模拟测试环境 ✅

## 当前剩余问题

### P1（增强）
- `/api/ticker` 无代理环境连接失败
- AI 分析流式结果优化
- Desktop UI 权限状态实时显示

### P2（交付）
- 打包 Extension release
- Desktop DMG 打包
- E2E 自动化测试

## 文档索引

| 文档 | 路径 |
|------|------|
| **统一验收文档** | `docs/ACCEPTANCE_TEST.md` |
| 项目状态 | `docs/PROJECT_STATUS.md` |
| Extension 需求设计 | `docs/01_需求设计/Smart-Intercept-需求设计.md` |
| Extension 技术设计 | `docs/02_开发计划/Smart-Intercept-技术设计.md` |
| Desktop 需求设计 | `docs/01_需求设计/Desktop-改造需求设计.md` |
| Desktop 技术设计 | `docs/02_开发计划/Desktop-改造技术设计.md` |
