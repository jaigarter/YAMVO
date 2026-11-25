/**
 * Sampled instrument packs.
 *
 * Each pack is built by scripts/sound-packs/build_packs.py into
 * `public/packs/<id>.mp3` (all zones back to back, separated by silence) and
 * `public/packs/<id>.json` (zone offsets, licence, attribution). A pack is
 * fetched lazily the first time a preset uses it, decoded once and sliced
 * into one AudioBuffer per zone. Cache Storage keeps it for offline use.
 */
import packIndex from './packIndex.json';

export interface PackZoneInfo {
  note: number;
  /** Upper velocity bound (0..1] of the layer this zone belongs to. */
  vel: number;
  start: number;
  dur: number;
  /** One-shot packs (percussion) name their zones. */
  id?: string;
  label?: string;
  category?: string;
}

export interface PackManifest {
  id: string;
  name: string;
  license: string;
  licenseId: string;
  attribution: string;
  source: string;
  file: string;
  sampleRate: number;
  gap: number;
  zones: PackZoneInfo[];
}

export interface PackSummary {
  id: string;
  name: string;
  license: string;
  licenseId: string;
  attribution: string;
  source: string;
  zoneCount: number;
  bytes: number;
}

export const PACKS = packIndex as PackSummary[];

export interface PackZone extends PackZoneInfo {
  buffer: AudioBuffer;
}

const CACHE_NAME = 'groove-lab-packs-v2';
const zoneCache = new Map<string, Promise<PackZone[]>>();
const manifestCache = new Map<string, Promise<PackManifest>>();

function packUrl(file: string): string {
  return `${import.meta.env.BASE_URL}packs/${file}`;
}

async function fetchCached(url: string): Promise<ArrayBuffer> {
  let cache: Cache | null = null;
  try {
    cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NAME) : null;
    const hit = await cache?.match(url);
    if (hit) return await hit.arrayBuffer();
  } catch {
    cache = null; // Cache Storage unavailable (private mode, sandboxed frame)
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  if (cache) {
    try {
      await cache.put(url, res.clone());
    } catch {
      /* quota or sandbox — fine without cache */
    }
  }
  return res.arrayBuffer();
}

export function getPackManifest(id: string): Promise<PackManifest> {
  let p = manifestCache.get(id);
  if (!p) {
    p = fetchCached(packUrl(`${id}.json`)).then((b) => JSON.parse(new TextDecoder().decode(b)) as PackManifest);
    p.catch(() => manifestCache.delete(id));
    manifestCache.set(id, p);
  }
  return p;
}

/**
 * Finds the true start of a zone in the decoded sprite. MP3 decoders may or
 * may not remove the encoder delay, so we search for the onset near the
 * nominal offset instead of trusting it blindly.
 */
function findOnset(data: Float32Array, nominal: number, sr: number): number {
  const from = Math.max(0, Math.floor((nominal - 0.03) * sr));
  const to = Math.min(data.length, Math.floor((nominal + 0.09) * sr));
  for (let i = from; i < to; i++) {
    if (Math.abs(data[i]) > 0.0015) return Math.max(0, i - Math.floor(0.001 * sr));
  }
  return Math.floor(nominal * sr);
}

export function getPackZones(id: string): Promise<PackZone[]> {
  const hit = zoneCache.get(id);
  if (hit) return hit;
  const p = (async () => {
    const manifest = await getPackManifest(id);
    const decoder = new OfflineAudioContext(1, 1, manifest.sampleRate);
    const sprite = await decoder.decodeAudioData(await fetchCached(packUrl(manifest.file)));
    const data = sprite.getChannelData(0);
    const sr = sprite.sampleRate;
    return manifest.zones.map((z) => {
      const start = findOnset(data, z.start, sr);
      const len = Math.min(Math.floor(z.dur * sr), data.length - start);
      const buffer = new AudioBuffer({ length: Math.max(1, len), sampleRate: sr, numberOfChannels: 1 });
      buffer.copyToChannel(data.subarray(start, start + len), 0);
      return { ...z, buffer };
    });
  })();
  p.catch(() => zoneCache.delete(id));
  zoneCache.set(id, p);
  return p;
}

/** One-shot from a named zone, e.g. `gm-percussion/conga-open`. */
export async function getPackOneShot(ref: string): Promise<AudioBuffer> {
  const [packId, zoneId] = ref.split('/');
  const zones = await getPackZones(packId);
  const z = zones.find((x) => x.id === zoneId);
  if (!z) throw new Error(`Sound ${ref} not found`);
  return z.buffer;
}
