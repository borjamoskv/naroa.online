#!/usr/bin/env python3
"""Build the complete immersive portfolio from the reviewed local catalogue.

No network calls, no edits to reviewed data or original photographs.
"""
import argparse
import base64
import hashlib
import json
import re
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import format_datetime
from html import escape as esc
from pathlib import Path
from urllib.parse import quote

try:
    from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter
except ImportError:
    sys.path = [p for p in sys.path if ".vercel_python_packages" not in p]
    for _mod in [k for k in list(sys.modules) if k == "PIL" or k.startswith("PIL.")]:
        del sys.modules[_mod]
    from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageFilter

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "classic"
ORIGIN = "https://naroagutierrezgil.com"
LABELS = {"pizarra": "Pizarra · DiviNos", "collage": "Dibujo y collage", "objetos": "Retratos y objetos", "caracterizacion": "Caracterización"}
CURATED = ["marilyn-rocks", "rara-avis", "amor-en-conserva", "amy-rocks", "entre-tantas-flores-de-dia", "johnny-rocks", "rockagipsy", "hugo-box"]

# Responsive artwork variants. Every 1800px "-view.webp" cover also ships as
# "-w{N}.webp" (q82) / "-w{N}.avif" (q62), N = target width, never larger than the view.
# 1280 exists because a 3:4 portrait drawn with object-fit:cover on a 375px phone at
# DPR 2 needs ~1250 device px; 1800 because a landscape work covering that same phone
# needs ~2200. The q88 "-view" is only for the enlarged fit view.
# classic/immersive/app.js mirrors these widths.
RESPONSIVE_WIDTHS = (640, 1024, 1280, 1600, 1800)
VIEW_LIMIT = 1800
try:
    from PIL import features as _pil_features
    AVIF = bool(_pil_features.check("avif"))
except Exception:
    AVIF = False
RESPONSIVE = {}  # view url -> (view_width, view_height)
_VIEW_IMG_RE = re.compile(r'<img\b[^>]*>')
_VIEW_SRC_RE = re.compile(r'(?<![\w-])src="(/immersive/media/[^"]+-view\.webp)"')


def variant_url(view_url, width, ext="webp"):
    return view_url[: -len("-view.webp")] + f"-w{width}.{ext}"


def view_srcset(view_url, ext="webp"):
    vw, vh = RESPONSIVE[view_url]
    entries = []
    for w in RESPONSIVE_WIDTHS:
        if w >= vw:
            # A variant at or past the view width is the full picture at q82, lighter than the q88 view.
            entries.append(f"{variant_url(view_url, w, ext)} {vw}w")
            break
        entries.append(f"{variant_url(view_url, w, ext)} {w}w")
    return ", ".join(entries)


def responsive_html(text):
    """Give every eager <img src="...-view.webp"> a WebP srcset (data-src stays for the JS loader)."""
    def fix(match):
        tag = match.group(0)
        src = _VIEW_SRC_RE.search(tag)
        if not src or src.group(1) not in RESPONSIVE or " srcset=" in tag:
            return tag
        extra = f' srcset="{view_srcset(src.group(1))}"'
        if " sizes=" not in tag:
            extra += ' sizes="100vw"'
        return tag[:src.end()] + extra + tag[src.end():]
    return _VIEW_IMG_RE.sub(fix, text)


def read_data(name):
    return json.loads((SOURCE / "data" / f"{name}.json").read_text())


def data_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def write(path, text):
    if path.suffix == ".html":
        text = responsive_html(text)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    media = output / "immersive" / "media"
    media.mkdir(parents=True, exist_ok=True)
    jobs = {}
    originals = set()

    def derivative(src, limit=1800, thumb=False, quality=None):
        source = SOURCE / src.lstrip("/")
        if not source.is_file():
            raise FileNotFoundError(f"Reviewed image missing: {src}")
        digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
        variant = "thumb" if thumb else "view" if limit == VIEW_LIMIT else f"view-{limit}"
        name = f"{source.stem}-{digest}-{variant}.webp"
        dest = media / name
        q = quality if quality is not None else (72 if thumb else 88)
        jobs[dest] = (source, limit, q, "WEBP", None)
        originals.add(src)
        url = "/immersive/media/" + name
        if variant == "view" and url not in RESPONSIVE:
            with Image.open(source) as probe:
                sw, sh = probe.size
                if probe.getexif().get(0x0112) in (5, 6, 7, 8):
                    sw, sh = sh, sw
            scale = min(1, VIEW_LIMIT / max(sw, sh))
            RESPONSIVE[url] = (max(1, round(sw * scale)), max(1, round(sh * scale)))
            for w in RESPONSIVE_WIDTHS:
                stem = f"{source.stem}-{digest}-w{w}"
                jobs[media / f"{stem}.webp"] = (source, VIEW_LIMIT, 82, "WEBP", w)
                if AVIF:
                    jobs[media / f"{stem}.avif"] = (source, VIEW_LIMIT, 62, "AVIF", w)
        return url

    catalogue = read_data("catalogo")
    series = read_data("vaivenes")
    sha_by_src = {}
    source_by_src = {}
    for p in catalogue["projects"]:
        for im in p["images"]:
            if im.get("sha256"):
                sha_by_src[im["src"]] = im["sha256"]
            if im.get("source"):
                source_by_src[im["src"]] = im["source"]
    for im in series["images"]:
        for photo in im.get("images", [im]):
            if photo.get("sha256"):
                sha_by_src[photo["src"]] = photo["sha256"]
            if photo.get("source"):
                source_by_src[photo["src"]] = photo["source"]
    image_meta_cache = {}

    def image_info(src):
        if src not in image_meta_cache:
            with Image.open(SOURCE / src.lstrip("/")) as im:
                image_meta_cache[src] = (im.width, im.height, Image.MIME.get(im.format, "image/jpeg"))
        return image_meta_cache[src]

    projects = []
    for cutout_src in (
        "/images/catalogo/la-pensadora-lips.webp",
        "/images/catalogo/pippi-monkey-cutout.webp",
        "/images/catalogo/bowie-star-cutout.webp",
        "/images/catalogo/commission-jaio-button.webp",
        "/images/catalogo/commission-amor-purple-rose.webp",
        "/images/catalogo/commission-amor-red-rose.webp",
        "/images/catalogo/commission-amor-calla.webp",
        "/images/catalogo/commission-rara-peacock.webp",
    ):
        if (SOURCE / cutout_src.lstrip("/")).is_file():
            originals.add(cutout_src)
    series_slugs = {im.get("work_slug", im.get("slug")) for im in series["images"]}
    for p in catalogue["projects"]:
        photographs = [{"src": derivative(im["src"]), "original": im["src"], "caption": im["caption"], "width": im["width"], "height": im["height"]} for im in p["images"]]
        cover_index = 2 if p["slug"] == "marilyn-rocks" else 0
        projects.append({"slug": p["slug"], "title": p["title"], "category": p["category"], "label": LABELS[p["category"]], "story": p["story"], "technique": p["technique"], "support": p["support"], "dimensions": p["dimensions"], "materials": p.get("materials"), "interaction": p.get("interaction"), "year": p["year"], "series": "Vaivenes" if p["slug"] in series_slugs else p["series"], "credit": p["credit"], "source": p["source"], "video": p.get("video"), "kind": p["kind"], "cover": photographs[cover_index]["src"], "thumb": derivative(p["images"][0]["src"], 480, True), "tile": derivative(p["images"][0]["src"], 960, quality=78), "photos": photographs, "stage": "obra"})
    known = {p["slug"] for p in projects}
    for im in series["images"]:
        slug = im.get("work_slug", im.get("slug"))
        if slug in known:
            continue
        known.add(slug)
        stage = im.get("stage", "obra")
        photos = im.get("images", [im])
        projects.append({"slug": slug, "title": im["title"], "category": "collage", "label": "Vaivenes" + (" · Detalle" if stage == "detalle" else " · Dibujo" if stage == "dibujo" else ""), "story": im["caption"], "technique": im.get("technique", "Pintura y collage" if stage != "dibujo" else "Dibujo"), "support": im.get("support"), "dimensions": im.get("dimensions"), "materials": im.get("materials"), "year": None, "series": "Vaivenes", "credit": None, "source": im["source"], "kind": "obra", "cover": derivative(im["src"]), "thumb": derivative(im["src"], 480, True), "tile": derivative(im["src"], 960, quality=78), "photos": [{"src": derivative(photo["src"]), "original": photo["src"], "caption": photo["caption"], "width": photo["width"], "height": photo["height"]} for photo in photos], "stage": stage})
    # Order follows the canonical journey camera score.
    journey = read_data("journey")
    scene_index = {scene["slug"]: i for i, scene in enumerate(journey["scenes"])}
    projects.sort(key=lambda p: scene_index[p["slug"]])
    assert len(projects) == len(known)
    portrait = derivative("/images/sobre-mi/naroa-monoculo.jpg", 3468, quality=94)
    portrait_wink = derivative("/images/sobre-mi/naroa-monoculo-guino.png", 3468, quality=94)
    cantinflowers = derivative("/images/trayectoria/cantinflowers.jpg")
    assert [scene["slug"] for scene in journey["scenes"]] == [p["slug"] for p in projects], "Camera score must cover the ordered catalogue exactly"
    assert all(scene["mode"] in journey["durations"] for scene in journey["scenes"])
    content = {"journey": journey, "projects": projects, "reviewed": catalogue["reviewed"], "labels": LABELS, "avif": AVIF}
    amy = next(p for p in projects if p["slug"] == "amy-rocks")
    icon_viewbox = "131 56 223 223"
    icon_hash = hashlib.sha256((SOURCE / amy["photos"][0]["original"].lstrip("/")).read_bytes() + icon_viewbox.encode()).hexdigest()[:12]
    favicon_path = f"/immersive/favicon-amy-{icon_hash}.svg"
    def width_srcset(src, full_url, quality=86):
        """srcset with true width descriptors for a full-bleed photo (object-fit: cover)."""
        sw, sh = image_info(src)[:2]
        entries = []
        for w in RESPONSIVE_WIDTHS[:-1]:
            if w >= sw:
                break
            limit = -(-w * max(sw, sh) // sw)  # long side that yields width w
            entries.append(f"{derivative(src, limit, quality=quality)} {round(sw * limit / max(sw, sh))}w")
        entries.append(f"{full_url} {sw}w")
        return ", ".join(entries)

    portrait_srcset = width_srcset("/images/sobre-mi/naroa-monoculo.jpg", portrait)
    portrait_wink_srcset = width_srcset("/images/sobre-mi/naroa-monoculo-guino.png", portrait_wink)
    # Full-bleed cover: a tall phone is height-bound (x0.9 = the 10% upscale tolerance of app.js).
    portrait_sizes = "(max-aspect-ratio: 2201/3468) calc(100vh * 0.5712), calc(90vw + 2px)"
    menu_portrait = derivative("/images/sobre-mi/naroa-monoculo.jpg", 900)
    menu_portrait_wink = derivative("/images/sobre-mi/naroa-monoculo-guino.png", 900)
    menu_flowers = derivative("/images/trayectoria/cantinflowers.jpg", 900)
    menu_img_luz = derivative("/images/menu/menu-01-luz.jpg", 900)
    menu_img_celia = derivative("/images/menu/menu-02-celia.jpg", 900)
    menu_img_manostijeras = derivative("/images/menu/menu-03-manostijeras.jpg", 900)
    menu_img_bastidor = derivative("/images/menu/menu-04-bastidor-flores.jpg", 900)
    menu_img_homer_pepe = derivative("/images/menu/menu-05-homer-pepe.jpg", 900)
    menu_img_cuaderno = derivative("/images/menu/menu-05-cuaderno-twister.jpg", 900)
    cuaderno_hero = derivative("/images/cuaderno/cuaderno-twister-collage.jpg", 2048, quality=92)
    menu_img_iloveyou = derivative("/images/menu/menu-06-iloveyou.jpg", 900)
    menu_img_frankenstein = derivative("/images/menu/menu-07-frankenstein.jpg", 900)
    menu_img_pepa = derivative("/images/menu/menu-08-pepa-glitter.jpg", 900)

    def generate_social_cards(source_dir, output_dir):
        import math
        social_dir = source_dir / "images/social"
        social_dir.mkdir(parents=True, exist_ok=True)
        target_social_dir = output_dir / "images/social"
        target_social_dir.mkdir(parents=True, exist_ok=True)

        font_mono_path = "/System/Library/Fonts/SFNSMono.ttf"
        font_serif_it_path = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"
        if not Path(font_serif_it_path).exists():
            font_serif_it_path = "/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf"
        try:
            font_micro = ImageFont.truetype(font_mono_path, 12)
            font_quote = ImageFont.truetype(font_serif_it_path, 15)
            font_cromo = ImageFont.truetype(font_serif_it_path, 13)
        except Exception:
            font_micro = font_quote = font_cromo = ImageFont.load_default()

        def create_card(filename, left_img_path, right_img_path, cromo_img_path, micro_tag, micro_quote, cromo_label, seed_phase=0.0, split_mode="split", version="v2"):
            W, H = 1200, 630
            # 1. Right / Secondary Plane (Focused in Right Half x=460..1200 so subject is 100% visible)
            right_plane = Image.new("RGB", (W, H), "#0b0c0a")
            if Path(right_img_path).exists():
                r_im = Image.open(right_img_path).convert("RGB")
                r_crop = ImageOps.fit(r_im, (760, H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.32))
                r_crop = r_crop.filter(ImageFilter.UnsharpMask(radius=1.1, percent=45, threshold=2))
                right_plane.paste(r_crop, (440, 0))

            # 2. Left / Primary Plane (Focused in Left Half x=0..680 so subject is 100% visible)
            left_plane = Image.new("RGB", (W, H), "#0b0c0a")
            if Path(left_img_path).exists():
                l_im = Image.open(left_img_path).convert("RGB")
                l_crop = ImageOps.fit(l_im, (700, H), method=Image.Resampling.LANCZOS, centering=(0.5, 0.30))
                l_crop = l_crop.filter(ImageFilter.UnsharpMask(radius=1.1, percent=48, threshold=2))
                left_plane.paste(l_crop, (0, 0))
            else:
                left_plane = right_plane.copy()

            # 3. Procedural Kintsugi Fracture Seam across Full-Bleed Canvas
            seam_pts = []
            for y in range(0, H + 1, 3):
                t = y / H
                base_x = 610 - (t - 0.5) * 170
                jag = (
                    math.sin(t * 17.0 + seed_phase) * 20.0
                    + math.sin(t * 43.0 + seed_phase * 2.1) * 9.0
                    + math.cos(t * 97.0 + seed_phase * 3.7) * 3.8
                )
                seam_pts.append((base_x + jag, y))

            # Build mask for Left Plane
            poly_left = [(0, 0)] + seam_pts + [(0, H)]
            left_mask = Image.new("L", (W, H), 0)
            ImageDraw.Draw(left_mask).polygon(poly_left, fill=255)

            # Cast deep physical shadow from the torn edge onto Right Plane
            shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            s_draw = ImageDraw.Draw(shadow_layer)
            shadow_poly = [(0, 0)] + [(x + 18, y + 8) for (x, y) in seam_pts] + [(0, H)]
            s_draw.polygon(shadow_poly, fill=(4, 5, 3, 195))
            shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(16))

            base_rgba = Image.alpha_composite(right_plane.convert("RGBA"), shadow_layer)
            base_rgba.paste(left_plane.convert("RGBA"), (0, 0), left_mask)

            # 4. Molten Gold Kintsugi Vein + Secondary Branch Cracks
            vein_glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            vg_draw = ImageDraw.Draw(vein_glow)
            vg_draw.line(seam_pts, fill=(212, 175, 55, 190), width=14, joint="curve")
            vein_glow = vein_glow.filter(ImageFilter.GaussianBlur(8))
            base_rgba = Image.alpha_composite(base_rgba, vein_glow)

            vein_core = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            vc_draw = ImageDraw.Draw(vein_core)
            # Raw fibrous paper edge on left side of crack
            deckle_pts = [(x - 3.5, y) for (x, y) in seam_pts]
            vc_draw.line(deckle_pts, fill=(255, 253, 244, 150), width=3)
            # Main gold leaf vein
            vc_draw.line(seam_pts, fill=(247, 213, 148, 255), width=4, joint="curve")
            # Specular white-gold core
            spec_pts = [(x + 0.8, y) for (x, y) in seam_pts]
            vc_draw.line(spec_pts, fill=(255, 255, 255, 235), width=1)

            # Secondary Kintsugi lightning branches
            for b_idx in (len(seam_pts) // 4, (len(seam_pts) * 2) // 3):
                bx, by = seam_pts[b_idx]
                direction = 1 if b_idx % 2 == 0 else -1
                b_pts = [(bx, by)]
                for step in range(1, 9):
                    bx += direction * (14 + math.sin(step * 2.3 + seed_phase) * 5)
                    by += 9 + math.cos(step * 1.9) * 6
                    b_pts.append((bx, by))
                vc_draw.line(b_pts, fill=(247, 213, 148, 210), width=2)
                vc_draw.line(b_pts, fill=(255, 255, 255, 160), width=1)

            base_rgba = Image.alpha_composite(base_rgba, vein_core)

            # 5. Physical Tilted Studio Cromo / Polaroid pinned in bottom-right
            if Path(cromo_img_path).exists():
                cw, ch = 228, 268
                cromo_canvas = Image.new("RGBA", (cw + 80, ch + 80), (0, 0, 0, 0))
                # Deep 3D drop shadow
                c_shad = Image.new("RGBA", (cw + 80, ch + 80), (0, 0, 0, 0))
                ImageDraw.Draw(c_shad).rounded_rectangle([46, 52, 46 + cw, 52 + ch], radius=6, fill=(4, 5, 3, 215))
                c_shad = c_shad.filter(ImageFilter.GaussianBlur(14))
                cromo_canvas = Image.alpha_composite(cromo_canvas, c_shad)

                # Cotton gallery paper body
                c_draw = ImageDraw.Draw(cromo_canvas)
                c_draw.rounded_rectangle([36, 36, 36 + cw, 36 + ch], radius=5, fill=(252, 249, 242, 255), outline=(212, 175, 55, 160), width=1)

                # Inner artwork photo
                c_im = Image.open(cromo_img_path).convert("RGB")
                c_crop = ImageOps.fit(c_im, (cw - 24, ch - 58), method=Image.Resampling.LANCZOS, centering=(0.5, 0.38))
                c_crop = c_crop.filter(ImageFilter.UnsharpMask(radius=0.9, percent=38, threshold=2))
                cromo_canvas.paste(c_crop.convert("RGBA"), (48, 48))

                # Micro caption on the polaroid bottom margin
                c_draw.text((52, 36 + ch - 29), cromo_label, fill=(35, 26, 7, 230), font=font_cromo)

                # Piece of translucent studio masking tape at top center
                c_draw.polygon(
                    [(36 + cw // 2 - 34, 26), (36 + cw // 2 + 36, 29), (36 + cw // 2 + 33, 47), (36 + cw // 2 - 37, 44)],
                    fill=(245, 236, 212, 185),
                    outline=(215, 202, 170, 140)
                )

                cromo_rot = cromo_canvas.rotate(-6.2, resample=Image.Resampling.BICUBIC, expand=True)
                base_rgba.alpha_composite(cromo_rot, (W - cromo_rot.width - 28, H - cromo_rot.height - 16))

            # 6. Subtle Cinema Vignette on bottom-left for micro-jewel legibility
            vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            v_draw = ImageDraw.Draw(vignette)
            v_draw.ellipse([-180, H - 220, 760, H + 180], fill=(5, 6, 4, 155))
            vignette = vignette.filter(ImageFilter.GaussianBlur(55))
            base_rgba = Image.alpha_composite(base_rgba, vignette)

            # 7. Micro-Joya Luminous Frosted Capsule (Tiny, Pure White, Specular Glow)
            pill_x, pill_y = 36, H - 92
            pill_w, pill_h = 620, 62
            # Frosted dark glass backing
            crop_bg = base_rgba.crop((pill_x, pill_y, pill_x + pill_w, pill_y + pill_h)).filter(ImageFilter.GaussianBlur(14))
            dark_tint = Image.new("RGBA", (pill_w, pill_h), (8, 9, 7, 172))
            frosted = Image.alpha_composite(crop_bg, dark_tint)
            pill_mask = Image.new("L", (pill_w, pill_h), 0)
            ImageDraw.Draw(pill_mask).rounded_rectangle([0, 0, pill_w - 1, pill_h - 1], radius=12, fill=255)
            base_rgba.paste(frosted, (pill_x, pill_y), pill_mask)

            # Hairline luminous border + text glow
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            o_draw = ImageDraw.Draw(overlay)
            o_draw.rounded_rectangle([pill_x, pill_y, pill_x + pill_w - 1, pill_y + pill_h - 1], radius=12, outline=(255, 255, 255, 78), width=1)

            # Specular white glow behind tiny text + vector 4-point star
            sx, sy = pill_x + 22, pill_y + 18
            star_poly = [(sx, sy - 6), (sx + 1.8, sy - 1.8), (sx + 6, sy), (sx + 1.8, sy + 1.8), (sx, sy + 6), (sx - 1.8, sy + 1.8), (sx - 6, sy), (sx - 1.8, sy - 1.8)]
            glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            g_draw = ImageDraw.Draw(glow_layer)
            g_draw.polygon(star_poly, fill=(247, 213, 148, 255))
            g_draw.text((pill_x + 36, pill_y + 11), micro_tag, fill=(255, 255, 255, 210), font=font_micro)
            g_draw.text((pill_x + 18, pill_y + 32), micro_quote, fill=(255, 255, 255, 185), font=font_quote)
            glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(3.5))
            base_rgba = Image.alpha_composite(base_rgba, glow_layer)

            o_draw.polygon(star_poly, fill=(255, 253, 244, 255))
            o_draw.text((pill_x + 36, pill_y + 11), micro_tag, fill=(255, 255, 255, 255), font=font_micro)
            o_draw.text((pill_x + 18, pill_y + 32), micro_quote, fill=(255, 255, 255, 255), font=font_quote)
            base_rgba = Image.alpha_composite(base_rgba, overlay)

            card = base_rgba.convert("RGB")
            dest_src = social_dir / filename
            card.save(dest_src, quality=95, subsampling=0, optimize=True)
            dest_deploy = target_social_dir / filename
            shutil.copy2(dest_src, dest_deploy)
            # Also write a cache-busted sibling so WhatsApp/Twitter scrapers refresh immediately;
            # bump `version` whenever a card's picture or text changes.
            v2_name = filename.replace(".jpg", f"-{version}.jpg")
            # A superseded sibling must not stay published with the old picture or text.
            for folder in (social_dir, target_social_dir):
                for stale in folder.glob(filename.replace(".jpg", "-v*.jpg")):
                    if stale.name != v2_name:
                        stale.unlink()
            shutil.copy2(dest_src, social_dir / v2_name)
            shutil.copy2(dest_src, target_social_dir / v2_name)

        create_card(
            "naroa-share-card-home.jpg",
            source_dir / "images/sobre-mi/naroa-monoculo.jpg",
            source_dir / "images/catalogo/marilyn-rocks-4k.webp",
            source_dir / "images/menu/menu-01-luz.jpg",
            f"NAROA GUTIÉRREZ GIL  ·  {len(projects)} OBRAS EN BILBAO",
            "«Me encontré a mí en los demás: espejos de vuestras almas y la mía».",
            "Rara Avis · Espejos del Alma",
            seed_phase=0.4
        )
        create_card(
            "naroa-share-card-cuaderno.jpg",
            source_dir / "images/cuaderno/cuaderno-twister-collage.jpg",
            source_dir / "images/menu/menu-05-homer-pepe.jpg",
            source_dir / "images/menu/menu-04-bastidor-flores.jpg",
            "CUADERNO DE ESTUDIO  ·  BILBAO",
            "«Comienzo a rascar sobre la base y encuentro una textura inédita».",
            "Apuntes y materia viva",
            seed_phase=1.2
        )
        create_card(
            "naroa-share-card-trayectoria.jpg",
            source_dir / "images/catalogo/mario-moreno-hq-01.webp",
            source_dir / "images/catalogo/cantinflowers-4k.webp",
            source_dir / "images/menu/menu-04-bastidor-flores.jpg",
            "TRAYECTORIA  ·  EL RASGADO KINTSUGI (2013 - 2026)",
            "«El arte también sale de paseo: una galería sin muros, de tú a tú».",
            "Walking Gallery · Bilbao",
            seed_phase=2.5,
            split_mode="aligned_dual"
        )
        create_card(
            "naroa-share-card-sobre-mi.jpg",
            source_dir / "images/sobre-mi/naroa-monoculo.jpg",
            source_dir / "images/menu/menu-03-manostijeras.jpg",
            source_dir / "images/catalogo/marilyn-rocks-4k.webp",
            "NAROA GUTIÉRREZ GIL  ·  RETRATISTA EN BILBAO",
            # Cita literal (Iconos Pop, 2020): lo que va entre « » en la tarjeta también lo dijo Naroa.
            "«Me encontré a mí en los demás».",
            "Marilyn Rocks · DiviNos",
            seed_phase=3.1,
            version="v3"
        )
        create_card(
            "naroa-share-card-encargos.jpg",
            source_dir / "images/menu/menu-06-iloveyou.jpg",
            source_dir / "images/catalogo/marilyn-rocks-4k.webp",
            source_dir / "images/sobre-mi/naroa-monoculo.jpg",
            "RETRATOS POR ENCARGO  ·  BILBAO",
            "«Cada rostro guarda un mundo: pizarra, madera, collage y pan de oro».",
            "Encargo a medida · Estudio",
            seed_phase=4.0
        )
        create_card(
            "naroa-share-card-vaivenes.jpg",
            source_dir / "images/menu/menu-02-celia.jpg",
            source_dir / "images/menu/menu-08-pepa-glitter.jpg",
            source_dir / "images/menu/menu-05-homer-pepe.jpg",
            "SERIE VAIVENES  ·  COLLAGE Y MATERIA",
            "«Rostros conocidos, emociones propias y materiales con segunda vida».",
            "DiviNos VaiVenes",
            seed_phase=5.2
        )
        create_card(
            "naroa-share-card-contacto.jpg",
            source_dir / "images/menu/menu-07-frankenstein.jpg",
            source_dir / "images/sobre-mi/naroa-monoculo.jpg",
            source_dir / "images/menu/menu-06-iloveyou.jpg",
            "ESTUDIO EN BILBAO  ·  CONTACTO DIRECTO",
            "«¿Qué historia retratamos? Escríbeme y le damos forma juntos».",
            "naroagutierrezgil.com",
            seed_phase=6.1
        )

        def create_story_card():
            SW, SH = 2160, 3840
            story = Image.new("RGB", (SW, SH), "#080807")

            center_path = source_dir / "images/sobre-mi/naroa-monoculo.jpg"
            if center_path.exists():
                c_im = Image.open(center_path).convert("RGB")
                c_crop = ImageOps.fit(c_im, (SW, SH), method=Image.Resampling.LANCZOS, centering=(0.5, 0.42))
                story = c_crop.filter(ImageFilter.UnsharpMask(radius=0.9, percent=32, threshold=2))

            dest_src = social_dir / "naroa-story-card-1080x1920.jpg"
            story.save(dest_src, quality=98, subsampling=0, optimize=True)
            dest_deploy = target_social_dir / "naroa-story-card-1080x1920.jpg"
            shutil.copy2(dest_src, dest_deploy)

        create_story_card()

    generate_social_cards(SOURCE, output)
    assets = {}
    for name in ("app.css", "app.js", "journey.js", "soundscape.js"):
        src = SOURCE / "immersive" / name
        digest = hashlib.sha256(src.read_bytes()).hexdigest()[:12]
        dest = output / "immersive" / f"{src.stem}-{digest}{src.suffix}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        assets[name] = "/" + str(dest.relative_to(output))
    # La banda sonora es síntesis en el navegador: solo se publica su ficha de créditos.
    (output / "immersive/audio").mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE / "audio/CREDITS.md", output / "immersive/audio/creditos.txt")
    encoded = "window.NAROA_CATALOG=" + data_json(content) + ";\n"
    digest = hashlib.sha256(encoded.encode()).hexdigest()[:12]
    catalog_path = f"/immersive/catalog-{digest}.js"
    write(output / catalog_path.lstrip("/"), encoded)

    for icon_name in ("naroa-icon-180-v1.png", "naroa-icon-64-v1.png", "naroa-icon-32-v1.png"):
        icon_src = SOURCE / "assets" / icon_name
        if icon_src.exists():
            dest_asset = output / "assets" / icon_name
            dest_asset.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(icon_src, dest_asset)
    apple_touch_src = SOURCE / "assets" / "naroa-icon-180-v1.png"
    if apple_touch_src.exists():
        shutil.copy2(apple_touch_src, output / "apple-touch-icon.png")

    cursors_src = SOURCE / "assets" / "cursors"
    if cursors_src.exists():
        cursors_dest = output / "assets" / "cursors"
        cursors_dest.mkdir(parents=True, exist_ok=True)
        for cf in cursors_src.glob("*.*"):
            shutil.copy2(cf, cursors_dest / cf.name)

    # Fotos de pared del fondo de Trayectoria (las genera tools/wall_textures.py).
    walls_src = SOURCE / "assets" / "walls"
    if walls_src.exists():
        walls_dest = output / "assets" / "walls"
        walls_dest.mkdir(parents=True, exist_ok=True)
        for wf in walls_src.glob("*.webp"):
            shutil.copy2(wf, walls_dest / wf.name)

    fonts_src = SOURCE / "assets" / "fonts"
    if fonts_src.exists():
        fonts_dest = output / "assets" / "fonts"
        fonts_dest.mkdir(parents=True, exist_ok=True)
        for ff in fonts_src.glob("*.*"):
            shutil.copy2(ff, fonts_dest / ff.name)

    manifest_data = {
        "name": "Naroa Gutiérrez Gil · Arte y Retratos",
        "short_name": "Naroa",
        "description": "Catálogo de obra plástica y servicio de retratos personalizados en Bilbao por Naroa Gutiérrez Gil.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#11120f",
        "theme_color": "#11120f",
        "icons": [
            {
                "src": "/assets/naroa-icon-180-v1.png",
                "sizes": "180x180",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": "/assets/naroa-icon-64-v1.png",
                "sizes": "64x64",
                "type": "image/png"
            },
            {
                "src": "/assets/naroa-icon-32-v1.png",
                "sizes": "32x32",
                "type": "image/png"
            },
            {
                "src": "/favicon.svg",
                "sizes": "any",
                "type": "image/svg+xml"
            }
        ]
    }
    manifest_json = json.dumps(manifest_data, ensure_ascii=False, indent=2) + "\n"
    write(output / "manifest.webmanifest", manifest_json)
    write(REPO / "public" / "manifest.webmanifest", manifest_json)

    def links():
        work = {p["slug"]: p for p in projects}
        vaivenes_list = [p for p in projects if p["series"] == "Vaivenes"]
        def frame(slug, meta=None):
            # Imagen, título y enlace salen siempre de la misma ficha: el nombre no puede descuadrarse de la obra.
            w = work[slug]
            return {"src": w["tile"], "title": w["title"], "meta": meta or w["label"], "href": f"/obra/{slug}/"}
        obras_reel = [frame("amy-rocks"), frame("marilyn-rocks"), frame("rara-avis"), frame("hugo-box")]
        trayectoria_reel = [frame("custom-jaio"), frame("cantinflowers"), frame("rara-avis"), frame("amor-en-conserva")]
        cuaderno_reel = [frame("entre-tantas-flores-de-dia"), frame("la-llorona"), frame("mario-moreno"), frame("infusion-de-berto")]
        encargos_reel = [frame("custom-jaio", "Retrato personalizado a medida · Bilbao"), frame("hugo-box", "Caja de madera intervenida · Regalo a medida"), frame("13n", "Retrato doble en plato de madera y pan de oro"), frame("lauralore", "Retrato con cerámica y eguzkilore en marco")]
        def reel_attr(seq):
            if not seq:
                return ""
            return f' data-preview-reel="{esc(json.dumps(seq, ensure_ascii=False, separators=(",", ":")))}"'
        items = [
            # Cuatro secciones: Vaivenes vive dentro de Obras y Trayectoria dentro de Naroa (último campo: rutas hijas).
            ("/obra/", "Obras", f"{len(projects)} retratos · Un viaje", obras_reel[0]["src"], obras_reel[0]["title"], "Otra manera de mirar.", f"Pizarra, collage, Vaivenes y objetos · {len(projects)} obras", False, obras_reel, "#4a72bd", "/series/"),
            ("/sobre-mi/", "Naroa", "La artista y su trayectoria", menu_portrait, "Naroa Gutiérrez Gil", "Me encontré a mí en los demás.", "Retratista y artista plástica · Bilbao", False, None, "#3f63ab", "/trayectoria/"),
            ("/cuaderno/", "Blog", "Su WordPress, al día", cuaderno_reel[0]["src"], cuaderno_reel[0]["title"], "Apuntes desde el estudio.", "Historias de obras, procesos y encuentros", False, cuaderno_reel, "#2e5090", ""),
            ("/retratos-por-encargo-bilbao/", "Encargos", "Un retrato con tu historia · Contacto", encargos_reel[0]["src"], encargos_reel[0]["title"], "Cada rostro guarda un mundo.", "Retrato personalizado a medida · Bilbao", True, encargos_reel, "#6b395c", ""),
        ]
        return ''.join(f'''<a href="{href}" style="--item-idx:{i-1}" data-menu-item data-menu-index="{i-1}"{f' data-menu-also="{also}"' if also else ''} data-preview-src="{src}" data-preview-title="{esc(title)}" data-preview-label="{esc(label)}" data-preview-quote="{esc(quote_text)}" data-preview-meta="{esc(meta_text)}" data-preview-glow="{glow}"{' data-preview-wink="true"' if wink else ''}{reel_attr(reel)}><span class="menu-number" aria-hidden="true" title="Atajo de teclado: {i}">{i:02}</span><span class="menu-name">{label}<small data-menu-item-detail>{detail}</small>{season_menu if href == "/retratos-por-encargo-bilbao/" else ""}</span><span class="menu-arrow" aria-hidden="true">↗</span></a>''' for i, (href, label, detail, src, title, quote_text, meta_text, wink, reel, glow, also) in enumerate(items, 1))

    share_svgs = {
        "instagram": '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
        "facebook": '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>',
        "tiktok": '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.7V16a7 7 0 1 1-7-7c.7 0 1.4.1 2 .3V12z"/></svg>',
        "x": '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    }

    def social_share_dock(url="", title="", is_finale=False):
        cls = "art-finale-share" if is_finale else "social-share-dock"
        attr = ' data-finale-share hidden' if is_finale else ''
        label = "Compartir recorrido:" if is_finale else "Compartir:"
        data_url = f' data-share-url="{esc(url)}"' if url else ''
        data_title = f' data-share-title="{esc(title)}"' if title else ''
        # Al final del recorrido: la Story con las obras donde más se detuvo la visita (nace oculta; app.js la enseña).
        visit = '<button type="button" class="visit-portrait-link" data-visit-portrait hidden>El retrato de tu visita <span aria-hidden="true">↗</span></button>' if is_finale else ''
        return f'''<div class="{cls}"{attr} role="group" aria-label="{label}"><span class="share-dock-label">{label}</span><div class="share-dock-buttons"><button type="button" class="share-btn share-btn--instagram" data-share-network="instagram"{data_url}{data_title} aria-label="Compartir en Instagram">{share_svgs["instagram"]}<span>Instagram</span></button><button type="button" class="share-btn share-btn--facebook" data-share-network="facebook"{data_url}{data_title} aria-label="Compartir en Facebook">{share_svgs["facebook"]}<span>Facebook</span></button><button type="button" class="share-btn share-btn--tiktok" data-share-network="tiktok"{data_url}{data_title} aria-label="Compartir en TikTok">{share_svgs["tiktok"]}<span>TikTok</span></button><button type="button" class="share-btn share-btn--x" data-share-network="x"{data_url}{data_title} aria-label="Compartir en X">{share_svgs["x"]}<span>X</span></button></div>{visit}</div>'''

    # Aviso de temporada: las fechas las pone Naroa en classic/data/encargos.json. Sin fecha no sale nada;
    # con fecha pasada tampoco (aquí al compilar y en app.js al abrir la página).
    season_cfg = read_data("encargos").get("navidad") or {}
    season_months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    season_today = datetime.now().date()
    season_lines = []
    season_nav_lines = []
    for season_key, season_text, season_short in (("pedidos_hasta", "Para que llegue en Navidad, encargos hasta el {}.", "Navidad · encargos hasta el {}"), ("reyes_hasta", "Para Reyes, hasta el {}.", "Reyes · encargos hasta el {}")):
        season_iso = season_cfg.get(season_key)
        if season_iso and datetime.strptime(season_iso, "%Y-%m-%d").date() >= season_today:
            season_day = datetime.strptime(season_iso, "%Y-%m-%d").date()
            season_date = f"{season_day.day} de {season_months[season_day.month - 1]}"
            season_lines.append((season_iso, season_text.format(season_date)))
            season_nav_lines.append((season_iso, season_short.format(season_date)))
    season_note = ('<p class="season-note" data-season-note>' + ' '.join(f'<span data-until="{iso}">{esc(text)}</span>' for iso, text in season_lines) + '</p>') if season_lines else ''
    # En la cabecera va una sola línea, la del plazo que toca: enlaza a la página de encargos y solo
    # se ve con la página arriba del todo. Las páginas que ya llevan el aviso en el texto no la repiten.
    season_nav = ('<a class="season-nav" data-season-note href="/retratos-por-encargo-bilbao/">' + ''.join(f'<span data-until="{iso}">{esc(text)}</span>' for iso, text in season_nav_lines) + '</a>') if season_nav_lines else ''
    # Y en el menú, bajo «Encargos»: es donde lo encuentra quien navega en móvil, que no ve ese enlace en la cabecera.
    season_menu = ('<small class="menu-season" data-season-note data-i18n-unit="1">' + ''.join(f'<span data-until="{iso}">{esc(text)}</span>' for iso, text in season_nav_lines) + '</small>') if season_nav_lines else ''

    def header(gallery=False, season=True):
        return f'''<header class="site-nav"><a class="signature" href="/" aria-label="Naroa Gutiérrez Gil, inicio"><span>Naroa</span><small>GUTIÉRREZ GIL</small></a><nav aria-label="Principal"><a href="/obra/#indice" data-open-index>Obras</a><a class="desktop-link" href="/retratos-por-encargo-bilbao/">Encargos</a><a class="desktop-link" href="/contacto/">Contacto</a>{'<button type="button" data-quiet>Solo obra</button>' if gallery else '<a class="desktop-link" href="/sobre-mi/">La artista</a>'}<button type="button" class="sound-toggle" data-sound aria-label="Escuchar la banda sonora" title="Banda sonora del mes" aria-pressed="false"><svg class="sound-reel-icon" viewBox="0 0 24 16" aria-hidden="true"><rect x="1" y="2" width="22" height="12" rx="2.5"/><circle class="reel-wheel" cx="7.5" cy="8" r="3.2"/><circle cx="7.5" cy="8" r="0.9"/><circle class="reel-wheel" cx="16.5" cy="8" r="3.2"/><circle cx="16.5" cy="8" r="0.9"/><line x1="7.5" y1="4.8" x2="16.5" y2="4.8"/></svg><span>Sonido</span></button><button type="button" data-open-menu aria-haspopup="dialog" aria-controls="menu-dialog" aria-expanded="false">Menú <span aria-hidden="true">+</span></button></nav>{season_nav if season else ''}<span class="sound-status" data-sound-status role="status" hidden></span></header>'''

    def dialogs():
        counts = {
            'all': len(projects),
            'pizarra': sum(1 for p in projects if p.get('category') == 'pizarra' or p.get('series') == 'pizarra'),
            'collage': sum(1 for p in projects if p.get('category') == 'collage' or p.get('series') == 'collage'),
            'objetos': sum(1 for p in projects if p.get('category') == 'objetos' or p.get('series') == 'objetos'),
            'caracterizacion': sum(1 for p in projects if p.get('category') == 'caracterizacion' or p.get('series') == 'caracterizacion'),
            'Vaivenes': sum(1 for p in projects if p.get('series') == 'Vaivenes' or p.get('category') == 'Vaivenes')
        }
        index = ''.join(f'''<a class="index-work" href="/obra/{p['slug']}/" data-work="{p['slug']}" data-index-num="{idx+1:02d}" data-category="{p['category']}" data-series="{esc(p['series'] or '')}" data-cover="{esc(p['cover'])}" data-dimensions="{esc(p.get('dimensions') or '')}" data-photos-count="{len(p.get('photos') or [])}" data-story="{esc((p.get('story') or '')[:140])}" data-search="{esc(' '.join(str(p[k] or '') for k in ['title','technique','support','series','story','materials']))}"><div class="index-work-frame"><img src="{p['thumb']}" srcset="{p['thumb']} 480w, {p['tile']} 960w" sizes="(max-width:1099px) 50vw, (max-width:1699px) 34vw, 25vw" width="280" height="320" alt="{esc(p['title'])}" loading="lazy" decoding="async"><span class="index-work-num" aria-hidden="true">{idx+1:02d}</span><span class="index-work-whisper" aria-hidden="true">«{esc((p.get('story') or p.get('label') or '')[:92]).rstrip()}…»</span></div><span><small>{esc(p['label'])}</small><strong>{esc(p['title'])}</strong><em>{esc(p['support'] or p['technique'] or '')}{f" · {esc(p['dimensions'])}" if p.get('dimensions') else ""}</em></span><span class="stencil-stamp" aria-hidden="true">{esc((p.get('series') or p.get('category') or 'ORIGINAL').upper())}</span><span class="index-work-arrow" aria-hidden="true">↗</span></a>''' for idx, p in enumerate(projects))
        return f'''<dialog id="menu-dialog" class="menu-dialog" aria-labelledby="menu-heading"><div class="dialog-top menu-top"><a class="signature" href="/" aria-label="Naroa Gutiérrez Gil, inicio"><span>Naroa</span><small>GUTIÉRREZ GIL</small></a><span id="menu-heading">Otra manera de mirar</span><button type="button" data-close-dialog autofocus>Cerrar <span aria-hidden="true">×</span></button></div><div class="menu-layout"><figure class="menu-preview"><div class="menu-preview-picture" data-menu-picture data-preview-href="/obra/" title="Ir a la sección u obra en vista previa"><img data-menu-image alt="Amy Rocks" aria-hidden="true" width="480" height="360"><img data-menu-image alt="Amy Rocks" aria-hidden="true" width="480" height="360"><img class="menu-preview-wink" data-menu-wink data-dialog-src="{menu_portrait_wink}" alt="Guiño de Naroa Gutiérrez Gil" aria-hidden="true" width="480" height="360"><div class="menu-preview-loupe" data-menu-loupe aria-hidden="true"></div><div class="menu-preview-reel" data-menu-reel hidden aria-hidden="true"></div></div><figcaption class="menu-preview-caption"><div class="menu-caption-main"><span data-menu-preview-label>Obras</span><span class="menu-caption-quote" data-menu-quote>Otra manera de mirar.</span><span data-menu-preview-title>Amy Rocks</span></div><div class="menu-caption-sub"><span class="menu-preview-meta" data-menu-preview-meta>Pizarra, collage y objetos · {len(projects)} obras</span><div class="menu-caption-actions"><a class="menu-open-work-pill" href="/obra/" data-menu-open-work title="Entrar en esta vista"><span>Entrar</span><span aria-hidden="true">↗</span></a><button type="button" class="menu-index-pill" data-menu-open-index title="Abrir catálogo completo (atajo: / o I)"><span>Índice</span><span aria-hidden="true">⌕</span><kbd aria-hidden="true">/</kbd></button></div></div></figcaption></figure><nav class="menu-pages" aria-label="Todas las páginas">{links()}</nav></div><div class="menu-sound-drawer" data-menu-sound-drawer hidden aria-label="Paisaje sonoro y créditos"><div class="menu-sound-drawer-inner"><div class="menu-sound-col"><span class="menu-sound-eyebrow">BANDA SONORA ORIGINAL</span><strong class="menu-sound-theme" data-menu-melody-today>Banda sonora del mes</strong><p>Doce piezas originales para piano, una por mes, con trombones, ecos y el paisaje de la estación. Suena al pulsar SONIDO y calla ante <em>Game Over</em>.</p></div><div class="menu-sound-col"><span class="menu-sound-eyebrow">CRÉDITOS Y LICENCIAS DE AUDIO</span><p>Composición y síntesis WebAudio originales, sin muestras ni grabaciones de terceros, para el estudio de Naroa Gutiérrez Gil.</p><div class="menu-sound-links"><a href="/immersive/audio/creditos.txt" target="_blank" rel="noopener noreferrer">Ver ficha técnica completa (.txt) ↗</a><button type="button" data-close-sound-drawer>Ocultar ×</button></div></div></div></div><div class="menu-foot"><span>Desde Bilbao, con otra mirada. <em class="menu-kbd-hint" aria-hidden="true">· Teclas [1–6] Secciones · [/] Índice</em></span><a href="mailto:naroa@naroagutierrezgil.com">naroa@naroagutierrezgil.com ↗</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="/immersive/audio/creditos.txt" data-menu-sound-credits aria-expanded="false">Créditos del sonido ↗</a></div></dialog>
<dialog id="index-dialog" class="index-dialog" data-obra-view="muro" aria-labelledby="index-heading"><div class="index-backdrop" data-index-backdrop aria-hidden="true"><div class="index-backdrop-image" data-index-backdrop-img style="background-image:url('{projects[0]['cover']}')"></div><div class="index-backdrop-vignette"></div></div><div class="dialog-top"><h2 id="index-heading">La obra <span class="stencil-subtag" aria-hidden="true">✦ GABINETE DE MIRADAS &amp; MATERIA VIVA</span></h2><div class="index-top-actions"><div class="index-mode-switcher" role="group" aria-label="Modo de visualización del gabinete"><button type="button" data-obra-mode="muro" aria-pressed="true">Muro de Taller</button><button type="button" data-obra-mode="mesa" aria-pressed="false">Mesa de Luz</button><button type="button" data-obra-mode="constelacion" aria-pressed="false">Hilo Kintsugi</button></div><a class="index-oracle-btn" href="/series/vaivenes/" title="Ver solo la serie Vaivenes">Serie Vaivenes ↗</a><button type="button" class="index-oracle-btn" data-index-oracle title="Dejar que el azar elija una mirada"><span aria-hidden="true">🎲</span> <span class="oracle-word">Oráculo del </span>azar</button><button type="button" data-close-dialog class="stencil-close-btn">Cerrar ×</button></div></div><div class="index-controls"><label for="art-search"><span class="search-label-stencil">⌕ BUSCAR EN EL ESTUDIO // TRAZO, MATERIA O ROSTRO</span><input type="search" id="art-search" placeholder="Título, pizarra, lata, collage o personaje…" autocomplete="off"></label><div class="index-filters" role="group" aria-label="Filtrar obras"><button type="button" data-filter="all" aria-pressed="true"><span class="spray-dot" aria-hidden="true">●</span> Todas <span class="filter-num" aria-hidden="true">{counts['all']}</span></button><button type="button" data-filter="pizarra" aria-pressed="false"><span class="spray-dot" aria-hidden="true">●</span> Pizarra <span class="filter-num" aria-hidden="true">{counts['pizarra']}</span></button><button type="button" data-filter="collage" aria-pressed="false"><span class="spray-dot" aria-hidden="true">●</span> Collage <span class="filter-num" aria-hidden="true">{counts['collage']}</span></button><button type="button" data-filter="objetos" aria-pressed="false"><span class="spray-dot" aria-hidden="true">●</span> Objetos <span class="filter-num" aria-hidden="true">{counts['objetos']}</span></button><button type="button" data-filter="caracterizacion" aria-pressed="false"><span class="spray-dot" aria-hidden="true">●</span> Caracterización <span class="filter-num" aria-hidden="true">{counts['caracterizacion']}</span></button><button type="button" data-filter="Vaivenes" aria-pressed="false"><span class="spray-dot" aria-hidden="true">●</span> Vaivenes <span class="filter-num" aria-hidden="true">{counts['Vaivenes']}</span></button></div></div><div class="index-status-bar"><p class="index-count" role="status" aria-live="polite">{len(projects)} obras</p><div class="index-spotlight-hud" data-index-spotlight-hud aria-hidden="true"><span class="spotlight-hud-num" data-hud-num>01 / {len(projects):02d}</span><strong class="spotlight-hud-title" data-hud-title>{esc(projects[0]['title'])}</strong><span class="spotlight-hud-meta" data-hud-meta>{esc(projects[0]['label'])}</span><span class="spotlight-hud-quote" data-hud-quote>«{esc((projects[0].get('story') or '')[:110])}…»</span></div></div><div class="index-list">{index}</div><p class="index-empty" hidden>No hay obras que coincidan con esta búsqueda. <button type="button" data-reset-index>Ver todas</button></p></dialog>
<dialog id="story-remix-dialog" class="story-remix-dialog" aria-labelledby="story-remix-heading"><div class="dialog-top"><span id="story-remix-heading">Modo Story · Detail Obsession</span><button type="button" data-close-dialog autofocus>Cerrar ×</button></div><div class="story-remix-content"><div class="story-remix-preview-frame"><img data-story-remix-img alt="Story Detail Obsession de Naroa Gutiérrez Gil" width="360" height="640"><div class="story-remix-spinner" data-story-remix-spinner hidden><span>Buscando el detalle…</span></div></div><div class="story-remix-side"><p class="story-remix-eyebrow">Para tus Stories · 9:16</p><p class="story-remix-title" data-remix-title></p><p class="story-remix-meta" data-remix-meta></p><div class="story-remix-actions"><button type="button" class="remix-act remix-act--lead" data-remix-share><span>Compartir en Instagram</span><span aria-hidden="true">↗</span></button><a class="remix-act" data-remix-download href="#" download="naroa-detail-obsession.jpg"><span>Guardar la imagen</span><span aria-hidden="true">↓</span></a><button type="button" class="remix-act" data-remix-video-loop><span data-remix-label>Grabar un loop de 6 s con música</span><span aria-hidden="true">●</span></button><button type="button" class="remix-act" data-remix-shuffle><span>Probar con otra obra</span><span aria-hidden="true">↻</span></button><button type="button" class="remix-act" data-remix-visit hidden><span>El retrato de tu visita</span><span aria-hidden="true">◐</span></button></div><p class="story-remix-status" data-remix-status role="status"></p></div></div></dialog>
<dialog id="kintsugi-dialog" class="kintsugi-dialog" aria-labelledby="kintsugi-heading"><div class="dialog-top"><span id="kintsugi-heading" class="kintsugi-dialog-title">El Rasgado Kintsugi · 2013 ➔ 2021</span><button type="button" data-close-dialog autofocus>Cerrar ×</button></div><div class="kintsugi-dialog-body"><div class="kintsugi-stage" data-kintsugi-stage style="--split:50%"><div class="kintsugi-layer kintsugi-layer--color"><img data-src="/immersive/media/cantinflowers-rostro-4k-f585c8dca309-view.webp" decoding="async" alt="Cantinflowers (Color, 2021) — Acrílico rascado y collage" width="1350" height="1800"><div class="kintsugi-badge kintsugi-badge--color">2021 · Pandemia (Color)</div></div><div class="kintsugi-layer kintsugi-layer--bn"><img data-src="/immersive/media/mario-moreno-hq-01-b0d9bf3e15f7-view.webp" decoding="async" alt="Mario Moreno (Grafito, 2013) — Retrato en B/N" width="1375" height="1800"><div class="kintsugi-badge kintsugi-badge--bn">2013 · Grafito (B/N)</div></div><div class="kintsugi-seam" data-kintsugi-seam><div class="kintsugi-seam-glow"></div><div class="kintsugi-seam-line"></div><button type="button" class="kintsugi-handle" data-kintsugi-handle role="slider" aria-label="Deslizar rasgado Kintsugi" aria-valuenow="50" aria-valuemin="5" aria-valuemax="95"><span class="kintsugi-handle-gold">✦</span><span class="kintsugi-handle-icon">↔</span><span class="kintsugi-handle-text">Rasgar</span></button></div></div><aside class="kintsugi-quote-card"><p>«Comienzo a rascar sobre una base que no me permitía difuminar y ¡premio!, encuentro una textura inédita: puro kintsugi, el problema hecho trampolín».</p><cite>Naroa Gutiérrez Gil · De Mario Moreno (2013) a Cantinflowers (2021)</cite></aside></div></dialog>'''

    def footer():
        return f'''<footer class="site-footer"><a class="signature" href="/">Naroa</a>{social_share_dock()}<a href="mailto:naroa@naroagutierrezgil.com">naroa@naroagutierrezgil.com ↗</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href="/contacto/">¿Hablamos? ↗</a><span>Bilbao · © 2026</span></footer>'''

    pages = []

    artist_same_as = [
        "https://www.facebook.com/naroa.artista.plastica",
        "https://instagram.com/naroa_art/",
        "https://naroagutierrez.wordpress.com/",
        "https://www.deia.eus/bizkaia/vida-social/2026/06/05/bwall-collective-inaugura-exposicion-ocho-11159371.html",
        "https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-112114.html",
        "https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-476343.html",
        "https://gara.naiz.eus/paperezkoa/20130427/399965/es/Walking-gallery-arte-aire-libre-movimiento-arte-evolucion",
        "https://siarte.com/2022-03-25-siarte-exposicion-pintura-collage-arte-naroa-gutierrez.php",
        "https://www.youtube.com/@naroagutierrezgil",
    ]
    bilbao_place = {
        "@type": "Place",
        "@id": ORIGIN + "/#studio",
        "name": "Estudio Naroa Gutiérrez Gil · Bilbao",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Bilbao, Bizkaia",
            "addressLocality": "Bilbao",
            "addressRegion": "Bizkaia",
            "postalCode": "48001",
            "addressCountry": "ES",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 43.2630,
            "longitude": -2.9350,
        },
        "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
    }
    canonical_artist_entity = {
        "@type": "Person",
        "@id": ORIGIN + "/#artist",
        "name": "Naroa Gutiérrez Gil",
        "jobTitle": "Artista plástica y retratista",
        "url": ORIGIN + "/",
        "image": ORIGIN + "/images/sobre-mi/naroa-monoculo.jpg",
        "email": "naroa@naroagutierrezgil.com",
        "telephone": "+34636060609",
        "sameAs": artist_same_as,
        "homeLocation": bilbao_place,
        "workLocation": bilbao_place,
        "gender": "Female",
        "nationality": {
            "@type": "Country",
            "name": "España",
            "sameAs": "https://es.wikipedia.org/wiki/Espa%C3%B1a",
        },
        "description": "Artista plástica y retratista en Bilbao y Bizkaia. Obra figurativa y retrato de autor en dibujo, pintura, collage contemporáneo, madera y objetos intervenidos, con exploraciones recientes sobre pizarra natural.",
        "knowsAbout": [
            "Retrato por encargo en Bilbao",
            "Retratos artísticos personalizados",
            "Retrato al óleo, grafito y pastel Conté",
            "Collage contemporáneo y textil sobre madera",
            "Cajas tridimensionales y objetos de memoria",
            "Arte figurativo contemporáneo",
            "Walking Gallery Bilbao",
            "Pintura y técnica mixta sobre pizarra natural",
        ],
    }
    artist_ref = {
        "@type": "Person",
        "@id": ORIGIN + "/#artist",
        "name": "Naroa Gutiérrez Gil",
        "jobTitle": "Artista plástica y retratista",
        "url": ORIGIN + "/",
        "sameAs": artist_same_as,
    }

    webmcp_manifest = {
        "$schema": "https://modelcontextprotocol.io/schema/2024-11-05/server.json",
        "name": "naroa-online-webmcp",
        "version": "1.3.0",
        "description": "Servidor WebMCP oficial de Naroa Gutiérrez Gil: catálogo de obras de arte, Evidence Graph, perfiles canónicos de creador y orquestación de consultas de encargos en Bilbao.",
        "homepage": ORIGIN,
        "author": {
            "name": "Naroa Gutiérrez Gil",
            "url": ORIGIN + "/",
            "email": "naroa@naroagutierrezgil.com",
            "telephone": "+34636060609",
            "sameAs": artist_same_as,
        },
        "publisher": {
            "name": "Naroa Gutiérrez Gil",
            "url": ORIGIN + "/",
            "sameAs": artist_same_as,
        },
        "canonicalLocations": {
            "studio": {
                "name": "Estudio Naroa Gutiérrez Gil · Bilbao",
                "locality": "Bilbao",
                "region": "Bizkaia",
                "postalCode": "48001",
                "country": "ES",
                "geo": {"latitude": 43.2630, "longitude": -2.9350},
                "mapUrl": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
            }
        },
        "capabilities": {
            "tools": {
                "listChanged": False,
            },
            "resources": {
                "subscribe": False,
                "listChanged": False,
            },
        },
        "endpoints": {
            "catalog_api": f"{ORIGIN}/api/catalog.json",
            "rss_feed": f"{ORIGIN}/feed.xml",
            "llms_index": f"{ORIGIN}/llms.txt",
            "llms_full": f"{ORIGIN}/llms-full.txt",
        },
        "resources": [
            {
                "uri": f"{ORIGIN}/api/catalog.json",
                "name": "Catálogo Estructurado Completo",
                "description": "Especificaciones técnicas, descripciones y Evidence Graph de las obras.",
                "mimeType": "application/json",
            },
            {
                "uri": f"{ORIGIN}/feed.xml",
                "name": "Feed RSS de Publicaciones y Obras",
                "description": "Feed RSS 2.0 sindicado con novedades del estudio.",
                "mimeType": "application/rss+xml",
            },
            {
                "uri": f"{ORIGIN}/llms.txt",
                "name": "Índice Factual LLMs",
                "description": "Evidence Graph condensado y respuestas directas para agentes.",
                "mimeType": "text/plain",
            },
        ],
        "tools": [
            {
                "name": "search_catalogue",
                "description": "Busca obras en el catálogo de Naroa Gutiérrez Gil filtrando por término clave, técnica o serie.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Palabra clave a buscar en título, materiales, soporte o relato de la obra.",
                        },
                        "category": {
                            "type": "string",
                            "enum": ["all", "pizarra", "collage", "objetos", "caracterizacion", "Vaivenes"],
                            "description": "Categoría o serie plástica.",
                        },
                    },
                },
            },
            {
                "name": "get_artwork_details",
                "description": "Obtiene la ficha técnica verificada completa de una obra concreta por su slug canónico.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "slug": {
                            "type": "string",
                            "description": "Slug canónico de la obra (ej. 'amy-rocks', 'el-gran-dakari', 'amor-en-conserva').",
                        },
                    },
                    "required": ["slug"],
                },
            },
            {
                "name": "configure_commission_inquiry",
                "description": "Valida las opciones para encargar un retrato personalizado y devuelve los enlaces directos en O(1) para WhatsApp y correo electrónico.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "support": {
                            "type": "string",
                            "enum": [
                                "Pizarra natural rústica",
                                "Collage textil sobre madera",
                                "Caja personalizada u objeto",
                                "Retrato al óleo o grafito",
                                "Asesoramiento en estudio",
                            ],
                            "description": "Soporte plástico preferido para el retrato.",
                        },
                        "motif": {
                            "type": "string",
                            "enum": [
                                "Retrato individual",
                                "Pareja o familia",
                                "Mascota",
                                "Homenaje o recuerdo",
                            ],
                            "description": "Motivo del retrato.",
                        },
                        "timing": {
                            "type": "string",
                            "enum": [
                                "Sin prisa (2 a 4 semanas)",
                                "Fecha señalada próxima",
                            ],
                            "description": "Plazo estimado de entrega deseado.",
                        },
                        "note": {
                            "type": "string",
                            "description": "Historia personal, canción u objeto opcional para integrar en el retrato.",
                        },
                    },
                    "required": ["support", "motif"],
                },
            },
            {
                "name": "answer_commission_faq",
                "description": "Resuelve en O(1) las subconsultas del grafo Query Fan-Out sobre encargos de retratos (precios, plazos, fotos, soportes, entregas y comparativas).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "topic": {
                            "type": "string",
                            "enum": ["precios", "plazos", "fotos", "soportes", "envios", "todos"],
                            "description": "Dimensión factual a consultar en el Evidence Graph.",
                        }
                    },
                },
            },
            {
                "name": "get_artist_profile",
                "description": "Devuelve la información de biografía verificada, exposiciones históricas y canales directos de contacto.",
                "inputSchema": {
                    "type": "object",
                    "properties": {},
                },
            },
        ],
    }

    def page(path, title, description, body, image, gallery=False, schema=None, not_found=False, image_alt=None, card_alt=None):
        canonical = ORIGIN + path
        im_w, im_h, im_mime = image_info(image)
        im_alt = image_alt or f"{title} · Naroa Gutiérrez Gil"
        og_card_map = {
            "/": "/images/social/naroa-share-card-home-v2.jpg",
            "/obra/": "/images/social/naroa-share-card-home-v2.jpg",
            "/cuaderno/": "/images/social/naroa-share-card-cuaderno-v2.jpg",
            "/trayectoria/": "/images/social/naroa-share-card-trayectoria-v2.jpg",
            "/sobre-mi/": "/images/social/naroa-share-card-sobre-mi-v3.jpg",
            "/retratos-por-encargo-bilbao/": "/images/social/naroa-share-card-encargos-v2.jpg",
            "/series/vaivenes/": "/images/social/naroa-share-card-vaivenes-v2.jpg",
            "/contacto/": "/images/social/naroa-share-card-contacto-v2.jpg",
        }
        og_img_path = og_card_map.get(path, image)
        # La tarjeta social no es la fotografía de la página: si se describe aparte, ese es su alt.
        og_alt = card_alt if card_alt and og_img_path != image else im_alt
        og_w, og_h, og_mime = (1200, 630, "image/jpeg") if og_img_path.startswith("/images/social/naroa-share-card") else (im_w, im_h, im_mime)
        structured = dict(schema or {"@context": "https://schema.org", "@type": "WebPage", "name": title, "url": canonical, "description": description})
        structured.setdefault("inLanguage", "es-ES")
        structured.setdefault("dateModified", catalogue["reviewed"])
        if not not_found:
            primary_img = {
                "@type": "ImageObject",
                "contentUrl": f"{ORIGIN}{image}",
                "width": im_w,
                "height": im_h,
                "encodingFormat": im_mime,
                "caption": im_alt,
            }
            structured.setdefault("primaryImageOfPage", primary_img)
            if "@graph" in structured and len(structured["@graph"]) > 0:
                structured["@graph"][0].setdefault("primaryImageOfPage", primary_img)
                structured["@graph"][0].setdefault("inLanguage", "es-ES")
                structured["@graph"][0].setdefault("dateModified", catalogue["reviewed"])
        breadcrumb = None
        if not not_found and path != "/":
            section_name = "Obras" if path.startswith("/obra/") else "Vaivenes" if path.startswith("/series/vaivenes/") else title.split("·")[0].strip()
            items = [{"@type": "ListItem", "position": 1, "name": "Inicio", "item": ORIGIN + "/"}]
            if path.startswith("/obra/") and path != "/obra/":
                items.append({"@type": "ListItem", "position": 2, "name": "Obras", "item": ORIGIN + "/obra/"})
                items.append({"@type": "ListItem", "position": 3, "name": title.split("·")[0].strip(), "item": canonical})
            elif path.startswith("/series/vaivenes/") and path != "/series/vaivenes/":
                items.append({"@type": "ListItem", "position": 2, "name": "Vaivenes", "item": ORIGIN + "/series/vaivenes/"})
                items.append({"@type": "ListItem", "position": 3, "name": title.split("·")[0].strip(), "item": canonical})
            elif path.startswith("/retrato-de-"):
                items.append({"@type": "ListItem", "position": 2, "name": "Retratos por encargo", "item": ORIGIN + "/retratos-por-encargo-bilbao/"})
                items.append({"@type": "ListItem", "position": 3, "name": title, "item": canonical})
            else:
                items.append({"@type": "ListItem", "position": 2, "name": section_name, "item": canonical})
            breadcrumb = {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": items
            }
        breadcrumb_tag = f'<script type="application/ld+json" id="seo-breadcrumb">{data_json(breadcrumb)}</script>' if breadcrumb else ''
        slug_class = "page-" + (path.strip("/").replace("/", "-") or "home")
        html = f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>{esc(title)} · Naroa Gutiérrez Gil</title><meta name="description" content="{esc(description)}"><meta name="robots" content="index, follow, max-image-preview:large">{'<meta name="google-site-verification" content="ED9YrilUJ8fhvdH3FI6e9hpWaV2fK70_UfpwfrufLcc">' if path == "/" else ''}<meta name="theme-color" content="#11120f"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Naroa"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/assets/naroa-icon-180-v1.png"><link rel="alternate" type="application/rss+xml" title="Naroa Gutiérrez Gil · Obras y Blog" href="{ORIGIN}/feed.xml"><link rel="mcp" type="application/json" href="{ORIGIN}/.well-known/mcp.json" title="WebMCP Model Context Protocol"><link rel="canonical" href="{canonical}"><meta property="og:site_name" content="Naroa Gutiérrez Gil"><meta property="og:locale" content="es_ES"><meta property="og:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:type" content="{'article' if gallery and path not in ('/', '/obra/', '/series/vaivenes/') else 'website'}"><meta property="og:image" content="{ORIGIN}{og_img_path}"><meta property="og:image:secure_url" content="{ORIGIN}{og_img_path}"><meta property="og:image:width" content="{og_w}"><meta property="og:image:height" content="{og_h}"><meta property="og:image:type" content="{og_mime}"><meta property="og:image:alt" content="{esc(og_alt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{esc(title)} · Naroa Gutiérrez Gil"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{ORIGIN}{og_img_path}"><meta name="twitter:image:alt" content="{esc(og_alt)}"><link rel="icon" href="{favicon_path}" type="image/svg+xml" sizes="any"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@400;500&family=Playwrite+ES:wght@100..400&display=swap" rel="stylesheet"><link rel="stylesheet" href="{assets['app.css']}"><script type="application/ld+json" id="page-schema">{data_json(structured)}</script>{breadcrumb_tag}<script type="application/vnd.mcp+json" id="webmcp-schema">{data_json(webmcp_manifest)}</script><script defer src="{catalog_path}"></script><script defer src="{assets['soundscape.js']}"></script><script defer src="{assets['journey.js']}"></script><script defer src="{assets['app.js']}"></script></head><body class="{'gallery-page' if gallery else 'editorial-page'} {slug_class}"><a class="skip-link" href="#main">Ir al contenido</a>{header(gallery, 'data-season-note' not in body)}{body}{'' if gallery else footer()}{dialogs()}</body></html>'''
        dest = output / ("404.html" if not_found else path.lstrip("/") + "index.html")
        write(dest, html)
        if not not_found:
            pages.append((path, image, title, im_alt))

    def cover_dims(url):
        return f' width="{RESPONSIVE[url][0]}" height="{RESPONSIVE[url][1]}"' if url in RESPONSIVE else ''

    def cover_sizes(url):
        # .art-pan is the viewport + 10px each side and the picture is object-fit:cover,
        # so a portrait on a tall phone is height-bound: width = (100vh + 20px) * aspect.
        if url not in RESPONSIVE:
            return ''
        vw, vh = RESPONSIVE[url]
        # x0.9 matches the 10% upscale tolerance of artSrc() in app.js.
        return f' sizes="(max-aspect-ratio: {vw}/{vh}) calc((100vh + 20px) * {0.9 * vw / vh:.4f}), calc(90vw + 18px)"'

    def lens_preview(url):
        return variant_url(url, RESPONSIVE_WIDTHS[0]) if url in RESPONSIVE else url

    def work_alt(q, caption=None):
        medium = " · ".join(filter(None, [q.get("technique"), q.get("support")])) or q["label"]
        detail = f" ({caption})" if caption else ""
        return f"{q['title']}{detail} — {medium}, retrato artístico original de Naroa Gutiérrez Gil"

    def gallery(path, initial=0, subset="all", title=None, description=None, schema=None):
        selected = [p for p in projects if subset != "Vaivenes" or p["series"] == "Vaivenes"]
        p = selected[initial]
        # On the home the first scene sits under the monocle threshold and app.js swaps in a
        # per-session hero, so no artwork is fetched until that choice is made.
        threshold_page = path == "/" and initial == 0
        eager = lambda q: q['slug'] == p['slug'] and not threshold_page
        stages = ''.join(f'''<div class="art-scene{' is-current' if q['slug']==p['slug'] else ''}" data-scene="{i}" data-work="{q['slug']}"{' aria-hidden="true"' if q['slug']!=p['slug'] else ''}><div class="art-pan"><img {'src' if eager(q) else 'data-src'}="{q['cover']}"{cover_sizes(q['cover']) if eager(q) else ''}{cover_dims(q['cover'])} alt="{esc(work_alt(q))}" decoding="async" draggable="false"{' fetchpriority="high"' if eager(q) else ''}></div></div>''' for i, q in enumerate(selected))
        nav = ''.join(f'<button type="button" data-select="{i}" aria-label="Ver {esc(q["title"])}" aria-pressed="{str(i==initial).lower()}"{ " hidden" if abs(i-initial)>2 else ""}>{i+1:02d}</button>' for i, q in enumerate(selected))
        facts_items = [
            ("Técnica", p["technique"]),
            ("Soporte", p["support"]),
            ("Medidas", p["dimensions"]),
            ("Materiales", p.get("materials")),
            ("Serie", p.get("series")),
            ("Año", p.get("year")),
        ]
        facts_html = "".join(
            f"<div><dt>{esc(label)}</dt><dd>{esc(str(val))}</dd></div>"
            for label, val in facts_items
            if val
        )
        threshold_html = ""
        if threshold_page:
            threshold_html = f'''<div class="hero-threshold" data-hero-threshold data-threshold-enter aria-hidden="true"><div class="hero-threshold-plane" data-threshold-plane><img class="hero-threshold-portrait" src="{portrait}" srcset="{portrait_srcset}" sizes="{portrait_sizes}" width="2201" height="3468" alt="Naroa Gutiérrez Gil con chistera y monóculo en el umbral del estudio" fetchpriority="high" decoding="sync"><img class="hero-threshold-wink" data-threshold-wink src="{portrait_wink}" srcset="{portrait_wink_srcset}" sizes="{portrait_sizes}" width="2201" height="3468" alt="Guiño de bienvenida de Naroa Gutiérrez Gil" decoding="async"><div class="hero-monocle-portal" data-monocle-portal><div class="hero-monocle-lens"><div class="hero-monocle-marilyn" data-monocle-marilyn></div><canvas class="hero-monocle-canvas" data-monocle-canvas width="256" height="256" aria-hidden="true"></canvas><div class="hero-monocle-caustics"></div></div><svg class="hero-monocle-ring" viewBox="0 0 220 220" focusable="false" aria-hidden="true"><circle class="hero-monocle-bezel" cx="110" cy="110" r="98"/><circle class="hero-monocle-inner-ring" cx="110" cy="110" r="74"/></svg></div></div><div class="hero-threshold-shade"></div><div class="hero-spotlight" data-hero-spotlight></div><div class="hero-shards" data-hero-shards><span class="hero-shard hero-shard--1" data-shard-depth="1.4"></span><span class="hero-shard hero-shard--2" data-shard-depth="-1.1"></span><span class="hero-shard hero-shard--3" data-shard-depth="1.8"></span><span class="hero-shard hero-shard--4" data-shard-depth="-1.5"></span><span class="hero-shard hero-shard--5" data-shard-depth="0.9"></span><span class="hero-shard hero-shard--6" data-shard-depth="2.1"></span></div></div>'''
        body = f'''<main id="main" class="art-scroll" style="--steps:{len(selected)-1}"><section class="art-stage" data-gallery data-initial="{initial}" data-subset="{subset}"><div class="art-layers">{stages}</div>{threshold_html}<div class="art-shade" aria-hidden="true"></div><div class="art-stickman" data-stickman aria-hidden="true" hidden><div class="stickman-runner" data-stick-runner><svg viewBox="0 0 110 120" class="stickman-svg" aria-hidden="true"><ellipse data-stick-shadow cx="50" cy="103" rx="18" ry="2.6" fill="rgba(247,213,148,0.28)" /><path data-stick-scarf-gold d="M52,34 Q30,24 10,38" stroke="#f7d594" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.78" /><path data-stick-scarf d="M54,32 Q34,28 16,36" stroke="#fffdf4" stroke-width="2.6" stroke-linecap="round" fill="none" opacity="0.92" /><polyline data-stick-hair points="49,10 54,3 57,10 63,4 62,12" stroke="#fffdf4" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" /><circle data-stick-head cx="58" cy="20" r="9.5" stroke="#fffdf4" stroke-width="3.2" fill="#070706" /><circle data-stick-eye cx="62" cy="18.5" r="1.8" fill="#fffdf4" /><line data-stick-torso x1="56" y1="29" x2="50" y2="62" stroke="#fffdf4" stroke-width="3.8" stroke-linecap="round" /><polyline data-stick-arm-l points="55,36 39,48 29,39" stroke="#fffdf4" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none" /><polyline data-stick-arm-r points="55,36 69,46 81,34" stroke="#fffdf4" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none" /><polyline data-stick-leg-l points="50,62 34,82 22,102" stroke="#fffdf4" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" fill="none" /><polyline data-stick-leg-r points="50,62 68,80 80,100" stroke="#fffdf4" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" fill="none" /><line data-stick-dust-1 x1="26" y1="98" x2="6" y2="98" stroke="rgba(255,253,244,0.82)" stroke-width="2.6" stroke-linecap="round" /><line data-stick-dust-2 x1="32" y1="105" x2="12" y2="105" stroke="rgba(255,253,244,0.55)" stroke-width="2.2" stroke-linecap="round" /><circle data-stick-spark cx="18" cy="93" r="2.2" fill="rgba(255,253,244,0.85)" /><circle data-stick-spark-2 cx="10" cy="88" r="1.7" fill="rgba(247,213,148,0.9)" /><circle data-stick-spark-3 cx="24" cy="97" r="1.4" fill="rgba(237,188,164,0.85)" /></svg></div></div><div class="kinetic-title" data-kinetic-title aria-hidden="true"></div><nav class="art-index" aria-label="Recorrido de obras">{nav}</nav><div class="art-bottom"><div><div data-art-copy aria-live="polite"><p class="art-counter"><span data-counter>{initial+1:02d} / {len(selected):02d}</span><small data-journey-cue>Desplázate para recorrer ↕</small></p><h1 data-art-title>{esc(p['title'])}</h1><p class="art-material" data-art-material>{esc(p['label'])}</p></div><button type="button" class="art-story-link" data-open-story>Sobre esta obra <span aria-hidden="true">+</span></button></div><div class="art-controls"><div class="art-view-actions"><button type="button" data-effects aria-pressed="false">Activar efectos</button><button type="button" class="kintsugi-toggle-btn" data-kintsugi-toggle hidden aria-pressed="false">Rasgado Kintsugi ✦</button><button type="button" data-fit aria-pressed="false">Ver imagen completa ↗</button><button type="button" data-lens aria-pressed="false">Lupa</button><button type="button" data-open-photos>Otras miradas ↗</button><button type="button" class="ouroboros-loop-btn" data-ouroboros hidden aria-label="Volver al origen de la exposición">Volver al origen ↺</button>{social_share_dock(is_finale=True)}</div><div class="art-arrows"><button type="button" data-prev aria-label="Obra anterior"{' disabled' if initial==0 else ''}>←</button><button type="button" data-next aria-label="Obra siguiente"{' disabled' if initial==len(selected)-1 else ''}>→</button></div></div></div><button type="button" class="restore-ui" data-restore hidden>Volver a la navegación ↙</button><div class="art-progress" aria-hidden="true"><span></span></div></section></main>
<dialog id="story-dialog" class="story-dialog" aria-labelledby="story-title"><div class="dialog-top"><span data-story-category>{esc(p['label'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="story-body"><h2 id="story-title">{esc(p['title'])}</h2><p data-story>{esc(p['story'])}</p><dl data-facts>{facts_html}</dl><p class="art-credit" data-credit>{esc(p['credit'] or '')}</p><div class="story-actions"><a class="text-link" data-art-email href="mailto:naroa@naroagutierrezgil.com?subject={quote('Consulta sobre '+p['title'])}">Consultar por email ↗</a><a class="text-link" data-art-whatsapp href="https://wa.me/34636060609?text={quote('Hola Naroa, me gustaría consultar sobre la obra ' + p['title'])}" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp ↗</a><button type="button" class="text-link" data-share-link>Compartir enlace directo ↗</button>{social_share_dock(url=ORIGIN + '/obra/' + p['slug'] + '/', title=p['title'])}</div><a class="source-link" data-art-video{' hidden' if not p.get('video') else ''} href="{esc(p.get('video') or '')}" target="_blank" rel="noopener noreferrer">Ver proceso en YouTube ↗</a><a class="source-link" data-art-source{' hidden' if not p['source'] else ''} href="{esc(p['source'] or '')}" target="_blank" rel="noopener noreferrer">Ver publicación de la artista ↗</a></div><a class="story-footer" href="/retratos-por-encargo-bilbao/">Tu propio retrato empieza aquí ↗</a></dialog>
<dialog id="photos-dialog" class="photos-dialog" aria-labelledby="photos-heading"><div class="dialog-top"><span id="photos-heading">{esc(p['title'])}</span><button type="button" data-close-dialog>Cerrar ×</button></div><div class="photo-view"><button type="button" data-photo-prev aria-label="Fotografía anterior">←</button><img data-photo-image data-src="{p['photos'][0]['src']}" alt="{esc(work_alt(p, p['photos'][0]['caption']))}" decoding="async"><button type="button" data-photo-next aria-label="Fotografía siguiente">→</button></div><p data-photo-caption aria-live="polite"></p></dialog>'''
        artwork_photos = []
        for idx, ph in enumerate(p["photos"]):
            _, _, ph_mime = image_info(ph["original"])
            img_obj = {
                "@type": "ImageObject",
                "contentUrl": ORIGIN + ph["original"],
                "caption": ph.get("caption") or f"{p['title']} — {p.get('technique', '')} de Naroa Gutiérrez Gil",
                "width": ph.get("width"),
                "height": ph.get("height"),
                "encodingFormat": ph_mime,
                "representativeOfPage": idx == 0,
                "creator": artist_ref,
                "author": artist_ref,
                "creditText": "Naroa Gutiérrez Gil",
                "copyrightNotice": "© Naroa Gutiérrez Gil",
                "acquireLicensePage": ORIGIN + "/retratos-por-encargo-bilbao/",
            }
            if sha_by_src.get(ph["original"]):
                img_obj["identifier"] = f"sha256:{sha_by_src[ph['original']]}"
            if source_by_src.get(ph["original"]):
                img_obj["isBasedOn"] = source_by_src[ph["original"]]
            artwork_photos.append(img_obj)
        default_schema = {
            "@context": "https://schema.org",
            "@type": "VisualArtwork",
            "@id": ORIGIN + "/obra/" + p["slug"] + "/#artwork",
            "name": p["title"],
            "url": ORIGIN + "/obra/" + p["slug"] + "/",
            "inLanguage": "es-ES",
            "dateModified": catalogue["reviewed"],
            "image": [ORIGIN + ph["original"] for ph in p["photos"]],
            "subjectOf": {
                "@type": "ImageGallery",
                "name": f"Galería fotográfica de {p['title']}",
                "image": artwork_photos,
            },
            "description": p["story"],
            "creator": canonical_artist_entity,
            "author": artist_ref,
            "isPartOf": {
                "@type": "CollectionPage",
                "@id": ORIGIN + "/obra/#catalogue",
                "name": "Catálogo completo de obras de Naroa Gutiérrez Gil",
                "url": ORIGIN + "/obra/",
            },
            "locationCreated": bilbao_place,
            "artMedium": p.get("technique"),
            "artworkSurface": p.get("support"),
            "material": p.get("materials"),
            "artform": "VisualArtwork",
            "offers": {
                "@type": "Offer",
                "@id": ORIGIN + "/obra/" + p["slug"] + "/#offer",
                "availability": "https://schema.org/InStock",
                "priceCurrency": "EUR",
                "url": ORIGIN + "/obra/" + p["slug"] + "/",
                "description": "Obra original de catálogo y encargos personalizados basados en esta técnica. Consulta directa con la artista.",
                "seller": artist_ref,
                "itemOffered": ORIGIN + "/obra/" + p["slug"] + "/#artwork",
            },
        }
        if p.get("series") == "Vaivenes":
            default_schema["partOfSeries"] = {
                "@type": "CreativeWorkSeries",
                "@id": ORIGIN + "/series/vaivenes/#series",
                "name": "Serie Vaivenes",
                "url": ORIGIN + "/series/vaivenes/",
            }
        if p.get("source"):
            default_schema["isBasedOn"] = p["source"]
        if p.get("video"):
            default_schema["video"] = {
                "@type": "VideoObject",
                "name": f"Proceso creativo de {p['title']}",
                "description": p["story"],
                "contentUrl": p["video"],
                "url": p["video"],
                "thumbnailUrl": ORIGIN + p["photos"][0]["original"],
            }
        if p.get("year"):
            default_schema["dateCreated"] = str(p["year"])
        if p.get("dimensions"):
            default_schema["size"] = p["dimensions"]
        page(path, title or p["title"], description or p["story"], body, p["photos"][0]["original"], True, schema or default_schema, image_alt=work_alt(p, p["photos"][0]["caption"]))

    def hero(image, eyebrow, heading, lead="", link=None, alt="Obra de Naroa Gutiérrez Gil", position="50% 45%"):
        return f'''<section class="page-hero" data-parallax><div class="page-hero-image"><img src="{image}" alt="{esc(alt)}" fetchpriority="high" style="object-position:{position}"></div><div class="page-hero-shade"></div><div class="page-hero-copy"><p class="eyebrow">{esc(eyebrow)}</p><h1>{heading}</h1>{f'<p class="hero-lead">{lead}</p>' if lead else ''}{f'<a class="text-link" href="{link[0]}">{link[1]} ↗</a>' if link else ''}</div><a class="hero-down" href="#contenido" aria-label="Seguir leyendo">↓</a></section>'''

    home_schema = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": ORIGIN + "/#website",
        "name": "Naroa Gutiérrez Gil · Retratista en Bilbao y Bizkaia",
        "url": ORIGIN + "/",
        "description": f"Obra de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia. {len(projects)} retratos en dibujo, pintura, collage, objetos intervenidos y pizarra.",
        "publisher": canonical_artist_entity,
        "creator": canonical_artist_entity,
        "author": artist_ref,
        "mainEntity": {
            "@type": "Person",
            "@id": ORIGIN + "/#artist",
        },
    }
    catalogue_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": ORIGIN + "/obra/#catalogue",
        "name": f"Obra · {len(projects)} retratos, collage y objetos · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/obra/",
        "description": f"Catálogo completo de {len(projects)} obras y retratos de Naroa Gutiérrez Gil: dibujo, pintura, collage, objetos intervenidos y pizarra.",
        "creator": canonical_artist_entity,
        "author": artist_ref,
        "mainEntity": {
            "@type": "ItemList",
            "name": f"{len(projects)} retratos y obras de Naroa Gutiérrez Gil",
            "numberOfItems": len(projects),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "item": {
                        "@type": "VisualArtwork",
                        "@id": ORIGIN + "/obra/" + p["slug"] + "/#artwork",
                        "name": p["title"],
                        "url": ORIGIN + "/obra/" + p["slug"] + "/",
                        "image": ORIGIN + p["photos"][0]["original"],
                        "artMedium": p.get("technique"),
                        "artworkSurface": p.get("support"),
                        "creator": artist_ref,
                    },
                }
                for i, p in enumerate(projects)
            ],
        },
    }
    vaivenes_projects = [p for p in projects if p["series"] == "Vaivenes"]
    vaivenes_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": ORIGIN + "/series/vaivenes/#series",
        "name": "Serie Vaivenes · Dibujo, materia y transformación · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/series/vaivenes/",
        "description": "Serie Vaivenes de Naroa Gutiérrez Gil: retratos y piezas donde el collage, el dibujo y los materiales reutilizados exploran emociones y contrastes.",
        "creator": canonical_artist_entity,
        "author": artist_ref,
        "isPartOf": {
            "@type": "CollectionPage",
            "@id": ORIGIN + "/obra/#catalogue",
            "name": "Catálogo completo de obras de Naroa Gutiérrez Gil",
            "url": ORIGIN + "/obra/",
        },
        "mainEntity": {
            "@type": "ItemList",
            "name": "Obras de la serie Vaivenes",
            "numberOfItems": len(vaivenes_projects),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "item": {
                        "@type": "VisualArtwork",
                        "name": p["title"],
                        "url": ORIGIN + "/obra/" + p["slug"] + "/",
                        "image": ORIGIN + p["photos"][0]["original"],
                    },
                }
                for i, p in enumerate(vaivenes_projects)
            ],
        },
    }
    gallery("/", 0, title="Retratista en Bilbao y Bizkaia · Retratos, collage y objetos", description=f"Obra de Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao y Bizkaia. {len(projects)} retratos en dibujo, pintura, collage, objetos intervenidos y pizarra.", schema=home_schema)
    gallery("/obra/", 0, title=f"Obra · {len(projects)} retratos, collage y objetos", description=f"Catálogo de {len(projects)} obras de Naroa Gutiérrez Gil, retratista en Bilbao: retratos en pizarra, collage textil sobre madera, dibujo y objetos intervenidos, con técnica, soporte y medidas.", schema=catalogue_schema)
    for i, p in enumerate(projects):
        gallery(f"/obra/{p['slug']}/", i)
    gallery("/series/vaivenes/", 0, "Vaivenes", "Vaivenes", schema=vaivenes_schema)
    rara = next(p for p in projects if p["slug"] == "rara-avis")
    portal_work = derivative(rara["photos"][0]["original"], 4080)
    # Only the artist portrait gets this native, pinned scroll sequence. The
    # decorative eyelid is a feathered photographic animation layer; the
    # original photograph remains untouched and is the no-JS fallback.
    # El guiño solo se ve a través de su máscara (un 1 % del retrato): se sirve ese recorte y no
    # otra copia entera de la fotografía. La caja está en píxeles del original de 2201 × 3468.
    wink_source = SOURCE / "images/sobre-mi/naroa-monoculo-guino.png"
    wink_box = (1157, 1284, 1520, 1545)
    wink_name = f"naroa-monoculo-guino-{hashlib.sha256(wink_source.read_bytes() + repr(wink_box).encode()).hexdigest()[:12]}-ojo.webp"
    if not (media / wink_name).exists():
        with Image.open(wink_source) as wink_original:
            assert wink_original.size == (2201, 3468), "El recorte del guiño está medido sobre el retrato de 2201 × 3468"
            wink_original.convert("RGB").crop(wink_box).save(media / wink_name, "WEBP", quality=92, method=6)
    portrait_wink_eye = "/immersive/media/" + wink_name
    wink_x, wink_y, wink_w, wink_h = (v * 1248 / 2201 for v in (wink_box[0], wink_box[1], wink_box[2] - wink_box[0], wink_box[3] - wink_box[1]))
    about = f'''<div class="portrait-scroll" data-portrait-scroll style="--portrait-steps:{len(projects)-1}">
<section class="page-hero portrait-hero" data-eye-portrait>
<div class="portrait-frame"><div class="portrait-plane" data-portrait-plane>
<img src="{portrait}" srcset="{portrait_srcset}" sizes="{portrait_sizes}" width="2201" height="3468" alt="Naroa Gutiérrez Gil con chistera y un monóculo ante un ojo" fetchpriority="high">
<svg class="portrait-wink" viewBox="0 0 1248 1966" aria-hidden="true" focusable="false">
<defs><radialGradient id="portrait-wink-feather"><stop offset=".66" stop-color="white"/><stop offset="1" stop-color="black"/></radialGradient>
<radialGradient id="portrait-monocle-caustic" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fffdf4" stop-opacity="0.18"/><stop offset="62%" stop-color="#f7d594" stop-opacity="0.34"/><stop offset="88%" stop-color="#edbca4" stop-opacity="0.52"/><stop offset="100%" stop-color="#d4af37" stop-opacity="0"/></radialGradient>
<mask id="portrait-wink-mask" maskUnits="userSpaceOnUse" x="664" y="736" width="190" height="132"><ellipse cx="759" cy="802" rx="89" ry="62" fill="url(#portrait-wink-feather)"/></mask></defs>
<g data-portrait-wink opacity="0" mask="url(#portrait-wink-mask)"><image href="{portrait_wink_eye}" x="{wink_x:.2f}" y="{wink_y:.2f}" width="{wink_w:.2f}" height="{wink_h:.2f}" preserveAspectRatio="none"/></g>
<g class="portrait-monocle-glint" data-portrait-monocle-glint opacity="0"><circle cx="571" cy="766" r="94" fill="url(#portrait-monocle-caustic)"/><circle class="portrait-monocle-bezel" cx="571" cy="766" r="92"/><circle class="portrait-monocle-inner" cx="571" cy="766" r="68"/><path class="portrait-monocle-specular" d="M506,720 A82,82 0 0,1 624,704"/></g></svg></div>
<div class="portrait-artwork" data-portrait-artwork aria-hidden="true"><img src="{rara['cover']}" srcset="{view_srcset(rara['cover'])}, {portal_work} 4080w" sizes="(max-width: 760px) 600px, (max-aspect-ratio: 4080/3072) calc(100vh * 1.328), 100vw" width="4080" height="3072" alt="Rara Avis, autorretrato de Naroa a pastel y collage" decoding="async" fetchpriority="low"></div></div>
<div class="page-hero-shade"></div>
<div class="page-hero-copy"><p class="eyebrow">Retratista y artista plástica · Bilbao</p><h1>Naroa<br><span>Gutiérrez Gil.</span></h1><p class="hero-lead">Rostros, materia y ganas de jugar.</p></div>
<div class="portrait-work-copy" data-portrait-work-copy inert><p class="eyebrow" data-portrait-label>Del rostro al autorretrato · 01 / {len(projects)}</p><h2 data-portrait-title>Rara Avis</h2><a class="text-link" data-portrait-link href="/obra/rara-avis/">Explorar la obra ↗</a></div>
<nav class="portrait-travel-controls" data-portrait-controls aria-label="Continuar por las obras" inert><a href="#contenido">Biografía<span aria-hidden="true">&nbsp;↓</span></a><button type="button" data-portrait-prev aria-label="Obra anterior" disabled>←</button><button type="button" data-portrait-next aria-label="Obra siguiente">→</button></nav>
<a class="hero-down" href="#contenido" aria-label="Ir a la biografía" title="Ir a la biografía"><span aria-hidden="true">↓</span></a>
</section></div>'''
    jaio = next(p for p in projects if p["slug"] == "custom-jaio")
    # Todo lo que va entre « » es cita literal del blog de Naroa; lo omitido se marca con […] y cada
    # nota manuscrita lleva la entrada de la que sale. La presentación y el cierre van en tercera
    # persona y solo con datos del propio archivo (catálogo, trayectoria y página de encargos).
    BLOG = "https://naroagutierrez.wordpress.com"

    def about_link(href, label, attrs=""):
        outside = href.startswith("http")
        new_tab = ' target="_blank" rel="noopener noreferrer"' if outside else ""
        note = '<span class="sr-only"> (se abre en una pestaña nueva)</span>' if outside else ""
        return f'<a class="text-link" href="{href}"{new_tab}{attrs}>{label}<span aria-hidden="true">&nbsp;↗</span>{note}</a>'

    def about_note(source, quote):
        return f'<aside class="kintsugi-chasm hand-margin" data-hand-margin data-kintsugi-chasm><span class="kintsugi-chasm-spark"><span aria-hidden="true">✦ </span>{source}</span>{quote}</aside>'
        new_tab += ' hreflang="es"' if href.startswith(BLOG) else ""

    def about_chapter(key, eyebrow, heading, top, note, bottom, links):
        return (f'<section class="chapter kintsugi-fracture" data-kintsugi-chapter="{key}"><p class="eyebrow">{eyebrow}</p><div class="kintsugi-plate">'
                f'<div class="kintsugi-shard kintsugi-shard--top"><h2>{heading}</h2>{top}</div>{note}'
                f'<div class="kintsugi-shard kintsugi-shard--bottom">{bottom}<div class="chapter-links">{"".join(links)}</div></div></div></section>')

    def counted(n, one, many):
        return f"{n} {one if n == 1 else many}"

    about_events = read_data("exhibitions")["exhibitions"]
    about_years = [x["year"] for x in about_events]
    about_kinds = {k: sum(1 for x in about_events if x["type"] == k) for k in ("solo", "group", "market", "street")}
    assert sum(about_kinds.values()) == len(about_events), "La presentación de /sobre-mi/ enumera todos los tipos de encuentro"
    amor = next(p for p in projects if p["slug"] == "amor-en-conserva")
    about_brief = (
        '<section class="chapter artist-brief" aria-labelledby="artist-brief-heading"><p class="eyebrow">En breve</p><div class="artist-brief-body">'
        '<div class="artist-brief-text"><h2 id="artist-brief-heading">¿Quién es<br><span>Naroa?</span></h2>'
        f'<p class="lead">Naroa Gutiérrez Gil es artista plástica y retratista en Bilbao. Trabaja el retrato en dibujo, pintura, collage, objetos intervenidos y pizarra natural; esta web cataloga {len(projects)} de sus obras.</p>'
        f'<p>Su trayectoria documentada reúne {len(about_events)} encuentros con el público entre {min(about_years)} y {max(about_years)}: {counted(about_kinds["solo"], "exposición individual", "exposiciones individuales")}, {counted(about_kinds["group"], "colectiva", "colectivas")}, {counted(about_kinds["market"], "mercado de arte", "mercados de arte")} y {counted(about_kinds["street"], "paseo", "paseos")} de la Walking Gallery por las calles de Bilbao. Hoy pinta también retratos por encargo a partir de tus fotos.</p>'
        f'<div class="chapter-links">{about_link("/retratos-por-encargo-bilbao/", "Encargar un retrato")}{about_link("/trayectoria/", "Recorrer su trayectoria")}</div></div>'
        '<dl class="artist-facts"><div><dt>Oficio</dt><dd>Artista plástica y retratista</dd></div><div><dt>Dónde</dt><dd>Bilbao, Bizkaia</dd></div>'
        '<div><dt>Materias</dt><dd>Dibujo, pintura, collage, objetos intervenidos y pizarra natural</dd></div>'
        f'<div><dt>Obra</dt><dd><a href="/obra/#indice">{len(projects)} piezas catalogadas</a> · series DiviNos y Vaivenes</dd></div>'
        f'<div><dt>Trayectoria</dt><dd><a href="/trayectoria/">{len(about_events)} encuentros documentados, {min(about_years)}–{max(about_years)}</a></dd></div>'
        '<div><dt>Encargos y contacto</dt><dd><a href="/retratos-por-encargo-bilbao/">Retratos a partir de tus fotos</a> · <a href="mailto:naroa@naroagutierrezgil.com">naroa@naroagutierrezgil.com</a></dd></div></dl></div></section>')
    about_mirada = about_chapter(
        "mirada", "01 · La mirada", "Mirar a los demás.<br><span>Encontrarse en ellos.</span>",
        '<p class="lead">«“¿Quién es Naroa?” se pregunta mi imagen mientras me mira a los ojos desde el vidrio al rebotar. Sé que me zambullí en esto embebida por los rostros, sin instrucciones, y que me encontré a mí en los demás… Y el resto lo tengo aún por descubrir».</p>',
        about_note("Espejos del Alma · 2015", "«Yo solita no puedo mirarme a los ojos, pero en realidad sí: gracias a ti, a todos vosotros, espejos de vuestras almas y la mía, un mismo tesoro»."),
        "<p>«Con Espejos del Alma pretendo evidenciar la esencia común del ser humano. Creo que todos somos lo mismo con distintas apariencias, que formamos parte de una misma inmensa (id)entidad, ese dragón de mil cabezas al que llamamos ‘presente’ y que en efecto es un regalo».</p>",
        [about_link(BLOG + "/2015/05/24/espejos-del-alma-en-el-colegio-de-abogados-de-bilbao/", "Leer «Espejos del Alma», 2015")])
    about_pull = ('<blockquote>«Me encontré a mí en los demás».<cite>Naroa · <a href="' + BLOG + '/2020/09/27/iconos-pop-muestra-colectiva-de-retratos/" hreflang="es" target="_blank" rel="noopener noreferrer">Iconos Pop, 2020<span aria-hidden="true"> ↗</span><span class="sr-only"> (se abre en una pestaña nueva)</span></a></cite></blockquote>')
    about_materia = about_chapter(
        "materia", "02 · La materia", "Lo que cuenta<br>cada material.",
        "<p>«Durante la pandemia, mientras creaba la obra “Cantinflowers”, me vi sumida en una ardua lucha entre el acrílico y la cola, la transparencia y la grieta. En lugar de claudicar, comienzo a rascar sobre una base que no me permitía difuminar y ¡premio!, encuentro una textura inédita».</p>",
        about_note("DiviNos VaiVenes · 2026", "«Una actitud que es como las flores que rompen el asfalto y brotan de sus fisuras; puro “kintsugi”, el problema hecho trampolín»."),
        "<p>«A través de sus figuras, sus códigos cromáticos y la pizarra como material de sus soportes, “DiviNos” representa la vuelta a casa y su tejado que nos guarece. […] Nuestras oscuridades contienen chispas de luz y nuestra sangre pepitas de oro. […] Técnicas mixtas (como la pintura acrílica, los lápices de colores y el mineral de mica) conforman estas obras, hilando el abrazo entre la caverna y el cielo».</p>",
        [about_link("/obra/cantinflowers/", "Ver Cantinflowers"), about_link("/obra/marilyn-rocks/", "Ver una pizarra de DiviNos"), about_link("/series/vaivenes/", "Serie Vaivenes"),
         about_link(BLOG + "/2026/01/15/divinos-vaivenes-muestra-plastica-en-politena-espacio-de-arte/", "Leer «DiviNos VaiVenes», 2026")])
    about_lata = (f'<figure class="full-figure" data-parallax data-monocle-xray="lata"><a href="/obra/amor-en-conserva/"><img src="{amor["cover"]}" alt="Amor en Conserva, retratos y objetos reunidos en una lata abierta" loading="lazy"></a>'
                  '<p class="xray-whisper">Impresiones recortadas y montadas por capas dentro de una lata intervenida.</p>'
                  '<figcaption>Amor en Conserva <span aria-hidden="true">· Entrar en la obra ↗</span></figcaption></figure>')
    about_espejo = about_chapter(
        "espejo", "03 · La propia mirada", "Al otro lado<br>del espejo.",
        "<p>«Puestas a sincerarnos, os confesaré que, pese a que llevo años trabajando la disciplina artística del retrato, el añadido de hacerlo “a tiempo real” —es decir, guiada únicamente por el reflejo que recibo mientras reproduzco pictóricamente mi semblante— supuso todo un reto para mí».</p>",
        about_note("Mujeres a través del Espejo · 2026", "«Me di cuenta de que nunca me había autorretratado valiéndome simplemente de un espejo como marco de referencia»."),
        "<p>«Se titula “Rara Avis”, mide 50×35 cm y está realizada en técnica mixta superponiendo materiales como cartón, papel de regalo, acetato transparente, cartulina espejo, marcos decorados, cuerda, alambre, esmalte transparente con brillantina dorada, lazo, cinta rotuladora, cinta washitape y una pluma de pavo real […]. Mi rostro lo he trabajado con pintura pastel tipo Conté […] sobre papel Canson Mi-Teintes de 160 g/m² y he dibujado un monóculo con rotulador acrílico Uni-Posca sobre el acetato».</p>",
        [about_link("/obra/rara-avis/", "Descubrir Rara Avis"), about_link(BLOG + "/2026/05/14/autorretratos-mujeres-a-traves-del-espejo/", "Leer cómo nació Rara Avis")])
    about_rara = (f'<figure class="full-figure" data-parallax data-monocle-xray="espejo"><a href="/obra/rara-avis/"><img src="{rara["cover"]}" alt="Rara Avis: autorretrato entre marcos, papeles y reflejos" loading="lazy"></a>'
                  '<p class="xray-whisper" aria-hidden="true">«[…] he dibujado un monóculo con rotulador acrílico Uni-Posca sobre el acetato».</p>'
                  '<figcaption>Rara Avis · Pastel y collage <span aria-hidden="true">· Entrar en la obra ↗</span></figcaption></figure>')
    about_compartir = about_chapter(
        "compartir", "04 · Compartir", "Crear también<br>es encontrarse.",
        "<p>«Sí, sé que suena poco corriente que una galería visite a la gente en lugar de viceversa. […] Sin muros, sin duros, abierta y flexible. De tú a tú, haciendo piña, haciendo amig@s, apetecible».</p>",
        about_note("El ReCreo · 2024", "«Nacemos con una brújula integrada para irnos dando cuenta de quiénes somos: si te apetece, por ahí es. […] Si escuchas y atiendes tu propio pálpito, tu gozo no caerá en ningún pozo»."),
        "<p>«En el fondo, tú ya sabes todo, escarba en ti y encuentra tu tesoro. […] La vida a veces se nos hace cuesta arriba, sí. Pero también es verdad que es necesaria cierta abrupta escalada para poder transformar el problema en trampolín. Y es importante no olvidar que siempre podemos volver a elegir, volver a crear(nos) y volver a sonreír».</p>",
        [about_link("/trayectoria/", "Recorrer su trayectoria"), about_link(BLOG + "/2018/05/23/walking-gallery-bilbao-art-district-2018/", "Walking Gallery, 2018"),
         about_link(BLOG + "/2024/01/12/el-recreo-espacio-de-creacion-para-recrearte/", "Conocer El ReCreo")])
    # El espejo inverso conserva siempre las dos citas; la lectura de la visita (dónde se detuvo) solo
    # aparece cuando el script la ha medido de verdad, y por eso nace oculta.
    about_reverse = (
        '<section class="chapter reverse-portrait" data-reverse-portrait aria-labelledby="reverse-portrait-heading"><p class="eyebrow">Y ahora tú · El espejo inverso</p><div>'
        '<h2 id="reverse-portrait-heading">Mientras leías,<br><span>el cuadro te miraba a ti.</span></h2>'
        '<p class="lead" data-gaze-summary>«Gracias por brindarme reflejo, gracias por ser mi espejo».</p>'
        '<p data-gaze-detail>«Esbozar una sonrisa es como lanzar un boomerang en una lluvia de pétalos: te devuelve tanto o más de lo que das».</p>'
        '<p class="gaze-reading" data-gaze-reading hidden></p>'
        '<ul class="gaze-metrics" data-gaze-metrics role="list" hidden><li data-gaze-tempo></li><li data-gaze-element></li><li data-gaze-work>Obra espejo: Rara Avis</li></ul>'
        '<div class="chapter-links"><a class="text-link" data-gaze-work-link href="/obra/rara-avis/"><span data-gaze-work-name>Ver Rara Avis</span><span aria-hidden="true">&nbsp;↗</span></a>'
        + about_link("/retratos-por-encargo-bilbao/", "Encargar un retrato con esta materia", " data-gaze-cta hidden") + '</div></div></section>')
    about_closing = (
        '<section class="chapter artist-closing" aria-labelledby="artist-closing-heading"><p class="eyebrow">¿Hablamos?</p><div>'
        '<h2 id="artist-closing-heading">Un rostro.<br><span>Una historia por contar.</span></h2>'
        '<p class="lead">Naroa pinta retratos por encargo a partir de tus fotos: una persona, una pareja, la familia o tu mascota.</p>'
        '<p>Presupuesto cerrado por escrito antes de empezar, entre 2 y 4 semanas de trabajo y entrega en mano en Bilbao o por envío asegurado.</p>'
        '<div class="chapter-links">' + about_link("/retratos-por-encargo-bilbao/", "Encargar un retrato")
        + about_link("https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20hablar%20sobre%20un%20encargo.", "Escribir por WhatsApp")
        + '<a class="text-link" href="mailto:encargos@naroagutierrezgil.com?subject=Retrato%20por%20encargo">encargos@naroagutierrezgil.com</a>'
        + about_link("/obra/#indice", f"Ver las {len(projects)} obras") + about_link("/cuaderno/", "Leer su blog") + '</div></div></section>')
    about += ('<article id="contenido" class="editorial" data-kintsugi-editorial>' + about_brief + about_mirada + about_pull + about_materia + about_lata
              + about_espejo + about_rara + about_compartir + about_reverse + about_closing + '</article>')
    about_description = f"Naroa Gutiérrez Gil, artista plástica y retratista en Bilbao: {len(projects)} obras en pizarra, collage y objetos, muestras documentadas desde {min(about_years)} y retratos por encargo."
    about_schema = {
        "@context": "https://schema.org",
        "@type": "ProfilePage",
        "@id": ORIGIN + "/sobre-mi/#profile",
        "name": "Sobre mí · Retratista en Bilbao · Naroa Gutiérrez Gil",
        "description": about_description,
        "url": ORIGIN + "/sobre-mi/",
        "isPartOf": {"@id": ORIGIN + "/#website"},
        "relatedLink": [ORIGIN + "/trayectoria/", ORIGIN + "/retratos-por-encargo-bilbao/"],
        "mainEntity": canonical_artist_entity,
    }
    page("/sobre-mi/", "Sobre mí · Retratista en Bilbao", about_description, '<main id="main">' + about + '</main>', "/images/sobre-mi/naroa-monoculo.jpg", schema=about_schema, image_alt="Naroa Gutiérrez Gil con chistera y un monóculo ante un ojo",
         card_alt="Naroa Gutiérrez Gil con chistera y monóculo; a su lado, una caracterización de rostro pálido y ojos ahumados, y la pizarra Marilyn Rocks. Sobre la imagen, su frase «Me encontré a mí en los demás».")

    exhibitions = read_data("exhibitions")["exhibitions"]
    years = sorted({x["year"] for x in exhibitions}, reverse=True)
    kind_labels = {"solo": "Individual", "group": "Colectiva", "street": "Arte en la calle", "market": "Mercado de arte"}
    kind_plurals = {"solo": ("individual", "individuales"), "group": ("colectiva", "colectivas"), "street": ("en la calle", "en la calle"), "market": ("mercado de arte", "mercados de arte")}
    # Pared de fondo por tipo de encuentro: pared, muro, callejón o túnel (decisión estética; `wall` en el JSON la sobrescribe).
    kind_walls = {"solo": "pared", "group": "muro", "street": "callejon", "market": "tunel"}
    # Sale encendida la pared del primer encuentro: su foto es la única que se pide al cargar.
    first_wall = (exhibitions[0].get("wall") or kind_walls[exhibitions[0]["type"]]) if exhibitions else "pared"
    wall_markup = '<div class="career-wall" aria-hidden="true"><div class="career-wall-stage">' + ''.join('<i data-wall-layer="' + w + '"' + (' class="is-on"' if w == first_wall else '') + '></i>' for w in ("pared", "muro", "callejon", "tunel")) + '<b class="career-wall-year" data-wall-year></b>' + '<span class="career-wall-cromo" data-wall-cromo></span>' * 3 + '</div></div>'
    kind_counts = {k: sum(1 for x in exhibitions if x["type"] == k) for k in kind_labels}
    career_summary = f"{min(years)}–{max(years)} · {len(exhibitions)} encuentros · " + " · ".join(f"{n} {kind_plurals[k][0 if n == 1 else 1]}" for k, n in kind_counts.items() if n)
    kind_buttons = '<button type="button" data-career-kind="all" aria-pressed="true">Todo</button>' + ''.join(f'<button type="button" data-career-kind="{k}" aria-pressed="false">{kind_labels[k]} <small>{n}</small></button>' for k, n in kind_counts.items() if n)
    career = hero(cantinflowers, "Exposiciones y encuentros", "El arte también<br><span>sale de paseo.</span>", "«Sin muros, sin duros, abierta y flexible. De tú a tú, haciendo piña, haciendo amig@s, apetecible».", alt="Cantinflowers, pintura y collage en torno a Mario Moreno")
    career += '<section id="contenido" class="career editorial">' + wall_markup + '<div class="section-opening"><p>«Porque las exposiciones colectivas son como el corro de las patatas o el pilla-pilla de la vida artística: es enseñarnos los nuevos cromos al reunirnos con las amigas; es pegar en la misma pared todas nuestras pegatinas».</p><p class="career-summary">' + esc(career_summary) + '</p></div><div class="year-filters type-filters" role="group" aria-label="Filtrar exposiciones por tipo">' + kind_buttons + '</div><div class="year-filters" role="group" aria-label="Filtrar exposiciones por año"><button type="button" data-year="all" aria-pressed="true">Todos</button>' + ''.join(f'<button type="button" data-year="{y}" aria-pressed="false">{y}</button>' for y in years) + '</div><p class="career-count" role="status" aria-live="polite">' + str(len(exhibitions)) + ' encuentros documentados</p><div class="timeline">'
    
    artwork_lookup = {}
    for p in catalogue["projects"]:
        s = p["slug"]
        artwork_lookup[s] = {
            "slug": s,
            "title": p["title"],
            "thumb": derivative(p["images"][0]["src"], 360, thumb=True),
            "year": str(p.get("year") or ""),
            "medium": p.get("technique") or p.get("support") or "Técnica mixta",
            "url": f"/obra/{s}/"
        }
    for im in series.get("images", []):
        s = im.get("work_slug") or im["slug"]
        if s not in artwork_lookup:
            artwork_lookup[s] = {
                "slug": s,
                "title": im["title"],
                "thumb": derivative(im["src"], 360, thumb=True),
                "year": "2020–2026",
                "medium": "Técnica mixta · Vaivenes",
                "url": f"/obra/{s}/"
            }

    marked_year = None
    for x in exhibitions:
        if x["year"] != marked_year:
            marked_year = x["year"]
            career += f'<h2 class="timeline-year" data-timeline-year="{marked_year}">{marked_year}</h2>'
        sources = ''.join(f'<a href="{esc(s["url"])}" target="_blank" rel="noopener noreferrer">{esc(s["label"])} ↗</a>' for s in x["sources"])
        art_slugs = x.get("artworks", [])
        arts = [artwork_lookup[s] for s in art_slugs if s in artwork_lookup]
        art_json = esc(json.dumps(arts, ensure_ascii=False))
        cards_html = ""
        if arts:
            cards_html = '<div class="timeline-cards-strip" role="group" aria-label="Obras de este encuentro">' + ''.join(
                f'<a href="{esc(a["url"])}" class="timeline-cromo" data-cromo-slug="{esc(a["slug"])}" title="{esc(a["title"])}">'
                f'<span class="timeline-cromo-frame"><img src="{esc(a["thumb"])}" alt="{esc(a["title"])}" width="80" height="96" loading="eager" decoding="async"></span>'
                f'<span class="timeline-cromo-meta"><strong>{esc(a["title"])}</strong><small>{esc(a["medium"])}</small></span>'
                f'</a>'
                for a in arts
            ) + '</div>'
        career += f'''<article class="timeline-entry" data-exhibition-year="{x['year']}" data-exhibition-kind="{x['type']}" data-wall="{esc(x.get('wall') or kind_walls[x['type']])}" data-artworks="{art_json}"><p>{esc(x['dateLabel'])} <span class="timeline-kind">{kind_labels[x['type']]}</span></p><div><h3>{esc(x['title'])}</h3><p class="timeline-location">{esc(x['location'])}</p><p>{esc(x['description'])}</p>{cards_html}<div class="timeline-sources">{sources}</div></div></article>'''
    career += '</div><aside id="timeline-cursor-cards" class="timeline-cursor-cards" aria-hidden="true"></aside></section>'
    exhibition_events = []
    for ex in exhibitions:
        loc = ex.get("location", "")
        city = "Bilbao" if "Bilbao" in loc else loc.split("·")[-1].strip() if "·" in loc else "Bizkaia"
        ev = {
            "@type": "ExhibitionEvent",
            "name": ex["title"],
            "startDate": ex["date"],
            "location": {
                "@type": "Place",
                "name": loc,
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": city,
                    "addressRegion": "Bizkaia",
                    "addressCountry": "ES",
                },
            },
            "description": ex["description"],
            "organizer": artist_ref,
            "performer": artist_ref,
        }
        if ex.get("endDate"):
            ev["endDate"] = ex["endDate"]
        if ex.get("sources"):
            ev["subjectOf"] = [
                {"@type": "WebPage", "name": s["label"], "url": s["url"]}
                for s in ex["sources"]
            ]
        exhibition_events.append(ev)
    career_schema = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": ORIGIN + "/trayectoria/#career",
        "name": "Trayectoria documentada · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/trayectoria/",
        "description": "Exposiciones, encuentros y espacios compartidos de Naroa Gutiérrez Gil en Bilbao y Bizkaia.",
        "creator": artist_ref,
        "about": canonical_artist_entity,
        "mainEntity": {
            "@type": "ItemList",
            "name": "Exposiciones y encuentros de Naroa Gutiérrez Gil",
            "numberOfItems": len(exhibition_events),
            "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "item": ev}
                for i, ev in enumerate(exhibition_events)
            ],
        },
    }
    page("/trayectoria/", "Trayectoria", "Exposiciones, encuentros y espacios compartidos de Naroa Gutiérrez Gil. Una selección documentada de su trayectoria.", '<main id="main">' + career + '</main>', "/images/trayectoria/cantinflowers.jpg", schema=career_schema)

    blog_data = read_data("blog")
    posts = blog_data["posts"]
    blog_archive = blog_data.get("archive", [])
    blog_total = blog_data.get("total", len(posts) + len(blog_archive))
    blog_first_year = min(x["date"][:4] for x in posts + blog_archive)
    notebook = hero(cuaderno_hero, "El blog de Naroa", "Entre una obra<br><span>y la siguiente.</span>", "«Con las comisuras de par en par agradezco el volver a mi ser y soplo un beso a tu presencia que me alumbró el camino de regreso. Gracias por brindarme reflejo, gracias por ser mi espejo».", alt="Collage coral Twister (Naroa '25): retratos, telas, chapas y juego en el estudio de Naroa Gutiérrez Gil", position="50% 48%")
    notebook += f'''<section class="editorial notebook" id="contenido" data-notebook-sync="{esc(blog_data.get("api", ""))}"><div class="section-opening"><p class="eyebrow">Blog · Sincronizado con su WordPress</p><h2>Lo que ocurre<br>alrededor de una obra.</h2><p>«Siempre andan en busca de la complicidad —aunque sea a través del boli sobre el papel— y usan al observador como hilo conductor de sus tertulias privadas, en las que a menudo se merienda complicidad con sabor a saber reír».</p></div><p class="notebook-status" data-notebook-status><span class="notebook-status-dot" aria-hidden="true"></span><span data-notebook-status-text>{blog_total} entradas desde {blog_first_year} · la última, del {esc(posts[0]["date_label"])}</span></p><div class="notebook-posts" data-notebook-posts>'''
    for x in posts:
        im = x.get("image") or {}
        local_src = im.get("local")
        img_src = derivative(local_src, 960) if local_src else im.get("src", "")
        photo_html = f'''<a class="notebook-photo" href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true" style="--poster-ratio:{im.get('width', 1080)}/{im.get('height', 1080)}"><img src="{esc(img_src)}" width="{im.get('width', 1080)}" height="{im.get('height', 1080)}" alt="{esc(im.get('alt') or x['title'])}" loading="lazy" decoding="async"></a>''' if img_src else ""
        notebook += f'''<article class="notebook-card" data-notebook-entry data-post-id="{x['id']}">{photo_html}<div class="notebook-card-body"><p class="eyebrow"><time datetime="{esc(x['date'])}">{esc(x['date_label'])}</time></p><h3><a href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer">{esc(x['title'])} ↗</a></h3><p class="notebook-summary">{esc(x['summary'])}</p><a class="text-link" href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer" aria-label="Leer la entrada completa: {esc(x['title'])}">Leer la entrada completa ↗</a></div></article>'''
    notebook += '</div>'
    if blog_archive:
        short_months = "ene feb mar abr may jun jul ago sep oct nov dic".split()
        archive_years = {}
        for x in blog_archive:
            archive_years.setdefault(x["date"][:4], []).append(x)
        year_span = f"{min(archive_years)}–{max(archive_years)}"
        notebook += f'''<section class="notebook-archive" aria-labelledby="notebook-archive-title"><div class="section-opening"><p class="eyebrow">Archivo del blog · {year_span}</p><h2 id="notebook-archive-title">Y todo<br><span>lo anterior.</span></h2><p>{len(blog_archive)} entradas más, año por año: exposiciones, mercados, paseos de la Walking Gallery y encuentros. Cada título abre la entrada en su WordPress.</p></div><div class="notebook-years">'''
        for index, (year, entries) in enumerate(sorted(archive_years.items(), reverse=True)):
            rows = "".join(
                f'''<li><time datetime="{esc(x['date'])}">{int(x['date'][8:10])} {short_months[int(x['date'][5:7]) - 1]}</time><a href="{esc(x['url'])}" target="_blank" rel="noopener noreferrer">{esc(x['title'])} ↗</a></li>'''
                for x in entries
            )
            count_label = "1 entrada" if len(entries) == 1 else f"{len(entries)} entradas"
            notebook += f'''<details class="notebook-year" name="notebook-archive"{' open' if index == 0 else ''}><summary><span class="notebook-year-number">{year}</span><span class="notebook-year-count">{count_label}</span></summary><ol>{rows}</ol></details>'''
        notebook += '</div></section>'
    notebook += '<section class="notebook-reactions" data-notebook-reactions aria-labelledby="notebook-reactions-title"><div class="section-opening"><p class="eyebrow">Voces en el blog · Comentarios reales de sus lectores</p><h2 id="notebook-reactions-title">Lo que dicen quienes miran<br><span>y lo que responde Naroa.</span></h2><p>«Sempiternas gracias por tus palabras, las beso letra por letra y abrazo tu aprecio, que no tiene precio… Con comentarios así, me siento la biempagá. Mila esker, always : )»</p></div><div class="timeline">'
    real_comments = [
        ("1 de julio de 2016 · V Aniversario Walking Gallery Bilbao", "dæ (con acróstico oculto N-A-R-O-A)", "«…existeN personas que orgAnizan acontecimientos para el gusto y disfRute de los demás… a veces, imagino que les falta el aire, a veces se sientan cOjos… mas ahí siguen al pie del cañón….. Ahora… a disfrutarlo.»", "Respuesta de Naroa (2 de julio de 2016): «Sempiternas gracias por tus palabras, las beso letra por letra y abrazo tu aprecio, que no tiene precio.. Con comentarios así, me siento la biempagá.. Mila esker, always : )»"),
        ("1 de marzo de 2016 · “Si fueses pájaro lo entenderías” y yo", "koldobarrutia", "«Por ser quien eres, lo adquiriré esperando que me arrope por las noches*!*!*!»", ""),
        ("9 de diciembre de 2016 · “Sácame los Colores” en Tegobi", "dæ", "«Pues un bigote espumoso tal vez (por supuesto) nos siente bien… Y que sea a la par y de esta forma, manera o formalidad ponernos caras y abrazar para así podámonos abarcar. ¿Cómo lo vislumbras?»", "Respuesta de Naroa (11 de diciembre de 2016): «Lo vislumbraría a la lumbre que alumbra tu ser de mil amores. Face to face, me hace, rodeada de otras tantas caras coloristas en 2D. Hay, ¿quién maneja mi barca, quién?.. que al Tegobi me lleva, ¿quién?..»"),
        ("10 de julio de 2014 · “Espejos del Alma” en la Torre Salazar", "Carlos", "«Una nueva ocasión para disfrutar de la obra de Naroa. Los que la conocemos no nos la perderemos y los que no la conocen sentirán habérsela perdido.»", "Respuesta de Naroa (10 de julio de 2014): «Muy amable, Carlos. Con semejantes palabras, esta exposición ya ha sido todo un éxito :))»"),
        ("30 de septiembre de 2014 · Muestra FAIM de Madrid", "Carmen Merino García", "«Querida Naroa, mil gracias por tu trabajo y profesionalidad, que nos demostraste en FAIM. También me ha encantado el proyecto XUPERARTE, enhorabuena por tus originales iniciativas, cuenta conmigo siempre que quieras, ¡los artistas necesitamos gente como tú!»", "Respuesta de Naroa (2 de octubre de 2014): «Carmen, no tengo palabras. Contemplar tu obra es admirarla, leerte es sonreír. Un auténtico HONOR conocerte; sí, sí, con mayúsculas.. y negrita porque no me deja… ¡Besos obesos!»"),
        ("18 de diciembre de 2022 · Muestra Colectiva “Emakumeen arteaN”", "gominolafunky & Borja", "gominolafunky: «Esto es un no parar de arte, esperamos no estresarte, con la unión como estandarte» · Borja: «Eres genial!!😍😍😍»", ""),
        ("30 de octubre de 2017 · “Los Guardianes del Enigma” en Igarkizun", "Iratxe", "«¡Qué buena pinta tiene! ¡A ver si podemos ir a visitarlo! Nos encantaría, lo pasamos genial la última vez.»", "Respuesta de Naroa (31 de octubre de 2017): «Pues en ese caso, cae por su propio peso: brindemos este jueves por ello, brindemos!! : )»"),
        ("23 de enero de 2026 · Muestra «DiviNos VaiVenes» en Politena", "euskalsoftjose", "«Toda una experiencia, allí nos vemos.»", "Respuesta de Naroa (10 de mayo de 2026): «Muchas gracias, deseo que fuera de tu agrado 🙂»"),
    ]
    for c_date, c_author, c_text, c_reply in real_comments:
        reply_html = f'<p class="timeline-location">{esc(c_reply)}</p>' if c_reply else ""
        notebook += f'<article class="timeline-entry"><p>{esc(c_date)}</p><div><h3>{esc(c_author)}</h3><p>{esc(c_text)}</p>{reply_html}</div></article>'
    notebook += '</div></section><div class="notebook-actions"><a class="text-link" href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Seguir leyendo su blog en WordPress ↗</a><a class="text-link" href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Publicaciones en Facebook ↗</a></div></section>'
    blog_schema = {
        "@context": "https://schema.org",
        "@type": "Blog",
        "@id": ORIGIN + "/cuaderno/#blog",
        "name": "El cuaderno de Naroa",
        "url": ORIGIN + "/cuaderno/",
        "description": "Historias de obras, procesos y encuentros. El cuaderno de la artista Naroa Gutiérrez Gil.",
        "author": canonical_artist_entity,
        "publisher": artist_ref,
        "blogPost": [
            {
                "@type": "BlogPosting",
                "headline": post["title"],
                "url": post["url"],
                "datePublished": post["date"],
                "description": post["summary"],
                "author": artist_ref,
                "publisher": artist_ref,
            }
            for post in posts
        ] + [
            {
                "@type": "BlogPosting",
                "headline": post["title"],
                "url": post["url"],
                "datePublished": post["date"],
                "author": artist_ref,
            }
            for post in blog_archive
        ],
    }
    page("/cuaderno/", "Blog", "Historias de obras, procesos y encuentros. El blog de la artista Naroa Gutiérrez Gil.", '<main id="main">' + notebook + '</main>', "/images/cuaderno/cuaderno-twister-collage.jpg", schema=blog_schema)

    commission_examples = [
        (jaio, "Madera noble & textil cosido", "Collage textil sobre madera"),
        (amy, "Pizarra natural & mica mineral", "Pizarra natural rústica"),
        (amor, "Lata de conserva 3D", "Caja personalizada u objeto"),
        (rara, "Papel algodón & grafito", "Retrato al óleo o grafito"),
    ]
    examples_html = ''.join(
        f'<article class="commission-example" data-parallax-card data-card-index="{idx}" data-work-slug="{ex["slug"]}">'
        f'<span class="commission-parallax-num" aria-hidden="true">0{idx + 1}</span>'
        f'<div class="commission-stage-wrap">'
        f'<a class="commission-example-photo" href="/obra/{ex["slug"]}/">'
        f'<img src="{ex["cover"]}" width="{ex["photos"][0]["width"]}" height="{ex["photos"][0]["height"]}" alt="{esc(work_alt(ex))}" loading="eager" decoding="async">'
        f'</a>'
        f'<a class="commission-detail-pip" href="/obra/{ex["slug"]}/" tabindex="-1" aria-hidden="true">'
        f'<img src="{ex["photos"][1]["src"] if len(ex.get("photos", [])) > 1 else ex["cover"]}" alt="{esc(ex["title"])} · Detalle matérico" loading="lazy" decoding="async">'
        f'</a>'
        f'<div class="commission-example-bar">'
        f'<div class="commission-work-meta">'
        f'<a class="commission-work-title" href="/obra/{ex["slug"]}/">{esc(ex["title"])}</a>'
        f'<span class="commission-support-tag">{esc(support_label)}</span>'
        f'</div>'
        f'<div class="commission-bar-actions">'
        f'<button type="button" class="commission-seed-btn" data-pick-support="{esc(support_val)}" data-work-title="{esc(ex["title"])}">Elegir esta materia ↑</button>'
        f'<a class="commission-pick-btn" href="https://wa.me/34636060609?text={quote("Hola Naroa, me gustaría un encargo inspirado en " + ex["title"] + ".")}" target="_blank" rel="noopener noreferrer">Encargar ↗</a>'
        f'</div>'
        f'</div>'
        f'</div>'
        f'</article>'
        for idx, (ex, support_label, support_val) in enumerate(commission_examples)
    )
    progress_dots = (
        ''.join(
            f'<button type="button" class="commission-dot{" is-active" if idx == 0 else ""}" data-jump-card="{idx}" aria-label="Ir a obra {idx + 1}: {esc(ex["title"])}"><span>0{idx + 1}</span></button>'
            for idx, (ex, _, _) in enumerate(commission_examples)
        )
        + '<button type="button" class="commission-dot" data-jump-card="4" aria-label="Ir al cierre"><span>05</span></button>'
    )

    commission_faqs = [
        ("¿Y si la foto que tengo es una birria de móvil tomada de noche?", "¡Mejor todavía! Las fotos de carné y los posados de boda suelen tener el alma planchada. Prefiero mil veces una foto borrosa donde la persona se esté partiendo de risa o mirando de reojo que una imagen de estudio sin vida. Si tienes varias fotos distintas (por ejemplo, una donde sale bien de cara y otra con la ropa que le gusta), las fusiono en el taller para componer su mirada real."),
        ("¿Puedo pedir que metas objetos reales dentro del cuadro (botones, cartas, entradas de concierto)?", "¡Es mi especialidad y lo que más me divierte! Mis cuadros comen recuerdos: trozos de partituras, sobres de azúcar, chapas, encajes de la abuela, billetes de tren, pétalos secos o botones de un abrigo viejo. Me lo envías o me lo traes al estudio en Bilbao y lo coso o lo integro dentro de la obra como parte de la piel del cuadro."),
        ("¿Cuánto cuesta un retrato pintado a mano y cuándo sé el precio exacto?", "Antes de tocar un pincel. Odio los presupuestos sorpresa tanto como tú. Primero hablamos de tu idea, elegimos soporte (pizarra, madera cosida, lata 3D o papel) y tamaño, y te doy una cifra cerrada y por escrito. Si te encaja, acordamos un 50% para arrancar y el 50% restante a la entrega. Siempre con presupuesto cerrado previo."),
        ("¿Cuáles son los plazos y qué pasa si tengo una fecha señalada?", "El ritmo habitual de taller es de 2 a 4 semanas: las capas de acrílico, las texturas y los barnices de protección UV necesitan su secado orgánico para no cuartear. Si tienes un cumpleaños, una boda o una sorpresa inminente, dímelo en el primer mensaje y buscamos un hueco prioritario de caballete."),
        ("¿Cómo llega la obra a mis manos si no vivo en Bilbao?", "Si estás en Bilbao o en Bizkaia (Casco Viejo, Indautxu, Getxo, margen derecha o izquierda), te lo doy en mano en el estudio o quedamos para dártelo en persona. Si estás fuera, viaja como una reina: en una caja rígida tricapa a medida, protegida contra humedad y golpes, con seguro a todo riesgo y número de seguimiento hasta la puerta de tu casa."),
        ("¿Qué tamaños y materiales puedo elegir?", "Los formatos habituales son 20 × 30 cm, 30 × 40 cm y 40 × 50 cm, o a medida según el espacio donde vaya a vivir. Trabajo sobre madera, tela vaquera cosida, papel de algodón, cajas y latas intervenidas y pizarra natural, con acrílico, pastel, carbón Conté, rotuladores, pan de oro y costura a mano. Cada pieza va firmada, con certificado de autenticidad y lista para colgar."),
    ]
    faq_html = ''.join(f'<details class="commission-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in commission_faqs)

    default_cfg_msg = "Aupa Naroa! Me gustaría consultar un encargo de retrato sobre Tela Vaquera & Costuras Vivas (Collage textil sobre madera) para Retrato individual con plazo Sin prisa (2 a 4 semanas). Tengo una idea y fotos para contarte."
    # La portada es el encargo: una frase gigante con tres palabras que se cambian al tocarlas.
    # Cada <option> lleva en data-say cómo se dice dentro de la frase; app.js las recorre.
    cfg_supports = [
        ("Collage textil sobre madera", "tela vaquera cosida"),
        ("Pizarra natural rústica", "pizarra natural"),
        ("Caja personalizada u objeto", "una lata de conserva"),
        ("Retrato al óleo o grafito", "papel, a pastel y grafito"),
        # Soportes que Naroa ya ha trabajado (catálogo): cada uno enseña en la portada una obra real.
        ("Lienzo", "lienzo"),
        ("Plato de madera", "un plato de madera"),
        ("Caja de madera", "una caja de madera"),
        ("Rodaja de árbol", "una rodaja de árbol"),
        ("Un objeto tuyo", "un objeto tuyo"),
        ("Asesoramiento en estudio", "lo que tú me propongas"),
    ]
    cfg_motifs = [
        ("Retrato individual", "de una persona"),
        ("Pareja o familia", "de mi pareja o mi familia"),
        ("Mascota", "de mi mascota"),
        ("Homenaje o recuerdo", "en homenaje a alguien"),
        ("Autorretrato", "mío"),
        ("Hija o hijo", "de mi hija o mi hijo"),
        ("Abuela o abuelo", "de mi abuela o mi abuelo"),
        ("Amistad o cuadrilla", "de mi cuadrilla"),
        ("Ídolo o artista", "de mi artista favorita"),
    ]
    cfg_timings = [
        ("Sin prisa (2 a 4 semanas)", "sin prisa"),
        ("Fecha señalada próxima", "para una fecha señalada"),
        ("Cumpleaños", "para un cumpleaños"),
        ("Boda o aniversario", "para una boda o un aniversario"),
        ("Navidad o Reyes", "para Navidad o Reyes"),
    ]

    def cfg_select(field, label, options):
        opts = ''.join(f'<option value="{esc(value)}" data-say="{esc(say)}">{esc(value)}</option>' for value, say in options)
        return f'<select id="cfg-{field}" class="enc-state" aria-label="{esc(label)}" tabindex="-1" aria-hidden="true">{opts}</select>'

    def cfg_word(field, label, options):
        # <span role="button"> y no <button>: un botón es una caja indivisible y la frase tiene que poder partir línea por dentro.
        return f'<span role="button" tabindex="0" class="enc-word" data-cfg-cycle="{field}" aria-label="{esc(label)}: {esc(options[0][1])}. Pulsa para cambiar." data-cycle-label="{esc(label)}">{esc(options[0][1])}</span>'

    hero_html = (
        '<section id="configurador" class="enc-hero" aria-labelledby="enc-title" data-commission-configurator>'
        '<div class="enc-hero-copy">'
        '<h1 id="enc-title" class="enc-kicker">Retrato personalizado pintado a mano <span>· a partir de tu foto, desde Bilbao a toda España</span></h1>'
        + season_note +
        '<p class="enc-sentence">Naroa, quiero un retrato '
        + cfg_word("motif", "A quién", cfg_motifs) + ' sobre '
        + cfg_word("support", "Materia", cfg_supports) + ', '
        + cfg_word("timing", "Plazo", cfg_timings) + '.</p>'
        '<p class="enc-hint" aria-hidden="true">↑ Toca lo subrayado y la frase cambia.</p>'
        '<p id="cfg-seed-banner" class="enc-seed" data-cfg-seed-banner hidden></p>'
        '<label class="enc-note" for="cfg-note"><span>Y cuéntame algo suyo <small>(opcional)</small></span>'
        '<input id="cfg-note" type="text" maxlength="180" placeholder="Le flipa Extremoduro, tiene un perro salchicha…" autocomplete="off" data-cfg-note></label>'
        '<div class="enc-actions">'
        f'<a id="cfg-whatsapp-btn" class="enc-btn" href="https://wa.me/34636060609?text={quote(default_cfg_msg)}" target="_blank" rel="noopener noreferrer">Enviárselo por WhatsApp ↗</a>'
        f'<a id="cfg-email-btn" class="enc-link" href="mailto:encargos@naroagutierrezgil.com?subject={quote("Consulta encargo con Naroa")}&body={quote(default_cfg_msg)}">o por correo ↗</a>'
        '<button type="button" id="cfg-copy-btn" class="enc-link" data-cfg-copy><span>Copiar el mensaje</span></button>'
        '</div>'
        f'<p id="cfg-preview" class="enc-state" aria-live="polite">{esc(default_cfg_msg)}</p>'
        + cfg_select("support", "Materia del retrato", cfg_supports)
        + cfg_select("motif", "A quién retratar", cfg_motifs)
        + cfg_select("timing", "Plazo", cfg_timings)
        + '</div>'
        '<figure class="enc-hero-art">'
        f'<img id="cfg-visual-img" src="{jaio["cover"]}" alt="Obra de muestra de la materia elegida" width="{jaio["photos"][0]["width"]}" height="{jaio["photos"][0]["height"]}" decoding="async" fetchpriority="high">'
        '<img id="cfg-swatch-cutout" class="enc-swatch" src="/images/catalogo/commission-jaio-button.webp" width="131" height="140" alt="Botón rojo cosido a mano sobre tela vaquera" decoding="async">'
        '<figcaption><strong id="cfg-visual-title">Custom Jaio · Collage textil y madera</strong><span id="cfg-visual-tag">Tela vaquera, costuras y dibujo</span></figcaption>'
        '</figure>'
        '</section>'
    )

    def ficha(slug, upto=None):
        # Texto literal de la ficha del catálogo, sin retocar. `upto` son las últimas palabras del fragmento:
        # si la ficha sigue, lo omitido se marca con […]; si la ficha cambia y ya no las contiene, el build falla.
        story = next(p for p in projects if p["slug"] == slug)["story"]
        if not upto:
            return story
        cut = story.index(upto) + len(upto)
        return story[:cut] + (" […]" if story[cut:].strip() else "")

    stories = [
        ("Reunir dos miradas en el tiempo.", ficha("el-reencuentro", "trazarles, de nuevo, juntos."), "/obra/el-reencuentro/", "El Reencuentro"),
        ("Una felicitación colectiva con Don Vito.", ficha("la-famiglia"), "/obra/la-famiglia/", "La Famiglia"),
        ("Vacaciones en el mar sobre madera.", ficha("the-love-boat"), "/obra/the-love-boat/", "The Love Boat"),
        ("Capas articuladas en una lata de conserva.", ficha("multi-dimensional-love", "la del amor de sus protagonistas."), "/obra/multi-dimensional-love/", "Multi-dimensional Love"),
    ]
    stories_html = ''.join(
        f'<li><span class="enc-num" aria-hidden="true">0{idx + 1}</span><div><h3>{esc(title)}</h3><p>{esc(text)}</p><a class="enc-ink-link" href="{href}">Ver la obra: {esc(work)} ↗</a></div></li>'
        for idx, (title, text, href, work) in enumerate(stories)
    )
    facts = [
        ("Precio cerrado", "Por escrito, antes de tocar un pincel. La mitad al empezar y la otra mitad a la entrega."),
        ("2 a 4 semanas", "Lo que tardan en secar capas y barnices. Si hay fecha señalada, dímelo en el primer mensaje."),
        ("20 × 30 a 40 × 50 cm", "O a medida del sitio donde vaya a vivir."),
        ("En mano en Bilbao", "O por envío asegurado en caja rígida, con seguimiento hasta tu puerta."),
    ]
    facts_html = ''.join(f'<div><dt>{esc(dt)}</dt><dd>{esc(dd)}</dd></div>' for dt, dd in facts)

    commissions = (
        f'{hero_html}'
        f'<article class="editorial commission-minimal" id="contenido" data-commission-horizontal aria-label="Cuatro retratos, cuatro materias">'
        f'<div class="commission-horizontal-sticky">'
        f'<div class="commission-examples" data-horizontal-track>'
        f'{examples_html}'
        f'<div class="closing" data-parallax-card data-card-index="4">'
        f'<p class="hand" style="font-size:clamp(38px,4.8vw,60px);margin:0;color:#fffdf4">¿A quién te gustaría retratar?</p>'
        f'<p style="max-width:520px;text-align:center;font-size:15px;line-height:1.6;color:rgba(255,253,244,0.85);margin:-4px 0 8px">Una persona, una historia, un tesoro guardado en una caja de galletas. No hace falta traerlo todo pensado.</p>'
        f'<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center">'
        f'<a class="commission-cta-btn" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20quiero%20encargar%20una%20obra." target="_blank" rel="noopener noreferrer">WhatsApp directo ↗</a>'
        f'<a class="commission-pick-btn" href="#configurador" style="background:transparent;color:#fffdf4;border:1px solid rgba(255,255,255,0.45)">Volver a mi frase ↑</a>'
        f'</div>'
        f'</div>'
        f'</div>'
        f'<div class="commission-cutouts-stage" data-commission-cutouts aria-hidden="true">'
        f'<img class="commission-cutout-actor commission-cutout--button" data-commission-actor="jaio-button" src="/images/catalogo/commission-jaio-button.webp" width="131" height="140" alt="Botón decorativo de costura intervenido" decoding="async">'
        f'<img class="commission-cutout-actor commission-cutout--purple-rose" data-commission-actor="amor-purple-rose" src="/images/catalogo/commission-amor-purple-rose.webp" width="246" height="252" alt="Rosa morada de tela superpuesta en collage" decoding="async">'
        f'<img class="commission-cutout-actor commission-cutout--red-rose" data-commission-actor="amor-red-rose" src="/images/catalogo/commission-amor-red-rose.webp" width="182" height="223" alt="Rosa roja matérica de collage" decoding="async">'
        f'<img class="commission-cutout-actor commission-cutout--calla" data-commission-actor="amor-calla" src="/images/catalogo/commission-amor-calla.webp" width="418" height="442" alt="Cala blanca de tela esculpida" decoding="async">'
        f'<img class="commission-cutout-actor commission-cutout--peacock" data-commission-actor="rara-peacock" src="/images/catalogo/commission-rara-peacock.webp" width="229" height="269" alt="Pluma de pavo real con reflejos tornasolados" decoding="async">'
        f'</div>'
        f'<nav class="commission-horizontal-progress" aria-label="Navegación horizontal de obras">'
        f'<div class="commission-progress-bar"><div class="commission-progress-fill" data-progress-fill></div></div>'
        f'<div class="commission-dots-dock">{progress_dots}</div>'
        f'<button type="button" class="commission-effects" data-effects aria-pressed="true">Pausar efectos</button>'
        f'</nav>'
        f'</div>'
        f'</article>'
        f'<section id="taller" class="enc-band enc-band--ink" aria-labelledby="enc-manifesto">'
        f'<h2 id="enc-manifesto" class="enc-shout">No retrato solo tu cara.<br><em>Retrato tu historia.</em></h2>'
        f'<p class="enc-lead">No necesitas una sesión de fotos de estudio ni venir de punta en blanco. Al revés: dame esa foto de móvil movida donde se le ve la risa de verdad, o la fotografía antigua del abuelo que quieres rescatar del olvido. Dime si le apasiona el rock de los 70, si guarda recuerdos en una lata o qué color le enciende el día.</p>'
        f'<dl class="enc-facts">{facts_html}</dl>'
        f'</section>'
        f'<section id="historias" class="enc-band enc-band--paper" aria-labelledby="commission-stories-heading">'
        f'<h2 id="commission-stories-heading" class="enc-h2">Cuatro encargos <em>de verdad.</em></h2>'
        f'<ol class="enc-stories">{stories_html}</ol>'
        f'</section>'
        f'<section id="dudas" class="enc-band enc-band--paper enc-faq" aria-labelledby="commission-faq-heading">'
        f'<h2 id="commission-faq-heading" class="enc-h2">Dudas <em>sin tapujos.</em></h2>'
        f'<div class="enc-faq-list">{faq_html}</div>'
        f'<nav class="enc-also" aria-label="Encargos por tipo de retrato">'
        f'<a class="enc-ink-link" href="/retrato-de-pareja-y-familia/">Retrato de pareja y de familia ↗</a>'
        f'<a class="enc-ink-link" href="/retrato-de-un-ser-querido-fallecido/">Retrato en recuerdo de un ser querido ↗</a>'
        f'<a class="enc-ink-link" href="/retrato-de-mascota/">Retrato de mascota ↗</a>'
        f'</nav>'
        f'</section>'
        f'<section class="enc-band enc-close" aria-labelledby="enc-close-heading">'
        f'<h2 id="enc-close-heading" class="enc-shout enc-shout--serif">¿A quién te gustaría emocionar?</h2>'
        f'<p class="enc-lead">Cuéntame qué persona ronda por tu cabeza y qué fotos tienes. Te respondo yo misma desde el estudio de Bilbao.</p>'
        f'<div class="enc-actions">'
        f'<a class="enc-btn" href="https://wa.me/34636060609?text={quote("Aupa Naroa! Me gustaría consultarte una idea para un encargo.")}" target="_blank" rel="noopener noreferrer">Hablar por WhatsApp ↗</a>'
        f'<a class="enc-link" href="mailto:encargos@naroagutierrezgil.com?subject={quote("Consulta de retrato por encargo con Naroa")}">encargos@naroagutierrezgil.com ↗</a>'
        f'<a class="enc-link" href="/obra/#indice">Ver las {len(projects)} obras ↗</a>'
        f'</div>'
        f'</section>'
        f'<aside class="atelier-mobile-cta" data-atelier-mobile-cta aria-label="Acceso rápido a tu encargo">'
        f'<a class="atelier-mobile-cta-config" href="#configurador"><span>Mi encargo ↑</span><small data-mobile-cta-summary>Tela Vaquera · Individual</small></a>'
        f'<a class="atelier-mobile-cta-wa" data-mobile-cta-wa href="https://wa.me/34636060609?text={quote(default_cfg_msg)}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>'
        f'</aside>'
    )
    commissions_schema = {
        "@context": "https://schema.org",
        "@type": ["Service", "ProfessionalService"],
        "@id": ORIGIN + "/retratos-por-encargo-bilbao/#service",
        "name": "Retrato personalizado pintado a mano a partir de tu foto · Retratos por encargo en Bilbao",
        "alternateName": [
            "Retrato por encargo",
            "Retrato por encargo en Bilbao",
            "Retratos por encargo en Bilbao",
            "Retrato personalizado Bilbao",
            "Encargar cuadro personalizado Bilbao",
            "Retrato personalizado pintado a mano",
            "Retrato hecho a mano desde foto",
            "Cuadro pintado a mano de una foto",
            "Retrato personalizado de pareja, familia o mascota",
        ],
        "serviceType": "Retrato por encargo y retratos artísticos de autor en dibujo, pintura, collage, madera, pizarra y objetos",
        "url": ORIGIN + "/retratos-por-encargo-bilbao/",
        "inLanguage": "es-ES",
        "dateModified": catalogue["reviewed"],
        "description": "Retrato personalizado pintado a mano a partir de tu foto, por encargo con Naroa Gutiérrez Gil en Bilbao y envío a toda España. Piezas originales hechas a mano, sin IA, a partir de fotografía e historia personal: dibujo, pintura, collage, madera, objetos y pizarra con presupuesto cerrado previo.",
        "image": [ORIGIN + ex["photos"][0]["original"] for ex, *_ in commission_examples],
        "provider": canonical_artist_entity,
        "providerMobility": "dynamic",
        "availableLanguage": ["es", "eu"],
        "address": {
            "@type": "PostalAddress",
            "streetAddress": "Bilbao, Bizkaia",
            "addressLocality": "Bilbao",
            "addressRegion": "Bizkaia",
            "postalCode": "48001",
            "addressCountry": "ES",
        },
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": 43.2630,
            "longitude": -2.9350,
        },
        "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
        "areaServed": [
            {"@type": "City", "name": "Bilbao", "sameAs": "https://es.wikipedia.org/wiki/Bilbao"},
            {"@type": "City", "name": "Getxo", "sameAs": "https://es.wikipedia.org/wiki/Guecho"},
            {"@type": "AdministrativeArea", "name": "Bizkaia", "sameAs": "https://es.wikipedia.org/wiki/Vizcaya"},
            {"@type": "AdministrativeArea", "name": "País Vasco", "sameAs": "https://es.wikipedia.org/wiki/Pa%C3%ADs_Vasco"},
            {"@type": "Country", "name": "España", "sameAs": "https://es.wikipedia.org/wiki/Espa%C3%B1a"},
        ],
        "knowsAbout": [
            "Retrato por encargo en Bilbao",
            "Retrato personalizado a partir de fotografía",
            "Retrato al óleo y dibujo a lápiz y pastel Conté",
            "Collage contemporáneo y textil sobre madera",
            "Cajas personalizadas y objetos intervenidos",
            "Retrato en técnica mixta sobre pizarra natural y mica mineral",
        ],
        "workExample": [
            {
                "@type": "VisualArtwork",
                "@id": ORIGIN + "/obra/" + ex["slug"] + "/#artwork",
                "name": ex["title"],
                "url": ORIGIN + "/obra/" + ex["slug"] + "/",
                "image": ORIGIN + ex["photos"][0]["original"],
                "artMedium": ex.get("technique"),
                "artworkSurface": ex.get("support") or support_label,
            }
            for ex, support_label, _ in commission_examples
        ],
        "subjectOf": {
            "@type": "ItemList",
            "@id": ORIGIN + "/retratos-por-encargo-bilbao/#proceso-y-dudas",
            "name": "Guía de taller para encargos de retratos personalizados en Bilbao",
            "numberOfItems": len(commission_faqs),
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": idx + 1,
                    "item": {
                        "@type": "Question",
                        "name": q,
                        "acceptedAnswer": {
                            "@type": "Answer",
                            "text": a,
                        },
                    },
                }
                for idx, (q, a) in enumerate(commission_faqs)
            ],
        },
        "hasOfferCatalog": {
            "@type": "OfferCatalog",
            "name": "Formatos y técnicas de retratos personalizados",
            "itemListElement": [
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Retrato en dibujo, textil y collage",
                        "description": "Composición de autor con dibujo a grafito/pastel, telas, costuras y elementos biográficos sobre madera noble o soporte rígido.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Caja personalizada u objeto intervenido",
                        "description": "Objeto tridimensional de recuerdo con retrato integrado y elementos de memoria familiar en madera tratada.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Retrato sobre pizarra natural",
                        "description": "Exploración en técnica mixta (acrílico, lápices y detalles minerales) sobre soporte de pizarra natural.",
                    },
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Retrato al óleo o gran formato sobre madera",
                        "description": "Pintura al óleo o técnica mixta en mediano y gran formato con acabado protector de galería.",
                    },
                },
            ],
        },
        "termsOfService": "Propuesta y presupuesto cerrado previo por escrito sin compromiso. Plazo habitual de 2 a 4 semanas según secado de materiales. Entrega en mano en Bilbao o envío asegurado.",
        "potentialAction": [
            {
                "@type": "CommunicateAction",
                "name": "Solicitar presupuesto de retrato por email",
                "target": "mailto:encargos@naroagutierrezgil.com?subject=Solicitud%20de%20presupuesto%20para%20retrato%20por%20encargo",
            },
            {
                "@type": "CommunicateAction",
                "name": "Consultar encargo por WhatsApp directo",
                "target": "https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20consultar%20un%20encargo%20de%20retrato%20personalizado%20por%20encargo.",
            },
        ],
    }
    page("/retratos-por-encargo-bilbao/", "Retrato personalizado pintado a mano desde tu foto · Retratos por encargo", "Retrato personalizado pintado a mano a partir de tu foto: una persona, una pareja, la familia o tu mascota. Naroa Gutiérrez Gil, retratista en Bilbao, sin IA. Presupuesto cerrado previo y envío asegurado a toda España.", '<main id="main">' + commissions + '</main>', amor["photos"][0]["original"], schema=commissions_schema, image_alt=work_alt(amor))

    # ── Páginas por búsqueda real ─────────────────────────────────────────────────────────────
    # Una página por lo que la gente escribe en el buscador («retrato de pareja», «retrato de un
    # familiar fallecido», «retrato de mascota»). Van en tercera persona y solo con datos ya publicados:
    # la ficha de cada obra en el catálogo y las condiciones de la página de encargos. No se inventan
    # citas, obras, precios ni testimonios; lo que va en <blockquote> es la ficha literal del catálogo.
    def find_work(slug):
        return next(p for p in projects if p["slug"] == slug)

    def rp_work(w, text, eager=False):
        meta = " · ".join(filter(None, [str(w["year"]) if w.get("year") else None, w.get("technique"), w.get("dimensions")]))
        return (
            f'<figure class="rp-work"><a href="/obra/{w["slug"]}/"><img src="{w["cover"]}"{cover_dims(w["cover"])} sizes="(max-width:820px) 88vw, 44vw" alt="{esc(work_alt(w))}" loading="{"eager" if eager else "lazy"}" decoding="async"></a>'
            f'<figcaption><span class="rp-work-meta">{esc(meta)}</span><a class="rp-work-title" href="/obra/{w["slug"]}/">{esc(w["title"])} ↗</a><p>{esc(text)}</p></figcaption></figure>'
        )

    def rp_detail(w, caption_start):
        # Fotografía de detalle o de proceso de la ficha, con su pie literal. Si la ficha ya no tiene esa foto, el build falla.
        ph = next(ph for ph in w["photos"] if (ph.get("caption") or "").startswith(caption_start))
        return (
            f'<figure class="rp-detail"><a href="/obra/{w["slug"]}/"><img src="{ph["src"]}"{cover_dims(ph["src"])} sizes="(max-width:820px) 88vw, 30vw" alt="{esc(work_alt(w, ph["caption"]))}" loading="lazy" decoding="async"></a>'
            f'<figcaption><a class="rp-work-meta" href="/obra/{w["slug"]}/">{esc(w["title"])}</a><p>{esc(ph["caption"])}</p></figcaption></figure>'
        )

    rp_conditions = [
        ("Precio cerrado", "Por escrito y antes de empezar. La mitad al arrancar y la otra mitad a la entrega."),
        ("2 a 4 semanas", "Lo que tardan en secar capas y barnices. Si hay una fecha señalada, conviene decirlo en el primer mensaje."),
        ("20 × 30 a 40 × 50 cm", "O a medida del sitio donde vaya a vivir. Firmado, con certificado de autenticidad y listo para colgar."),
        ("A toda España", "Envío asegurado en caja rígida, con seguimiento hasta la puerta. En Bilbao y Bizkaia, entrega en mano."),
    ]
    rp_conditions_html = '<dl class="rp-facts">' + ''.join(f'<div><dt>{esc(dt)}</dt><dd>{esc(dd)}</dd></div>' for dt, dd in rp_conditions) + '</dl>'
    rp_q_price = ("¿Cuánto cuesta?", "No hay una tarifa fija: depende del soporte y del tamaño. Naroa da una cifra cerrada y por escrito antes de empezar; se paga la mitad al arrancar y la otra mitad a la entrega.")
    rp_q_objects = ("¿Se puede incluir algún objeto o recuerdo?", "Sí. Naroa integra objetos reales en sus piezas: cartas, entradas, botones, telas, chapas, billetes de tren. Se le envían o se llevan al estudio de Bilbao y pasan a formar parte de la obra.")

    def rp_page(path, title, description, kicker, h1, lead, works_heading, works, extra, questions, wa_text, mail_subject, about_name, details=()):
        cover = works[0][0]
        works_html = ''.join(rp_work(w, text, eager=(i == 0)) for i, (w, text) in enumerate(works))
        faq = ''.join(f'<details class="commission-faq-item"><summary>{esc(q)}</summary><p>{esc(a)}</p></details>' for q, a in questions)
        details_html = (
            '<section class="rp-section" aria-labelledby="rp-de-cerca"><h2 id="rp-de-cerca" class="rp-h2">Hecho a mano, de cerca</h2>'
            '<p class="rp-text">Fotografías de detalle y de proceso de estas obras, tal como están en su ficha.</p>'
            '<div class="rp-details">' + ''.join(rp_detail(w, start) for w, start in details) + '</div></section>'
        ) if details else ''
        body = (
            '<main id="main" class="retrato-pagina">'
            f'<header class="rp-hero"><p class="rp-kicker">{esc(kicker)}</p><h1 class="rp-title">{esc(h1)}</h1>{season_note}{lead}</header>'
            f'<section class="rp-section" aria-labelledby="rp-obras"><h2 id="rp-obras" class="rp-h2">{esc(works_heading)}</h2><div class="rp-works{" rp-works--solo" if len(works) == 1 else ""}">{works_html}</div>{extra}</section>'
            f'{details_html}'
            f'<section class="rp-section" aria-labelledby="rp-condiciones"><h2 id="rp-condiciones" class="rp-h2">Cómo se encarga</h2>'
            '<p class="rp-text">Se le escribe a Naroa por WhatsApp o por correo con la foto o las fotos que haya y un par de líneas sobre la persona. Ella propone soporte y tamaño, y da el precio por escrito antes de empezar.</p>'
            f'{rp_conditions_html}</section>'
            f'<section class="rp-section rp-faq" aria-labelledby="rp-dudas"><h2 id="rp-dudas" class="rp-h2">Dudas habituales</h2>{faq}</section>'
            '<section class="rp-section rp-close" aria-labelledby="rp-escribir"><h2 id="rp-escribir" class="rp-h2">Escribir a Naroa</h2>'
            '<p class="rp-text">Responde ella misma, desde el estudio de Bilbao.</p>'
            '<p class="rp-actions">'
            f'<a class="rp-link rp-link--lead" href="https://wa.me/34636060609?text={quote(wa_text)}" target="_blank" rel="noopener noreferrer">Por WhatsApp ↗</a>'
            f'<a class="rp-link" href="mailto:encargos@naroagutierrezgil.com?subject={quote(mail_subject)}">encargos@naroagutierrezgil.com ↗</a>'
            '<a class="rp-link" href="/retratos-por-encargo-bilbao/#configurador">Componer el encargo paso a paso ↗</a>'
            '</p></section>'
            '</main>'
        )
        schema = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": ORIGIN + path + "#webpage",
            "name": title,
            "url": ORIGIN + path,
            "description": description,
            "isPartOf": {"@id": ORIGIN + "/#website"},
            "about": {"@id": ORIGIN + "/retratos-por-encargo-bilbao/#service"},
            "mainEntity": {
                "@type": "Service",
                "@id": ORIGIN + path + "#service",
                "name": about_name,
                "serviceType": "Retrato por encargo hecho a mano a partir de fotografía",
                "url": ORIGIN + path,
                "provider": {"@id": ORIGIN + "/#artist"},
                "areaServed": {"@type": "Country", "name": "España"},
                "isRelatedTo": {"@id": ORIGIN + "/retratos-por-encargo-bilbao/#service"},
            },
            "image": [ORIGIN + w["photos"][0]["original"] for w, _ in works],
            # Las mismas preguntas y respuestas que se leen en la página, sin añadir ninguna. Van como lista
            # de Question, igual que en la página de encargos: el control del sitio no admite FAQPage.
            "subjectOf": {
                "@type": "ItemList",
                "@id": ORIGIN + path + "#rp-dudas",
                "name": "Dudas habituales · " + about_name,
                "numberOfItems": len(questions),
                "itemListElement": [
                    {"@type": "ListItem", "position": idx + 1, "item": {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}}
                    for idx, (q, a) in enumerate(questions)
                ],
            },
        }
        page(path, title, description, body, cover["photos"][0]["original"], schema=schema, image_alt=work_alt(cover))

    love_boat = find_work("the-love-boat")
    multi_love = find_work("multi-dimensional-love")
    hermanos = find_work("aquellos-maravillosos-anos")
    reencuentro = find_work("el-reencuentro")
    gato_kutxa = find_work("el-gato-que-es-kutxa")

    rp_page(
        "/retrato-de-pareja-y-familia/",
        "Retrato de pareja y de familia hecho a mano desde tu foto",
        "Retrato de pareja o de familia hecho a mano a partir de vuestras fotos, sin IA: pintura, collage y objetos. Presupuesto cerrado antes de empezar y envío asegurado a toda España.",
        "Naroa Gutiérrez Gil · Retratos por encargo",
        "Retrato de pareja y de familia, hecho a mano desde vuestras fotos",
        '<p class="rp-lead"><strong>No hace falta una foto en la que salgáis todos bien.</strong> Naroa trabaja con varias fotografías, también de móvil, y las reúne en una sola pieza original: pintada, cosida o montada a mano, sin IA.</p>',
        "Cuatro retratos de dos",
        [
            (love_boat, "Retrato doble sobre una tabla de madera de 50 × 50 cm: acrílico, rotuladores y collage de papeles, telas y celofán."),
            (multi_love, "Retrato doble en 3D, hecho a partir de tres fotografías y montado por capas articuladas dentro de una lata de conservas."),
            (hermanos, "Dos hermanos, a lápices de colores sobre papel A4."),
            (reencuentro, "Una hija y su padre, juntos en un lienzo de 30 × 40 cm a partir de una foto de él de joven."),
        ],
        '<p class="rp-text">Cada obra tiene su ficha con técnica, medidas y fotografías de detalle. Para un retrato en recuerdo de alguien, hay una página aparte: <a class="rp-link" href="/retrato-de-un-ser-querido-fallecido/">retrato en recuerdo de un ser querido ↗</a></p>',
        [
            ("¿Sirve una foto de móvil, o varias fotos distintas?", "Sí. Vale una foto de móvil, aunque esté movida, y valen varias: una en la que alguien sale bien de cara y otra con el gesto o la ropa que le define. Naroa las combina en el taller en una sola composición."),
            rp_q_objects,
            rp_q_price,
            ("¿Llega a tiempo para una boda o un aniversario?", "El plazo habitual es de 2 a 4 semanas. Si hay fecha, conviene decirlo en el primer mensaje para que Naroa busque hueco."),
        ],
        "Hola Naroa, me gustaría encargar un retrato de pareja o de familia. Tengo fotos para enseñarte.",
        "Retrato de pareja o de familia por encargo",
        "Retrato de pareja y de familia por encargo, hecho a mano desde fotografía",
        details=[
            (love_boat, "Detalle del retrato femenino"),
            (multi_love, "Tapa con rótulo Dymo"),
            (hermanos, "Detalle de los rostros"),
            (hermanos, "Detalle del entramado de tartán"),
        ],
    )

    rp_page(
        "/retrato-de-un-ser-querido-fallecido/",
        "Retrato de un ser querido fallecido, desde una foto antigua",
        "Retrato pintado a mano en recuerdo de un ser querido. Sirve una foto antigua, pequeña o de móvil. Naroa Gutiérrez Gil, sin IA, con presupuesto cerrado y envío asegurado a toda España.",
        "Naroa Gutiérrez Gil · Retratos por encargo",
        "Retrato en recuerdo de un ser querido, a partir de la foto que tengas",
        '<p class="rp-lead"><strong>Sirve una foto antigua, pequeña o de móvil.</strong> No hace falta que sea buena: basta con que sea suya.</p>'
        '<p class="rp-text">Naroa Gutiérrez Gil pinta retratos a mano a partir de fotografías. Cuando solo queda una imagen —enmarcada tras un cristal, en blanco y negro, recortada de una foto de grupo— trabaja con esa. Y si hay varias, puede reunir en un mismo retrato a dos personas a partir de fotos distintas.</p>',
        "Una obra hecha así",
        [
            (reencuentro, "Retrato doble en blanco y negro sobre lienzo 3D de 30 × 40 cm: pintura acrílica negra, toques de rotulador blanco y una capa de látex líquido que lo protege."),
        ],
        '<blockquote class="rp-quote"><p>Mediante esta obra, una hija y su padre volvieron a encontrarse sobre un fondo blanco. Todo gracias a una foto de joven de él, que me permitió —esquivando los reflejos del cristal que protegía su mirada— trazarles, de nuevo, juntos.</p><footer>De la ficha de <a class="rp-link" href="/obra/el-reencuentro/">El Reencuentro ↗</a></footer></blockquote>',
        [
            ("Solo tengo una foto y es mala. ¿Sirve?", "Casi siempre. Una foto de carné, una imagen escaneada o una de móvil con poca luz suelen bastar. Lo mejor es enviarla: Naroa la mira y contesta ella misma."),
            ("¿Puede aparecer junto a alguien de la familia?", "Sí. En El Reencuentro, una hija y su padre aparecen juntos a partir de una foto de él de joven."),
            rp_q_objects,
            ("¿Cuánto tarda y cuánto cuesta?", "El plazo habitual es de 2 a 4 semanas. No hay una tarifa fija: Naroa da una cifra cerrada y por escrito antes de empezar; se paga la mitad al arrancar y la otra mitad a la entrega."),
        ],
        "Hola Naroa, me gustaría encargar un retrato en recuerdo de una persona. Te enseño la foto que tengo.",
        "Retrato en recuerdo de un ser querido",
        "Retrato en recuerdo de un ser querido, pintado a mano desde una fotografía antigua",
    )

    rp_page(
        "/retrato-de-mascota/",
        "Retrato de mascota hecho a mano desde tu foto: perro o gato",
        "Retrato de tu perro o tu gato hecho a mano a partir de una foto, sin IA. Naroa Gutiérrez Gil: pieza original, presupuesto cerrado antes de empezar y envío asegurado a toda España.",
        "Naroa Gutiérrez Gil · Retratos por encargo",
        "Retrato de tu perro o tu gato, hecho a mano desde una foto",
        '<p class="rp-lead"><strong>Sirve una foto de móvil.</strong> Naroa Gutiérrez Gil acepta encargos de retratos de mascotas con las mismas condiciones que cualquier otro retrato: una pieza original hecha a mano, sin IA y con el precio cerrado antes de empezar.</p>',
        "El gato del catálogo",
        [
            (gato_kutxa, "Una caja de madera de 4,7 × 8,3 × 8,3 cm: un gato en fotocopia recortada sobre una tapa pintada en rosa y turquesa, con huellas estampadas y el interior preparado para un regalo."),
        ],
        '<p class="rp-text">El catálogo público todavía no recoge ningún retrato de mascota hecho por encargo; esta caja es el animal que sí está. Las materias sobre las que trabaja Naroa —madera, tela vaquera cosida, papel, pizarra natural, cajas y latas— se ven en <a class="rp-link" href="/retratos-por-encargo-bilbao/">la página de encargos ↗</a></p>',
        [
            ("¿Sirve una foto de móvil?", "Sí, aunque esté movida. Si hay varias, mejor: una donde se le vea bien la cara y otra con su gesto de siempre. Naroa las combina en el taller."),
            ("¿Y si ya no está?", "Sirve una foto antigua. El encargo se hace igual, a partir de la imagen que haya."),
            rp_q_objects,
            rp_q_price,
        ],
        "Hola Naroa, me gustaría encargar un retrato de mi mascota. Tengo fotos para enseñarte.",
        "Retrato de mascota por encargo",
        "Retrato de mascota por encargo, hecho a mano desde fotografía",
        details=[
            (gato_kutxa, "Proceso: fondo e imagen recortada"),
            (gato_kutxa, "Interior de la caja"),
        ],
    )

    contact = f'''<main id="main" class="contact-page"><div class="contact-background" data-parallax><img src="{rara['cover']}" alt="Rara Avis, composición de retratos y reflejos" fetchpriority="high"></div><div class="contact-shade"></div><section class="contact-copy"><p class="eyebrow">Naroa Gutiérrez Gil · Bilbao</p><h1 class="hand">¿Hablamos?</h1><p>Una persona. Una historia. Una idea a medio hacer.<br>No hace falta traerlo todo pensado.</p><a class="contact-email" href="mailto:encargos@naroagutierrezgil.com?subject=Retrato%20por%20encargo">encargos@naroagutierrezgil.com ↗</a><div class="contact-channels" aria-label="Vías de contacto diferenciadas"><article class="contact-channel"><span class="eyebrow">Encargos y obra</span><a class="text-link" href="mailto:encargos@naroagutierrezgil.com?subject=Consulta%20sobre%20obra%20o%20encargo">Escribir por correo ↗</a><p>Consultas sobre obras del catálogo, formatos y encargos personalizados.</p></article><article class="contact-channel"><span class="eyebrow">Trato directo</span><a class="text-link" href="https://wa.me/34636060609?text=Hola%20Naroa%2C%20me%20gustar%C3%ADa%20hablar%20sobre%20un%20encargo." target="_blank" rel="noopener noreferrer">También por WhatsApp ↗</a><p>Conversación ágil para comentar una idea inicial o concertar llamada.</p></article><article class="contact-channel"><span class="eyebrow">Redes y archivo</span><a class="text-link" href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook · Naroa Artista Plástica ↗</a><p>Álbumes de proceso, exposiciones y archivo fotográfico de cada serie.</p></article></div><div class="contact-details"><a href="tel:+34636060609">+34 636 060 609</a><a href="https://www.facebook.com/naroa.artista.plastica" target="_blank" rel="noopener noreferrer">Facebook ↗</a><a href="https://instagram.com/naroa_art/" target="_blank" rel="noopener noreferrer">@naroa_art ↗</a><a href="https://naroagutierrez.wordpress.com/" target="_blank" rel="noopener noreferrer">Blog en WordPress ↗</a><span>Bilbao · País Vasco</span></div></section></main>'''
    contact_schema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "@id": ORIGIN + "/contacto/#contact",
        "name": "Contacto · Naroa Gutiérrez Gil",
        "url": ORIGIN + "/contacto/",
        "description": "Habla con Naroa Gutiérrez Gil sobre una obra o un retrato por encargo. Bilbao. Email, WhatsApp e Instagram.",
        "mainEntity": canonical_artist_entity,
    }
    page("/contacto/", "Contacto", "Habla con Naroa Gutiérrez Gil sobre una obra o un retrato por encargo. Bilbao. Email, WhatsApp e Instagram.", contact, rara["photos"][0]["original"], schema=contact_schema)
    page("/404/", "Esta página se ha ido de paseo", "Vuelve a la obra de Naroa Gutiérrez Gil.", '<main id="main" class="not-found"><p class="eyebrow">404</p><h1>Esta página<br>se ha ido de paseo.</h1><a class="text-link" href="/">Volver a la obra ↗</a></main>', amor["photos"][0]["original"], not_found=True)
    aliases = {
        "/bio/": "/sobre-mi/",
        "/exposiciones/": "/trayectoria/",
        "/encargos/": "/retratos-por-encargo-bilbao/",
        "/retratos-por-encargo/": "/retratos-por-encargo-bilbao/",
        "/retrato-por-encargo/": "/retratos-por-encargo-bilbao/",
        "/retrato-por-encargo-bilbao/": "/retratos-por-encargo-bilbao/",
        "/prensa/": "/cuaderno/",
        "/blog/": "/cuaderno/",
        "/obra/marian-de-miranda-luciendo-la-pantorrilla/": "/obra/marian-de-miranda/",
    }
    for src, dest in aliases.items():
        write(output / src.lstrip("/") / "index.html", f'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={dest}"><link rel="canonical" href="{ORIGIN}{dest}"><title>Naroa Gutiérrez Gil</title></head><body><a href="{dest}">Continuar →</a></body></html>')

    def optimize(job):
        dest, (src, limit, quality, fmt, width) = job
        if dest.exists():
            return
        with Image.open(src) as original:
            im = ImageOps.exif_transpose(original).convert("RGB")
            im.thumbnail((limit, limit), Image.Resampling.LANCZOS)
            if width:
                im.thumbnail((width, limit), Image.Resampling.LANCZOS)
            if fmt == "AVIF":
                im.save(dest, "AVIF", quality=quality, speed=6)
            else:
                im.save(dest, "WEBP", quality=quality, method=6)
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(optimize, jobs.items()))
    for src in originals:
        dest = output / src.lstrip("/")
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            shutil.copy2(SOURCE / src.lstrip("/"), dest)
    # Reframe the existing thumbnail inside SVG; the reviewed artwork is untouched.
    icon_image = base64.b64encode((output / amy["thumb"].lstrip("/")).read_bytes()).decode("ascii")
    icon = f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="{icon_viewbox}"><title>Amy Rocks · Naroa</title><image width="480" height="360" href="data:image/webp;base64,{icon_image}"/></svg>'
    write(output / favicon_path.lstrip("/"), icon)
    write(output / "favicon.svg", icon)

    work_by_route = {f"/obra/{p['slug']}/": p for p in projects}
    sitemap_entries = []
    for path, image, page_title, page_alt in pages:
        if path in work_by_route:
            w = work_by_route[path]
            imgs = ''.join(f'<image:image><image:loc>{ORIGIN}{esc(ph["original"])}</image:loc><image:title>{esc(w["title"])} · {esc(ph["caption"])}</image:title><image:caption>{esc(work_alt(w, ph["caption"]))}</image:caption></image:image>' for ph in w["photos"])
        elif path == "/retratos-por-encargo-bilbao/":
            imgs = ''.join(f'<image:image><image:loc>{ORIGIN}{esc(ex["photos"][0]["original"])}</image:loc><image:title>{esc(ex["title"])} · {esc(kind_label)}</image:title><image:caption>{esc(work_alt(ex, kind_label))}</image:caption></image:image>' for ex, kind_label, *_ in commission_examples)
        else:
            imgs = f'<image:image><image:loc>{ORIGIN}{esc(image)}</image:loc><image:title>{esc(page_title)} · Naroa Gutiérrez Gil</image:title><image:caption>{esc(page_alt)}</image:caption></image:image>' if image else ''
        sitemap_entries.append(f'<url><loc>{ORIGIN}{path}</loc><lastmod>{catalogue["reviewed"]}</lastmod>{imgs}</url>')
    robots_content = (
        "User-agent: OAI-SearchBot\n"
        "Allow: /\n\n"
        "User-agent: PerplexityBot\n"
        "Allow: /\n\n"
        "User-agent: Googlebot\n"
        "Allow: /\n\n"
        "User-agent: Bingbot\n"
        "Allow: /\n\n"
        "User-agent: ClaudeBot\n"
        "Allow: /\n\n"
        "User-agent: Applebot-Extended\n"
        "Allow: /\n\n"
        "User-agent: cohere-ai\n"
        "Allow: /\n\n"
        "User-agent: Meta-ExternalAgent\n"
        "Allow: /\n\n"
        "User-agent: GPTBot\n"
        "Disallow: /\n\n"
        "User-agent: CCBot\n"
        "Disallow: /\n\n"
        "User-agent: Google-Extended\n"
        "Disallow: /\n\n"
        "User-agent: Bytespider\n"
        "Disallow: /\n\n"
        "User-agent: anthropic-ai\n"
        "Allow: /\n\n"
        "User-agent: Amazonbot\n"
        "Disallow: /\n\n"
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /test/\n"
        "Disallow: /assets/backup_*/\n\n"
        "Sitemap: " + ORIGIN + "/sitemap.xml\n\n"
        "# LLM Knowledge Graph & Discovery Directives (GEO SOTA 2026)\n"
        "# Concise summary for LLM context windows:\n"
        f"# {ORIGIN}/llms.txt\n"
        "# Comprehensive catalogue and technical specifications:\n"
        f"# {ORIGIN}/llms-full.txt\n"
        "# Structured JSON catalog endpoint:\n"
        f"# {ORIGIN}/api/catalog.json\n"
    )
    sitemap_xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">' + ''.join(sitemap_entries) + '</urlset>\n'
    write(output / "robots.txt", robots_content)
    write(REPO / "public" / "robots.txt", robots_content)
    write(output / "sitemap.xml", sitemap_xml)
    write(REPO / "public" / "sitemap.xml", sitemap_xml)

    blog_file = SOURCE / "data/blog.json"
    blog_posts = json.loads(blog_file.read_text()).get("posts", []) if blog_file.exists() else []

    feed_items = []
    for p in projects:
        pub_year = p.get("year")
        try:
            year_int = int(pub_year)
        except (ValueError, TypeError):
            year_int = 2026
        dt = datetime(year_int, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        medium_parts = [p.get("technique"), p.get("support"), p.get("dimensions")]
        medium_desc = " · ".join(filter(None, medium_parts))
        desc_text = f"{p['story']} ({medium_desc})" if medium_desc else p['story']
        item_xml = (
            "<item>"
            f"<title>{esc(p['title'])} · Retrato de autor</title>"
            f"<link>{ORIGIN}/obra/{p['slug']}/</link>"
            f"<guid isPermaLink=\"true\">{ORIGIN}/obra/{p['slug']}/</guid>"
            f"<pubDate>{format_datetime(dt)}</pubDate>"
            "<dc:creator>Naroa Gutiérrez Gil</dc:creator>"
            "<author>naroa@naroagutierrezgil.com (Naroa Gutiérrez Gil)</author>"
            f"<description>{esc(desc_text)}</description>"
            f'<enclosure url="{ORIGIN}{esc(p["cover"])}" length="0" type="image/webp"/>'
            "</item>"
        )
        feed_items.append(item_xml)

    for post in blog_posts:
        try:
            post_dt = datetime.fromisoformat(post["date"]).replace(tzinfo=timezone.utc)
        except Exception:
            post_dt = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        post_link = post.get("url") or f"{ORIGIN}/cuaderno/"
        item_xml = (
            "<item>"
            f"<title>{esc(post['title'])}</title>"
            f"<link>{esc(post_link)}</link>"
            f"<guid isPermaLink=\"true\">{esc(post_link)}</guid>"
            f"<pubDate>{format_datetime(post_dt)}</pubDate>"
            "<dc:creator>Naroa Gutiérrez Gil</dc:creator>"
            "<author>naroa@naroagutierrezgil.com (Naroa Gutiérrez Gil)</author>"
            f"<description>{esc(post.get('summary', ''))}</description>"
            "</item>"
        )
        feed_items.append(item_xml)

    build_now = datetime(2026, 10, 24, 8, 20, 0, tzinfo=timezone.utc)
    feed_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        '  <channel>\n'
        '    <title>Naroa Gutiérrez Gil · Arte y Retratos</title>\n'
        f'    <link>{ORIGIN}/</link>\n'
        '    <description>Catálogo de obra plástica, servicio de retratos de autor y publicaciones del blog de Naroa Gutiérrez Gil en Bilbao.</description>\n'
        '    <language>es-es</language>\n'
        f'    <lastBuildDate>{format_datetime(build_now)}</lastBuildDate>\n'
        f'    <atom:link href="{ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>\n'
        + "".join(feed_items)
        + '\n  </channel>\n'
        '</rss>\n'
    )
    write(output / "feed.xml", feed_xml)
    write(REPO / "public" / "feed.xml", feed_xml)
    indexnow_key = "6621e1f1c138eeb14922f7804f61ae34"
    indexnow_payload = json.dumps({"host": "naroagutierrezgil.com", "key": indexnow_key, "keyLocation": f"{ORIGIN}/{indexnow_key}.txt", "urlList": [ORIGIN + p[0] for p in pages]}, indent=2) + "\n"
    write(output / f"{indexnow_key}.txt", indexnow_key + "\n")
    write(output / "indexnow.json", indexnow_payload)
    write(REPO / "public" / f"{indexnow_key}.txt", indexnow_key + "\n")
    write(REPO / "public" / "indexnow.json", indexnow_payload)

    catalog_api = {
        "version": "1.2",
        "entity_id": ORIGIN + "/#artist",
        "studio_id": ORIGIN + "/#studio",
        "artist": {
            "name": "Naroa Gutiérrez Gil",
            "role": "Artista plástica y retratista contemporánea",
            "location": "Bilbao, Bizkaia, País Vasco, España",
            "coordinates": {"latitude": 43.2630, "longitude": -2.9350},
            "url": ORIGIN + "/",
            "sameAs": artist_same_as,
            "canonical_locations": {
                "studio": {
                    "@id": ORIGIN + "/#studio",
                    "name": "Estudio Naroa Gutiérrez Gil · Bilbao",
                    "address_locality": "Bilbao",
                    "address_region": "Bizkaia",
                    "postal_code": "48001",
                    "country": "ES",
                    "coordinates": {"latitude": 43.2630, "longitude": -2.9350},
                    "hasMap": "https://www.google.com/maps?q=Bilbao,+Bizkaia",
                }
            },
            "contact": {
                "email": "naroa@naroagutierrezgil.com",
                "whatsapp": "+34636060609",
                "inquiry_form": ORIGIN + "/contacto/",
            },
            "commission_service": {
                "@id": ORIGIN + "/retratos-por-encargo-bilbao/#service",
                "url": ORIGIN + "/retratos-por-encargo-bilbao/",
                "provider": ORIGIN + "/#artist",
                "supports": [
                    "Collage y técnica mixta textil sobre madera",
                    "Retrato al óleo y dibujo a grafito/pastel",
                    "Cajas tridimensionales y objetos intervenidos",
                    "Pizarra natural (exploración reciente)",
                ],
                "pricing_policy": "Presupuesto cerrado previo por escrito según técnica y dimensiones, sin compromiso",
                "turnaround": "2 a 4 semanas según complejidad y secado de materiales",
                "delivery": "Entrega en mano en Bilbao y Bizkaia o envío asegurado nacional e internacional",
            },
        },
        "evidence_graph": {
            "studio_locus": "Bilbao, Bizkaia, España",
            "disciplines": [
                "Retrato al óleo, grafito y pastel Conté",
                "Collage textil y ensamblaje de objetos sobre madera",
                "Cajas tridimensionales de memoria y objetos intervenidos",
                "Exploraciones en técnica mixta sobre pizarra natural",
            ],
            "query_fan_out": [
                {
                    "intent": "Precios y presupuestos de retratos por encargo",
                    "question": "¿Cuánto cuesta un retrato personalizado en Bilbao con Naroa Gutiérrez Gil?",
                    "answer": "Presupuesto cerrado previo por escrito según técnica, soporte y formato (dibujo, óleo, collage textil sobre madera, cajas de memoria o piezas en pizarra de 20×30 cm a 40×50 cm). Sin compromiso previo.",
                },
                {
                    "intent": "Plazos de entrega",
                    "question": "¿Cuál es el plazo de entrega habitual de un encargo?",
                    "answer": "De 2 a 4 semanas según la técnica elegida y los tiempos de secado de óleos, acrílicos y barnices. Plazos prioritarios con aviso previo para fechas señaladas.",
                },
                {
                    "intent": "Proceso de encargo a partir de fotos",
                    "question": "¿Cómo se encarga un retrato personalizado a partir de fotografías?",
                    "answer": "Se envían fotografías de referencia por WhatsApp o email comentando el carácter o anécdotas; Naroa realiza una reinterpretación artística de autor en el soporte acordado.",
                },
                {
                    "intent": "Entrega local y envíos",
                    "question": "¿Dónde se entrega la obra?",
                    "answer": "Entrega en mano en Bilbao y Bizkaia, o envío protegido y asegurado a cualquier destino nacional e internacional.",
                },
                {
                    "intent": "Conservación y cuidado de las obras",
                    "question": "¿Cómo se conserva y limpia una obra en técnica mixta, collage u objeto intervenido?",
                    "answer": "Las piezas cuentan con fijación y barniz protector satinado. Se recomienda limpieza en seco con plumero suave o gamuza de microfibra, evitando humedad directa, disolventes o productos abrasivos.",
                },
                {
                    "intent": "Elección de soportes y materiales",
                    "question": "¿Qué aporta trabajar sobre madera, collage textil, objetos o pizarra frente al lienzo convencional?",
                    "answer": "Cada soporte aporta textura, volumen y relato propio: las betas de la madera, las costuras textiles, las cajas de recuerdos o las aristas de la piedra dialogan directamente con la historia de la persona retratada.",
                },
                {
                    "intent": "Embalaje y seguridad de transporte",
                    "question": "¿Cómo se garantiza la seguridad en los envíos de obras con volumen o relieve?",
                    "answer": "Cada obra se embala con protección tricapa: lámina de barrera antiadherente, cantoneras de espuma de polietileno de alta densidad a medida y caja rígida reforzada con precinto de seguridad y seguro a todo riesgo.",
                },
                {
                    "intent": "Cita presencial en estudio de Bilbao",
                    "question": "¿Es posible visitar el estudio en Bilbao para elegir soportes o ver obra en directo?",
                    "answer": "Sí, previa cita por email o WhatsApp se conciertan visitas al estudio en Bilbao para valorar formatos, maderas, tejidos, objetos y definir la obra en persona.",
                },
                {
                    "intent": "Combinar varias fotografías en un retrato",
                    "question": "¿Se puede encargar un retrato en Bilbao uniendo a varias personas de fotografías distintas?",
                    "answer": "Sí, Naroa compone retratos conjuntos a partir de fotografías separadas (de distintas épocas, familiares o mascotas), integrándolas con coherencia cromática y narrativa en una misma obra de autor.",
                },
                {
                    "intent": "Regalos de boda, aniversario, jubilación u homenaje",
                    "question": "¿Qué formato de retrato personalizado se recomienda para un regalo de boda, aniversario o jubilación en Bilbao?",
                    "answer": "Para bodas, aniversarios o jubilaciones destacan las composiciones en collage textil sobre madera noble (30×40 cm o 40×50 cm) y las cajas de memoria tridimensionales intervenidas con objetos biográficos.",
                },
            ],
            "exhibitions_chronology": [
                {"year": 2026, "title": "BWALL Collective", "venue": "Colegio de Abogados de Bilbao", "press": "DEIA"},
                {"year": 2018, "title": "Dock Bilbao Showcase", "venue": "Dock Bilbao"},
                {"year": 2014, "title": "Politena Encuentros de Arte", "venue": "Politena Espacio de Arte, Bilbao"},
                {"year": 2010, "title": "Espejos del alma", "venue": "Colegio de Abogados de Bilbao", "press": "GARA, El Correo"},
                {"year": "2010+", "title": "Walking Gallery Bilbao", "venue": "Espacios públicos y galerías abiertas, Bilbao"},
            ],
        },
        "artworks_count": len(projects),
        "reviewed": catalogue["reviewed"],
        "artworks": [
            {
                "slug": p["slug"],
                "title": p["title"],
                "category": p["category"],
                "series": p.get("series"),
                "technique": p.get("technique"),
                "support": p.get("support"),
                "dimensions": p.get("dimensions"),
                "materials": p.get("materials"),
                "year": p.get("year"),
                "story": p["story"],
                "url": ORIGIN + "/obra/" + p["slug"] + "/",
                "cover_url": ORIGIN + p["cover"],
                "photos": [
                    {
                        "url": ORIGIN + ph["original"],
                        "width": ph.get("width"),
                        "height": ph.get("height"),
                        "caption": ph.get("caption") or p["title"],
                        "sha256": sha_by_src.get(ph["original"]),
                    }
                    for ph in p["photos"]
                ],
                "inquire_email": f"mailto:naroa@naroagutierrezgil.com?subject={quote('Consulta sobre '+p['title'])}",
                "inquire_whatsapp": f"https://wa.me/34636060609?text={quote('Hola Naroa, me gustaría consultar sobre la obra ' + p['title'])}",
            }
            for p in projects
        ],
    }
    catalog_json = json.dumps(catalog_api, ensure_ascii=False, indent=2) + "\n"
    write(output / "api" / "catalog.json", catalog_json)
    write(REPO / "public" / "api" / "catalog.json", catalog_json)

    webmcp_json = json.dumps(webmcp_manifest, ensure_ascii=False, indent=2) + "\n"
    write(output / ".well-known" / "mcp.json", webmcp_json)
    write(REPO / "public" / ".well-known" / "mcp.json", webmcp_json)

    llms_txt = (
        "# Naroa Gutiérrez Gil · Artista Plástica y Retratista (Bilbao)\n\n"
        "> Catálogo oficial de obra plástica, servicio de retratos personalizados por encargo y archivo de exposiciones.\n\n"
        "## Resumen del Sitio y Evidence Graph\n"
        f"- Dominio Canónico: {ORIGIN}\n"
        f"- Entidad Creadora: Naroa Gutiérrez Gil [ID Canónico: {ORIGIN}/#artist]\n"
        f"- Estudio Físico: Bilbao, Bizkaia, País Vasco, España (43.2630 N, -2.9350 W) [ID Canónico: {ORIGIN}/#studio]\n"
        "- Contacto Directo: naroa@naroagutierrezgil.com | WhatsApp: +34 636 060 609 | Instagram: @naroa_art\n"
        "- Perfiles de Autoridad (sameAs):\n"
        "  - Facebook: https://www.facebook.com/naroa.artista.plastica\n"
        "  - Instagram: https://instagram.com/naroa_art/\n"
        "  - Cuaderno WordPress: https://naroagutierrez.wordpress.com/\n"
        "  - DEIA Bizkaia: https://www.deia.eus/bizkaia/vida-social/2026/06/05/bwall-collective-inaugura-exposicion-ocho-11159371.html\n"
        "  - El Correo Agenda (2010): https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-112114.html\n"
        "  - El Correo Agenda (2015): https://agenda.elcorreo.com/evento/naroa-gutierrez-gil-espejos-del-alma-476343.html\n"
        "  - GARA Reportaje: https://gara.naiz.eus/paperezkoa/20130427/399965/es/Walking-gallery-arte-aire-libre-movimiento-arte-evolucion\n"
        "  - Siarte Leku: https://siarte.com/2022-03-25-siarte-exposicion-pintura-collage-arte-naroa-gutierrez.php\n"
        "  - YouTube: https://www.youtube.com/@naroagutierrezgil\n"
        "- Lenguaje y Práctica Artística: Retratos de autor y obra plástica multidisciplinar (dibujo, óleo, técnicas mixtas, collage textil sobre madera y objetos intervenidos, con exploraciones recientes sobre soportes minerales como la pizarra natural de cantera y mica).\n"
        f"- Servicio Canónico de Encargos: {ORIGIN}/retratos-por-encargo-bilbao/\n"
        "- Correo de Encargos: encargos@naroagutierrezgil.com\n"
        "- Exposiciones Documentadas: Colegio de Abogados de Bilbao (Espejos del alma), Dock Bilbao, Politena Espacio de Arte, Walking Gallery Bilbao.\n\n"
        "## Respuestas Factuales Inmediatas (Query Fan-Out)\n"
        "- **¿Cuánto cuesta un retrato personalizado?** Presupuesto cerrado previo por escrito según técnica, soporte y formato (dibujo, óleo, collage sobre madera, cajas de recuerdos o pizarra de 20×30 cm a 40×50 cm). Consulta sin compromiso.\n"
        "- **¿Cómo se encarga a partir de fotos?** Se envían 1 o varias fotos de referencia (incluso tomadas con el móvil); Naroa realiza una reinterpretación artística de autor capturando la personalidad y mirada.\n"
        "- **¿Cuáles son los plazos de entrega?** De 2 a 4 semanas según la técnica y el secado de óleos, acrílicos y barnices. Plazos prioritarios disponibles para fechas señaladas con aviso previo.\n"
        + (f"- **¿Hasta cuándo se puede encargar para Navidad y Reyes?** {' '.join(text for _, text in season_lines)}\n" if season_lines else "") +
        "- **¿Dónde se entrega?** Entrega en mano en Bilbao y Bizkaia, o envío protegido y asegurado a nivel nacional e internacional.\n"
        "- **¿Cómo conservar una obra en técnica mixta o collage?** Fijación y barniz protector satinado. Limpieza en seco con plumero suave o microfibra; evitar humedad directa o productos químicos.\n"
        "- **¿Qué aporta trabajar sobre madera, collage, objetos o pizarra?** Cada soporte (betas de madera, costuras textiles, cajas cotidianas o cantos de piedra) aporta textura, volumen y relato propio en diálogo con la persona retratada.\n"
        "- **¿Cómo es el embalaje para envíos?** Embalaje tricapa con cantoneras de polietileno de alta densidad a medida, caja rígida reforzada y seguro a todo riesgo incluido.\n"
        "- **¿Se puede visitar el estudio en Bilbao?** Sí, visitas con cita concertada previa para ver obra en directo, valorar soportes y definir el proyecto en persona.\n\n"
        "## Secciones Principales\n"
        f"- [Inicio e Inmersión]({ORIGIN}/): Experiencia inmersiva y catálogo completo de {len(projects)} obras.\n"
        f"- [Retratos por Encargo en Bilbao]({ORIGIN}/retratos-por-encargo-bilbao/): Condiciones técnicas, formatos (20×30 cm a 40×50 cm), plazos de 2 a 4 semanas, configurador interactivo y galería de ejemplos reales.\n"
        f"- [Catálogo Completo]({ORIGIN}/obra/): Ficha detallada de las {len(projects)} piezas de la colección con fotografías de detalle y relato.\n"
        f"- [Serie Vaivenes]({ORIGIN}/series/vaivenes/): Retratos en técnica mixta, collage textil y objetos de memoria.\n"
        f"- [Sobre Mí]({ORIGIN}/sobre-mi/): Biografía, técnica, proceso creativo y proyectos comunitarios (Walking Gallery Bilbao, El ReCreo).\n"
        f"- [Trayectoria]({ORIGIN}/trayectoria/): Archivo cronológico de exposiciones documentadas desde 2010 (DEIA, GARA, Politena, Dock Bilbao).\n"
        f"- [Cuaderno]({ORIGIN}/cuaderno/): Relatos de proceso, vivencias del taller y artículos de prensa.\n"
        f"- [Contacto]({ORIGIN}/contacto/): Canales directos de consulta para obra y encargos.\n"
        f"- [Retrato de pareja y de familia]({ORIGIN}/retrato-de-pareja-y-familia/): Retratos dobles y familiares hechos a mano desde fotografías, con obras de ejemplo.\n"
        f"- [Retrato en recuerdo de un ser querido]({ORIGIN}/retrato-de-un-ser-querido-fallecido/): Retrato pintado a mano a partir de una foto antigua, pequeña o de móvil.\n"
        f"- [Retrato de mascota]({ORIGIN}/retrato-de-mascota/): Encargos de retratos de perro o gato hechos a mano desde una foto.\n\n"
        "## Recursos Machine-to-Machine y GEO SOTA 2026\n"
        f"- [Catálogo JSON Estructurado]({ORIGIN}/api/catalog.json): Endpoint con especificaciones completas de las {len(projects)} obras y Evidence Graph.\n"
        f"- [Endpoint WebMCP]({ORIGIN}/.well-known/mcp.json): Manifiesto y definición formal de herramientas WebMCP para agentes autónomos.\n"
        f"- [Índice Extendido llms-full.txt]({ORIGIN}/llms-full.txt): Desglose exhaustivo de todas las piezas, fotos de detalle con hashes SHA-256 y condiciones de encargo.\n"
        f"- [Sitemap XML]({ORIGIN}/sitemap.xml): Índice canónico de {len(pages)} rutas y metadatos de imágenes.\n"
        f"- [Feed RSS 2.0]({ORIGIN}/feed.xml): Sindicación de obras recientes y publicaciones del taller.\n"
        f"- [Protocolo IndexNow]({ORIGIN}/indexnow.json): Sincronización instantánea de indexación para Bing y motores asociados.\n"
    )
    write(output / "llms.txt", llms_txt)
    write(REPO / "public" / "llms.txt", llms_txt)

    artworks_md = "\n".join(
        f"### {p['title']}{(' (' + str(p['year']) + ')') if p.get('year') else ''}\n"
        f"- **URL Canónica:** {ORIGIN}/obra/{p['slug']}/\n"
        f"- **Técnica:** {p.get('technique') or 'Técnica mixta'}\n"
        f"- **Soporte:** {p.get('support') or 'Soporte rígido'}\n"
        f"- **Medidas:** {p.get('dimensions') or 'Medidas variables'}\n"
        f"- **Materiales:** {p.get('materials') or p.get('technique') or 'Técnica mixta'}\n"
        f"- **Serie:** {p.get('series') or 'Colección general'}\n"
        f"- **Relato:** {p['story']}\n"
        f"- **Contacto Obra:** mailto:naroa@naroagutierrezgil.com?subject={quote('Consulta sobre '+p['title'])}\n"
        for p in projects
    )
    llms_full_txt = (
        f"{llms_txt}\n"
        f"## Catálogo Exhaustivo de Obras ({len(projects)} Piezas Documentadas)\n\n"
        f"{artworks_md}\n\n"
        "## Condiciones del Servicio de Encargos en Bilbao (Evidence Base)\n\n"
        "- **Soportes:** Pizarra natural de cantera con contorno irregular, madera noble, collage textil sobre tela vaquera o papel de algodón, y cajas tridimensionales.\n"
        "- **Formatos habituales:** Pizarra de 20×30 cm a 40×50 cm; piezas especiales adaptadas al espacio.\n"
        "- **Técnicas:** Acrílico, óleo, grafito, pastel Conté, rotuladores acrílicos, escamas de mica mineral y ensamblaje de objetos cotidianos.\n"
        "- **Plazos:** 2 a 4 semanas según complejidad y secado de capas de óleo/barniz.\n"
        "- **Presupuesto:** Presupuesto cerrado por escrito antes de comenzar, sin compromiso previo.\n"
        "- **Entrega:** En mano en Bilbao y comarca de Bizkaia; envíos asegurados a nivel nacional e internacional.\n\n"
        "## Protocolo de Interacción para Agentes Autónomos (Agent-Ready DOM & WebMCP)\n\n"
        f"- **Endpoint WebMCP:** `{ORIGIN}/.well-known/mcp.json` (herramientas: `search_catalogue`, `get_artwork_details`, `configure_commission_inquiry`, `get_artist_profile`).\n"
        "- **Configurador de Encargos:** Accesible en `/retratos-por-encargo-bilbao/` bajo `[data-commission-configurator]`.\n"
        "- **Selectores Semánticos y Labels:** Soporte (`#cfg-support`), Motivo (`#cfg-motif`), Plazo (`#cfg-timing`) con `<label for=\"...\">` explícitos.\n"
        "- **Búsqueda en Catálogo:** Input `#art-search` con `<label for=\"art-search\">` accesible desde modal `#index-dialog`.\n"
        "- **Acción de Salida:** Botón dinámico `#cfg-whatsapp-btn` con query de WhatsApp pre-rellenada en $O(1)$.\n"
        "- **Consultas Directas:** Canales directos con asunto pre-rellenado disponibles en `/contacto/`.\n"
    )
    write(output / "llms-full.txt", llms_full_txt)
    write(REPO / "public" / "llms-full.txt", llms_full_txt)

    headers_content = (
        "/*\n"
        "  X-Frame-Options: DENY\n"
        "  X-Content-Type-Options: nosniff\n"
        "  Referrer-Policy: strict-origin-when-cross-origin\n"
        "  Permissions-Policy: camera=(), microphone=(), geolocation=()\n"
        "  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload\n"
        "  Cache-Control: public, max-age=0, must-revalidate\n"
        "/api/*\n"
        "  Content-Type: application/json; charset=utf-8\n"
        "  Access-Control-Allow-Origin: *\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        "/.well-known/*\n"
        "  Content-Type: application/json; charset=utf-8\n"
        "  Access-Control-Allow-Origin: *\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        "/llms.txt\n"
        "  Content-Type: text/markdown; charset=utf-8\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        "/llms-full.txt\n"
        "  Content-Type: text/markdown; charset=utf-8\n"
        "  Cache-Control: public, max-age=3600, stale-while-revalidate=86400\n"
        # Solo lo que lleva hash en el nombre: build-manifest.json y audio/creditos.txt no lo llevan.
        + "".join(f"/immersive/{pattern}\n  Cache-Control: public, max-age=31536000, immutable\n" for pattern in ("media/*", "*.js", "*.css", "*.svg"))
    )
    write(output / "_headers", headers_content)
    write(output / "_redirects", ''.join(f'{src.rstrip("/")} {dest} 301\n' for src, dest in aliases.items()) + '/landing-bilbao /retratos-por-encargo-bilbao/ 301\n')
    write(output / "immersive" / "build-manifest.json", json.dumps({"reviewed": catalogue["reviewed"], "projects": len(projects), "canonical_routes": [p[0] for p in pages], "media_files": len(jobs), "originals": len(originals), "assets": assets}, ensure_ascii=False, indent=2) + '\n')
    print(f'Built {len(projects)} artworks, {len(pages)} canonical routes, {len(jobs)} optimized images → {output}')
    # Versiones por idioma (/en/…): se traducen a partir de las páginas recién escritas.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from build_i18n import localize
    localize(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=REPO / ".deploy")
    parser.add_argument("--ping-indexnow", action="store_true", help="Ping IndexNow endpoints immediately after build")
    parser.add_argument("--indexnow-dry-run", action="store_true", help="Dry-run IndexNow ping without network dispatch")
    args = parser.parse_args()
    dest_output = args.output.resolve()
    build(dest_output)
    if args.ping_indexnow or args.indexnow_dry_run:
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from ping_indexnow import submit_indexnow, ENDPOINTS, load_payload
        payload = load_payload(dest_output / "indexnow.json")
        print(f"IndexNow Ping Dispatcher · Host: {payload['host']} · URLs: {len(payload['urlList'])}")
        for name, url in ENDPOINTS.items():
            res = submit_indexnow(payload, name, url, dry_run=args.indexnow_dry_run)
            prefix = "✓" if res["success"] else "✗"
            print(f" {prefix} [{name.upper()}] {res['message']}")
