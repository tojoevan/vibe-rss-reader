/**
 * Search API
 * GET /api/search?q=keyword&page=1&pageSize=20 — search articles
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

  const q = url.searchParams.get('q');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20')));

  if (!q || q.trim() === '') {
    return new Response(JSON.stringify({
      articles: [],
      pagination: { page, pageSize, total: 0, totalPages: 0 }
    }), { headers: corsHeaders() });
  }

  const offset = (page - 1) * pageSize;
  const likeTerm = `%${q}%`;

  try {
    const query = `
      SELECT a.*, fs.title as source_title, fs.favicon_url,
             COALESCE(uas.is_read, 0) as is_read,
             COALESCE(uas.is_favorited, 0) as is_favorited,
             COALESCE(uas.is_read_later, 0) as is_read_later
      FROM articles a
      JOIN feed_sources fs ON a.feed_id = fs.id
      JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
      LEFT JOIN user_article_status uas ON a.id = uas.article_id AND uas.user_id = ?
      WHERE a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?
      ORDER BY a.published_at DESC
      LIMIT ? OFFSET ?
    `;
    const params = [userId, userId, likeTerm, likeTerm, likeTerm, pageSize, offset];

    const countQuery = `
      SELECT COUNT(*) as total
      FROM articles a
      JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
      WHERE a.title LIKE ? OR a.summary LIKE ? OR a.content LIKE ?
    `;
    const countParams = [userId, likeTerm, likeTerm, likeTerm];

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
