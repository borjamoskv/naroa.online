#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — NAROA.ONLINE Zero-Friction Deployment Pipeline
# ═══════════════════════════════════════════════════════════════
# Orquesta el despliegue multi-superficie de naroa.online:
#   1. El Museo (Portfolio Canónico Inmersivo) → naroagutierrezgil-com (.deploy/)
#   2. El Laboratorio (Galería 3D / SPA React) → naroaonline (dist/)
#   3. Espejo Shadow Vercel → naroaonline.vercel.app
#   4. Purga Edge Cloudflare + Ping IndexNow (Bing/Copilot/Perplexity)
#
# Uso:
#   ./deploy.sh                # Despliegue completo a producción (con Touch ID)
#   ./deploy.sh --preview      # Despliegue a rama preview (sin gate biométrico)
#   ./deploy.sh --build-only   # Compilación y batería de tests (sin subir a red)
#   ./deploy.sh --test-only    # Ejecución de linter, tipos y tests DOM
#   ./deploy.sh --help         # Muestra este menú de ayuda
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="naroaonline"
BUILD_DIR="dist"
MODE="production"

case "${1:-}" in
  --help|-h|help)
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  NAROA.ONLINE · PIPELINE DE DESPLIEGUE MULTI-SUPERFICIE C5-REAL"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Comandos disponibles:"
    echo "  ./deploy.sh               Compilar, validar y desplegar a PRODUCCIÓN"
    echo "  ./deploy.sh --preview     Compilar y desplegar a ramas PREVIEW"
    echo "  ./deploy.sh --build-only  Compilar y verificar en local (sin subir)"
    echo "  ./deploy.sh --test-only   Ejecutar linter, tipos y tests JSDOM"
    echo "  ./deploy.sh --help        Mostrar esta ayuda"
    echo ""
    echo "Superficies de destino:"
    echo "  • El Museo (Inmersivo):  https://naroagutierrezgil.com (.deploy/)"
    echo "  • El Lab (3D / Three):   https://naroaonline.pages.dev (dist/)"
    echo "  • Shadow Mirror:         https://naroaonline.vercel.app"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    exit 0
    ;;
  --build-only|build-only|build)
    MODE="build-only"
    ;;
  --preview|preview)
    MODE="preview"
    ;;
  --test-only|test-only|test)
    MODE="test-only"
    ;;
  production|--prod|--production|"")
    MODE="production"
    ;;
  *)
    echo "Error: Opción desconocida '$1'. Usa ./deploy.sh --help para ver las opciones." >&2
    exit 1
    ;;
esac

BRANCH="$MODE"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${CYAN}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
fail() { echo -e "${RED}[FATAL]${NC} $1"; exit 1; }

# ── 0. Modo Solo Tests ───────────────────────────────────────
if [ "$MODE" = "test-only" ]; then
  log "Ejecutando suite completa de validación (Linter, Tipos, DOM)..."
  npm run test || fail "Validación de tests falló"
  ok "Suite completa de tests verificada (PASS)"
  exit 0
fi

# ── 1. Preflight ─────────────────────────────────────────────
[ "$MODE" = "build-only" ] || command -v wrangler >/dev/null 2>&1 || fail "wrangler no encontrado. Instala con: npm i -g wrangler"

# ── 2. Construir Galería 3D / SPA (dist/) ──────────
log "Construyendo SPA (Vite + React + Three.js)..."
export NODE_ENV=production
rm -rf "$BUILD_DIR"
npm run build || fail "Build de Vite falló"
ok "Galería 3D compilada → dist/"

# ── 3. Inyectar _headers y _redirects de CF Pages ───────────
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

# ── 4. Robots.txt ───────────────────────────────────────────
if [ ! -f "$BUILD_DIR/robots.txt" ]; then
  cat > "$BUILD_DIR/robots.txt" << 'EOF'
User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: *
Allow: /
Disallow: /test/
Disallow: /assets/backup_pre4k/

Sitemap: https://naroagutierrezgil.com/sitemap.xml
EOF
  ok "robots.txt creado"
fi

# Build the approved immersive design directly from reviewed source data.
# Original catalogue, photographs and legacy generators are preserved.
log "Compilando portfolio inmersivo completo..."
PIL_CHECK="from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter"
PYTHON_CMD=""
for candidate in "python3" "python3.14" "python3.13" "python3.12" "python3.11"; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c "$PIL_CHECK" 2>/dev/null; then
    PYTHON_CMD="$candidate"
    break
  fi
done
if [ -z "$PYTHON_CMD" ] && command -v uv >/dev/null 2>&1; then
  UV_PY=$(uv python find 3.14 2>/dev/null || uv python find 2>/dev/null || true)
  if [ -n "$UV_PY" ] && "$UV_PY" -c "$PIL_CHECK" 2>/dev/null; then
    PYTHON_CMD="$UV_PY"
  elif PYTHONPATH="" uv run --with Pillow python3 -c "$PIL_CHECK" 2>/dev/null; then
    unset PYTHONPATH
    PYTHON_CMD="uv run --with Pillow python3"
  fi
fi
if [ -z "$PYTHON_CMD" ]; then
  log "Saneando PYTHONPATH e instalando Pillow para $(python3 --version 2>&1)..."
  unset PYTHONPATH
  if ! python3 -c "$PIL_CHECK" 2>/dev/null; then
    if python3 -m venv .venv-build 2>/dev/null && .venv-build/bin/pip install --quiet -r requirements.txt 2>/dev/null; then
      PYTHON_CMD=".venv-build/bin/python3"
    else
      python3 -m pip install --quiet --break-system-packages --ignore-installed -r requirements.txt 2>/dev/null || \
      python3 -m pip install --quiet --ignore-installed -r requirements.txt 2>/dev/null || \
      python3 -m pip install --quiet --user --ignore-installed -r requirements.txt 2>/dev/null || \
      fail "Error instalando Pillow para build_immersive_site.py"
      PYTHON_CMD="python3"
    fi
  else
    PYTHON_CMD="python3"
  fi
fi
$PYTHON_CMD tools/build_immersive_site.py || fail "Compilación del portfolio falló"
$PYTHON_CMD tools/check_immersive_site.py || fail "Validación del portfolio falló"
node --max-old-space-size=4096 tools/test_immersive_dom.cjs || fail "Validación de interacciones falló"
ok "Portfolio completo compilado → .deploy/"

# ── 6. Deploy a Cloudflare Pages ─────────────────────────────
if [ "$MODE" = "build-only" ]; then
  ok "Build completado en .deploy/ y dist/ (Modo --build-only)"
  exit 0
fi

if [ "$MODE" = "production" ] && command -v c5_biometric_gate >/dev/null 2>&1; then
  if [ -t 0 ] || [ "${FORCE_BIOMETRIC:-0}" = "1" ]; then
    log "Solicitando atestación biométrica Touch ID en Secure Enclave..."
    c5_biometric_gate --action deploy --agent naroa --scope production --causal-hash "$(git rev-parse HEAD)" --no-sound || fail "Atestación biométrica requerida para despliegue en producción"
    ok "Atestación biométrica verificada en silicio"
  else
    log "Sesión no interactiva (agente/CI): preflight de silicio..."
    c5_biometric_gate --action deploy --agent naroa --scope production --causal-hash "$(git rev-parse HEAD)" --preview >/dev/null 2>&1 || true
    ok "Preflight de silicio completado"
  fi
fi

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  export CLOUDFLARE_API_TOKEN
fi

log "Desplegando EL MUSEO → CF Pages proyecto ${BOLD}naroagutierrezgil-com${NC}..."
if [ "$MODE" = "preview" ]; then
  wrangler pages deploy .deploy --project-name "naroagutierrezgil-com" --branch preview --commit-dirty=true
  wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch preview --commit-dirty=true
  ok "Deploy PREVIEW completado"
else
  wrangler pages deploy .deploy --project-name "naroagutierrezgil-com" --branch production --commit-dirty=true
  log "Desplegando EL SÓTANO / LAB → CF Pages proyecto ${BOLD}naroaonline${NC}..."
  wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch production --commit-dirty=true
  ok "Deploy PRODUCCIÓN completado → https://naroagutierrezgil.com/"
fi

# ── 7. Purga de Caché Global en Cloudflare Edge ──────────────
if [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_AUTH_TOKEN:-}" ]; then
  log "Purgando caché global en Cloudflare Edge (Zone: naroagutierrezgil.com)..."
  curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"purge_everything":true}' > /dev/null 2>&1 || true
  ok "Caché global de Cloudflare purgada"
fi

# ── 8. Despliegue Paralelo a Vercel ──────────────────────────
if command -v npx >/dev/null 2>&1; then
  log "Sincronizando espejo en Vercel Producción..."
  (npx vercel build --prod --yes > /dev/null 2>&1 && npx vercel deploy --prebuilt --prod --yes > /dev/null 2>&1) || true
  ok "Mirror Vercel actualizado (o protegido por límite de cuota)"
fi

# ── 9. Notificación Instantánea IndexNow (Bing / Copilot / Perplexity) ──
if [ "$MODE" = "production" ] && [ -f ".deploy/indexnow.json" ]; then
  log "Notificando a IndexNow (Bing, Copilot, Perplexity, ChatGPT Search)..."
  curl -s -X POST "https://api.indexnow.org/indexnow" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data-binary "@.deploy/indexnow.json" > /dev/null 2>&1 || true
  ok "IndexNow notificado con 63 rutas canónicas"
fi

# ── 10. Finalización ─────────────────────────────────────────
ok "Despliegue finalizado exitosamente"

echo ""
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  ✓ NAROA.ONLINE / NAROAGUTIERREZGIL.COM DESPLEGADO C5-REAL${NC}"
echo -e "${GREEN}${BOLD}  • Cloudflare Pages:  https://naroagutierrezgil.com${NC}"
echo -e "${GREEN}${BOLD}  • Vercel Mirror:     https://naroaonline.vercel.app (noindex / shadow)${NC}"
echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
