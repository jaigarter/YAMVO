# GROOVE LAB — Sound Library: inventario y plan

> Estado (25-11-2026): **A, B y D integrados** — 24 paquetes, 11,2 MB, 23 presets sampleados + 25 percusiones.
> C (GeneralUser GS) descartado por la duda de procedencia; D (MIT) cubre los mismos instrumentos.
> E (Freesound) pendiente de red + clave API.
> Pipeline: `python3 -I scripts/sound-packs/build_packs.py <descargas> .` → `public/packs/<id>.mp3` + `.json`
> (un "sprite" por instrumento; la app lo decodifica una vez y lo trocea en zonas, con capas de velocidad).

---

## 1. Qué hay ya (fase 1, sin descargas)

| Prioridad | Instrumento | Implementación actual | Calidad para UKG/House |
|---|---|---|---|
| 3 | Drum kits 808 / 909 | 30 voces sintetizadas (circuitos estilo 808/909) renderizadas a buffers con `OfflineAudioContext` | Alta — es como se hacen estas cajas originalmente |
| 4 | UK Garage kits | Kit "UK Garage 2-Step" y "Speed Garage 4x4" sintetizados | Alta |
| 5 | Kicks, snares, claps, hats, shakers | 5 kicks, 4 snares, 4 claps, 3 rims, 6 hats, 2 shakers, 6 percusiones, ride | Alta |
| 6 | Deep Sub, Reese | Motor de voces nativo (saw/square/sine, unison, filtro 24 dB, glide) — 7 presets de bajo | Alta — los bajos de estos géneros son sintéticos |
| 2 | Organ | Órgano drawbar aditivo (9 drawbars, percusión armónica, rotary) — 4 presets | Alta |
| 1 | Electric piano | FM "Tine EP" (cuerpo + tine, trémolo estéreo) | Media-alta; un Rhodes muestreado será mejor |
| 2 | House piano | FM "House Keys" | **Media — necesita samples** |
| 1 | Piano acústico | — | **Falta — necesita samples** |
| 7 | Pads, plucks, leads | 9 presets sintéticos (pads, plucks, leads, poly, arp, atmósfera) | Alta |
| 8 | Vocal chops / atmósferas | Importación de audio propio → pista Sampler cromática | **Falta contenido — necesita fuente con licencia** |

---

## 2. Inventario propuesto de recursos externos

Todos los tamaños son de descarga. "Integrado" = lo que se añadiría al repositorio tras procesarlo (multisamples comprimidos, carga perezosa).

| # | Recurso | Instrumentos que aporta | Formato origen | Tamaño origen | Integrado (est.) | Licencia | Atribución obligatoria | Verificado |
|---|---|---|---|---|---|---|---|---|
| A | **Salamander Grand Piano V2** — Alexander Holm (Yamaha C5) · subconjunto de Tone.js en `github.com/Tonejs/audio/salamander` | Piano acústico (prioridad 1) | MP3, 30 zonas en terceras menores A0–C8, 1 capa de velocidad | ~2,1 MB (61–79 KB/zona, comprobado) | ~2,1 MB | **CC BY 3.0** | Sí: "Salamander Grand Piano by Alexander Holm, CC BY 3.0" | Licencia leída en `salamander/README` del repo; URLs accesibles (HTTP 200) |
| B | **jRhodes3c** — Jeff Learman (Rhodes Mark I Stage 73, 1977) · `github.com/sfzinstruments/jlearman.jRhodes3c` | Rhodes (prioridad 1) | SFZ + FLAC 16-bit, 67 samples, 5 capas de velocidad, loops | ~16 MB | ~3–4 MB (2–3 capas, transcodificado) | **CC BY 4.0** para distribución en apps | Sí: "samples from jRhodes3d — github.com/sfzinstruments/jlearman.jRhodes3d" en créditos | README leído; licencia explícita para software |
| C | **GeneralUser GS v2.0.3** — S. Christian Collins · `github.com/mrbumpy409/GeneralUser-GS` | House piano (Bright/Electric Grand), E.Piano 2, órganos GS, Warm Pad, Polysynth, Choir Aahs / Voice Oohs, strings, synth brass, kits extra | SF2, 261 presets + 13 kits | 32,3 MB (comprobado) | ~1,5–3 MB por preset renderizado; ~12 MB para 6–8 presets | **GeneralUser GS License v2.0** (uso libre, incluido comercial; modificar y reempaquetar permitido) | Recomendada; el autor pide no enlazar directamente sus descargas | Licencia leída. ⚠️ El autor indica que no puede garantizar al 100 % el origen de todos los samples |
| D | **FluidR3Mono_GM** — Frank Wen / Michael Cowgill · repo MuseScore (tag 3.6.2) | Alternativa/complemento a C (pianos, pads, coros) | SF3 (Ogg comprimido) | 23,7 MB (comprobado) | igual que C, por preset | **MIT** (FluidR3 → FluidR3Mono → MS_General) | Sí: avisos de copyright en derivados | `FluidR3Mono_License.md` leído |
| E | **Freesound** — archivos individuales | Vocal chops, atmósferas, foley, one-shots extra | WAV/FLAC/MP3 | variable | ~5–10 MB curados | Solo **CC0** (filtrado por licencia, archivo a archivo) | No (CC0), se registra autor y URL igualmente | ⛔ `freesound.org` bloqueado por la red de este entorno y la API requiere clave |

### Descartados

| Recurso | Motivo |
|---|---|
| Musyng Kite, FatBoy (pre-renders de gleitz) | CC BY-**SA** 3.0: la cláusula ShareAlike se extendería a derivados |
| Pre-render de FluidR3 de gleitz | Etiquetado como CC BY 3.0, en conflicto con la licencia MIT original → se renderiza desde la fuente MIT (D) |
| Packs "free 808/909" de webs de samples | Origen incierto (muestreos de máquinas comerciales, redistribución no autorizada) |
| Packs comerciales (Splice, Loopmasters, Sample Magic…) | Licencias no redistribuibles |

---

## 3. Motor de reproducción: evaluación

| Opción | Pros | Contras | Decisión |
|---|---|---|---|
| **SF2 completo en el navegador** (`spessasynth_lib` 4.x, Apache-2.0, AudioWorklet) | Fidelidad total (moduladores, capas), cambio de preset instantáneo | Carga el SF2 entero en memoria (32–148 MB); grafo propio fuera de Tone → mixer por pista y export offline más complejos; dependencia pesada | No para v1 |
| **Pipeline en build: SF2/SFZ → multisamples comprimidos + `manifest.json`** (FluidSynth CLI + ffmpeg, ya disponible) | Descargas de 1–3 MB por instrumento, carga perezosa por preset, Cache Storage offline, mismo mixer/efectos/export que el resto | Se pierden moduladores SF2 en tiempo real (se recrean envolvente/filtro en el Sampler) | **Recomendado** |

Lo que ya está implementado para recibirlo:

- `src/library/samplePacks.ts` — formato de pack (`public/packs/<id>/manifest.json` + zonas), carga perezosa y caché en Cache Storage.
- `src/instruments/SamplerInstrument.ts` — multisample sobre `Tone.Sampler`, con attack/release, filtro, transposición y nivel; tocable por MIDI, secuenciador y piano roll.
- `src/library/licenses.ts` + `CREDITS.md` — registro obligatorio de licencia y atribución por recurso.

Plan de procesado por instrumento: zonas cada 3 semitonos (A0–C8), 2 capas de velocidad donde la fuente las tenga, 44,1 kHz, recorte de silencios, normalización por capa, codificación AAC 160 kbps (`.m4a`, compatible con Chrome/Safari/Firefox) y manifest con licencia.

---

## 4. Tamaño total estimado

| Paquete | Integrado |
|---|---|
| Piano acústico (A) | 2,1 MB |
| Rhodes (B) | 3–4 MB |
| GeneralUser GS: House Piano, E.Piano 2, Perc Organ, Warm Pad, Choir, Voice Oohs (C) | ~12 MB |
| Vocal chops / atmos CC0 (E, si se habilita) | 5–10 MB |
| **Total** | **~22–28 MB**, nada se descarga en el navegador hasta que se usa el preset |

---

## 5. Lo que se necesita para continuar

1. **Aprobación** de las fuentes A–D (o subconjunto).
2. Para **vocal chops (E)**: permitir `freesound.org` en la red del entorno y una API key de Freesound, *o* aportar grabaciones propias (ya se pueden importar en Library → Import audio → "Sampler track").
3. Confirmar si se acepta el aviso de procedencia de GeneralUser GS (C); si no, se usa FluidR3Mono (D, MIT) para los mismos presets.
