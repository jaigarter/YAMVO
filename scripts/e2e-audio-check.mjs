// Verifies in headless Chromium that GROOVE LAB really produces audio:
//  1. offline render of the demo project, per track (solo) → non-silent
//  2. realtime playback → master meter shows signal
//  3. WAV export through the UI (when the UI is present)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';

const PORT = 5199;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => d.toString().includes('Local') && res());
  server.on('exit', rej);
  setTimeout(() => rej(new Error('vite did not start')), 30000);
});
let failed = false;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} ${detail}`);
  if (!ok) failed = true;
};
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => window.__grooveLab && document.querySelector('.topbar'), null, { timeout: 20000 });

  const results = await page.evaluate(async () => {
    const g = window.__grooveLab;
    const { renderProject, peakAndRms } = g.render;
    const base = g.store.getProject();
    const out = {};
    for (const t of base.tracks) {
      const p = structuredClone(base);
      p.tracks.forEach((x) => (x.mixer.solo = x.id === t.id));
      const startBar = t.clips[0] ? Math.floor(t.clips[0].start / 4) : 0;
      const buf = await renderProject(p, { startBar, endBar: startBar + 2, tail: 0.5 });
      out[t.name] = peakAndRms(buf);
    }
    const t0 = performance.now();
    const full = await renderProject(base, { startBar: 0, endBar: 16, tail: 2 });
    out.__full = { ...peakAndRms(full), seconds: full.duration, renderMs: performance.now() - t0 };
    return out;
  });
  for (const [name, r] of Object.entries(results)) {
    if (name === '__full') continue;
    check(`offline render track "${name}"`, r.rms > 0.003, `peak=${r.peak.toFixed(3)} rms=${r.rms.toFixed(4)}`);
  }
  const f = results.__full;
  check('offline render full 16 bars', f.rms > 0.01 && f.peak <= 1.0, `peak=${f.peak.toFixed(3)} rms=${f.rms.toFixed(4)} dur=${f.seconds.toFixed(1)}s render=${Math.round(f.renderMs)}ms`);

  // Realtime playback
  const live = await page.evaluate(async () => {
    const g = window.__grooveLab;
    await g.engine.play(0);
    const levels = [];
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 100));
      levels.push(g.engine.masterLevel());
    }
    const pos = g.engine.position();
    g.engine.stop();
    return { max: Math.max(...levels), pos };
  });
  check('realtime playback master level', live.max > -40, `max=${live.max.toFixed(1)} dBFS, playhead=${live.pos.toFixed(2)} beats after 2s`);
  check('playhead advances at tempo', live.pos > 3 && live.pos < 6, `(${live.pos.toFixed(2)} beats; 132 BPM → ~4.4)`);


  // Every preset and every drum voice must produce real, finite, non-clipping audio.
  const presetResults = await page.evaluate(async () => {
    const g = window.__grooveLab;
    const { presets, factory } = g.lib;
    const out = [];
    for (const preset of presets) {
      const p = factory.createEmptyProject();
      const t = factory.createTrack(preset.id);
      const f = preset.focusNote;
      const notes = preset.category === 'Drums'
        ? [36, 38, 39, 37, 42, 46, 70, 64].map((n, i) => factory.note(n, i * 0.5, 0.25, 0.9))
        : [factory.note(f, 0, 1.5, 0.9), factory.note(f + 7, 0, 1.5, 0.8), factory.note(f + 12, 2, 1.5, 0.9)];
      t.clips = [factory.createClip(0, 4, 4, notes)];
      p.tracks = [t];
      const buf = await g.render.renderProject(p, { startBar: 0, endBar: 1, tail: 0.5 });
      const r = g.render.peakAndRms(buf);
      out.push({ id: preset.id, ...r, finite: Number.isFinite(r.rms) });
    }
    return out;
  });
  const bad = presetResults.filter((r) => !r.finite || r.rms < 0.002 || r.peak >= 1);
  check(`all ${presetResults.length} instrument presets produce sound`, bad.length === 0, bad.map((b) => `${b.id}: rms=${b.rms.toFixed(4)} peak=${b.peak.toFixed(2)}`).join(', '));
  console.log('      ' + presetResults.map((r) => `${r.id}=${r.rms.toFixed(3)}`).join(' '));
  const voices = await page.evaluate(async () => {
    const g = window.__grooveLab;
    const out = [];
    for (const id of Object.keys(g.lib.voices)) {
      const b = await g.lib.renderDrumVoice(id);
      out.push({ id, ...g.render.peakAndRms(b), dur: b.duration });
    }
    return out;
  });
  const badV = voices.filter((v) => !(v.rms > 0.005) || !(v.peak <= 0.95));
  check(`all ${voices.length} synthesized drum voices render`, badV.length === 0, badV.map((v) => v.id).join(', '));


  // Generated full track: real audio with an energy arc (break quieter than the drops, intro quieter than drop).
  const arc = await page.evaluate(async () => {
    const g = window.__grooveLab;
    const p = g.lib.factory.createEmptyProject();
    p.tracks = [];
    g.lib.applyCommands(p, g.lib.generateSong(p, 'house', 11).commands);
    const t0 = performance.now();
    const buf = await g.render.renderProject(p, { startBar: 0, endBar: p.lengthBars, tail: 1 });
    const ms = performance.now() - t0;
    const sec = (bar) => (bar * 4 * 60) / p.bpm + 0.05;
    const rmsOf = (b0, b1) => {
      const d = buf.getChannelData(0);
      const a = Math.floor(sec(b0) * buf.sampleRate), z = Math.floor(sec(b1) * buf.sampleRate);
      let s = 0;
      for (let i = a; i < z; i++) s += d[i] * d[i];
      return Math.sqrt(s / (z - a));
    };
    return { intro: rmsOf(0, 8), drop: rmsOf(16, 32), brk: rmsOf(32, 40), drop2: rmsOf(48, 64), peak: g.render.peakAndRms(buf).peak, dur: buf.duration, ms };
  });
  check('generated track has an energy arc', arc.intro < arc.drop * 0.8 && arc.brk < arc.drop * 0.8 && arc.drop2 > arc.brk, `intro ${arc.intro.toFixed(3)} · drop ${arc.drop.toFixed(3)} · break ${arc.brk.toFixed(3)} · drop2 ${arc.drop2.toFixed(3)}`);
  check('generated track does not clip', arc.peak <= 1, `peak ${arc.peak.toFixed(3)}, ${arc.dur.toFixed(0)}s rendered in ${(arc.ms / 1000).toFixed(1)}s`);

  // ---------------------------------------------------------------- UI flow
  const SHOTS = process.env.SHOTS_DIR;
  await page.setViewportSize({ width: 1440, height: 900 });
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
  await shot('studio');

  // Play via the transport button and confirm audio reaches the master meter.
  await page.click('button[aria-label="Play"]');
  await page.waitForTimeout(1500);
  const uiLevel = await page.evaluate(() => window.__grooveLab.engine.masterLevel());
  check('UI play button produces audio', uiLevel > -40, `${uiLevel.toFixed(1)} dBFS`);
  await shot('studio-playing');
  await page.click('button[aria-label="Stop"]');

  // Step sequencer: toggle a step and verify the model changed.
  const before = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[0].clips[0].notes.length);
  await page.click('button[aria-label="Kick step 3"]');
  const after = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[0].clips[0].notes.length);
  check('step sequencer toggles a note', after === before + 1, `${before} → ${after}`);

  // Piano roll: select the bass track, click to add a note.
  await page.click('.track-header:nth-child(2)');
  await page.waitForSelector('.pr-canvas');
  const nBefore = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[1].clips[0].notes.length);
  const box = await page.locator('.pr-grid').boundingBox();
  await page.mouse.click(box.x + 300, box.y + 120);
  const nAfter = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[1].clips[0].notes.length);
  check('piano roll click adds a note', nAfter === nBefore + 1, `${nBefore} → ${nAfter}`);
  await page.keyboard.press('Control+z');
  const nUndo = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[1].clips[0].notes.length);
  check('undo removes it', nUndo <= nBefore, `${nAfter} → ${nUndo}`);
  await shot('pianoroll');

  for (const v of ['Instruments', 'Mixer', 'Library']) {
    await page.click(`.nav button:has-text("${v}")`);
    await page.waitForTimeout(300);
    await shot(v.toLowerCase());
  }
  // Mixer EQ really changes the sound: render bass with and without a -24 dB low cut.
  const eqDiff = await page.evaluate(async () => {
    const g = window.__grooveLab;
    const base = structuredClone(g.store.getProject());
    base.tracks.forEach((t, i) => (t.mixer.solo = i === 1));
    const a = g.render.peakAndRms(await g.render.renderProject(base, { startBar: 0, endBar: 1, tail: 0 }));
    base.tracks[1].mixer.eq.low = -24;
    const b = g.render.peakAndRms(await g.render.renderProject(base, { startBar: 0, endBar: 1, tail: 0 }));
    return { a: a.rms, b: b.rms };
  });
  check('mixer EQ processes audio', eqDiff.b < eqDiff.a * 0.7, `rms ${eqDiff.a.toFixed(4)} → ${eqDiff.b.toFixed(4)} with low −24 dB`);


  // AI Producer: generate a full groove, discard it, generate again and keep it.
  await page.click('.nav button:has-text("Producer")');
  await page.waitForSelector('.hero-action');
  const beforeGroove = await page.evaluate(() => JSON.stringify(window.__grooveLab.store.getProject().tracks.map((t) => t.clips.map((c) => c.notes.length))));
  await page.click('.chip:has-text("Deep House")');
  await page.click('.hero-action');
  await page.waitForSelector('.proposal');
  const proposed = await page.evaluate(() => ({ bpm: window.__grooveLab.store.getProject().bpm, tracks: window.__grooveLab.store.getProject().tracks.length }));
  check('Producer proposes a Deep House groove', proposed.bpm === 121, `bpm=${proposed.bpm} tracks=${proposed.tracks}`);
  await shot('producer-proposal');
  await page.click('.proposal button:has-text("Discard")');
  const afterDiscard = await page.evaluate(() => JSON.stringify(window.__grooveLab.store.getProject().tracks.map((t) => t.clips.map((c) => c.notes.length))));
  check('Discard restores the project', afterDiscard === beforeGroove);
  await page.click('.part-card:has-text("Bassline")');
  await page.click('.proposal button:has-text("Keep")');
  const kept = await page.evaluate(() => !window.__grooveLab.store.get().ui.proposal);
  check('Keep accepts the proposal', kept);
  // Sidechain really ducks: render chords with and without pump.
  const pump = await page.evaluate(async () => {
    const g = window.__grooveLab;
    const base = structuredClone(g.store.getProject());
    const chords = base.tracks.find((t) => t.name === 'Chords');
    base.tracks.forEach((t) => (t.mixer.solo = t === chords || t.kind === 'drums'));
    base.tracks.filter((t) => t.kind === 'drums').forEach((t) => (t.mixer.volume = -60));
    chords.mixer.sidechain = 0;
    const a = g.render.peakAndRms(await g.render.renderProject(base, { startBar: 0, endBar: 2, tail: 0 }));
    chords.mixer.sidechain = 1;
    const b = g.render.peakAndRms(await g.render.renderProject(base, { startBar: 0, endBar: 2, tail: 0 }));
    return { a: a.rms, b: b.rms };
  });
  check('sidechain pump ducks the track', pump.b < pump.a * 0.85, `rms ${pump.a.toFixed(4)} → ${pump.b.toFixed(4)}`);

  // WAV export through the dialog.
  await page.click('.nav button:has-text("Studio")');
  await page.click('button:has-text("Export")');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 240000 }), page.click('button:has-text("Render & download")')]);
  const path = await download.path();
  const fs = await import('node:fs');
  const buf = fs.readFileSync(path);
  const riff = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WAVE';
  check('WAV export downloads a valid file', riff && buf.length > 1e6, `${download.suggestedFilename()} ${(buf.length / 1048576).toFixed(1)} MB`);

  // Persistence: reload and confirm the edited project comes back.
  const expected = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[0].clips[0].notes.length);
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => window.__grooveLab && document.querySelector('.topbar'));
  const restored = await page.evaluate(() => window.__grooveLab.store.getProject().tracks[0].clips[0].notes.length);
  check('project restored from IndexedDB after reload', restored === expected, `${restored} notes on drums`);
  check('no page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
