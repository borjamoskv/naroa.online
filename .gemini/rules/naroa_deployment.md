# naroa.online · Despliegue

La referencia es `AGENTS.md`, apartado «Subir es desplegar». Si esta regla y `AGENTS.md` se contradicen, manda `AGENTS.md`.

1. **Dominio canónico:** `https://naroagutierrezgil.com` (`ORIGIN` en `tools/build_immersive_site.py`).
2. **Lo que se publica:** `.deploy/`, que `tools/build_immersive_site.py` genera desde `classic/`. `vercel.json` lo compila con `./deploy.sh --build-only`. `live-site/` ya no interviene en la compilación ni en el despliegue.
3. **Subir es desplegar:** cada `git push` a `origin/master` lanza un despliegue de producción en Vercel. Avisar antes de subir.
4. **`./deploy.sh` sin `--build-only` publica desde la máquina:** sube `.deploy/` y `dist/` a Cloudflare Pages con `wrangler` (necesita `CLOUDFLARE_API_TOKEN` o una sesión de `npx wrangler login`) y después publica `.deploy/` en producción de Vercel con `vercel deploy --prebuilt --prod`.
5. **Estado de un despliegue:** `npx vercel ls` y `npx vercel inspect <url>`. No sondear el dominio público en bucle: activa el control anti-bots de Vercel.
