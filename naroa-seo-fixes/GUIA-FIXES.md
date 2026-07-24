# 🛠️ Fixes SEO — naroa.online (18 jul 2026)

## ⚠️ ANTES DE NADA — leer esto

Este repo (`10_PROJECTS/naroa.online`) **NO contiene el código de la web en producción**. Es el proyecto experimental 3D, pero está **vinculado al proyecto Vercel `naroa.online`** (`.vercel/project.json`).

- **NO ejecutes `vercel deploy` ni `vercel --prod` desde este repo** — machacaría la web del portfolio con la galería 3D.
- Todos los archivos de esta carpeta se aplican en el **proyecto fuente real** (el que genera la web del portfolio, esté donde esté) y luego se redepliega desde allí.
- Los archivos estáticos (`robots.txt`, `sitemap.xml`, `og-image.jpg`) van a la carpeta `public/` de ese proyecto.

---

## Fix 1 — og:image rota (404) 🔴

**Problema:** `og:image` y `twitter:image` apuntan a `/images/artworks/marilyn-rocks-hq-5.webp`, que no existe. Sin imagen de preview al compartir.

**Aplicar:**
1. Copiar `og-image.jpg` (1200×630, 159 KB, generada de *Marilyn Rocks*) → `public/og-image.jpg`
2. En el `index.html` del proyecto real, sustituir las meta por el contenido de `meta-tags-head.html` (ya trae las rutas corregidas a `/og-image.jpg`)

## Fix 2 — sitemap.xml con URLs rotas 🔴

**Problema:** el sitemap incluye `/retratos-hiperrealistas-bilbao` (404) y 29 imágenes `/images/artworks/*` (todas 404), además de `<url>` duplicadas.

**Aplicar:** reemplazar `public/sitemap.xml` por el de esta carpeta:
- 1 sola `<url>` (la home), 29 `<image:image>` con las URLs **reales y verificadas** (200 OK hoy)
- `lastmod` actualizado a 2026-07-18
- La landing rota se ha quitado; **re-añadir cuando exista** (ver "Pendiente")

**Ojo:** las URLs de imagen llevan el hash del build actual (`/assets/xxx-Hash.webp`). Si un redeploy cambia los hashes, hay que regenerar el sitemap. Solución duradera: servir las imágenes SEO desde `public/images/` (sin hash).

## Fix 3 — robots.txt bloquea los assets 🟡

**Problema:** `Disallow: /assets/` impide a Google descargar el JS/CSS para renderizar.

**Aplicar:** reemplazar `public/robots.txt` por el de esta carpeta (sin bloqueos, sin `Crawl-delay`, que Google ignora).

## Fix 4 — imágenes pesadas: −2,3 MB 🟡

**Aplicar:** sustituir en el proyecto real las 13 imágenes de `images-optimizadas/` (mismo nombre de archivo, así que no hay que tocar código):

| Imagen | Antes | Después |
|---|---|---|
| divinos-marilyn | 533 KB | 277 KB |
| hq-portrait-1 | 436 KB | 233 KB |
| divinos-amy | 423 KB | 225 KB |
| love | 370 KB | 140 KB |
| amor-en-conserva | 350 KB | 153 KB |
| lagrimas-de-oro | 309 KB | 108 KB |
| mr-fahrenheit | 296 KB | 132 KB |
| el-gran-dakari | 294 KB | 154 KB |
| marilyn-rocks (también es la og) | 284 KB | 175 KB |
| pink-and-sparkles | 274 KB | 79 KB |
| divinos-johnny | 272 KB | 173 KB |
| celia-cruz-cantinflowers | 271 KB | 146 KB |
| naroa-portrait | 259 KB | 144 KB |

Todas verificadas: formato correcto (webp los webp, jpeg el jpg), máx. 1920 px, calidad visual intacta.

## Fix 5 — cabecera Content-Security-Policy 🟢

**Aplicar:** añadir el header del `vercel.json` de esta carpeta al del proyecto real (si ya tiene `vercel.json`, fusionar — no machacar).
**Precaución:** desplegar primero en *preview* y comprobar que todo carga (si se añaden scripts de terceros algún día — analytics, etc. — habrá que incluirlos en la CSP).

## Fix 6 — lightbox con `src=""` 🟢

En el componente del lightbox, quitar el `src=""` inicial de `<img id="lightbox-img">` (dejar el atributo sin definir hasta abrir una obra). Evita una petición basura a la propia página en algunos navegadores.

---

## Pendiente (requiere el fuente de producción)

1. **Landing `/retratos-hiperrealistas-bilbao`** — la mayor oportunidad SEO: una URL real orientada a la keyword principal, con su propio title/H1, texto de 400+ palabras, obras, proceso de encargo y CTA. Hoy da 404.
2. **Rutas reales en vez de hash** (`/obra`, `/about`, `/contacto` en lugar de `#/...`) para que cada sección pueda posicionar.
3. **Alts más descriptivos** para SEO de imágenes: de `"Geisha"` a `"Geisha — retrato hiperrealista en acrílico sobre pizarra, Naroa Gutiérrez Gil"`.
4. **Redirect www de 2 saltos** (`http://www` → `https://www` → apex): lo gestiona Vercel, impacto mínimo, ignorar.

## Verificación tras el deploy

```bash
curl -sI https://naroa.online/og-image.jpg | head -1        # 200
curl -s https://naroa.online/sitemap.xml | grep -c "image:loc"  # 29
curl -sI https://naroa.online/images/artworks/marilyn-rocks-hq-5.webp  # ya no se usa
curl -sI https://naroa.online/ | grep -i content-security    # CSP presente
```

Luego: validar las cards en https://cards-dev.twitter.com/validator y https://developers.facebook.com/tools/debug/ , y reenviar el sitemap en Google Search Console.
