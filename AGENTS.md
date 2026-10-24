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
