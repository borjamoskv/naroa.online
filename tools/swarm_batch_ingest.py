import os
import json
import hashlib
from PIL import Image, ImageFilter

BASE_UPLOAD = '/Users/borjafernandezangulo/.gemini/antigravity/brain/daefad5b-db21-4603-861e-73984519383c/.user_uploaded'
CATALOGO_PATH = 'classic/data/catalogo.json'
JOURNEY_PATH = 'classic/data/journey.json'
CATALOGO_IMG_DIR = 'classic/images/catalogo'

def process_image(src_filename, dest_filename, target_width=None, unsharp=True):
    src_path = os.path.join(BASE_UPLOAD, src_filename)
    dest_path = os.path.join(CATALOGO_IMG_DIR, dest_filename)
    im = Image.open(src_path).convert('RGB')
    
    if target_width and im.width < target_width:
        ratio = target_width / im.width
        target_height = int(im.height * ratio)
        im = im.resize((target_width, target_height), Image.Resampling.LANCZOS)
        if unsharp:
            im = im.filter(ImageFilter.UnsharpMask(radius=1.5, percent=120, threshold=3))
            
    im.save(dest_path, 'JPEG', quality=95)
    with open(dest_path, 'rb') as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    return f"/images/catalogo/{dest_filename}", im.width, im.height, digest

# 1. Process Out Por Los Pelos master
out_src, out_w, out_h, out_sha = process_image('media_1792827518249_6bce6002.jpg', 'out-por-los-pelos-master-4k.jpg', target_width=2000)

# 2. Process the 8 new works
specs = [
    {
        "slug": "la-famiglia",
        "title": "La Famiglia",
        "category": "collage",
        "technique": "Lápices de colores y pintura acrílica",
        "support": "Papel de acuarela (300 g/m²)",
        "dimensions": "18 × 24 cm",
        "materials": "Lápices de colores Art & Graphic de Faber-Castell, pintura acrílica muy diluida en agua y etiquetas washi-tape",
        "story": "Retrato de Marlon Brando interpretando el personaje Vito Corleone en El Padrino, trazado en negro y gris sobre un fondo multicolor de acuarela. Una felicitación familiar cargada de afecto: «Zorionak Jon de la Famiglia de corazón».",
        "year": 2021,
        "mode": "H",
        "img_file": "media_1792827291340_b86c6386.jpg",
        "dest_file": "la-famiglia-01.jpg",
        "caption": "La Famiglia — Retrato de Vito Corleone sobre fondo acuarelado."
    },
    {
        "slug": "smile-and-the-world-smiles-back",
        "title": "Smile & the World Smiles Back",
        "category": "objetos",
        "technique": "Técnica mixta y collage",
        "support": "Plato de madera sin tratar",
        "dimensions": "Ø 24 cm",
        "materials": "Lápices Faber-Castell Art & Graphic, rotuladores Uni-Posca, collage (papel de seda, cenefa de punto, adornos bordados, telas estampadas, papel de regalo) y barniz de látex líquido",
        "story": "“Cuando me permito reconocer mi espejo en el otro, despierto a la conciencia y reviso en mi interior quien creo ser”. Retrato colorista sobre plato de madera sin tratar intervenido con elementos textiles y collage.",
        "year": 2016,
        "mode": "Z",
        "img_file": "media_1792827307937_6f0d81f5.png",
        "dest_file": "smile-and-the-world-smiles-back-01.jpg",
        "caption": "Smile & the World Smiles Back — Retrato sobre plato de madera y elementos bordados."
    },
    {
        "slug": "luis-and-sis",
        "title": "Luis & sis",
        "category": "collage",
        "technique": "Técnica mixta",
        "support": "Papel poliéster impreso en lámina de 350 g/m² en marco con passepartout",
        "dimensions": "40 × 50 cm",
        "materials": "Lápices de colores Faber-Castell Art & Graphic sobre papel poliéster",
        "story": "“Aquellos maravillosos años…”. Retrato realista doble en blanco y negro con la ropa garabateada a color mediante técnica mixta, recreando la espontaneidad y cariño de la infancia.",
        "year": None,
        "mode": "V",
        "img_file": "media_1792827332269_747e3b99.png",
        "dest_file": "luis-and-sis-01.jpg",
        "caption": "Luis & sis — Retrato infantil doble con toques de color garabateados."
    },
    {
        "slug": "de-color",
        "title": "…de color",
        "category": "collage",
        "technique": "Técnica mixta",
        "support": "Papel de 350 g/m² ligeramente satinado (A3) en marco con passepartout",
        "dimensions": "40 × 50 cm",
        "materials": "Lápices Faber-Castell Art & Graphic, pintura acrílica diluida en salpicaduras y rotuladores Uni-Posca",
        "story": "“El mundo a veces se nos antoja gris y hay días en los que lo vemos todo negro, pero cuando Aitor llega, entonces hay tormenta intensa... un aluvión de energía que en vez de agua descarga trombas de color”.",
        "year": None,
        "mode": "H",
        "img_file": "media_1792827406222_f2fdacff.jpg",
        "dest_file": "de-color-01.jpg",
        "caption": "…de color — Retrato de Aitor con salpicaduras y fondo de arcoíris desestructurado."
    },
    {
        "slug": "el-reencuentro",
        "title": "El Reencuentro",
        "category": "collage",
        "technique": "Pintura acrílica",
        "support": "Lienzo 3D",
        "dimensions": "30 × 40 cm",
        "materials": "Pintura acrílica negra, rotulador Edding permanente blanco y cobertura protectora de látex líquido",
        "story": "Una hija y su padre vuelven a encontrarse sobre un fondo blanco a partir de una fotografía de juventud rescatada. El rastro de caricias con pincel en rostros y cabellos materializa el reencuentro sobre el lienzo.",
        "year": 2015,
        "mode": "V",
        "img_file": "media_1792827428768_0f01916b.jpg",
        "dest_file": "el-reencuentro-01.jpg",
        "caption": "El Reencuentro — Retrato familiar doble en acrílico blanco y negro sobre lienzo 3D."
    },
    {
        "slug": "papitxulo",
        "title": "Papitxulo",
        "category": "collage",
        "technique": "Técnica mixta y mosaico",
        "support": "Lienzo",
        "dimensions": "50 × 40 cm",
        "materials": "Látex vinílico sobre silueta mate y mosaico de láminas holográficas y papel espejo sobre óleo amarillo",
        "story": "Retrato del aitatxu de Naroa capturado en un selfie dandy con bata de laboratorio y cigarrillo en la empresa de artes gráficas donde se conocieron sus progenitores. La silueta mate resalta sobre un fondo de mosaico holográfico que muta con la perspectiva.",
        "year": None,
        "mode": "Z",
        "img_file": "media_1792827465523_53cbc1b9.jpg",
        "dest_file": "papitxulo-01.jpg",
        "caption": "Papitxulo — Retrato del aitatxu de Naroa con fondo de mosaico holográfico."
    },
    {
        "slug": "starchild",
        "title": "Starchild",
        "category": "collage",
        "technique": "Ilustración a bolígrafo Bic y collage holográfico",
        "support": "Papel poliéster impreso en papel de alto gramaje con marco y paspartú intervenido",
        "dimensions": "50 × 70 cm",
        "materials": "Bolígrafos Bic, bolsas de cartón holográficas, plástico holográfico en relieve y rotulador permanente",
        "story": "“There's a starman waiting in the sky / He'd like to come and meet us / But he thinks he'd blow our minds”. Retrato de David Bowie con gesto de silencio y firmamento a sus espaldas con astronautas, satélites y planetas holográficos.",
        "year": None,
        "mode": "Z",
        "img_file": "media_1792827497964_a55bf089.jpg",
        "dest_file": "starchild-01.jpg",
        "caption": "Starchild — Retrato de David Bowie con collage holográfico espacial."
    },
    {
        "slug": "las-rosalias",
        "title": "Las RosaLías",
        "category": "collage",
        "technique": "Collage y técnica mixta",
        "support": "Papel de alto gramaje y marco con passepartout",
        "dimensions": "40 × 50 cm",
        "materials": "Lápices Faber-Castell sobre poliéster, frottage de monedas en chanclas, rosas glossy, fieltro, papel Canson rayado, papel de estraza, celofán con nubes y rotuladores Uni-Posca",
        "story": "Rara avis que destaca entre las obras enmarcadas por la riqueza de materiales y capas de significado. Los pies descansando en la barandilla de Copper Deli, las rosas plastificadas, los elefantes, el paisaje de fieltro y el cielo de celofán conforman un puzzle textil y afectivo en perfecto equilibrio.",
        "year": 2019,
        "mode": "V",
        "img_file": "media_1792827160915_74c85818.jpg",
        "dest_file": "las-rosalias-01.jpg",
        "caption": "Las RosaLías — Collage textil y plástico con pies en la barandilla de Copper Deli."
    }
]

# Update out-por-los-pelos in catalogo.json
with open(CATALOGO_PATH) as f:
    cat = json.load(f)

for p in cat['projects']:
    if p['slug'] == 'out-por-los-pelos':
        p['materials'] = "Pelota de tenis de fieltro, cabello anudado, papeles Canson, acetato impreso publicitario (“Do they match?”), marcador washi-tape con las letras OUT, redes cosidas y gotas de látex líquido a modo de sudor."
        p['dimensions'] = "50 × 40 cm"
        # Prepend new master photo
        new_master = {
            "src": out_src,
            "width": out_w,
            "height": out_h,
            "caption": "OUT (por los pelos) — Fotografía master de la obra enmarcada completa.",
            "sha256": out_sha
        }
        p['images'].insert(0, new_master)
        print("Updated out-por-los-pelos with master image!")
        break

# Ingest the 8 works and append to catalogo
with open(JOURNEY_PATH) as f:
    journey = json.load(f)

for sp in specs:
    src, w, h, sha = process_image(sp["img_file"], sp["dest_file"], target_width=2048)
    new_proj = {
        "slug": sp["slug"],
        "title": sp["title"],
        "category": sp["category"],
        "technique": sp["technique"],
        "support": sp["support"],
        "dimensions": sp["dimensions"],
        "materials": sp["materials"],
        "story": sp["story"],
        "series": None,
        "year": sp["year"],
        "credit": None,
        "selected": True,
        "kind": "obra",
        "source": None,
        "images": [
            {
                "src": src,
                "width": w,
                "height": h,
                "caption": sp["caption"],
                "sha256": sha
            }
        ]
    }
    # Check if already present
    if not any(p["slug"] == sp["slug"] for p in cat["projects"]):
        cat["projects"].append(new_proj)
        print(f"Added {sp['slug']} to catalogo!")
    
    # Check if already in journey scenes
    if not any(s["slug"] == sp["slug"] for s in journey["scenes"]):
        journey["scenes"].append({
            "slug": sp["slug"],
            "mode": sp["mode"],
            "hold": 25,
            "explore": 0
        })
        print(f"Added {sp['slug']} ({sp['mode']}) to journey scenes!")

with open(CATALOGO_PATH, 'w') as f:
    json.dump(cat, f, ensure_ascii=False, indent=2)

with open(JOURNEY_PATH, 'w') as f:
    json.dump(journey, f, ensure_ascii=False, indent=2)

print("Ingestion script completed successfully!")
