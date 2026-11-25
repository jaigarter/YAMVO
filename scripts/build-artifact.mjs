// Builds GROOVE LAB as a hosted claude.ai Artifact:
//   dist-artifact/page.html  — page body (the host adds doctype/head/body)
//   dist-artifact/assets/app.js, app.css
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';

const out = 'dist-artifact';
rmSync(out, { recursive: true, force: true });
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'artifact', '--base', './', '--outDir', `${out}/build`], { stdio: 'inherit' });
mkdirSync(`${out}/assets`, { recursive: true });
const files = readdirSync(`${out}/build/assets`);
const js = files.find((f) => f.endsWith('.js'));
const css = files.find((f) => f.endsWith('.css'));
copyFileSync(`${out}/build/assets/${js}`, `${out}/assets/app.js`);
copyFileSync(`${out}/build/assets/${css}`, `${out}/assets/app.css`);
writeFileSync(
  `${out}/page.html`,
  `<title>GROOVE LAB</title>
<meta name="color-scheme" content="dark">
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
console.log('artifact ready:', `${out}/page.html`, js, css);
