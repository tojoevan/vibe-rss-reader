/**
 * App — Main application entry point
 * Orchestrates auth, subscriptions, article loading, and UI interactions
 */
;(async function App() {
  'use strict';

  // --- State ---
  const state = {
    currentFeedId: 'all',
    currentTab: 'latest',
    currentPage: 1,
    pageSize: 20,
    subscriptions: [],
    isLoading: false,
  };

  // --- DOM References ---
  const $ = id => document.getElementById(id);
  const sidebar = $('sidebar');
  const feedList = $('feed-list');
  const articleList = $('article-list');
  const feedColumnTitle = $('feed-column-title');
  const appMain = $('app-main');
  const guestLanding = $('guest-landing');
  const mobileTabs = $('mobile-tabs');
  const markAllRead = $('mark-all-read');

  // --- Toast Utility ---
  function toast(message, type = 'info') {
    const container = $('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, 3000);
  }

  // --- Confirm Dialog ---
  function confirm(message) {
    return new Promise(resolve => {
      const dialog = $('confirm-dialog');
      $('confirm-message').textContent = message;
      $('confirm-ok').onclick = () => { dialog.close(); resolve(true); };
      $('confirm-cancel').onclick = () => { dialog.close(); resolve(false); };
      dialog.showModal();
    });
  }

  // ============================================================
  // AUTH EVENTS
  // ============================================================
  window.addEventListener('auth:login', async () => {
    guestLanding.style.display = 'none';
    appMain.style.display = 'grid';
    if (window.innerWidth <= 768) {
      mobileTabs.style.display = 'flex';
    }
    await loadSubscriptions();
    await loadArticles();
  });

  window.addEventListener('auth:logout', () => {
    appMain.style.display = 'none';
    mobileTabs.style.display = 'none';
    guestLanding.style.display = 'block';
    loadGuestContent();
  });

  // ============================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================
  async function loadSubscriptions() {
    try {
      const data = await API.getSubscriptions();
      state.subscriptions = data.subscriptions || [];
      renderSubscriptionList();
    } catch (err) {
      console.error('Load subscriptions failed:', err);
      toast('加载订阅列表失败', 'error');
    }
  }

  function renderSubscriptionList() {
    // Keep the "all" item
    feedList.innerHTML = `
      <li class="feed-item ${state.currentFeedId === 'all' ? 'active' : ''}" data-feed="all" id="feed-all">
        <span class="feed-icon">📰</span>
        <span class="feed-name">全部文章</span>
      </li>
    `;

    state.subscriptions.forEach(sub => {
      const li = document.createElement('li');
      li.className = `feed-item ${state.currentFeedId == sub.feed_id ? 'active' : ''}`;
      li.dataset.feed = sub.feed_id;
      li.dataset.subId = sub.id;

      const iconContent = sub.favicon_url
        ? `<img src="${Feed.escapeHTML(sub.favicon_url)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${(sub.title || '?')[0].toUpperCase()}'"/>`
        : (sub.title || sub.url || '?')[0].toUpperCase();

      li.innerHTML = `
        <span class="feed-icon">${iconContent}</span>
        <span class="feed-name" title="${Feed.escapeHTML(sub.url)}">${Feed.escapeHTML(sub.title || sub.url)}</span>
        <button class="feed-remove" title="取消订阅" aria-label="取消订阅">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      `;
      feedList.appendChild(li);
    });
  }

  // --- Add Feed ---
  $('btn-add-feed').addEventListener('click', () => {
    const form = $('add-feed-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
    if (form.style.display === 'block') {
      $('feed-url-input').focus();
    }
  });

  $('btn-cancel-feed').addEventListener('click', () => {
    $('add-feed-form').style.display = 'none';
    $('feed-url-input').value = '';
    $('feed-form-hint').textContent = '';
  });

  $('btn-submit-feed').addEventListener('click', async () => {
    const url = $('feed-url-input').value.trim();
    const hint = $('feed-form-hint');

    if (!url) {
      hint.textContent = '请输入 RSS 链接';
      return;
    }

    try {
      new URL(url);
    } catch {
      hint.textContent = 'URL 格式无效';
      return;
    }

    try {
      hint.textContent = '';
      hint.style.color = 'var(--text-muted)';
      hint.textContent = '提交中…';
      const result = await API.addSubscription(url);
      toast(result.message || '订阅已添加', 'success');
      $('add-feed-form').style.display = 'none';
      $('feed-url-input').value = '';
      hint.textContent = '';
      await loadSubscriptions();
    } catch (err) {
      hint.style.color = 'var(--danger)';
      hint.textContent = err.message;
    }
  });

  $('feed-url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      $('btn-submit-feed').click();
    }
  });

  // --- Feed List Click ---
  feedList.addEventListener('click', async (e) => {
    const feedItem = e.target.closest('.feed-item');
    const removeBtn = e.target.closest('.feed-remove');

    if (removeBtn && feedItem) {
      e.stopPropagation();
      const subId = feedItem.dataset.subId;
      const confirmed = await confirm('确定要取消订阅吗？');
      if (confirmed) {
        try {
          await API.removeSubscription(subId);
          toast('已取消订阅', 'success');
          await loadSubscriptions();
          if (state.currentFeedId == feedItem.dataset.feed) {
            state.currentFeedId = 'all';
            state.currentPage = 1;
            await loadArticles();
          }
        } catch (err) {
          toast(err.message, 'error');
        }
      }
      return;
    }

    if (feedItem) {
      state.currentFeedId = feedItem.dataset.feed;
      state.currentPage = 1;
      feedList.querySelectorAll('.feed-item').forEach(li => li.classList.remove('active'));
      feedItem.classList.add('active');

      const feedName = feedItem.querySelector('.feed-name')?.textContent || '全部文章';
      feedColumnTitle.textContent = feedName;

      // Mobile: close sidebar
      if (window.innerWidth <= 768) {
        closeSidebar();
      }

      Store.invalidateArticles();
      await loadArticles();
    }
  });

  // ============================================================
  // ARTICLE LOADING
  // ============================================================
  async function loadArticles(forceRefresh = false) {
    if (state.isLoading) return;

    const cacheKey = `${state.currentFeedId}|${state.currentTab}|${state.currentPage}`;

    if (!forceRefresh) {
      const cached = Store.getArticles(cacheKey);
      if (cached) {
        Reader.renderArticleList(cached.articles, articleList);
        Reader.renderPagination(cached.pagination);
        updateMarkAllReadVisibility();
        return;
      }
    }

    state.isLoading = true;
    Reader.showSkeleton(articleList);

    try {
      const data = await API.getArticles(
        state.currentFeedId,
        state.currentPage,
        state.pageSize,
        state.currentTab
      );

      Store.setArticles(cacheKey, data);
      Reader.renderArticleList(data.articles, articleList);
      Reader.renderPagination(data.pagination);
      updateMarkAllReadVisibility();

    } catch (err) {
      console.error('Load articles failed:', err);
      articleList.innerHTML = `
        <div class="empty-state">
          <p>⚠️ 加载失败</p>
          <p class="text-muted">${Feed.escapeHTML(err.message)}</p>
        </div>
      `;
    } finally {
      state.isLoading = false;
    }
  }

  function updateMarkAllReadVisibility() {
    if (state.currentTab === 'latest' && window.innerWidth <= 768) {
      markAllRead.style.display = 'block';
    } else {
      markAllRead.style.display = 'none';
    }
  }

  // --- Article Row Click ---
  articleList.addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('.row-action-btn');

    if (actionBtn) {
      e.stopPropagation();
      const articleId = actionBtn.dataset.articleId;
      const action = actionBtn.dataset.action;

      if (action === 'share') {
        // Use Web Share API or fallback to clipboard
        const row = actionBtn.closest('.article-row');
        const title = row?.querySelector('.article-row-title')?.textContent || '';
        const cachedArticle = Store.getArticle(parseInt(articleId));
        const link = cachedArticle?.link || '';

        if (navigator.share) {
          try {
            await navigator.share({ title, url: link });
          } catch { /* user cancelled */ }
        } else if (link) {
          await navigator.clipboard.writeText(link);
          toast('链接已复制', 'success');
        }
        return;
      }

      try {
        const result = await API.updateArticleStatus(parseInt(articleId), action);
        actionBtn.classList.toggle('is-active');

        // Update article row styling
        if (action === 'read') {
          const row = actionBtn.closest('.article-row');
          if (row) row.classList.toggle('is-read', !!result.is_read);
        }

        Store.invalidateArticles();
      } catch (err) {
        toast(err.message, 'error');
      }
      return;
    }

    const articleRow = e.target.closest('.article-row');
    if (articleRow) {
      const articleId = parseInt(articleRow.dataset.id);

      // Highlight active row
      articleList.querySelectorAll('.article-row').forEach(r => r.classList.remove('active'));
      articleRow.classList.add('active');

      // Try cache first
      let article = Store.getArticle(articleId);
      if (!article) {
        // Find in current list data
        const cacheKey = `${state.currentFeedId}|${state.currentTab}|${state.currentPage}`;
        const cached = Store.getArticles(cacheKey);
        if (cached) {
          article = cached.articles.find(a => a.id === articleId);
        }
      }

      if (article) {
        Reader.showArticle(article);
      }
    }
  });

  // --- Refresh ---
  $('btn-refresh').addEventListener('click', async () => {
    const btn = $('btn-refresh');
    btn.classList.add('is-spinning');

    // If a specific feed is selected, trigger proxy refresh
    if (state.currentFeedId !== 'all') {
      const sub = state.subscriptions.find(s => s.feed_id == state.currentFeedId);
      if (sub) {
        try {
          await API.proxyFeed(sub.url, sub.feed_id, true);
        } catch (err) {
          console.error('Refresh proxy failed:', err);
        }
      }
    }

    Store.invalidateArticles();
    await loadArticles(true);
    btn.classList.remove('is-spinning');
    toast('已刷新', 'success');
  });

  // --- Mark All Read ---
  $('btn-mark-all-read').addEventListener('click', async () => {
    try {
      await API.markAllRead(state.currentFeedId);
      toast('已全部标记为已读', 'success');
      Store.invalidateArticles();
      await loadArticles(true);
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // --- Pagination ---
  $('btn-prev-page').addEventListener('click', () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      loadArticles();
    }
  });

  $('btn-next-page').addEventListener('click', () => {
    state.currentPage++;
    loadArticles();
  });

  // ============================================================
  // MOBILE TABS
  // ============================================================
  mobileTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab-btn');
    if (!tab) return;

    state.currentTab = tab.dataset.tab;
    state.currentPage = 1;
    mobileTabs.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    Store.invalidateArticles();
    loadArticles();
    updateMarkAllReadVisibility();
  });

  // ============================================================
  // SIDEBAR TOGGLE (Mobile)
  // ============================================================
  $('sidebar-toggle').addEventListener('click', () => {
    if (sidebar.classList.contains('is-open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  function openSidebar() {
    sidebar.classList.add('is-open');
    // Create overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.addEventListener('click', closeSidebar);
      document.body.appendChild(overlay);
    }
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    const overlay = document.querySelector('.sidebar-overlay');
    if (overlay) {
      overlay.classList.remove('is-visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
    }
  }

  // ============================================================
  // READER ACTIONS (Desktop reader pane buttons)
  // ============================================================
  document.querySelector('.reader-actions')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.action-btn');
    if (!btn) return;

    const action = btn.dataset.action;
    const articleId = Reader.getActiveArticleId();
    if (!articleId) return;

    if (action === 'share') {
      const article = Store.getArticle(articleId);
      if (navigator.share && article) {
        try {
          await navigator.share({ title: article.title, url: article.link });
        } catch { /* user cancelled */ }
      } else if (article?.link) {
        await navigator.clipboard.writeText(article.link);
        toast('链接已复制', 'success');
      }
      return;
    }

    try {
      await API.updateArticleStatus(articleId, action);
      btn.classList.toggle('is-active');
      Store.invalidateArticles();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  // ============================================================
  // RESOURCE POOL
  // ============================================================
  $('btn-explore-pool').addEventListener('click', async () => {
    const modal = $('pool-modal');
    const poolListEl = $('pool-list');

    poolListEl.innerHTML = '<div class="loading-spinner"></div>';
    modal.showModal();

    try {
      const data = await API.getPool('approved');
      if (!data.sources || data.sources.length === 0) {
        poolListEl.innerHTML = '<div class="empty-state"><p>暂无可用资源</p></div>';
        return;
      }

      poolListEl.innerHTML = data.sources.map(source => `
        <div class="pool-item" data-source-id="${source.id}">
          <div class="pool-item-info">
            <div class="pool-item-title">${Feed.escapeHTML(source.title || source.url)}</div>
            <div class="pool-item-url">${Feed.escapeHTML(source.url)}</div>
          </div>
          <button class="btn btn-primary btn-sm pool-subscribe-btn" data-url="${Feed.escapeHTML(source.url)}">订阅</button>
        </div>
      `).join('');

    } catch (err) {
      poolListEl.innerHTML = `<div class="empty-state"><p>加载失败: ${Feed.escapeHTML(err.message)}</p></div>`;
    }
  });

  $('pool-modal').addEventListener('click', async (e) => {
    const subBtn = e.target.closest('.pool-subscribe-btn');
    if (subBtn) {
      const url = subBtn.dataset.url;
      try {
        subBtn.textContent = '添加中…';
        subBtn.disabled = true;
        const result = await API.addSubscription(url);
        toast(result.message || '已订阅', 'success');
        subBtn.textContent = '已订阅';
        await loadSubscriptions();
      } catch (err) {
        toast(err.message, 'error');
        subBtn.textContent = '订阅';
        subBtn.disabled = false;
      }
    }
  });

  $('pool-modal-close').addEventListener('click', () => $('pool-modal').close());

  // ============================================================
  // ADMIN PANEL (shown to admin users)
  // ============================================================
  async function checkAdmin() {
    // Admin button only appears if user is admin (checked after login)
    try {
      const data = await API.getPool('pending');
      if (data.sources && data.sources.length > 0) {
        showAdminButton(data.sources);
      }
    } catch {
      // Not admin or no pending — silently ignore
    }
  }

  function showAdminButton(pendingSources) {
    let adminBtn = document.getElementById('btn-admin');
    if (!adminBtn) {
      adminBtn = document.createElement('button');
      adminBtn.id = 'btn-admin';
      adminBtn.className = 'btn btn-ghost';
      adminBtn.textContent = `🔧 审核 (${pendingSources.length})`;
      adminBtn.style.marginRight = 'var(--space-sm)';
      $('user-area').insertBefore(adminBtn, $('user-area').firstChild);

      adminBtn.addEventListener('click', () => openAdminPanel());
    } else {
      adminBtn.textContent = `🔧 审核 (${pendingSources.length})`;
    }
  }

  async function openAdminPanel() {
    const modal = $('admin-modal');
    const adminList = $('admin-list');
    adminList.innerHTML = '<div class="loading-spinner"></div>';
    modal.showModal();

    try {
      const data = await API.getPool('pending');
      if (!data.sources || data.sources.length === 0) {
        adminList.innerHTML = '<div class="empty-state"><p>没有待审核的源</p></div>';
        return;
      }

      adminList.innerHTML = data.sources.map(source => `
        <div class="admin-item" data-feed-id="${source.id}">
          <div class="pool-item-info">
            <div class="pool-item-title">${Feed.escapeHTML(source.title || source.url)}</div>
            <div class="pool-item-url">${Feed.escapeHTML(source.url)}</div>
            <div class="text-muted" style="font-size:var(--text-xs);margin-top:2px">提交者: ${Feed.escapeHTML(source.submitted_by || '未知')}</div>
          </div>
          <div class="admin-item-actions">
            <button class="btn btn-primary btn-sm admin-action-btn" data-feed-id="${source.id}" data-action="approve">✓ 通过</button>
            <button class="btn btn-danger btn-sm admin-action-btn" data-feed-id="${source.id}" data-action="reject">✗ 拒绝</button>
          </div>
        </div>
      `).join('');

    } catch (err) {
      adminList.innerHTML = `<div class="empty-state"><p>加载失败</p></div>`;
    }
  }

  $('admin-modal').addEventListener('click', async (e) => {
    const actionBtn = e.target.closest('.admin-action-btn');
    if (!actionBtn) return;

    const feedId = parseInt(actionBtn.dataset.feedId);
    const action = actionBtn.dataset.action;
    const item = actionBtn.closest('.admin-item');

    try {
      actionBtn.disabled = true;
      actionBtn.textContent = '处理中…';
      await API.reviewFeed(feedId, action);
      toast(action === 'approve' ? '已通过审核' : '已拒绝', 'success');
      item.remove();

      // Refresh admin count
      checkAdmin();
    } catch (err) {
      toast(err.message, 'error');
      actionBtn.disabled = false;
      actionBtn.textContent = action === 'approve' ? '✓ 通过' : '✗ 拒绝';
    }
  });

  $('admin-modal-close').addEventListener('click', () => $('admin-modal').close());

  // ============================================================
  // GUEST CONTENT
  // ============================================================
  async function loadGuestContent() {
    const guestLatest = $('guest-latest');
    const guestFavorites = $('guest-favorites');

    try {
      const data = await API.getExploreData();

      guestLatest.innerHTML = (data.latest || []).map(a => `
        <a class="guest-card" href="${Feed.escapeHTML(a.link || '#')}" target="_blank" rel="noopener">
          <div class="guest-card-title">${Feed.escapeHTML(a.title || '无标题')}</div>
          <div class="guest-card-meta">
            <span>${Feed.escapeHTML(a.source_title || '')}</span>
            <span>${Feed.formatRelativeTime(a.published_at)}</span>
          </div>
        </a>
      `).join('') || '<p class="text-muted">暂无内容</p>';

      guestFavorites.innerHTML = (data.favorites || []).map(a => `
        <a class="guest-card" href="${Feed.escapeHTML(a.link || '#')}" target="_blank" rel="noopener">
          <div class="guest-card-title">${Feed.escapeHTML(a.title || '无标题')}</div>
          <div class="guest-card-meta">
            <span>${Feed.escapeHTML(a.source_title || '')}</span>
            <span>${Feed.formatRelativeTime(a.published_at)}</span>
          </div>
        </a>
      `).join('') || '<p class="text-muted">暂无收藏</p>';

    } catch (err) {
      console.error('Guest content load failed:', err);
      guestLatest.innerHTML = '<p class="text-muted">加载失败，请稍后刷新</p>';
      guestFavorites.innerHTML = '<p class="text-muted">加载失败</p>';
    }
  }

  // ============================================================
  // LOGIN / LOGOUT BUTTONS
  // ============================================================
  $('btn-login').addEventListener('click', () => Auth.login());
  $('btn-logout').addEventListener('click', async () => {
    const confirmed = await confirm('确定要退出登录吗？');
    if (confirmed) Auth.logout();
  });

  // ============================================================
  // AUTH STATE LISTENER — check admin on login
  // ============================================================
  window.addEventListener('auth:login', () => {
    setTimeout(checkAdmin, 1000);
  });

  // ============================================================
  // RESPONSIVE RESIZE
  // ============================================================
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove('is-open');
      const overlay = document.querySelector('.sidebar-overlay');
      if (overlay) overlay.remove();
      mobileTabs.style.display = 'none';
      const readerPane = document.getElementById('reader-pane');
      readerPane.classList.remove('is-open');
    } else if (Auth.isLoggedIn()) {
      mobileTabs.style.display = 'flex';
    }
  });

  // ============================================================
  // INIT
  // ============================================================
  // Initially hide main and show guest landing
  appMain.style.display = 'none';
  guestLanding.style.display = 'block';

  // Initialize Clerk auth
  await Auth.init();
})();
