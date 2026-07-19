/**
 * Store — In-memory cache for articles
 * Provides session-level caching for <100ms second-click load
 */
window.Store = (() => {
  const cache = {
    articles: new Map(),     // feedId|tab -> { data, timestamp }
    feedMeta: new Map(),     // feedId -> feed metadata
    articleContent: new Map(), // articleId -> full article object
  };

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  function isStale(entry) {
    return !entry || (Date.now() - entry.timestamp > CACHE_TTL);
  }

  return {
    // --- Article list cache ---
    getArticles(key) {
      const entry = cache.articles.get(key);
      if (isStale(entry)) return null;
      return entry.data;
    },

    setArticles(key, data) {
      cache.articles.set(key, { data, timestamp: Date.now() });
    },

    invalidateArticles(key) {
      if (key) {
        cache.articles.delete(key);
      } else {
        cache.articles.clear();
      }
    },

    // --- Single article cache ---
    getArticle(id) {
      return cache.articleContent.get(id) || null;
    },

    setArticle(id, data) {
      cache.articleContent.set(id, data);
    },

    // --- Feed metadata cache ---
    getFeedMeta(id) {
      return cache.feedMeta.get(id) || null;
    },

    setFeedMeta(id, data) {
      cache.feedMeta.set(id, data);
    },

    // --- Clear all ---
    clearAll() {
      cache.articles.clear();
      cache.feedMeta.clear();
      cache.articleContent.clear();
    },
  };
})();
