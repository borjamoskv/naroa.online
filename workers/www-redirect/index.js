// Worker: naroagutierrezgil.com/* & www.naroagutierrezgil.com/* → 301 a https://naroa.online/ conservando path y query.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(`https://naroa.online${url.pathname}${url.search}`, 301);
  },
};
