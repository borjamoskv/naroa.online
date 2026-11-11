#!/usr/bin/env python3
"""Versiones por idioma del sitio inmersivo.

Parte de las páginas ya generadas en español por `build_immersive_site.py` y
escribe una copia traducida bajo `/<idioma>/…`. Los textos viven en
`classic/data/i18n/<idioma>.json`, indexados por el texto español de origen.

    python3 tools/build_i18n.py extract --output .deploy   # lista lo que falta por traducir
    python3 tools/build_i18n.py apply   --output .deploy   # escribe /en/… y los hreflang
    python3 tools/build_i18n.py check   --output .deploy   # falla si queda algo sin traducir

Lo que no tiene traducción se queda en español y `extract`/`check` lo señalan.
"""
import argparse
from urllib.parse import quote as url_quote, unquote as url_unquote
import hashlib
import json
import re
import sys
from html import escape, unescape
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "classic"
I18N_DIR = SOURCE / "data" / "i18n"
ORIGIN = "https://naroagutierrezgil.com"
DEFAULT_LANG = "es"
LANGS = {
    "en": {"html": "en", "og": "en_GB", "schema": "en", "name": "English"},
    "eu": {"html": "eu", "og": "eu_ES", "schema": "eu", "name": "Euskara"},
}
OG_DEFAULT = "es_ES"

# ── HTML: fichas ────────────────────────────────────────────────────────────
TOKEN = re.compile(
    r"<!--.*?-->"
    r"|<!doctype[^>]*>"
    r"|<(script|style)\b(?:[^>\"']|\"[^\"]*\"|'[^']*')*>.*?</\1\s*>"
    r"|</[a-zA-Z][^>]*>"
    r"|<[a-zA-Z](?:[^>\"']|\"[^\"]*\"|'[^']*')*>"
    r"|[^<]+"
    r"|<",
    re.S | re.I,
)
TAG_NAME = re.compile(r"</?([a-zA-Z][\w:-]*)")
ATTR = re.compile(r"""([^\s"'<>/=]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s"'>]+)""")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
PHRASING = {"a", "span", "em", "strong", "i", "b", "br", "small", "cite", "q", "sup", "sub", "mark", "u", "abbr", "time", "code", "s", "wbr", "svg", "img", "kbd", "del", "ins"}
OPAQUE = {"svg", "script", "style", "template", "math"}
# Atributos con texto que lee una persona.
TEXT_ATTRS = {"alt", "title", "aria-label", "placeholder", "aria-description", "aria-roledescription", "aria-valuetext"}
META_TEXT = {"description", "twitter:title", "twitter:description", "twitter:image:alt", "og:title", "og:description", "og:image:alt", "og:site_name", "apple-mobile-web-app-title"}
LETTER = re.compile(r"[A-Za-zÀ-ÿ]")
WS = re.compile(r"\s+")


class Node:
    __slots__ = ("kind", "name", "raw", "close", "children", "parent")

    def __init__(self, kind, raw="", name="", parent=None):
        self.kind, self.raw, self.name, self.parent = kind, raw, name, parent
        self.close, self.children = "", []


def parse(html):
    """Árbol mínimo que conserva cada ficha tal cual, para reescribir sin alterar el resto."""
    root = Node("root")
    cur = root
    for m in TOKEN.finditer(html):
        tok = m.group(0)
        if tok.startswith("<!--") or tok.lower().startswith("<!doctype"):
            cur.children.append(Node("raw", tok, parent=cur))
        elif m.group(1):
            cur.children.append(Node("raw", tok, name=m.group(1).lower(), parent=cur))
        elif tok.startswith("</"):
            name = TAG_NAME.match(tok).group(1).lower()
            probe = cur
            while probe is not root and probe.name != name:
                probe = probe.parent
            if probe is root:
                cur.children.append(Node("raw", tok, parent=cur))
                continue
            probe.close = tok
            cur = probe.parent
        elif tok.startswith("<") and len(tok) > 1:
            name = TAG_NAME.match(tok).group(1).lower()
            node = Node("el", tok, name=name, parent=cur)
            cur.children.append(node)
            if name not in VOID and not tok.endswith("/>"):
                cur = node
        else:
            cur.children.append(Node("text", tok, parent=cur))
    return root


def serialize(node, out):
    if node.kind in ("text", "raw"):
        out.append(node.raw)
        return
    if node.kind == "el":
        out.append(node.raw)
    for child in node.children:
        serialize(child, out)
    if node.kind == "el":
        out.append(node.close)


def inner_has_letters(node):
    if node.kind == "text":
        return bool(LETTER.search(unescape(node.raw)))
    if node.kind == "raw" or node.name in OPAQUE:
        return False
    return any(inner_has_letters(c) for c in node.children)


def phrasing_only(node):
    """¿Puede viajar dentro de una frase? Solo si todo lo que contiene es de línea."""
    if node.kind == "text":
        return True
    if node.kind == "raw":
        return node.raw.startswith("<!--")
    if node.name not in PHRASING:
        return False
    if node.name in OPAQUE:
        return True
    # data-i18n-unit="1": un elemento de línea que se traduce como frase aparte y no dentro de la que lo rodea
    # (el plazo de encargos bajo «Encargos» en el menú: cambia con la fecha y el resto de la entrada no).
    if has_attr(node, "data-i18n-unit"):
        return False
    return all(phrasing_only(c) for c in node.children)


def has_attr(node, name, value=None):
    for m in ATTR.finditer(node.raw):
        if m.group(1).lower() == name:
            return value is None or m.group(3).strip("\"'") == value
    return False


def no_translate(node):
    return node.kind == "el" and (has_attr(node, "translate", "no") or has_attr(node, "data-i18n-skip"))


class Unit:
    """Una frase: texto con marcas <1>…</1> en lugar de las etiquetas de línea."""

    def __init__(self, nodes):
        self.nodes = nodes
        self.tags = []
        self.lead, self.key, self.trail = self._build()

    def _build(self):
        parts = []

        def walk(node):
            if node.kind == "text":
                parts.append(unescape(node.raw))
            elif node.kind == "raw":
                return
            elif node.name in OPAQUE or node.name in VOID or not inner_has_letters(node) or no_translate(node):
                self.tags.append(node)
                parts.append(f"<{len(self.tags)}/>")
            else:
                self.tags.append(node)
                n = len(self.tags)
                parts.append(f"<{n}>")
                for c in node.children:
                    walk(c)
                parts.append(f"</{n}>")

        for node in self.nodes:
            walk(node)
        text = "".join(parts)
        body = text.strip()
        lead = text[: len(text) - len(text.lstrip())]
        trail = text[len(text.rstrip()):]
        return lead, WS.sub(" ", body), trail

    def render(self, translated):
        """Devuelve el HTML de la traducción reponiendo las etiquetas originales."""
        out = []
        pos = 0
        for m in re.finditer(r"<(/?)(\d+)(/?)>", translated):
            out.append(escape(translated[pos:m.start()], quote=False))
            pos = m.end()
            node = self.tags[int(m.group(2)) - 1]
            if m.group(3):
                buf = []
                serialize(node, buf)
                out.append("".join(buf))
            elif m.group(1):
                out.append(node.close)
            else:
                out.append(node.raw)
        out.append(escape(translated[pos:], quote=False))
        return self.lead + "".join(out) + self.trail


def marks(text):
    return sorted(re.findall(r"<(/?\d+/?)>", text))


def units_of(root):
    """Agrupa en frases los tramos de texto y etiquetas de línea de cada bloque."""
    found = []

    def walk(node):
        if node.kind != "el" and node.kind != "root":
            return
        if node.kind == "el" and (node.name in OPAQUE or no_translate(node)):
            return
        run = []

        def flush():
            if any(n.kind == "text" and LETTER.search(unescape(n.raw)) for n in run):
                nodes = list(run)
                while nodes and nodes[0].kind != "text" and not inner_has_letters(nodes[0]):
                    nodes.pop(0)
                while nodes and nodes[-1].kind != "text" and not inner_has_letters(nodes[-1]):
                    nodes.pop()
                found.append(Unit(nodes))
            else:
                for n in run:
                    walk(n)
            run.clear()

        for child in node.children:
            if phrasing_only(child) and not no_translate(child):
                run.append(child)
            else:
                flush()
                walk(child)
        flush()

    walk(root)
    return found


def elements(node):
    for child in node.children:
        if child.kind == "el":
            yield child
            yield from elements(child)


def raw_nodes(node, name):
    for child in node.children:
        if child.kind == "raw" and child.name == name:
            yield child
        elif child.kind == "el":
            yield from raw_nodes(child, name)


def attrs_of(node):
    return [(m.group(1).lower(), m.group(3).strip("\"'") if m.group(3)[0] in "\"'" else m.group(3), m) for m in ATTR.finditer(node.raw)]


def set_attr(node, match, value):
    quote_char = match.group(3)[0] if match.group(3)[0] in "\"'" else '"'
    encoded = escape(value, quote=True) if quote_char == '"' else escape(value, quote=False).replace("'", "&#x27;")
    node.raw = node.raw[: match.start(3)] + quote_char + encoded + quote_char + node.raw[match.end(3):]


# ── Diccionario ─────────────────────────────────────────────────────────────
# Atributos data-* con frases que el visitante lee (o que el script enseña).
DATA_TEXT = {"data-story", "data-dimensions", "data-preview-title", "data-preview-label", "data-preview-quote", "data-preview-meta", "data-say", "data-pick-support", "data-work-title", "data-cycle-label", "data-share-title"}
# Atributos data-* con JSON dentro: se traducen estas claves.
DATA_JSON = {"data-preview-reel", "data-artworks"}
JSON_TEXT_KEYS = {"title", "meta", "label", "quote", "caption", "technique", "support", "venue", "kind"}
JSON_URL_KEYS = {"href", "url"}
# Atributos con direcciones internas.
ROUTE_ATTRS = {"href", "action", "data-preview-href", "data-menu-also", "data-share-url"}
# Datos estructurados: claves con texto y claves cuya dirección no cambia con el idioma.
LD_TEXT = {"name", "description", "caption", "headline", "jobTitle", "artMedium", "artworkSurface", "artform", "text", "material", "size", "serviceType", "alternateName", "disambiguatingDescription", "addressCountry", "keywords", "abstract", "alternativeHeadline", "knowsAbout", "award", "category", "areaServed", "audienceType"}
LD_URL_FIXED = {"sameAs", "contentUrl", "image", "thumbnailUrl", "acquireLicensePage", "hasMap", "logo", "license", "@context", "@type", "isBasedOn"}
# Catálogo del navegador: campos que se enseñan. `series` y `category` son claves de filtro y no se tocan.
CATALOG_FIELDS = ("label", "story", "technique", "support", "dimensions", "materials", "interaction", "credit")
SCRIPTS = ("app", "journey", "soundscape")
# Plantillas de fecha por omisión (inglés). `range` sin plantilla deja el tramo a los patrones.
DATE_DEFAULT = {"dmy": "{d} {month} {y}", "my": "{month} {y}", "dm": "{d} {month}", "short": "{d} {month}", "m": "{month}"}
MEASURE = re.compile(r"^[\d\s×x.,/()·+–-]*(?:(?:cm|mm|m|kg|g)\b[\d\s×x.,/()·+–-]*)*$")


def balanced(piece):
    """Un trozo de frase solo puede traducirse aparte si no parte una marca <n>…</n>."""
    depth = []
    for m in re.finditer(r"<(/?)(\d+)(/?)>", piece):
        if m.group(3):
            continue
        if not m.group(1):
            depth.append(m.group(2))
        elif not depth or depth.pop() != m.group(2):
            return False
    return not depth


def norm(text):
    return WS.sub(" ", text).strip()


class Dictionary:
    def __init__(self, lang, keep=()):
        self.lang = lang
        path = I18N_DIR / f"{lang}.json"
        data = json.loads(path.read_text()) if path.exists() else {}
        self.strings = {norm(k): v for k, v in data.get("strings", {}).items()}
        self.js = data.get("js", {})
        self.js_keep = set(data.get("js_keep", []))
        self.notes = data.get("notes", {})
        self.keep = {norm(k) for k in data.get("keep", [])} | {norm(k) for k in keep}
        titles = "|".join(re.escape(t) for t in sorted(self.keep, key=len, reverse=True)) or "(?!)"
        self.patterns = [(re.compile(p.replace("{TITLES}", titles)), r) for p, r in data.get("patterns", [])]
        self.months = data.get("months", {})
        self.decimal = data.get("decimal", ".")
        # Fechas: cada idioma dice cómo se escriben (ver DATE_DEFAULT) y la regla las recompone.
        self.dates = {**DATE_DEFAULT, **data.get("dates", {})}
        names = "|".join(sorted(self.months, key=len, reverse=True)) or "(?!)"
        self.date_rules = [
            (re.compile(rf"(?P<d1>\d{{1,2}}) — (?P<d>\d{{1,2}}) de (?P<m>{names}) de (?P<y>\d{{4}})", re.I), "range"),
            (re.compile(rf"(?P<d>\d{{1,2}}) de (?P<m>{names}) de (?P<y>\d{{4}})", re.I), "dmy"),
            (re.compile(rf"(?P<m>{names}) de (?P<y>\d{{4}})", re.I), "my"),
            (re.compile(rf"(?P<d>\d{{1,2}}) de (?P<m>{names})", re.I), "dm"),
            (re.compile(rf"(?P<d>\d{{1,2}}) (?P<m>{names})\.?", re.I), "short"),
            (re.compile(rf"(?P<m>{names})", re.I), "m"),
        ]
        self.missing = {}
        self.used = set()
        self.broken = []

    def month(self, name):
        return self.months.get(name.lower(), name)

    def date(self, kind, m):
        """Escribe una fecha con la plantilla del idioma. Para el euskera calcula además las
        terminaciones: {ko} tras el año (2015eko, 2014ko), {d_a} el día con su -a (10a, pero 11 y 31)."""
        template = self.dates.get(kind)
        if not template:
            return None
        g = m.groupdict()
        month = self.month(g["m"])
        values = {"month": month, "Month": month[:1].upper() + month[1:], "month_gen": month + "ren"}
        if g.get("y"):
            year = int(g["y"])
            hundreds = year % 100 == 0
            eko = (year // 100) % 10 != 0 if hundreds else year % 20 in (1, 5, 10, 15)
            values.update(y=g["y"], ko="eko" if eko else "ko")
        for name in ("d", "d1"):
            if g.get(name):
                values[name] = g[name]
                values[name + "_a"] = g[name] if int(g[name]) in (11, 31) else g[name] + "a"
        try:
            return template.format(**values)
        except KeyError:
            return None

    def lookup(self, text):
        key = norm(text)
        if key in self.strings:
            self.used.add(key)
            return self.strings[key]
        if key in self.keep or not LETTER.search(re.sub(r"<[^>]+>", "", key)):
            return key
        if re.fullmatch(r"(?:[\w.+-]+@[\w.-]+\.\w+|https?://\S+|@\w+)(?: ↗)?", key):
            return key  # correos, direcciones y @usuarios no se traducen
        if MEASURE.match(key):
            return re.sub(r"(\d),(\d)", rf"\1{self.decimal}\2", key)
        for rule, kind in self.date_rules:
            m = rule.fullmatch(key)
            if m:
                written = self.date(kind, m)
                if written is not None:
                    return written
        for pattern, template in self.patterns:
            m = pattern.fullmatch(key)
            if not m or not all(balanced(g) for g in m.groups() if g):
                continue
            ok = True

            def fill(ref):
                nonlocal ok
                raw, idx = ref.group(1) == "=", int(ref.group(2))
                piece = m.group(idx) or ""
                if raw or not piece:
                    return piece
                sub = self.lookup(piece)
                if sub is None:
                    ok = False
                    return piece
                return sub

            result = re.sub(r"\{(=?)(\d)\}", fill, template)
            if ok:
                return result
        return None

    def atoms(self, text, depth=0):
        """Piezas sin traducir de un texto compuesto: lo que hay que escribir en el diccionario."""
        key = norm(text)
        if not key or self.lookup(key) is not None:
            return []
        best = [key]
        if depth < 6:
            for pattern, template in self.patterns:
                m = pattern.fullmatch(key)
                if not m or not all(balanced(g) for g in m.groups() if g):
                    continue
                pieces = []
                for ref in re.finditer(r"\{(=?)(\d)\}", template):
                    if not ref.group(1) and m.group(int(ref.group(2))):
                        pieces += self.atoms(m.group(int(ref.group(2))), depth + 1)
                if sum(len(x) for x in pieces) < sum(len(x) for x in best):
                    best = pieces
        return best

    def tr(self, text, kind, where):
        """Traducción o None; lo que falta queda anotado con dónde apareció."""
        key = norm(text)
        result = self.lookup(key)
        if result is None:
            self.missing.setdefault(key, [kind, where, 0])[2] += 1
        return result


# ── Direcciones ─────────────────────────────────────────────────────────────
class Routes:
    def __init__(self, output):
        manifest = json.loads((output / "immersive" / "build-manifest.json").read_text())
        self.pages = [r for r in manifest["canonical_routes"] if (output / r.lstrip("/") / "index.html").exists()]
        self.known = set(self.pages)
        self.aliases = {}
        redirects = output / "_redirects"
        if redirects.exists():
            for line in redirects.read_text().splitlines():
                parts = line.split()
                if len(parts) >= 2 and parts[0].startswith("/") and parts[1].startswith("/"):
                    self.aliases[parts[0].rstrip("/") + "/"] = parts[1]
        self.tops = {r.strip("/").split("/")[0] for r in self.known if r != "/"} | {a.strip("/").split("/")[0] for a in self.aliases}
        self.prefixes = tuple(f"/{code}/" for code in LANGS)

    def localize(self, value, lang, loose=False):
        """Devuelve la dirección bajo /<idioma>/ si apunta a una página del sitio; si no, None."""
        m = re.match(r"^(" + re.escape(ORIGIN) + r")?(/[^?#]*)?([?#].*)?$", value)
        if not m or not (m.group(1) or m.group(2)) or value.startswith("//"):
            return None
        path = m.group(2) or "/"
        if path.startswith(self.prefixes):
            return None
        slashed = path if path.endswith("/") else path + "/"
        if slashed in self.aliases:
            slashed = self.aliases[slashed]
        if slashed not in self.known:
            top = slashed.strip("/").split("/")[0]
            if not (loose and top in self.tops) and not (top in self.tops and "." not in slashed.rsplit("/", 2)[-2]):
                return None
        return (m.group(1) or "") + f"/{lang}" + slashed + (m.group(3) or "")


# ── Página ──────────────────────────────────────────────────────────────────
MARK_OPEN, MARK_CLOSE = "<!--i18n-->", "<!--/i18n-->"
INJECTED = re.compile(re.escape(MARK_OPEN) + r".*?" + re.escape(MARK_CLOSE), re.S)
# Idioma de la primera visita: el del navegador, salvo que el visitante ya haya elegido.
# Los rastreadores se quedan donde están para que cada versión se indexe en su dirección.
HEAD_SCRIPT = (
    "<script>(function(){try{var d=document,h=d.documentElement,k='naroa-lang',S=%s,L=h.lang.slice(0,2),c=null;"
    "d.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[data-lang]');if(!a)return;try{var t=d.querySelector('#contenido.editorial');if(t&&!a.hash&&scrollY>innerHeight&&t.getBoundingClientRect().top<innerHeight/2)a.hash='contenido'}catch(_){}try{localStorage.setItem(k,a.getAttribute('data-lang'))}catch(_){}} ,true);"
    "try{c=localStorage.getItem(k)}catch(_){}"
    "if(/bot|crawl|spider|slurp|lighthouse|headless|jsdom|preview|facebookexternalhit|whatsapp|telegram|pinterest|embedly/i.test(navigator.userAgent))return;"
    "if(d.referrer&&d.referrer.indexOf(location.origin+'/')===0)return;"
    "if(S.indexOf(c)<0){c=null;var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];"
    "for(var i=0;i<n.length&&!c;i++){var p=String(n[i]).toLowerCase().split('-')[0];if(S.indexOf(p)>-1)c=p;else if(p==='eu'||p==='ca'||p==='gl')c='es'}c=c||'en'}"
    "if(c!==L){var l=d.querySelector('link[rel=\"alternate\"][hreflang=\"'+c+'\"]');if(l)location.replace(new URL(l.href).pathname+location.search+location.hash)}"
    "}catch(e){}})();</script>"
)
SWITCH_STYLE = "<style>.site-nav nav>a.lang-switch{letter-spacing:.14em;opacity:.72}.site-nav nav>a.lang-switch:hover,.site-nav nav>a.lang-switch:focus-visible{opacity:1}.menu-foot a.lang-switch-menu{display:inline-block;padding:.5em 0;color:#fffdf4;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.3em;letter-spacing:.08em}@media(max-width:760px){.site-nav nav>a.lang-switch{display:none}}.i18n-note{margin:0 auto;padding:2.4rem 1.5rem 3rem;max-width:44rem;text-align:center;font-size:.82rem;line-height:1.5;letter-spacing:.02em;opacity:.78}.i18n-note a{color:inherit;text-decoration:underline;text-underline-offset:.2em;white-space:nowrap}</style>"
SWITCH_LABEL = {"es": "Versión en español", "en": "English version", "eu": "Euskarazko bertsioa"}
SWITCH_NAME = {"es": "Español", "en": "English", "eu": "Euskara"}


def lang_path(route, lang):
    return route if lang == DEFAULT_LANG else f"/{lang}{route}"


def head_block(route, langs):
    codes = [DEFAULT_LANG] + list(langs)
    links = "".join(f'<link rel="alternate" hreflang="{code}" href="{ORIGIN}{lang_path(route, code)}">' for code in codes)
    links += f'<link rel="alternate" hreflang="x-default" href="{ORIGIN}{route}">'
    return MARK_OPEN + links + HEAD_SCRIPT % json.dumps(codes) + SWITCH_STYLE + MARK_CLOSE


def switch_block(route, current, langs):
    codes = [c for c in [DEFAULT_LANG] + list(langs) if c != current]
    return MARK_OPEN + "".join(
        f'<a class="lang-switch" href="{lang_path(route, code)}" hreflang="{code}" lang="{code}" data-lang="{code}" aria-label="{code.upper()} · {SWITCH_LABEL[code]}" title="{SWITCH_LABEL[code]}" translate="no">{code.upper()}</a>'
        for code in codes
    ) + MARK_CLOSE


def find(root, test):
    for el in elements(root):
        if test(el):
            return el
    return None


def attr_value(node, name):
    for key, value, _ in attrs_of(node):
        if key == name:
            return value
    return None


def inject(root, route, current, langs):
    """Añade los hreflang, la elección de idioma de la primera visita y el enlace para cambiarlo."""
    canonical = find(root, lambda el: el.name == "link" and attr_value(el, "rel") == "canonical")
    if canonical is not None:
        canonical.raw += head_block(route, langs)
    header = find(root, lambda el: el.name == "header" and "site-nav" in (attr_value(el, "class") or "").split())
    nav = find(header, lambda el: el.name == "nav") if header is not None else None
    if nav is not None:
        nav.children.append(Node("raw", switch_block(route, current, langs), parent=nav))
    # En móvil la cabecera no tiene sitio: el cambio de idioma vive también en el pie del menú, con su nombre entero.
    foot = find(root, lambda el: el.name == "div" and "menu-foot" in (attr_value(el, "class") or "").split())
    line = find(foot, lambda el: el.name == "span") if foot is not None else None
    if line is not None:
        codes = [c for c in [DEFAULT_LANG] + list(langs) if c != current]
        line.children.append(Node("raw", MARK_OPEN + "".join(
            f' · <a class="lang-switch-menu" href="{lang_path(route, code)}" hreflang="{code}" lang="{code}" data-lang="{code}" translate="no">{SWITCH_NAME[code]}</a>'
            for code in codes
        ) + MARK_CLOSE, parent=line))


def translate_json(value, lang, dictionary, routes, where, kind):
    if isinstance(value, list):
        return [translate_json(v, lang, dictionary, routes, where, kind) for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if isinstance(v, str) and k in JSON_TEXT_KEYS and LETTER.search(v):
                out[k] = dictionary.tr(v, kind, where) or v
            elif isinstance(v, str) and k in JSON_URL_KEYS:
                out[k] = routes.localize(v, lang) or v
            else:
                out[k] = translate_json(v, lang, dictionary, routes, where, kind)
        return out
    return value


def translate_ld(value, lang, dictionary, routes, where, key=None):
    if isinstance(value, list):
        return [translate_ld(v, lang, dictionary, routes, where, key) for v in value]
    if isinstance(value, dict):
        return {k: translate_ld(v, lang, dictionary, routes, where, k) for k, v in value.items()}
    if not isinstance(value, str):
        return value
    if key == "inLanguage":
        return LANGS[lang]["schema"]
    if key in LD_URL_FIXED:
        return value
    if value.startswith(ORIGIN):
        if key == "@id" and re.match(re.escape(ORIGIN) + r"/?(#.*)?$", value):
            return value
        return routes.localize(value, lang) or value
    if key in LD_TEXT and LETTER.search(value):
        return dictionary.tr(value, "ld", where) or value
    return value


def data_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


MESSAGE_KEYS = {"text", "subject", "body"}


def localize_message(href, dictionary):
    """Mensaje ya escrito de un enlace a WhatsApp o al correo, en el idioma de la página. Solo cambia
    los que tienen entrada exacta en `strings`; el resto se queda en español sin contar como pendiente."""
    head, sep, rest = href.partition("?")
    if not sep:
        return None
    query, mark, fragment = rest.partition("#")
    parts, changed = [], False
    for part in query.split("&"):
        key, eq, value = part.partition("=")
        if eq and key in MESSAGE_KEYS:
            source = norm(url_unquote(value))
            translated = dictionary.strings.get(source)
            if translated and translated != source:
                dictionary.used.add(source)
                value, changed = url_quote(translated, safe=""), True
        parts.append(key + eq + value)
    return (head + sep + "&".join(parts) + mark + fragment) if changed else None


def localize_page(html, route, lang, dictionary, routes, langs, assets):
    root = parse(INJECTED.sub("", html))
    units = units_of(root)
    # Lo que se añade a data-search: el buscador del índice debe encontrar también en el idioma de la página.
    searchable = {}
    for unit in units:
        probe = unit.nodes[0].parent
        while probe is not None and probe.kind == "el":
            if has_attr(probe, "data-search"):
                translated = dictionary.lookup(unit.key)
                if translated and translated != unit.key:
                    searchable.setdefault(id(probe), []).append(re.sub(r"<[^>]+>", " ", translated))
                break
            probe = probe.parent

    for el in elements(root):
        pairs = attrs_of(el)
        names = {name: value for name, value, _ in pairs}
        edits = []
        for name, value, match in pairs:
            plain = unescape(value)
            new = None
            if el.name == "html" and name == "lang":
                new = LANGS[lang]["html"]
            elif el.name == "meta" and name == "content" and names.get("property") == "og:locale":
                new = LANGS[lang]["og"]
            elif el.name == "meta" and name == "content" and names.get("property") == "og:url":
                new = routes.localize(plain, lang)
            elif el.name == "link" and name == "href" and names.get("rel") == "canonical":
                new = routes.localize(plain, lang)
            elif el.name == "link" and name == "href":
                new = None
            elif el.name == "script" and name == "src":
                new = assets.get(plain)
            elif name == "href" and plain.startswith(("https://wa.me/", "mailto:")):
                new = localize_message(plain, dictionary)
            elif name in ROUTE_ATTRS:
                new = routes.localize(plain, lang, loose=name == "data-menu-also")
            elif name in DATA_JSON:
                try:
                    new = data_json(translate_json(json.loads(plain), lang, dictionary, routes, route, "attr")).replace("<\\/", "</")
                except ValueError:
                    new = None
            elif name == "data-search":
                extra = searchable.get(id(el), [])
                for other in ("data-story", "data-dimensions"):
                    if other in names:
                        t = dictionary.lookup(unescape(names[other]))
                        if t and t != norm(unescape(names[other])):
                            extra.append(t)
                new = norm(plain + " " + " ".join(extra)) if extra else None
            elif LETTER.search(plain) and (
                name in TEXT_ATTRS or name in DATA_TEXT
                or (el.name == "meta" and name == "content" and (names.get("name") in META_TEXT or names.get("property") in META_TEXT))
                or (el.name == "option" and name == "value")
            ):
                new = dictionary.tr(plain, "attr", route)
            if new is not None and new != plain:
                edits.append((match, new))
        for match, new in reversed(edits):
            set_attr(el, match, new)
        if el.name == "html" and not has_attr(el, "data-base"):
            el.raw = el.raw[:-1] + f' data-base="/{lang}">'

    for node in raw_nodes(root, "script"):
        head = node.raw[: node.raw.index(">") + 1]
        src = re.search(r'\bsrc="([^"]+)"', head)
        if src and src.group(1) in assets:
            node.raw = node.raw.replace(src.group(0), f'src="{assets[src.group(1)]}"', 1)
            continue
        if "application/ld+json" not in head:
            continue
        body = node.raw[len(head): node.raw.rindex("</")]
        try:
            data = json.loads(body)
        except ValueError:
            continue
        node.raw = head + data_json(translate_ld(data, lang, dictionary, routes, route)) + node.raw[node.raw.rindex("</"):]

    for unit in units:
        if not LETTER.search(re.sub(r"<[^>]+>", "", unit.key)):
            continue
        translated = dictionary.tr(unit.key, "text", route)
        if translated is None or translated == unit.key:
            continue
        if marks(translated) != marks(unit.key):
            dictionary.broken.append((unit.key, translated))
            continue
        parent = unit.nodes[0].parent
        start = parent.children.index(unit.nodes[0])
        parent.children[start:start + len(unit.nodes)] = [Node("raw", unit.render(translated), parent=parent)]

    # Las citas de Naroa (« ») son literales en español; donde se traducen, la página lo dice
    # y enlaza a sus palabras tal como las escribió.
    note = dictionary.notes.get(route)
    main = find(root, lambda el: el.name == "main")
    if note and main is not None:
        main.children.append(Node("raw", f'<p class="i18n-note">{escape(note, quote=False)} <a href="{route}#contenido" hreflang="{DEFAULT_LANG}">{escape(dictionary.notes.get("link", "Español"), quote=False)}</a></p>', parent=main))
    inject(root, route, lang, langs)
    out = []
    serialize(root, out)
    return "".join(out)


def annotate_default(html, route, langs):
    """La página española solo recibe los hreflang y el enlace de idioma; su texto no se toca."""
    root = parse(INJECTED.sub("", html))
    inject(root, route, DEFAULT_LANG, langs)
    out = []
    serialize(root, out)
    return "".join(out)


# ── Scripts y catálogo del navegador ────────────────────────────────────────
def localize_script(source, dictionary):
    """Sustituye literales enteros ('…', "…", `…`) que el diccionario declara en su sección `js`.

    Clave y valor son el texto tal cual va en el archivo entre las comillas, con sus `${…}`.
    Un valor nulo toma la traducción general: son valores que también salen en el HTML
    (opciones del configurador) y deben coincidir con ella.
    """
    found = set()
    for key, value in sorted(dictionary.js.items(), key=lambda kv: -len(kv[0])):
        if value is None:
            value = dictionary.strings.get(norm(key))
            if value is None:
                dictionary.missing.setdefault(norm(key), ["js", "script", 0])[2] += 1
                continue
        for q in ("'", '"', "`"):
            raw_key = q + key + q
            if raw_key not in source:
                continue
            safe = value if q == "`" else re.sub(r"(?<!\\)" + q, "\\" + q, value)
            source = source.replace(raw_key, q + safe + q)
            found.add(key)
    return source, found


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists() or path.read_text() != text:
        path.write_text(text)


def page_assets(output, routes):
    """Scripts que cargan hoy las páginas: {nombre: ruta}."""
    html = (output / routes.pages[0].lstrip("/") / "index.html").read_text()
    found = {}
    for src in re.findall(r'<script defer src="(/immersive/[^"]+\.js)"', html):
        stem = re.sub(r"-[0-9a-f]{12}(\.[a-z]{2}-[0-9a-f]{12})?\.js$", "", src.rsplit("/", 1)[1])
        found[stem] = src
    return found


def localize_assets(output, lang, dictionary, routes):
    current = page_assets(output, routes)
    mapping = {}
    used_js = set()
    for stem in SCRIPTS:
        src = current.get(stem)
        if not src:
            continue
        text, found = localize_script((output / src.lstrip("/")).read_text(), dictionary)
        used_js |= found
        if found:
            digest = hashlib.sha256(text.encode()).hexdigest()[:12]
            dest = f"/immersive/{stem}-{digest}.{lang}.js"
            write(output / dest.lstrip("/"), text)
            mapping[src] = dest
    src = current.get("catalog")
    if src:
        raw = (output / src.lstrip("/")).read_text()
        prefix = "window.NAROA_CATALOG="
        data = json.loads(raw[len(prefix):].rstrip().rstrip(";"))
        for project in data["projects"]:
            where = f"catálogo:{project['slug']}"
            for field in CATALOG_FIELDS:
                if isinstance(project.get(field), str) and LETTER.search(project[field]):
                    project[field] = dictionary.tr(project[field], "catalog", where) or project[field]
            for photo in project.get("photos", []):
                if photo.get("caption"):
                    photo["caption"] = dictionary.tr(photo["caption"], "catalog", where) or photo["caption"]
        data["labels"] = {k: dictionary.tr(v, "catalog", "catálogo:labels") or v for k, v in data.get("labels", {}).items()}
        data["lang"] = lang
        text = prefix + data_json(data) + ";\n"
        digest = hashlib.sha256(text.encode()).hexdigest()[:12]
        dest = f"/immersive/catalog-{digest}.{lang}.js"
        write(output / dest.lstrip("/"), text)
        mapping[src] = dest
    dictionary.unused_js = sorted(set(dictionary.js) - used_js)
    return mapping


def catalogue_titles(output, routes):
    src = page_assets(output, routes).get("catalog")
    if not src:
        return set()
    raw = (output / src.lstrip("/")).read_text()
    data = json.loads(raw[len("window.NAROA_CATALOG="):].rstrip().rstrip(";"))
    keep = set()
    for project in data["projects"]:
        keep.add(project["title"])
        if project.get("series"):
            keep.add(project["series"])
    return keep


# ── Mapa del sitio ──────────────────────────────────────────────────────────
def localize_sitemap(output, routes, langs):
    path = output / "sitemap.xml"
    if not path.exists():
        return
    xml = path.read_text()
    xml = re.sub(r"<xhtml:link\b[^>]*/>", "", xml)
    xml = re.sub(r"<url><loc>" + re.escape(ORIGIN) + r"/(?:" + "|".join(LANGS) + r")/[^<]*</loc>.*?</url>", "", xml, flags=re.S)
    if "xmlns:xhtml" not in xml:
        xml = xml.replace("<urlset ", '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" ', 1)
    codes = [DEFAULT_LANG] + list(langs)
    extra = []

    def alternates(route):
        links = "".join(f'<xhtml:link rel="alternate" hreflang="{code}" href="{ORIGIN}{lang_path(route, code)}"/>' for code in codes)
        return links + f'<xhtml:link rel="alternate" hreflang="x-default" href="{ORIGIN}{route}"/>'

    def annotate(match):
        route = match.group(1)
        if route not in routes.known:
            return match.group(0)
        lastmod = re.search(r"<lastmod>[^<]*</lastmod>", match.group(0))
        for code in langs:
            extra.append(f"<url><loc>{ORIGIN}{lang_path(route, code)}</loc>{lastmod.group(0) if lastmod else ''}{alternates(route)}</url>")
        return match.group(0).replace("</loc>", "</loc>" + alternates(route), 1)

    xml = re.sub(r"<url><loc>" + re.escape(ORIGIN) + r"(/[^<]*)</loc>.*?</url>", annotate, xml, flags=re.S)
    xml = xml.replace("</urlset>", "".join(extra) + "</urlset>")
    write(path, xml)


# ── Órdenes ─────────────────────────────────────────────────────────────────
def localize(output, langs=None, quiet=False):
    """Escribe las versiones por idioma dentro de `output`. Devuelve {idioma: Dictionary}."""
    output = Path(output)
    langs = [code for code in (langs or LANGS) if (I18N_DIR / f"{code}.json").exists()]
    routes = Routes(output)
    keep = catalogue_titles(output, routes)
    result = {}
    sources = {route: (output / route.lstrip("/") / "index.html").read_text() for route in routes.pages}
    for lang in langs:
        dictionary = Dictionary(lang, keep)
        assets = localize_assets(output, lang, dictionary, routes)
        for route, html in sources.items():
            write(output / lang / route.lstrip("/") / "index.html", localize_page(html, route, lang, dictionary, routes, langs, assets))
        result[lang] = dictionary
        if not quiet:
            print(f"i18n · /{lang}/ · {len(sources)} páginas · {len(dictionary.missing)} textos sin traducir" + (f" · {len(dictionary.broken)} con marcas descuadradas" if dictionary.broken else ""))
    for route, html in sources.items():
        write(output / route.lstrip("/") / "index.html", annotate_default(html, route, langs))
    localize_sitemap(output, routes, langs)
    return result


def js_candidates(output, routes, dictionary):
    """Literales de los scripts que parecen texto para el visitante y no están en el diccionario."""
    pat = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", re.S)
    current = page_assets(output, routes)
    found = {}
    for stem in SCRIPTS:
        src = current.get(stem)
        if not src:
            continue
        for n, line in enumerate((output / src.lstrip("/")).read_text().split("\n"), 1):
            stripped = line.strip()
            if stripped.startswith(("//", "*", "/*")):
                continue
            for m in pat.finditer(line):
                text = next(g for g in m.groups() if g is not None)
                text = text.replace("\\'", "'").replace('\\"', '"').replace("\\n", "\n")
                if len(text) < 3 or text in dictionary.js or text in dictionary.js_keep:
                    continue
                spanish = re.search(r"[áéíóúñÁÉÍÓÚÑ¿¡«»…]", text)
                phrase = re.search(r"[A-Za-zÁÉÍÓÚáéíóúñ]{3,} [a-záéíóúñ]{2,}", text)
                code = re.search(r"^[.#\[]|[{};]|\b(px|rgba?|translate|cubic-bezier|var\(|querySelector)\b|^\s*<(svg|path|div)|=>|^use strict$", text)
                if spanish or (phrase and not code):
                    found.setdefault(text, f"{stem}.js:{n}")
    return found


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=("extract", "apply", "check"))
    parser.add_argument("--output", default=str(REPO / ".deploy"))
    parser.add_argument("--lang", default="en")
    parser.add_argument("--missing", help="archivo JSON donde dejar lo que falta por traducir (extract)")
    args = parser.parse_args()
    output = Path(args.output)
    if args.command == "apply":
        localize(output)
        return 0
    # extract y check no escriben en la compilación: traducen en memoria y cuentan lo que falta.
    routes = Routes(output)
    langs = [args.lang]
    dictionary = Dictionary(args.lang, catalogue_titles(output, routes))
    prefix = "window.NAROA_CATALOG="
    src = page_assets(output, routes).get("catalog")
    if src:
        data = json.loads((output / src.lstrip("/")).read_text()[len(prefix):].rstrip().rstrip(";"))
        for project in data["projects"]:
            for field in CATALOG_FIELDS:
                if isinstance(project.get(field), str) and LETTER.search(project[field]):
                    dictionary.tr(project[field], "catalog", f"catálogo:{project['slug']}")
            for photo in project.get("photos", []):
                if photo.get("caption"):
                    dictionary.tr(photo["caption"], "catalog", f"catálogo:{project['slug']}")
        for label in data.get("labels", {}).values():
            dictionary.tr(label, "catalog", "catálogo:labels")
    for route in routes.pages:
        localize_page((output / route.lstrip("/") / "index.html").read_text(), route, args.lang, dictionary, routes, langs, {})
    scripts = js_candidates(output, routes, dictionary)
    stale = sorted(set(dictionary.strings) - dictionary.used)
    print(f"{len(dictionary.missing)} textos sin traducir · {len(scripts)} literales de script por revisar · {len(dictionary.broken)} con marcas descuadradas · {len(stale)} entradas que ya no se usan")
    atoms = {}
    for key, value in dictionary.missing.items():
        for atom in dictionary.atoms(key):
            atoms.setdefault(atom, value[1])
    if args.missing:
        Path(args.missing).write_text(json.dumps({
            "strings": [{"es": k, "kind": v[0], "where": v[1], "count": v[2]} for k, v in dictionary.missing.items()],
            "atoms": atoms,
            "js": [{"es": k, "where": v} for k, v in scripts.items()],
            "broken": dictionary.broken,
            "stale": stale,
        }, ensure_ascii=False, indent=1))
    if args.command == "check":
        for key, translated in dictionary.broken[:20]:
            print("  marcas:", key[:90], "→", translated[:90])
        for key, value in list(dictionary.missing.items())[:20]:
            print(f"  falta ({value[1]}):", key[:110])
        return 1 if dictionary.missing or dictionary.broken else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
