// VoidRoll Reborn - Phase 29 Character Combat Audit
// Run:
//   node scripts/phase29-character-combat-audit.js
// Apply DB-safe field updates if fields exist:
//   APPLY_DB=true node scripts/phase29-character-combat-audit.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const { getCombatProfile, rarityValue } = require('../src/systems/characterCombatProfileSystem');

const prisma = new PrismaClient();

function money(n){ return Number(n || 0).toLocaleString('en-US'); }

function getCharacterFields() {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
  return new Set(model.fields.filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));
}

function expectedRarityByPower(power=0, current='COMMON') {
  const p = Number(power || 0);
  if (p >= 1500000) return 'SECRET';
  if (p >= 950000) return 'VOIDBORN';
  if (p >= 500000) return 'DIVINE';
  if (p >= 180000) return 'MYTHIC';
  if (p >= 60000) return 'LEGENDARY';
  if (p >= 15000) return 'EPIC';
  if (p >= 4500) return 'RARE';
  return current || 'COMMON';
}

async function main() {
  const apply = String(process.env.APPLY_DB || '').toLowerCase() === 'true';
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive:true });

  const fields = getCharacterFields();
  const chars = await prisma.character.findMany({ where:{ active:true }, take:50000 });

  const results = [];
  const sourceCounts = {};
  const roleCounts = {};
  const elementCounts = {};
  const rarityIssues = [];

  for (const c of chars) {
    const profile = getCombatProfile(c);
    sourceCounts[profile.source] = (sourceCounts[profile.source] || 0) + 1;
    roleCounts[profile.role] = (roleCounts[profile.role] || 0) + 1;
    elementCounts[profile.element] = (elementCounts[profile.element] || 0) + 1;

    const expectedRarity = expectedRarityByPower(c.basePower, c.rarity);
    if (rarityValue(expectedRarity) > rarityValue(c.rarity)) {
      rarityIssues.push({
        id:c.id,
        name:c.name,
        anime:c.anime,
        current:c.rarity,
        expected:expectedRarity,
        basePower:c.basePower
      });
    }

    const row = {
      id:c.id,
      name:c.name,
      anime:c.anime,
      rarity:c.rarity,
      expectedRarity,
      basePower:c.basePower,
      role:profile.role,
      element:profile.element,
      passiveName:profile.passive.name,
      passiveEffect:profile.passive.effect,
      source:profile.source
    };
    results.push(row);

    if (apply) {
      const data = {};
      if (fields.has('element')) data.element = profile.element;
      if (fields.has('role')) data.role = profile.role;
      if (fields.has('type')) data.type = profile.role;
      if (fields.has('passiveName')) data.passiveName = profile.passive.name;
      if (fields.has('passive')) data.passive = JSON.stringify(profile.passive);
      if (fields.has('combatRole')) data.combatRole = profile.role;
      if (fields.has('combatElement')) data.combatElement = profile.element;

      // Rarity update is intentionally conservative: only upgrade obvious under-ranked characters.
      if (fields.has('rarity') && rarityValue(expectedRarity) > rarityValue(c.rarity)) {
        data.rarity = expectedRarity;
      }

      if (Object.keys(data).length) {
        await prisma.character.update({ where:{ id:c.id }, data }).catch(err => {
          console.warn(`Failed update ${c.name}:`, err.message);
        });
      }
    }
  }

  results.sort((a,b) => String(a.anime).localeCompare(String(b.anime)) || String(a.name).localeCompare(String(b.name)));

  fs.writeFileSync(path.join(reportsDir, 'CHARACTER_COMBAT_AUDIT.json'), JSON.stringify(results, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'CHARACTER_RARITY_ISSUES.json'), JSON.stringify(rarityIssues, null, 2), 'utf8');

  const md = [
    '# VoidRoll Reborn — Character Combat Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Characters scanned: **${money(chars.length)}**`,
    `Apply DB: **${apply ? 'YES' : 'NO'}**`,
    '',
    '## Passive source counts',
    ...Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `- ${k}: ${money(v)}`),
    '',
    '## Role / Type counts',
    ...Object.entries(roleCounts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `- ${k}: ${money(v)}`),
    '',
    '## Element counts',
    ...Object.entries(elementCounts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `- ${k}: ${money(v)}`),
    '',
    '## Rarity issues preview',
    ...rarityIssues.slice(0,50).map(x => `- ${x.name} (${x.anime}) ${x.current} → ${x.expected} | PWR ${money(x.basePower)}`),
    '',
    '## Notes',
    '- exact = specific character/anime passive',
    '- anime = anime-level passive rule',
    '- fallback = generic but still combat-effective role/element passive',
    '- battlePolishSystem can read this profile system after Phase 29 hook patch'
  ].join('\n');

  fs.writeFileSync(path.join(reportsDir, 'CHARACTER_COMBAT_AUDIT.md'), md, 'utf8');

  console.log('✅ Character combat audit complete.');
  console.log(`Scanned: ${chars.length}`);
  console.log(`Rarity issues: ${rarityIssues.length}`);
  console.log('Reports:');
  console.log('- reports/CHARACTER_COMBAT_AUDIT.md');
  console.log('- reports/CHARACTER_COMBAT_AUDIT.json');
  console.log('- reports/CHARACTER_RARITY_ISSUES.json');

  if (!apply) console.log('\nRun with APPLY_DB=true to apply supported DB fields.');
}

main()
  .catch(err => {
    console.error('❌ Phase 29 audit failed:', err);
    process.exit(1);
  })
  .finally(()=>prisma.$disconnect());
