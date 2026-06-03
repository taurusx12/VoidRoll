// VoidRoll Reborn - Phase 40B Force Hunt Hook
// Fixes: /hunt says "Command is registered but not implemented yet in clean launch build."
// Run:
//   node scripts/phase40b-force-hunt-hook.js
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
const backup = path.join(process.cwd(), 'src', `index.backup-phase40b-force-hunt-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

const importLine = "const huntZoneSystem = require('./systems/huntZoneSystem');";
if (!s.includes(importLine)) {
  const anchors = [
    "const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');",
    "const { prisma } = require('./lib/db');"
  ];
  let added = false;
  for (const a of anchors) {
    if (s.includes(a)) {
      s = s.replace(a, `${a}\n${importLine}`);
      added = true;
      break;
    }
  }
  if (!added) {
    s = `${importLine}\n${s}`;
  }
  console.log('✅ Added huntZoneSystem import');
} else {
  console.log('✅ huntZoneSystem import already exists');
}

// Button handler must happen before "if (!i.isChatInputCommand()) return;"
if (!s.includes('PHASE40B_FORCE_HUNT_BUTTON')) {
  const anchor = "if (!i.isChatInputCommand()) return;";
  const insert = `if (i.isButton?.() && String(i.customId || '').startsWith('hunt_')) {
    return huntZoneSystem.handleHuntCommand(i, prisma).catch(err => {
      console.error('Hunt button error:', err);
      if (!i.replied && !i.deferred) i.reply({ content:'Hunt error. Check logs.', ephemeral:true }).catch(()=>{});
    });
  }
  // PHASE40B_FORCE_HUNT_BUTTON
  ${anchor}`;
  if (s.includes(anchor)) {
    s = s.replace(anchor, insert);
    console.log('✅ Inserted hunt button handler before chat-input guard');
  } else {
    console.log('⚠️ Could not find chat-input guard anchor');
  }
} else {
  console.log('✅ Hunt button handler already exists');
}

// Slash command handler must happen immediately after commandName is known.
if (!s.includes('PHASE40B_FORCE_HUNT_COMMAND')) {
  const anchor = "const commandName = i.commandName;";
  const insert = `${anchor}
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) {
    return huntZoneSystem.handleHuntCommand(i, prisma);
  }
  // PHASE40B_FORCE_HUNT_COMMAND`;
  if (s.includes(anchor)) {
    s = s.replace(anchor, insert);
    console.log('✅ Inserted hunt command handler after commandName');
  } else {
    console.log('⚠️ Could not find commandName anchor');
  }
} else {
  console.log('✅ Hunt command handler already exists');
}

// Extra safety: if clean-launch fallback is reached, intercept hunt before it replies.
const fallbackText = "Command is registered but not implemented yet in clean launch build.";
if (s.includes(fallbackText) && !s.includes('PHASE40B_CLEAN_FALLBACK_GUARD')) {
  const guard = `if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) {
    return huntZoneSystem.handleHuntCommand(i, prisma);
  }
  // PHASE40B_CLEAN_FALLBACK_GUARD
  `;
  s = s.replace(/return\s+i\.reply\((\{[^;]*Command is registered but not implemented yet in clean launch build\.[\s\S]*?\}|['"`]Command is registered but not implemented yet in clean launch build\.['"`])\);/g, `${guard}return i.reply($1);`);
  console.log('✅ Added clean fallback guard for hunt commands');
} else if (s.includes('PHASE40B_CLEAN_FALLBACK_GUARD')) {
  console.log('✅ Clean fallback guard already exists');
} else {
  console.log('ℹ️ Clean fallback text not found');
}

if (!s.includes('PHASE40B_FORCE_HUNT_READY')) s = '// PHASE40B_FORCE_HUNT_READY\n' + s;

fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 40B applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Verify:');
console.log('grep -n "PHASE40B_FORCE_HUNT\\|clean launch" src/index.js');
console.log('node --check src/index.js');
console.log('npm start');
