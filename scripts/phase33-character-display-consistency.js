// VoidRoll Reborn - Phase 33 Character Display Consistency Fix
// Fixes:
// 1) Searching first name vs full name showing different passive/type.
// 2) Old text: DPS Mastery / passive affects real battle stats.
// 3) /character and /view-card display must always use characterCombatProfileSystem.
// Run:
//   node scripts/phase33-character-display-consistency.js
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

function replaceAnyFunction(names, newBody) {
  for (const sig of names) {
    const r = findFunctionRange(s, sig);
    if (r) {
      s = s.slice(0, r.start) + newBody + s.slice(r.end);
      return true;
    }
  }
  return false;
}

const backup = path.join(process.cwd(), 'src', `index.backup-phase33-display-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

// Ensure combat profile import.
if (!s.includes("require('./systems/characterCombatProfileSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (!s.includes(anchor)) {
    console.error('❌ Could not find prisma require anchor.');
    process.exit(1);
  }
  s = s.replace(anchor, `${anchor}
const combatProfiles = require('./systems/characterCombatProfileSystem');`);
  console.log('✅ added combat profile import');
} else {
  console.log('✅ combat profile import exists');
}

// Replace role/element/passive display logic.
replaceAnyFunction(
  ["function roleOf(c)", "function roleOf(c={})"],
  "function roleOf(c) { return combatProfiles.roleOf(c); }"
);
console.log('✅ roleOf now uses combat profile system');

replaceAnyFunction(
  ["function elementOf(c)", "function elementOf(c={})"],
  "function elementOf(c) { return combatProfiles.elementOf(c); }"
);
console.log('✅ elementOf now uses combat profile system');

const newPassiveOf = `function passiveOf(c) {
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
    name: p.name || 'Anime Combat Passive',
    text: parts.length ? parts.join(' • ') : 'Anime-linked passive active in battle.',
    effect
  };
}`;
replaceAnyFunction(
  ["function passiveOf(c)", "function passiveOf(c={})"],
  newPassiveOf
);
console.log('✅ passiveOf now uses combat profile system');

// Replace statBlock to force consistent display for owned and non-owned cards.
const newStatBlock = `function statBlock(card,c=card.character) {
  const s = statsFor(card,c);
  const p = passiveOf(c);
  return \`Type: **\${s.role}** | Element: **\${s.element}**\\n\`+
    \`Level: **\${s.level}/100** | Power: **\${money(s.power)}**\\n\`+
    \`HP **\${money(s.hp)}** • ATK **\${money(s.atk)}** • DEF **\${money(s.def)}** • SPD **\${money(s.speed)}**\\n\`+
    \`Crit **\${s.critRate}%** • Crit DMG **\${s.critDamage}%** • Dodge **\${s.dodge}%** • Accuracy **\${s.accuracy}%**\\n\`+
    \`Passive: **\${p.name}** — \${p.text}\`;
}`;
replaceAnyFunction(["function statBlock(card,c=card.character)"], newStatBlock);
console.log('✅ statBlock display forced to combat profile passives');

// Patch findCharacter scoring: exact full-name and cleaned-name should win.
const findRange = findFunctionRange(s, "async function findCharacter(query)");
if (findRange) {
  const newFind = `async function findCharacter(query) {
  const q = norm(query);
  if (!q) return null;
  const chars = await prisma.character.findMany({ where:{ active:true }, take:10000, orderBy:{ basePower:'desc' } }).catch(()=>[]);

  const scored = chars.map(c => {
    const cleanName = norm(clean(c.name));
    const rawName = norm(c.name);
    const anime = norm(c.anime);
    const txt = \`\${cleanName} \${rawName} \${anime}\`;

    let score = 0;

    if (rawName === q) score += 20000;
    if (cleanName === q) score += 18000;
    if (rawName.startsWith(q + ' ')) score += 9000;
    if (cleanName.startsWith(q + ' ')) score += 8500;

    for (const t of q.split(' ').filter(Boolean)) {
      if (cleanName.includes(t)) score += 300;
      if (rawName.includes(t)) score += 250;
      if (anime.includes(t)) score += 80;
    }

    // Prefer recognizable anime-linked records over weird duplicate/partial records.
    const profile = combatProfiles.getCombatProfile(c);
    if (profile.source === 'exact') score += 2000;
    if (profile.source === 'anime') score += 800;
    if (String(c.imageUrl || '').includes('cdn.myanimelist')) score += 200;

    score += Number(c.basePower || 0) / 100000;

    return { c, score };
  }).filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || Number(b.c.basePower || 0) - Number(a.c.basePower || 0));

  return scored[0]?.c || null;
}`;
  s = s.slice(0, findRange.start) + newFind + s.slice(findRange.end);
  console.log('✅ improved findCharacter exact/partial search');
} else {
  console.log('⚠️ findCharacter not found');
}

// Patch ownedCardByIdOrBest scoring too.
const ownedRange = findFunctionRange(s, "async function ownedCardByIdOrBest(userId, value)");
if (ownedRange) {
  const newOwned = `async function ownedCardByIdOrBest(userId, value) {
  if (!value) return null;
  let card = await prisma.userCard.findFirst({ where:{ id:String(value), userId:String(userId) }, include:{ character:true } }).catch(()=>null);
  if (card) return card;

  const q = norm(value);
  const cards = await prisma.userCard.findMany({ where:{ userId:String(userId) }, include:{ character:true }, orderBy:{ power:'desc' }, take:5000 }).catch(()=>[]);

  const scored = cards.map(card => {
    const c = card.character || {};
    const cleanName = norm(clean(c.name));
    const rawName = norm(c.name);
    const anime = norm(c.anime);
    const sid = shortId(card.id).toLowerCase();

    let score = 0;
    if (sid === q) score += 30000;
    if (rawName === q) score += 20000;
    if (cleanName === q) score += 18000;
    if (rawName.startsWith(q + ' ')) score += 9000;
    if (cleanName.startsWith(q + ' ')) score += 8500;

    for (const t of q.split(' ').filter(Boolean)) {
      if (cleanName.includes(t)) score += 300;
      if (rawName.includes(t)) score += 250;
      if (anime.includes(t)) score += 80;
      if (sid.includes(t)) score += 500;
    }

    const profile = combatProfiles.getCombatProfile(c);
    if (profile.source === 'exact') score += 2000;
    if (profile.source === 'anime') score += 800;

    score += Number(card.power || 0) / 100000;

    return { card, score };
  }).filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || Number(b.card.power || 0) - Number(a.card.power || 0));

  return scored[0]?.card || null;
}`;
  s = s.slice(0, ownedRange.start) + newOwned + s.slice(ownedRange.end);
  console.log('✅ improved ownedCardByIdOrBest exact/partial search');
} else {
  console.log('⚠️ ownedCardByIdOrBest not found');
}

// Remove old words from source to prevent any visible leakage.
s = s.replace(/DPS Mastery/g, 'Anime Combat Passive');
s = s.replace(/Tank Mastery/g, 'Anime Combat Passive');
s = s.replace(/Support Mastery/g, 'Anime Combat Passive');
s = s.replace(/Control Mastery/g, 'Anime Combat Passive');
s = s.replace(/Assassin Mastery/g, 'Anime Combat Passive');
s = s.replace(/Mage Mastery/g, 'Anime Combat Passive');
s = s.replace(/Summoner Mastery/g, 'Anime Combat Passive');
s = s.replace(/Healer Mastery/g, 'Anime Combat Passive');
s = s.replace(/DPS passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
s = s.replace(/passive affects real battle stats\./g, 'Anime-linked passive active in battle.');

if (!s.includes('PHASE33_CHARACTER_DISPLAY_CONSISTENCY')) {
  s = '// PHASE33_CHARACTER_DISPLAY_CONSISTENCY\n' + s;
}

fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 33 character display consistency applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Verify:');
console.log('grep -n "DPS Mastery\\|passive affects real battle stats\\|PHASE33_CHARACTER_DISPLAY_CONSISTENCY" src/index.js');
console.log('node --check src/index.js');
