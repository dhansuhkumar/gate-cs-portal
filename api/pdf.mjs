export const config = { runtime: 'edge' };

const ALLOWED_PREFIX = 'https://github.com/dhansuhkumar/gate-cs-portal/releases/download/';

export default async function handler(request) {
  const u = new URL(request.url);
  const target = u.searchParams.get('url');

  if (!target) {
    return new Response('Missing "url" parameter', { status: 400 });
  }
  if (!target.startsWith(ALLOWED_PREFIX)) {
    return new Response('Forbidden: only GitHub release assets allowed', { status: 403 });
  }

  try {
    const upstreamHeaders = {};
    const range = request.headers.get('Range');
    if (range) upstreamHeaders.Range = range;

    const upstream = await fetch(target, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!upstream.ok && upstream.status !== 206) {
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    const passthrough = ['content-length', 'content-range'];
    for (const h of passthrough) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'no-store');

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 502 });
  }
}
