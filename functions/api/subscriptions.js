/**
 * Subscriptions API
 * GET    /api/subscriptions        — list user subscriptions
 * POST   /api/subscriptions        — add subscription
 * DELETE /api/subscriptions?id=xxx — remove subscription
 */

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET — list subscriptions
export async function onRequestGet(context) {
  const { data, env } = context;
  const userId = data.userId;

  await ensureDeletedAtColumn(env);

  try {
    const result = await env.RSS_DB.prepare(`
      SELECT us.id, us.feed_id, us.category, us.created_at,
             fs.url, fs.title, fs.description, fs.favicon_url, fs.site_url
      FROM user_subscriptions us
      JOIN feed_sources fs ON us.feed_id = fs.id
      WHERE us.user_id = ? AND fs.status = 'approved' AND us.deleted_at IS NULL
      ORDER BY us.created_at DESC
    `).bind(userId).all();

    return new Response(JSON.stringify({ subscriptions: result.results }), {
      headers: corsHeaders()
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders()
    });
  }
}

// POST — add subscription
export async function onRequestPost(context) {
  const { request, data, env } = context;
  const userId = data.userId;

  await ensureDeletedAtColumn(env);

  try {
    const body = await request.json();
    const { url } = body;

    if (!url || !url.trim()) {
      return new Response(JSON.stringify({ error: '请输入订阅链接' }), {
        status: 400, headers: corsHeaders()
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: 'URL 格式无效' }), {
        status: 400, headers: corsHeaders()
      });
    }

    const trimmedUrl = url.trim();

    // Check if feed source already exists
    let source = await env.RSS_DB.prepare(
      'SELECT id, status FROM feed_sources WHERE url = ?'
    ).bind(trimmedUrl).first();

    if (!source) {
      // Add new feed source to the pool (pending review)
      const insertResult = await env.RSS_DB.prepare(
        'INSERT INTO feed_sources (url, submitted_by, status) VALUES (?, ?, ?)'
      ).bind(trimmedUrl, userId, 'pending').run();

      source = { id: insertResult.meta.last_row_id, status: 'pending' };
    }

    // Check if user already subscribed
    const existing = await env.RSS_DB.prepare(
      'SELECT id, deleted_at FROM user_subscriptions WHERE user_id = ? AND feed_id = ?'
    ).bind(userId, source.id).first();

    if (existing) {
      if (existing.deleted_at) {
        // Soft deleted, restore it
        await env.RSS_DB.prepare(
          'UPDATE user_subscriptions SET deleted_at = NULL, category = ? WHERE id = ?'
        ).bind(body.category || '', existing.id).run();
        
        return new Response(JSON.stringify({
          success: true,
          feedId: source.id,
          status: source.status,
          message: source.status === 'pending' ? '订阅已恢复，等待审核' : '恢复订阅成功'
        }), { status: 200, headers: corsHeaders() });
      }

      return new Response(JSON.stringify({ error: '已经订阅过此源' }), {
        status: 409, headers: corsHeaders()
      });
    }

    // Create user subscription
    await env.RSS_DB.prepare(
      'INSERT INTO user_subscriptions (user_id, feed_id, category) VALUES (?, ?, ?)'
    ).bind(userId, source.id, body.category || '').run();

    return new Response(JSON.stringify({
      success: true,
      feedId: source.id,
      status: source.status,
      message: source.status === 'pending' ? '订阅已提交，等待管理员审核' : '订阅成功'
    }), { status: 201, headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}

// DELETE — remove subscription
export async function onRequestDelete(context) {
  const { request, data, env } = context;
  const userId = data.userId;
  
  await ensureDeletedAtColumn(env);

  const url = new URL(request.url);
  const subId = url.searchParams.get('id');

  if (!subId) {
    return new Response(JSON.stringify({ error: '缺少订阅 ID' }), {
      status: 400, headers: corsHeaders()
    });
  }

  try {
    // Only delete user's own subscription (soft delete)
    const result = await env.RSS_DB.prepare(
      "UPDATE user_subscriptions SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?"
    ).bind(subId, userId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: '订阅不存在' }), {
        status: 404, headers: corsHeaders()
      });
    }

    // Cleanup hard delete older than 30 mins (best effort)
    try {
      await env.RSS_DB.prepare(
        "DELETE FROM user_subscriptions WHERE deleted_at < datetime('now', '-30 minutes')"
      ).run();
    } catch (e) {
      console.error('Failed to cleanup old subscriptions:', e);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: corsHeaders()
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}

async function ensureDeletedAtColumn(env) {
  try {
    await env.RSS_DB.prepare('SELECT deleted_at FROM user_subscriptions LIMIT 1').first();
  } catch (e) {
    if (e.message && (e.message.includes('no such column') || e.message.includes('not found'))) {
      try {
        await env.RSS_DB.prepare('ALTER TABLE user_subscriptions ADD COLUMN deleted_at TEXT DEFAULT NULL').run();
      } catch (alterErr) {
        console.error('Failed to add deleted_at column:', alterErr);
      }
    }
  }
}
