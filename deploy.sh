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
BUILD_DIR=".deploy"
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

# ── 2. Limpiar build anterior ────────────────────────────────
log "Limpiando build anterior..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── 3. Copiar Galería 3D / SPA (dist/) a la raíz del sitio ──
log "Montando SPA (dist/) en la raíz → ${BUILD_DIR}/"
cp -R dist/* "$BUILD_DIR/"
ok "SPA montada en la raíz del sitio"

# ── 6. Inyectar _headers y _redirects de CF Pages ───────────
log "Inyectando _headers y _redirects..."

cat > "$BUILD_DIR/_headers" << 'EOF'
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

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

/sala-3d/assets/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=31536000, immutable

/*.webp
  Cache-Control: public, max-age=31536000, immutable
EOF

cat > "$BUILD_DIR/_redirects" << 'EOF'
# Landing SEO (SPA fallback dentro de /sala-3d/)
/sala-3d/* /sala-3d/index.html 200

# Aliases útiles
/3d /sala-3d/ 302
/galeria /sala-3d/ 302
/gallery /sala-3d/ 302
EOF

ok "_headers y _redirects inyectados"

# ── 7. Robots.txt (si no existe en live-site) ────────────────
if [ ! -f "$BUILD_DIR/robots.txt" ]; then
  cat > "$BUILD_DIR/robots.txt" << 'EOF'
User-agent: *
Allow: /
Sitemap: https://naroagutierrezgil.com/sitemap.xml
EOF
  ok "robots.txt creado"
fi

# ── 8. Deploy a Cloudflare Pages ─────────────────────────────
if [ "$BRANCH" = "--build-only" ]; then
  ok "Build completado en .deploy/ (Modo --build-only)"
  exit 0
fi

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  export CLOUDFLARE_API_TOKEN
fi

DEPLOY_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
log "Desplegando ${BOLD}${DEPLOY_SIZE}${NC} → CF Pages proyecto ${BOLD}naroagutierrezgil-com${NC} (Dominio Oficial)..."

if [ "$BRANCH" = "--preview" ]; then
  wrangler pages deploy "$BUILD_DIR" --project-name "naroagutierrezgil-com" --branch preview
  wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch preview
  ok "Deploy PREVIEW completado"
else
  wrangler pages deploy "$BUILD_DIR" --project-name "naroagutierrezgil-com" --branch production
  wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch production
  ok "Deploy PRODUCCIÓN completado → https://naroagutierrezgil.com/ & https://naroa.online/"
fi

# ── 9. Purga de Caché Global en Cloudflare Edge ──────────────
log "Purgando caché global en Cloudflare Edge (Zone: naroagutierrezgil.com)..."
CF_ZONE_ID="${CF_ZONE_ID:?Error: CF_ZONE_ID env var not set}"
CF_AUTH_TOKEN="${CF_AUTH_TOKEN:?Error: CF_AUTH_TOKEN env var not set}"
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything":true}' > /dev/null 2>&1 || true
ok "Caché global de Cloudflare purgada"

# ── 10. Despliegue Paralelo a Vercel ──────────────────────────
if command -v npx >/dev/null 2>&1; then
  log "Sincronizando espejo en Vercel Producción..."
  npx vercel --prod --yes > /dev/null 2>&1 || true
  ok "Mirror Vercel actualizado"
fi

# ── 11. Limpieza post-deploy ─────────────────────────────────
rm -rf "$BUILD_DIR"
ok "Build temporal limpiado"

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ NAROA.ONLINE / NAROAGUTIERREZGIL.COM DESPLEGADO C5-REAL${NC}"
echo -e "${GREEN}${BOLD}  • Cloudflare Pages:  https://naroagutierrezgil.com${NC}"
echo -e "${GREEN}${BOLD}  • Cloudflare Alias:  https://naroa.online${NC}"
echo -e "${GREEN}${BOLD}  • Vercel Mirror:     https://naroaonline.vercel.app${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
