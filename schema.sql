-- ============================================================
-- RSS Reader MVP — D1 Database Schema
-- ============================================================

-- RSS 资源池：存储所有 RSS 源信息
CREATE TABLE IF NOT EXISTS feed_sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  url         TEXT    NOT NULL UNIQUE,
  title       TEXT    DEFAULT '',
  description TEXT    DEFAULT '',
  site_url    TEXT    DEFAULT '',
  favicon_url TEXT    DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  submitted_by TEXT   DEFAULT '',                   -- 提交者 userId
  reviewed_by  TEXT   DEFAULT '',                   -- 审核者 userId
  last_fetched_at TEXT DEFAULT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 用户订阅关系
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL,
  feed_id     INTEGER NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
  category    TEXT    DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at  TEXT    DEFAULT NULL,
  UNIQUE(user_id, feed_id)
);

-- 文章缓存
CREATE TABLE IF NOT EXISTS articles (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id      INTEGER NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
  guid         TEXT    NOT NULL,
  title        TEXT    NOT NULL DEFAULT '',
  author       TEXT    DEFAULT '',
  summary      TEXT    DEFAULT '',
  content      TEXT    DEFAULT '',
  link         TEXT    DEFAULT '',
  published_at TEXT    DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(feed_id, guid)
);

-- 用户文章状态
CREATE TABLE IF NOT EXISTS user_article_status (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT    NOT NULL,
  article_id  INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  is_read     INTEGER NOT NULL DEFAULT 0,
  is_favorited INTEGER NOT NULL DEFAULT 0,
  is_read_later INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, article_id)
);

-- 源刷新队列（3s 节流控制）
CREATE TABLE IF NOT EXISTS feed_refresh_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_id     INTEGER NOT NULL REFERENCES feed_sources(id) ON DELETE CASCADE,
  requested_by TEXT   NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending',   -- pending | processing | done | failed
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT   DEFAULT NULL
);

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user    ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_feed_published    ON articles(feed_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_article_status_user   ON user_article_status(user_id, article_id);
CREATE INDEX IF NOT EXISTS idx_feed_sources_status        ON feed_sources(status);
CREATE INDEX IF NOT EXISTS idx_feed_refresh_queue_status  ON feed_refresh_queue(status, created_at);
