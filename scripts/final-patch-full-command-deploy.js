// VoidRoll Reborn — FINAL PATCH: make full launch commands appear in Discord
// Re-inserts all full launch commandDefinitions into phase27 deploy and dedupes by name.
// Run:
//   node scripts/final-patch-full-command-deploy.js
//   node --check scripts/phase27-fast-guild-deploy.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js

const fs = require('fs');
const path = require('path');

const deployPath = path.join(process.cwd(), 'scripts', 'phase27-fast-guild-deploy.js');
if (!fs.existsSync(deployPath)) {
  console.error('❌ scripts/phase27-fast-guild-deploy.js not found');
  process.exit(1);
}

let s = fs.readFileSync(deployPath, 'utf8');
const backup = path.join(process.cwd(), 'scripts', `phase27-fast-guild-deploy.backup-final-full-commands-${Date.now()}.js`);
fs.copyFileSync(deployPath, backup);

s = s.replace(/const\s+commands\s*=\s*\[/, 'let commands = [');

const defBlock = `
// FINAL_FULL_LAUNCH_COMMAND_DEFINITIONS
const finalFullLaunchCommands = [
  ...require('../src/systems/rollBankSystem').commandDefinitions(),
  ...require('../src/systems/huntZoneSystem').commandDefinitions(),
  ...require('../src/systems/bountyBoardSystem').commandDefinitions(),
  ...require('../src/systems/bossContractsSystem').commandDefinitions(),
  ...require('../src/systems/relicSystem').commandDefinitions(),
  ...require('../src/systems/traitsSystem').commandDefinitions(),
  ...require('../src/systems/eventShopSystem').commandDefinitions(),
  ...require('../src/systems/corruptedRaidSystem').commandDefinitions(),
  ...require('../src/systems/bannerSystem').commandDefinitions(),
];
`;

if (!s.includes('FINAL_FULL_LAUNCH_COMMAND_DEFINITIONS')) {
  s = defBlock + '\n' + s;
  console.log('✅ Added finalFullLaunchCommands definition');
} else {
  console.log('✅ finalFullLaunchCommands already exists');
}

if (!s.includes('...finalFullLaunchCommands')) {
  const pos = s.indexOf('let commands = [');
  if (pos === -1) {
    console.error('❌ commands array not found');
    process.exit(1);
  }
  const b = s.indexOf('[', pos) + 1;
  s = s.slice(0, b) + '\n  ...finalFullLaunchCommands,\n' + s.slice(b);
  console.log('✅ Inserted finalFullLaunchCommands into commands array');
} else {
  console.log('✅ finalFullLaunchCommands already inserted');
}

if (!s.includes('FINAL_DEDUPE_COMMAND_NAMES')) {
  const pos = s.indexOf('let commands = [');
  const bracketStart = s.indexOf('[', pos);
  let depth = 0, quote = null, esc = false, end = -1;

  for (let i = bracketStart; i < s.length; i++) {
    const ch = s[i];

    if (quote) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    console.error('❌ Could not find commands array end');
    process.exit(1);
  }

  let insertAt = end + 1;
  if (s[insertAt] === ';') insertAt++;

  const dedupe = `

// FINAL_DEDUPE_COMMAND_NAMES
{
  const seen = new Set();
  const before = commands.length;
  const removed = [];
  commands = commands.filter(cmd => {
    if (!cmd || !cmd.name) return false;
    if (seen.has(cmd.name)) {
      removed.push(cmd.name);
      return false;
    }
    seen.add(cmd.name);
    return true;
  });
  if (removed.length) console.log('⚠️ Removed duplicate command names:', [...new Set(removed)].join(', '));
  console.log(\`✅ Commands deduped: \${before} → \${commands.length}\`);
}
`;
  s = s.slice(0, insertAt) + dedupe + s.slice(insertAt);
  console.log('✅ Added command dedupe');
} else {
  console.log('✅ Command dedupe already exists');
}

fs.writeFileSync(deployPath, s, 'utf8');

console.log('');
console.log('✅ Deploy patch applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Next:');
console.log('node --check scripts/phase27-fast-guild-deploy.js');
console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
