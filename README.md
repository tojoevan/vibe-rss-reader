# 📄 卡皮订阅 (Vibe RSS Reader)

[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-orange?logo=cloudflare)](https://pages.cloudflare.com/)
[![Database](https://img.shields.io/badge/Database-Cloudflare_D1-blue?logo=sqlite)](https://developers.cloudflare.com/d1/)
[![Auth](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk)](https://clerk.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **产品定位**：全平台零服务器成本、跨端秒级同步、注重移动端极致体验与无痕阅读的 Serverless 云端 RSS 资讯聚合器。

---

## ✨ 核心特性

- 📱 **移动端优先与动态响应**：针对移动端屏幕高度自动计算每页渲染条数，搭配手势滑动与浏览器原生后退按键导航，带来类 Native App 般顺滑体验。
- ⚡ **边缘 Proxy 抓取与缓存**：基于 Cloudflare Functions 节点提供分布式代理，消除跨域限制；配合 3 秒单源防刷节流与主动刷新 CDN 绕过机制，实现高效稳健的 RSS 数据同步。
- 🎨 **现代化高端 SaaS 设计**：基于微渐变色（卡皮活跃橙 #f97316）、毛玻璃 backdrop-filter、交互式 Mockup 演示以及可视化 Serverless 架构图表打造的高颜值 UI。
- 📚 **全能阅读工作流**：支持“全部文章”并发一键批量刷新、已读/稍后阅读/收藏标记、正文纯净提取与文本链接自动识别转化（Linkify）。
- 🔒 **Serverless & 强安全隔离**：集成 Clerk 多渠道 OAuth 认证，基于中间件完成轻量 JWT 解析与严格的 D1 数据库用户级隔离。

---

## 🛠 技术栈

| 模块 | 技术方案 | 亮点 |
|------|------|------|
| **代码托管** | GitHub | 自动集成 Agent 规则与 CI/CD 极速部署 |
| **前端托管** | Cloudflare Pages | 全球 300+ CDN 边缘节点零成本托管 |
| **边缘路由** | Cloudflare Functions | 无服务器轻量 API 路由与 JWT 鉴权 |
| **数据库** | Cloudflare D1 (SQLite) | 边缘 SQL 数据库，毫秒级多端读写同步 |
| **用户认证** | Clerk (Google / Microsoft / GitHub) | 安全开箱即用的无密码/第三方 OAuth 授权 |
| **样式与逻辑** | Vanilla CSS + Native JS (ES6+) | 零重型框架负担，极速加载与轻量资源消耗 |

---

## 🏗️ 系统架构图

```
┌────────────────────────────────────────────────────────────────────────┐
│                        客户端体验层 (Client Layer)                       │
│             卡皮订阅 Web / Mobile (自适应 PWA & 极致多端排版)              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / Clerk JWT Auth
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Cloudflare 边缘 Serverless 引擎 (Edge Layer)               │
│   Cloudflare Pages & Functions (300+ 节点代理 / 3s节流) + Clerk Auth 防线   │
└─────────────────┬──────────────────────────────────────┬───────────────┘
                  │ SQL 隔离查询                          │ Fetch 代理 (CORS)
                  ▼                                      ▼
┌───────────────────────────────────┐  ┌─────────────────────────────────┐
│     Cloudflare D1 (SQLite)        │  │        全网 RSS / Atom 源        │
│  资源池、订阅关系与文章存库        │  │    智能 XML/JSON 增量流式抓取     │
└───────────────────────────────────┘  └─────────────────────────────────┘
```

---

## 📋 功能需求与演进矩阵

### 1. 用户认证与未登录体验 (Auth & Landing)
- **多渠道登录**：集成 Clerk，支持 Google、Microsoft、GitHub 等 OAuth 一键登录。
- **高颜值引导页**：包含动态文字渐变标题、SaaS Mockup 演示、4 大核心优势卡片及可视化 Serverless 架构流程图。
- **无缝登录状态切换**：登录/未登录布局平滑过渡，顶部栏即时响应。

### 2. 订阅与数据同步 (Subscription)
- **单源/全量一键刷新**：支持针对特定订阅源或在“全部文章”视图下通过 `Promise.allSettled` 进行并发全量刷新。
- **边缘 Proxy 防节流**：Cloudflare Edge 3 秒单源防刷新保护，显式刷新自动绕过 CDN Edge 缓存拉取源站最新内容。
- **订阅管理与公共资源池**：支持 OPML 导入、自定义添加 RSS 链接与公共资源池快捷添加/取消订阅。

### 3. 移动端与阅读体验 (Mobile & Reader)
- **动态 PageSize 布局算法**：自动识别移动端与桌面端屏幕高度，智能计算最佳单页显示条数。
- **手势与后退兼容**：移动端阅读视图支持浏览器原生 back 按键关闭，无缝联动底部 Tab 栏显示状态。
- **文本增强**：自动检测文章正文中的纯文本链接并转换为可点击的 `target="_blank"` 安全超链接。

---

## 📌 待办与演进 Roadmap (TODO)

### 订阅管理与分类 (Subscription & Categories)
- [ ] **订阅源分类与文件夹管理**：实现侧边栏按分类折叠树状展示，支持右键/弹窗修改订阅源分类。
- [ ] **OPML 批量导出**：在订阅管理弹窗中新增 OPML 导出功能，方便跨阅读器迁移数据。

### 数据维护与自动化 (Automation & Maintenance)
- [ ] **D1 历史数据定期清理**：基于 Cloudflare Cron Trigger 自动清理 30 天以前且未被收藏/稍后阅读的旧文章，瘦身 D1 数据库。
- [ ] **Cron 离线定时抓取**：由后台 Cron 定时抓取热门 RSS 源，使用户打开应用即享最新内容。

### 阅读体验与 PWA 增强 (Experience & PWA)
- [ ] **键盘快捷键帮助手册**：补充 `j`/`k` 切换、`m` 标记已读、`s` 收藏等全套快捷键，支持 `?` 弹出快捷键帮助 Modal。
- [ ] **搜索高亮与多维筛选**：搜索结果文本关键字高亮显示，支持按订阅源和时间过滤。
- [ ] **PWA 离线支持**：配置 `manifest.json` 与 Service Worker，支持“添加到主屏幕”与网络不稳定时的离线阅读。

---

## 📁 项目结构

```
vibe-rss-reader/
├── wrangler.toml              # Cloudflare 配置 + D1 数据库绑定
├── package.json               # 项目依赖与 npm 脚本
├── schema.sql                 # D1 数据库建表脚本 (5 张核心表)
├── public/                    # 静态前端资源
│   ├── index.html             # 主页面 (SPA 结构 + Landing Page)
│   ├── css/style.css          # 高端设计系统 + 响应式 + 架构图样式
│   ├── js/
│   │   ├── app.js             # 应用入口、键盘快捷键与事件编排
│   │   ├── auth.js            # Clerk 认证与状态桥接
│   │   ├── api.js             # 统一 API 客户端 + Token 注入
│   │   ├── feed.js            # RSS/Atom 解析与 DOM 转换
│   │   ├── reader.js          # 文章渲染、分页与阅读器交互
│   │   └── store.js           # 内存缓存 (Map + TTL 机制)
│   └── assets/favicon.svg
└── functions/                 # Cloudflare Functions (Serverless API)
    ├── _middleware.js          # JWT 鉴权中间件 + 管理员权限检测
    └── api/
        ├── subscriptions.js   # 订阅关系 CRUD
        ├── feeds.js           # 文章列表 + 分页 + 动态分类 Tab
        ├── articles.js        # 文章状态操作 (标记已读/收藏/稍后)
        ├── proxy.js           # RSS 代理 + CDN 缓存控制 + 3s 防刷节流
        └── pool.js            # 资源池管理与审核
```

---

## 🚀 快速开始

```bash
# 1. 克隆项目并安装依赖
git clone https://github.com/tojoevan/vibe-rss-reader.git
cd vibe-rss-reader
npm install

# 2. 创建 Cloudflare D1 数据库
wrangler d1 create vibe-rss-db
# 将返回的 database_id 填入 wrangler.toml

# 3. 初始化本地 SQLite 数据库
npm run db:init:local

# 4. 配置本地环境变量 (.dev.vars)
cat > .dev.vars << EOF
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
ADMIN_USER_IDS=your_user_id
EOF

# 5. 启动本地开发服务
npm run dev

# 6. 一键部署至 Cloudflare Pages
npm run deploy
```

---

## 📄 License

[MIT](LICENSE)