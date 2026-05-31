// VoidRoll Reborn - Phase 28 Replace progressBattle Completely
const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function findFunctionRange(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return { start, end: i + 1 };
  }
  return null;
}

if (!s.includes("require('./systems/battlePolishSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (!s.includes(anchor)) throw new Error('Could not find prisma require anchor.');
  s = s.replace(anchor, `${anchor}
const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');`);
  console.log('✅ Added battlePolishSystem require');
} else {
  console.log('✅ battlePolishSystem require exists');
}

const range = findFunctionRange(s, "async function progressBattle(i, mode)");
if (range) {
  const newFn = `async function progressBattle(i, mode) {
  // PHASE28_PROGRESSBATTLE_REPLACED
  return handleBattlePolishCommand(i);
}`;
  s = s.slice(0, range.start) + newFn + s.slice(range.end);
  console.log('✅ Replaced old progressBattle function completely');
} else {
  console.log('⚠️ progressBattle function not found');
}

if (!s.includes('PHASE28_TOP_BATTLE_FORCE')) {
  const pattern = /async function command\(i\) \{\s*/;
  if (!pattern.test(s)) throw new Error('Could not find async function command(i).');
  s = s.replace(pattern, `async function command(i) {
  // PHASE28_TOP_BATTLE_FORCE
  if (['story','dungeon','pvp','world-boss','raid','raid-attack','raid-rank'].includes(i.commandName)) {
    return handleBattlePolishCommand(i);
  }

`);
  console.log('✅ Added top battle force hook');
} else {
  console.log('✅ Phase28 top force hook already exists');
}

s = s.replace(
  "if (['story','tower','dungeon'].includes(commandName)) return progressBattle(i,commandName);",
  "if (commandName === 'tower') return i.reply({ content:'❌ /tower is disabled. Use /story or /dungeon.', ephemeral:true });"
);

s = s.replace("client.once('ready'", "client.once('clientReady'");

if (!s.includes('PHASE28_CRASH_GUARD')) {
  const anchor = "const pendingTrades = global.pendingTrades || new Map();";
  if (s.includes(anchor)) {
    s = s.replace(anchor, `// PHASE28_CRASH_GUARD
client.on('error', err => {
  if (err?.code === 10062) return console.warn('Ignored expired Discord interaction.');
  console.error('Discord client error:', err);
});
process.on('unhandledRejection', err => {
  if (err?.code === 10062) return console.warn('Ignored expired Discord interaction.');
  console.error('Unhandled rejection:', err);
});

${anchor}`);
    console.log('✅ Added crash guards');
  }
}

const backup = path.join(process.cwd(), 'src', `index.backup-phase28-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);
fs.writeFileSync(indexPath, s, 'utf8');

const pkgPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.scripts = pkg.scripts || {};
  pkg.scripts.start = 'node src/index.js';
  pkg.scripts['commands:deploy'] = 'echo skip command deploy';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), 'utf8');
  console.log('✅ package.json start fixed and command deploy disabled');
}

console.log('');
console.log('✅ Phase 28 applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('Verify with: grep -n "PHASE28_PROGRESSBATTLE_REPLACED\\|Team Score\\|progressBattle(i,commandName)" src/index.js');
console.log('Then run: npm start');
