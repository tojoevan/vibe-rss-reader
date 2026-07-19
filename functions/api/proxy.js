/**
 * RSS Proxy API
 * GET /api/proxy?url=xxx — proxy fetch RSS feed XML with CORS headers
 * 
 * Also handles feed refresh with 3s throttle per source
 * and stores articles in D1.
 */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// Simple in-memory throttle (per isolate — sufficient for edge)
const lastFetchMap = new Map();
const THROTTLE_MS = 3000;

export async function onRequestGet(context) {
  const { request, data, env } = context;
  const userId = data.userId;
  const url = new URL(request.url);
  const feedUrl = url.searchParams.get('url');
  const feedId = url.searchParams.get('feedId');
  const refresh = url.searchParams.get('refresh') === 'true';

  if (!feedUrl) {
    return new Response(JSON.stringify({ error: '缺少 url 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }

  // Verify subscription access
  if (feedId) {
    const sub = await env.RSS_DB.prepare(
      'SELECT id FROM user_subscriptions WHERE user_id = ? AND feed_id = ?'
    ).bind(userId, feedId).first();

    if (!sub) {
      return new Response(JSON.stringify({ error: '未订阅此源' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }
  }

  // Throttle: 3s per feed source
  const now = Date.now();
  const lastFetch = lastFetchMap.get(feedUrl);
  
  if (refresh && lastFetch && (now - lastFetch) < THROTTLE_MS) {
    // Return cached — don't re-fetch yet, but still return existing articles
    if (feedId) {
      const articles = await env.RSS_DB.prepare(
        'SELECT * FROM articles WHERE feed_id = ? ORDER BY published_at DESC LIMIT 50'
      ).bind(feedId).all();

      return new Response(JSON.stringify({
        throttled: true,
        articles: articles.results,
        message: '刷新太频繁，请3秒后重试'
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    return new Response(JSON.stringify({ throttled: true, message: '刷新太频繁，请3秒后重试' }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }

  try {
    // Fetch RSS from external source
    const feedResponse = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'VibeRSS/1.0',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
      cf: { cacheTtl: 300 } // 5-minute edge cache
    });

    if (!feedResponse.ok) {
      return new Response(JSON.stringify({ error: `无法获取源: ${feedResponse.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }

    lastFetchMap.set(feedUrl, Date.now());
    const xml = await feedResponse.text();

    // If feedId provided, parse and store articles
    if (feedId && refresh) {
      try {
        await parseAndStoreArticles(env.RSS_DB, feedId, xml);
        // Update last_fetched_at
        await env.RSS_DB.prepare(
          "UPDATE feed_sources SET last_fetched_at = datetime('now') WHERE id = ?"
        ).bind(feedId).run();
      } catch (parseErr) {
        console.error('Parse error:', parseErr);
      }
    }

    // Return raw XML with CORS headers
    return new Response(xml, {
      headers: {
        'Content-Type': feedResponse.headers.get('Content-Type') || 'application/xml',
        ...corsHeaders(),
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: '代理请求失败: ' + err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() }
    });
  }
}

/**
 * Parse RSS/Atom XML and store articles into D1
 */
async function parseAndStoreArticles(db, feedId, xml) {
  // Use a simple regex-based parser since Workers don't have DOMParser
  const articles = [];

  // Try RSS 2.0 format
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    let rawDate = extractTag(item, 'pubDate') || extractTag(item, 'dc:date') || '';
    let isoDate = rawDate;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.valueOf())) isoDate = d.toISOString();
    }

    articles.push({
      title: extractTag(item, 'title'),
      link: extractTag(item, 'link'),
      guid: extractTag(item, 'guid') || extractTag(item, 'link') || `item-${articles.length}`,
      author: extractTag(item, 'dc:creator') || extractTag(item, 'author') || '',
      summary: extractTag(item, 'description') || '',
      content: extractTag(item, 'content:encoded') || extractTag(item, 'description') || '',
      published_at: isoDate,
    });
  }

  // Try Atom format if no RSS items found
  if (articles.length === 0) {
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1];
      const link = extractAtomLink(entry);
      
      let rawDate = extractTag(entry, 'published') || extractTag(entry, 'updated') || '';
      let isoDate = rawDate;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.valueOf())) isoDate = d.toISOString();
      }

      articles.push({
        title: extractTag(entry, 'title'),
        link,
        guid: extractTag(entry, 'id') || link || `entry-${articles.length}`,
        author: extractAtomAuthor(entry),
        summary: extractTag(entry, 'summary') || '',
        content: extractTag(entry, 'content') || extractTag(entry, 'summary') || '',
        published_at: isoDate,
      });
    }
  }

  if (articles.length === 0) return;

  // Batch insert (ignore duplicates)
  const batch = articles.map(a =>
    db.prepare(`
      INSERT OR IGNORE INTO articles (feed_id, guid, title, author, summary, content, link, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      feedId,
      a.guid.substring(0, 500),
      a.title.substring(0, 500),
      a.author.substring(0, 200),
      a.summary.substring(0, 2000),
      a.content.substring(0, 50000),
      a.link.substring(0, 1000),
      a.published_at
    )
  );

  await db.batch(batch);
}

function extractTag(xml, tag) {
  // Handle CDATA sections
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function extractAtomLink(entry) {
  // <link rel="alternate" href="..." />
  const altMatch = entry.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (altMatch) return altMatch[1];

  // <link href="..." />
  const hrefMatch = entry.match(/<link[^>]*href=["']([^"']+)["']/i);
  return hrefMatch ? hrefMatch[1] : '';
}

function extractAtomAuthor(entry) {
  const match = entry.match(/<author[\s>][\s\S]*?<name>([^<]+)<\/name>/i);
  return match ? match[1].trim() : '';
}
