export async function onRequest(context) {
  // Return public configuration from environment variables
  return new Response(
    JSON.stringify({
      clerkPublishableKey: context.env.CLERK_PUBLISHABLE_KEY || 'pk_live_Y2xlcmsua2FwaWJhbGEuaWN1JA'
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    }
  );
}
