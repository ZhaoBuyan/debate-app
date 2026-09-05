# 🗣️ 辩论平台（debate-app-new-TS）

全栈 TypeScript 在线辩论平台，遵循《软件需求规格说明书（SRS V1.0）》实现：
**结构化、实时化、智能化、无障碍化**的在线辩论空间。

| 目录 | 说明 | 技术栈 |
|------|------|--------|
| `server/` | 后端 API + WebSocket | Node.js 20+ · Express · Socket.IO · SQLite · JWT · bcrypt |
| `client/` | 前端 Web 应用 | React 18 · Vite 5 · TypeScript · Tailwind CSS · socket.io-client |

---

## 快速开始

### 方式一：Docker 一键部署（推荐演示）

```bash
# 需要 Docker Desktop（Linux 引擎）已启动
docker compose up -d --build
# 前端 http://localhost:8080 · 后端 http://localhost:3000
# 重置演示数据：docker compose down -v
```

### 方式二：本地开发

```bash
# 1. 安装依赖（首次）
cd server && npm install
cd ../client && npm install

# 2. 启动后端（默认 http://localhost:3000）
cd server
npm run dev          # 开发模式（nodemon + ts-node）
# 或 npm run build && npm start（生产模式）

# 3. 启动前端（默认 http://localhost:5173，已配置 /api 与 /socket.io 代理）
cd client
npm run dev
```

打开 http://localhost:5173 即可使用。

### 方式三：E2E 测试与 CI（工程化）

```bash
# 浏览器端 E2E：7 条用户旅程（登录/导航/移动端/观战互动/检索/创建→审核→开赛→发言）
# 自动启动独立测试后端(3110)+vite(5173)，使用独立临时库，不污染演示数据
cd e2e
npm install
npx playwright install chromium   # 首次需下载浏览器内核
npm test
npm run report                   # 失败时查看 HTML 报告/截图
```

代码推送到 GitHub 后，`.github/workflows/ci.yml` 自动执行：server 类型检查 + 61 回归用例、client 构建、E2E 7 旅程（失败自动上传报告）。

> 首次启动自动创建 `server/data/debate.db` 并填充种子数据；
> 删除该文件后重启即可恢复纯净演示数据。

### 测试账号（种子数据，密码均为 `123456`）

| 用户名 | 角色 | 说明 |
|--------|------|------|
| `admin` | super_admin | 管理员：审核辩题 / 封禁 / 举报处理 / 敏感词 / 公告 |
| `testuser`、`张三`、`李四`、`王五`、`赵六`、`孙七` | user | 普通用户 / 辩手 / 观众 |

### AI 配置（可选）

不配置也能运行：AI 论点提炼与赛后报告自动降级为本地摘要引擎。
如需接入 Groq API：

```bash
cd server
copy .env.example .env   # Windows
# 编辑 .env，填写 GROQ_API_KEY 后重启服务
```

---

## ✅ 功能实现对照（SRS）

### 已完成（P0 全部 + 主要 P1）

**用户与认证**
- U-01 注册（用户名≥3字符、bcrypt 加密）、U-02 登录（JWT 7天）、U-03 角色体系
- U-04 封禁（临时/永久，到期自动解封）、U-05 警告（满3次自动封禁 7 天）

**辩题生命周期（D）**
- D-01/D-03 创建 → 管理员审核（通过/拒绝）→ waiting
- D-02 六大分类；D-04 列表筛选；D-05 详情（辩手/发言/投票/支持率）
- D-06 报名加入（每方≤4、共≤8）；D-07 满员立即开赛 / 30 分钟到点系统自动开赛
- D-08 首页每日推荐；D-09 一键申请重辩（复制为新辩题，标注重辩次数）

**辩论流程（B）**
- B-01 交替发言顺序 A1→B1→A2→B2…（服务端轮次/发言者广播）
- B-02 每人 3 分钟计时、最后 30 秒红色警告
- B-03 发言永久落库（时间戳/辩手/轮次）；B-07 + AD-12 管理员/超管强制结束

**实时互动（S / V / I）**
- S-01 实时支持率（可改票），支持率进度条 + 变化≥5% 闪烁动画
- S-04 支持率快照（S-06：发言结束/辩论结束）→ 赛后走势图
- V-01 最佳辩手投票、V-02 阵营胜负投票、V-03 实时广播、V-04 一人一票（可改票）
- I-01 实时聊天、I-02 🔥🤔💥 情绪反馈（可挂载到具体发言）

**AI（A）**
- A-01/A-02 发言后 AI 提炼核心论点（≤50字），辩手面板实时显示“一句话观点”
- A-03 赛后报告：辩论结束时自动生成并存档（AI 生成标注 + 免责声明）
- A-04 辩论树（Argument Map）：发言自动组织为 论点→反驳→再反驳 的可视化树（辩论室可切换视图）
- A-05/A-06/A-07 预留扩展点（service 层已结构化）

**游戏化与知识沉淀（体验扩展）**
- 🏆 段位结算：辩论结束后按胜负自动结算积分（胜方+20/败方+10/最佳辩手额外+30，平局为参与分+10），积分自动映射 青铜→白银→黄金→铂金→钻石→王者，全局彩色徽章展示
- 🥊 快速 1v1 辩论形式：每方 1 人、满 2 人自动开赛，无需凑 8 人
- 🧊 社区公约·冷静期：审核时可设置 0-60 分钟，新加入辩手需等待冷静期才可发言（防冲动言论）
- 📦 个人数据导出：导航栏一键导出本人全部活动记录 JSON（数据可携带权）
- 🔁 重辩自动继承辩论形式，形成同一辩题的历次对比沉淀（知识库雏形）
- 🧬 重辩链聚合页：同一辩题历次交锋的胜负/票数/支持率并排对比（已结束场次可点“历次交锋对比”入口）
- 🔎 全文检索（KN-01）：大厅搜索框实时检索辩题与发言，结果高亮，点击直达对应发言
- 📚 相关辩题推荐（KN-03）：辩论室侧栏按“同分类优先 + 标题词重叠”推荐，自动排除自身与同重辩链场次
- 🏅 内容运营：热度指标（辩手×3+发言×2+情绪+支持）、大厅运营位（编辑精选/正在辩论/今日推荐兜底）、管理后台“内容运营”页签设精选

**无障碍（AC）**
- AC-01 语音控制（关键词指令导航/操作）
- AC-02 语音识别中间+最终结果实时显示；AC-03 语音输入发言/聊天
- AC-06 全程 aria-label / aria-live 标注，键盘可操作
- 手势/手语输入入口（手语模式消息），为听障用户提供参与通道

**管理员（AD）**
- AD-01 辩题审核；AD-02/03/04 封禁/解封/警告；AD-05 删除违规内容
- AD-06 举报处理（标记处理/驳回/删除内容）
- AD-07 敏感词管理（实时过滤：注册名、辩题、发言、消息全链路替换为 `*`）
- AD-08 公告（发布/上下架/删除，大厅滚动展示）
- AD-09 管理员操作全量审计日志；AD-10 实时禁言；AD-11 消息撤回；AD-12 强制结束

**安全与性能（第4/7章）**
- bcrypt 盐值10轮、JWT、参数化 SQL、登录/注册/全局三层限流（200次/15分钟/IP）
- 安全响应头（nosniff / 禁 iframe / Referrer-Policy / 生产 CSP / API 禁缓存，零依赖实现）
- **Socket 事件级限流**：发言/聊天/情绪/投票/举报按用户滑动窗口防刷屏
- 输入纵深：用户名白名单格式、消息/举报/公告/发言全量长度上限
- 全站 XSS 防护（React 转义，无 dangerouslySetInnerHTML）+ 敏感词实时过滤
- CORS 支持逗号分隔多源；生产环境默认 JWT 密钥启动即告警

### 规划中（SRS 8.3 长期项）
语音控制/手语识别的深度完善（MediaPipe）、视频通话（WebRTC）、知识库全文检索、
辩题众创（D-10）、段位积分（U-06/U-07）、移动端精细化、多端部署（PostgreSQL）。

### 远期生态方向（产品讨论，待需求明确后实施）
虚拟礼物/打赏与创作者经济、弹幕、插件市场与开放 API（逻辑谬误检测、情绪分析等）、
声纹/人脸身份验证、企业/学校低代码嵌入（开放平台战略）、
“杠精提醒”（基于 AI 语义分析提示未回应的交锋点）。

---

## 主要接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` `/api/auth/login` `/api/auth/me` | 认证 |
| GET | `/api/debates` `/api/debates/:id` | 列表 / 详情（公开） |
| POST | `/api/debates` | 创建辩题（待审核） |
| POST | `/api/debates/:id/join` `/speech` `/restart` | 加入 / 发言 / 重辩 |
| GET/POST | `/api/debates/:id/support` | 支持率 |
| GET | `/api/debates/:id/votes` | 投票统计 |
| GET | `/api/announcements` | 启用中的公告 |
| `/api/admin/*` | 用户、辩题、举报、敏感词、日志、公告、总览 | 管理员（auth+role 校验） |

实时功能走 WebSocket（认证握手后 `join_room`）：
`room_state / new_speech / speech_summary / new_message / support_updated /
vote_updated / emotion_updated / round_changed / debate_started|ended /
user_muted / message_recalled / report_submitted / my_state …`

---

## 目录结构

```
server/src
├── app.ts / index.ts          # 启动装配（路由+Socket+自动开赛调度）
├── controllers/               # 路由→控制器→服务→数据（分层）
├── routes/                    # REST 路由
├── services/                  # 业务逻辑（含 AI 降级引擎）
├── middleware/                # JWT / 管理员 / 限流 / 敏感词
├── socket/                    # 握手认证 + 房间管理器 + 事件处理器
├── types/                     # 全量类型定义
└── database/                  # SQLite 表结构 + 种子数据

client/src
├── pages/                     # Login / DebateList / DebateRoom / CreateDebate / AdminPanel
├── components/                # common / debate / voice / admin
├── hooks/                     # useAuth / useDebateRoom / useSpeechRecognition
└── api.ts / socket.ts / types/
```

## 验证方式

```bash
# 后端类型检查
cd server && npm run type-check

# 后端回归测试（61 用例：服务层 5 套件 + 真实 HTTP 集成套件）
# 覆盖认证/封禁/1v1/冷静期/结算/报告/辩论树/敏感词/举报/审计/重辩链/检索/相关推荐/运营精选/安全纵深
cd server && npm test

# 浏览器端 E2E（7 用例：登录/导航/移动端/观战互动/检索/创建-审核-开赛-发言全链路）
# 自动启动独立测试后端(3110)与 vite(5173)，不污染演示库
cd e2e && npm install && npx playwright install chromium && npm test

# 前端构建
cd client && npm run build
```

架构与设计决策见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
