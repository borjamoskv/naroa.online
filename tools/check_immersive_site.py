#!/usr/bin/env python3
"""Check generated routes, content, structured data and local assets offline."""
import argparse
import json
import base64
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

REPO = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.refs = []
        self.images = []
        self.meta = {}
        self.headings = 0
        self.lang = None
        self.canonical = None
        self.json_blocks = []
        self.json_text = None
        self.gallery = None
        self.favicon = None
        self.scenes = []

    def handle_starttag(self, tag, pairs):
        a = dict(pairs)
        if a.get("id"):
            self.ids.append(a["id"])
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "meta":
            key = a.get("property") or a.get("name")
            if key:
                self.meta[key] = a.get("content", "")
        if tag == "h1":
            self.headings += 1
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical = a.get("href")
        if tag == "link" and a.get("rel") == "icon":
            self.favicon = a.get("href")
        if tag == "script" and a.get("type") == "application/ld+json":
            self.json_text = ""
        if "data-gallery" in a:
            self.gallery = a
        if "data-scene" in a:
            self.scenes.append(a["data-scene"])
        if tag == "img":
            self.images.append(a)
        for key in ["src", "href", "data-src", "data-preview-src", "data-nature-src", "data-iris-src", "data-musicbox-src", "data-hero-src", "data-denbora-src"]:
            if a.get(key, "").startswith("/") and not a[key].startswith("//"):
                self.refs.append(a[key])

    def handle_data(self, text):
        if self.json_text is not None:
            self.json_text += text

    def handle_endtag(self, tag):
        if tag == "script" and self.json_text is not None:
            self.json_blocks.append(json.loads(self.json_text))
            self.json_text = None


def check(output):
    manifest = json.loads((output / "immersive/build-manifest.json").read_text())
    reviewed = json.loads((REPO / "classic/data/catalogo.json").read_text())["projects"]
    series = json.loads((REPO / "classic/data/vaivenes.json").read_text())["images"]
    expected = {p["slug"] for p in reviewed} | {p.get("work_slug", p.get("slug")) for p in series}
    assert manifest["projects"] == len(expected)
    assert set("/obra/" + slug + "/" for slug in expected).issubset(manifest["canonical_routes"])
    checked_refs = set()
    for route in manifest["canonical_routes"]:
        file = output / route.lstrip("/") / "index.html"
        page = Page()
        page.feed(file.read_text())
        assert page.lang == "es", file
        assert page.headings == 1, (file, page.headings)
        assert len(page.ids) == len(set(page.ids)), (file, "duplicate ID")
        assert page.canonical == "https://naroagutierrezgil.com" + route, file
        assert page.favicon and page.favicon.startswith("/immersive/favicon-amy-"), file
        assert page.json_blocks and page.json_blocks[0].get("@type"), file
        schema0 = page.json_blocks[0]
        assert schema0.get("inLanguage") == "es-ES", (file, "missing inLanguage")
        assert schema0.get("dateModified") == manifest["reviewed"], (file, "missing dateModified")
        assert schema0.get("primaryImageOfPage", {}).get("width", 0) > 0, (file, "missing primaryImageOfPage dimensions")
        assert "FAQPage" not in json.dumps(schema0), (file, "deprecated FAQPage schema present")
        if route == "/retratos-por-encargo-bilbao/":
            assert schema0.get("geo", {}).get("latitude") == 43.263, (file, "missing geo latitude in commissions")
            assert schema0.get("address", {}).get("addressLocality") == "Bilbao", (file, "missing addressLocality in commissions")
            assert any("deia.eus" in s for s in schema0.get("provider", {}).get("sameAs", [])), (file, "missing external entity citation in provider")
        elif route == "/":
            pub = schema0.get("publisher", {})
            assert pub.get("homeLocation", {}).get("geo", {}).get("latitude") == 43.263, (file, "missing geo in publisher")
            assert any("deia.eus" in s for s in pub.get("sameAs", [])), (file, "missing external entity citation in publisher")
        elif route == "/sobre-mi/":
            ent = schema0.get("mainEntity", {})
            assert ent.get("homeLocation", {}).get("geo", {}).get("latitude") == 43.263, (file, "missing geo in artist entity")
        assert int(page.meta.get("og:image:width", "0")) > 0, (file, "missing og:image:width")
        assert int(page.meta.get("og:image:height", "0")) > 0, (file, "missing og:image:height")
        assert page.meta.get("og:image:alt"), (file, "missing og:image:alt")
        assert page.meta.get("twitter:image:alt"), (file, "missing twitter:image:alt")
        if page.gallery:
            assert int(page.gallery["data-initial"]) < len(page.scenes), file
            assert len(page.scenes) == (8 if route == "/series/vaivenes/" else len(expected)), (file, len(page.scenes))
        for image in page.images:
            assert image.get("alt"), (file, "image without alternative text")
        for ref in page.refs:
            if ref in checked_refs:
                continue
            checked_refs.add(ref)
            path = unquote(urlsplit(ref).path)
            dest = output / path.lstrip("/")
            if path.endswith("/"):
                dest /= "index.html"
            assert dest.is_file(), (file, "missing target", ref)
    assert (output / "404.html").is_file()
    icon = ET.parse(output / page.favicon.lstrip("/")).getroot()
    assert icon.find("{http://www.w3.org/2000/svg}title").text == "Amy Rocks · Naroa"
    picture = icon.find("{http://www.w3.org/2000/svg}image").attrib["href"]
    assert picture.startswith("data:image/webp;base64,")
    assert base64.b64decode(picture.split(",", 1)[1], validate=True).startswith(b"RIFF")
    assert (output / "robots.txt").is_file()
    sitemap_root = ET.parse(output / "sitemap.xml").getroot()
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "i": "http://www.google.com/schemas/sitemap-image/1.1"}
    sitemap_urls = sitemap_root.findall("s:url", ns)
    assert len(sitemap_urls) == len(manifest["canonical_routes"])
    for u_el in sitemap_urls:
        for img_el in u_el.findall("i:image", ns):
            assert img_el.findtext("i:title", default="", namespaces=ns).strip(), "sitemap image missing title"
            assert img_el.findtext("i:caption", default="", namespaces=ns).strip(), "sitemap image missing caption"
    catalog_path = output / "api" / "catalog.json"
    assert catalog_path.is_file(), "missing api/catalog.json"
    catalog_data = json.loads(catalog_path.read_text())
    assert catalog_data.get("artworks_count") == len(expected), "incorrect artworks_count in api/catalog.json"
    assert len(catalog_data.get("artworks", [])) == len(expected), "mismatched artworks list in api/catalog.json"
    assert (output / "llms.txt").is_file(), "missing llms.txt"
    assert (output / "llms-full.txt").is_file(), "missing llms-full.txt"
    assert "https://naroagutierrezgil.com" in (output / "llms.txt").read_text(), "llms.txt missing canonical domain"
    assert "https://naroagutierrezgil.com" in (output / "llms-full.txt").read_text(), "llms-full.txt missing canonical domain"
    for file in output.rglob("*"):
        if file.is_file():
            assert file.stat().st_size < 25 * 1024 * 1024, ("asset exceeds hosting limit", file)
    print(f'PASS: {len(expected)} artworks, {len(manifest["canonical_routes"])} canonical pages, {len(checked_refs)} local references; headings, alt text, JSON-LD and image assets verified.')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=REPO / ".deploy")
    check(parser.parse_args().output.resolve())
