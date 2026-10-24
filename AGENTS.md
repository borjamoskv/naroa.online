# C5-REAL Governance & Agentic Rules

Importing root workspace AGENTS.md governance.
See [Workspace AGENTS.md](file:///Users/borjafernandezangulo/10_PROJECTS/.agents/AGENTS.md)

---

## Invariantes Operativas de Catálogo y Recorrido Inmersivo (naroa.online)

### 1. Sincronización Atómica 1:1 de Catálogo (INV_CATALOG_SYNC_1TO1)
Toda incorporación o modificación de una obra en el catálogo exige actualización simultánea e isomorfa en tres capas:
1. `classic/data/catalogo.json`: Registro maestro con metadatos (`slug`, `title`, `year`, `technique`, `dimensions`, `description`).
2. `classic/data/journey.json`: Secuencia de la cámara inmersiva. Se exige invariablemente:
   - Paridad estricta: `[scene["slug"] for scene in journey["scenes"]] == [p["slug"] for p in projects]`.
   - `hold: 25` (0.25 s) en todas las escenas no-hero (la primera escena hero fija `hold: 45`).
   - Modos de cámara válidos (`F`, `Z`, `V`).
3. `src/artworks.ts`: Registro TypeScript en el sótano/laboratorio.
   - El atributo `category` está estrictamente restringido al tipo canónico `'rocks' | 'divinos' | 'kintsugi' | 'drawing'` (no usar `'iconos'` ni etiquetas no contempladas en el union type).

### 2. Paridad con la Suite de Pruebas JSDOM (`test_immersive_dom.cjs`)
- La suite valida la secuencia completa de modos (`entry.mode`) y el número total de obras (actualmente 86).
- Al mutar o extender el recorrido terminal (ej. transiciones `dustin` $\to$ `game-over`), es imperativo actualizar la cadena esperada de modos en la aserción de `tools/test_immersive_dom.cjs` (ej. sufijo `Z F`) antes de dar por buena la verificación.

### 3. Arquitectura de Audio y Sintetizadores de Evento
- Los efectos sonoros reactivos o sintetizadores generativos (ej. sintetizador chiptune 8-bit NES 2A03) deben residir en `classic/immersive/soundscape.js` desacoplados del loop ambiental general.
- Deben contar con guardas de ciclo de vida (`AudioContext` suspendido o no interactuado) para no emitir excepciones en navegadores con políticas estrictas de autoplay o en pruebas headless.

### 4. Transiciones de Ruptura de Fase (Glitch) y Bucle Ouroboros
- Las transiciones terminales entre obras de clímax emplean efectos de ruptura controlada: aberración cromática RGB (`#ff0055` / `#00f0ff`), jitter horizontal en silicio y scanlines CSS.
- La obra terminal debe incorporar un control o disparador explícito que cierre el bucle infinito hacia el origen (`change(0)`), manteniendo la coherencia de la experiencia inmersiva.

### 5. Invariante Acústica Awwwards & Tonalidad Cálida (INV_WARMTH_ACOUSTIC_GATE)
Toda síntesis procedural o reactiva generada por Web Audio API en el sitio web debe cumplir rigurosamente:

1. **Veto a Ruidos Blancos y Asperezas de UI:**
   - Prohibido el uso de buffers de ruido blanco aleatorio para emular fricción táctil o deslizamiento (`playHapticSlide`). Las respuestas hácticas deben ser impulsos sub-graves senoidales redondos o permanecer en silencio para no ensuciar el espectro.

2. **Timbre Cálido Analógico (Estética Aphex Twin / Boards of Canada):**
   - **Registro Grave-Medio:** Las notas melódicas deben sintetizarse una octava por debajo de la afinación estándar de caja de música (`midiNote - 12`, rango `146 Hz – 440 Hz`, Re3 a La4), eliminando parciales metálicos y registros chillones.
   - **Ataque de Fieltro y Filtro de Seda:** Envolventes de ataque suave (`30 ms – 50 ms`, cero clics o pops transitorios), caídas largas (`1.8 s – 2.4 s`) y filtros paso-bajo analógicos (`Q ≤ 0.5`, frecuencias de corte entre `340 Hz` y `860 Hz`, y bus maestro filtrado a `1450 Hz`).
   - **Deriva de Cinta Magnética (*Tape Wow*):** Micro-deriva sutil de tono (`±2.8 cents`) y mezclas de osciladores senoidales con pads triangulares suaves.

3. **Arquitectura Melódica Semanal y Cadencia Sagrada:**
   - **7 Temas Canónicos:** Existencia obligatoria y paritaria de 7 motivos modales (Lunes a Domingo) que evocan el repertorio vasco y clásico contemporáneo (*Txoria Txori*, *Haurtxo Polita*, *Harria eta Marea*, *Alboka pastoral*, *Mi Gran Noche*, *Gaua*, *Haizea*).
   - **Cadencia Inmutable de Sound of Silence:** Todo ciclo de 32 pasos debe concluir obligatoriamente en los pasos 24..31 con el motivo icónico de *The Sound of Silence* en Re menor.
   - **Cláusula de Silencio en `Game Over`:** La obra terminal `game-over` (y cualquier estado de desenlace) exige silencio contemplativo absoluto; queda estrictamente prohibido disparar jingles arcade o sintetizadores 8-bit.

4. **Prevención de Saturación y Clústeres Polifónicos:**
   - Todo disparador acústico ligado al scroll debe contar con una guarda temporal mínima de `100 ms – 115 ms` para evitar el apilamiento caótico de voces al navegar a alta velocidad.
