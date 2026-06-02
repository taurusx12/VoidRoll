// VoidRoll Reborn - Phase 29 Hook Combat Profiles Into Battle
// Patches battlePolishSystem.js to use characterCombatProfileSystem for role/element/passive.
// Run:
//   node scripts/phase29-hook-combat-profiles.js

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'systems', 'battlePolishSystem.js');

if (!fs.existsSync(file)) {
  console.error('❌ src/systems/battlePolishSystem.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');

if (!s.includes("require('./characterCombatProfileSystem')")) {
  s = s.replace(
    "const { prisma } = require('../lib/db');",
    "const { prisma } = require('../lib/db');\nconst combatProfiles = require('./characterCombatProfileSystem');"
  );
  console.log('✅ added characterCombatProfileSystem import');
} else {
  console.log('✅ combat profile import already exists');
}

// Replace function bodies in a targeted way.
function replaceFunction(name, body) {
  const sig = `function ${name}(c={})`;
  const start = s.indexOf(sig);
  if (start === -1) {
    console.log(`⚠️ ${name} not found`);
    return;
  }
  const brace = s.indexOf('{', start);
  let depth = 0;
  for (let i=brace; i<s.length; i++) {
    if (s[i] === '{') depth++;
    if (s[i] === '}') depth--;
    if (depth === 0) {
      s = s.slice(0, start) + body + s.slice(i+1);
      console.log(`✅ replaced ${name}`);
      return;
    }
  }
}

replaceFunction('roleOf', "function roleOf(c={}) { return combatProfiles.roleOf(c); }");
replaceFunction('elementOf', "function elementOf(c={}) { return combatProfiles.elementOf(c); }");
replaceFunction('passiveOf', "function passiveOf(c={}) { return combatProfiles.passiveOf(c); }");

if (!s.includes('PHASE29_COMBAT_PROFILE_HOOKED')) {
  s = s.replace(
    "// VoidRoll Reborn - Phase 24 Battle Polish System V2",
    "// VoidRoll Reborn - Phase 24 Battle Polish System V2\n// PHASE29_COMBAT_PROFILE_HOOKED"
  );
}

const backup = path.join(process.cwd(), 'src', 'systems', `battlePolishSystem.backup-phase29-${Date.now()}.js`);
fs.copyFileSync(file, backup);
fs.writeFileSync(file, s, 'utf8');

console.log('');
console.log('✅ Phase 29 combat profile hook applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Run:');
console.log('node --check src/systems/battlePolishSystem.js');
console.log('node scripts/phase29-character-combat-audit.js');
