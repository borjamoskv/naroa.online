#!/usr/bin/env python3
"""Credenciales de contenido (C2PA) de las fotografías de obra (AGENTS.md §12).

La firma es de la propia web: la CA de procedencia de Naroa no está en la lista de
confianza de C2PA (esa lista solo certifica productos que pasan su evaluación), así que
los verificadores públicos la muestran como firmante no reconocido. Lo que sí garantiza:
la foto no se ha tocado desde que salió del build, dice de qué obra es, qué se le hizo y
que no se cede para entrenar IA.

El build solo firma si recibe la clave por entorno, con el PEM o con la ruta a un archivo:
NAROA_C2PA_KEY (clave privada) y NAROA_C2PA_CERTS (certificado y CA, en ese orden).
Sin ellas publica las fotos sin credenciales y sin el enlace que las enseña.

  python3 tools/c2pa_sign.py claves [--dir ~/.config/naroa-c2pa]   CA y certificado de firma
  python3 tools/c2pa_sign.py leer <imagen> [...]                   manifiesto y validación
"""
import argparse
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CA_CERT = REPO / "classic" / "data" / "c2pa-ca.pem"
PROVENANCE = REPO / "classic" / "data" / "procedencia.json"
KEY_DIR = Path("~/.config/naroa-c2pa").expanduser()
ORIGIN = "https://naroagutierrezgil.com"
ARTIST = "Naroa Gutiérrez Gil"
MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif"}
# Etiqueta de la firma dentro del almacén JUMBF: basta para saber si un archivo ya la lleva.
SIGNED_MARK = b"c2pa.signature"
# Lo mismo que robots.txt: fuera los rastreadores de entrenamiento; la búsqueda y la consulta, libres.
TRAINING = {"entries": {"cawg.ai_generative_training": {"use": "notAllowed"}, "cawg.ai_training": {"use": "notAllowed"}}}


def _pem(var):
    value = os.environ.get(var, "").strip()
    if not value:
        return None
    if value.startswith("-----BEGIN"):
        return value.encode()
    return Path(value).expanduser().read_bytes()


def _blocks(pem):
    """Certificados de un PEM sin saltos de línea, para comparar cadenas venga de donde venga."""
    text = pem.decode() if isinstance(pem, bytes) else pem
    return ["".join(part.split("-----")[0].split()) for part in text.split("-----BEGIN CERTIFICATE-----")[1:]]


def has_credentials(path):
    return SIGNED_MARK in Path(path).read_bytes()


class PhotoSigner:
    """Firma en su sitio las fotos de obra que escribe el build."""

    def __init__(self, key, certs):
        import c2pa
        from PIL import __version__ as pillow_version
        self.c2pa = c2pa
        self.signer = c2pa.Signer.from_info(c2pa.C2paSignerInfo(c2pa.C2paSigningAlg.ES256, certs, key, None))
        self.agent = {"name": "Pillow", "version": pillow_version}
        remastered = json.loads(PROVENANCE.read_text())["remasterizadas"]
        self.remastered = {src: remastered["descripcion"] for src in remastered["archivos"]}
        self.signed = 0

    def manifest(self, work, derived):
        actions = [{"action": "c2pa.opened", "parameters": {"ingredientIds": ["fuente"]}}]
        if derived:
            actions += [{"action": "c2pa.resized", "softwareAgent": self.agent}, {"action": "c2pa.transcoded", "softwareAgent": self.agent}]
        artwork = {"Iptc4xmpExt:AOCreator": [ARTIST], "Iptc4xmpExt:AOTitle": work["title"], "Iptc4xmpExt:AOSourceInvURL": ORIGIN + "/obra/" + work["slug"] + "/"}
        return {
            "claim_generator_info": [{"name": "naroagutierrezgil.com", "version": "1"}],
            "title": work["title"],
            "assertions": [
                {"label": "c2pa.actions.v2", "data": {"actions": actions}},
                {"label": "cawg.training-mining", "data": TRAINING},
                {"label": "cawg.metadata", "data": {
                    "@context": {"dc": "http://purl.org/dc/elements/1.1/", "Iptc4xmpExt": "http://iptc.org/std/Iptc4xmpExt/2008-02-29/"},
                    "dc:rights": "© " + ARTIST,
                    "Iptc4xmpExt:ArtworkOrObject": [artwork],
                }},
            ],
        }

    def sign(self, path, source, src, work, derived):
        """`path` es el archivo publicado; `source` la foto del archivo de la que sale (`src`, su ruta web)."""
        path, source = Path(path), Path(source)
        if has_credentials(path):
            return False
        builder = self.c2pa.Builder(self.manifest(work, derived), self.c2pa.Context.from_dict({"builder": {"thumbnail": {"enabled": False}}}))
        ingredient = {"title": source.name, "relationship": "parentOf", "label": "fuente"}
        if src in self.remastered:
            ingredient["description"] = self.remastered[src]
        with source.open("rb") as stream:
            builder.add_ingredient(ingredient, MIME[source.suffix.lower()], stream)
        signed = path.with_name(path.name + ".c2pa-tmp")
        with path.open("rb") as stream, signed.open("w+b") as dest:
            builder.sign(self.signer, MIME[path.suffix.lower()], stream, dest)
        signed.replace(path)
        self.signed += 1
        return True


def signer_from_env():
    key, certs = _pem("NAROA_C2PA_KEY"), _pem("NAROA_C2PA_CERTS")
    if not key and not certs:
        return None
    if not (key and certs):
        raise SystemExit("C2PA: hacen falta NAROA_C2PA_KEY y NAROA_C2PA_CERTS a la vez.")
    try:
        import c2pa  # noqa: F401
    except ImportError:
        raise SystemExit("C2PA: hay clave de firma pero falta c2pa-python (pip install -r requirements.txt).")
    if not CA_CERT.is_file() or _blocks(CA_CERT.read_bytes())[:1] != _blocks(certs)[-1:]:
        raise SystemExit(f"C2PA: la cadena de NAROA_C2PA_CERTS no acaba en la CA publicada ({CA_CERT.relative_to(REPO)}).")
    return PhotoSigner(key, certs)


def validate(path, anchors=CA_CERT):
    """Estado de validación contra nuestra CA: 'Trusted' si la firma es buena y sale de ella."""
    import c2pa
    ctx = c2pa.Context.from_dict({"verify": {"verify_trust": True}, "trust": {"user_anchors": Path(anchors).read_text()}})
    with Path(path).open("rb") as stream:
        reader = c2pa.Reader(MIME[Path(path).suffix.lower()], stream, context=ctx)
        failures = [f["code"] for f in (reader.get_validation_results() or {}).get("activeManifest", {}).get("failure", [])]
        return reader.get_validation_state(), failures, reader.get_active_manifest()


def make_keys(directory):
    import datetime
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID, ObjectIdentifier

    directory = directory.expanduser().resolve()
    if directory == REPO or REPO in directory.parents:
        raise SystemExit("Las claves no se guardan dentro del repositorio.")
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    pem = lambda cert: cert.public_bytes(serialization.Encoding.PEM)
    private = lambda k: k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    now = datetime.datetime.now(datetime.timezone.utc)
    ca_key_file, ca_file = directory / "ca-key.pem", directory / "ca.pem"
    ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, ARTIST + " · CA de procedencia"), x509.NameAttribute(NameOID.ORGANIZATION_NAME, ARTIST), x509.NameAttribute(NameOID.COUNTRY_NAME, "ES")])
    # La CA no se sustituye nunca: la publicada en classic/data tiene que seguir valiendo.
    if ca_key_file.exists():
        ca_key = serialization.load_pem_private_key(ca_key_file.read_bytes(), None)
        ca = x509.load_pem_x509_certificate(ca_file.read_bytes())
        print(f"CA existente: {ca_file}")
    else:
        ca_key = ec.generate_private_key(ec.SECP256R1())
        ca = (x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name).public_key(ca_key.public_key())
              .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5)).not_valid_after(now + datetime.timedelta(days=365 * 20))
              .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
              .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
              .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
              .sign(ca_key, hashes.SHA256()))
        ca_key_file.write_bytes(private(ca_key))
        ca_key_file.chmod(0o600)
        ca_file.write_bytes(pem(ca))
        print(f"CA nueva: {ca_file}")
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "naroagutierrezgil.com"), x509.NameAttribute(NameOID.ORGANIZATION_NAME, ARTIST), x509.NameAttribute(NameOID.COUNTRY_NAME, "ES")])
    # Perfil de certificado de C2PA: firma digital, protección de correo o firma de documentos, sin ser CA.
    leaf = (x509.CertificateBuilder().subject_name(name).issuer_name(ca.subject).public_key(key.public_key())
            .serial_number(x509.random_serial_number()).not_valid_before(now - datetime.timedelta(minutes=5)).not_valid_after(now + datetime.timedelta(days=365 * 3))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.EMAIL_PROTECTION, ObjectIdentifier("1.3.6.1.5.5.7.3.36")]), critical=False)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
            .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
            .sign(ca_key, hashes.SHA256()))
    (directory / "key.pem").write_bytes(private(key))
    (directory / "key.pem").chmod(0o600)
    (directory / "chain.pem").write_bytes(pem(leaf) + pem(ca))
    CA_CERT.write_bytes(pem(ca))
    print(f"Certificado de firma hasta {leaf.not_valid_after_utc:%Y-%m-%d}: {directory / 'chain.pem'}")
    print(f"Clave de firma: {directory / 'key.pem'} (no sale de esta máquina salvo a las variables de Vercel)")
    print(f"CA publicada: {CA_CERT.relative_to(REPO)}")


def read(paths):
    for path in paths:
        state, failures, manifest = validate(path)
        print(f"{path}: {state}" + (f" · fallos: {', '.join(failures)}" if failures else ""))
        if not manifest:
            continue
        info = manifest.get("signature_info", {})
        print(f"  firma: {info.get('common_name')} · emisor: {info.get('issuer')}")
        print(f"  obra: {manifest.get('title')}")
        for assertion in manifest.get("assertions", []):
            if assertion["label"].startswith("c2pa.actions"):
                print("  acciones: " + ", ".join(a["action"] for a in assertion["data"]["actions"]))
            if assertion["label"] == "cawg.training-mining":
                print("  entrenamiento: " + ", ".join(f"{k}={v['use']}" for k, v in assertion["data"]["entries"].items()))
        for ingredient in manifest.get("ingredients", []):
            print(f"  fuente: {ingredient.get('title')}" + (f" — {ingredient['description']}" if ingredient.get("description") else ""))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    keys = sub.add_parser("claves", help="crea la CA (si falta) y un certificado de firma nuevo")
    keys.add_argument("--dir", type=Path, default=KEY_DIR)
    reader = sub.add_parser("leer", help="enseña el manifiesto y lo valida contra la CA publicada")
    reader.add_argument("paths", nargs="+", type=Path)
    args = parser.parse_args()
    if args.command == "claves":
        make_keys(args.dir)
    else:
        read(args.paths)
    sys.exit(0)
