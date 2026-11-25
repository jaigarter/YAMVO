/**
 * Claude desktop app integration (artifact `desktop` capability).
 *
 * - In claude.ai (browser or desktop app) it offers "Install app".
 * - Inside the installed app it sets the Dock icon and can write exports
 *   straight to ~/Music/GROOVE LAB (asks once for file access).
 * Everything degrades to null outside claude.ai.
 */

interface Desktop {
  install?: { state(): Promise<'available' | 'installed' | 'unavailable'>; request(): Promise<string> };
  fs?: { mkdir(path: string, o?: { recursive?: boolean }): Promise<void>; writeFile(path: string, data: Uint8Array): Promise<void> };
  shell?: { showItemInFolder(path: string): Promise<void> };
  app?: { dock?: { setIcon(png: string): Promise<{ written: boolean }> } };
}

let desktopPromise: Promise<Desktop | null> | null = null;
/** Resolved value, so click handlers can call the API synchronously. */
let resolved: Desktop | null = null;

export function getDesktop(): Promise<Desktop | null> {
  if (desktopPromise) return desktopPromise;
  const rt = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  desktopPromise = rt?.use
    ? rt
        .use('desktop')
        .then((d) => (resolved = (d as Desktop) ?? null))
        .catch(() => null)
    : Promise.resolve(null);
  return desktopPromise;
}

export async function installState(): Promise<'available' | 'installed' | 'unavailable'> {
  const d = await getDesktop();
  try {
    return (await d?.install?.state()) ?? 'unavailable';
  } catch {
    return 'unavailable';
  }
}

/** Call directly from a click handler (no await before it). */
export function requestInstall(): Promise<string> {
  return resolved?.install?.request() ?? Promise.resolve('unavailable');
}

/** Draws the app icon (index-blue disc with a white ring and dot) and gives it to the Dock. */
export async function setDockIcon(): Promise<void> {
  const d = await getDesktop();
  if (!d?.app?.dock) return;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, '#7a88ff');
  grad.addColorStop(1, '#4f5ef0');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(32, 32, 448, 448, 100);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 34;
  g.beginPath();
  g.arc(256, 256, 120, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(256, 256, 44, 0, Math.PI * 2);
  g.fill();
  try {
    await d.app.dock.setIcon(c.toDataURL('image/png'));
  } catch {
    /* icon is optional */
  }
}

/** Writes a file into ~/Music/GROOVE LAB when running as the installed desktop app. Returns the path, or null. */
export async function saveToMusicFolder(filename: string, data: Uint8Array): Promise<string | null> {
  const d = await getDesktop();
  if (!d?.fs) return null;
  const dir = '~/Music/GROOVE LAB';
  const path = `${dir}/${filename}`;
  await d.fs.mkdir(dir, { recursive: true });
  await d.fs.writeFile(path, data);
  void d.shell?.showItemInFolder(path).catch(() => {});
  return path;
}
