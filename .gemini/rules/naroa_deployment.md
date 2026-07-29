# naroa.online Deployment Protocol

1. **Canonical Production Domain**: `https://www.naroa.online`
   - Primary hosting platform: Vercel project `naroa.online`.
   - Post-build command: `npx vercel alias set <deployment_id> www.naroa.online` inside `live-site/`.

2. **Cloudflare Dual Deployment**:
   - If deploying via `./deploy.sh`, verify `CLOUDFLARE_API_TOKEN` is present or remind user of `npx wrangler login` if Wrangler auth expires.
   - Always ensure both root landing page and WebGL 3D gallery at `/sala-3d/` are compiled and synchronized.
