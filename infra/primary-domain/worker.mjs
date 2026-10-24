/** Serve the portfolio at its canonical domain without changing paths or queries. */
export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const primary = 'naroagutierrezgil.com';
    if (![primary, `www.${primary}`].includes(incoming.hostname)) {
      return new Response('Not found', {status: 404});
    }
    if (incoming.hostname !== primary || incoming.protocol !== 'https:') {
      incoming.protocol = 'https:';
      incoming.hostname = primary;
      return Response.redirect(incoming.href, 308);
    }
    if (incoming.pathname === '/api/blog') {
      if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status:405, headers:{Allow:'GET, HEAD'}});
      try {
        const upstream = await fetch('https://public-api.wordpress.com/rest/v1.1/sites/naroagutierrez.wordpress.com/posts/?number=6&fields=ID,date,modified,title,URL,excerpt,featured_image,attachments', {
          signal:AbortSignal.timeout(8000), cf:{cacheEverything:true, cacheTtl:300}
        });
        if (!upstream.ok) throw new Error('WordPress unavailable');
        const data = await upstream.json();
        if (!Array.isArray(data.posts)) throw new Error('Invalid WordPress response');
        return new Response(request.method === 'HEAD' ? null : JSON.stringify(data), {headers:{
          'Content-Type':'application/json; charset=utf-8',
          'Cache-Control':'public, max-age=300, stale-while-revalidate=600',
          'X-Content-Type-Options':'nosniff'
        }});
      } catch {
        return new Response('{"error":"WordPress unavailable"}', {status:502, headers:{'Content-Type':'application/json', 'Cache-Control':'no-store'}});
      }
    }
    const origin = new URL(incoming);
    origin.hostname = 'naroagutierrezgil-com.pages.dev';
    try {
      const outgoing = new Request(origin, request);
      outgoing.headers.set('X-Forwarded-Host', primary);
      const upstream = await fetch(outgoing, {redirect: 'manual'});
      const headers = new Headers(upstream.headers);
      const location = headers.get('Location');
      if (location) {
        const destination = new URL(location, origin);
        if (destination.hostname === origin.hostname) {
          destination.hostname = primary;
          headers.set('Location', destination.href);
        }
      }
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers
      });
    } catch {
      console.error(JSON.stringify({event: 'portfolio_origin_unavailable', path: incoming.pathname}));
      return new Response('La web no está disponible en este momento. Inténtalo de nuevo en unos instantes.', {
        status: 502,
        headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}
      });
    }
  }
};
