/**
 * API — Unified fetch wrapper with Clerk token injection
 */
window.API = (() => {
  const BASE = '';

  async function request(path, options = {}) {
    const token = await Auth.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      throw new Error(errorData.error || `请求失败: ${response.status}`);
    }

    return response.json();
  }

  return {
    // --- Subscriptions ---
    getSubscriptions() {
      return request('/api/subscriptions');
    },

    addSubscription(url, category = '') {
      return request('/api/subscriptions', {
        method: 'POST',
        body: JSON.stringify({ url, category }),
      });
    },

    removeSubscription(id) {
      return request(`/api/subscriptions?id=${id}`, {
        method: 'DELETE',
      });
    },

    // --- Feeds ---
    getArticles(feedId, page = 1, pageSize = 20, tab = 'latest') {
      const params = new URLSearchParams({ page, pageSize, tab });
      if (feedId && feedId !== 'all') {
        params.set('feedId', feedId);
      } else {
        params.set('all', 'true');
      }
      return request(`/api/feeds?${params}`);
    },

    // --- Articles ---
    updateArticleStatus(articleId, action) {
      return request('/api/articles', {
        method: 'PUT',
        body: JSON.stringify({ articleId, action }),
      });
    },

    markAllRead(feedId) {
      return request('/api/articles', {
        method: 'POST',
        body: JSON.stringify({ feedId: feedId === 'all' ? null : feedId }),
      });
    },

    // --- Proxy ---
    proxyFeed(url, feedId, refresh = false) {
      const params = new URLSearchParams({ url });
      if (feedId) params.set('feedId', feedId);
      if (refresh) params.set('refresh', 'true');
      return request(`/api/proxy?${params}`);
    },

    // --- Pool ---
    getPool(status = 'approved') {
      return request(`/api/pool?status=${status}`);
    },

    reviewFeed(feedId, action) {
      return request('/api/pool', {
        method: 'POST',
        body: JSON.stringify({ feedId, action }),
      });
    },

    // --- Guest ---
    getExploreData() {
      return fetch('/guest/explore').then(r => r.json());
    },
  };
})();
