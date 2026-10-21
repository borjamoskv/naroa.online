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
    const origin = new URL(incoming);
    origin.hostname = 'naroaonline.vercel.app';
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
    } catch (error) {
      console.error(JSON.stringify({event: 'portfolio_origin_unavailable', path: incoming.pathname}));
      return new Response('La web no está disponible en este momento. Inténtalo de nuevo en unos instantes.', {
        status: 502,
        headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store'}
      });
    }
  }
};
