/**
 * Articles API
 * PUT  /api/articles — update article status (read/fav/later)
 * POST /api/articles/mark-all-read — mark all as read for a feed
 */

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// PUT — update single article status
export async function onRequestPut(context) {
  const { request, data, env } = context;
  const userId = data.userId;

  try {
    const body = await request.json();
    const { articleId, action } = body;

    if (!articleId || !action) {
      return new Response(JSON.stringify({ error: '缺少参数' }), {
        status: 400, headers: corsHeaders()
      });
    }

    // Verify user has access to this article via subscription
    const access = await env.RSS_DB.prepare(`
      SELECT a.id FROM articles a
      JOIN user_subscriptions us ON a.feed_id = us.feed_id AND us.user_id = ?
      WHERE a.id = ?
    `).bind(userId, articleId).first();

    if (!access) {
      return new Response(JSON.stringify({ error: '无权操作此文章' }), {
        status: 403, headers: corsHeaders()
      });
    }

    // Upsert status
    let field = '';
    let newValue = null;

    switch (action) {
      case 'read':
        field = 'is_read';
        break;
      case 'unread':
        field = 'is_read';
        newValue = 0;
        break;
      case 'fav':
        field = 'is_favorited';
        break;
      case 'unfav':
        field = 'is_favorited';
        newValue = 0;
        break;
      case 'later':
        field = 'is_read_later';
        break;
      case 'unlater':
        field = 'is_read_later';
        newValue = 0;
        break;
      default:
        return new Response(JSON.stringify({ error: '无效操作' }), {
          status: 400, headers: corsHeaders()
        });
    }

    // Check existing status
    const existing = await env.RSS_DB.prepare(
      'SELECT * FROM user_article_status WHERE user_id = ? AND article_id = ?'
    ).bind(userId, articleId).first();

    if (newValue === null) {
      // Toggle: if exists and is 1, set to 0; else set to 1
      newValue = existing && existing[field] === 1 ? 0 : 1;
    }

    if (existing) {
      await env.RSS_DB.prepare(
        `UPDATE user_article_status SET ${field} = ?, updated_at = datetime('now') WHERE user_id = ? AND article_id = ?`
      ).bind(newValue, userId, articleId).run();
    } else {
      const values = { is_read: 0, is_favorited: 0, is_read_later: 0 };
      values[field] = newValue;
      await env.RSS_DB.prepare(
        `INSERT INTO user_article_status (user_id, article_id, is_read, is_favorited, is_read_later) VALUES (?, ?, ?, ?, ?)`
      ).bind(userId, articleId, values.is_read, values.is_favorited, values.is_read_later).run();
    }

    return new Response(JSON.stringify({
      success: true,
      [field]: newValue
    }), { headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}

// POST — mark all read
export async function onRequestPost(context) {
  const { request, data, env } = context;
  const userId = data.userId;

  try {
    const body = await request.json();
    const { articleIds } = body; 

    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return new Response(JSON.stringify({ error: 'No article IDs provided' }), { status: 400, headers: corsHeaders() });
    }

    // Batch upsert all as read
    const batch = [];
    for (const id of articleIds) {
      batch.push(
        env.RSS_DB.prepare(`
          INSERT INTO user_article_status (user_id, article_id, is_read) VALUES (?, ?, 1)
          ON CONFLICT(user_id, article_id) DO UPDATE SET is_read = 1, updated_at = datetime('now')
        `).bind(userId, id)
      );
    }

    if (batch.length > 0) {
      // D1 supports batch operations
      await env.RSS_DB.batch(batch);
    }

    return new Response(JSON.stringify({
      success: true,
      count: batch.length
    }), { headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}
