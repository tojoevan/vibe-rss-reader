/**
 * Reader — Article rendering and interaction module
 */
window.Reader = (() => {
  let activeArticleId = null;

  /**
   * Render an article in the reader pane
   */
  function showArticle(article) {
    activeArticleId = article.id;
    const readerEmpty = document.getElementById('reader-empty');
    const readerContent = document.getElementById('reader-content');
    const readerTitle = document.getElementById('reader-title');
    const readerAuthor = document.getElementById('reader-author');
    const readerDate = document.getElementById('reader-date');
    const readerLink = document.getElementById('reader-link');
    const readerBody = document.getElementById('reader-body');
    const readerPane = document.getElementById('reader-pane');

    readerEmpty.style.display = 'none';
    readerContent.style.display = 'block';

    readerTitle.textContent = article.title || '无标题';
    readerAuthor.textContent = article.author || article.source_title || '';
    readerDate.textContent = Feed.formatRelativeTime(article.published_at || article.publishedAt);
    readerLink.href = article.link || '#';

    // Render content (sanitize HTML)
    const content = article.content || article.summary || '';
    readerBody.innerHTML = sanitizeHTML(content);

    // Update action button states
    updateActionStates(article);

    // Mobile: open reader pane
    if (window.innerWidth <= 768) {
      readerPane.classList.add('is-open');
      // Add back button if not present
      if (!readerContent.querySelector('.reader-back-btn')) {
        const backBtn = document.createElement('button');
        backBtn.className = 'reader-back-btn';
        backBtn.innerHTML = '← 返回列表';
        backBtn.addEventListener('click', closeReader);
        readerContent.insertBefore(backBtn, readerContent.firstChild);
      }
    }

    // Scroll to top
    readerPane.scrollTop = 0;

    // Cache the article
    Store.setArticle(article.id, article);

    // Auto-mark as read logic has been removed as requested.
  }

  function closeReader() {
    const readerPane = document.getElementById('reader-pane');
    readerPane.classList.remove('is-open');
  }

  function updateActionStates(article) {
    const readBtn = document.getElementById('action-read');
    const laterBtn = document.getElementById('action-later');
    const favBtn = document.getElementById('action-fav');

    readBtn.classList.toggle('is-active', !!article.is_read);
    laterBtn.classList.toggle('is-active', !!article.is_read_later);
    favBtn.classList.toggle('is-active', !!article.is_favorited);
  }

  /**
   * Basic HTML sanitization — remove dangerous tags/attrs
   */
  function sanitizeHTML(html) {
    if (!html) return '<p class="text-muted">暂无内容</p>';

    const tmp = document.createElement('div');
    tmp.innerHTML = html;

    // Remove dangerous elements
    const dangerous = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'];
    dangerous.forEach(tag => {
      tmp.querySelectorAll(tag).forEach(el => el.remove());
    });

    // Remove event handlers
    tmp.querySelectorAll('*').forEach(el => {
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || attr.name === 'srcdoc') {
          el.removeAttribute(attr.name);
        }
      });
      // Ensure links open in new tab
      if (el.tagName === 'A') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    });

    return tmp.innerHTML;
  }

  /**
   * Render article list in the feed column
   */
  function renderArticleList(articles, container) {
    if (!articles || articles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>暂无文章</p>
          <p class="text-muted">试试刷新或添加新的 RSS 订阅</p>
        </div>
      `;
      return;
    }

    container.innerHTML = articles.map(article => {
      const favicon = article.favicon_url
        ? `<img src="${Feed.escapeHTML(article.favicon_url)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${(article.source_title || '?')[0].toUpperCase()}'"/>`
        : (article.source_title || '?')[0].toUpperCase();

      const isRead = article.is_read ? 'is-read' : '';
      const isActive = article.id === activeArticleId ? 'active' : '';

      return `
        <div class="article-row ${isRead} ${isActive}" data-id="${article.id}">
          <div class="article-row-favicon">${favicon}</div>
          <div class="article-row-body">
            <div class="article-row-title">${Feed.escapeHTML(article.title || '无标题')}</div>
            <div class="article-row-meta">
              <span class="article-row-source">${Feed.escapeHTML(article.source_title || '')}</span>
              <span class="article-row-time">${Feed.formatRelativeTime(article.published_at)}</span>
              <div class="article-row-actions">
                <button class="row-action-btn ${article.is_read ? 'is-active' : ''}" data-action="read" data-article-id="${article.id}" title="标记已读">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="row-action-btn ${article.is_read_later ? 'is-active' : ''}" data-action="later" data-article-id="${article.id}" title="稍后阅读">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
                <button class="row-action-btn ${article.is_favorited ? 'is-active' : ''}" data-action="fav" data-article-id="${article.id}" title="收藏">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.8 3.6L14 6.3l-3 2.9.7 4.1L8 11.4 4.3 13.3l.7-4.1-3-2.9 4.2-.7z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
                </button>
                <button class="row-action-btn" data-action="share" data-article-id="${article.id}" title="转发">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 9v4h8V9M8 2v8M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Show loading skeleton
   */
  function showSkeleton(container, count = 5) {
    container.innerHTML = Array(count).fill('<div class="skeleton skeleton-row"></div>').join('');
  }

  /**
   * Render pagination
   */
  function renderPagination(pagination) {
    const paginationEl = document.getElementById('pagination');
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');

    if (!pagination || pagination.totalPages <= 1) {
      paginationEl.style.display = 'none';
      return;
    }

    paginationEl.style.display = 'flex';
    pageInfo.textContent = `${pagination.page} / ${pagination.totalPages}`;
    prevBtn.disabled = pagination.page <= 1;
    nextBtn.disabled = pagination.page >= pagination.totalPages;
  }

  function getActiveArticleId() {
    return activeArticleId;
  }

  return {
    showArticle,
    closeReader,
    renderArticleList,
    showSkeleton,
    renderPagination,
    getActiveArticleId,
    sanitizeHTML,
  };
})();
