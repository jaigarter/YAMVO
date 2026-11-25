import { useEffect, useState } from 'react';
import { store } from '../state/store';
import * as A from '../state/actions';
import { deleteProject, listProjects, loadProject, type ProjectSummary } from '../storage/projects';
import { saveNow } from '../state/persistence';
import { TrashIcon } from './components/Icons';
import { ConfirmButton } from './components/ConfirmButton';
import { STYLES } from '../ai/generators';

export function ProjectsModal({ onClose }: { onClose: () => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const currentId = store.getProject().id;

  const refresh = () => listProjects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => {
    void saveNow().then(refresh);
  }, []);

  const open = async (id: string) => {
    await saveNow();
    const p = await loadProject(id);
    if (p) A.openProject(p);
    onClose();
  };

  const create = async (kind: 'empty' | 'demo') => {
    await saveNow();
    if (kind === 'empty') A.newProject();
    else A.loadDemo();
    await saveNow();
    onClose();
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-label="Projects">
        <h3>Projects</h3>
        <div className="menu-label">Start from a style — a full groove is generated for you</div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {STYLES.map((st) => (
            <button
              key={st.id}
              className="btn"
              onClick={async () => {
                await saveNow();
                A.newFromStyle(st.id);
                await saveNow();
                onClose();
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => void create('empty')}>
            New empty project
          </button>
          <button className="btn" onClick={() => void create('demo')}>
            New from UKG demo
          </button>
        </div>
        <div className="menu-label">Saved in this browser</div>
        <div style={{ maxHeight: 340, overflow: 'auto' }}>
          {projects === null && <div className="empty">Loading…</div>}
          {projects?.map((p) => (
            <div className="project-row" key={p.id}>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>
                  {p.name} {p.id === currentId && <small>· open</small>}
                </div>
                <small>
                  {p.bpm} BPM · {p.tracks} tracks · {new Date(p.updatedAt).toLocaleString()}
                </small>
              </div>
              {p.id !== currentId && (
                <>
                  <button className="btn small" onClick={() => void open(p.id)}>
                    Open
                  </button>
                  <ConfirmButton
                    label={`Delete ${p.name}`}
                    onConfirm={async () => {
                      await deleteProject(p.id);
                      void refresh();
                    }}
                  >
                    <TrashIcon />
                  </ConfirmButton>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="actions">
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
