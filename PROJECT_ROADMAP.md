# GROOVE LAB — Project Roadmap

> A personal AI-powered electronic music studio. UK Garage · House · Deep House.

Este documento recoge el análisis inicial, la arquitectura, los riesgos del motor de audio, el modelo de datos y las fases de desarrollo. Se actualiza a medida que el proyecto avanza.

---

## 1. Análisis del estado inicial

El repositorio `YAMVO` contenía únicamente un `README.md` vacío. No había código previo, dependencias ni decisiones heredadas: la arquitectura se diseña desde cero.

---

## 2. Arquitectura técnica

GROOVE LAB es una **aplicación web local-first** (todo corre en el navegador, sin servidor). El audio se genera en tiempo real con Web Audio API a través de Tone.js.

```
┌──────────────────────────── UI (React) ────────────────────────────┐
│  Studio · Instruments · Mixer · Library        (solo vista + input) │
└───────────────▲─────────────────────────────────────┬──────────────┘
                │ useStore() (snapshot inmutable)      │ actions
┌───────────────┴─────────────────────────────────────▼──────────────┐
│  State  (store propio, sin dependencias)  — project + UI state       │
│  Las acciones producen un nuevo Project inmutable + historial undo   │
└───────┬───────────────────────────┬──────────────────────┬─────────┘
        │ subscribe(project)        │ autosave              │
┌───────▼─────────┐        ┌────────▼────────┐   ┌──────────▼─────────┐
│  Audio Engine   │        │  Storage        │   │  AI (fase 4)       │
│  - Transport    │        │  IndexedDB      │   │  Claude → JSON     │
│  - Scheduler    │◄──────►│  projects/      │   │  commands → mismas │
│  - Track chains │        │  samples/assets │   │  acciones del store│
│  - Instruments  │        └─────────────────┘   └────────────────────┘
│  - FX / Mixer   │
│  - Offline WAV  │
└─────────────────┘
```

Principios:

1. **El modelo musical es la fuente de verdad.** Un `Project` es JSON puro (serializable, versionado). El motor de audio *lee* el modelo; nunca guarda estado musical propio.
2. **React no contiene lógica musical.** Los componentes llaman a acciones (`state/actions.ts`) y leen snapshots. El motor se sincroniza suscribiéndose al store (`engine/index.ts`).
3. **Scheduler con lectura en vivo.** En cada semicorchea del Transport se consultan las notas del modelo en ese instante. Editar una nota mientras suena se oye en la siguiente vuelta, sin reconstruir `Tone.Part`.
4. **El mismo grafo para tiempo real y exportación.** `ProjectRenderer` construye pistas + efectos + scheduler; se usa tanto en el `AudioContext` en vivo como dentro de `Tone.Offline` para exportar WAV. Lo que oyes es lo que exportas.
5. **La IA es un cliente más.** Claude devolverá comandos JSON validados que se ejecutarán con las mismas acciones de `state/actions.ts` que usa la UI, por lo que todo lo generado será editable y deshacible.

---

## 3. Tecnologías — qué es realmente necesario

| Tecnología | Uso | ¿Necesaria? |
|---|---|---|
| React 19 | Interfaz | Sí |
| TypeScript 5.8 | Tipado del modelo musical y del motor | Sí |
| Vite 6 | Dev server + build | Sí |
| Tone.js 15 | Transport, síntesis, Sampler, efectos, render offline | Sí — evita reescribir clock/scheduling y DSP básico |
| Web Audio API (nativa) | Voces de batería sintetizadas renderizadas a buffers, nodos de bajo nivel | Sí (incluida en el navegador) |
| Web MIDI API (nativa) | Tocar instrumentos desde controladores MIDI | Sí (incluida) |
| IndexedDB (nativa) | Proyectos, samples importados, caché de assets | Sí (wrapper propio de ~60 líneas) |
| Vitest | Tests de modelo, swing, scheduler, codificador WAV | Dev |
| Playwright (preinstalado) | Verificación E2E de que el audio suena realmente | Dev |

Descartado de momento: Redux/Zustand (un store propio con `useSyncExternalStore` es suficiente), librerías de UI (diseño propio), `idb` (wrapper propio), motor SoundFont completo en AudioWorklet (ver §9 y `docs/SOUND_LIBRARY.md`).

Decisión de motor de voces: los sintetizadores usan un motor propio de nodos Web Audio nativos por nota (`instruments/voiceEngine.ts`) en lugar de `Tone.PolySynth`, tras medir que las voces de Tone (con muchos nodos siempre activos) hacían que el render fuera más lento que tiempo real. Tone.js se mantiene para Transport, efectos, Sampler y render offline.

---

## 4. Riesgos principales del motor de audio

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Autoplay policy**: el `AudioContext` empieza suspendido | Sin sonido | `Tone.start()` en el primer gesto del usuario (Play, teclas, click en pad) |
| **Jitter de scheduling** (timers JS en el hilo principal) | Groove inestable — fatal en UKG | Look-ahead de Tone (`context.lookAhead`), eventos programados con tiempo de audio exacto, nunca con `setTimeout` |
| **Swing** aplicado de forma inconsistente entre pistas | Pistas desfasadas | Swing calculado en un único sitio (`sequencer/timing.ts`) para todas las pistas, con tests |
| **Carga de samples pesados** (SoundFonts de 30–150 MB) | Arranque lento, memoria | Multisamples dispersos por instrumento, carga perezosa al usar el preset, Cache Storage, formato comprimido (ver §9) |
| **Polifonía / CPU** (pads con muchas voces + reverbs) | Clicks, dropouts | Límite de voces por `PolySynth`, una reverb/delay compartida por envío (no por pista), voces de batería pre-renderizadas a buffers |
| **Fugas de nodos** al cambiar instrumento/preset | Memoria y CPU crecientes | `dispose()` explícito en cada instrumento/cadena; `ProjectRenderer.sync` diffea por id |
| **Coste de efectos inactivos** (Tone procesa aunque wet = 0) | CPU desperdiciada | `InsertChain`: EQ, filtro, compresor, drive, chorus, etc. solo se conectan cuando están activos (medido: −70 % CPU en proyecto vacío) |
| **Voces pesadas** (cada voz de `Tone.PolySynth` ≈ 20 nodos permanentes) | Polifonía limitada | `voiceEngine.ts`: grafos nativos por nota que se liberan tras el release (medido: 4× menos CPU en acordes FM) |
| **Notas colgadas** al parar o hacer loop | Notas infinitas | `releaseAll()` en stop; notas con duración explícita (`triggerAttackRelease`) |
| **Diferencias tiempo real vs. offline** | Export distinto de lo escuchado | Mismo `ProjectRenderer` en ambos contextos |
| **Reverb por convolución** requiere generar IR (async) | Silencio inicial del envío | `await reverb.ready` antes de reproducir/exportar |
| **Licencias de audio** | Riesgo legal | Solo CC0/CC-BY/MIT/licencias permisivas verificadas; registro en `src/library/licenses.ts` y `CREDITS.md` |

---

## 5. Estructura de carpetas

```
src/
  model/        Tipos del proyecto, fábricas, teoría musical (escalas, acordes), utilidades de tiempo
  sequencer/    timing.ts (swing, beats↔segundos), events.ts (qué suena en cada step)
  engine/       AudioEngine (contexto/master), TrackChain (mixer strip), ProjectRenderer, EngineSync
  instruments/  DrumMachine + voces sintetizadas, SynthInstrument, OrganInstrument, SamplerInstrument, presets
  library/      Catálogo buscable, licencias/atribuciones, samples importados
  storage/      IndexedDB (proyectos, samples)
  export/       Render offline + codificador WAV
  midi/         Web MIDI + teclado QWERTY
  state/        Store, acciones, historial (undo/redo)
  ui/           Componentes React por área (studio, instruments, mixer, library)
docs/           Decisiones técnicas, inventario de sonidos
scripts/        Verificación E2E de audio, pipeline de samples
```

---

## 6. Modelo de datos musical

Unidades: **tiempo en beats** (negras, `number`), una semicorchea = `0.25`. Tono en **MIDI** (`60` = C4). Velocidad `0..1`.

```ts
Project {
  id, name, version, createdAt, updatedAt
  bpm: number                       // 60–200
  timeSignature: [number, number]   // [4, 4]
  key: { root: PitchClass, scale: ScaleName }
  swing: number                     // 50–75 (% estilo MPC; 50 = recto)
  lengthBars: number                // longitud de la canción
  loop: { enabled, startBar, endBar }
  tracks: Track[]
}

Track {
  id, name, color, kind: 'drums' | 'instrument'
  instrument: { type, presetId, params }   // params editables por instrumento
  mixer: { volume(dB), pan, mute, solo, eq{low,mid,high}, filter{type,cutoff,q},
           comp{enabled,threshold,ratio}, sends{reverb,delay} }
  swing: boolean                    // aplica el swing global
  clips: Clip[]
}

Clip {
  id, name
  start: number        // beats en el timeline
  length: number       // beats que ocupa en el timeline
  loopLength: number   // longitud del patrón; se repite dentro de `length`
  notes: Note[]        // relativas al inicio del clip, en [0, loopLength)
}

Note { id, pitch, start, duration, velocity }
```

Las baterías también son notas (mapeo General MIDI: 36 kick, 38 snare, 39 clap, 37 rim, 42 closed HH, 46 open HH, 70 shaker, 64 perc), de modo que el step sequencer y el piano roll son dos vistas del mismo dato y la IA usa un único formato.

---

## 7. Fases de desarrollo

### Fase 1 — MVP (en curso)
- [x] Arquitectura, modelo de datos, store con undo/redo
- [x] Motor: Transport, scheduler con swing, loop, BPM
- [x] Drum machine con kits sintetizados (808, 909, UKG 2-step, Deep House)
- [x] Sintetizadores: sub, Reese, UKG organ bass, pads, plucks, leads, EP FM, órgano drawbar
- [x] Sampler multisample (preparado para la biblioteca de §9)
- [x] Timeline multipista, clips, piano roll, step sequencer
- [x] Mixer con EQ, filtro, compresor, pan, envíos a reverb/delay — procesamiento real
- [x] Guardado/carga en IndexedDB, autosave
- [x] Exportación WAV (render offline)
- [x] Web MIDI + teclado QWERTY
- [x] Biblioteca buscable con licencias, importación de samples propios

### Fase 2 — Biblioteca de sonidos profesional (§9)
- Inventario y aprobación (`docs/SOUND_LIBRARY.md`)
- Pipeline: SoundFont/SFZ → multisamples comprimidos (`scripts/`)
- Piano acústico, Rhodes, House Piano, órgano, pads, vocal chops
- Colecciones y favoritos

### Fase 3 — Arreglo y edición avanzada
- Grabación MIDI en clips, cuantización, automatización de parámetros
- Secciones (intro/drop/break), duplicar/variar, markers
- Sidechain (compresión del bajo con el kick), bus de grupos

### Fase 4 — AI Producer
- Claude API → comandos JSON (`src/ai/`), validación de esquema
- Propuestas aceptables/rechazables por elemento, diff visual, undo
- Generación de grooves, bajos, acordes, variaciones y estructura

### Fase 5 — Pulido
- Rendimiento (AudioWorklet donde aporte), PWA offline, exportación de stems/MIDI

---

## 8. Criterios de calidad

- Ningún control decorativo: si un botón existe, hace algo.
- Todo el audio se verifica: tests unitarios + `npm run test:e2e` (Chromium headless reproduce y exporta, y comprueba que la señal no es silencio, pista por pista).
- `npm run typecheck` y `npm test` sin errores antes de cada commit.

---

## 9. Biblioteca de sonidos

Ver `docs/SOUND_LIBRARY.md`: inventario de instrumentos, fuentes, formatos, tamaños y licencias, y la estrategia de carga. **Ningún recurso externo se descarga hasta que el inventario esté aprobado.**
