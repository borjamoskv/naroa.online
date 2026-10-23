# Naroa · Immersive portfolio

The approved direction uses an artwork from edge to edge, scroll-linked parallax,
minimal navigation and optional artwork information. The same photographic
language carries through the artist profile, exhibitions, notebook, commissions
and contact pages.

## Source of truth

- `classic/data/catalogo.json`: 33 reviewed projects and their photographs.
- `classic/data/vaivenes.json`: eight Vaivenes entries, including Mario Moreno
  already present in the main catalogue; seven additional entries, 40 in total.
- `classic/data/exhibitions.json`: 21 documented exhibitions and source links.
- `classic/data/blog.json`: the artist's notebook excerpts and original links.

Source photographs, dates, descriptions and credits are retained. Entries whose
available image shows a drawing or a detail keep that qualification. No prices,
availability promises or sales claims are generated.

## Build and verify

```sh
python3 -m pip install -r tools/requirements-immersive.txt
pnpm install --frozen-lockfile
pnpm run build:site
pnpm run test:site
```

The build creates `.deploy/` without changing the reviewed source catalogue or
original images. It includes the existing canonical routes, all artwork pages,
the Vaivenes series, a searchable index, photo viewer, responsive editorial
pages, aliases, sitemap and a 404 page. Optimized derivatives and client assets
use content-based filenames. Original public image paths remain available.

The exhibition loads the current artwork and its neighbours rather than eagerly
decoding all 40 photographs. Scroll uses the browser’s native vertical movement and inertia. A sticky
full-screen stage follows real document scroll position, with no wheel
prevention, gesture lock, forced settling or separate animation loop.
Nearby arrow navigation scrolls smoothly; direct catalogue selections jump
to the selected artwork. Touch, browser zoom, Page Down and the scrollbar
remain native. Feathered diagonal and lateral reveals use smooth endpoint easing, deeper
opposing image movement and a transient oversized title. Three selected pairs
(Marilyn/Rara Avis, Johnny/RockaGipsy and Berto/Buenafuente) zoom into measured
pupil positions, align both eyes at the same viewport point and dissolve into
the next portrait before opening its framing. Coordinates account for each
image’s cover crop and responsive focal position. Photographs are unmodified.
Editorial sections reveal once as they enter the viewport; menus and images
respond to interaction. Reduced-motion preferences disable these enhancements. Arrow controls, keyboard navigation, a complete-image view
and a reduced-motion alternative remain available. Native dialogs manage focus
for the menu, catalogue, artwork details and photo viewer.

`deploy.sh --build-only` assembles the immersive portfolio and the existing React
laboratory. The public portfolio deployment uses `.deploy/`; the laboratory
continues to use `dist/`. The Cloudflare and Vercel project identities are kept.
