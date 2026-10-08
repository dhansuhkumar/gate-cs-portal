// Cloudflare Worker - CORS proxy for GitHub Releases PDFs
// Deploy to: https://dash.cloudflare.com/workers

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return new Response('Missing "url" parameter', { status: 400 });
    }
    
    // Only allow GitHub releases URLs
    if (!targetUrl.startsWith('https://github.com/dhansuhkumar/gate-cs-portal/releases/download/')) {
      return new Response('Forbidden: Only GitHub releases allowed', { status: 403 });
    }
    
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'GATE-CS-Portal/1.0',
        },
        cf: {
          cacheTtl: 86400, // 24 hours
          cacheEverything: true,
        },
      });
      
      if (!response.ok) {
        return new Response(`Upstream error: ${response.status}`, { status: response.status });
      }
      
      // Return with CORS headers
      return new Response(response.body, {
        status: 200,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/pdf',
          'Content-Length': response.headers.get('Content-Length'),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Length, Accept-Ranges, Content-Range',
        },
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 502 });
    }
  },
};