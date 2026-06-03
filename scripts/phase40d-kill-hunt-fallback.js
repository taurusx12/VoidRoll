// VoidRoll Reborn - Phase 40D Kill Clean Fallback For Hunt
// Fix: Hunt commands still hit "Command is registered but not implemented yet in clean launch build."

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');
const backup = path.join(process.cwd(), 'src', `index.backup-phase40d-kill-hunt-fallback-${Date.now()}.js`);
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
} else {
  console.log('✅ huntZoneSystem import already exists');
}

if (!s.includes('PHASE40D_ULTRA_EARLY_HUNT')) {
  let count = 0;
  s = s.replace(/client\.on\(['"]interactionCreate['"],\s*async\s*\((\w+)\)\s*=>\s*\{/g, (m, varName) => {
    count++;
    return `${m}
  // PHASE40D_ULTRA_EARLY_HUNT
  if (${varName}.isButton?.() && String(${varName}.customId || '').startsWith('hunt_')) {
    return huntZoneSystem.handleHuntCommand(${varName}, prisma).catch(err => {
      console.error('Hunt button error:', err);
      if (!${varName}.replied && !${varName}.deferred) ${varName}.reply({ content:'Hunt error. Check logs.', ephemeral:true }).catch(()=>{});
    });
  }
  if (${varName}.isChatInputCommand?.() && ['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(${varName}.commandName)) {
    return huntZoneSystem.handleHuntCommand(${varName}, prisma).catch(err => {
      console.error('Hunt command error:', err);
      if (!${varName}.replied && !${varName}.deferred) ${varName}.reply({ content:'Hunt error. Check logs.', ephemeral:true }).catch(()=>{});
    });
  }`;
  });
  console.log(`✅ Added ultra-early hunt handler: ${count}`);
} else {
  console.log('✅ Ultra-early hunt handler already exists');
}

const fallback = 'Command is registered but not implemented yet in clean launch build.';

if (!s.includes('PHASE40D_HUNT_BEFORE_CLEAN_FALLBACK')) {
  const guard = `
  // PHASE40D_HUNT_BEFORE_CLEAN_FALLBACK
  if (typeof commandName !== 'undefined' && ['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) {
    return huntZoneSystem.handleHuntCommand(i, prisma);
  }
  if (typeof interaction !== 'undefined' && interaction.isChatInputCommand?.() && ['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(interaction.commandName)) {
    return huntZoneSystem.handleHuntCommand(interaction, prisma);
  }
`;

  let inserted = 0;
  const idx = s.indexOf(fallback);
  if (idx !== -1) {
    const lineStart = s.lastIndexOf('\n', idx);
    s = s.slice(0, lineStart + 1) + guard + s.slice(lineStart + 1);
    inserted++;
  }

  console.log(`✅ Added hunt guard before clean fallback: ${inserted}`);
} else {
  console.log('✅ Clean fallback guard already exists');
}

if (!s.includes('PHASE40D_READY')) s = '// PHASE40D_READY\n' + s;

fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 40D applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Verify:');
console.log('grep -n "PHASE40D\\|Command is registered" src/index.js');
console.log('node --check src/index.js');
console.log('npm start');
