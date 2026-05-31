// VoidRoll Reborn - Phase 24 FORCE Battle Hook
// This forces /story /pvp /dungeon /world-boss /raid /raid-attack /raid-rank
// to use battlePolishSystem BEFORE legacy handlers.
// Run:
//   node scripts/phase24-force-battle-hook.js
//   npm start

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

// 1) Ensure require exists.
if (!s.includes("require('./systems/battlePolishSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (!s.includes(anchor)) {
    console.error('❌ Could not find prisma require anchor.');
    process.exit(1);
  }

  s = s.replace(
    anchor,
    `${anchor}
const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');`
  );
  console.log('✅ Added battlePolishSystem require.');
} else {
  console.log('✅ battlePolishSystem require already exists.');
}

// 2) Remove older weak hooks to avoid confusion.
s = s.replace(/\/\/ PHASE24_BATTLE_POLISH_V2_HOOK[\s\S]*?if \(battleHandled\) return;\s*\}/g, '');
s = s.replace(/\/\/ Phase 24: battle polish overrides old story\/pvp\/dungeon\/raid handlers\.[\s\S]*?if \(battleHandled\) return;\s*\}/g, '');

// 3) Insert FORCE hook immediately at the top of command(i), before ensureUser and before any legacy logic.
if (!s.includes('PHASE24_FORCE_BATTLE_HOOK')) {
  const pattern = /async function command\(i\) \{\s*/;

  if (!pattern.test(s)) {
    console.error('❌ Could not find async function command(i).');
    process.exit(1);
  }

  s = s.replace(pattern, `async function command(i) {
  // PHASE24_FORCE_BATTLE_HOOK
  if (['story','pvp','dungeon','world-boss','raid','raid-attack','raid-rank'].includes(i.commandName)) {
    return handleBattlePolishCommand(i);
  }

`);
  console.log('✅ Inserted FORCE battle hook at very top of command(i).');
} else {
  console.log('✅ FORCE hook already exists.');
}

// 4) Remove story/pvp from polishedCommands hook if present, so it cannot steal them.
s = s.replace(
  "['roll','r','pack','banner','rates','rarity','pvp','story'].includes(commandName)",
  "['roll','r','pack','banner','rates','rarity'].includes(commandName)"
);

// 5) Remove dungeon/world-boss/raid from NEW_ROUTER_COMMANDS list if present.
s = s.replace(/'world-boss',\s*\n\s*'raid',\s*\n\s*'raid-attack',\s*\n\s*'raid-rank',\s*\n/g, '');
s = s.replace(/'dungeon',\s*\n/g, '');

// 6) Fix ready warning if still exists.
s = s.replace("client.once('ready'", "client.once('clientReady'");

const backupPath = path.join(process.cwd(), 'src', `index.backup-force-battle-${Date.now()}.js`);
fs.copyFileSync(indexPath, backupPath);
fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Force Battle Hook applied.');
console.log(`Backup: ${path.relative(process.cwd(), backupPath)}`);
console.log('');
console.log('Now run: npm start');
