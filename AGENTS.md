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
- Sintetizadores reactivos residen en `classic/immersive/soundscape.js` y `src/utils/audio.ts`, desacoplados del loop ambiental y protegidos ante `AudioContext` suspendido o entornos headless.

### 4. Transiciones de Ruptura (Glitch) y Bucle Ouroboros
- Las transiciones terminales emplean aberración cromática RGB (`#ff0055` / `#00f0ff`), jitter horizontal y scanlines CSS, cerrando el bucle hacia el origen (`change(0)`).

### 5. Invariante Acústica Awwwards & Tonalidad Cálida (`INV_WARMTH_ACOUSTIC_GATE`)
1. **Cero Ruido Blanco en UI:** Prohibido usar buffers de ruido blanco en `playHapticSlide`; usar impulsos sub-graves senoidales o silencio.
2. **Timbre Analógico Cálido (Aphex Twin / Boards of Canada):**
   - **Registro Grave-Medio:** Transposición `-12` semitonos (`146 Hz – 440 Hz`, Re3–La4), sin parciales metálicos agudos.
   - **Ataque de Fieltro y Filtro de Seda:** Ataque suave (`30 ms – 55 ms`), caída larga (`1.8 s – 2.4 s`), paso-bajo analógico (`Q ≤ 0.5`, corte `340 Hz – 860 Hz`, master a `1450 Hz`) y deriva *Tape Wow* (`±2.8 cents`).
3. **Ciclo Melódico Semanal y Cadencia:**
   - **7 Temas Canónicos (Lunes–Domingo):** *Landa*, *Haurtxo Polita*, *Harria eta Marea*, *Txoria Txori*, *Mi Gran Noche*, *Gaua*, *Haizea*.
   - **Cadencia Sound of Silence:** Pasos `24..31` cierran siempre con el motivo de *The Sound of Silence* en Re menor.
   - **Silencio en `Game Over`:** La obra `game-over` exige silencio contemplativo absoluto (cero jingles 8-bit).
4. **Anti-Saturación de Scroll:** Guarda mínima de `100 ms – 115 ms` entre notas para evitar apilamiento polifónico.

### 6. Invariante de Story 9:16 Detail Obsession y Share Limpio (`INV_DETAIL_OBSESSION_STORY_GATE`)
1. **Layout *Detail Obsession* (`1080×1920`):**
   - **Fondo Macro Texturizado:** Zoom `2.6x – 3.0x` descentrado hacia el foco matérico ocupando toda la pantalla para exhibir pinceladas y textura real (`drawStoryZoomedDetail`).
   - **Miniatura PiP Completa:** Tarjeta flotante esquinada con sombra profunda mostrando la obra íntegra sin recorte (`drawStoryMiniature`), garantizando paridad detalle + obra completa.
2. **Share en X/Twitter (`INV_CLEAN_SOCIAL_TITLE`):** El texto de compartición debe emitir exclusivamente el título limpio de la obra (`p.title`, ej. `Game Over`), sin muletillas promocionales ni duplicación de autor.

### 7. Pureza Visual en Umbral Hero (`INV_HERO_THRESHOLD_PURITY`)
- El retrato inaugural (umbral de estudio, índice `0`) debe mostrarse limpio de superposiciones tipográficas o telemetría flotante (`LA MIRADA`, `UMBRAL DE ESTUDIO`, texto en SVG del monóculo). `.portrait-hero-copy` permanece oculto (`display: none`) para ceder el protagonismo íntegro al retrato.
