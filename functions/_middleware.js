/**
 * Global Middleware — Clerk JWT Authentication
 * 
 * - /guest/* routes: skip auth (public)
 * - /api/* routes: require valid Clerk JWT, extract userId
 * - All other routes: serve static files
 */

// Clerk JWKS endpoint for the publishable key domain
const CLERK_JWKS_CACHE_KEY = 'clerk-jwks';
let jwksCache = null;
let jwksCacheTime = 0;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

async function getClerkJWKS(clerkSecretKey) {
  const now = Date.now();
  if (jwksCache && (now - jwksCacheTime) < JWKS_CACHE_TTL) {
    return jwksCache;
  }

  // Extract the Clerk Frontend API domain from the publishable key or use the secret key to get JWKS
  // For Clerk, JWKS is available at https://<frontend-api>/.well-known/jwks.json
  // We can derive the frontend API from the publishable key
  const response = await fetch('https://fond-monkfish-66.clerk.accounts.dev/.well-known/jwks.json');
  if (!response.ok) {
    throw new Error('Failed to fetch Clerk JWKS');
  }
  jwksCache = await response.json();
  jwksCacheTime = now;
  return jwksCache;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  return payload;
}

async function importJWK(jwk) {
  return await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

async function verifyJWT(token, jwks) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');

  // Decode header to find kid
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
  const kid = header.kid;

  // Find matching key
  const jwk = jwks.keys.find(k => k.kid === kid);
  if (!jwk) throw new Error('No matching JWK found');

  const key = await importJWK(jwk);

  // Verify signature
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlDecode(parts[2]);

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) throw new Error('Invalid JWT signature');

  // Decode and validate payload
  const payload = decodeJwtPayload(token);

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT expired');
  }

  return payload;
}

export async function onRequest(context) {
  const { request, next, data, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Skip auth for guest routes and static assets
  if (!path.startsWith('/api/')) {
    return next();
  }

  // Guest API routes don't need auth
  if (path.startsWith('/guest/')) {
    return next();
  }

  // --- Authenticated API routes ---
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.slice(7);

  try {
    const jwks = await getClerkJWKS(env.CLERK_SECRET_KEY);
    const payload = await verifyJWT(token, jwks);

    // Inject userId into context for downstream handlers
    data.userId = payload.sub;
    data.isAdmin = (env.ADMIN_USER_IDS || '').split(',').filter(Boolean).includes(payload.sub);

    return next();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid token', details: err.message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
