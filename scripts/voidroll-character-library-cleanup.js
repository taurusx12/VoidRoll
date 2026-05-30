// VoidRoll Reborn - Phase 21 Character Library Cleanup
// Run:
//   node scripts/voidroll-character-library-cleanup.js
//
// Safe mode by default:
// - Does NOT delete characters.
// - Writes reports only.
// To apply duplicate deactivation / field cleanup:
//   APPLY_CHANGES=true node scripts/voidroll-character-library-cleanup.js
//
// To create planned Voidborn/Secret variants:
//   APPLY_VARIANTS=true node scripts/voidroll-character-library-cleanup.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const config = require('../src/config/character_library_cleanup_config.json');

const APPLY_CHANGES = String(process.env.APPLY_CHANGES || '').toLowerCase() === 'true';
const APPLY_VARIANTS = String(process.env.APPLY_VARIANTS || '').toLowerCase() === 'true';

const RARITY_VALUE = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
  MYTHIC: 5,
  DIVINE: 6,
  VOIDBORN: 7,
  SECRET: 8
};

function cleanName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[().\-_:/'’"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortKey(c) {
  return cleanName(c.name).toLowerCase();
}

function roleOf(c) {
  const n = normalize(c.name);
  const a = normalize(c.anime);

  if (['aizen','lelouch','makima','kurapika','shikamaru','light yagami','yhwach','geto'].some(x => n.includes(x))) return 'CONTROL';
  if (['all might','kaido','whitebeard','escanor','reinhard','saber','artoria','albedo'].some(x => n.includes(x))) return 'TANK';
  if (['rimuru','orihime','tsunade','rem','emilia','kakashi','cc','c c'].some(x => n.includes(x))) return 'SUPPORT';
  if (['toji','killua','levi','hisoka','zenitsu','yoriichi','zoro'].some(x => n.includes(x))) return 'ASSASSIN';
  if (['gojo','sukuna','madara','gilgamesh','ainz','megumin'].some(x => n.includes(x))) return 'DPS';
  if (['jinwoo','jin woo','ashborn','igris','beru'].some(x => n.includes(x))) return 'SUMMONER';
  return String(c.role || c.type || 'DPS').toUpperCase();
}

function elementOf(c) {
  const n = normalize(c.name);
  const a = normalize(c.anime);

  if (['aizen','ichigo','yhwach','rukia','kenpachi','byakuya'].some(x => n.includes(x)) || a.includes('bleach')) return 'SOUL';
  if (['gojo','sukuna','yuta','toji','geto','yuji','megumi'].some(x => n.includes(x)) || a.includes('jujutsu')) return 'CURSED';
  if (['jinwoo','jin woo','igris','beru','ashborn'].some(x => n.includes(x))) return 'SHADOW';
  if (['rimuru','aizen','madara','makima','lelouch','yhwach'].some(x => n.includes(x))) return 'VOID';
  if (['natsu','ace','rengoku'].some(x => n.includes(x))) return 'FIRE';
  if (['killua','zenitsu','laxus'].some(x => n.includes(x))) return 'LIGHTNING';
  if (['naruto','goku','luffy','saber','all might'].some(x => n.includes(x))) return 'LIGHT';
  if (['rukia'].some(x => n.includes(x))) return 'ICE';

  return String(c.element || 'NEUTRAL').toUpperCase();
}

function basePowerForRarity(rarity = 'COMMON') {
  const r = String(rarity || 'COMMON').toUpperCase();
  return {
    COMMON: 1000,
    RARE: 4500,
    EPIC: 15000,
    LEGENDARY: 60000,
    MYTHIC: 180000,
    DIVINE: 500000,
    VOIDBORN: 950000,
    SECRET: 1500000
  }[r] || 1000;
}

function variantDisplayName(variant, baseName) {
  if (!variant || variant === 'Base') return baseName;
  return `${variant} ${baseName}`;
}

async function findBaseCharacterByLooseName(name) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    take: 20000
  });

  const q = normalize(name);
  return chars
    .map(c => {
      const cn = normalize(cleanName(c.name));
      let score = 0;
      if (cn === q) score += 1000;
      if (cn.includes(q)) score += 400;
      if (q.includes(cn)) score += 200;
      return { c, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || (Number(b.c.basePower || 0) - Number(a.c.basePower || 0)))[0]?.c || null;
}

async function createVariantIfMissing(plan) {
  const base = await findBaseCharacterByLooseName(plan.name);
  if (!base) return { ok: false, reason: 'base_missing', plan };

  const displayName = variantDisplayName(plan.variant, cleanName(base.name));
  const exists = await prisma.character.findFirst({
    where: {
      active: true,
      name: displayName,
      anime: base.anime
    }
  });

  if (exists) return { ok: true, reason: 'already_exists', character: exists };

  const rarity = String(plan.rarity || 'VOIDBORN').toUpperCase();

  if (!APPLY_VARIANTS) {
    return { ok: true, reason: 'dry_run_would_create', name: displayName, anime: base.anime, rarity };
  }

  const created = await prisma.character.create({
    data: {
      name: displayName,
      anime: base.anime,
      rarity,
      basePower: Math.max(Number(base.basePower || 0), basePowerForRarity(rarity)),
      imageUrl: base.imageUrl || null,
      active: true,
      element: plan.element || elementOf(base),
      role: plan.role || roleOf(base),
      variant: plan.variant || 'Base'
    }
  });

  return { ok: true, reason: 'created', character: created };
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const chars = await prisma.character.findMany({
    where: { active: true },
    take: 30000
  });

  console.log(`Loaded active characters: ${chars.length}`);

  const sorted = [...chars].sort((a, b) => {
    const byName = sortKey(a).localeCompare(sortKey(b));
    if (byName) return byName;
    const byAnime = String(a.anime || '').localeCompare(String(b.anime || ''));
    if (byAnime) return byAnime;
    return Number(b.basePower || 0) - Number(a.basePower || 0);
  });

  const seen = new Map();
  const duplicates = [];
  for (const c of sorted) {
    const key = `${normalize(cleanName(c.name))}|${normalize(c.anime)}`;
    if (!seen.has(key)) {
      seen.set(key, c);
    } else {
      const existing = seen.get(key);
      const keep = (
        (RARITY_VALUE[String(c.rarity || 'COMMON').toUpperCase()] || 0) > (RARITY_VALUE[String(existing.rarity || 'COMMON').toUpperCase()] || 0)
        || Number(c.basePower || 0) > Number(existing.basePower || 0)
      ) ? c : existing;

      const remove = keep.id === c.id ? existing : c;
      if (keep.id === c.id) seen.set(key, c);

      duplicates.push({
        duplicateId: remove.id,
        duplicateName: remove.name,
        keepId: keep.id,
        keepName: keep.name,
        anime: c.anime
      });
    }
  }

  const mustHave = config.mustHaveFamousCharacters || [];
  const missingFamous = [];
  for (const name of mustHave) {
    const found = sorted.find(c => normalize(cleanName(c.name)).includes(normalize(name)) || normalize(name).includes(normalize(cleanName(c.name))));
    if (!found) missingFamous.push(name);
  }

  const byLetter = {};
  for (const c of sorted) {
    const first = (cleanName(c.name)[0] || '#').toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : '#';
    byLetter[letter] = byLetter[letter] || [];
    byLetter[letter].push({
      id: c.id,
      name: cleanName(c.name),
      originalName: c.name,
      anime: c.anime,
      rarity: c.rarity,
      basePower: Number(c.basePower || 0),
      role: c.role || roleOf(c),
      element: c.element || elementOf(c),
      imageUrl: c.imageUrl || null
    });
  }

  const aToZ = sorted.map(c => ({
    id: c.id,
    name: cleanName(c.name),
    originalName: c.name,
    anime: c.anime,
    rarity: c.rarity,
    basePower: Number(c.basePower || 0),
    role: c.role || roleOf(c),
    element: c.element || elementOf(c),
    imageUrl: c.imageUrl || null
  }));

  fs.writeFileSync(path.join(reportsDir, 'characters_A_TO_Z.json'), JSON.stringify(aToZ, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'characters_BY_LETTER.json'), JSON.stringify(byLetter, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'characters_DUPLICATES.json'), JSON.stringify(duplicates, null, 2), 'utf8');
  fs.writeFileSync(path.join(reportsDir, 'characters_MISSING_FAMOUS.json'), JSON.stringify(missingFamous, null, 2), 'utf8');

  const md = [
    '# VoidRoll Reborn — Character Library Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Active characters: **${chars.length}**`,
    `Unique clean characters: **${seen.size}**`,
    `Duplicate candidates: **${duplicates.length}**`,
    `Missing famous characters: **${missingFamous.length}**`,
    '',
    '## Missing famous preview',
    ...(missingFamous.slice(0, 100).map(x => `- ${x}`)),
    '',
    '## A-Z counts',
    ...Object.keys(byLetter).sort().map(letter => `- ${letter}: ${byLetter[letter].length}`)
  ].join('\n');

  fs.writeFileSync(path.join(reportsDir, 'CHARACTER_LIBRARY_REPORT.md'), md, 'utf8');

  if (APPLY_CHANGES) {
    console.log('APPLY_CHANGES=true: updating role/element fields and deactivating duplicates.');

    for (const c of sorted) {
      try {
        await prisma.character.update({
          where: { id: c.id },
          data: {
            role: c.role || roleOf(c),
            element: c.element || elementOf(c),
            variant: c.variant || 'Base'
          }
        });
      } catch (_) {}
    }

    for (const d of duplicates) {
      try {
        await prisma.character.update({
          where: { id: d.duplicateId },
          data: { active: false }
        });
      } catch (_) {}
    }
  } else {
    console.log('Safe mode: no DB changes were applied.');
  }

  const variantResults = [];
  for (const plan of config.plannedSecretVariants || []) {
    variantResults.push(await createVariantIfMissing(plan));
  }
  fs.writeFileSync(path.join(reportsDir, 'characters_VARIANT_PLAN_RESULTS.json'), JSON.stringify(variantResults, null, 2), 'utf8');

  console.log('');
  console.log('✅ Character library cleanup report complete.');
  console.log('Reports created:');
  console.log('- reports/characters_A_TO_Z.json');
  console.log('- reports/characters_BY_LETTER.json');
  console.log('- reports/characters_DUPLICATES.json');
  console.log('- reports/characters_MISSING_FAMOUS.json');
  console.log('- reports/characters_VARIANT_PLAN_RESULTS.json');
  console.log('- reports/CHARACTER_LIBRARY_REPORT.md');
  console.log('');
  console.log(`Active: ${chars.length} | Unique: ${seen.size} | Duplicates: ${duplicates.length} | Missing famous: ${missingFamous.length}`);
  if (!APPLY_CHANGES) console.log('Run with APPLY_CHANGES=true to apply cleanup.');
  if (!APPLY_VARIANTS) console.log('Run with APPLY_VARIANTS=true to create planned Voidborn/Secret variants.');
}

main()
  .catch(err => {
    console.error('❌ Character cleanup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
