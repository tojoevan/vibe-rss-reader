# 📄 Vibe RSS Reader

> **产品定位**：免服务器成本、跨端同步、注重移动端阅读与稍后阅读的云端 RSS 阅读器。

## 🛠 技术栈

| 组件 | 技术 |
|------|------|
| 代码托管 | GitHub |
| 前端托管 | Cloudflare Pages |
| 边缘路由 | Cloudflare Functions |
| 数据库 | Cloudflare D1 (SQLite) |
| 用户认证 | Clerk (Google / Microsoft / GitHub) |

## 🎯 核心价值

- 以 AI 领域为主（[aihot.virxact.com](https://aihot.virxact.com/)），提供更适合**移动端**的阅读体验
- 注重阅读标记已读、稍后阅读、收藏与转发
- 建立 RSS 资源池，逐步补充有价值的订阅源
- 利用 **Serverless 架构**实现永久免费、多端同步

---

## 📋 功能需求矩阵

### 2.1 用户认证 (Auth) — P0

| ID | 功能 | 说明 |
|----|------|------|
| AUTH-001 | 游客场景 | 未登录用户访问根域名，展示双栏内容：时间线最新 20 条 + 随机收藏 20 条 |
| AUTH-002 | 多渠道登录 | 集成 Clerk，支持 Google、Microsoft、GitHub 快捷登录，不使用邮箱注册 |
| AUTH-003 | 状态与登出 | 顶部栏展示用户名，提供"退出登录"按钮，登出后清除凭证 |

### 2.2 订阅管理 (Subscription) — P0/P1

| ID | 优先级 | 功能 | 说明 |
|----|--------|------|------|
| SUB-001 | P0 | 添加订阅 | 输入 URL，校验格式与唯一性，订阅源加入资源池，绑定 userId 写入 D1 |
| SUB-002 | P0 | 获取列表 | 登录后根据 userId 查询 D1，渲染左侧订阅栏 |
| SUB-003 | P0 | 取消订阅 | 提供删除按钮，二次确认后从 D1 抹除记录 |
| SUB-004 | P1 | 分类管理 | 支持为订阅源设置分类（如技术、娱乐），按折叠树状展示 |
| SUB-005 | P0 | 资源池审核 | 用户提交订阅到资源池，经**管理员审核通过**后才能查看内容 |
| SUB-006 | P0 | 刷新节流 | 每 3s 只能触发 1 次某源的数据更新，队列排序更新后推送到用户数据库 |

### 2.3 阅读核心 (Reader) — P0/P1

| ID | 优先级 | 功能 | 说明 |
|----|--------|------|------|
| READ-001 | P0 | 边缘代理 | Functions 中转请求外网 RSS，注入 CORS 头消除跨域 |
| READ-002 | P0 | XML 解析 | DOMParser 解析 XML，提取标题、作者、时间、摘要及原文链接 |
| READ-003 | P0 | PC 三栏布局 | 左栏订阅源 → 中栏文章列表 → 右栏正文富文本 |
| READ-004 | P0 | 移动端单栏 | 类 Google Reader 设计，Favicon 标识 + 行内操作按钮 + Tab 分类菜单 |
| READ-005 | P1 | 内存缓存 | 会话内缓存已拉取文章，二次点击 < 100ms 秒开 |

---

## 🔒 非功能性需求与安全

- **安全宗旨**：阅读器非严格隐私场景，优先级排序：阅读体验 > 性能 > 安全
- **数据隔离**：中间件解密 JWT 获取 userId，所有 D1 操作强制隔离
- **凭证安全**：`CLERK_SECRET_KEY` 仅存于 CF 环境变量，严禁泄露至前端
- **容错体验**：解析失败或源失效时提示"无法加载"，单源异常不影响整体

---

## 🔀 核心数据流向

```
[浏览器前端] ──(携带 Clerk Token)──► [Functions 中间件鉴权/提取 userId]
                                                │
                 ┌──────────────────────────────┴──────────────────────┐
                 ▼ (订阅数据)                                          ▼ (文章内容)
     [执行 D1 SQL 严格隔离查询]                           [边缘代理请求外网 RSS + CORS]
                 │                                                    │
                 ▼                                                    ▼
         返回订阅列表 JSON                                     返回原始 XML / Atom
```

---

## 📁 项目结构

```
vibe-rss-reader/
├── wrangler.toml              # Cloudflare 配置 + D1 绑定
├── package.json               # 项目依赖与脚本
├── schema.sql                 # D1 数据库建表脚本 (5 张表)
├── public/                    # 静态前端资源
│   ├── index.html             # 主页面
│   ├── css/style.css          # 深色主题 + 毛玻璃 + 响应式
│   ├── js/
│   │   ├── app.js             # 应用入口 + 事件编排
│   │   ├── auth.js            # Clerk 认证封装
│   │   ├── api.js             # 统一 fetch + Bearer Token
│   │   ├── feed.js            # RSS/Atom 解析器
│   │   ├── reader.js          # 阅读器 UI 渲染
│   │   └── store.js           # 内存缓存 (Map + TTL)
│   └── assets/favicon.svg
└── functions/                 # Cloudflare Functions (后端 API)
    ├── _middleware.js          # JWT 鉴权 + 管理员检测
    ├── api/
    │   ├── subscriptions.js   # 订阅 CRUD
    │   ├── feeds.js           # 文章列表 + 分页 + Tab
    │   ├── articles.js        # 文章状态 (已读/收藏/稍后)
    │   ├── proxy.js           # RSS 代理 + 3s 节流
    │   └── pool.js            # 资源池 + 管理员审核
    └── guest/
        └── explore.js         # 游客首页数据
```

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 创建 D1 数据库
wrangler d1 create vibe-rss-db
# 将返回的 database_id 填入 wrangler.toml

# 3. 初始化本地数据库
npm run db:init:local

# 4. 配置环境变量 — 创建 .dev.vars 文件
cat > .dev.vars << EOF
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
ADMIN_USER_IDS=your_user_id
EOF

# 5. 本地开发
npm run dev

# 6. 部署到 Cloudflare Pages
npm run deploy
```

---

## 📄 License

MIT