// VoidRoll Reborn - Phase 29 Syntax Fix
// Fixes malformed functions caused by hook script:
// function roleOf(c={}) { return combatProfiles.roleOf(c); }) {
// Run:
//   node scripts/phase29-fix-battle-syntax.js
//   node --check src/systems/battlePolishSystem.js

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'systems', 'battlePolishSystem.js');

if (!fs.existsSync(file)) {
  console.error('❌ src/systems/battlePolishSystem.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');

const backup = path.join(process.cwd(), 'src', 'systems', `battlePolishSystem.backup-phase29-syntax-${Date.now()}.js`);
fs.copyFileSync(file, backup);

function replaceMalformed(name, call) {
  const re = new RegExp(`function ${name}\\(c=\\{\\}\\) \\{ return combatProfiles\\.${call}\\(c\\); \\}\\) \\{[\\s\\S]*?\\n\\}`, 'm');
  if (re.test(s)) {
    s = s.replace(re, `function ${name}(c={}) { return combatProfiles.${call}(c); }`);
    console.log(`✅ fixed malformed ${name}`);
    return;
  }

  const re2 = new RegExp(`function ${name}\\(c=\\{\\}\\) \\{ return combatProfiles\\.${call}\\(c\\); \\}\\) \\{`, 'm');
  if (re2.test(s)) {
    s = s.replace(re2, `function ${name}(c={}) { return combatProfiles.${call}(c); }\n/* removed old ${name} body */\nif (false) {`);
    console.log(`✅ guarded malformed ${name}`);
    return;
  }

  console.log(`⚠️ malformed ${name} not found or already fixed`);
}

replaceMalformed('roleOf', 'roleOf');
replaceMalformed('elementOf', 'elementOf');
replaceMalformed('passiveOf', 'passiveOf');

// Strong cleanup: if old bodies survived after the fixed one, remove the most common leftovers.
s = s.replace(/function roleOf\(c=\{\}\) \{ return combatProfiles\.roleOf\(c\); \}\)\s*\{/g, "function roleOf(c={}) { return combatProfiles.roleOf(c); }\nif (false) {");
s = s.replace(/function elementOf\(c=\{\}\) \{ return combatProfiles\.elementOf\(c\); \}\)\s*\{/g, "function elementOf(c={}) { return combatProfiles.elementOf(c); }\nif (false) {");
s = s.replace(/function passiveOf\(c=\{\}\) \{ return combatProfiles\.passiveOf\(c\); \}\)\s*\{/g, "function passiveOf(c={}) { return combatProfiles.passiveOf(c); }\nif (false) {");

if (!s.includes('PHASE29_SYNTAX_FIXED')) {
  s = s.replace(
    '// PHASE29_COMBAT_PROFILE_HOOKED',
    '// PHASE29_COMBAT_PROFILE_HOOKED\n// PHASE29_SYNTAX_FIXED'
  );
}

fs.writeFileSync(file, s, 'utf8');

console.log('');
console.log('✅ Phase 29 syntax fix applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Now run:');
console.log('node --check src/systems/battlePolishSystem.js');
