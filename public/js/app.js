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
    
    // Use popover API to push toast container above native <dialog> if supported
    try {
      if (container.showPopover && !container.matches(':popover-open')) {
        container.showPopover();
      }
    } catch(e) {}

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
  // THEME MANAGEMENT
  // ============================================================
  const themeToggleBtn = $('theme-toggle');
  const iconSun = themeToggleBtn.querySelector('.icon-sun');
  const iconMoon = themeToggleBtn.querySelector('.icon-moon');

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      iconSun.style.display = 'block';
      iconMoon.style.display = 'none';
    } else {
      document.documentElement.removeAttribute('data-theme');
      iconSun.style.display = 'none';
      iconMoon.style.display = 'block';
    }
  }

  // Initialize theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  });

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
      <div class="feed-item ${state.currentFeedId === 'all' ? 'active' : ''}" data-feed="all" id="feed-all">
        <span class="feed-icon">📰</span>
        <span class="feed-name">全部文章</span>
        <button class="feed-refresh" title="刷新文章" aria-label="刷新">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M14.5 9a5.5 5.5 0 11-1.6-3.9M14.5 3v2.1h-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    `;

    state.subscriptions.forEach(sub => {
      const li = document.createElement('div');
      li.className = `feed-item ${state.currentFeedId == sub.feed_id ? 'active' : ''}`;
      li.dataset.feed = sub.feed_id;
      li.dataset.subId = sub.id;

      const iconContent = sub.favicon_url
        ? `<img src="${Feed.escapeHTML(sub.favicon_url)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${(sub.title || '?')[0].toUpperCase()}'"/>`
        : (sub.title || sub.url || '?')[0].toUpperCase();

      li.innerHTML = `
        <span class="feed-icon">${iconContent}</span>
        <span class="feed-name" title="${Feed.escapeHTML(sub.url)}">${Feed.escapeHTML(sub.title || sub.url)}</span>
        <button class="feed-refresh" title="刷新" aria-label="刷新">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M14.5 9a5.5 5.5 0 11-1.6-3.9M14.5 3v2.1h-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="feed-remove" title="取消订阅" aria-label="取消订阅">
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      `;
      feedList.appendChild(li);
    });
  }

  // --- Add Feed ---
  $('btn-add-feed').addEventListener('click', () => {
    const modal = $('add-feed-modal');
    modal.showModal();
    $('feed-url-input').focus();
  });

  $('btn-cancel-feed').addEventListener('click', () => {
    $('add-feed-modal').close();
    $('feed-url-input').value = '';
    $('feed-form-hint').textContent = '';
  });

  if ($('add-feed-modal-close')) {
    $('add-feed-modal-close').addEventListener('click', () => {
      $('add-feed-modal').close();
      $('feed-url-input').value = '';
      $('feed-form-hint').textContent = '';
    });
  }

  $('add-feed-modal').addEventListener('click', (e) => {
    if (e.target === $('add-feed-modal')) {
      $('add-feed-modal').close();
      $('feed-url-input').value = '';
      $('feed-form-hint').textContent = '';
    }
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
      $('feed-url-input').value = '';
      $('feed-form-hint').textContent = '';
      $('add-feed-modal').close();
      toast(result.message || '订阅已添加', 'success');
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

  // --- OPML Import ---
  if ($('btn-import-opml')) {
    $('btn-import-opml').addEventListener('click', () => {
      $('opml-file-input').click();
    });

    $('opml-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const hint = $('feed-form-hint');
      hint.textContent = '正在读取文件...';
      hint.style.color = 'var(--text-muted)';
      const btnImport = $('btn-import-opml');
      btnImport.disabled = true;

      try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');
        const outlines = xmlDoc.querySelectorAll('outline[xmlUrl]');
        
        const urls = [];
        outlines.forEach(o => {
          const url = o.getAttribute('xmlUrl');
          if (url) urls.push(url);
        });

        if (urls.length === 0) {
          hint.textContent = '未能从文件中找到有效的 RSS 订阅链接';
          hint.style.color = 'var(--danger)';
          btnImport.disabled = false;
          return;
        }

        hint.textContent = `发现 ${urls.length} 个订阅源，正在导入中...`;
        
        let successCount = 0;
        
        for (let i = 0; i < urls.length; i++) {
          try {
            await API.addSubscription(urls[i]);
            successCount++;
          } catch (err) {
            // Soft ignore errors like already subscribed
          }
          hint.textContent = `正在导入: ${i + 1} / ${urls.length}`;
        }

        $('opml-file-input').value = '';
        $('feed-url-input').value = '';
        $('feed-form-hint').textContent = '';
        $('add-feed-modal').close();
        toast(`导入完成：成功提交 ${successCount} 个，忽略/已存在 ${urls.length - successCount} 个`, 'info');
        await loadSubscriptions();
      } catch (err) {
        hint.textContent = '解析 OPML 文件失败';
        hint.style.color = 'var(--danger)';
        console.error(err);
      }
      btnImport.disabled = false;
    });
  }

  // --- Feed List Click ---
  feedList.addEventListener('click', async (e) => {
    const refreshBtn = e.target.closest('.feed-refresh');
    if (refreshBtn) {
      e.stopPropagation();
      const li = refreshBtn.closest('.feed-item');
      if (li) {
        const feedId = li.dataset.feed;
        refreshBtn.classList.add('is-spinning');
        
        // Trigger proxy refresh if it's a specific feed
        if (feedId !== 'all') {
          const sub = state.subscriptions.find(s => s.feed_id == feedId);
          if (sub) {
            try {
              await API.proxyFeed(sub.url, sub.feed_id, true);
            } catch (err) {
              console.error('Refresh proxy failed:', err);
            }
          }
        }
        
        // Ensure this feed is active if clicked refresh, or just refresh data?
        // Let's just switch to it and refresh
        if (state.currentFeedId !== feedId) {
          state.currentFeedId = feedId;
          updateActiveFeedItem();
        }
        
        Store.invalidateArticles();
        await loadArticles(true);
        refreshBtn.classList.remove('is-spinning');
        toast('已刷新', 'success');
      }
      return;
    }

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
      if (feedColumnTitle) feedColumnTitle.textContent = feedName;

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
        
        // Auto-select first article on PC
        if (window.innerWidth > 768 && cached.articles.length > 0) {
          const firstRow = articleList.querySelector('.article-row');
          if (firstRow) firstRow.click();
        }
        
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

      // Auto-select first article on PC
      if (window.innerWidth > 768 && data.articles && data.articles.length > 0) {
        const firstRow = articleList.querySelector('.article-row');
        if (firstRow) firstRow.click();
      }

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
    if (state.currentTab === 'latest' && state.articles && state.articles.length > 0) {
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
          if (row) {
            row.classList.toggle('is-read', !!result.is_read);
            if (state.currentTab === 'latest' && !!result.is_read) {
              row.classList.add('is-hiding');
              setTimeout(() => row.remove(), 300);
            }
          }
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

  // --- Mark All Read ---
  $('btn-mark-all-read').addEventListener('click', async () => {
    try {
      if (!state.articles || state.articles.length === 0) return;
      const articleIds = state.articles.map(a => a.id);
      await API.markAllRead(articleIds);
      toast('本页已全部标记为已读', 'success');
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

    const pcCategories = document.getElementById('pc-categories');
    if (pcCategories) {
      pcCategories.querySelectorAll('.feed-item').forEach(li => {
        li.classList.toggle('active', li.dataset.tab === state.currentTab);
      });
      const activePcTab = pcCategories.querySelector(`.feed-item[data-tab="${state.currentTab}"]`);
      if (activePcTab) {
        if (feedColumnTitle) feedColumnTitle.textContent = activePcTab.querySelector('.feed-name')?.textContent || '最新资讯';
      }
    }

    // Clear feed selection
    const feedList = document.getElementById('feed-list');
    if (feedList) {
      feedList.querySelectorAll('.feed-item').forEach(li => li.classList.remove('active'));
    }

    Store.invalidateArticles();
    loadArticles();
    updateMarkAllReadVisibility();
  });

  // ============================================================
  // PC TABS (Categories)
  // ============================================================
  const pcCategories = document.getElementById('pc-categories');
  if (pcCategories) {
    pcCategories.addEventListener('click', (e) => {
      const item = e.target.closest('.feed-item');
      if (!item) return;

      state.currentTab = item.dataset.tab;
      state.currentPage = 1;
      
      // Update UI for PC categories
      pcCategories.querySelectorAll('.feed-item').forEach(li => li.classList.remove('active'));
      item.classList.add('active');

      // Update mobile tabs to match
      mobileTabs.querySelectorAll('.tab-btn').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === state.currentTab);
      });

      // Clear feed selection
      const feedList = document.getElementById('feed-list');
      if (feedList) {
        feedList.querySelectorAll('.feed-item').forEach(li => li.classList.remove('active'));
      }
      
      const titleName = item.querySelector('.feed-name')?.textContent || '最新资讯';
      if (feedColumnTitle) feedColumnTitle.textContent = titleName;

      if (window.innerWidth <= 768) {
        closeSidebar();
      }

      Store.invalidateArticles();
      loadArticles(true);
      updateMarkAllReadVisibility();
    });
  }


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
    // Create overlay inside app-main so it shares stacking context with sidebar
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      overlay.addEventListener('click', closeSidebar);
      appMain.appendChild(overlay);
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
  let poolCurrentPage = 1;
  const poolPageSize = 20;

  async function loadPoolPage(page) {
    const poolListEl = $('pool-list');
    const paginationEl = $('pool-pagination');
    poolCurrentPage = page;

    poolListEl.innerHTML = '<div class="loading-spinner"></div>';
    if (paginationEl) paginationEl.style.display = 'none';

    try {
      const data = await API.getPool('approved', poolCurrentPage, poolPageSize);
      if (!data.sources || data.sources.length === 0) {
        poolListEl.innerHTML = '<div class="empty-state"><p>暂无可用资源</p></div>';
        return;
      }

      poolListEl.innerHTML = data.sources.map(source => {
        const isSub = state.subscriptions.some(s => s.url === source.url || s.feed_id === source.id);
        const btnText = isSub ? '已订阅' : '订阅';
        const btnDisabled = isSub ? 'disabled' : '';
        return `
        <div class="pool-item" data-source-id="${source.id}">
          <div class="pool-item-info">
            <div class="pool-item-title">${Feed.escapeHTML(source.title || source.url)}</div>
            <div class="pool-item-url">${Feed.escapeHTML(source.url)}</div>
          </div>
          <button class="btn btn-primary btn-sm pool-subscribe-btn" data-url="${Feed.escapeHTML(source.url)}" ${btnDisabled}>${btnText}</button>
        </div>
      `}).join('');

      // Render pagination
      if (data.pagination && paginationEl) {
        const { totalPages } = data.pagination;
        paginationEl.style.display = 'flex';
        paginationEl.className = 'pagination'; 
        paginationEl.style.justifyContent = 'center';
        paginationEl.innerHTML = `
          <button class="btn btn-ghost" id="pool-prev-page" ${poolCurrentPage <= 1 ? 'disabled' : ''}>上一页</button>
          <span class="page-info" style="margin: 0 var(--space-md);">${poolCurrentPage} / ${Math.max(1, totalPages)}</span>
          <button class="btn btn-ghost" id="pool-next-page" ${poolCurrentPage >= totalPages ? 'disabled' : ''}>下一页</button>
          <div style="display:flex; align-items:center; margin-left: var(--space-md); gap: 4px; white-space: nowrap;">
            <span style="font-size:var(--text-sm);">跳转到</span>
            <input type="number" id="pool-jump-input" class="pagination-input" min="1" max="${Math.max(1, totalPages)}" value="${poolCurrentPage}">
            <button class="btn btn-ghost" id="pool-jump-btn">Go</button>
          </div>
        `;

        const prevBtn = $('pool-prev-page');
        const nextBtn = $('pool-next-page');
        const jumpBtn = $('pool-jump-btn');
        const jumpInput = $('pool-jump-input');

        if (prevBtn) prevBtn.addEventListener('click', () => loadPoolPage(poolCurrentPage - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => loadPoolPage(poolCurrentPage + 1));
        if (jumpBtn) {
          jumpBtn.addEventListener('click', () => {
            let p = parseInt(jumpInput.value, 10);
            if (p >= 1 && p <= totalPages) loadPoolPage(p);
          });
        }
      } else if (paginationEl) {
        paginationEl.style.display = 'none';
      }

    } catch (err) {
      poolListEl.innerHTML = `<div class="empty-state"><p>加载失败: ${Feed.escapeHTML(err.message)}</p></div>`;
    }
  }

  $('btn-explore-pool').addEventListener('click', () => {
    const modal = $('pool-modal');
    modal.showModal();
    loadPoolPage(1);
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
      if (data.sources) {
        showAdminButton(data.sources);
      }
    } catch {
      // Not admin — silently ignore
    }
  }

  function showAdminButton(pendingSources) {
    let adminBtn = document.getElementById('btn-admin');
    if (adminBtn) {
      adminBtn.style.display = 'block';
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

      const sortedLatest = (data.latest || []).sort((a, b) => {
        const da = new Date(a.published_at).getTime() || 0;
        const db = new Date(b.published_at).getTime() || 0;
        return db - da;
      });

      guestLatest.innerHTML = sortedLatest.map(a => `
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
  // USER DROPDOWN & MENU EVENTS
  // ============================================================
  $('btn-admin').addEventListener('click', () => {
    openAdminPanel();
    $('user-dropdown').style.display = 'none';
  });

  $('user-name').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = $('user-dropdown');
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  });

  document.addEventListener('click', () => {
    const menu = $('user-dropdown');
    if (menu) menu.style.display = 'none';
  });

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
