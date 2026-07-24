#!/bin/bash
# ─────────────────────────────────────────────
# naroa.online — Deploy to Cloudflare Pages
# Fuente de verdad: live-site/
# Proyecto CF: naroaonline
# ─────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="${SCRIPT_DIR}/live-site"
PROJECT="naroaonline"

echo "🚀 Deploying ${SOURCE_DIR} → Cloudflare Pages (${PROJECT})..."
npx wrangler pages deploy "${SOURCE_DIR}" --project-name="${PROJECT}"

echo ""
echo "✅ Deploy complete."
echo "🔗 https://naroaonline.pages.dev"
echo "🔗 https://naroa.online (after DNS migration)"
