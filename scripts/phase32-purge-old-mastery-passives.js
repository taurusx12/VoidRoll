// VoidRoll Reborn - Phase 32 Purge Old Mastery Passives
// Removes old generic passive text from DB and source files.
// Old examples:
// - DPS Mastery
// - Tank Mastery
// - Support Mastery
// - passive affects real battle stats
//
// Run:
//   node scripts/phase32-purge-old-mastery-passives.js
//   node --check src/index.js
//   node --check src/systems/battlePolishSystem.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const combatProfiles = require('../src/systems/characterCombatProfileSystem');

const prisma = new PrismaClient();

const OLD_PATTERNS = [
  /DPS Mastery/i,
  /Tank Mastery/i,
  /Support Mastery/i,
  /Control Mastery/i,
  /Assassin Mastery/i,
  /Mage Mastery/i,
  /Summoner Mastery/i,
  /Healer Mastery/i,
  /passive affects real battle stats/i
];

function isOldPassiveText(v) {
  return OLD_PATTERNS.some(re => re.test(String(v || '')));
}

function getCharacterFields() {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
  return new Set(model.fields.filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));
}

function effectText(effect={}) {
  const parts = [];
  if (effect.dmg) parts.push(`+${effect.dmg}% Damage`);
  if (effect.teamDmg) parts.push(`+${effect.teamDmg}% Team Damage`);
  if (effect.bossDmg) parts.push(`+${effect.bossDmg}% Boss Damage`);
  if (effect.crit) parts.push(`+${effect.crit}% Crit`);
  if (effect.dodge) parts.push(`+${effect.dodge}% Dodge`);
  if (effect.shield) parts.push('Starts with Shield');
  if (effect.heal) parts.push(`+${effect.heal}% Healing`);
  if (effect.lifesteal) parts.push(`+${effect.lifesteal}% Lifesteal`);
  if (effect.counter) parts.push(`+${effect.counter}% Counter`);
  if (effect.burn) parts.push(`${effect.burn}% Burn`);
  if (effect.bleed) parts.push(`${effect.bleed}% Bleed`);
  if (effect.poison) parts.push(`${effect.poison}% Poison`);
  if (effect.freeze) parts.push(`${effect.freeze}% Freeze`);
  if (effect.stun) parts.push(`${effect.stun}% Stun`);
  if (effect.silence) parts.push(`${effect.silence}% Silence`);
  if (effect.miss) parts.push(`${effect.miss}% Enemy Miss`);
  if (effect.enemyAtk) parts.push(`${effect.enemyAtk}% Enemy ATK`);
  if (effect.energyGain) parts.push(`+${effect.energyGain} Energy Gain`);
  if (effect.energyDrain) parts.push(`${effect.energyDrain} Energy Drain`);
  if (effect.execute) parts.push(`${effect.execute}% Execute`);
  if (effect.summon) parts.push('Summon Assist');
  return parts.join(' • ') || 'Anime-linked passive active in battle.';
}

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return { file:filePath, patched:false, reason:'missing' };

  let s = fs.readFileSync(filePath, 'utf8');
  const before = s;

  s = s.replace(/DPS Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Tank Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Support Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Control Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Assassin Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Mage Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Summoner Mastery/g, 'Anime Combat Passive');
  s = s.replace(/Healer Mastery/g, 'Anime Combat Passive');
  s = s.replace(/DPS passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
  s = s.replace(/Tank passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
  s = s.replace(/Support passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
  s = s.replace(/Control passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
  s = s.replace(/Assassin passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
  s = s.replace(/Mage passive affects real battle stats\./g, 'Anime-linked passive active in battle.');
  s = s.replace(/\$\{roleOf\(c\)\} Mastery/g, 'Anime Combat Passive');
  s = s.replace(/\$\{roleOf\(character\)\} Mastery/g, 'Anime Combat Passive');

  if (s !== before) {
    const backup = `${filePath}.backup-phase32-${Date.now()}`;
    fs.copyFileSync(filePath, backup);
    fs.writeFileSync(filePath, s, 'utf8');
    return { file:filePath, patched:true, backup:path.relative(process.cwd(), backup) };
  }

  return { file:filePath, patched:false, reason:'clean' };
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive:true });

  console.log('1) Patching source files...');
  const fileResults = [
    patchFile(path.join(process.cwd(), 'src', 'index.js')),
    patchFile(path.join(process.cwd(), 'src', 'systems', 'battlePolishSystem.js')),
    patchFile(path.join(process.cwd(), 'src', 'systems', 'characterCombatProfileSystem.js'))
  ];
  for (const r of fileResults) console.log(r.patched ? `✅ patched ${r.file}` : `✅ ${r.file}: ${r.reason}`);

  console.log('');
  console.log('2) Checking DB fields...');
  const fields = getCharacterFields();
  const chars = await prisma.character.findMany({ where:{ active:true }, take:50000 });

  const fixed = [];
  const oldStill = [];

  for (const c of chars) {
    const profile = combatProfiles.getCombatProfile(c);
    const passive = profile.passive || { name:'Anime Passive', effect:{} };
    const current = [
      c.passiveName,
      c.passive,
      c.role,
      c.type,
      c.element,
      c.combatRole,
      c.combatElement
    ].filter(v => v !== undefined && v !== null).map(String).join(' ');

    const shouldUpdate =
      isOldPassiveText(current) ||
      (fields.has('passiveName') && !c.passiveName) ||
      (fields.has('passive') && !c.passive);

    const data = {};
    if (fields.has('role')) data.role = profile.role;
    if (fields.has('type')) data.type = profile.role;
    if (fields.has('element')) data.element = profile.element;
    if (fields.has('combatRole')) data.combatRole = profile.role;
    if (fields.has('combatElement')) data.combatElement = profile.element;
    if (fields.has('passiveName')) data.passiveName = passive.name;
    if (fields.has('passive')) {
      // Store both machine effect and readable text.
      data.passive = JSON.stringify({
        name: passive.name,
        text: effectText(passive.effect),
        effect: passive.effect || {}
      });
    }

    if (Object.keys(data).length && (shouldUpdate || process.env.FORCE_ALL === 'true')) {
      await prisma.character.update({ where:{ id:c.id }, data }).catch(err => {
        console.warn(`Failed update ${c.name}:`, err.message);
      });
      fixed.push({
        id:c.id,
        name:c.name,
        anime:c.anime,
        role:profile.role,
        element:profile.element,
        passiveName:passive.name,
        passiveText:effectText(passive.effect)
      });
    }
  }

  // Re-scan if passive fields exist.
  if (fields.has('passiveName') || fields.has('passive')) {
    const after = await prisma.character.findMany({ where:{ active:true }, take:50000 });
    for (const c of after) {
      const text = [c.passiveName, c.passive].filter(Boolean).map(String).join(' ');
      if (isOldPassiveText(text)) {
        oldStill.push({ id:c.id, name:c.name, anime:c.anime, passiveName:c.passiveName, passive:c.passive });
      }
    }
  }

  fs.writeFileSync(path.join(reportsDir, 'PHASE32_PASSIVES_FIXED.json'), JSON.stringify(fixed, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'PHASE32_OLD_PASSIVES_STILL_FOUND.json'), JSON.stringify(oldStill, null, 2), 'utf8');

  const md = [
    '# Phase 32 — Old Mastery Passive Cleanup',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Source file patch results',
    ...fileResults.map(r => `- ${path.relative(process.cwd(), r.file)}: ${r.patched ? 'patched' : r.reason}`),
    '',
    `DB rows updated: **${fixed.length.toLocaleString('en-US')}**`,
    `Old passives still found: **${oldStill.length.toLocaleString('en-US')}**`,
    '',
    '## Fixed preview',
    ...fixed.slice(0,50).map(x => `- ${x.name} (${x.anime}) → ${x.passiveName} | ${x.role}/${x.element}`),
    '',
    oldStill.length ? '## Still found preview' : '## Still found preview\nNone',
    ...oldStill.slice(0,50).map(x => `- ${x.name} (${x.anime}) → ${x.passiveName}`)
  ].join('\n');

  fs.writeFileSync(path.join(reportsDir, 'PHASE32_PASSIVES_CLEANUP.md'), md, 'utf8');

  console.log('');
  console.log('✅ Phase 32 old passive cleanup complete.');
  console.log(`DB rows updated: ${fixed.length}`);
  console.log(`Old passives still found: ${oldStill.length}`);
  console.log('Reports:');
  console.log('- reports/PHASE32_PASSIVES_CLEANUP.md');
  console.log('- reports/PHASE32_PASSIVES_FIXED.json');
  console.log('- reports/PHASE32_OLD_PASSIVES_STILL_FOUND.json');

  console.log('');
  console.log('Verify source files:');
  console.log('grep -R -n "DPS Mastery\\|passive affects real battle stats" src || true');
}

main()
  .catch(err => {
    console.error('❌ Phase 32 cleanup failed:', err);
    process.exit(1);
  })
  .finally(()=>prisma.$disconnect());
