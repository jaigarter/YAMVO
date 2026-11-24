import { useEffect, useMemo, useRef, useState } from 'react';
import { factoryItems, GENRES, searchLibrary, userItems, type LibraryItem } from '../../library/catalog';
import { deleteUserSample, importUserSample, listUserSamples, previewSample, type UserSampleMeta } from '../../library/sampleStore';
import { LICENSES, licenseFor } from '../../library/licenses';
import { getPreset } from '../../instruments/presets';
import { dbGet, dbPut } from '../../storage/db';
import * as A from '../../state/actions';
import { store, useStore } from '../../state/store';
import { PlayIcon, PlusIcon, TrashIcon, UploadIcon } from '../components/Icons';
import { SAMPLE_DRAG_TYPE } from '../studio/StepSequencer';
import { createTrack } from '../../model/factory';
import * as Tone from 'tone';
import { createInstrument } from '../../instruments/factory';

const CATEGORIES = ['All', 'Favorites', 'Drums', 'Bass', 'Keys', 'Synths', 'Imported'];

/** Plays a short phrase through a temporary instance of a preset. */
async function previewPreset(id: string): Promise<void> {
  await Tone.start();
  const preset = getPreset(id);
  if (!preset) return;
  const track = createTrack(id);
  const inst = createInstrument(track.instrument);
  const out = new Tone.Gain(Tone.dbToGain(-6)).toDestination();
  inst.output.connect(out);
  await inst.ready();
  const t = Tone.now() + 0.05;
  const f = preset.focusNote;
  const phrase =
    preset.category === 'Drums'
      ? [[36, 0], [42, 0.25], [38, 0.5], [42, 0.75], [36, 1.0], [46, 1.25], [39, 1.5], [70, 1.75]]
      : preset.category === 'Bass'
        ? [[f, 0], [f, 0.35], [f + 7, 0.7], [f + 12, 1.05], [f + 3, 1.4]]
        : [[f, 0], [f + 3, 0], [f + 7, 0], [f + 10, 0], [f + 2, 1.0], [f + 5, 1.0], [f + 9, 1.0]];
  for (const [p, d] of phrase) inst.trigger(p, 0.85, t + d, preset.category === 'Drums' ? 0.2 : preset.category === 'Bass' ? 0.3 : 0.9);
  setTimeout(() => {
    inst.dispose();
    out.dispose();
  }, 5000);
}

export function Library() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [genre, setGenre] = useState<string | undefined>();
  const [user, setUser] = useState<UserSampleMeta[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedTrack = useStore((s) => s.project.tracks.find((t) => t.id === s.ui.selectedTrackId));

  useEffect(() => {
    listUserSamples().then(setUser).catch(() => setUser([]));
    dbGet<string[]>('meta', 'favorites').then((f) => setFavs(new Set(f ?? []))).catch(() => {});
  }, []);

  const all = useMemo(() => [...userItems(user), ...factoryItems()], [user]);
  const results = useMemo(() => {
    const base = category === 'Favorites' ? all.filter((i) => favs.has(i.id)) : all;
    return searchLibrary(base, query, { category: category === 'All' || category === 'Favorites' ? undefined : category, genre });
  }, [all, query, category, genre, favs]);

  const toggleFav = (id: string) => {
    const next = new Set(favs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavs(next);
    void dbPut('meta', [...next], 'favorites');
  };

  const onImport = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const added: UserSampleMeta[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push(await importUserSample(f));
      } catch (err) {
        setError(`${f.name}: ${err instanceof Error ? err.message : 'could not be decoded'}`);
      }
    }
    if (added.length) {
      setUser(await listUserSamples());
      A.toast(`Imported ${added.length} sample${added.length > 1 ? 's' : ''}`);
    }
  };

  const useItem = (it: LibraryItem) => {
    if (it.kind === 'preset') {
      A.addTrack(it.id);
      A.toast(`Added track “${it.name}”`);
      store.setUi({ view: 'studio' });
      return;
    }
    if (selectedTrack?.kind === 'drums' && it.id.startsWith('voice:')) {
      A.toast('Drag the sound onto a pad name in the step sequencer to load it');
      return;
    }
    A.addSamplerTrack(it.id, it.name);
    A.toast(`Created sampler track “${it.name}” — play it chromatically`);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: all.length, Favorites: favs.size };
    for (const i of all) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [all, favs]);

  return (
    <div className="library">
      <aside className="lib-side">
        <div className="panel-title" style={{ padding: '0 10px 6px' }}>
          Collections
        </div>
        {CATEGORIES.map((c) => (
          <button key={c} className={`cat ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
            {c} <small>{counts[c] ?? 0}</small>
          </button>
        ))}
        <div className="panel-title" style={{ padding: '16px 10px 6px' }}>
          Genre
        </div>
        <button className={`cat ${!genre ? 'active' : ''}`} onClick={() => setGenre(undefined)}>
          Any
        </button>
        {GENRES.map((g) => (
          <button key={g} className={`cat ${genre === g ? 'active' : ''}`} onClick={() => setGenre(g)}>
            {g}
          </button>
        ))}
        <div className="credits">
          <div className="panel-title" style={{ marginBottom: 6 }}>
            Licences
          </div>
          {LICENSES.map((l) => (
            <div key={l.id} style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--text-2)' }}>{l.name}</strong> — {l.license}
              <br />
              {l.notes}
            </div>
          ))}
        </div>
      </aside>
      <section className="lib-main">
        <div className="lib-toolbar">
          <input className="text" placeholder="Search sounds and presets — “garage kick”, “reese”, “pad warm”…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search library" />
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{results.length} results</span>
          <span style={{ flex: 1 }} />
          <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aif,.aiff" multiple hidden onChange={(e) => void onImport(e.target.files).then(() => (e.target.value = ''))} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <UploadIcon /> Import audio
          </button>
        </div>
        {error && <div style={{ color: 'var(--danger)', padding: '8px 18px' }}>{error}</div>}
        <div className="lib-list">
          {results.map((it) => (
            <div
              key={it.id}
              className="lib-row"
              draggable={it.kind === 'sample'}
              onDragStart={(e) => {
                e.dataTransfer.setData(SAMPLE_DRAG_TYPE, it.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              title={it.kind === 'sample' ? 'Drag onto a drum pad in the step sequencer' : undefined}
            >
              <button
                className="play-btn"
                aria-label={`Preview ${it.name}`}
                onClick={() => void (it.kind === 'preset' ? previewPreset(it.id) : previewSample(it.id)).catch((err) => A.toast(String(err)))}
              >
                <PlayIcon size={11} />
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="name">
                  {it.name}{' '}
                  <button
                    onClick={() => toggleFav(it.id)}
                    aria-label={favs.has(it.id) ? 'Remove from favourites' : 'Add to favourites'}
                    style={{ border: 0, background: 'none', color: favs.has(it.id) ? 'var(--solo)' : 'var(--text-3)', padding: 0 }}
                  >
                    {favs.has(it.id) ? '★' : '☆'}
                  </button>
                </div>
                {it.description && <div style={{ color: 'var(--text-3)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.description}</div>}
              </div>
              <div className="type">
                {it.category} · {it.type}
              </div>
              <div className="tags">
                {it.tags.slice(0, 4).map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
                <span className="tag" title={licenseFor(it.license)?.notes}>
                  {licenseFor(it.license)?.license}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn small" onClick={() => useItem(it)} title={it.kind === 'preset' ? 'Create a new track with this preset' : 'Create a sampler track from this sound'}>
                  <PlusIcon size={11} /> {it.kind === 'preset' ? 'New track' : 'Sampler track'}
                </button>
                {it.category === 'Imported' && (
                  <button
                    className="btn small ghost danger"
                    aria-label={`Delete ${it.name}`}
                    onClick={async () => {
                      if (!confirm(`Delete “${it.name}” from your library?`)) return;
                      await deleteUserSample(it.id);
                      setUser(await listUserSamples());
                    }}
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </div>
          ))}
          {!results.length && <div className="empty">Nothing found. Try another search or import your own audio.</div>}
        </div>
      </section>
    </div>
  );
}
