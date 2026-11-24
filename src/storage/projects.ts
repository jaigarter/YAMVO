import type { Project } from '../model/types';
import { PROJECT_VERSION } from '../model/types';
import { dbDelete, dbGet, dbGetAll, dbPut } from './db';

export interface ProjectSummary {
  id: string;
  name: string;
  bpm: number;
  updatedAt: number;
  tracks: number;
}

export async function saveProject(project: Project): Promise<void> {
  await dbPut('projects', project);
  await dbPut('meta', project.id, 'lastProjectId');
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const p = await dbGet<Project>('projects', id);
  return p ? migrate(p) : undefined;
}

export async function loadLastProject(): Promise<Project | undefined> {
  const id = await dbGet<string>('meta', 'lastProjectId');
  return id ? loadProject(id) : undefined;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const all = await dbGetAll<Project>('projects');
  return all
    .map((p) => ({ id: p.id, name: p.name, bpm: p.bpm, updatedAt: p.updatedAt, tracks: p.tracks.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(id: string): Promise<void> {
  await dbDelete('projects', id);
}

/** Forward-compatible migrations between project versions. */
export function migrate(p: Project): Project {
  if (!p.version || p.version < PROJECT_VERSION) {
    p.version = PROJECT_VERSION;
  }
  return p;
}
