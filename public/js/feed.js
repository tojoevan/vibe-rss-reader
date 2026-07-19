/**
 * Feed — RSS/Atom XML parser (client-side)
 * Uses DOMParser to parse RSS 2.0 and Atom feeds
 */
window.Feed = (() => {

  /**
   * Parse RSS/Atom XML string into normalized article array
   */
  function parseXML(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'application/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML 解析失败');
    }

    // Detect format
    const rssChannel = doc.querySelector('channel');
    const atomFeed = doc.querySelector('feed');

    if (rssChannel) {
      return parseRSS(doc);
    } else if (atomFeed) {
      return parseAtom(doc);
    }

    throw new Error('未知的 RSS 格式');
  }

  function parseRSS(doc) {
    const channel = doc.querySelector('channel');
    const items = doc.querySelectorAll('item');

    const feedMeta = {
      title: getTextContent(channel, 'title'),
      link: getTextContent(channel, 'link'),
      description: getTextContent(channel, 'description'),
    };

    const articles = Array.from(items).map(item => ({
      title: getTextContent(item, 'title') || '无标题',
      link: getTextContent(item, 'link'),
      guid: getTextContent(item, 'guid') || getTextContent(item, 'link'),
      author: getTextContent(item, 'dc\\:creator') || getTextContent(item, 'author'),
      summary: stripHTML(getTextContent(item, 'description')),
      content: getTextContent(item, 'content\\:encoded') || getTextContent(item, 'description'),
      publishedAt: getTextContent(item, 'pubDate') || getTextContent(item, 'dc\\:date'),
    }));

    return { feedMeta, articles };
  }

  function parseAtom(doc) {
    const feed = doc.querySelector('feed');
    const entries = doc.querySelectorAll('entry');

    const feedMeta = {
      title: getTextContent(feed, 'title'),
      link: getAtomLink(feed),
      description: getTextContent(feed, 'subtitle'),
    };

    const articles = Array.from(entries).map(entry => ({
      title: getTextContent(entry, 'title') || '无标题',
      link: getAtomLink(entry),
      guid: getTextContent(entry, 'id') || getAtomLink(entry),
      author: getAtomAuthor(entry),
      summary: stripHTML(getTextContent(entry, 'summary')),
      content: getTextContent(entry, 'content') || getTextContent(entry, 'summary'),
      publishedAt: getTextContent(entry, 'published') || getTextContent(entry, 'updated'),
    }));

    return { feedMeta, articles };
  }

  function getTextContent(parent, selector) {
    if (!parent) return '';
    const el = parent.querySelector(selector);
    return el ? (el.textContent || '').trim() : '';
  }

  function getAtomLink(el) {
    if (!el) return '';
    const altLink = el.querySelector('link[rel="alternate"]');
    if (altLink) return altLink.getAttribute('href') || '';
    const link = el.querySelector('link');
    return link ? (link.getAttribute('href') || '') : '';
  }

  function getAtomAuthor(entry) {
    const author = entry.querySelector('author name');
    return author ? author.textContent.trim() : '';
  }

  /**
   * Strip HTML tags for plain text summary
   */
  function stripHTML(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Format date to relative time
   */
  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;

    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  /**
   * Generate a favicon-style letter icon for a feed
   */
  function getFeedIcon(title, faviconUrl) {
    if (faviconUrl) {
      return `<img src="${escapeHTML(faviconUrl)}" alt="" loading="lazy" onerror="this.parentElement.textContent='${(title || '?')[0].toUpperCase()}'">`;
    }
    return (title || '?')[0].toUpperCase();
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { parseXML, formatRelativeTime, getFeedIcon, stripHTML, escapeHTML };
})();
