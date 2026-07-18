// Worker mínimo: www.naroagutierrezgil.com/* → 301 a apex conservando path y query.
// Existe porque el token MCP no tiene permiso de Redirect Rules a nivel de zona
// y Pages no está aplicando la regla absoluta de web/_redirects.
// Reversible: `npx wrangler delete naroa-www-redirect` y listo.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(`https://naroagutierrezgil.com${url.pathname}${url.search}`, 301);
  },
};
