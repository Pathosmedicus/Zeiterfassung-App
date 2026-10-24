import fs from 'fs';
import path from 'path';

// Kopiere gebaute Dateien aus dist/ in das Root-Verzeichnis für direktes GitHub Pages Branch-Hosting
// UND stelle sicher, dass dist/index.html und dist/.nojekyll existieren für GitHub Actions Deployment
const distDir = path.resolve('dist');
const rootDir = path.resolve('.');

if (fs.existsSync(distDir)) {
  const builtDevHtml = path.join(distDir, 'index.dev.html');
  const distIndexHtml = path.join(distDir, 'index.html');
  const rootIndexHtml = path.join(rootDir, 'index.html');

  // 1. Stelle sicher, dass index.html sowohl in dist/ als auch in root/ existiert!
  if (fs.existsSync(builtDevHtml)) {
    fs.copyFileSync(builtDevHtml, distIndexHtml);
    fs.copyFileSync(builtDevHtml, rootIndexHtml);
    // 404.html als Fallback für GitHub Pages Routing
    fs.copyFileSync(builtDevHtml, path.join(distDir, '404.html'));
    fs.copyFileSync(builtDevHtml, path.join(rootDir, '404.html'));
    console.log('✓ dist/index.html, ./index.html und 404.html synchronisiert');
  }

  // 2. .nojekyll in dist und root
  fs.writeFileSync(path.join(distDir, '.nojekyll'), '');
  fs.writeFileSync(path.join(rootDir, '.nojekyll'), '');
  console.log('✓ .nojekyll in dist/ und ./ erstellt');

  // 3. assets Ordner
  const distAssetsDir = path.join(distDir, 'assets');
  const rootAssetsDir = path.join(rootDir, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    if (fs.existsSync(rootAssetsDir)) {
      // Entferne veraltete Hashes, damit nur aktive Bundles existieren
      fs.rmSync(rootAssetsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(rootAssetsDir, { recursive: true });
    const files = fs.readdirSync(distAssetsDir);
    for (const file of files) {
      fs.copyFileSync(path.join(distAssetsDir, file), path.join(rootAssetsDir, file));
    }
    console.log(`✓ ${files.length} Assets nach ./assets/ kopiert`);
  }

  // 4. Service Worker, Icons & Manifest
  const rootFilesToCopy = ['sw.js', 'manifest.webmanifest', 'registerSW.js', 'favicon.svg'];
  const allDistFiles = fs.readdirSync(distDir);
  for (const file of allDistFiles) {
    if (rootFilesToCopy.includes(file) || file.startsWith('workbox-')) {
      fs.copyFileSync(path.join(distDir, file), path.join(rootDir, file));
      console.log(`✓ dist/${file} nach ./${file} kopiert`);
    }
  }

  // Auch favicon.svg nach dist kopieren falls nicht da
  const rootFavicon = path.join(rootDir, 'public', 'favicon.svg');
  if (fs.existsSync(rootFavicon) && !fs.existsSync(path.join(distDir, 'favicon.svg'))) {
    fs.copyFileSync(rootFavicon, path.join(distDir, 'favicon.svg'));
  }
}
