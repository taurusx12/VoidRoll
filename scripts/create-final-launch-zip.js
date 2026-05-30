// VoidRoll Reborn - Create Final Launch Zip
// Run: node scripts/create-final-launch-zip.js

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const root = process.cwd();
const outDir = path.join(root, 'release');
const outFile = path.join(outDir, 'VoidRoll_Reborn_FINAL_LAUNCH.zip');

const excludeDirs = new Set([
  'node_modules',
  '.git',
  'release',
  '.cache',
  '.next',
  'dist'
]);

const excludeFiles = new Set([
  '.env',
  '.env.local',
  '.env.production',
  'npm-debug.log',
  'yarn-error.log'
]);

function shouldExclude(fullPath) {
  const rel = path.relative(root, fullPath).replaceAll('\\', '/');
  const parts = rel.split('/');

  if (parts.some(p => excludeDirs.has(p))) return true;
  if (excludeFiles.has(path.basename(fullPath))) return true;

  return false;
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const output = fs.createWriteStream(outFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`✅ Final launch zip created: ${outFile}`);
    console.log(`📦 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log('');
    console.log('Important: .env and node_modules were excluded.');
  });

  archive.on('error', err => {
    throw err;
  });

  archive.pipe(output);

  function addDir(dir) {
    for (const item of fs.readdirSync(dir)) {
      const full = path.join(dir, item);
      if (shouldExclude(full)) continue;

      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        addDir(full);
      } else {
        archive.file(full, { name: path.relative(root, full) });
      }
    }
  }

  addDir(root);
  await archive.finalize();
}

main().catch(err => {
  console.error('❌ Failed to create final launch zip:', err);
  process.exit(1);
});
