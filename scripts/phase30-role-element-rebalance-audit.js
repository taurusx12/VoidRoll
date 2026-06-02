// VoidRoll Reborn - Phase 30 Role/Element Rebalance Audit
// Run:
//   node scripts/phase30-role-element-rebalance-audit.js
// Apply DB fields:
//   APPLY_DB=true node scripts/phase30-role-element-rebalance-audit.js

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

  for (const c of chars) {
    const profile = getCombatProfile(c);
    sourceCounts[profile.source] = (sourceCounts[profile.source] || 0) + 1;
    roleCounts[profile.role] = (roleCounts[profile.role] || 0) + 1;
    elementCounts[profile.element] = (elementCounts[profile.element] || 0) + 1;

    results.push({
      id:c.id,
      name:c.name,
      anime:c.anime,
      rarity:c.rarity,
      basePower:c.basePower,
      role:profile.role,
      element:profile.element,
      passiveName:profile.passive.name,
      passiveEffect:profile.passive.effect,
      source:profile.source
    });

    if (apply) {
      const data = {};
      if (fields.has('element')) data.element = profile.element;
      if (fields.has('role')) data.role = profile.role;
      if (fields.has('type')) data.type = profile.role;
      if (fields.has('passiveName')) data.passiveName = profile.passive.name;
      if (fields.has('passive')) data.passive = JSON.stringify(profile.passive);
      if (fields.has('combatRole')) data.combatRole = profile.role;
      if (fields.has('combatElement')) data.combatElement = profile.element;

      if (Object.keys(data).length) {
        await prisma.character.update({ where:{ id:c.id }, data }).catch(err => {
          console.warn(`Failed update ${c.name}:`, err.message);
        });
      }
    }
  }

  results.sort((a,b) => String(a.anime).localeCompare(String(b.anime)) || String(a.name).localeCompare(String(b.name)));

  fs.writeFileSync(path.join(reportsDir, 'PHASE30_CHARACTER_COMBAT_REBALANCE.json'), JSON.stringify(results, null, 2), 'utf8');

  const md = [
    '# VoidRoll Reborn — Phase 30 Role/Element Rebalance',
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
    '## Notes',
    '- balanced fallback prevents almost everyone from becoming DPS/NEUTRAL',
    '- support/healer/tank/control/assassin/summoner are now distributed by name/anime/seed rules',
    '- passives are still combat-effective even in fallback'
  ].join('\n');

  fs.writeFileSync(path.join(reportsDir, 'PHASE30_CHARACTER_COMBAT_REBALANCE.md'), md, 'utf8');

  console.log('✅ Phase 30 rebalance audit complete.');
  console.log(`Scanned: ${chars.length}`);
  console.log('Reports:');
  console.log('- reports/PHASE30_CHARACTER_COMBAT_REBALANCE.md');
  console.log('- reports/PHASE30_CHARACTER_COMBAT_REBALANCE.json');

  if (!apply) console.log('\nRun with APPLY_DB=true to apply supported DB fields.');
}

main()
  .catch(err => {
    console.error('❌ Phase 30 rebalance failed:', err);
    process.exit(1);
  })
  .finally(()=>prisma.$disconnect());
