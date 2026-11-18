#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — NAROA.ONLINE Zero-Friction Deployment Pipeline
# ═══════════════════════════════════════════════════════════════
# Orquesta el despliegue multi-superficie de naroa.online:
#   1. El Museo (Portfolio Canónico Inmersivo, .deploy/) → Vercel, que sirve naroagutierrezgil.com,
#      y su copia en Cloudflare Pages (naroagutierrezgil-com)
#   2. El Laboratorio (Galería 3D / SPA React, dist/) → Cloudflare Pages (naroaonline)
#   3. Espejo Shadow Vercel → naroaonline.vercel.app
#   4. Purga Edge Cloudflare + Ping IndexNow (Bing/Copilot/Perplexity)
#
# Los bloqueos de LaLiga caen sobre IP de Cloudflare. Su parte es una copia: si no responde (o falta
# wrangler) se salta o se avisa, y el despliegue sigue hasta Vercel (AGENTS.md §14).
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
TARGET="all"
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --help|-h|help)
      echo ""
      echo "═══════════════════════════════════════════════════════════════"
      echo "  NAROA.ONLINE · PIPELINE DE DESPLIEGUE MULTI-SUPERFICIE C5-REAL"
      echo "═══════════════════════════════════════════════════════════════"
      echo ""
      echo "Comandos disponibles:"
      echo "  ./deploy.sh               Compilar, validar y desplegar TODO a PRODUCCIÓN"
      echo "  ./deploy.sh --museum      Compilar y desplegar solo EL MUSEO (.deploy/)"
      echo "  ./deploy.sh --lab         Compilar y desplegar solo EL LAB 3D (dist/)"
      echo "  ./deploy.sh --quick       Desplegar artefactos ya compilados (<5s, sin rebuild)"
      echo "  ./deploy.sh --preview     Compilar y desplegar a ramas PREVIEW"
      echo "  ./deploy.sh --build-only  Compilar y verificar en local (sin subir)"
      echo "  ./deploy.sh --test-only   Ejecutar linter, tipos y tests JSDOM"
      echo "  ./deploy.sh --help        Mostrar esta ayuda"
      echo ""
      echo "Superficies de destino:"
      echo "  • El Museo (Inmersivo):  https://naroagutierrezgil.com (.deploy/, lo sirve Vercel)"
      echo "  • Copia del Museo:       https://naroagutierrezgil-com.pages.dev (Cloudflare Pages, si responde)"
      echo "  • El Lab (3D / Three):   https://naroaonline.pages.dev (dist/, solo Cloudflare Pages)"
      echo "  • Shadow Mirror:         https://naroaonline.vercel.app"
      echo "═══════════════════════════════════════════════════════════════"
      echo ""
      exit 0
      ;;
    --museum|--classic|museum)
      TARGET="museum"
      ;;
    --lab|--3d|lab)
      TARGET="lab"
      ;;
    --quick|--no-build|quick)
      SKIP_BUILD=1
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
    production|--prod|--production|--all|all|"")
      MODE="production"
      ;;
    *)
      echo "Error: Opción desconocida '$arg'. Usa ./deploy.sh --help para ver las opciones." >&2
      exit 1
      ;;
  esac
done

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
warn() { echo -e "${RED}[AVISO]${NC} $1"; }
# Qué pasó con la copia de Cloudflare Pages; se repite en el resumen final.
CF_NOTES=""
cf_note() { CF_NOTES="${CF_NOTES}  • $1"$'\n'; }

# ── 0. Modo Solo Tests ───────────────────────────────────────
if [ "$MODE" = "test-only" ]; then
  log "Ejecutando suite completa de validación (Linter, Tipos, DOM)..."
  npm run test || fail "Validación de tests falló"
  ok "Suite completa de tests verificada (PASS)"
  exit 0
fi

# ── 0b. Cerrojo: un solo deploy a la vez ────────────────────
# Dos ejecuciones solapadas (p. ej. watch:deploy) comparten .vercel/output y pueden publicar un build a medias.
# --build-only queda fuera porque `vercel build` lo invoca desde dentro de un deploy.
if [ "$MODE" != "build-only" ]; then
  LOCK_DIR="${TMPDIR:-/tmp}/naroa-deploy.lock"
  mkdir "$LOCK_DIR" 2>/dev/null || fail "Ya hay otro deploy en curso. Si no es así, borra $LOCK_DIR y reintenta."
  trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT
fi

# ── 1. Preflight ─────────────────────────────────────────────
# Cloudflare Pages es una copia (el dominio lo sirve Vercel): sin wrangler se salta, no se aborta.
CF_SKIP=""
if [ "$MODE" != "build-only" ] && ! command -v wrangler >/dev/null 2>&1; then
  CF_SKIP="wrangler no encontrado (npm i -g wrangler)"
fi

# ── 1b. Fuentes del catálogo ─────────────────────────────────
# Antes de compilar nada: catálogo, recorrido, exposiciones, redirecciones y registro de la SPA deben coincidir.
if [ "$SKIP_BUILD" = "0" ]; then
  python3 tools/check_catalog_sources.py || fail "Las fuentes del catálogo no coinciden"
fi

# ── 2. Construir Galería 3D / SPA (dist/) ──────────
if [ "$SKIP_BUILD" = "0" ] && { [ "$TARGET" = "all" ] || [ "$TARGET" = "lab" ]; }; then
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
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/assets/*.js
  Cache-Control: public, max-age=31536000, immutable

/assets/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.webp
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
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

User-agent: anthropic-ai
Allow: /

User-agent: cohere-ai
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Amazonbot
Disallow: /

User-agent: *
Allow: /
Disallow: /test/
Disallow: /assets/backup_pre4k/

Sitemap: https://naroagutierrezgil.com/sitemap.xml
EOF
    ok "robots.txt creado"
  fi
fi

# Build the approved immersive design directly from reviewed source data.
# Original catalogue, photographs and legacy generators are preserved.
if [ "$SKIP_BUILD" = "0" ] && { [ "$TARGET" = "all" ] || [ "$TARGET" = "museum" ]; }; then
  log "Compilando portfolio inmersivo completo..."
  PIL_CHECK="from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter"
  # Con clave de firma C2PA (AGENTS.md §12) el intérprete también necesita c2pa-python.
  if [ -n "${NAROA_C2PA_KEY:-}" ]; then PIL_CHECK="$PIL_CHECK; import c2pa"; fi
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
  # En Vercel, las variantes de imagen se guardan entre builds en node_modules/.cache, que Vercel
  # conserva: llevan la huella de su fuente en el nombre, así que solo se optimiza lo nuevo
  # (antes, unos 25 minutos por build). Las que ya están firmadas con C2PA no se vuelven a firmar.
  MEDIA_CACHE="node_modules/.cache/naroa-media"
  if [ -n "${VERCEL:-}" ] && [ -d "$MEDIA_CACHE" ]; then
    mkdir -p .deploy/immersive/media
    cp -R "$MEDIA_CACHE"/. .deploy/immersive/media/
    log "Caché de imágenes: $(ls "$MEDIA_CACHE" | wc -l | tr -d ' ') variantes reutilizadas"
  fi
  $PYTHON_CMD tools/build_immersive_site.py || fail "Compilación del portfolio falló"
  if [ -n "${VERCEL:-}" ]; then
    # Solo vuelve a la caché lo que la compilación cita: lo que dejó de usarse no la hace crecer.
    rm -rf "$MEDIA_CACHE" && mkdir -p "$MEDIA_CACHE"
    $PYTHON_CMD tools/media_cache.py .deploy "$MEDIA_CACHE" || log "Caché de imágenes: no se pudo guardar (el próximo build optimizará todo)"
  fi
  $PYTHON_CMD tools/check_immersive_site.py || fail "Validación del portfolio falló"
  node --max-old-space-size=4096 tools/test_immersive_dom.cjs || fail "Validación de interacciones falló"
  ok "Portfolio completo compilado → .deploy/"
fi

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

DEPLOY_BRANCH=$([ "$MODE" = "preview" ] && echo "preview" || echo "production")

# Cloudflare Pages lleva la copia del Museo y el Lab; el dominio lo sirve Vercel (más abajo). Si Cloudflare
# no responde (p. ej. un bloqueo de LaLiga) o wrangler falla, se avisa y el despliegue sigue hasta Vercel.
if [ -z "$CF_SKIP" ] && ! curl -sS -o /dev/null --max-time 10 https://api.cloudflare.com/client/v4/ 2>/dev/null; then
  CF_SKIP="Cloudflare no responde desde esta red (¿bloqueo de LaLiga?)"
fi
if [ -n "$CF_SKIP" ] && [ "$TARGET" = "lab" ]; then
  fail "El Lab solo se publica en Cloudflare Pages y no está disponible: $CF_SKIP"
fi

if [ -n "$CF_SKIP" ]; then
  warn "Cloudflare Pages se salta: $CF_SKIP. El dominio lo sirve Vercel y el despliegue sigue."
  cf_note "saltado: $CF_SKIP (la copia del Museo y el Lab quedan como estaban)"
else
  if [ "$TARGET" = "all" ] || [ "$TARGET" = "museum" ]; then
    [ -d ".deploy" ] || fail "Directorio .deploy no encontrado. Ejecuta sin --quick primero."
    log "Actualizando la copia del MUSEO → CF Pages proyecto ${BOLD}naroagutierrezgil-com${NC} (${DEPLOY_BRANCH})..."
    if wrangler pages deploy .deploy --project-name "naroagutierrezgil-com" --branch "$DEPLOY_BRANCH" --commit-dirty=true; then
      ok "Copia del MUSEO actualizada → https://naroagutierrezgil-com.pages.dev/"
      cf_note "copia del Museo actualizada"
    else
      warn "wrangler falló con la copia del Museo; el despliegue sigue hasta Vercel."
      cf_note "la copia del Museo NO se actualizó (wrangler falló)"
    fi
  fi

  if [ "$TARGET" = "all" ] || [ "$TARGET" = "lab" ]; then
    [ -d "$BUILD_DIR" ] || fail "Directorio $BUILD_DIR no encontrado. Ejecuta sin --quick primero."
    log "Desplegando EL SÓTANO / LAB → CF Pages proyecto ${BOLD}naroaonline${NC} (${DEPLOY_BRANCH})..."
    if wrangler pages deploy "$BUILD_DIR" --project-name "naroaonline" --branch "$DEPLOY_BRANCH" --commit-dirty=true; then
      ok "Deploy EL LAB completado → https://naroaonline.pages.dev/"
      cf_note "Lab actualizado"
    elif [ "$TARGET" = "lab" ]; then
      fail "wrangler falló con el Lab"
    else
      warn "wrangler falló con el Lab; el despliegue sigue hasta Vercel."
      cf_note "el Lab NO se actualizó (wrangler falló)"
    fi
  fi
fi

# ── 7. Purga de Caché Global en Cloudflare Edge ──────────────
if [ -n "${CF_ZONE_ID:-}" ] && [ -n "${CF_AUTH_TOKEN:-}" ]; then
  log "Purgando caché global en Cloudflare Edge (Zone: naroagutierrezgil.com)..."
  curl -s --max-time 15 -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CF_AUTH_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{"purge_everything":true}' > /dev/null 2>&1 || true
  ok "Caché global de Cloudflare purgada"
fi

# ── 8. Despliegue Paralelo a Vercel ──────────────────────────
VERCEL_STATE="no se intentó (npx no encontrado)"
if command -v npx >/dev/null 2>&1; then
  # Vercel sirve el dominio real (el DNS apunta ahí): nunca subir un build vacío ni ocultar errores.
  VERCEL_LOG="${TMPDIR:-/tmp}/naroa-vercel-deploy.log"
  log "Publicando en Vercel Producción (log: $VERCEL_LOG)..."
  if ! npx vercel build --prod --yes > "$VERCEL_LOG" 2>&1; then
    VERCEL_STATE="NO publicado (vercel build falló): el dominio conserva el despliegue anterior"
    echo -e "${RED}[AVISO]${NC} vercel build falló: NO se sube nada, producción conserva el despliegue anterior. Ver $VERCEL_LOG"
  elif [ ! -s ".vercel/output/static/index.html" ]; then
    VERCEL_STATE="NO publicado (build vacío): el dominio conserva el despliegue anterior"
    echo -e "${RED}[AVISO]${NC} vercel build no generó .vercel/output/static/index.html: NO se sube nada (evita un 404 global). Ver $VERCEL_LOG"
  elif ! npx vercel deploy --prebuilt --prod --yes >> "$VERCEL_LOG" 2>&1; then
    VERCEL_STATE="NO publicado (vercel deploy falló): el dominio conserva el despliegue anterior"
    echo -e "${RED}[AVISO]${NC} vercel deploy falló (¿cuota?): producción conserva el despliegue anterior. Ver $VERCEL_LOG"
  else
    VERCEL_STATE="publicado"
    ok "Vercel Producción actualizado"
  fi
fi

# ── 9. Notificación Instantánea IndexNow (Bing / Copilot / Perplexity) ──
if [ "$MODE" = "production" ] && [ -f ".deploy/indexnow.json" ]; then
  log "Notificando a IndexNow (IndexNow.org, Bing/Copilot, Yandex)..."
  for INDEXNOW_ENDPOINT in \
    "https://api.indexnow.org/indexnow" \
    "https://www.bing.com/indexnow" \
    "https://yandex.com/indexnow"; do
    curl -s -X POST "$INDEXNOW_ENDPOINT" \
      -H "Content-Type: application/json; charset=utf-8" \
      --data-binary "@.deploy/indexnow.json" > /dev/null 2>&1 || true
  done
  ok "IndexNow notificado en 3 endpoints con rutas canónicas"
fi

# ── 10. Finalización ─────────────────────────────────────────
ok "Despliegue finalizado"

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  NAROA.ONLINE / NAROAGUTIERREZGIL.COM · RESUMEN${NC}"
echo -e "${BOLD}  • Vercel (sirve https://naroagutierrezgil.com): ${VERCEL_STATE}${NC}"
echo -e "${BOLD}  • Cloudflare Pages (copia del Museo y Lab):${NC}"
if [ -n "$CF_NOTES" ]; then printf '%s' "$CF_NOTES"; else echo "  • sin cambios (modo sin subida)"; fi
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
