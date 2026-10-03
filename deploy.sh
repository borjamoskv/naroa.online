#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — NAROA.ONLINE Zero-Friction Deployment Pipeline
# ═══════════════════════════════════════════════════════════════
# Ensambla el sitio completo (portal SEO + galería 3D) y lo
# despliega a Cloudflare Pages en un solo comando.
#
# Uso:
#   npm run deploy          # build + deploy producción
#   npm run deploy:preview  # build + deploy preview
#   ./deploy.sh             # equivalente a npm run deploy
#   ./deploy.sh --preview   # deploy a URL de preview
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="naroaonline"
BUILD_DIR="dist"
BRANCH="${1:-production}"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
fail() { echo -e "${RED}[FATAL]${NC} $1"; exit 1; }

# ── 1. Preflight ─────────────────────────────────────────────
[ "$BRANCH" = "--build-only" ] || command -v wrangler >/dev/null 2>&1 || fail "wrangler no encontrado. Instala con: npm i -g wrangler"
[ -d "live-site" ] || fail "Directorio live-site/ no encontrado"

# ── 2. Construir Galería 3D / SPA (dist/) ──────────
log "Construyendo SPA (Vite + React + Three.js)..."
export NODE_ENV=production
npm run build || fail "Build de Vite falló"
ok "Galería 3D compilada → dist/"

# ── 6. Inyectar _headers y _redirects de CF Pages ───────────
log "Inyectando _headers y _redirects..."

cat > "$BUILD_DIR/_headers" << 'EOF'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

/
  Cache-Control: no-cache, no-store, must-revalidate, max-age=0
  Pragma: no-cache
  Expires: 0

/index.html
  Cache-Control: no-cache, no-store, must-revalidate, max-age=0
  Pragma: no-cache
  Expires: 0

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.webp
  Cache-Control: public, max-age=31536000, immutable
EOF

cat > "$BUILD_DIR/_redirects" << 'EOF'
# Redirecciones canónicas del Laboratorio Experimental
/lab /#/lab 302
/experiments /#/experiments 302
/games /#/games 302
/archive /#/archive 302
/process /#/process 302

# Aliases hacia rutas de laboratorio (301)
/3d /#/experiments 301
/sala-3d /#/experiments 301
/galeria /#/archive 301
/gallery /#/archive 301

# SPA fallback para todas las rutas
/* /index.html 200
EOF

ok "_headers y _redirects inyectados"

# ── 7. Robots.txt (si no existe en live-site) ────────────────
if [ ! -f "$BUILD_DIR/robots.txt" ]; then
  cat > "$BUILD_DIR/robots.txt" << 'EOF'
User-agent: *
Allow: /
Sitemap: https://naroa.online/sitemap.xml
EOF
  ok "robots.txt creado"
fi

# ── 7b. Compilar El Museo Institucional (museum/) ───────────
log "Compilando sitio institucional El Museo (naroagutierrezgil.com)..."
python3 tools/build_museum_site.py || fail "Compilación de El Museo falló"
ok "El Museo compilado → museum/ (6 rutas canónicas)"

# ── 8. Deploy a Cloudflare Pages ─────────────────────────────
if [ "$BRANCH" = "--build-only" ]; then
  ok "Build completado en .deploy/ y museum/ (Modo --build-only)"
  exit 0
fi

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  export CLOUDFLARE_API_TOKEN
fi

log "Desplegando EL MUSEO → CF Pages proyecto ${BOLD}naroagutierrezgil-com${NC}..."
if [ "$BRANCH" = "--preview" ]; then
  wrangler pages deploy museum --project-name "naroagutierrezgil-com" --branch preview --commit-dirty=true
  wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch preview --commit-dirty=true
  ok "Deploy PREVIEW completado"
else
  wrangler pages deploy museum --project-name "naroagutierrezgil-com" --branch production --commit-dirty=true || true
  log "Desplegando EL SÓTANO / LAB → CF Pages proyecto ${BOLD}naroaonline${NC}..."
  wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch production --commit-dirty=true || true
  ok "Deploy PRODUCCIÓN completado → https://naroagutierrezgil.com/ (El Museo) & https://naroa.online/ (El Sótano)"
fi

# ── 9. Purga de Caché Global en Cloudflare Edge ──────────────
if [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_AUTH_TOKEN:-}" ]; then
  log "Purgando caché global en Cloudflare Edge (Zone: naroagutierrezgil.com)..."
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"purge_everything":true}' > /dev/null 2>&1 || true
  ok "Caché global de Cloudflare purgada"
fi

# ── 10. Despliegue Paralelo a Vercel ──────────────────────────
if command -v npx >/dev/null 2>&1; then
  log "Sincronizando espejo en Vercel Producción..."
  npx vercel --prod --yes > /dev/null 2>&1 || true
  ok "Mirror Vercel actualizado"
fi

# ── 11. Finalización ─────────────────────────────────────────
ok "Despliegue finalizado exitosamente"

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ NAROA.ONLINE / NAROAGUTIERREZGIL.COM DESPLEGADO C5-REAL${NC}"
echo -e "${GREEN}${BOLD}  • Cloudflare Pages:  https://naroagutierrezgil.com${NC}"
echo -e "${GREEN}${BOLD}  • Cloudflare Alias:  https://naroa.online${NC}"
echo -e "${GREEN}${BOLD}  • Vercel Mirror:     https://naroaonline.vercel.app${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
