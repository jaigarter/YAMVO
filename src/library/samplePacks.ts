/**
 * Multisample packs (Phase 2 of the sound library).
 *
 * A pack is a folder under `public/packs/<id>/` with a `manifest.json`:
 *
 *   { "id": "...", "name": "...", "license": "CC-BY-4.0", "attribution": "...",
 *     "zones": [ { "note": 60, "file": "C4.m4a" }, ... ] }
 *
 * Zones are fetched lazily the first time a preset using the pack is played,
 * then kept in the browser Cache Storage so later sessions load offline.
 * Packs are only added once their licence has been verified and approved
 * (see docs/SOUND_LIBRARY.md); the registry below lists the installed ones.
 */

export interface PackManifest {
  id: string;
  name: string;
  license: string;
  attribution: string;
  source: string;
  zones: { note: number; file: string; velocity?: number }[];
}

export interface PackZone {
  note: number;
  buffer: AudioBuffer;
}

const CACHE_NAME = 'groove-lab-packs-v1';
const zoneCache = new Map<string, Promise<PackZone[]>>();

function packUrl(id: string, file: string): string {
  return `${import.meta.env.BASE_URL}packs/${id}/${file}`;
}

async function fetchCached(url: string): Promise<ArrayBuffer> {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME);
      const hit = await cache.match(url);
      if (hit) return hit.arrayBuffer();
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      await cache.put(url, res.clone());
      return res.arrayBuffer();
    } catch (err) {
      if (err instanceof Error && /^\d{3} /.test(err.message)) throw err;
      /* Cache Storage unavailable (private mode) — fall through */
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.arrayBuffer();
}

export async function getPackManifest(id: string): Promise<PackManifest> {
  const res = await fetch(packUrl(id, 'manifest.json'));
  if (!res.ok) throw new Error(`Pack ${id} not installed`);
  return res.json();
}

export function getPackZones(id: string, ctx?: BaseAudioContext): Promise<PackZone[]> {
  const hit = zoneCache.get(id);
  if (hit) return hit;
  const p = (async () => {
    const manifest = await getPackManifest(id);
    const decoder = ctx ?? new OfflineAudioContext(1, 1, 44100);
    return Promise.all(
      manifest.zones.map(async (z) => ({
        note: z.note,
        buffer: await decoder.decodeAudioData(await fetchCached(packUrl(id, z.file))),
      })),
    );
  })();
  p.catch(() => zoneCache.delete(id));
  zoneCache.set(id, p);
  return p;
}
