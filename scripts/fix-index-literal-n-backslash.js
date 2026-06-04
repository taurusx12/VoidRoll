// VoidRoll Reborn — Fix literal \n in src/index.js
// Your index.js got broken because the first line contains literal "\n" text instead of real newlines.
//
// Run:
//   node scripts/fix-index-literal-n-backslash.js
//   node --check src/index.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   npm start

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();
const indexPath = path.join(ROOT, 'src', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');
const backup = path.join(ROOT, 'src', `index.backup-fix-literal-n-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

// Fix literal "\n" sequences that were inserted as text.
s = s.replace(/\\n/g, '\n');

// Remove duplicate require lines while preserving order.
const lines = s.split(/\r?\n/);
const seenRequires = new Set();
const cleaned = [];

for (const line of lines) {
  const m = line.match(/^const\s+([A-Za-z0-9_]+)\s*=\s*require\((['"].+?['"])\);$/);
  if (m) {
    const key = `${m[1]}:${m[2]}`;
    if (seenRequires.has(key)) continue;
    seenRequires.add(key);
  }
  cleaned.push(line);
}

s = cleaned.join('\n');

// Ensure officialCharacterCommandSystem import exists as a normal line.
const needed = [
  "const officialCharacterCommandSystem = require('./systems/officialCharacterCommandSystem');",
  "const rollBank = require('./systems/rollBankSystem');",
  "const huntZoneSystem = require('./systems/huntZoneSystem');",
  "const bountyBoardSystem = require('./systems/bountyBoardSystem');",
  "const bossContractsSystem = require('./systems/bossContractsSystem');",
  "const relicSystem = require('./systems/relicSystem');",
  "const traitsSystem = require('./systems/traitsSystem');",
  "const eventShopSystem = require('./systems/eventShopSystem');",
  "const corruptedRaidSystem = require('./systems/corruptedRaidSystem');",
  "const bannerSystem = require('./systems/bannerSystem');"
];

for (const line of needed) {
  if (!s.includes(line)) {
    const firstRequire = s.search(/^const .+require\(.+\);/m);
    if (firstRequire >= 0) {
      s = line + '\n' + s;
    } else {
      s = line + '\n' + s;
    }
  }
}

fs.writeFileSync(indexPath, s, 'utf8');

console.log('✅ Fixed literal \\n in src/index.js');
console.log('Backup:', path.relative(ROOT, backup));

try {
  cp.execFileSync('node', ['--check', indexPath], { stdio:'pipe' });
  console.log('✅ Syntax OK: src/index.js');
} catch (err) {
  console.error('❌ Still syntax error in src/index.js');
  console.error(String(err.stderr || err.message || err).slice(0, 1500));
  console.log('\nSend this output:');
  console.log('head -n 30 src/index.js');
  process.exit(1);
}
