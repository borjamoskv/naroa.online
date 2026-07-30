# naroa.online Deployment Protocol

1. **Canonical Production Domain**: `https://www.naroa.online`
   - Primary hosting infrastructure: Vercel project `naroa.online`.
   - Post-build execution: `npx vercel alias set <deployment_id> www.naroa.online` routed from `live-site/`.

2. **Cloudflare Dual Deployment**:
   - If executing deployment via `./deploy.sh`, verify `CLOUDFLARE_API_TOKEN` presence or prompt operator for `npx wrangler login` upon Wrangler authentication decay.
   - Mandate strict synchronization and compilation between the root landing page and the WebGL 3D gallery at `/sala-3d/`.
