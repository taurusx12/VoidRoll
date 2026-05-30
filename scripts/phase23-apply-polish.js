// VoidRoll Reborn - Phase 23 Apply Polish Patch
// Run:
//   node scripts/phase23-apply-polish.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');
const deployPath = path.join(process.cwd(), 'scripts', 'deploy-commands-voidroll-reborn.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function patchOnce(find, replace, label) {
  if (s.includes(find)) {
    s = s.replace(find, replace);
    console.log(`✅ ${label}`);
  } else {
    console.log(`⚠️ skipped ${label}`);
  }
}

// Add polished command import.
patchOnce(
  "let handleVoidRollCommand = null;\nlet buildCommandContext = null;",
  "let handleVoidRollCommand = null;\nlet buildCommandContext = null;\nlet handlePolishedCommand = null;",
  "added polished var"
);

patchOnce(
  "({ buildCommandContext } = require('./systems/dbAdapter'));",
  "({ buildCommandContext } = require('./systems/dbAdapter'));\n  ({ handlePolishedCommand } = require('./systems/polishedCommands'));",
  "added polished require"
);

// Add polish command hook after disabled old commands check.
const hookFind = `if (OLD_DISABLED_COMMANDS.has(commandName)) {
    return i.reply({ content: disabledOldCommandMessage(commandName), ephemeral: true });
  }`;

const hookReplace = `if (OLD_DISABLED_COMMANDS.has(commandName)) {
    return i.reply({ content: disabledOldCommandMessage(commandName), ephemeral: true });
  }

  // Phase 23: polished commands override legacy handlers.
  if (handlePolishedCommand && ['roll','r','pack','banner','rates','rarity','pvp','story'].includes(commandName)) {
    const polishedHandled = await handlePolishedCommand(i);
    if (polishedHandled) return;
  }`;

patchOnce(hookFind, hookReplace, "added polished hook");

const backupPath = path.join(process.cwd(), 'src', `index.backup-phase23-${Date.now()}.js`);
fs.copyFileSync(indexPath, backupPath);
fs.writeFileSync(indexPath, s, 'utf8');
console.log(`✅ index.js patched. Backup: ${path.relative(process.cwd(), backupPath)}`);

// Fix /upgrade deploy command option order permanently.
if (fs.existsSync(deployPath)) {
  let d = fs.readFileSync(deployPath, 'utf8');

  const oldLine = "new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade character tree branch').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)).addStringOption(o => o.setName('branch').setDescription('Branch').setRequired(true).addChoices(...branchChoices))";
  const newLine = "new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade character tree branch').addStringOption(o => o.setName('branch').setDescription('Branch').setRequired(true).addChoices(...branchChoices)).addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false))";

  if (d.includes(oldLine)) {
    d = d.replace(oldLine, newLine);
    fs.writeFileSync(deployPath, d, 'utf8');
    console.log('✅ deploy command /upgrade order fixed');
  } else {
    console.log('⚠️ /upgrade exact line already fixed or not found');
  }
}

console.log('');
console.log('Next:');
console.log('node scripts/clear-all-discord-commands.js');
console.log('node scripts/deploy-commands-voidroll-reborn.js');
console.log('npm start');
