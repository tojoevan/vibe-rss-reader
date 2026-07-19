/**
 * Feeds API
 * GET /api/feeds?feedId=xxx&page=1&pageSize=20 — get articles for a feed
 * GET /api/feeds?all=true&page=1               — get all subscribed feed articles
 */

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { request, data, env } = context;
  const userId = data.userId;
  const url = new URL(request.url);

  const feedId = url.searchParams.get('feedId');
  const all = url.searchParams.get('all') === 'true';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));
  const tab = url.searchParams.get('tab') || 'latest'; // latest | read | later | favorites

  const offset = (page - 1) * pageSize;

  try {
    let query = '';
    let countQuery = '';
    let params = [];
    let countParams = [];

    if (tab === 'read') {
      // Get read articles
      query = `
        SELECT a.*, fs.title as source_title, fs.favicon_url,
               uas.is_read, uas.is_favorited, uas.is_read_later
        FROM articles a
        JOIN feed_sources fs ON a.feed_id = fs.id
        JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
        JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ? AND uas.is_read = 1
        ${feedId ? 'AND a.feed_id = ?' : ''}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `;
      params = feedId ? [userId, userId, feedId, pageSize, offset] : [userId, userId, pageSize, offset];
      
      countQuery = `
        SELECT COUNT(*) as total
        FROM articles a
        JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
        JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ? AND uas.is_read = 1
        ${feedId ? 'AND a.feed_id = ?' : ''}
      `;
      countParams = feedId ? [userId, userId, feedId] : [userId, userId];
    } else if (tab === 'later') {
      query = `
        SELECT a.*, fs.title as source_title, fs.favicon_url,
               uas.is_read, uas.is_favorited, uas.is_read_later
        FROM articles a
        JOIN feed_sources fs ON a.feed_id = fs.id
        JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
        JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ? AND uas.is_read_later = 1
        ${feedId ? 'AND a.feed_id = ?' : ''}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `;
      params = feedId ? [userId, userId, feedId, pageSize, offset] : [userId, userId, pageSize, offset];

      countQuery = `
        SELECT COUNT(*) as total
        FROM articles a
        JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
        JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ? AND uas.is_read_later = 1
        ${feedId ? 'AND a.feed_id = ?' : ''}
      `;
      countParams = feedId ? [userId, userId, feedId] : [userId, userId];
    } else if (tab === 'favorites') {
      query = `
        SELECT a.*, fs.title as source_title, fs.favicon_url,
               uas.is_read, uas.is_favorited, uas.is_read_later
        FROM articles a
        JOIN feed_sources fs ON a.feed_id = fs.id
        JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
        JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ? AND uas.is_favorited = 1
        ${feedId ? 'AND a.feed_id = ?' : ''}
        ORDER BY a.published_at DESC
        LIMIT ? OFFSET ?
      `;
      params = feedId ? [userId, userId, feedId, pageSize, offset] : [userId, userId, pageSize, offset];

      countQuery = `
        SELECT COUNT(*) as total
        FROM articles a
        JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
        JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ? AND uas.is_favorited = 1
        ${feedId ? 'AND a.feed_id = ?' : ''}
      `;
      countParams = feedId ? [userId, userId, feedId] : [userId, userId];
    } else {
      // latest — show all unread (or all if feedId)
      if (feedId) {
        query = `
          SELECT a.*, fs.title as source_title, fs.favicon_url,
                 COALESCE(uas.is_read, 0) as is_read,
                 COALESCE(uas.is_favorited, 0) as is_favorited,
                 COALESCE(uas.is_read_later, 0) as is_read_later
          FROM articles a
          JOIN feed_sources fs ON a.feed_id = fs.id
          JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
          LEFT JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ?
          WHERE a.feed_id = ? AND COALESCE(uas.is_read, 0) = 0
          ORDER BY a.published_at DESC
          LIMIT ? OFFSET ?
        `;
        params = [userId, userId, feedId, pageSize, offset];

        countQuery = `
          SELECT COUNT(*) as total
          FROM articles a
          JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
          LEFT JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ?
          WHERE a.feed_id = ? AND COALESCE(uas.is_read, 0) = 0
        `;
        countParams = [userId, userId, feedId];
      } else {
        query = `
          SELECT a.*, fs.title as source_title, fs.favicon_url,
                 COALESCE(uas.is_read, 0) as is_read,
                 COALESCE(uas.is_favorited, 0) as is_favorited,
                 COALESCE(uas.is_read_later, 0) as is_read_later
          FROM articles a
          JOIN feed_sources fs ON a.feed_id = fs.id
          JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
          LEFT JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ?
          WHERE COALESCE(uas.is_read, 0) = 0
          ORDER BY a.published_at DESC
          LIMIT ? OFFSET ?
        `;
        params = [userId, userId, pageSize, offset];

        countQuery = `
          SELECT COUNT(*) as total
          FROM articles a
          JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
          LEFT JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ?
          WHERE COALESCE(uas.is_read, 0) = 0
        `;
        countParams = [userId, userId];
      }
    }

    const stmt = env.RSS_DB.prepare(query);
    const result = await stmt.bind(...params).all();

    const countStmt = env.RSS_DB.prepare(countQuery);
    const countResult = await countStmt.bind(...countParams).first();
    const total = countResult?.total || 0;

    return new Response(JSON.stringify({
      articles: result.results,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }), { headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}
