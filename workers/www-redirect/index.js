// Worker: naroagutierrezgil.com & www.naroagutierrezgil.com → 301 Permanente a https://www.naroa.online/
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();

    // Mapeo semántico de secciones históricas hacia las vistas del portfolio inmersivo
    let target = 'https://www.naroa.online/';
    if (path.startsWith('/obra') || path.startsWith('/galeria') || path.startsWith('/portfolio')) {
      target = 'https://www.naroa.online/#view-galeria';
    } else if (path.startsWith('/bio') || path.startsWith('/sobre-mi') || path.startsWith('/about')) {
      target = 'https://www.naroa.online/#view-about';
    } else if (path.startsWith('/exposiciones') || path.startsWith('/trayectoria')) {
      target = 'https://www.naroa.online/#view-trayectoria';
    } else if (path.startsWith('/contacto') || path.startsWith('/contact')) {
      target = 'https://www.naroa.online/#view-contacto';
    }

    return new Response(null, {
      status: 301,
      statusText: 'Moved Permanently',
      headers: {
        'Location': target,
        'Cache-Control': 'public, max-age=86400',
        'X-Robots-Tag': 'noindex, follow'
      }
    });
  },
};
