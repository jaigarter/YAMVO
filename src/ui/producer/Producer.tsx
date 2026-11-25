import { useEffect, useRef, useState } from 'react';
import { store, useStore } from '../../state/store';
import * as A from '../../state/actions';
import { STYLES, generateForRole, generateGroove, generateStructure, type Role, type Style } from '../../ai/generators';
import { generateSong } from '../../ai/song';
import { askClaude, getClaude } from '../../ai/claude';
import { SparkIcon } from '../components/Icons';

const PARTS: { role: Role; label: string; hint: string }[] = [
  { role: 'drums', label: 'Drums', hint: 'Kick, snare, hats, shakers' },
  { role: 'bass', label: 'Bassline', hint: 'Follows the chords' },
  { role: 'chords', label: 'Chords', hint: '7ths, 9ths, stabs' },
  { role: 'melody', label: 'Hook', hint: 'Call and response' },
];

const EXAMPLES = [
  'Create a dark UK Garage groove at 132 BPM with shuffled drums, deep rolling bass, atmospheric chords and soulful vocal chops',
  'Haz un groove de deep house a 122 BPM con Rhodes, bajo redondo y vibráfono',
  'Make the hi-hats busier and add a shaker pattern',
  'Turn this into a full track with intro, drop, break and outro',
];

export function Producer() {
  const style = useStore((s) => s.ui.producerStyle);
  const project = useStore((s) => s.project);
  const [prompt, setPrompt] = useState('');
  const [claude, setClaude] = useState<'checking' | 'ready' | 'unavailable'>('checking');
  const [thinking, setThinking] = useState<{ chars: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void getClaude().then((s) => alive && setClaude(s ? 'ready' : 'unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  const setStyle = (s: Style) => store.setUi({ producerStyle: s });

  const ask = async () => {
    const text = prompt.trim();
    if (!text || thinking) return;
    setError(null);
    setThinking({ chars: 0 });
    abort.current = new AbortController();
    try {
      const res = await askClaude(store.getProject(), text, { signal: abort.current.signal, onProgress: (chars) => setThinking({ chars }) });
      A.propose('Claude', res.message, res.commands, 'claude', res.errors);
      setPrompt('');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'aborted') return;
      setError(
        e.code === 'not_granted'
          ? 'Claude access was declined for this page. You can allow it from the page’s Permissions menu.'
          : e.code === 'rate_limited'
            ? 'You have reached your Claude usage limit for now. Try again later, or use the free generators.'
            : e.message ?? 'Claude could not answer. Try again in a moment.',
      );
    } finally {
      setThinking(null);
      abort.current = null;
    }
  };

  return (
    <div className="producer">
      <section className="producer-col">
        <header>
          <div className="panel-title">Free generators · no credits</div>
          <h2>Make an idea in one click</h2>
          <p>Pick a style, then generate a whole groove or a single part. Every result lands as normal tracks and notes you can edit.</p>
        </header>
        <div className="style-chips" role="radiogroup" aria-label="Style">
          {STYLES.map((s) => (
            <button key={s.id} role="radio" aria-checked={style === s.id} className={`chip ${style === s.id ? 'active' : ''}`} onClick={() => setStyle(s.id)}>
              {s.label}
              <small>{s.bpm}</small>
            </button>
          ))}
        </div>
        <button
          className="hero-action"
          onClick={() => {
            const g = generateSong(store.getProject(), style);
            A.propose(g.title, g.message, g.commands, 'generator');
          }}
        >
          <SparkIcon size={18} />
          <span>
            <strong>Generate full track</strong>
            <small>A 72-bar song that builds: intro, build, drop, break, second drop and outro</small>
          </span>
        </button>
        <button
          className="part-card wide"
          onClick={() => {
            const g = generateGroove(store.getProject(), style);
            A.propose(g.title, g.message, g.commands, 'generator');
          }}
        >
          <strong>Loop idea</strong>
          <small>A 4-bar groove (drums, bass, chords, hook) to jam and edit</small>
        </button>
        <div className="part-grid">
          {PARTS.map((p) => (
            <button
              key={p.role}
              className="part-card"
              onClick={() => {
                const g = generateForRole(store.getProject(), p.role, style);
                A.propose(g.title, g.message, g.commands, 'generator');
              }}
            >
              <strong>{p.label}</strong>
              <small>{p.hint}</small>
            </button>
          ))}
          <button
            className="part-card"
            disabled={!project.tracks.some((t) => t.clips.length)}
            onClick={() => {
              const g = generateStructure(store.getProject());
              A.propose(g.title, g.message, g.commands, 'generator');
            }}
          >
            <strong>Song structure</strong>
            <small>Intro · Build · Drop · Break · Outro</small>
          </button>
        </div>
      </section>

      <section className="producer-col">
        <header>
          <div className="panel-title">Claude · your claude.ai account</div>
          <h2>Ask your producer</h2>
          <p>Describe what you want in any language. Claude reads your project and proposes edits you can keep or discard.</p>
        </header>
        {claude === 'unavailable' ? (
          <div className="note">
            Claude works when GROOVE LAB is opened from its claude.ai link (it uses your account, no API key). Here you can use the free generators.
          </div>
        ) : (
          <>
            <textarea
              id="producer-prompt"
              className="prompt"
              placeholder="e.g. Create a dark UK Garage groove at 132 BPM with shuffled drums and soulful vocal chops"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void ask();
              }}
              disabled={!!thinking}
              rows={4}
            />
            <div className="prompt-actions">
              {thinking ? (
                <>
                  <span className="thinking">
                    <span className="spinner" /> Claude is producing… {thinking.chars > 0 && `${thinking.chars} characters`}
                  </span>
                  <button className="btn" onClick={() => abort.current?.abort()}>
                    Stop
                  </button>
                </>
              ) : (
                <button className="btn primary" disabled={!prompt.trim() || claude !== 'ready'} onClick={() => void ask()}>
                  <SparkIcon /> {claude === 'checking' ? 'Connecting…' : 'Ask Claude'}
                </button>
              )}
            </div>
            {error && <div className="note error">{error}</div>}
            <div className="examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} className="example" onClick={() => setPrompt(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
