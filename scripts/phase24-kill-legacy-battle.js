// VoidRoll Reborn - Kill Legacy Battle Handlers
// This removes the old /story /dungeon /pvp handlers that show Team Score / Required.
// Run:
//   node scripts/phase24-kill-legacy-battle.js
//   npm start

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function backup() {
  const backupPath = path.join(process.cwd(), 'src', `index.backup-kill-legacy-battle-${Date.now()}.js`);
  fs.copyFileSync(indexPath, backupPath);
  console.log(`Backup: ${path.relative(process.cwd(), backupPath)}`);
}

function patchContains(find, replace, label) {
  if (s.includes(find)) {
    s = s.replace(find, replace);
    console.log(`✅ ${label}`);
    return true;
  }
  console.log(`⚠️ skipped ${label}`);
  return false;
}

// Ensure require exists.
if (!s.includes("require('./systems/battlePolishSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (!s.includes(anchor)) {
    console.error('❌ Could not find prisma require anchor.');
    process.exit(1);
  }
  s = s.replace(anchor, `${anchor}
const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');`);
  console.log('✅ Added battlePolishSystem require');
} else {
  console.log('✅ battlePolishSystem require exists');
}

// Force hook at very top of command(i).
if (!s.includes('PHASE24_KILL_LEGACY_BATTLE_FORCE')) {
  const pattern = /async function command\(i\) \{\s*/;
  if (!pattern.test(s)) {
    console.error('❌ Could not find async function command(i).');
    process.exit(1);
  }
  s = s.replace(pattern, `async function command(i) {
  // PHASE24_KILL_LEGACY_BATTLE_FORCE
  if (['story','dungeon','pvp','world-boss','raid','raid-attack','raid-rank'].includes(i.commandName)) {
    return handleBattlePolishCommand(i);
  }

`);
  console.log('✅ Inserted force battle hook at top of command(i)');
} else {
  console.log('✅ Force hook already exists');
}

// Kill old story/tower/dungeon line.
patchContains(
  "if (['story','tower','dungeon'].includes(commandName)) return progressBattle(i,commandName);",
  "if (commandName === 'tower') return i.reply({ content:'❌ /tower is disabled in VoidRoll Reborn. Use /dungeon or /story.', ephemeral:true });",
  "removed legacy story/dungeon progressBattle route"
);

// Kill old pvp block using regex.
const oldPvpRegex = /if \(commandName === 'pvp'\) \{[\s\S]*?return i\.editReply\(`\*\*PVP \$\{win\?'WIN':'LOSE'\}\*\*[\s\S]*?Roles matter: Tank\/Support\/Control give real bonuses\.`\); \}/;
if (oldPvpRegex.test(s)) {
  s = s.replace(oldPvpRegex, "if (commandName === 'pvp') return handleBattlePolishCommand(i);");
  console.log('✅ removed legacy pvp block');
} else {
  console.log('⚠️ skipped legacy pvp block regex');
}

// Kill old boss-rush block if still there.
const oldBossRushRegex = /if \(commandName === 'boss-rush'\) \{[\s\S]*?return i\.editReply\(`\*\*Boss Rush\*\*[\s\S]*?Rolls scale with damage\.`\); \}/;
if (oldBossRushRegex.test(s)) {
  s = s.replace(oldBossRushRegex, "if (commandName === 'boss-rush') return i.reply({ content:'❌ /boss-rush is disabled. Use /world-boss and /raid-attack.', ephemeral:true });");
  console.log('✅ disabled legacy boss-rush block');
} else {
  console.log('⚠️ skipped legacy boss-rush block regex');
}

// Make old progressBattle visibly disabled if somehow called by another old command.
if (!s.includes('PHASE24_PROGRESS_BATTLE_DISABLED_GUARD')) {
  const progressPattern = /async function progressBattle\(i, mode\) \{/;
  if (progressPattern.test(s)) {
    s = s.replace(progressPattern, `async function progressBattle(i, mode) {
  // PHASE24_PROGRESS_BATTLE_DISABLED_GUARD
  if (mode === 'story' || mode === 'dungeon' || mode === 'pvp') {
    return handleBattlePolishCommand(i);
  }
`);
    console.log('✅ guarded old progressBattle');
  } else {
    console.log('⚠️ progressBattle function not found');
  }
}

// Fix ready warning.
s = s.replace("client.once('ready'", "client.once('clientReady'");

// Write.
backup();
fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Legacy battle handlers killed.');
console.log('');
console.log('Verify with:');
console.log("grep -n \"progressBattle(i,commandName)\\|STORY VICTORY\\|Team Score\\|PHASE24_KILL_LEGACY\" src/index.js");
console.log('');
console.log('Then run: npm start');
