# C5-REAL Governance & Agentic Rules

Importing root workspace AGENTS.md governance.
See [Workspace AGENTS.md](file:///Users/borjafernandezangulo/10_PROJECTS/.agents/AGENTS.md)

---

## Invariantes Operativas de Catálogo, Audio y Recorrido Inmersivo (`naroa.online`)

### 1. Sincronización Atómica 1:1 de Catálogo (`INV_CATALOG_SYNC_1TO1`)
Toda alta o mutación de obra exige paridad simultánea en 3 capas:
1. `classic/data/catalogo.json`: Metadatos maestros (`slug`, `title`, `year`, `technique`, `dimensions`, `description`).
2. `classic/data/journey.json`: Secuencia de cámara (`[s["slug"] for s in scenes] == [p["slug"] for p in projects]`), `hold: 45` en hero inicial y `hold: 25` en el resto, modos `F | Z | V`.
3. `src/artworks.ts`: Registro TypeScript con `category` restringido a `'rocks' | 'divinos' | 'kintsugi' | 'drawing'`.

### 2. Paridad con Suite JSDOM (`test_immersive_dom.cjs`)
- Valida la secuencia exacta de modos (`entry.mode`) y el total de obras (85). Actualizar la cadena esperada en `tools/test_immersive_dom.cjs` ante cualquier mutación del recorrido.

### 3. Arquitectura de Audio y Guardas de Ciclo de Vida
- El portfolio inmersivo suena con un único motor: `classic/immersive/soundscape.js`. Contiene la banda sonora «Apirila» (`window.NAROA_SCORE`) y su conexión con la web (`window.NAROA_SOUND.frame`). Es síntesis pura Web Audio: no descarga muestras ni crea `AudioContext` antes de un gesto del visitante.
- La música se funde al ocultar la pestaña y vuelve al regresar; si el visitante la paró, no vuelve sola.
- `src/utils/audio.ts` pertenece a la SPA y conserva su propio motor.

### 4. Transiciones de Ruptura (Glitch) y Bucle Ouroboros
- Las transiciones terminales emplean aberración cromática RGB (`#ff0055` / `#00f0ff`), jitter horizontal y scanlines CSS, cerrando el bucle hacia el origen (`change(0)`).

### 5. Invariante Acústica de la Banda Sonora «Apirila» (`INV_WARMTH_ACOUSTIC_GATE`)
1. **Una sola pieza, sin tarjeta:** el botón SONIDO enciende y apaga «Apirila». No hay tarjeta visual, selector de temas ni efectos sonoros por obra.
2. **Timbre cálido, húmedo y humano:**
   - Piano de casa en Do mayor a 96 pulsos por minuto en reposo, filtro general a `2000 Hz`, refuerzo de graves y ataque blando.
   - Sala larga y oscura, eco de cinta, delays cruzados a tempo (corchea con puntillo y negra), un eco en tresillo de negra y otro lejano a blanca con puntillo, phaser lento y deriva de cinta.
   - Microfallos de mano aleatorios: dudas, notas fantasma, teclas vecinas rozadas, corcheas perdidas y tempo que deriva.
   - **Cero ruido blanco:** fieltro, pedal y aire de sala usan ruido pardo filtrado.
3. **Forma:** entrada, A, A en eco, B (puente con tres trombones que deslizan entre acordes), A de regreso y cierre; después repite sin la entrada.
4. **Mano derecha en reposo por defecto:** la intensidad inicial es `0.31`, por debajo del umbral `0.35` en el que entra la melodía.
5. **Silencio en `Game Over`:** la obra `game-over` exige silencio contemplativo absoluto; `NAROA_SOUND.frame` calla la pieza mientras está en pantalla.
6. **Pulso que sigue al scroll:** `NAROA_SOUND.frame` recibe la velocidad del scroll (`velocity`, en alturas de pantalla por segundo) desde la cámara de la galería y desde las páginas editoriales, y fija la meta del pulso con `NAROA_SCORE.setPace`.
   - Parado: `96`. Paseo lento y sostenido (≈ 0,2–0,5 alturas/s): se serena hasta `84`. Scroll rápido (≥ 3 alturas/s): aprieta hasta `116`. Solo cuenta la magnitud, no la dirección, promediada en un cuarto de segundo; un salto de golpe (> 40 alturas/s) no es un gesto.
   - El pulso se acerca a su meta corchea a corchea (como mucho un 3 % entre corcheas) y solo decide la distancia a la nota siguiente: nunca reprograma notas ya lanzadas. Se suma a la deriva humana del tempo, no la sustituye. Los delays no se reafinan: quedan a 96.
   - Sin noticias del scroll durante `0.6 s` vuelve solo a 96. No reacciona con el sonido apagado, sin efectos de movimiento (`mode: 'still'`, `prefers-reduced-motion`) ni en `Game Over`.

### 6. Invariante de Story 9:16 Detail Obsession y Share Limpio (`INV_DETAIL_OBSESSION_STORY_GATE`)
1. **Layout *Detail Obsession* (`1080×1920`):**
   - **Fondo Macro Texturizado:** Zoom `2.6x – 3.0x` descentrado hacia el foco matérico ocupando toda la pantalla para exhibir pinceladas y textura real (`drawStoryZoomedDetail`).
   - **Miniatura PiP Completa:** Tarjeta flotante esquinada con sombra profunda mostrando la obra íntegra sin recorte (`drawStoryMiniature`), garantizando paridad detalle + obra completa.
2. **Share en X/Twitter (`INV_CLEAN_SOCIAL_TITLE`):** El texto de compartición debe emitir exclusivamente el título limpio de la obra (`p.title`, ej. `Game Over`), sin muletillas promocionales ni duplicación de autor.

### 7. Pureza Visual en Umbral Hero (`INV_HERO_THRESHOLD_PURITY`)
- El retrato inaugural (umbral de estudio, índice `0`) debe mostrarse limpio de superposiciones tipográficas o telemetría flotante (`LA MIRADA`, `UMBRAL DE ESTUDIO`, texto en SVG del monóculo). `.portrait-hero-copy` permanece oculto (`display: none`) para ceder el protagonismo íntegro al retrato.
