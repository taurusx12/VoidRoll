require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

function id(prefix='char') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

function normalize(v='') {
  return String(v || '').toLowerCase().replace(/[().\-_:/'’"]/g,' ').replace(/\s+/g,' ').trim();
}

function cleanName(name='') {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();
}

function basePowerForRarity(rarity='COMMON') {
  return {
    COMMON:1000,
    RARE:4500,
    EPIC:15000,
    LEGENDARY:60000,
    MYTHIC:180000,
    DIVINE:500000,
    VOIDBORN:950000,
    SECRET:1500000
  }[String(rarity).toUpperCase()] || 1000;
}

function getCharacterFields() {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
  return new Set(model.fields.filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));
}

function setIfField(data, fields, key, value) {
  if (fields.has(key)) data[key] = value;
}

const plans = [
  { baseSearch:'Makima', animeIncludes:['chainsaw man'], variant:'Corrupted', rarity:'SECRET', element:'VOID', role:'CONTROL' },
  { baseSearch:'Aizen', animeIncludes:['bleach'], variant:'Corrupted', rarity:'SECRET', element:'VOID', role:'CONTROL' },
  { baseSearch:'Gojo', animeIncludes:['jujutsu kaisen'], variant:'Corrupted', rarity:'SECRET', element:'VOID', role:'DPS' },
  { baseSearch:'Sukuna', animeIncludes:['jujutsu kaisen'], variant:'True Form', rarity:'SECRET', element:'CURSED', role:'DPS' },
  { baseSearch:'Rimuru', animeIncludes:['tensei shitara slime','slime datta ken'], variant:'Voidborn', rarity:'VOIDBORN', element:'VOID', role:'SUMMONER' },
  { baseSearch:'Madara', animeIncludes:['naruto'], variant:'Eclipse', rarity:'VOIDBORN', element:'SHADOW', role:'DPS' },
  { baseSearch:'Ichigo', animeIncludes:['bleach'], variant:'Abyssal', rarity:'VOIDBORN', element:'SOUL', role:'DPS' },
  { baseSearch:'Naruto', animeIncludes:['naruto'], variant:'Awakened', rarity:'VOIDBORN', element:'LIGHT', role:'DPS' },
  { baseSearch:'Lelouch', animeIncludes:['code geass'], variant:'Absolute', rarity:'SECRET', element:'VOID', role:'CONTROL' },
  { baseSearch:'Yhwach', animeIncludes:['bleach'], variant:'Voidborn', rarity:'SECRET', element:'VOID', role:'CONTROL' }
];

async function findBase(plan) {
  const chars = await prisma.character.findMany({ where:{ active:true }, take:30000 });
  const q = normalize(plan.baseSearch);
  const animeKeys = plan.animeIncludes.map(normalize);

  return chars.map(c => {
    const name = normalize(cleanName(c.name));
    const raw = normalize(c.name);
    const anime = normalize(c.anime);
    const animeOk = animeKeys.some(k => anime.includes(k));

    let score = 0;
    if (!animeOk) score -= 5000;
    if (name === q || raw === q) score += 2500;
    if (name.includes(q) || raw.includes(q)) score += 1000;
    if (animeOk) score += 2000;

    return { c, score };
  })
  .filter(x => x.score > 0)
  .sort((a,b) => b.score - a.score || Number(b.c.basePower||0)-Number(a.c.basePower||0))[0]?.c || null;
}

function buildData(base, plan) {
  const fields = getCharacterFields();
  const data = {};

  for (const key of fields) {
    if (key === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(base, key)) data[key] = base[key];
  }

  setIfField(data, fields, 'id', id('char'));
  setIfField(data, fields, 'name', `${plan.variant} ${cleanName(base.name)}`);
  setIfField(data, fields, 'anime', base.anime);
  setIfField(data, fields, 'rarity', plan.rarity);
  setIfField(data, fields, 'basePower', Math.max(Number(base.basePower || 0), basePowerForRarity(plan.rarity)));
  setIfField(data, fields, 'imageUrl', base.imageUrl || null);
  setIfField(data, fields, 'active', true);
  setIfField(data, fields, 'element', plan.element);

  // These may not exist in your current Character model, so only set if supported.
  setIfField(data, fields, 'role', plan.role);
  setIfField(data, fields, 'type', plan.role);
  setIfField(data, fields, 'variant', plan.variant);

  if (fields.has('baseFarm')) data.baseFarm = Number(data.baseFarm || Math.floor((data.basePower || 1000) * 0.12));
  if (fields.has('baseLuck')) data.baseLuck = Number(data.baseLuck || 1);

  // Avoid copying old timestamps when Prisma doesn't need them.
  if (fields.has('createdAt') && !data.createdAt) data.createdAt = new Date();

  return data;
}

async function createVariant(plan) {
  const base = await findBase(plan);

  if (!base) {
    return { ok:false, reason:'base_not_found', baseSearch:plan.baseSearch, animeIncludes:plan.animeIncludes };
  }

  const name = `${plan.variant} ${cleanName(base.name)}`;

  const exists = await prisma.character.findFirst({
    where:{ active:true, name, anime:base.anime }
  });

  if (exists) {
    return { ok:true, reason:'already_exists', name:exists.name, anime:exists.anime, rarity:exists.rarity };
  }

  const created = await prisma.character.create({ data: buildData(base, plan) });

  return {
    ok:true,
    reason:'created',
    name:created.name,
    anime:created.anime,
    rarity:created.rarity,
    element:created.element || plan.element,
    role:created.role || created.type || plan.role,
    variant:created.variant || plan.variant
  };
}

async function main() {
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive:true });

  const results = [];

  for (const plan of plans) {
    const result = await createVariant(plan);
    results.push(result);
    console.log(`${result.ok ? '✅' : '❌'} ${plan.variant} ${plan.baseSearch}: ${result.reason}${result.anime ? ` • ${result.anime}` : ''}`);
  }

  fs.writeFileSync(
    path.join(reportsDir, 'characters_VARIANTS_CREATED_FIXED.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );

  console.log('Done. Report: reports/characters_VARIANTS_CREATED_FIXED.json');
}

main().catch(err => {
  console.error('❌ Variant creation failed:', err);
  process.exit(1);
}).finally(() => prisma.$disconnect());
