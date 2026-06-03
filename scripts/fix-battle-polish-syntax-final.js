// VoidRoll Reborn — Fix battlePolishSystem syntax after final repair
// Fixes:
//   SyntaxError: Unexpected token ')' in src/systems/battlePolishSystem.js
// Also keeps accurate passives and removes the generic DPS passive text.
//
// Run:
//   node scripts/fix-battle-polish-syntax-final.js
//   node --check src/systems/battlePolishSystem.js
//   node --check src/systems/characterCombatProfileSystem.js 2>/dev/null || true
//   node --check src/index.js
//   npm start

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

const PASSIVE_HELPER = `function getAccuratePassive(c={}) {
  const n = String(c.name || '').toLowerCase();

  if (n.includes('lelouch')) return { name:'Geass Command', text:'30% chance to stun and reduce enemy damage.', effect:{ stun:30, enemyAtk:-12, control:20 } };
  if (n.includes('aizen')) return { name:'Kyoka Suigetsu', text:'Illusion pressure: enemy miss chance, enemy ATK down, and higher control accuracy.', effect:{ miss:25, enemyAtk:-15, control:22, dmg:8 } };
  if (n.includes('itachi')) return { name:'Tsukuyomi', text:'Genjutsu control: enemy miss chance, control accuracy, and execute pressure.', effect:{ miss:18, control:25, execute:10, dmg:8 } };
  if (n.includes('ainz')) return { name:'The Goal of All Life', text:'Dark magic dominance: boss damage, penetration, and death pressure.', effect:{ bossDmg:22, pen:12, dmg:10 } };
  if (n.includes('rimuru')) return { name:'Predator', text:'Adapts by absorbing power: lifesteal, penetration, and skill damage.', effect:{ lifesteal:14, pen:10, dmg:12 } };
  if (n.includes('makima')) return { name:'Control Devil', text:'Dominates enemies: enemy ATK down and team damage up.', effect:{ teamDmg:12, enemyAtk:-16, control:18 } };
  if (n.includes('gojo') || n.includes('gojou')) return { name:'Infinity', text:'Nullifies the first heavy hit, increases dodge, and boosts burst damage.', effect:{ shield:1, dodge:18, dmg:10 } };
  if (n.includes('eren')) return { name:'Titan Rage', text:'Gains defense and damage under pressure, with bonus boss damage.', effect:{ def:14, dmg:12, bossDmg:10 } };
  if (n.includes('saber') || n.includes('artoria')) return { name:'Excalibur', text:'Light burst finisher: anti-boss damage and defensive barrier.', effect:{ bossDmg:18, def:12, dmg:8 } };
  if (n.includes('all might') || n.includes('toshinori')) return { name:'Plus Ultra', text:'Heroic last stand: defense, team protection, and smash damage.', effect:{ def:18, teamDmg:8, dmg:12 } };

  return null;
}`;

const ROLE_FN = `function roleOf(c={}) {
  try {
    if (combatProfiles && typeof combatProfiles.roleOf === 'function') return combatProfiles.roleOf(c);
  } catch {}
  return c.role || c.combatRole || 'DPS';
}`;

const ELEMENT_FN = `function elementOf(c={}) {
  try {
    if (combatProfiles && typeof combatProfiles.elementOf === 'function') return combatProfiles.elementOf(c);
  } catch {}
  return c.element || c.type || 'NEUTRAL';
}`;

const PASSIVE_FN = `${PASSIVE_HELPER}

function passiveOf(c={}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;

  try {
    if (combatProfiles && typeof combatProfiles.passiveOf === 'function') {
      const p = combatProfiles.passiveOf(c);
      if (p && !String(p.name || '').includes('DPS Combat Style') && !String(p.text || '').includes('DPS passive gives')) return p;
    }
  } catch {}

  const role = roleOf(c);
  return { name:\`\${role} Combat Style\`, text:\`\${role} passive gives a small real battle bonus.\`, effect:{ dmg:6 } };
}`;

function replaceByNextFunction(src, name, replacement) {
  const re = new RegExp(`function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return src;

  const start = m.index;
  const nextRe = /\n(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/g;
  nextRe.lastIndex = start + 1;
  const next = nextRe.exec(src);
  const end = next ? next.index : src.length;

  return src.slice(0, start) + replacement + '\n\n' + src.slice(end);
}

function cleanupBadFragments(src) {
  // The previous patch sometimes left a line like "}) {" after replacing passiveOf.
  src = src.replace(/\n\s*\}\)\s*\{\s*\n/g, '\n');
  src = src.replace(/\n\s*\)\s*\{\s*\n/g, '\n');

  // Clean generic labels.
  src = src.replace(/DPS Mastery/g, 'Character Mastery');
  src = src.replace(/DPS Combat Style/g, 'Character Combat Style');
  src = src.replace(/DPS passive affects real battle stats\./g, 'Character passive affects real battle stats.');
  src = src.replace(/DPS passive gives a small real battle bonus\./g, 'Character passive gives a small real battle bonus.');

  return src;
}

function patchFile(file) {
  if (!fs.existsSync(file)) return false;

  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  const backup = `${file}.backup-syntax-final-${Date.now()}.js`;
  fs.copyFileSync(file, backup);

  s = replaceByNextFunction(s, 'roleOf', ROLE_FN);
  s = replaceByNextFunction(s, 'elementOf', ELEMENT_FN);
  s = replaceByNextFunction(s, 'getAccuratePassive', PASSIVE_HELPER);
  s = replaceByNextFunction(s, 'passiveOf', PASSIVE_FN);
  s = cleanupBadFragments(s);

  fs.writeFileSync(file, s, 'utf8');

  console.log(`✅ Patched ${path.relative(ROOT, file)}`);
  console.log(`   Backup: ${path.relative(ROOT, backup)}`);

  if (s === before) console.log('   Note: file content was already mostly patched.');
  return true;
}

function check(file) {
  try {
    cp.execFileSync('node', ['--check', file], { stdio:'pipe' });
    console.log(`✅ Syntax OK: ${path.relative(ROOT, file)}`);
    return true;
  } catch (err) {
    console.error(`❌ Syntax still failing: ${path.relative(ROOT, file)}`);
    console.error(String(err.stderr || err.message || err).slice(0, 1200));
    return false;
  }
}

function main() {
  console.log('=== Fix battlePolishSystem syntax ===');

  const files = [
    path.join(ROOT, 'src', 'systems', 'battlePolishSystem.js'),
    path.join(ROOT, 'src', 'systems', 'characterCombatProfileSystem.js')
  ];

  let patched = 0;
  for (const f of files) {
    if (patchFile(f)) patched++;
  }

  console.log(`Patched files: ${patched}`);

  let ok = true;
  for (const f of files) {
    if (fs.existsSync(f)) ok = check(f) && ok;
  }

  const index = path.join(ROOT, 'src', 'index.js');
  if (fs.existsSync(index)) ok = check(index) && ok;

  if (!ok) {
    console.log('\nNeed inspection. Run:');
    console.log('sed -n "1,120p" src/systems/battlePolishSystem.js');
    process.exit(1);
  }

  console.log('\n✅ Final syntax repair done.');
  console.log('Now run: npm start');
}

main();
