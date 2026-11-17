#!/usr/bin/env python3
"""Reglas de alojamiento: `vercel.json` es la fuente y Cloudflare Pages su copia.

Vercel sirve naroagutierrezgil.com; Cloudflare Pages (naroagutierrezgil-com.pages.dev) es una copia
que `deploy.sh` actualiza aparte. Los bloqueos de LaLiga caen sobre IP de Cloudflare, así que el
dominio no puede depender de él. Este módulo escribe el `_headers` de la copia a partir de
`vercel.json` y comprueba, archivo a archivo, que las dos plataformas darían las mismas cabeceras.

    python3 tools/hosting_rules.py                  # imprime el _headers que saldría (sin archivos enumerados)
    python3 tools/hosting_rules.py --check .deploy  # compara una compilación con vercel.json
"""
import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]

# Límites de `_headers` en Cloudflare Pages (los mismos que aplica wrangler al leerlo).
PAGES_MAX_RULES = 100
PAGES_MAX_LINE = 2000

# Reglas de vercel.json cuya expresión ningún patrón con un solo `*` puede decir (Pages admite un
# comodín por ruta). Se aproximan con globs algo más anchos, o con ninguno, y `pages_headers` añade
# al final una regla por cada archivo que el glob alcance mal o no alcance (las excepciones).
GLOBS = {
    r"/assets/(.*-v\d+\.[a-z0-9]+)": [],
    r"/immersive/(.*-[0-9a-f]{12}[-.][^/]*)": ["/immersive/media/*", "/immersive/*.js", "/immersive/*.css", "/immersive/*.svg"],
}


def hosting_rules(path=REPO / "vercel.json"):
    return json.loads(Path(path).read_text())


def to_globs(source):
    """Traduce el `source` de una regla de vercel.json a rutas de `_headers`, o falla."""
    if source in GLOBS:
        return GLOBS[source]
    if source == "/(.*)":
        return ["/*"]
    m = re.fullmatch(r"(/[A-Za-z0-9_./-]*?)\(\.\*\)", source)
    if m:
        return [m.group(1) + "*"]
    m = re.fullmatch(r"(/[A-Za-z0-9_./-]*?)\(([A-Za-z0-9_-]+(?:\|[A-Za-z0-9_-]+)+)\)([A-Za-z0-9_./-]*)", source)
    if m:
        return [m.group(1) + alt + m.group(3) for alt in m.group(2).split("|")]
    if re.fullmatch(r"/[A-Za-z0-9_./-]*", source):
        return [source]
    raise ValueError(f"regla de vercel.json sin traducción a _headers: {source!r} (añádela a GLOBS en tools/hosting_rules.py)")


def pages_headers(hosting, files=()):
    """Texto de `_headers` equivalente a las cabeceras de vercel.json.

    En Pages todas las reglas que coinciden se aplican y una cabecera repetida se une con coma, no
    se sustituye (Vercel deja la última). Para que gane la más específica, cada ruta retira con
    `! Cabecera` las que una anterior ya haya puesto. `files` son las rutas públicas de la
    compilación (`/assets/x-v1.png`): donde un glob no da lo que vercel.json da a un archivo, se
    añade al final una regla con su ruta exacta.
    """
    lines = ["# Generado desde vercel.json por tools/hosting_rules.py: no se edita a mano."]
    seen = set()
    for rule in hosting["headers"]:
        if rule.get("has"):
            continue  # reglas por host: Pages no las expresa (el www lo resolvía el Worker de Cloudflare)
        for glob in to_globs(rule["source"]):
            lines.append(glob)
            for header in rule["headers"]:
                if header["key"].lower() in seen:
                    lines.append(f"  ! {header['key']}")
                lines.append(f"  {header['key']}: {header['value']}")
            seen |= {header["key"].lower() for header in rule["headers"]}
    rules = parse_pages_headers("\n".join(lines) + "\n")
    for url in files:
        expected, got = vercel_effective(hosting, url), pages_effective(rules, url)
        if expected == got:
            continue
        if re.search(r"[*:\s]", url):
            raise ValueError(f"la ruta {url!r} no se puede escribir en _headers")
        lines.append(url)
        for name in got:
            if name not in expected or expected[name] != got[name]:
                lines.append(f"  ! {name}")
        lines += [f"  {name}: {value}" for name, value in expected.items() if got.get(name) != value]
    return "\n".join(lines) + "\n"


def parse_pages_headers(text):
    """Lee un `_headers` como wrangler: [(ruta, {cabecera: valor}, [cabeceras retiradas])]; falla si no es válido."""
    rules, current = [], None
    for number, raw in enumerate(text.split("\n"), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if len(line) > PAGES_MAX_LINE:
            raise ValueError(f"_headers:{number}: línea de más de {PAGES_MAX_LINE} caracteres")
        if line.startswith("/") or "://" in line:
            if line.count("*") > 1:
                raise ValueError(f"_headers:{number}: Pages admite un solo «*» por ruta: {line!r}")
            current = (line, {}, [])
            rules.append(current)
        elif current is None:
            raise ValueError(f"_headers:{number}: la ruta debe ir antes de la cabecera: {line!r}")
        elif ":" not in line:
            if not line.startswith("! "):
                raise ValueError(f"_headers:{number}: se esperaba «nombre: valor» o «! nombre»: {line!r}")
            current[2].append(line[2:].strip().lower())
        else:
            name, value = line.split(":", 1)
            name, value = name.strip().lower(), value.strip()
            if not name or " " in name or not value:
                raise ValueError(f"_headers:{number}: cabecera mal formada: {line!r}")
            current[1][name] = f"{current[1][name]}, {value}" if name in current[1] else value
    for pattern, headers, unset in rules:
        if not headers and not unset:
            raise ValueError(f"_headers: la ruta {pattern!r} no lleva cabeceras")
    if len(rules) > PAGES_MAX_RULES:
        raise ValueError(f"_headers: {len(rules)} reglas; Pages admite {PAGES_MAX_RULES}")
    return rules


def pages_effective(rules, url):
    """Cabeceras que daría Pages: reglas en orden; cada una retira y luego añade (las repetidas se unen)."""
    result = {}
    for pattern, headers, unset in rules:
        if re.fullmatch(".*".join(re.escape(part) for part in pattern.split("*")), url):
            for name in unset:
                result.pop(name, None)
            for name, value in headers.items():
                result[name] = f"{result[name]}, {value}" if name in result else value
    return result


def vercel_effective(hosting, url):
    """Cabeceras que daría Vercel: gana la última regla que fija cada una."""
    result = {}
    for rule in hosting["headers"]:
        if not rule.get("has") and re.fullmatch(rule["source"], url):
            for header in rule["headers"]:
                result[header["key"].lower()] = header["value"].strip()
    return result


def public_urls(output):
    """Rutas públicas de una compilación, sin `_headers` ni `_redirects`."""
    return sorted("/" + f.relative_to(output).as_posix() for f in output.rglob("*") if f.is_file() and f.name not in ("_headers", "_redirects"))


def compare(output, hosting, headers_text=None):
    """Diferencias entre vercel.json y el `_headers` de una compilación, archivo a archivo (vacía si coinciden)."""
    rules = parse_pages_headers(headers_text if headers_text is not None else (output / "_headers").read_text())
    groups = {}
    for path in public_urls(output):
        urls = [path]
        if path.endswith("/index.html"):  # con cleanUrls la página se sirve también como /ruta/ y /ruta
            urls += [path[: -len("index.html")], path[: -len("/index.html")] or "/"]
        for url in urls:
            expected, got = vercel_effective(hosting, url), pages_effective(rules, url)
            if expected != got:
                groups.setdefault((tuple(sorted(expected.items())), tuple(sorted(got.items()))), []).append(url)
    problems = []
    for (expected, got), urls in groups.items():
        expected, got = dict(expected), dict(got)
        wanted = {k: v for k, v in expected.items() if got.get(k) != v}
        different = {k: v for k, v in got.items() if expected.get(k) != v}
        problems.append(f"{len(urls)} rutas (p. ej. {urls[0]}): Vercel da {wanted or '—'}, Pages da {different or '—'}")
    return problems


def compare_redirects(output, hosting):
    """Las redirecciones fijas de vercel.json y las de `_redirects` deben ser las mismas."""
    wanted = {r["source"].rstrip("/"): r["destination"].rstrip("/") for r in hosting.get("redirects", []) if not r.get("has") and "(" not in r["source"] and "$" not in r["destination"]}
    got = {}
    for line in (output / "_redirects").read_text().splitlines():
        parts = line.split()
        if len(parts) >= 2 and not line.startswith("#") and "*" not in parts[0]:
            got[parts[0].rstrip("/")] = parts[1].rstrip("/")
    problems = [f"solo en vercel.json: {sorted(set(wanted) - set(got))}"] if set(wanted) - set(got) else []
    problems += [f"solo en _redirects: {sorted(set(got) - set(wanted))}"] if set(got) - set(wanted) else []
    problems += [f"{src}: Vercel → {wanted[src]}, Pages → {got[src]}" for src in sorted(set(wanted) & set(got)) if wanted[src] != got[src]]
    return problems


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", type=Path, metavar="SALIDA", help="compara esa carpeta compilada con vercel.json")
    args = parser.parse_args()
    spec = hosting_rules()
    if not args.check:
        sys.stdout.write(pages_headers(spec))
    else:
        folder = args.check.resolve()
        found = compare(folder, spec) + compare_redirects(folder, spec)
        print("\n".join(found) if found else "PASS: _headers y _redirects dan lo mismo que vercel.json")
        sys.exit(1 if found else 0)
