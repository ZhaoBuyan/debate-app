# 辩论平台 · 架构说明（ARCHITECTURE.md）

> 面向论文/作品集答辩、协作开发与后续演进。与《软件需求规格说明书（SRS V1.0）》配套。

## 1. 总体架构

```
┌─────────────────────────── 浏览器 ───────────────────────────┐
│  React 18 SPA（Vite + TS + Tailwind）                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ 页面层 pages │→│ 状态层 hooks │→│ api.ts / socket.ts     │  │
│  └─────────────┘  └─────────────┘  └──────────┬───────────┘  │
└────────────────────────────────────────────────┼──────────────┘
                                  HTTP(REST)     │      WebSocket
┌────────────────────────────────────────────────┼──────────────┐
│  Express + Socket.IO（单 Node 进程）            ▼              │
│  ┌───────────────────┐        ┌─────────────────────────────┐ │
│  │ middleware 链       │        │ Socket.IO 层                │ │
│  │ JWT/管理员/限流/敏感词│        │ 握手JWT认证 → RoomManager    │ │
│  └─────────┬─────────┘        │ (成员/禁言) → 业务 handlers   │ │
│  routes ─→ controllers ─→ services ─→ database(sqlite)       │ │
│                                            ▲                 │ │
│  AI 引擎（Groq API ⇄ 本地摘要降级）───────────┘                 │ │
└──────────────────────────────────────────────────────────────┘
```

**关键决策**：REST 负责“动作与持久化”，WebSocket 负责“房间内实时广播”。
写操作同时开放 REST 与 Socket 两个入口（如发言/支持/投票），Socket 处理器复用同一批 service，
保证逻辑单一来源（DRY）。状态机迁移只发生在 service 层，REST 与 WS 均调用之。

## 2. 分层职责

| 层 | 目录 | 职责 | 约定 |
|---|---|---|---|
| 入口装配 | `app.ts` `index.ts` | 中间件/路由/健康检查、Socket 挂载、自动开赛调度器、优雅关闭 | 不写业务 |
| 路由 | `routes/` | 路径与 HTTP 语义（哪些需认证/公开/管理员） | 薄层，不含逻辑 |
| 控制器 | `controllers/` | 解析 req/校验入参、调 service、拼 res | 不触碰 SQL |
| 服务 | `services/` | 全部业务规则与数据访问（状态机、结算、冷静期、AI） | 可单测 |
| 数据 | `database/` | 建表、幂等迁移、种子数据 | SQLite |
| 实时 | `socket/` | 握手认证、房间成员/禁言内存态、事件处理器 | 处理器→service |
| 类型 | `types/` | 前后端共享语义的类型定义 | 事件契约两端一致 |

## 3. 核心数据流

### 3.1 辩论状态机（B-08）
```
       管理员审核通过            满员(8/2人) 或 start_time 到点(10s调度器)
pending ───────────→ waiting ───────────────────────────────→ ongoing
  ↑拒绝→rejected                    │ 管理员强制结束（结算+报告+快照）
                                   ▼
                                finished（settled 置位 → 幂等）
```
迁移唯一入口：`DebateService.startDebate / joinDebate`、`AdminService.approveDebate /
forceEndDebate`；其余代码只读状态，杜绝散落的状态更新。

### 3.2 实时房间协议
```
客户端                                    服务端
  │ socket 握手 {auth:token}               JWT 校验 → socket.data.user
  │ emit join_room {debateId}   ────→      校验成员/辩手身份
  │                                        emit room_state（完整房间快照）
  │                                        emit my_state（个性化状态）
  │ emit speech/send_message/support/… ──→ service 持久化 + 校验(禁言/冷静期/敏感词)
  │                                        io.to(room) emit new_speech / support_updated…
```
- 房间命名空间 `debate:<id>`；广播一律走 `io.to(roomName(id))`，不向无关客户端推送。
- 断线自动 leave；禁言为房间内存态（服务重启即失效——文档化取舍，见 §7 限制）。

### 3.3 发言与 AI 提炼（A-01）
发言 → 敏感词过滤 → 轮次/顺序计算（辩手总数取模）→ 插入 → AI 摘要（Groq 优先，
未配置/超时 8s/失败自动降级为本地抽取式摘要，≤50字）→ 回填 `speeches.summary` →
广播 `new_speech` + `speech_summary` → 支持率快照（S-06）→ 广播 `round_changed`。

### 3.4 结束结算流水线（强制结束时）
```
forceEndDebate
 ├─ status=finished, end_time
 ├─ 支持率快照 debate_end（供走势图）
 ├─ settleDebate（幂等，settled 置位防重）
 │   ├─ evaluateDebateResult（胜负判定单一来源，聚合页复用）
 │   ├─ 阵营投票 → 胜方（票多者胜，平局无胜负）
 │   ├─ 最佳辩手（votes_best 最高票）
 │   └─ 积分：胜+20/败+10/最佳+30/平局+10 → 段位重算 → 审计日志
 └─ AI 赛后报告异步生成（debate_reports，唯一约束；GET /report 可懒生成兜底）
```

### 3.5 知识沉淀（重辩链 + 检索）
- `getDebateChain`：任一场次上溯到首场、再沿 `parent_id` 线性收集后代；每场附
  `evaluateDebateResult` 的胜负/票数与支持率终值 → `/debate/:id` 页展示对比时间线。
- `searchAll`：辩题（标题优先）+ 发言 `LIKE` 检索，命中片段以关键词为中心截取，
  前端高亮并支持 `?focus=<speechId>` 深链直达定位。
- `getRelatedDebates`：同分类 +8、标题 2-gram 重叠 ×2 打分；排除自身与整条重辩链
  场次（避免推荐同名辩题），供辩论室侧栏推荐（KN-03）。
- 胜负判定只存在于 `evaluateDebateResult`（结算与展示共用），避免规则分叉。

## 4. 扩展点设计

| 扩展点 | 现状 | 说明 |
|---|---|---|
| AI 引擎 | `AIService.callGroq` + 本地降级 | 替换 `ai.service.ts` 即可换 Gemini/Claude；新增能力（谬误检测等）在此加方法 |
| 辩论形式 | `debates.debate_type`（classic/quick1v1） | 新增形式 = 扩展类型 + 容量表 + 审核/前端标签 |
| 游戏化 | `settleDebate` 积分规则 | 规则收敛于 `debate.service.ts` 常量（RANK_THRESHOLDS 等） |
| 社区治理 | 冷静期列 + 敏感词表 + 举报状态机 | 均由数据库驱动，改配置/数据即生效 |
| 知识库 | `debate_reports` + parent_id 重辩链 | 辩题聚合页 = 沿 parent_id 链聚合各场记录 |
| 生态 API | `routes/` 模式 | 新模块 = controller/service/route 三步 |

## 5. 数据设计要点
- 全部时间戳存毫秒（created_at 新表用 unixepoch 秒——既有差异已知，展示层兼容）。
- 软删除策略：内容（发言/消息）违规时保留行、内容替换为违规提示，保证审计与引用完整性。
- 迁移策略：`migrateLegacyTables()` 用 `PRAGMA table_info` 检测缺列后 ALTER，
  **幂等**且不破坏既有库（兼容老数据升级）。
- 计数类（支持率/票数）不落冗余列，运行时聚合——演示规模足够，切 PG 后再考虑物化。

## 6. 测试与部署
- 服务层回归：`server/npm test`（node:test，44 用例，独立临时库，不污染演示数据），
  覆盖认证/封禁/警告、1v1/标准制/冷静期、结算/报告/辩论树/重辩、敏感词/举报/审计、重辩链聚合/检索/相关推荐/内容运营。
- 部署：`docker compose up -d --build`（前端 nginx 反代 /api、/socket.io），
  或开发模式：server `npm run dev`(3000) + client `npm run dev`(5173，vite 代理)。

## 7. 已知限制（诚实清单）
1. SQLite 单写者 + 单文件：生产并发需迁 PostgreSQL（schema 为通用 SQL，仅少量方言差异）。
2. Socket 房间/禁言/限流为单机内存态：多实例需 Redis 适配层（RoomManager 是唯一耦合点）。
3. 发言顺序为“建议式”非强制（服务端计算轮次并广播，不做硬校验），避免离线辩手卡死全场。
4. AI 本地降级是抽取式摘要（非语义生成）；Groq Key 就绪后质量显著提升。
5. 辩论树为启发式（立场切换即交锋），非语义理解；将来可替换为 LLM 驱动的论元结构解析。
6. 安全纵深已覆盖：安全头/CSP、三层 REST 限流、Socket 事件限流、输入白名单与长度上限、
   生产默认密钥告警、CORS 多源。仍属上线前项：HTTPS 终结、数据库备份、JWT 密钥轮换/
   refresh token、按用户级 REST 限流（当前按 IP）。
7. 定时自动开赛为 10 秒轮询调度，属进程内定时器（重启后依赖下次轮询补跑，逻辑幂等）。
8. 前端自动化已由 Playwright E2E 补齐（7 条用户旅程，含截图/报告产物），CI 流水线就绪
   （.github/workflows/ci.yml，推送到 GitHub 后生效）。
