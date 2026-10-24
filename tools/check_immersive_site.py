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
        self.mcp_link = None
        self.webmcp_schema = None
        self.webmcp_text = None
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
        if tag == "link" and a.get("rel") == "mcp":
            self.mcp_link = a.get("href")
        if tag == "script" and a.get("type") == "application/ld+json":
            self.json_text = ""
        if tag == "script" and a.get("id") == "webmcp-schema":
            self.webmcp_text = ""
        if "data-gallery" in a:
            self.gallery = a
        if "data-scene" in a:
            self.scenes.append(a["data-scene"])
        if tag == "img":
            self.images.append(a)
        for key in ["src", "href", "data-src", "data-preview-src", "data-nature-src", "data-iris-src", "data-musicbox-src", "data-hero-src", "data-denbora-src", "data-silence-src", "data-asucar-src", "data-deltoya-src"]:
            if a.get(key, "").startswith("/") and not a[key].startswith("//"):
                self.refs.append(a[key])

    def handle_data(self, text):
        if self.json_text is not None:
            self.json_text += text
        if self.webmcp_text is not None:
            self.webmcp_text += text

    def handle_endtag(self, tag):
        if tag == "script" and self.json_text is not None:
            self.json_blocks.append(json.loads(self.json_text))
            self.json_text = None
        if tag == "script" and self.webmcp_text is not None:
            self.webmcp_schema = json.loads(self.webmcp_text)
            self.webmcp_text = None


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
        assert page.mcp_link == "https://naroagutierrezgil.com/.well-known/mcp.json", (file, "missing or invalid WebMCP link")
        assert page.webmcp_schema and len(page.webmcp_schema.get("tools", [])) >= 4, (file, "missing or invalid in-DOM WebMCP schema")
        raw_schema = page.json_blocks[0]
        schema0 = raw_schema["@graph"][0] if "@graph" in raw_schema else raw_schema
        assert schema0.get("@type"), file
        assert schema0.get("inLanguage") == "es-ES", (file, "missing inLanguage")
        assert schema0.get("dateModified") == manifest["reviewed"], (file, "missing dateModified")
        assert schema0.get("primaryImageOfPage", {}).get("width", 0) > 0, (file, "missing primaryImageOfPage dimensions")
        assert "FAQPage" not in json.dumps(schema0), (file, "deprecated FAQPage schema present")
        if route == "/retratos-por-encargo-bilbao/":
            assert schema0.get("geo", {}).get("latitude") == 43.263, (file, "missing geo latitude in commissions")
            assert schema0.get("address", {}).get("addressLocality") == "Bilbao", (file, "missing addressLocality in commissions")
            assert any("deia.eus" in s for s in schema0.get("provider", {}).get("sameAs", [])), (file, "missing external entity citation in provider")
            assert schema0.get("provider", {}).get("@id") == "https://naroagutierrezgil.com/#artist", (file, "mismatched provider ID in commissions")
        elif route == "/":
            pub = schema0.get("publisher", {})
            assert pub.get("homeLocation", {}).get("geo", {}).get("latitude") == 43.263, (file, "missing geo in publisher")
            assert any("deia.eus" in s for s in pub.get("sameAs", [])), (file, "missing external entity citation in publisher")
            assert pub.get("@id") == "https://naroagutierrezgil.com/#artist", (file, "mismatched publisher ID on home")
        elif route == "/sobre-mi/":
            ent = schema0.get("mainEntity", {})
            assert ent.get("homeLocation", {}).get("geo", {}).get("latitude") == 43.263, (file, "missing geo in artist entity")
            assert ent.get("@id") == "https://naroagutierrezgil.com/#artist", (file, "mismatched artist ID on sobre-mi")
        elif route == "/contacto/":
            ent = schema0.get("mainEntity", {})
            assert ent.get("homeLocation", {}).get("geo", {}).get("latitude") == 43.263, (file, "missing geo in contact entity")
            assert ent.get("@id") == "https://naroagutierrezgil.com/#artist", (file, "mismatched artist ID on contacto")
        elif route.startswith("/obra/") and route != "/obra/":
            assert schema0.get("creator", {}).get("@id") == "https://naroagutierrezgil.com/#artist", (file, "mismatched creator ID on artwork")
            assert any("deia.eus" in s for s in schema0.get("creator", {}).get("sameAs", [])), (file, "missing sameAs on artwork creator")
            assert schema0.get("locationCreated", {}).get("@id") == "https://naroagutierrezgil.com/#studio", (file, "missing canonical studio location on artwork")
            assert schema0.get("isPartOf", {}).get("@id") == "https://naroagutierrezgil.com/obra/#catalogue", (file, "missing catalogue cross-reference on artwork")
        elif route == "/obra/":
            assert schema0.get("@id") == "https://naroagutierrezgil.com/obra/#catalogue", (file, "mismatched catalogue ID")
            assert schema0.get("creator", {}).get("@id") == "https://naroagutierrezgil.com/#artist", (file, "mismatched creator on catalogue")
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
    assert catalog_data.get("entity_id") == "https://naroagutierrezgil.com/#artist", "missing or invalid entity_id in catalog.json"
    assert catalog_data.get("studio_id") == "https://naroagutierrezgil.com/#studio", "missing or invalid studio_id in catalog.json"
    assert (output / "llms.txt").is_file(), "missing llms.txt"
    assert (output / "llms-full.txt").is_file(), "missing llms-full.txt"
    assert "https://naroagutierrezgil.com" in (output / "llms.txt").read_text(), "llms.txt missing canonical domain"
    assert "https://naroagutierrezgil.com" in (output / "llms-full.txt").read_text(), "llms-full.txt missing canonical domain"
    assert (output / "feed.xml").is_file(), "missing feed.xml"
    feed_xml_content = (output / "feed.xml").read_text()
    assert "<dc:creator>Naroa Gutiérrez Gil</dc:creator>" in feed_xml_content, "feed.xml missing dc:creator"
    assert "naroa@naroa.eu (Naroa Gutiérrez Gil)" in feed_xml_content, "feed.xml missing canonical author"
    assert (output / "manifest.webmanifest").is_file(), "missing manifest.webmanifest"
    webmcp_path = output / ".well-known" / "mcp.json"
    assert webmcp_path.is_file(), "missing .well-known/mcp.json"
    webmcp_data = json.loads(webmcp_path.read_text())
    assert webmcp_data.get("author", {}).get("name") == "Naroa Gutiérrez Gil", "missing canonical author in WebMCP"
    assert len(webmcp_data.get("tools", [])) >= 4, "missing WebMCP tools"
    assert "configure_commission_inquiry" in [t["name"] for t in webmcp_data["tools"]], "missing configure_commission_inquiry tool"
    assert "catalog_api" in webmcp_data.get("endpoints", {}), "missing catalog_api endpoint in WebMCP"
    assert (output / "6621e1f1c138eeb14922f7804f61ae34.txt").is_file(), "missing IndexNow key file"
    assert (output / "indexnow.json").is_file(), "missing indexnow.json"
    indexnow_data = json.loads((output / "indexnow.json").read_text())
    assert indexnow_data.get("host") == "naroagutierrezgil.com", "incorrect IndexNow host"
    assert indexnow_data.get("key") == "6621e1f1c138eeb14922f7804f61ae34", "incorrect IndexNow key"
    assert len(indexnow_data.get("urlList", [])) == len(manifest["canonical_routes"]), "IndexNow urlList length mismatch"
    assert (output / "apple-touch-icon.png").is_file(), "missing apple-touch-icon.png"
    for file in output.rglob("*"):
        if file.is_file():
            assert file.stat().st_size < 25 * 1024 * 1024, ("asset exceeds hosting limit", file)
    print(f'PASS: {len(expected)} artworks, {len(manifest["canonical_routes"])} canonical pages, {len(checked_refs)} local references; headings, alt text, JSON-LD and image assets verified.')


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=REPO / ".deploy")
    check(parser.parse_args().output.resolve())
