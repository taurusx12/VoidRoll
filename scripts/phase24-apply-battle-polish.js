// VoidRoll Reborn - Phase 24 Apply Battle Polish
// Run:
//   node scripts/phase24-apply-battle-polish.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function patch(find, replace, label) {
  if (s.includes(find)) {
    s = s.replace(find, replace);
    console.log(`✅ ${label}`);
  } else {
    console.log(`⚠️ skipped ${label}`);
  }
}

patch(
  "let handlePolishedCommand = null;",
  "let handlePolishedCommand = null;\nlet handleBattlePolishCommand = null;",
  "added battle variable"
);

patch(
  "({ handlePolishedCommand } = require('./systems/polishedCommands'));",
  "({ handlePolishedCommand } = require('./systems/polishedCommands'));\n  ({ handleBattlePolishCommand } = require('./systems/battlePolishSystem'));",
  "added battle require"
);

const findHook = `// Phase 23: polished commands override legacy handlers.
  if (handlePolishedCommand && ['roll','r','pack','banner','rates','rarity','pvp','story'].includes(commandName)) {
    const polishedHandled = await handlePolishedCommand(i);
    if (polishedHandled) return;
  }`;

const replaceHook = `// Phase 24: battle polish overrides old story/pvp/dungeon/raid handlers.
  if (handleBattlePolishCommand && ['story','pvp','dungeon','world-boss','raid','raid-attack','raid-rank'].includes(commandName)) {
    const battleHandled = await handleBattlePolishCommand(i);
    if (battleHandled) return;
  }

  // Phase 23: polished commands override legacy handlers.
  if (handlePolishedCommand && ['roll','r','pack','banner','rates','rarity'].includes(commandName)) {
    const polishedHandled = await handlePolishedCommand(i);
    if (polishedHandled) return;
  }`;

patch(findHook, replaceHook, "added battle hook before polished commands");

// Ensure new router commands do not steal dungeon/raid before battlePolish.
s = s.replace("'dungeon',\n]);", "'dungeon-status',\n  'dungeon-choose',\n  'dungeon-abandon',\n]);");

const backup = path.join(process.cwd(), 'src', `index.backup-phase24-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);
fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 24 Battle Polish applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Next: npm start');
