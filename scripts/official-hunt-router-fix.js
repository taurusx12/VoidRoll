// VoidRoll Reborn - Official Hunt Router Fix
// Clean fix for Hunt commands/buttons routing.
// This is not a gameplay patch. It only fixes src/index.js routing order.
// Run:
//   node scripts/official-hunt-router-fix.js
//   node --check src/index.js
//   npm start

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');
if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');
const backup = path.join(process.cwd(), 'src', `index.backup-official-hunt-router-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

const importLine = "const huntZoneSystem = require('./systems/huntZoneSystem');";
if (!s.includes(importLine)) {
  const requireLines = [...s.matchAll(/^const .+require\(.+\);$/gm)];
  if (requireLines.length) {
    const last = requireLines[requireLines.length - 1];
    const pos = last.index + last[0].length;
    s = s.slice(0, pos) + "\n" + importLine + s.slice(pos);
  } else {
    s = importLine + "\n" + s;
  }
  console.log('✅ Added huntZoneSystem import');
}

// 1) Official slash-command routing: directly after commandName is created.
if (!s.includes('// OFFICIAL_HUNT_COMMAND_ROUTE')) {
  s = s.replace(
    /const commandName = i\.commandName; const userId = i\.user\.id;/,
    `const commandName = i.commandName; const userId = i.user.id;
  // OFFICIAL_HUNT_COMMAND_ROUTE
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) {
    return huntZoneSystem.handleHuntCommand(i, prisma);
  }`
  );
  console.log('✅ Added official Hunt command route');
} else {
  console.log('✅ Official Hunt command route already exists');
}

// 2) Remove old late fallback hunt guard. It is not needed and makes the file messy.
s = s.replace(/\n\s*\/\/ PHASE40D_HUNT_BEFORE_CLEAN_FALLBACK[\s\S]*?if \(typeof interaction !== 'undefined'[\s\S]*?\}\n(?=\s*return i\.reply\('Command is registered but not implemented yet in clean launch build\.'\);)/, '\n');

// 3) Official button routing: replace the whole interactionCreate block at the bottom.
// Hunt buttons must NOT be deferred by the trade button handler.
// Hunt system will update/respond itself.
const interactionRegex = /client\.on\('interactionCreate', async i => \{\n[\s\S]*?\n\}\);\n\nclient\.once\(/;
const officialBlock = `client.on('interactionCreate', async i => {
  try {
    if (i.isAutocomplete()) return autocomplete(i);

    if (i.isButton()) {
      const customId = String(i.customId || '');

      if (customId.startsWith('hunt_')) {
        return huntZoneSystem.handleHuntCommand(i, prisma);
      }

      const [action, tradeId] = customId.split('_');
      if (action === 'accept' || action === 'decline') {
        await i.deferReply({ ephemeral:false }).catch(()=>{});
        if (action === 'accept') return completeTrade(i, tradeId);
        pendingTrades.delete(tradeId);
        return i.editReply('Trade declined.');
      }

      return;
    }

    if (!i.isChatInputCommand()) return;
    return command(i);
  } catch (err) {
    console.error(err);
    const msg = \`Error: \${String(err.message || err).slice(0,1500)}\`;
    if (i.deferred || i.replied) return i.editReply(msg).catch(()=>{});
    return i.reply({ content: msg, ephemeral:true }).catch(()=>{});
  }
});

// OFFICIAL_HUNT_BUTTON_ROUTE

client.once(`;

if (!interactionRegex.test(s)) {
  console.error('❌ Could not find interactionCreate block to replace.');
  console.log('Backup saved:', path.relative(process.cwd(), backup));
  process.exit(1);
}

s = s.replace(interactionRegex, officialBlock);
console.log('✅ Replaced interactionCreate with official router');

if (!s.includes('// OFFICIAL_HUNT_ROUTER_FIX')) {
  s = '// OFFICIAL_HUNT_ROUTER_FIX\n' + s;
}

fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Official Hunt Router Fix applied.');
console.log('Backup:', path.relative(process.cwd(), backup));
console.log('');
console.log('Verify:');
console.log('grep -n "OFFICIAL_HUNT\\|Command is registered\\|interactionCreate" src/index.js');
console.log('node --check src/index.js');
console.log('npm start');
