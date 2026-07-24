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
command -v wrangler >/dev/null 2>&1 || fail "wrangler no encontrado. Instala con: npm i -g wrangler"
[ -d "live-site" ] || fail "Directorio live-site/ no encontrado"

# ── 2. Limpiar build anterior ────────────────────────────────
log "Limpiando build anterior..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── 3. Copiar el portal SEO (live-site/) como base ──────────
log "Copiando portal SEO (live-site/) → ${BUILD_DIR}/"
cp -R live-site/* "$BUILD_DIR/"
ok "Portal SEO copiado"

# ── 4. Construir la galería 3D (Vite) ───────────────────────
log "Construyendo galería 3D (Vite + React + Three.js)..."
npm run build || fail "Build de Vite falló"
ok "Galería 3D compilada → dist/"

# ── 5. Ensamblar: montar la galería 3D en /sala-3d/ ─────────
log "Montando galería 3D en /sala-3d/..."
mkdir -p "$BUILD_DIR/sala-3d"
cp -R dist/* "$BUILD_DIR/sala-3d/"
ok "Galería 3D montada en /sala-3d/"

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
  Cache-Control: public, max-age=0, must-revalidate

/sala-3d/assets/*
  Cache-Control: public, max-age=31536000, immutable

/images/*
  Cache-Control: public, max-age=2592000

/*.webp
  Cache-Control: public, max-age=2592000
EOF

cat > "$BUILD_DIR/_redirects" << 'EOF'
# www → apex (301)
https://www.naroa.online/* https://naroa.online/:splat 301

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
Sitemap: https://naroa.online/sitemap.xml
EOF
  ok "robots.txt creado"
fi

# ── 8. Deploy a Cloudflare Pages ─────────────────────────────
DEPLOY_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
log "Desplegando ${BOLD}${DEPLOY_SIZE}${NC} → CF Pages proyecto ${BOLD}${PROJECT}${NC}..."

if [ "$BRANCH" = "--preview" ]; then
  wrangler pages deploy "$BUILD_DIR" --project-name "$PROJECT" --branch preview
  ok "Deploy PREVIEW completado"
else
  wrangler pages deploy "$BUILD_DIR" --project-name "$PROJECT" --branch production
  ok "Deploy PRODUCCIÓN completado → https://naroa.online/"
fi

# ── 9. Limpieza post-deploy ──────────────────────────────────
rm -rf "$BUILD_DIR"
ok "Build temporal limpiado"

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ naroa.online desplegado sin fricción${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════${NC}"
echo ""
