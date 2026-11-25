# GROOVE LAB

A personal, AI-ready electronic music studio for **UK Garage, House and Deep House** — running entirely in the browser.

Tracks, clips, MIDI notes, instruments and mixer settings are all editable data: nothing is a closed audio file.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Open the app, press **Space** (or ▶) and the 16-bar UK Garage demo plays. *Projects → New empty project* starts from scratch.

## What works today

- **Studio** — multitrack timeline with looping clips, loop region, BPM, swing (MPC-style), time signature, key/scale.
- **Step sequencer** for drums (paint, accents) and **piano roll** for everything (draw, move, resize, velocity lane, marquee, scale highlighting, diatonic chord drawing, quantize, undo/redo).
- **Instruments** — 5 synthesized drum kits (UKG 2-step, 909, 808, Deep House, Speed Garage) with 30 voices; 24 bass/keys/synth presets (sub, garage bass, Reese, organ bass, FM e-pianos, drawbar organs, chord stabs, pads, plucks, leads, atmosphere); a sampler for your own sounds. Every parameter is editable.
- **Mixer** — volume, pan, 3-band EQ, filter, compressor, reverb/delay sends, master bus with glue compression and limiter. All real DSP.
- **✦ Producer** — one-click genre generators (free, offline) and Claude on claude.ai (uses your account): grooves, basslines, chords, hooks, song structure, proposed as Keep/Discard.
- **Sounds** — 52 instruments: synthesized drums/basses/synths plus sampled grand piano, Rhodes, house piano, mallets, guitars, strings, brass, sax, choirs and world percussion (see CREDITS.md).
- **Library** — searchable by name, type and genre; preview; favourites; import your own audio; drag sounds onto drum pads.
- **Play live** with a MIDI controller (Web MIDI) or the computer keyboard (A–; row, Z/X octave).
- **Save/restore** automatically in IndexedDB; **export WAV** (16/24-bit) rendered offline with the same engine you hear.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm test` | Unit tests (swing, scheduler, theory, WAV encoder) |
| `npm run test:e2e` | Headless Chromium: renders every preset and drum voice, plays in realtime, drives the UI, exports a WAV and checks it is real audio |

## Docs

- [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md) — architecture, data model, audio-engine risks, phases.
- [`docs/SOUND_LIBRARY.md`](docs/SOUND_LIBRARY.md) — sound library inventory, licences and plan.
- [`CREDITS.md`](CREDITS.md) — licences and attributions.
