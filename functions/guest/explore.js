/**
 * Guest Explore API
 * GET /guest/explore — public content for non-logged-in users
 * Returns: latest 20 articles + random 20 favorites
 */

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Latest 20 articles from approved sources
    const latestResult = await env.RSS_DB.prepare(`
      SELECT a.id, a.title, a.author, a.summary, a.link, a.published_at,
             fs.title as source_title, fs.favicon_url
      FROM articles a
      JOIN feed_sources fs ON a.feed_id = fs.id AND fs.status = 'approved'
      ORDER BY a.published_at DESC
      LIMIT 20
    `).all();

    // Random 20 favorited articles (from all users, publicly shared)
    const favoritesResult = await env.RSS_DB.prepare(`
      SELECT DISTINCT a.id, a.title, a.author, a.summary, a.link, a.published_at,
             fs.title as source_title, fs.favicon_url
      FROM articles a
      JOIN feed_sources fs ON a.feed_id = fs.id AND fs.status = 'approved'
      JOIN user_article_status uas ON a.id = uas.article_id AND uas.is_favorited = 1
      ORDER BY RANDOM()
      LIMIT 20
    `).all();

    return new Response(JSON.stringify({
      latest: latestResult.results,
      favorites: favoritesResult.results,
    }), { headers: corsHeaders() });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: corsHeaders()
    });
  }
}
