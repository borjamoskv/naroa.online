#!/bin/bash
# ============================================================
#  aplicar-fixes.sh — Aplica los fixes SEO de naroa.online
#  Uso:  ./aplicar-fixes.sh /ruta/al/proyecto-produccion
#        ./aplicar-fixes.sh --check /ruta   (solo verificar)
# ============================================================
set -euo pipefail

FIXES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }
err()  { echo -e "  ${RED}✘${NC} $1"; }

CHECK_ONLY=0
FORCE=0
TARGET=""
for arg in "$@"; do
  case "$arg" in
    --check) CHECK_ONLY=1 ;;
    --force) FORCE=1 ;;
    *) TARGET="$arg" ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "Uso: $0 [--check] [--force] /ruta/al/proyecto-produccion"
  exit 1
fi
TARGET="$(cd "$TARGET" 2>/dev/null && pwd)" || { err "La ruta no existe: $1"; exit 1; }

echo -e "${BOLD}== Verificando que $TARGET es la web de producción ==${NC}"

# --- Seguridad: rechazar el repo 3D experimental ---
if grep -rq "SINCRONIZANDO LIENZO 3D" "$TARGET" --include="*.tsx" --include="*.html" 2>/dev/null; then
  err "Este proyecto es la galería 3D experimental, NO la web del portfolio."
  err "Aplicar los fixes aquí no tendría efecto (y un deploy machacaría la web)."
  exit 1
fi

# --- Buscar firma de la web de producción ---
SIGNATURE=$(grep -rl "gallery-massive\|Retratos Hiperrealistas por Encargo\|games-hub" "$TARGET" \
  --include="*.html" --include="*.tsx" --include="*.jsx" --include="*.js" 2>/dev/null \
  | grep -v node_modules | head -1 || true)

if [ -z "$SIGNATURE" ] && [ "$FORCE" -eq 0 ]; then
  err "No encuentro la firma de la web de producción en $TARGET"
  err "(busco 'gallery-massive', 'Retratos Hiperrealistas por Encargo' o 'games-hub')"
  echo "  Si estás seguro de que es el proyecto correcto, reintenta con --force"
  exit 1
fi
[ -n "$SIGNATURE" ] && ok "Firma encontrada en: $SIGNATURE"

# --- Localizar index.html principal ---
INDEX_HTML=""
for cand in "$TARGET/index.html" "$TARGET/dist/index.html" "$TARGET/public/index.html"; do
  if [ -f "$cand" ] && grep -q "og:image\|name=\"description\"" "$cand" 2>/dev/null; then
    INDEX_HTML="$cand"; break
  fi
done
[ -n "$INDEX_HTML" ] && ok "index.html: $INDEX_HTML" || warn "index.html no encontrado (se omitirá el parche de metas)"

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo -e "\n${GREEN}${BOLD}Verificación OK: parece el proyecto de producción.${NC}"
  echo "Ejecuta sin --check para aplicar los fixes."
  exit 0
fi

# --- Backup ---
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="$TARGET/.seo-backup-$STAMP"
mkdir -p "$BACKUP"
echo -e "\n${BOLD}== Backup en .seo-backup-$STAMP ==${NC}"

backup_file() {
  local f="$1"
  local rel="${f#$TARGET/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp "$f" "$BACKUP/$rel"
}

# --- 1. Archivos estáticos → public/ (o raíz si no hay public/) ---
echo -e "\n${BOLD}== 1/4 robots.txt, sitemap.xml, og-image.jpg ==${NC}"
PUBLIC_DIR="$TARGET/public"
[ -d "$PUBLIC_DIR" ] || PUBLIC_DIR="$TARGET"
for f in robots.txt sitemap.xml og-image.jpg; do
  dest="$PUBLIC_DIR/$f"
  [ -f "$dest" ] && backup_file "$dest"
  cp "$FIXES_DIR/$f" "$dest"
  ok "$f → ${dest#$TARGET/}"
done

# --- 2. Imágenes optimizadas (mismo nombre de archivo) ---
echo -e "\n${BOLD}== 2/4 Imágenes optimizadas ==${NC}"
REPLACED=0; NOTFOUND=0
for img in "$FIXES_DIR/images-optimizadas/"*; do
  fname=$(basename "$img")
  matches=$(find "$TARGET" -name "$fname" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.seo-backup-*" 2>/dev/null || true)
  if [ -n "$matches" ]; then
    while IFS= read -r m; do
      backup_file "$m"
      cp "$img" "$m"
      REPLACED=$((REPLACED+1))
      ok "$fname → ${m#$TARGET/}"
    done <<< "$matches"
  else
    NOTFOUND=$((NOTFOUND+1))
    warn "$fname no está en este proyecto (normal si el hash cambió: cópiala manual a los assets del build)"
  fi
done
echo -e "  ${BOLD}Reemplazadas: $REPLACED · No encontradas: $NOTFOUND${NC}"

# --- 3. Parche de metas en index.html ---
echo -e "\n${BOLD}== 3/4 Meta tags en index.html ==${NC}"
if [ -n "$INDEX_HTML" ]; then
  backup_file "$INDEX_HTML"
  N1=$(grep -c "images/artworks/marilyn-rocks-hq-5.webp" "$INDEX_HTML" || true)
  perl -pi -e 's{https://naroa\.online/images/artworks/marilyn-rocks-hq-5\.webp}{https://naroa.online/og-image.jpg}g' "$INDEX_HTML"
  perl -0777 -pi -e 's{<meta name="description" content="[^"]*"\s*/?>}{<meta name="description" content="Retratos hiperrealistas por encargo en Bilbao. Acrílico sobre pizarra y mica mineral. Retratos de pareja, familiares y mascotas. Envío a toda España.">}g' "$INDEX_HTML"
  ok "og:image/twitter:image → /og-image.jpg ($N1 apariciones)"
  ok "meta description → 152 caracteres"
else
  warn "Sin index.html que parchear — aplica meta-tags-head.html a mano"
fi

# --- 4. CSP (manual) ---
echo -e "\n${BOLD}== 4/4 Content-Security-Policy ==${NC}"
if [ -f "$TARGET/vercel.json" ]; then
  warn "Ya existe vercel.json — fusiona la cabecera CSP de $FIXES_DIR/vercel.json a mano"
else
  cp "$FIXES_DIR/vercel.json" "$TARGET/vercel.json"
  ok "vercel.json creado con la cabecera CSP (prueba antes en preview)"
fi

# --- Resumen ---
echo -e "\n${GREEN}${BOLD}══ Fixes aplicados ══${NC}"
echo -e "Backup de todo lo sobrescrito en: ${BOLD}$BACKUP${NC}"
cat <<EOF

${BOLD}Siguientes pasos:${NC}
  1. Revisa los cambios:   cd "$TARGET" && git diff
  2. Despliega DESDE ESE PROYECTO (nunca desde el repo 3D):
       npm run build && vercel --prod     # o tu flujo habitual (git push, etc.)
  3. Verifica en producción:
       curl -sI https://naroa.online/og-image.jpg | head -1          # → 200
       curl -s https://naroa.online/sitemap.xml | grep -c image:loc  # → 29
  4. Reenvía el sitemap en Google Search Console y valida las cards:
       https://developers.facebook.com/tools/debug/
EOF
