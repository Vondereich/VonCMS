const fs = require('fs-extra');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceThemesDir = path.join(projectRoot, 'src', 'themes');
const destinationThemesDir = path.join(projectRoot, 'dist', 'themes');

fs.removeSync(destinationThemesDir);

if (fs.existsSync(sourceThemesDir)) {
  const copiedThemeIds = new Set();

  for (const entry of fs.readdirSync(sourceThemesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const sourceManifest = path.join(sourceThemesDir, entry.name, 'theme.json');
    if (!fs.existsSync(sourceManifest)) continue;

    if (fs.statSync(sourceManifest).size > 16384) {
      throw new Error(`Theme manifest exceeds 16 KB: ${sourceManifest}`);
    }

    const manifest = fs.readJsonSync(sourceManifest);
    if (!/^theme-[a-z0-9][a-z0-9-]*$/.test(manifest.id || '')) {
      throw new Error(`Invalid theme manifest id: ${sourceManifest}`);
    }
    if (copiedThemeIds.has(manifest.id)) {
      throw new Error(`Duplicate theme manifest id: ${manifest.id}`);
    }
    copiedThemeIds.add(manifest.id);

    const destinationManifest = path.join(destinationThemesDir, manifest.id, 'theme.json');
    fs.copySync(sourceManifest, destinationManifest);
  }
}
