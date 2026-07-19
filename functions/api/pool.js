/**
 * Resource Pool API
 * GET  /api/pool            — list approved sources (or all for admin)
 * POST /api/pool/review     — admin review: approve/reject
 */

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// GET — list pool sources
export async function onRequestGet(context) {
  const { request, data, env } = context;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'approved';
  
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;

  try {
    if (status !== 'approved') {
      if (!data.isAdmin) {
        return new Response(JSON.stringify({ error: '无管理员权限' }), {
          status: 403, headers: corsHeaders()
        });
      }
      
      const countResult = await env.RSS_DB.prepare('SELECT COUNT(*) as total FROM feed_sources WHERE status = ?').bind(status).first();
      const total = countResult ? countResult.total : 0;
      
      const result = await env.RSS_DB.prepare(
        'SELECT * FROM feed_sources WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(status, pageSize, offset).all();

      return new Response(JSON.stringify({ 
        sources: result.results,
        pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
      }), { headers: corsHeaders() });
    }

    // Normal users only see approved
    const countResult = await env.RSS_DB.prepare('SELECT COUNT(*) as total FROM feed_sources WHERE status = ?').bind('approved').first();
    const total = countResult ? countResult.total : 0;

    const result = await env.RSS_DB.prepare(
      'SELECT id, url, title, description, favicon_url, site_url FROM feed_sources WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind('approved', pageSize, offset).all();

    return new Response(JSON.stringify({ 
      sources: result.results,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
    }), { headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}

// POST — admin review action
export async function onRequestPost(context) {
  const { request, data, env } = context;

  if (!data.isAdmin) {
    return new Response(JSON.stringify({ error: '无管理员权限' }), {
      status: 403, headers: corsHeaders()
    });
  }

  try {
    const body = await request.json();
    const { feedId, action } = body; // action: approve | reject

    if (!feedId || !['approve', 'reject'].includes(action)) {
      return new Response(JSON.stringify({ error: '参数无效' }), {
        status: 400, headers: corsHeaders()
      });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const result = await env.RSS_DB.prepare(
      "UPDATE feed_sources SET status = ?, reviewed_by = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(newStatus, data.userId, feedId).run();

    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: '源不存在' }), {
        status: 404, headers: corsHeaders()
      });
    }

    // If approved, try to fetch initial data
    if (action === 'approve') {
      try {
        const source = await env.RSS_DB.prepare('SELECT url FROM feed_sources WHERE id = ?').bind(feedId).first();
        if (source) {
          // Fetch title and favicon from the feed
          const feedResponse = await fetch(source.url, {
            headers: { 'User-Agent': 'VibeRSS/1.0', 'Accept': 'application/rss+xml, application/atom+xml, text/xml' }
          });
          if (feedResponse.ok) {
            const xml = await feedResponse.text();
            const title = extractFeedTitle(xml);
            const siteUrl = extractFeedSiteUrl(xml);
            if (title || siteUrl) {
              await env.RSS_DB.prepare(
                "UPDATE feed_sources SET title = CASE WHEN ? != '' THEN ? ELSE title END, site_url = CASE WHEN ? != '' THEN ? ELSE site_url END WHERE id = ?"
              ).bind(title, title, siteUrl, siteUrl, feedId).run();
            }
          }
        }
      } catch (fetchErr) {
        console.error('Failed to fetch feed metadata:', fetchErr);
      }
    }

    return new Response(JSON.stringify({ success: true, status: newStatus }), {
      headers: corsHeaders()
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}

function extractFeedTitle(xml) {
  // RSS: <channel><title>...</title>
  const rssMatch = xml.match(/<channel[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  if (rssMatch) return rssMatch[1].trim();

  // Atom: <feed><title>...</title>
  const atomMatch = xml.match(/<feed[\s>][\s\S]*?<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
  return atomMatch ? atomMatch[1].trim() : '';
}

function extractFeedSiteUrl(xml) {
  // RSS: <channel><link>...</link>
  const rssMatch = xml.match(/<channel[\s>][\s\S]*?<link[^>]*>([^<]+)<\/link>/i);
  if (rssMatch) return rssMatch[1].trim();

  // Atom: <link rel="alternate" href="..." />
  const atomMatch = xml.match(/<feed[\s>][\s\S]*?<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  return atomMatch ? atomMatch[1].trim() : '';
}
