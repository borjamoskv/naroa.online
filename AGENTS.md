# naroa.online · Reglas para agentes (C5-REAL)

Este archivo lo leen los agentes de IA al empezar cada sesión. Recoge lo que no se deduce del código: cómo trabajar en el repositorio y las invariantes del portfolio (§1–§9). Al cambiar un comportamiento descrito aquí, se actualiza este archivo en el mismo cambio.

Gobernanza general de la carpeta de proyectos: [Workspace AGENTS.md](file:///Users/borjafernandezangulo/10_PROJECTS/.agents/AGENTS.md). No se carga sola; hay que abrirla. Lo que más pesa aquí: no borrar, mover ni reescribir historial sin autorización explícita; cambios acotados y con el diff revisado; ninguna afirmación de éxito sin una ejecución concreta que la respalde.

---

## Cómo trabajar en este repositorio

### Dos superficies
- **El museo (portfolio inmersivo):** fuentes en `classic/` (`data/` y `immersive/app.js`, `app.css`, `soundscape.js`, `journey.js`). `tools/build_immersive_site.py` lo genera en `.deploy/`, que es lo que publica Vercel (`vercel.json`). Casi todo este archivo habla de él.
- **El lab (SPA 3D):** fuentes en `src/`, compilado por Vite en `dist/`. Comparte el catálogo (§1), no el audio (§3).

### Compilar y probar
- `pnpm run build:site` genera `.deploy/` (tarda varios minutos: optimiza todas las imágenes). Los scripts y hojas de estilo salen con hash en el nombre, así que un cambio en `classic/immersive/` no se ve hasta recompilar.
- `pnpm run test:site` comprueba las fuentes del catálogo, el sitio generado y la suite JSDOM. Las dos últimas leen `.deploy/`: primero hay que compilar.
- `pnpm test` añade lint y tipos.
- El `pre-commit` (lefthook) pasa `detect-secrets`; si no está instalado, el commit se aborta.

### Varias sesiones a la vez (observado el 2026-11-11)
- Suele haber varias sesiones editando los mismos archivos y recompilando `.deploy/`. Alguna confirma instantáneas «CONJUNTO: …» que arrastran cambios ajenos a medio hacer.
- Editar con sustituciones acotadas, nunca reescribiendo entero un archivo compartido. Antes de confirmar, mirar `git status` y `git diff` y preparar solo los trozos propios.
- Para verificar sin pisar a nadie: `python3 tools/build_immersive_site.py --output <carpeta temporal>`. `tools/check_immersive_site.py` acepta el mismo `--output`; `tools/test_immersive_dom.cjs` tiene la salida fija en `.deploy`, así que se ejecuta una copia temporal con la línea `const output = …` cambiada y se borra después.
- No cambiar de rama en el árbol compartido: mueve también a las demás sesiones.

### Subir es desplegar
- Cada `git push` a `origin/master` lanza un despliegue de producción en Vercel (observado el 2026-11-11). Compila en remoto con `./deploy.sh --build-only` desde el commit, no desde el árbol de trabajo. Avisar antes de subir.
- No sondear el dominio público en bucle: activa el control anti-bots de Vercel. El estado se mira con `npx vercel ls` y `npx vercel inspect <url>`.

---

## Invariantes Operativas de Catálogo, Audio y Recorrido Inmersivo (`naroa.online`)

| Si tocas… | Lee antes |
| --- | --- |
| Una obra, `catalogo.json`, `journey.json` o `src/artworks.ts` | §1, §2 |
| `soundscape.js` o cualquier sonido | §3, §5 |
| Transiciones entre obras, el final del recorrido o `Game Over` | §4, §7c |
| Story, compartir o el retrato de la visita | §6, §8.4 |
| El retrato inicial (umbral) | §7 |
| La interfaz de la galería o la lupa | §7b, §7d |
| `/sobre-mi/`, `/trayectoria/` o las tarjetas sociales | §8 |
| Cualquier texto visible o ruta interna en `app.js` | §9 |
| `/contacto/`, la hoja de la nota o el humo del cursor | §10 |

### 1. Sincronización Atómica 1:1 de Catálogo (`INV_CATALOG_SYNC_1TO1`)
Toda alta o mutación de obra exige paridad simultánea en 3 capas:
1. `classic/data/catalogo.json`: Metadatos maestros (`slug`, `title`, `year`, `technique`, `dimensions`, `description`).
2. `classic/data/journey.json`: Secuencia de cámara (`[s["slug"] for s in scenes] == [p["slug"] for p in projects]`), `hold: 45` en hero inicial y `hold: 25` en el resto, modos `V | H | Z | E | P | F`, cada uno con su duración en `durations`.
3. `src/artworks.ts`: Registro TypeScript con `category` restringido a `'rocks' | 'divinos' | 'kintsugi' | 'drawing'`.

**Control (`tools/check_catalog_sources.py`, dentro de `npm run test:site` y al empezar `deploy.sh`):**
- El catálogo público son las obras de `catalogo.json` más las de `classic/data/vaivenes.json` que no estén ya en él; el recorrido debe cubrir exactamente ese conjunto, sin slugs repetidos.
- Falla también si una redirección de `vercel.json`, un `target` del recorrido o una exposición apunta a una obra inexistente.
- **Ningún recuento de obras se escribe a mano.** El `index.html` de la SPA usa `%OBRAS_TOTAL%`, que rellena `vite.config.ts` desde los mismos datos.
- El registro de la SPA arrastra una deuda anotada en el propio control (obras fuera de catálogo, dos sin registrar y un slug repetido): no puede crecer, y al resolver una entrada se borra de la lista.

**Caché:** `immutable` solo para archivos con versión en el nombre (hash de 12 cifras o sufijo `-vN`). `tools/check_immersive_site.py` falla si una regla de `vercel.json` se lo da a cualquier otro.

### 2. Paridad con Suite JSDOM (`test_immersive_dom.cjs`)
- Valida la secuencia exacta de modos (`entry.mode`) y que el total de obras coincide con el del manifiesto de la compilación (`immersive/build-manifest.json`): la cifra no va escrita en el test. Actualizar la cadena esperada en `tools/test_immersive_dom.cjs` ante cualquier mutación del recorrido.

### 3. Arquitectura de Audio y Guardas de Ciclo de Vida
- El portfolio inmersivo suena con un único motor: `classic/immersive/soundscape.js`. Contiene la banda sonora, doce piezas originales, una por mes (`window.NAROA_SCORE`), y su conexión con la web (`window.NAROA_SOUND.frame`). Es síntesis pura Web Audio: no descarga muestras ni crea `AudioContext` antes de un gesto del visitante.
- La música se funde al ocultar la pestaña y vuelve al regresar; si el visitante la paró, no vuelve sola.
- `src/utils/audio.ts` pertenece a la SPA y conserva su propio motor.

### 4. Transiciones de Ruptura (Glitch) y Bucle Ouroboros
- Las transiciones terminales emplean aberración cromática RGB (`#ff0055` / `#00f0ff`), jitter horizontal y scanlines CSS, cerrando el bucle hacia el origen (`change(0)`).
- **Final en `Game Over`:** a los `1,6 s` de llegar, la escena funde a negro con el monigote bailando y, `2,8 s` después, rebobina sola al origen. Sin efectos de movimiento no ocurre.
- **Huevo `CONTINUE?`:** tres `Enter` seguidos (o tres toques al título) sobre `Game Over` cancelan ese rebobinado y muestran, en la línea de interfaz sobre «INSERT COIN» y nunca encima de la obra, un enlace de texto a `github.com/borjamoskv` con cuenta atrás de 9 a 0; al agotarse, vuelve al origen. Es solo imagen: no rompe el silencio de §5.5. Se crea en `app.js` (`insertCoin`) y no figura en el HTML generado. Sin efectos de movimiento no hay cuenta atrás ni vuelta forzada.

### 5. Invariante Acústica de la Banda Sonora (`INV_WARMTH_ACOUSTIC_GATE`)
1. **Una pieza cada mes, sin tarjeta:** hay doce piezas originales, tituladas con el mes en euskera (`Urtarrila`, `Otsaila`, `Martxoa`, `Apirila`, `Maiatza`, `Ekaina`, `Uztaila`, `Abuztua`, `Iraila`, `Urria`, `Azaroa`, `Abendua`). El botón SONIDO enciende y apaga la del mes en curso según el reloj del visitante. No hay tarjeta visual, selector de temas ni efectos sonoros por obra; para escuchar otra pieza al revisar existe `?mes=1` … `?mes=12`.
   - «Apirila» es la partitura original, nota a nota. Las otras once se escriben por grados sobre la escala del mes (`compose` en `soundscape.js`): cada una tiene tonalidad, figura de mano izquierda, melodía, puente con trombones y paisaje propios.
2. **Timbre cálido, húmedo y humano:**
   - Piano de casa en Do mayor a 96 pulsos por minuto en reposo, filtro general a `2000 Hz`, refuerzo de graves y ataque blando.
   - Sala larga y oscura, eco de cinta, delays cruzados a tempo (corchea con puntillo y negra), un eco en tresillo de negra y otro lejano a blanca con puntillo, phaser lento y deriva de cinta.
   - Microfallos de mano aleatorios: dudas, notas fantasma, teclas vecinas rozadas, corcheas perdidas y tempo que deriva.
   - **Cero ruido blanco:** fieltro, pedal y aire de sala usan ruido pardo filtrado.
3. **Forma:** las doce comparten forma: entrada, A, A en eco, B (puente con tres trombones que deslizan entre acordes), A de regreso y cierre; después repite sin la entrada.
4. **Mano derecha en reposo por defecto:** la intensidad inicial y de reposo es `0.31`, por debajo del umbral `0.35` en el que entra la melodía. La melodía del mes despierta solo cuando el visitante hace scroll (`NAROA_SCORE.wake`): entra suave, crece con la velocidad y, unos `2.5 s` después de parar, se retira apagándose hasta `0.31`.
5. **Silencio en `Game Over`:** la obra `game-over` exige silencio contemplativo absoluto; `NAROA_SOUND.frame` calla la pieza y el paisaje mientras está en pantalla.
6. **Pulso que sigue al scroll:** `NAROA_SOUND.frame` recibe la velocidad del scroll (`velocity`, en alturas de pantalla por segundo) desde la cámara de la galería y desde las páginas editoriales, y fija la meta del pulso con `NAROA_SCORE.setPace`. Si el aviso trae `distance`, la velocidad se mide como distancia recorrida entre avisos con el reloj real, para que no dependa de los fotogramas por segundo.
   - Parado: `96`. Paseo lento y sostenido (≈ 0,2–0,5 alturas/s): se serena hasta `84`. Scroll rápido (≥ 3 alturas/s): aprieta hasta `116`. Solo cuenta la magnitud, no la dirección, promediada en un cuarto de segundo; un salto de golpe (> 40 alturas/s) no es un gesto.
   - El pulso se acerca a su meta corchea a corchea (como mucho un 3 % entre corcheas) y solo decide la distancia a la nota siguiente: nunca reprograma notas ya lanzadas. Se suma a la deriva humana del tempo, no la sustituye. Los delays no se reafinan: quedan a 96.
   - Sin noticias del scroll durante `0.6 s` vuelve solo a 96. No reacciona con el sonido apagado, sin efectos de movimiento (`mode: 'still'`, `prefers-reduced-motion`) ni en `Game Over`.
   - Con el pulso cambia la mano: al apretar toca con más decisión, más seco y con menos balanceo, y los ecos se recogen; al serenarse toca más suave y ligado, y los ecos se abren. La calma exige un paseo lento sostenido cerca de un segundo: la cola de un gesto rápido no frena la pieza.
7. **Espacio al estilo Portal, todo sintetizado:** el piano queda delante y sin colorear; los cuatro ecos a tempo y el paisaje del mes rodean al oyente en 3D (`PannerNode` HRTF, con estéreo simple como alternativa), derivan solos muy despacio y giran hacia donde va el scroll (`NAROA_SCORE.setTurn`).
   - El paisaje de cada mes (viento, lluvia o sirimiri, mar, brasas) sale del mismo ruido pardo filtrado; pájaros y grillos son senos. No se descarga ninguna grabación. Va por debajo del piano, no pasa por el filtro general de `2000 Hz` y se abre un poco con el movimiento.

### 6. Invariante de Story 9:16 Detail Obsession y Share Limpio (`INV_DETAIL_OBSESSION_STORY_GATE`)
1. **Layout *Detail Obsession* (`1080×1920`):**
   - **Fondo Macro Texturizado:** Zoom `2.6x – 3.0x` descentrado hacia el foco matérico ocupando toda la pantalla para exhibir pinceladas y textura real (`drawStoryZoomedDetail`).
   - **Miniatura PiP Completa:** Tarjeta flotante esquinada con sombra profunda mostrando la obra íntegra sin recorte (`drawStoryMiniature`), garantizando paridad detalle + obra completa.
2. **Share en X/Twitter (`INV_CLEAN_SOCIAL_TITLE`):** El texto de compartición debe emitir exclusivamente el título limpio de la obra (`p.title`, ej. `Game Over`), sin muletillas promocionales ni duplicación de autor.
3. **El retrato de tu visita (`INV_VISIT_PORTRAIT`):** la galería suma cada medio segundo el tiempo que cada obra pasa quieta en pantalla (no el cruce entre dos, ni el retrato del umbral, ni con un diálogo abierto). Vive solo en memoria: no se guarda ni se envía. Tras mirar al menos `3` obras `4 s` cada una, aparece en tres sitios, siempre como texto: una entrada en «Más», una segunda pieza en el diálogo de Story y, en la última obra, un enlace junto a «Compartir recorrido» (allí la de «Más» se retira para no repetirse).
   - **Layout (`1080×1920`, `renderVisitFrame`):** hasta cuatro franjas recortadas a mano, una por obra y tanto más alta cuanto más se miró; cada una es un detalle real con la pieza completa prendida al lado, su título y lo que duró la mirada. Mismo margen seguro que la Story de una obra.
   - **El título va entero:** hasta tres líneas si la franja da para ello y, si no cabe, la letra encoge (hasta `38 px`) antes de cortar con «…». El rótulo del tiempo lleva una sombra ovalada solo detrás, para leerse sobre un detalle claro sin apagar la franja.
   - **Dónde se centra el detalle:** en la zona de la obra (rejilla de 4×4) donde la lupa estuvo más tiempo, no en el último punto por el que pasó; hacen falta `1,5 s` (`VISIT_MIN_LENS`) para que cuente. Sin lupa, a la altura de los ojos (`0.5, 0.42`).
   - El título de la imagen habla quien la comparte («El retrato de mi visita»); la interfaz, a quien visita («de tu visita»).
   - **En el diálogo:** la vista previa se describe (`alt`) con los títulos de las obras del paseo, y el tercer botón pasa a decir «La Story de una sola obra»; al volver a la Story de una obra, ambos recuperan su texto.

### 7. Pureza Visual en Umbral Hero (`INV_HERO_THRESHOLD_PURITY`)
- El retrato inaugural (umbral de estudio, índice `0`) debe mostrarse limpio de superposiciones tipográficas o telemetría flotante (`LA MIRADA`, `UMBRAL DE ESTUDIO`, texto en SVG del monóculo). El umbral no lleva ningún bloque de texto (la antigua `.portrait-hero-copy` ya no existe): el protagonismo es íntegro del retrato.
- **Sin efectos de movimiento el retrato también recibe:** con `prefers-reduced-motion` o «Pausar efectos» el umbral sigue en pantalla, quieto (sin zoom, guiño ni giro del aro), y se disuelve en la primera obra con el scroll. Solo «Solo obra» lo retira.
- **Tocar el retrato es entrar:** mientras el umbral está en pantalla, el clic o toque sobre la escena cruza a la primera obra; no abre la ficha de fotografías de una obra que aún no se ha visto.

### 7b. La Interfaz Desaparece al Contemplar (`INV_INTERFACE_DISSOLVES`)
1. **Ampliación de §7:** la pureza del hero se extiende a toda la galería. Con la obra quieta `CALM_MS = 3200` ms, `body.is-contemplating` retira cabecera, título, recorrido, progreso y velo (`opacity`, sin `inert` ni `display`), dejando solo la obra.
2. **Vuelve con cualquier gesto:** movimiento del puntero (> 6 px), pulsación, rueda, toque, scroll, tecla o foco. Nunca se retira con un diálogo abierto, con foco visible en la interfaz ni en «Solo obra» manual.
3. **Salida siempre accesible:** `Encargos` y `Contacto` están en la cabecera de la galería y siguen en el DOM mientras está retirada; un gesto la devuelve. Con `prefers-reduced-motion` el cambio es instantáneo.

### 7c. Transición Ligada a la Materia (`INV_MATERIAL_TRANSITION`)
1. En el desplazamiento genérico (`H`/`V`), el borde con que llega la obra siguiente sale de su materia (`materialEdge` en `app.js`): `collage` → borde rasgado determinista (hash del `slug`); `pizarra` → borrado de tiza con difuminado; `objetos` → sombra proyectada sobre la obra que se va; técnica con `mica`/`brillantina`/`dorad*`/`kintsugi` → destello dorado; `caracterizacion` → pasada de maquillaje (desenfoque que se asienta).
2. Las transiciones a medida de cada par (ojos, lata, Kintsugi, Game Over…) no se tocan. Todo termina en la obra limpia (`clip-path`, máscara y filtros se reinician cada fotograma).

### 7d. Lupa de Macro (`INV_MACRO_LENS`)
1. Una lente circular (`.art-lens`, `min(30vmin, 240px)`, ×3,2) muestra el original a resolución completa (`photos[0].original`) bajo el puntero, con la obra entera siempre visible detrás. Se enciende con «Lupa» (en «Más») o manteniendo pulsado 0,45 s sin mover; al soltar tras mantener, o con `Esc`, se cierra. Soltar tras mantener no abre el visor de fotos.
2. Solo actúa en reposo o exploración (`stage.dataset.transition` = `hold`/`explore`); en transición se oculta. Calcula la posición sobre la imagen real (recorte `cover`/`contain` y `object-position`), no sobre la caja. Mientras está activa (`body.is-lens`) se retiran título, recorrido y flechas.

### 8. Voz y Citas de «Sobre mí» (`INV_LITERAL_QUOTES`)
1. **Lo que va entre « » lo dijo Naroa:** en `/sobre-mi/`, en el hero de `/trayectoria/` y en las tarjetas sociales, todo texto entre comillas latinas es cita literal de su blog (`naroagutierrez.wordpress.com`). Lo omitido se marca con `[…]`, no se funden ni se recomponen frases, y cada nota manuscrita (`.kintsugi-chasm-spark`) nombra la entrada y el año de donde sale.
2. **Lo que no es cita va en tercera persona y sin « »:** la presentación «En breve», el cierre y la lectura del espejo inverso solo usan datos del archivo (catálogo, `classic/data/exhibitions.json`, página de encargos); las cifras se calculan en el build, no se escriben a mano.
3. **Espejo inverso:** nunca reescribe las dos citas de Naroa. La lectura de la visita (`[data-gaze-reading]`, `[data-gaze-metrics]`) nace oculta y solo aparece tras al menos `8 s` reales con un capítulo en el centro de la pantalla y con uno claramente por delante (al menos 1,25 veces el tiempo del segundo); técnica y soporte de la obra espejo salen del catálogo.
4. **Compartir:** con una obra en pantalla se comparte esa obra con su título limpio (§6.2); sin obra, la propia página con su título completo; desde la 404, la portada.
5. **Tarjetas sociales:** al cambiar el texto o la imagen de una tarjeta se sube su `version` en `create_card`; el build retira la versión anterior.

### 9. Versiones por idioma (`INV_I18N_LAYER`)
1. **El español es la fuente.** Las páginas se escriben en español en `build_immersive_site.py`; `tools/build_i18n.py` las traduce ya generadas y escribe una copia por idioma bajo `/en/…` (inglés) y `/eu/…` (euskera), con las mismas rutas y su prefijo. El generador lo llama al final de `build()`.
2. **Diccionarios:** `classic/data/i18n/en.json` y `eu.json`, con las mismas claves. `strings` va indexado por el texto español tal cual sale en la página (las etiquetas de línea se ven como marcas `<1>…</1>`); `patterns` compone textos repetidos (título + técnica + soporte, fechas, «Ver …»); `js` sustituye literales enteros de `app.js`/`soundscape.js`, con sus `${…}`; `js_keep` lista los que se quedan en español a propósito. Un elemento de línea con `data-i18n-unit="1"` se traduce como frase aparte y no dentro de la que lo rodea (el plazo de encargos bajo «Encargos» en el menú).
3. **Texto nuevo o cambiado:** lo que no tiene traducción sale en español en esa versión. `python3 tools/build_i18n.py extract --lang en|eu --output <compilación> --missing <archivo.json>` lista lo pendiente y `check` falla si queda algo.
4. **No se traducen** los títulos de obra, los nombres de serie (`series` y `category` son además claves de filtro) ni los nombres propios.
5. **Enlaces en `app.js`:** toda ruta interna construida en el script lleva `BASE` delante (`''` en español, `/en` en inglés, `/eu` en euskera).
6. **Idioma de la visita:** cada página lleva `hreflang` y enlaces `ES`/`EN`/`EU` en la cabecera (en móvil, en el pie del menú). La primera visita va al idioma del navegador: euskera al euskera; catalán y gallego al español; cualquier otro que no sea español, al inglés; la elección manual se guarda en `localStorage['naroa-lang']`. Los rastreadores no se redirigen.

### 10. La nota de contacto (`INV_CONTACT_NOTE`)
1. **La obra, sin velo:** en `/contacto/` «Rara Avis» se ve entera. Lo que dice la página va sobre ella con el titular del sistema, en el turquesa del monóculo (`--hero-accent` en `body.page-contacto`); lo que escribe quien visita, en una hoja recortada a mano (`.ct-note`). Sin cajas, píldoras ni rectas: el motivo se rodea con rotulador (`.ct-loop`, un trazo distinto por motivo que dibuja el build), los filetes son trazos y el foco es una pasada de rotulador, no un rectángulo.
2. **Nada sale de la página:** la nota no es un formulario. El motivo rodeado y lo que se escriba componen un mensaje que se abre en el WhatsApp o en el correo de quien visita, o se copia; desde la página no se envía ni se guarda nada, y así lo dice la letra pequeña. Sin JavaScript los enlaces llevan solo el saludo y el renglón para escribir no sale.
3. **Los textos del mensaje viven en el HTML:** el saludo (`[data-contact-hello]`), la frase de cada motivo (`data-say`), el asunto del correo (`data-subject`) y la pista del renglón (`[data-contact-tip]`) se leen del HTML ya traducido; `app.js` no lleva literales para componerlo (§9). «Otra cosa» no añade frase propia.
4. **Humo fuera del papel:** el humo del cursor se funde en «screen» y borraría el texto sobre una superficie clara; no se emite sobre `[data-fluid-quiet]` (la hoja).
5. **Primera pantalla:** la hoja cabe entera en 1440 × 900 y «Enviárselo por WhatsApp» queda a la vista sin scroll desde 360 × 640 (medido el 2026-11-11 en español, inglés y euskera; en 320 × 568 asoma a medias). Al añadir texto a la hoja o cambiar un titular, volver a medirlo. Hasta 1100 px de ancho en vertical la composición se apila, con el rostro arriba; en apaisado estrecho la obra se arrima a la izquierda para que la hoja no tape el rostro.
6. **Vías directas:** una frase con un enlace por vía (`.ct-say [data-contact-way]`) y, debajo, las direcciones a la vista (`.ct-address`), que se encienden por parejas. El recorte del espejo (`.ct-mirror`) es la propia imagen de la obra recortada con CSS; su inscripción, «piensa bien y acertarás», se deja en español en todos los idiomas y el pie la explica. `/naroa-gutierrez-gil.vcf` lleva los mismos datos que la página y se escribe en el build.
7. **Correo:** la página de contacto y los encargos escriben a `encargos@naroagutierrezgil.com` (`contact_mail` en el build); el pie del sitio conserva `naroa@…`.
