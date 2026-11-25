#!/usr/bin/env python3
"""
Builds GROOVE LAB's sampled sound packs from licensed open sources.

Each pack becomes ONE compressed audio "sprite" (all zones back to back,
separated by short silences) plus a JSON manifest with the zone offsets.
One file per instrument keeps requests and the artifact file count low; the
app decodes it once and slices it into per-note buffers.

Sources (see docs/SOUND_LIBRARY.md and CREDITS.md):
  - Salamander Grand Piano V2 (Alexander Holm) — CC BY 3.0
  - jRhodes3c (Jeff Learman) — CC BY 4.0
  - FluidR3Mono_GM.sf3 (Frank Wen, Michael Cowgill, S. Christian Collins) — MIT

Usage:
  python3 -I scripts/sound-packs/build_packs.py <downloads_dir> <repo_dir>
Requires: ffmpeg (libmp3lame), fluidsynth, numpy.
"""
import json
import os
import re
import struct
import subprocess
import sys
import tempfile

import numpy as np

SR = 44100
GAP = 0.12  # silence between zones (s)

DL, REPO = sys.argv[1], sys.argv[2]
OUT = os.path.join(REPO, "public", "packs")
os.makedirs(OUT, exist_ok=True)

NOTE_INDEX = {"C": 0, "Cs": 1, "Db": 1, "D": 2, "Ds": 3, "Eb": 3, "E": 4, "F": 5, "Fs": 6, "Gb": 6, "G": 7, "Gs": 8, "Ab": 8, "A": 9, "As": 10, "Bb": 10, "B": 11}


def name_to_midi(name):
    m = re.match(r"([A-G][sb]?)(-?\d)$", name)
    return (int(m.group(2)) + 1) * 12 + NOTE_INDEX[m.group(1)]


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def encode(samples, path, quality="4"):
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-codec:a", "libmp3lame", "-q:a", quality, path],
        input=samples.astype(np.float32).tobytes(),
        check=True,
    )


def trim(x, max_len=None, floor_db=-58):
    """Removes leading/trailing silence, caps length and fades the tail."""
    peak = float(np.max(np.abs(x))) if len(x) else 0
    if peak < 1e-6:
        return x[:1]
    thr = peak * 10 ** (floor_db / 20)
    idx = np.where(np.abs(x) > thr)[0]
    start = max(0, idx[0] - int(0.002 * SR))
    end = idx[-1] + 1
    x = x[start:end]
    if max_len:
        x = x[: int(max_len * SR)]
    n = min(len(x), int(0.04 * SR))
    if n > 0:
        x[-n:] *= np.linspace(1, 0, n)
    return x


def write_pack(pack_id, meta, zones, quality="4"):
    """zones: list of dicts with 'audio' + zone fields. Writes sprite + manifest."""
    peak = max(float(np.max(np.abs(z["audio"]))) for z in zones) or 1.0
    gain = 0.89 / peak
    parts, out_zones, t = [], [], 0.0
    for z in zones:
        parts.append(np.zeros(int(GAP * SR), dtype=np.float32))
        t += GAP
        a = (z["audio"] * gain).astype(np.float32)
        parts.append(a)
        zone = {k: v for k, v in z.items() if k != "audio"}
        zone["start"] = round(t, 5)
        zone["dur"] = round(len(a) / SR, 5)
        out_zones.append(zone)
        t += len(a) / SR
    parts.append(np.zeros(int(GAP * SR), dtype=np.float32))
    encode(np.concatenate(parts), os.path.join(OUT, f"{pack_id}.mp3"), quality)
    manifest = {"id": pack_id, **meta, "file": f"{pack_id}.mp3", "sampleRate": SR, "gap": GAP, "zones": out_zones}
    with open(os.path.join(OUT, f"{pack_id}.json"), "w") as f:
        json.dump(manifest, f, separators=(",", ":"))
    size = os.path.getsize(os.path.join(OUT, f"{pack_id}.mp3"))
    print(f"  {pack_id}: {len(zones)} zones, {size / 1024:.0f} KB")
    return {k: v for k, v in manifest.items() if k not in ("zones", "sampleRate", "gap")} | {"zoneCount": len(zones), "bytes": size}


LIC_SALAMANDER = {"license": "CC-BY-3.0", "attribution": "Salamander Grand Piano V2 by Alexander Holm (CC BY 3.0)", "source": "https://github.com/Tonejs/audio/tree/master/salamander", "licenseId": "salamander"}
LIC_RHODES = {"license": "CC-BY-4.0", "attribution": "Samples from jRhodes3d by Jeff Learman — github.com/sfzinstruments/jlearman.jRhodes3d (CC BY 4.0)", "source": "https://github.com/sfzinstruments/jlearman.jRhodes3c", "licenseId": "jrhodes"}
LIC_FLUID = {"license": "MIT", "attribution": "FluidR3 by Frank Wen; FluidR3Mono by Michael Cowgill; MS_General adaptation by S. Christian Collins (MIT)", "source": "https://github.com/musescore/MuseScore/tree/3.6.2/share/sound", "licenseId": "fluidr3"}

index = []

# ---------------------------------------------------------------- Salamander
print("Salamander piano")
sal = os.path.join(DL, "salamander")
zones = []
for f in sorted(os.listdir(sal)):
    if not f.endswith(".mp3"):
        continue
    note = name_to_midi(f[:-4])
    zones.append({"note": note, "vel": 1, "audio": trim(decode(os.path.join(sal, f)), max_len=6)})
zones.sort(key=lambda z: z["note"])
index.append(write_pack("piano-grand", {"name": "Grand Piano", **LIC_SALAMANDER}, zones))

# -------------------------------------------------------------------- Rhodes
print("jRhodes3c")
rdir = os.path.join(DL, "rhodes", "src", "jRhodes3c-looped-flac-sfz")
sfz = open([os.path.join(rdir, f) for f in os.listdir(rdir) if f.endswith("mono-looped.sfz")][0]).read()
regions = []
for block in sfz.split("<region>")[1:]:
    kv = dict(re.findall(r"(\w+)=(\S+)", block))
    regions.append({"sample": kv["sample"], "key": kv["pitch_keycenter"], "lovel": int(kv.get("lovel", 1))})
by_key = {}
for r in regions:
    by_key.setdefault(r["key"], []).append(r)
zones = []
LAYERS = [(1, 0.6), (2, 0.85), (4, 1.0)]  # (index in velocity order, upper velocity bound)
for key, rs in by_key.items():
    rs.sort(key=lambda r: r["lovel"])
    note = name_to_midi(key[0].upper() + ("s" if "#" in key else "") + key[-1])
    for li, vel in LAYERS:
        r = rs[min(li, len(rs) - 1)]
        zones.append({"note": note, "vel": vel, "audio": trim(decode(os.path.join(rdir, r["sample"])), max_len=6)})
zones.sort(key=lambda z: (z["vel"], z["note"]))
index.append(write_pack("rhodes-mk1", {"name": "Rhodes Mark I", **LIC_RHODES}, zones))

# ------------------------------------------------------------------- FluidR3
SF = os.path.join(DL, "fluid", "FluidR3Mono_GM.sf3")


def midi_file(events, path):
    """events: list of (time_s, bytes). 120 BPM, 480 tpq → 960 ticks per second."""
    events = sorted(events, key=lambda e: e[0])
    data, last = bytearray(), 0
    for t, msg in events:
        tick = int(round(t * 960))
        delta = tick - last
        last = tick
        vlq = [delta & 0x7F]
        delta >>= 7
        while delta:
            vlq.insert(0, (delta & 0x7F) | 0x80)
            delta >>= 7
        data += bytes(vlq) + msg
    data += b"\x00\xff\x2f\x00"
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 0, 1, 480) + b"MTrk" + struct.pack(">I", len(data)) + data)


def render(events, total):
    with tempfile.TemporaryDirectory() as td:
        mid, wav = os.path.join(td, "x.mid"), os.path.join(td, "x.wav")
        midi_file(events, mid)
        subprocess.run(["fluidsynth", "-ni", "-q", "-R", "0", "-C", "0", "-g", "0.6", "-r", str(SR), "-F", wav, SF, mid], check=True, capture_output=True)
        x = decode(wav)
    return np.pad(x, (0, max(0, int(total * SR) - len(x))))


# id, name, GM program, lowest, highest, step, hold seconds, tail seconds
FLUID_PRESETS = [
    ("house-piano", "House Piano", 1, 36, 96, 3, 3.0, 1.5),
    ("electric-grand", "Electric Grand", 2, 36, 96, 3, 3.0, 1.5),
    ("dx-piano", "DX Piano", 5, 36, 96, 3, 3.0, 1.5),
    ("vibraphone", "Vibraphone", 11, 48, 96, 3, 3.0, 1.5),
    ("marimba", "Marimba", 12, 48, 96, 3, 1.2, 0.6),
    ("kalimba", "Kalimba", 108, 48, 96, 3, 1.5, 0.8),
    ("steel-drum", "Steel Drum", 114, 48, 90, 3, 1.5, 0.8),
    ("nylon-guitar", "Nylon Guitar", 24, 40, 84, 3, 2.5, 1.0),
    ("muted-guitar", "Funk Guitar", 28, 40, 84, 3, 0.6, 0.4),
    ("finger-bass", "Finger Bass", 33, 28, 60, 3, 2.0, 0.6),
    ("synth-bass-1", "Classic Synth Bass", 38, 24, 60, 3, 1.5, 0.5),
    ("strings", "String Ensemble", 48, 36, 96, 3, 5.0, 1.5),
    ("synth-strings", "Synth Strings", 50, 36, 96, 3, 5.0, 1.5),
    ("choir-aahs", "Choir Aahs", 52, 48, 84, 3, 5.0, 1.5),
    ("voice-oohs", "Voice Oohs", 53, 48, 84, 3, 5.0, 1.5),
    ("orchestra-hit", "Orchestra Stab", 55, 48, 84, 3, 1.0, 0.6),
    ("brass-section", "Brass Stab", 61, 48, 84, 3, 1.2, 0.5),
    ("synth-brass", "Synth Brass", 62, 48, 84, 3, 2.0, 0.8),
    ("alto-sax", "Alto Sax", 65, 49, 81, 3, 3.0, 0.8),
    ("flute", "Flute", 73, 60, 96, 3, 3.0, 0.8),
    ("warm-pad", "Warm Pad (GM)", 89, 36, 96, 3, 5.0, 2.0),
]

print("FluidR3Mono presets")
for pid, name, prog, lo, hi, step, hold, tail in FLUID_PRESETS:
    notes = list(range(lo, hi + 1, step))
    slot = hold + tail + 0.3
    events = [(0.0, bytes([0xC0, prog]))]
    for i, n in enumerate(notes):
        t = 0.5 + i * slot
        events += [(t, bytes([0x90, n, 100])), (t + hold, bytes([0x80, n, 0]))]
    total = 0.5 + len(notes) * slot + 1
    x = render(events, total)
    zones = []
    for i, n in enumerate(notes):
        t = 0.5 + i * slot
        seg = x[int(t * SR) : int((t + hold + tail) * SR)].copy()
        zones.append({"note": n, "vel": 1, "audio": trim(seg, max_len=hold + tail)})
    index.append(write_pack(pid, {"name": name, **LIC_FLUID}, zones))

# GM percussion one-shots (channel 10)
PERC = [
    (60, "Bongo Hi", "Perc"), (61, "Bongo Low", "Perc"), (62, "Conga Mute", "Perc"), (63, "Conga Open", "Perc"), (64, "Conga Low", "Perc"),
    (65, "Timbale Hi", "Perc"), (66, "Timbale Low", "Perc"), (67, "Agogo Hi", "Perc"), (68, "Agogo Low", "Perc"), (75, "Claves", "Perc"),
    (76, "Wood Block Hi", "Perc"), (77, "Wood Block Low", "Perc"), (56, "Cowbell", "Perc"), (54, "Tambourine", "Shaker"), (70, "Maracas", "Shaker"),
    (69, "Cabasa", "Shaker"), (81, "Triangle", "Perc"), (39, "Hand Clap", "Clap"), (37, "Side Stick", "Rim"), (49, "Crash", "Cymbal"),
    (51, "Ride", "Cymbal"), (53, "Ride Bell", "Cymbal"), (55, "Splash", "Cymbal"), (45, "Tom Low", "Perc"), (48, "Tom Hi", "Perc"),
]
print("FluidR3Mono percussion")
slot = 3.0
events = []
for i, (n, _, _) in enumerate(PERC):
    t = 0.5 + i * slot
    events += [(t, bytes([0x99, n, 110])), (t + 0.2, bytes([0x89, n, 0]))]
x = render(events, 0.5 + len(PERC) * slot + 1)
zones = []
for i, (n, label, cat) in enumerate(PERC):
    t = 0.5 + i * slot
    seg = x[int(t * SR) : int((t + slot - 0.2) * SR)].copy()
    slug = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
    zones.append({"note": n, "vel": 1, "id": slug, "label": label, "category": cat, "audio": trim(seg, max_len=2.6)})
index.append(write_pack("gm-percussion", {"name": "World & Latin Percussion", **LIC_FLUID}, zones, quality="3"))

with open(os.path.join(REPO, "src", "library", "packIndex.json"), "w") as f:
    json.dump(index, f, indent=1)
total = sum(p["bytes"] for p in index)
print(f"Done: {len(index)} packs, {total / 1048576:.1f} MB")
