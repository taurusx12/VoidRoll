// VoidRoll Reborn - Phase 31 Remove Generic Passives From index.js
// Fixes old passive text like:
// Passive: DPS Mastery — DPS passive affects real battle stats.
// Run:
//   node scripts/phase31-remove-generic-passives.js
//   node --check src/index.js

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

const backup = path.join(process.cwd(), 'src', `index.backup-phase31-passives-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

// Add combat profile import.
if (!s.includes("require('./systems/characterCombatProfileSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (!s.includes(anchor)) {
    console.error('❌ Could not find prisma require anchor.');
    process.exit(1);
  }

  s = s.replace(anchor, `${anchor}
const combatProfiles = require('./systems/characterCombatProfileSystem');`);
  console.log('✅ added characterCombatProfileSystem import');
} else {
  console.log('✅ combat profile import already exists');
}

// Replace old index roleOf.
const roleRange = findFunctionRange(s, "function roleOf(c)");
if (roleRange) {
  s = s.slice(0, roleRange.start) + "function roleOf(c) { return combatProfiles.roleOf(c); }" + s.slice(roleRange.end);
  console.log('✅ replaced old roleOf in index.js');
} else {
  console.log('⚠️ roleOf(c) not found');
}

// Replace old index elementOf.
const elementRange = findFunctionRange(s, "function elementOf(c)");
if (elementRange) {
  s = s.slice(0, elementRange.start) + "function elementOf(c) { return combatProfiles.elementOf(c); }" + s.slice(elementRange.end);
  console.log('✅ replaced old elementOf in index.js');
} else {
  console.log('⚠️ elementOf(c) not found');
}

// Replace old index passiveOf.
const passiveRange = findFunctionRange(s, "function passiveOf(c)");
if (passiveRange) {
  const newPassive = `function passiveOf(c) {
  const p = combatProfiles.passiveOf(c);
  const effect = p.effect || {};
  const parts = [];

  if (effect.dmg) parts.push(\`+\${effect.dmg}% Damage\`);
  if (effect.teamDmg) parts.push(\`+\${effect.teamDmg}% Team Damage\`);
  if (effect.bossDmg) parts.push(\`+\${effect.bossDmg}% Boss Damage\`);
  if (effect.crit) parts.push(\`+\${effect.crit}% Crit\`);
  if (effect.dodge) parts.push(\`+\${effect.dodge}% Dodge\`);
  if (effect.shield) parts.push('Starts with Shield');
  if (effect.heal) parts.push(\`+\${effect.heal}% Healing\`);
  if (effect.lifesteal) parts.push(\`+\${effect.lifesteal}% Lifesteal\`);
  if (effect.counter) parts.push(\`+\${effect.counter}% Counter\`);
  if (effect.burn) parts.push(\`\${effect.burn}% Burn\`);
  if (effect.bleed) parts.push(\`\${effect.bleed}% Bleed\`);
  if (effect.poison) parts.push(\`\${effect.poison}% Poison\`);
  if (effect.freeze) parts.push(\`\${effect.freeze}% Freeze\`);
  if (effect.stun) parts.push(\`\${effect.stun}% Stun\`);
  if (effect.silence) parts.push(\`\${effect.silence}% Silence\`);
  if (effect.miss) parts.push(\`\${effect.miss}% Enemy Miss\`);
  if (effect.enemyAtk) parts.push(\`\${effect.enemyAtk}% Enemy ATK\`);
  if (effect.energyGain) parts.push(\`+\${effect.energyGain} Energy Gain\`);
  if (effect.energyDrain) parts.push(\`\${effect.energyDrain} Energy Drain\`);
  if (effect.execute) parts.push(\`\${effect.execute}% Execute\`);
  if (effect.summon) parts.push('Summon Assist');

  return {
    name: p.name || 'Anime Passive',
    text: parts.length ? parts.join(' • ') : 'Combat passive active in battle.',
    effect
  };
}`;
  s = s.slice(0, passiveRange.start) + newPassive + s.slice(passiveRange.end);
  console.log('✅ replaced old passiveOf in index.js');
} else {
  console.log('⚠️ passiveOf(c) not found');
}

// Remove literal old generic phrase if it somehow remains.
s = s.replace(/DPS Mastery/g, 'Anime Passive');
s = s.replace(/DPS passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
s = s.replace(/Tank Mastery/g, 'Anime Passive');
s = s.replace(/Support Mastery/g, 'Anime Passive');
s = s.replace(/Control Mastery/g, 'Anime Passive');
s = s.replace(/Assassin Mastery/g, 'Anime Passive');
s = s.replace(/Mage Mastery/g, 'Anime Passive');

if (!s.includes('PHASE31_GENERIC_PASSIVES_REMOVED')) {
  s = s.replace(
    '// VOIDROLL_CLEAN_INDEX_VERSION',
    '// PHASE31_GENERIC_PASSIVES_REMOVED\n// VOIDROLL_CLEAN_INDEX_VERSION'
  );
  if (!s.includes('PHASE31_GENERIC_PASSIVES_REMOVED')) {
    s = '// PHASE31_GENERIC_PASSIVES_REMOVED\n' + s;
  }
}

fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 31 generic passive cleanup applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Verify:');
console.log('grep -n "DPS Mastery\\|passive affects real battle stats\\|PHASE31_GENERIC_PASSIVES_REMOVED" src/index.js');
console.log('');
console.log('Then run:');
console.log('node --check src/index.js');
console.log('npm start');
