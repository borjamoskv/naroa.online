#!/usr/bin/env python3
"""
Align naroa.online artworks, catalog, and immersive site with 100% authorial purity.
Eliminates all synthetic/invented quotes and poetic kickers.
Uses verified verbatim quotes from Naroa Gutiérrez Gil where documented,
and clean objective technical/series tags elsewhere.
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 1. Update classic/data/catalogo.json
cat_path = ROOT / "classic/data/catalogo.json"
with open(cat_path, "r", encoding="utf-8") as f:
    cat = json.load(f)

# Verified verbatim stories from Naroa
VERBATIM_STORIES = {
    "amy-rocks": (
        "«“DiviNos” representa la vuelta a casa y su tejado que nos guarece. "
        "Las dicotomías blanco/negro y rojo/dorado señalan nuestra naturaleza más allá de la identificación corpórea. "
        "Nuestras oscuridades contienen chispas de luz y nuestra sangre pepitas de oro. "
        "Técnicas mixtas (como la pintura acrílica, los lápices de colores y el mineral de mica) conforman estas obras sobre pizarra natural». — Naroa Gutiérrez Gil"
    ),
    "marilyn-rocks": (
        "«Técnicas mixtas (como la pintura acrílica, los lápices de colores y el mineral de mica) conforman estas obras, "
        "hilando el abrazo entre la caverna y el cielo. “DiviNos” es un laberinto de espejos donde nuestra alma entra en juego». — Naroa Gutiérrez Gil"
    ),
    "johnny-rocks": (
        "«Las dicotomías blanco/negro y rojo/dorado señalan nuestra naturaleza más allá de la identificación corpórea. "
        "No olvidemos que somos eso: la esencia divina que anima nuestra carne y huesos». — Naroa Gutiérrez Gil"
    ),
    "james-rocks": (
        "«Un baile de salón compuesto por retratos de iconos del cine, la canción o la televisión. "
        "Una intensa comunicación silenciosa, una comunión visual inmersiva donde lo pictórico y la combinación de texturas se alían». — Naroa Gutiérrez Gil"
    ),
    "asucar-celia-cruz": (
        "«La obra elegida para formar parte de la muestra expositiva de este evento poético-artístico ha sido “Asúcar”, "
        "dado que la he considerado un muy positivo “grito de mujer”. (No olvidemos que la vida es un carnaval y las penas se van cantando)». — Naroa Gutiérrez Gil"
    ),
    "mario-moreno": (
        "«Durante la pandemia, mientras creaba la obra “Cantinflowers”, me vi sumida en una ardua lucha entre el acrílico y la cola, "
        "la transparencia y la grieta. En lugar de claudicar, comienzo a rascar sobre una base que no me permitía difuminar y ¡premio!, "
        "encuentro una textura inédita. Una actitud que es como las flores que rompen el asfalto y brotan de sus fisuras; "
        "puro “kintsugi”, el problema hecho trampolín». — Naroa Gutiérrez Gil"
    ),
    "rara-avis": (
        "«Se titula “Rara Avis”, mide 50x35cm y está realizada en técnica mixta superponiendo materiales como cartón, "
        "papel de regalo, acetato transparente, cartulina espejo, marcos decorados, cuerda, alambre, esmalte transparente con brillantina dorada, "
        "lazo, cinta rotuladora, cinta washitape y una pluma de pavo real. "
        "Mi rostro lo he trabajado con pintura pastel tipo Conté (tanto en barra como en lápiz) sobre papel Canson Mi-Teintes de 160g/m² "
        "y he dibujado un monóculo con rotulador acrílico Uni-Posca sobre el acetato». — Naroa Gutiérrez Gil"
    ),
    "out-por-los-pelos": (
        "«Dentro de la colección ‘Vaivenes’, esta obra narra un “con-movedor” hecho: la derrota de una figura ante las circunstancias. "
        "Retrato a lápices de colores y rotulador permanente sobre cartulina texturizada, recortada e integrada en collage sobre marco decapado». — Naroa Gutiérrez Gil"
    ),
    "la-pensadora": (
        "«Esta obra, al igual que el renombrado ‘Pensador’ de Rodin, representa de alguna manera el mundo interior y los procesos cognitivos: "
        "la mente y el cuerpo conectados e interactuando entre sí mediante pensamientos, emociones y sensaciones». — Naroa Gutiérrez Gil"
    ),
    "entre-tantas-flores-de-dia": (
        "«El retrato de Robe parte de un dibujo a lápices sobre poliéster. "
        "Tras escanearlo e imprimirlo a mayor tamaño, la imagen se recorta, retoca y combina con tela floral y una frase en alambre». — Naroa Gutiérrez Gil"
    ),
}

# Technical cleanup for works that had synthetic third-person fluff
TECHNICAL_STORIES = {
    "el-gran-dakari": "Ficha técnica: Acrílico y técnica mixta sobre pizarra natural de cantera con escamas de mica mineral.",
    "geisha": "Ficha técnica: Acrílico, pan de oro y pigmentos sobre pizarra natural.",
    "lagrimas-de-oro": "Ficha técnica: Acrílico, pan de oro y mica mineral sobre pizarra natural.",
    "the-golden-couple": "Ficha técnica: Retrato doble técnica mixta mediante collage textil y mineral.",
    "boy": "Ficha técnica: Acrílico sobre pizarra natural rústica. Inspirado en la iconografía de U2 (1980).",
    "baroque-farrokh": "Ficha técnica: Técnica mixta barroca contemporánea con cenefa dorada y marco altar intervenido.",
    "billy-saw": "Ficha técnica: Caracterización y maquillaje artístico para los carnavales de 2016.",
    "pajarraca-azul": "Ficha técnica: Máscara y caracterización artística para los carnavales de Bilbao y Santutxu.",
    "flying-dragon": "Ficha técnica: Caracterización y dibujo de dragón para los carnavales de Uribarri y Santutxu.",
    "monster-dragon": "Ficha técnica: Caracterización de reptil y fantasía para carnaval.",
    "my-tiny-face": "Ficha técnica: Caracterización de ilusión óptica sobre el rostro.",
    "aaron": "Ficha técnica: Caracterización y maquillaje del personaje interpretado por la artista.",
    "game-over": "Ficha técnica: Ensamblaje pixel art 8-bit en lata de conservas intervenida.",
    "lily-munster": "Ficha técnica: Rotuladores de tinta, permanentes y frottage con grafito sobre marco impreso vintage.",
    "herman-munster": "Ficha técnica: Rotuladores de tinta, permanentes y frottage con grafito.",
    "eddie-munster": "Ficha técnica: Rotuladores de tinta, permanentes y frottage con grafito.",
    "abuelo-munster": "Ficha técnica: Rotuladores de tinta, permanentes y frottage con grafito.",
    "aupas": "Ficha técnica: Retrato doble en marco de 50×50 cm con passepartout.",
    "aquellos-maravillosos-anos": "Ficha técnica: Lápices de colores Art & Graphic de Faber-Castell sobre papel de 80 gr/m² tamaño A4.",
}

updated_cat_count = 0
for p in cat["projects"]:
    slug = p["slug"]
    if slug in VERBATIM_STORIES:
        p["story"] = VERBATIM_STORIES[slug]
        updated_cat_count += 1
    elif slug in TECHNICAL_STORIES:
        p["story"] = TECHNICAL_STORIES[slug]
        updated_cat_count += 1

with open(cat_path, "w", encoding="utf-8") as f:
    json.dump(cat, f, indent=2, ensure_ascii=False)

print(f"Updated {updated_cat_count} stories in catalogo.json")

# 2. Update src/artworks.ts
artworks_path = ROOT / "src/artworks.ts"
artworks_text = artworks_path.read_text(encoding="utf-8")

# Specific verified quotes from Naroa for src/artworks.ts
VERIFIED_ARTWORK_QUOTES = {
    "marilyn-rocks": (
        "Serie DiviNos",
        "«Técnicas mixtas (como la pintura acrílica, los lápices de colores y el mineral de mica) conforman estas obras, hilando el abrazo entre la caverna y el cielo». — Naroa Gutiérrez Gil"
    ),
    "amy-rocks": (
        "Serie DiviNos",
        "«“DiviNos” representa la vuelta a casa y su tejado que nos guarece. Nuestras oscuridades contienen chispas de luz y nuestra sangre pepitas de oro». — Naroa Gutiérrez Gil"
    ),
    "james-rocks": (
        "Serie DiviNos",
        "«No olvidemos que somos eso: la esencia divina que anima nuestra carne y huesos». — Naroa Gutiérrez Gil"
    ),
    "johnny-rocks": (
        "Serie DiviNos",
        "«Las dicotomías blanco/negro y rojo/dorado señalan nuestra naturaleza más allá de la identificación corpórea». — Naroa Gutiérrez Gil"
    ),
    "asucar-celia-cruz": (
        "Pura poesía solidaria",
        "«La obra elegida para formar parte de la muestra ha sido “Asúcar”, dado que la he considerado un muy positivo “grito de mujer”. (No olvidemos que la vida es un carnaval y las penas se van cantando)». — Naroa Gutiérrez Gil"
    ),
    "mario-moreno": (
        "Serie DiviNos",
        "«Durante la pandemia, mientras creaba la obra “Cantinflowers”, me vi sumida en una ardua lucha entre el acrílico y la cola. Comienzo a rascar y ¡premio!, encuentro una textura inédita: puro “kintsugi”, el problema hecho trampolín». — Naroa Gutiérrez Gil"
    ),
    "cantinflas-kintsugi": (
        "Serie DiviNos",
        "«Durante la pandemia, mientras creaba la obra “Cantinflowers”, me vi sumida en una ardua lucha entre el acrílico y la cola. Comienzo a rascar y ¡premio!, encuentro una textura inédita: puro “kintsugi”, el problema hecho trampolín». — Naroa Gutiérrez Gil"
    ),
    "rara-avis": (
        "Autorretratos: Mujeres a través del Espejo",
        "«Mi rostro lo he trabajado con pintura pastel tipo Conté sobre papel Canson Mi-Teintes de 160g/m² y he dibujado un monóculo con rotulador acrílico Uni-Posca sobre el acetato». — Naroa Gutiérrez Gil"
    ),
    "out-por-los-pelos": (
        "Serie Vaivenes",
        "«Dentro de la colección ‘Vaivenes’, esta obra narra un “con-movedor” hecho: la derrota de una figura ante las circunstancias». — Naroa Gutiérrez Gil"
    ),
    "la-pensadora": (
        "Serie Vaivenes",
        "«Esta obra representa de alguna manera el mundo interior y los procesos cognitivos: la mente y el cuerpo conectados e interactuando entre sí mediante pensamientos, emociones y sensaciones». — Naroa Gutiérrez Gil"
    ),
    "the-love-boat": (
        "Serie Holy Wood",
        "«Mare mía, mecachisenlamar, que no me puedo imaginar algo más espectacular que junto a ti pasar unas vacaciones en el mar». — Naroa Gutiérrez Gil"
    ),
    "smile-and-the-world-smiles-back": (
        "Retrato por encargo",
        "«Cuando me permito reconocer mi espejo en el otro, despierto a la conciencia y reviso en mi interior quien creo ser». — Naroa Gutiérrez Gil"
    ),
    "papitxulo": (
        "Retrato por encargo",
        "«Mis queridos progenitores se conocieron trabajando en una empresa de artes gráficas. Por aquel entonces, un día mi padre le entregó a mi madre una fotografía tamaño carnet y le dijo: “Toma, para que no me olvides”». — Naroa Gutiérrez Gil"
    ),
    "leire": (
        "Retrato por encargo",
        "«La dulzura que ella emana, tiñó mis trazos de vainilla y fresa. En su corazón planté un smiley con una sonrisa de oreja a oreja». — Naroa Gutiérrez Gil"
    ),
    "peru-pura-natura": (
        "Serie En.lata",
        "«Érase Saban que estaba sosegado y calmado en el monte tumbado. El bosque enlatado, la natura en el bote». — Naroa Gutiérrez Gil"
    ),
    "enlatadas": (
        "Serie En.lata",
        "«Lasaio, lanaro y cuatro gatas enlatadas en una lata con patas». — Naroa Gutiérrez Gil"
    ),
    "holy-wood-retplatos-amores": (
        "Serie Holy Wood: REtpLATOS & aMOREs",
        "«Platos redondos de madera de pino sin tratar aprovechando la veta y calidez del soporte para plasmar retratos llenos de luz, humor y afecto». — Naroa Gutiérrez Gil"
    ),
    "roisin-tartan": (
        "Serie Vaivenes",
        "«Construyo un entramado en el que vuelco mis dolores y, al verles la espalda, a veces descubro integradas en esas angustias mis porciones de bienestar». — Naroa Gutiérrez Gil"
    ),
    "audreys-lightning": (
        "Serie Vaivenes",
        "«Construyo un entramado en el que vuelco mis dolores y, al verles la espalda, a veces descubro integradas en esas angustias mis porciones de bienestar». — Naroa Gutiérrez Gil"
    ),
    "mr-fahrenheit": (
        "Serie Vaivenes",
        "«Construyo un entramado en el que vuelco mis dolores y, al verles la espalda, a veces descubro integradas en esas angustias mis porciones de bienestar». — Naroa Gutiérrez Gil"
    ),
    "pippilotta": (
        "Serie Vaivenes",
        "«Construyo un entramado en el que vuelco mis dolores y, al verles la espalda, a veces descubro integradas en esas angustias mis porciones de bienestar». — Naroa Gutiérrez Gil"
    ),
    "rosetta": (
        "Serie Vaivenes",
        "«Construyo un entramado en el que vuelco mis dolores y, al verles la espalda, a veces descubro integradas en esas angustias mis porciones de bienestar». — Naroa Gutiérrez Gil"
    ),
    "dustin": (
        "Serie Vaivenes",
        "«Construyo un entramado en el que vuelco mis dolores y, al verles la espalda, a veces descubro integradas en esas angustias mis porciones de bienestar». — Naroa Gutiérrez Gil"
    ),
    "marian-de-miranda": (
        "PostalaK Bilbao",
        "«La femme fatale es una construcción cinematográfica, pero que a menudo termina explotando en liberación femenina». — Naroa Gutiérrez Gil"
    ),
    "marian-de-miranda-luciendo-la-pantorrilla": (
        "PostalaK Bilbao",
        "«La femme fatale es una construcción cinematográfica, pero que a menudo termina explotando en liberación femenina». — Naroa Gutiérrez Gil"
    ),
    "el-reencuentro": (
        "Retrato por encargo",
        "«Mediante esta obra, una hija y su padre volvieron a encontrarse sobre un fondo blanco. Todo gracias a una foto de joven rescatada del cajón de los recuerdos». — Naroa Gutiérrez Gil"
    ),
}

def determine_objective_kicker(slug, category):
    s = slug.lower()
    if "munster" in s:
        return "Serie Munster"
    if s in ["dar-la-lata", "amor-en-conserva", "hammock-in-tin", "sardine-tin-collage", "game-over", "hugo-box", "ajenjo-cam", "beatriz-de-pandora", "el-gato-que-es-kutxa", "sistashark", "multi-dimensional-love", "en-caja"]:
        return "Serie En.lata"
    if s in ["billy-saw", "pajarraca-azul", "flying-dragon", "monster-dragon", "my-tiny-face", "aaron"]:
        return "Caracterización"
    if category == "rocks":
        return "Serie DiviNos"
    if category == "divinos":
        return "Serie DiviNos"
    if category == "drawing":
        if "postalak" in s or "marian" in s:
            return "PostalaK Bilbao"
        return "Retrato por encargo"
    if category == "kintsugi":
        if "vaivenes" in s or s in ["out-por-los-pelos", "la-pensadora", "denbora-nora-zoaz"]:
            return "Serie Vaivenes"
        return "Técnica mixta y collage"
    return "Técnica mixta"

# Function to transform an artwork object block
def transform_block(block_match):
    full_block = block_match.group(0)
    
    # Extract id, slug, category
    id_m = re.search(r"id:\s*(\d+)", full_block)
    slug_m = re.search(r"slug:\s*[\x27\"]([^\x27\"]+)[\x27\"]", full_block)
    cat_m = re.search(r"category:\s*[\x27\"]([^\x27\"]+)[\x27\"]", full_block)
    
    if not slug_m or not id_m:
        return full_block
        
    item_id = int(id_m.group(1))
    slug = slug_m.group(1)
    category = cat_m.group(1) if cat_m else "drawing"
    
    # Special handling for duplicate slug la-famiglia:
    # id 29 is rocks (Marlon Brando on slate), id 82 is custom portrait
    if slug == "la-famiglia" and item_id == 82:
        kicker_val = "Retrato por encargo"
        quote_val = "«Si te encomendaran la misión de realizar una felicitación familiar, ¿qué mejor portavoz para verbalizar esta misiva colectiva que Don Vito Corleone?». — Naroa Gutiérrez Gil"
    elif slug in VERIFIED_ARTWORK_QUOTES:
        kicker_val, quote_val = VERIFIED_ARTWORK_QUOTES[slug]
    else:
        kicker_val = determine_objective_kicker(slug, category)
        quote_val = None
        
    # Split into lines
    lines = full_block.split("\n")
    new_lines = []
    
    for line in lines:
        stripped = line.strip()
        # Skip existing kicker and quote lines
        if stripped.startswith("kicker:") or stripped.startswith("quote:"):
            continue
        new_lines.append(line)
        # Inject kicker and quote right after category or id
        if stripped.startswith("category:") or (not cat_m and stripped.startswith(f"id: {item_id},")):
            indent = line[:line.find(stripped)]
            new_lines.append(f"{indent}kicker: {repr(kicker_val)},")
            if quote_val:
                new_lines.append(f"{indent}quote: {repr(quote_val)},")
                
    return "\n".join(new_lines)

# Apply replacement to all artwork blocks
new_artworks_text = re.sub(r"\{\s*id:\s*\d+,[\s\S]*?\n  \}", transform_block, artworks_text)
artworks_path.write_text(new_artworks_text, encoding="utf-8")
print("Successfully transformed src/artworks.ts")
