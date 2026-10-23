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
The artist profile adds a sticky, native portrait sequence and a continuous
40-work exhibition. The camera
moves into Naroa’s monocle eye after her brief photographic wink, dissolves into
the eye of her Rara Avis self-portrait and opens into its full-screen framing.
Both pupils share a camera axis and a rendered iris diameter throughout the
crossfade. A small common push carries the match forward; quintic easing and
logarithmic zoom keep the approach and reveal continuous. Coordinates account
for each image’s cover crop, including mobile framing. High-resolution source
derivatives support the close-up. The artwork link appears only at the end;
its invisible state is inert. Slow image loading cannot dissolve to a blank
frame. There is no timer, wheel interception or route change. Scrolling back
retraces the whole sequence. The same Rara Avis element starts the exhibition at the exact same framing;
there is no stage hand-off, page navigation or reset. Eight further eye matches
join Rara Avis, Marilyn, Amy, Johnny, RockaGipsy, Berto, Buena Fuente, James and
Elene. The other works use continuous depth dissolves with matching endpoint
poses. All 40 reviewed works appear exactly once, with the current title, count,
artwork link, native arrow navigation and a direct biography shortcut. The index
selects a work within the same artist-page scroll. Only the current image and its
neighbours are retained; an undecoded pair keeps the last painted frame visible.
Reduced motion collapses the sequence to the original static portrait.
Editorial sections reveal once as they enter the viewport; menus and images
respond to interaction. Reduced-motion preferences disable these enhancements. Arrow controls, keyboard navigation, a complete-image view
and a reduced-motion alternative remain available. Native dialogs manage focus
for the menu, catalogue, artwork details and photo viewer.

`deploy.sh --build-only` assembles the immersive portfolio and the existing React
laboratory. The public portfolio deployment uses `.deploy/`; the laboratory
continues to use `dist/`. The Cloudflare and Vercel project identities are kept.

## Wink animation asset

The built-in ImageGen tool produced `classic/images/sobre-mi/naroa-monoculo-guino.png`
as an animation variant of the original portrait. The site blends only a small,
feathered region around the monocle eye; the original remains the base image.

Final prompt (built-in tool, not CLI):

> Use case: identity-preserve. Edit target: the supplied black-and-white photograph of Naroa wearing a top hat and a painted monocle. Asset type: a single matching animation frame for an existing website portrait. Change ONLY the eye inside the painted monocle (the eye on the LEFT SIDE OF THE IMAGE): make that eye fully closed in a natural, playful wink, with a realistic closed upper eyelid and eyelashes. The other eye stays open exactly as photographed. Preserve the exact pixel framing, aspect ratio, face location, facial identity, neutral mouth, lighting, grain, monochrome tones, top hat, hair, hand, paintbrush, painted monocle, chain, signs and background. No camera movement, no crop, no face reshaping, no retouching or beautification. The closed eyelid must look photographic, not drawn or graphic. Return the full photograph at its original composition with only that single eyelid closed. This will be blended over the existing photo to create a short scroll-driven wink, so the monocle and eye corners must remain in exactly the same positions.
