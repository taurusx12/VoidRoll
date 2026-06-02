// VoidRoll Reborn - Phase 39 Variant Audit
// Run: node scripts/phase39-variant-audit.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const variantPresentation = require('../src/systems/variantPresentationSystem');

const prisma = new PrismaClient();

function clean(name='') { return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim(); }
function norm(v='') { return String(v || '').toLowerCase().replace(/[().\-_:/'’"]/g,' ').replace(/\s+/g,' ').trim(); }

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive:true });

  const chars = await prisma.character.findMany({ where:{ active:true }, orderBy:{ basePower:'desc' }, take:50000 });
  const groups = variantPresentation.groupVariants(chars);

  const rows = [];
  const imageWarnings = [];
  for (const [key, items] of groups.entries()) {
    const variants = items.filter(x => x.profile.isVariant);
    if (!variants.length) continue;
    const bases = items.filter(x => !x.profile.isVariant);
    for (const v of variants) {
      const sameImageBase = bases.find(b => b.character.imageUrl && b.character.imageUrl === v.character.imageUrl);
      if (sameImageBase) {
        imageWarnings.push({
          variant:v.character.name,
          base:sameImageBase.character.name,
          imageUrl:v.character.imageUrl,
          issue:'Variant shares the same image as base. Replace imageUrl for premium presentation.'
        });
      }
      rows.push({
        baseKey:key,
        baseCharacters:bases.map(x=>x.character.name),
        variant:v.character.name,
        anime:v.character.anime,
        rarity:v.character.rarity,
        eventType:v.profile.eventType,
        role:v.profile.role,
        element:v.profile.element,
        passive:v.profile.passiveName,
        imageUrl:v.character.imageUrl
      });
    }
  }

  fs.writeFileSync(path.join(reportsDir, 'PHASE39_VARIANTS.json'), JSON.stringify(rows, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'PHASE39_VARIANT_IMAGE_WARNINGS.json'), JSON.stringify(imageWarnings, null, 2), 'utf8');

  const md = [
    '# Phase 39 — Variant Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Variant rows: **${rows.length}**`,
    `Image warnings: **${imageWarnings.length}**`,
    '',
    '## Variants preview',
    ...rows.slice(0,80).map(x => `- **${x.variant}** (${x.anime}) • Base: ${x.baseCharacters.join(', ') || x.baseKey} • ${x.eventType} • ${x.role}/${x.element}`),
    '',
    '## Image warnings preview',
    ...(imageWarnings.length ? imageWarnings.slice(0,80).map(x => `- ${x.variant} shares image with ${x.base}`) : ['None'])
  ].join('\n');

  fs.writeFileSync(path.join(reportsDir, 'PHASE39_VARIANT_AUDIT.md'), md, 'utf8');

  console.log('✅ Variant audit complete.');
  console.log(`Variants: ${rows.length}`);
  console.log(`Image warnings: ${imageWarnings.length}`);
  console.log('Reports:');
  console.log('- reports/PHASE39_VARIANT_AUDIT.md');
  console.log('- reports/PHASE39_VARIANTS.json');
  console.log('- reports/PHASE39_VARIANT_IMAGE_WARNINGS.json');
}

main().finally(()=>prisma.$disconnect());
