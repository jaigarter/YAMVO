// Builds GROOVE LAB as a hosted claude.ai Artifact:
//   dist-artifact/page.html  — page body (the host adds doctype/head/body)
//   dist-artifact/assets/app.js, app.css
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';

const out = 'dist-artifact';
rmSync(out, { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'artifact', '--base', './', '--outDir', `${out}/build`], { stdio: 'inherit' });
mkdirSync(`${out}/assets`, { recursive: true });
const built = readdirSync(`${out}/build/assets`);
const js = built.find((f) => f.endsWith('.js'));
const css = built.find((f) => f.endsWith('.css'));
copyFileSync(`${out}/build/assets/${js}`, `${out}/assets/app.js`);
copyFileSync(`${out}/build/assets/${css}`, `${out}/assets/app.css`);
writeFileSync(
  `${out}/page.html`,
  `<title>GROOVE LAB</title>
<script type="application/json" id="claude-artifacts-manifest">{"permissions": ["full-access"]}</script>
<link rel="stylesheet" href="assets/app.css">
<div id="root"></div>
<script type="module" src="assets/app.js"></script>
`,
);
// Local wrapper that mimics the host skeleton, for testing.
writeFileSync(
  `${out}/local.html`,
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${readFileSync(`${out}/page.html`, 'utf8')}</body></html>`,
);
// Sound packs: copied next to the page; files.json maps published path → source for the Artifact publish.
mkdirSync(`${out}/packs`, { recursive: true });
const files = { 'assets/app.js': `${out}/assets/app.js`, 'assets/app.css': `${out}/assets/app.css` };
for (const f of readdirSync(`${out}/build/packs`)) {
  copyFileSync(`${out}/build/packs/${f}`, `${out}/packs/${f}`);
  files[`packs/${f}`] = `${out}/packs/${f}`;
}
writeFileSync(`${out}/files.json`, JSON.stringify(files, null, 1));
console.log('artifact ready:', `${out}/page.html`, js, css, Object.keys(files).length, 'files');
