// VoidRoll Reborn - Phase 24 Battle Polish V2 Apply
// Run:
//   node scripts/phase24-apply-battle-polish-v2.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

if (!s.includes("require('./systems/battlePolishSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (s.includes(anchor)) {
    s = s.replace(anchor, `${anchor}
const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');`);
    console.log('✅ added battlePolishSystem require');
  } else {
    console.log('❌ could not find prisma require anchor');
    process.exit(1);
  }
} else {
  console.log('✅ battlePolishSystem require already exists');
}

if (!s.includes('PHASE24_BATTLE_POLISH_V2_HOOK')) {
  const oldDisabledBlock = `if (OLD_DISABLED_COMMANDS.has(commandName)) {
    return i.reply({ content: disabledOldCommandMessage(commandName), ephemeral: true });
  }`;

  const hook = `${oldDisabledBlock}

  // PHASE24_BATTLE_POLISH_V2_HOOK
  if (['story','pvp','dungeon','world-boss','raid','raid-attack','raid-rank'].includes(commandName)) {
    const battleHandled = await handleBattlePolishCommand(i);
    if (battleHandled) return;
  }`;

  if (s.includes(oldDisabledBlock)) {
    s = s.replace(oldDisabledBlock, hook);
    console.log('✅ inserted hook after old disabled commands block');
  } else {
    const startPattern = /async function command\(i\) \{\s*const commandName = i\.commandName; const userId = i\.user\.id; await ensureUser\(i\.user\);/;
    const match = s.match(startPattern);
    if (match) {
      s = s.replace(match[0], `${match[0]}

  // PHASE24_BATTLE_POLISH_V2_HOOK
  if (['story','pvp','dungeon','world-boss','raid','raid-attack','raid-rank'].includes(commandName)) {
    const battleHandled = await handleBattlePolishCommand(i);
    if (battleHandled) return;
  }`);
      console.log('✅ inserted hook after command start');
    } else {
      console.log('❌ could not find command function insertion point');
      process.exit(1);
    }
  }
} else {
  console.log('✅ battle hook already exists');
}

// Remove battle commands from NEW_ROUTER_COMMANDS so commandRouter does not steal them before battle polish.
s = s.replace(/'world-boss',\n\s*'raid',\n\s*'raid-attack',\n\s*'raid-rank',\n\s*'raid-rewards',/g, "'raid-rewards',");
s = s.replace(/'dungeon',\n\s*'dungeon-status',/g, "'dungeon-status',");

if (s.includes("client.once('ready'")) {
  s = s.replace("client.once('ready'", "client.once('clientReady'");
  console.log('✅ fixed ready warning');
}

const backup = path.join(process.cwd(), 'src', `index.backup-phase24-v2-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);
fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 24 Battle Polish V2 applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Now run: npm start');
