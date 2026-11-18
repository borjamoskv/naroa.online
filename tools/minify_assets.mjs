// Minifica en su sitio los scripts y hojas de estilo del museo ya compilados.
// Lo llama build_immersive_site.py al final, después de las traducciones (build_i18n.py
// sustituye literales de los scripts publicados y necesita leerlos tal cual).
// Usa el minificador de JS (oxc, vía rolldown) y lightningcss que ya trae Vite: no añade dependencias.
// Uso: node tools/minify_assets.mjs <archivo>…  → imprime «antes después» por archivo.
import { createRequire } from 'node:module';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(realpathSync(path.join(repo, 'node_modules/vite/package.json')));
const { minifySync } = await import(req.resolve('rolldown/utils'));
const css = await import(req.resolve('lightningcss'));

let failed = false;
for (const file of process.argv.slice(2)) {
  const source = readFileSync(file);
  let code;
  if (file.endsWith('.css')) {
    // Sin `targets`: solo comprime, no reescribe la sintaxis para otros navegadores.
    code = Buffer.from(css.transform({ filename: path.basename(file), code: source, minify: true }).code);
  } else {
    // Scripts clásicos (no módulos): los nombres de nivel superior no se tocan.
    const result = minifySync(path.basename(file), source.toString(), { module: false, compress: true, mangle: { toplevel: false } });
    if (result.errors?.length) {
      console.error(`${file}: ${result.errors.map(e => e.message).join('; ')}`);
      failed = true;
      continue;
    }
    code = Buffer.from(result.code);
  }
  if (code.length < source.length) writeFileSync(file, code);
  console.log(`${path.basename(file)} ${source.length} ${Math.min(code.length, source.length)}`);
}
process.exit(failed ? 1 : 0);
