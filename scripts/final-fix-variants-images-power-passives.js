// VoidRoll Reborn — FINAL FIX
// Fixes:
// 1) Base + Corrupted pairs for the 10 event characters.
// 2) Base characters use MyAnimeList image if available.
// 3) Corrupted characters use public/images/events/corrupted images.
// 4) Keeps Lelouch passive and replaces the other passives with character-accurate passives.
// 5) Lowers insane level-1 power from millions to sane launch values.
// 6) Ensures both base and corrupted are active so /variants can show two versions.
//
// Run:
//   node scripts/final-fix-variants-images-power-passives.js
//   node --check src/index.js
//   node scripts/full-launch-audit.js
//   npm start

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const RAW_BASE = 'https://raw.githubusercontent.com/taurusx12/VoidRoll/main/public/images/events/corrupted';

const CHARACTER_MODEL = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
const CHARACTER_FIELDS = new Set((CHARACTER_MODEL?.fields || []).filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));

function pickCharacterData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (CHARACTER_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function id(prefix='char') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}

function norm(x) {
  return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isSpecialVariantName(name) {
  return /(corrupted|absolute|voidborn|eclipse|abyssal|awakened|true form|festival|variant|training|early arc|final arc|domain form|transcendent|ultimate|raid variant|dark variant|light variant|shadow variant|demon variant|hero variant|royal variant)/i.test(String(name || ''));
}

async function fetchMalImage(query) {
  try {
    const url = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=8`;
    const res = await fetch(url, { headers: { 'User-Agent': 'VoidRollReborn/1.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const list = Array.isArray(json?.data) ? json.data : [];
    const qn = norm(query);

    let best = list.find(x => norm(x?.name) === qn) || list.find(x => norm(x?.name).includes(qn.split(' ')[0]));
    const img = best?.images?.jpg?.image_url || best?.images?.webp?.image_url;
    if (img && img.includes('cdn.myanimelist.net')) return img;
  } catch (err) {
    console.log(`⚠️ MAL lookup failed for ${query}: ${err.message}`);
  }
  return null;
}

const PLAN = [
  {
    key:'Itachi',
    baseName:'Itachi Uchiha',
    search:['Itachi Uchiha','Itachi'],
    anime:'Naruto',
    baseRarity:'DIVINE',
    basePower:3000,
    corruptedName:'Corrupted Itachi Uchiha',
    corruptedFile:'Corrupted_Itachi.png',
    corruptedPower:5400,
    role:'CONTROL',
    element:'SHADOW'
  },
  {
    key:'Aizen',
    baseName:'Sousuke Aizen',
    search:['Sousuke Aizen','Sosuke Aizen','Aizen'],
    anime:'Bleach',
    baseRarity:'DIVINE',
    basePower:3200,
    corruptedName:'Corrupted Sousuke Aizen',
    corruptedFile:'Corrupted_Aizen.png',
    corruptedPower:6200,
    role:'CONTROL',
    element:'VOID'
  },
  {
    key:'Ainz',
    baseName:'Ainz Ooal Gown',
    search:['Ainz Ooal Gown','Ainz'],
    anime:'Overlord',
    baseRarity:'DIVINE',
    basePower:3100,
    corruptedName:'Corrupted Ainz Ooal Gown',
    corruptedFile:'Corrupted_Ainz.png',
    corruptedPower:6000,
    role:'SUMMONER',
    element:'DARK'
  },
  {
    key:'Rimuru',
    baseName:'Rimuru Tempest',
    search:['Rimuru Tempest','Rimuru'],
    anime:'That Time I Got Reincarnated as a Slime',
    baseRarity:'DIVINE',
    basePower:3150,
    corruptedName:'Corrupted Rimuru Tempest',
    corruptedFile:'Corrupted_Rimuru.png',
    corruptedPower:6100,
    role:'DPS',
    element:'VOID'
  },
  {
    key:'Makima',
    baseName:'Makima',
    search:['Makima'],
    anime:'Chainsaw Man',
    baseRarity:'DIVINE',
    basePower:3000,
    corruptedName:'Corrupted Makima',
    corruptedFile:'Corrupted_Makima.png',
    corruptedPower:5600,
    role:'CONTROL',
    element:'CURSED'
  },
  {
    key:'Lelouch',
    baseName:'Lelouch Lamperouge',
    search:['Lelouch Lamperouge','Lelouch'],
    anime:'Code Geass',
    baseRarity:'MYTHIC',
    basePower:1900,
    corruptedName:'Corrupted Lelouch Lamperouge',
    corruptedFile:'Corrupted_Lelouch.png',
    corruptedPower:5400,
    role:'CONTROL',
    element:'VOID'
  },
  {
    key:'Gojo',
    baseName:'Satoru Gojo',
    search:['Satoru Gojo','Satoru Gojou','Gojo','Gojou'],
    anime:'Jujutsu Kaisen',
    baseRarity:'DIVINE',
    basePower:3300,
    corruptedName:'Corrupted Satoru Gojo',
    corruptedFile:'Corrupted_Gojo.png',
    corruptedPower:6500,
    role:'CONTROL',
    element:'LIGHT'
  },
  {
    key:'Eren',
    baseName:'Eren Yeager',
    search:['Eren Yeager','Eren Jaeger','Eren'],
    anime:'Attack on Titan',
    baseRarity:'MYTHIC',
    basePower:1800,
    corruptedName:'Corrupted Eren Yeager',
    corruptedFile:'Corrupted_Eren.png',
    corruptedPower:5200,
    role:'TANK',
    element:'BLOOD'
  },
  {
    key:'Saber',
    baseName:'Saber',
    search:['Saber','Artoria Pendragon'],
    anime:'Fate',
    baseRarity:'DIVINE',
    basePower:2850,
    corruptedName:'Corrupted Saber',
    corruptedFile:'Corrupted_Saber.png',
    corruptedPower:5500,
    role:'DPS',
    element:'LIGHT'
  },
  {
    key:'AllMight',
    baseName:'All Might',
    search:['All Might','Toshinori Yagi'],
    anime:'My Hero Academia',
    baseRarity:'MYTHIC',
    basePower:1750,
    corruptedName:'Corrupted All Might',
    corruptedFile:'Corrupted_AllMight.png',
    corruptedPower:5300,
    role:'TANK',
    element:'LIGHT'
  }
];

function orSearch(entry) {
  return entry.search.map(s => ({ name: { contains: s } }));
}

async function findBaseCandidate(entry) {
  const all = await prisma.character.findMany({ where: { OR: orSearch(entry) } }).catch(() => []);
  const clean = all.filter(c => !isSpecialVariantName(c.name));

  const mal = clean.find(c => String(c.imageUrl || '').includes('cdn.myanimelist.net'));
  if (mal) return mal;

  const active = clean.find(c => c.active);
  if (active) return active;

  return clean[0] || null;
}

async function findCorrupted(entry) {
  const all = await prisma.character.findMany({
    where: {
      OR: [
        { name: { contains: entry.corruptedName } },
        { name: { contains: `Corrupted ${entry.key}` } },
        { name: { contains: `Corrupted ${entry.baseName}` } },
        ...entry.search.map(s => ({ name: { contains: `Corrupted ${s}` } }))
      ]
    }
  }).catch(() => []);

  return all.find(c => norm(c.name) === norm(entry.corruptedName)) ||
    all.find(c => /corrupted/i.test(c.name || '')) ||
    null;
}

async function upsertBase(entry) {
  let base = await findBaseCandidate(entry);
  let imageUrl = base?.imageUrl || null;

  if (!imageUrl || !String(imageUrl).includes('cdn.myanimelist.net')) {
    imageUrl = await fetchMalImage(entry.baseName) || imageUrl;
  }

  const data = pickCharacterData({
    name: entry.baseName,
    anime: base?.anime && !/MyAnimeList/i.test(base.anime) ? base.anime : entry.anime,
    rarity: entry.baseRarity,
    basePower: entry.basePower,
    imageUrl,
    active: true,
    limited: false,
    banner: null,
    role: entry.role,
    element: entry.element,
    variant: null
  });

  if (base) {
    base = await prisma.character.update({ where: { id: base.id }, data });
    console.log(`✅ Base fixed: ${base.name} • ${base.rarity} • PWR ${base.basePower}`);
    return base;
  }

  base = await prisma.character.create({
    data: pickCharacterData({
      id: id('base'),
      ...data,
      baseFarm: Math.floor(entry.basePower * 8),
      baseLuck: Math.floor(entry.basePower * 2),
      globalPrint: 0,
      createdAt: new Date()
    })
  });
  console.log(`✅ Base created: ${base.name} • ${base.rarity} • PWR ${base.basePower}`);
  return base;
}

async function upsertCorrupted(entry) {
  let corr = await findCorrupted(entry);
  const expectedUrl = `${RAW_BASE}/${entry.corruptedFile}`;

  const data = pickCharacterData({
    name: entry.corruptedName,
    anime: entry.anime,
    rarity: 'SECRET',
    basePower: entry.corruptedPower,
    imageUrl: expectedUrl,
    active: true,
    limited: true,
    banner: 'CORRUPTED_EVENT',
    role: entry.role,
    element: entry.key === 'Lelouch' ? 'VOID' : entry.element,
    variant: 'Corrupted'
  });

  if (corr) {
    corr = await prisma.character.update({ where: { id: corr.id }, data });
    console.log(`✅ Corrupted fixed: ${corr.name} • SECRET • PWR ${corr.basePower}`);
    return corr;
  }

  corr = await prisma.character.create({
    data: pickCharacterData({
      id: id('corrupted'),
      ...data,
      baseFarm: Math.floor(entry.corruptedPower * 8),
      baseLuck: Math.floor(entry.corruptedPower * 2),
      globalPrint: 0,
      createdAt: new Date()
    })
  });
  console.log(`✅ Corrupted created: ${corr.name} • SECRET • PWR ${corr.basePower}`);
  return corr;
}

async function disableWrongVariants(entry, keepIds) {
  if (!CHARACTER_FIELDS.has('active')) return 0;

  const all = await prisma.character.findMany({ where: { OR: orSearch(entry) } }).catch(() => []);
  const junkIds = all
    .filter(c => !keepIds.has(c.id))
    .filter(c => isSpecialVariantName(c.name) || String(c.id || '').startsWith('gen_'))
    .map(c => c.id);

  if (!junkIds.length) return 0;
  const res = await prisma.character.updateMany({ where: { id: { in: junkIds } }, data: { active: false } });
  return res.count || 0;
}

async function scaleOwnedCards(characterIds, baseById) {
  const cards = await prisma.userCard.findMany({ where: { characterId: { in: characterIds } } }).catch(() => []);
  let changed = 0;

  for (const card of cards) {
    const basePower = Number(baseById[card.characterId] || 1000);
    const level = Number(card.level || 1);
    const target = Math.floor(basePower * (1 + Math.max(0, level - 1) * 0.025));

    if (Number(card.power || 0) > 50000 || Number(card.power || 0) < 10) {
      await prisma.userCard.update({ where: { id: card.id }, data: { power: target } }).catch(() => {});
      changed++;
    }
  }

  return changed;
}

function replaceFunctionBlock(src, functionName, replacement) {
  const start = src.indexOf(`function ${functionName}`);
  if (start < 0) return src;
  const brace = src.indexOf('{', start);
  let depth = 0, quote = null, esc = false;

  for (let i = brace; i < src.length; i++) {
    const ch = src[i];

    if (quote) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(0, start) + replacement + src.slice(i + 1);
    }
  }

  return src;
}

function patchPassiveOf() {
  const indexPath = path.join(process.cwd(), 'src', 'index.js');
  if (!fs.existsSync(indexPath)) return console.log('⚠️ src/index.js not found, passive patch skipped.');

  let s = fs.readFileSync(indexPath, 'utf8');
  const backup = path.join(process.cwd(), 'src', `index.backup-passives-power-${Date.now()}.js`);
  fs.copyFileSync(indexPath, backup);

  const passiveFn = `function passiveOf(c={}) {
  const n = String(c.name || '').toLowerCase();

  // Corrupted/Base character accurate passives. Lelouch kept as requested.
  if (n.includes('lelouch')) return {
    name:'Geass Command',
    text:'30% chance to stun and reduce enemy damage.',
    effect:{ stun:30, enemyAtk:-12, control:20 }
  };

  if (n.includes('aizen')) return {
    name:'Kyoka Suigetsu',
    text:'Distorts enemy senses: enemy miss chance, enemy ATK down, and control accuracy up.',
    effect:{ miss:25, enemyAtk:-15, control:22, dmg:8 }
  };

  if (n.includes('itachi')) return {
    name:'Tsukuyomi',
    text:'Locks enemies in genjutsu: high control accuracy, enemy miss chance, and bonus damage to weakened enemies.',
    effect:{ miss:18, control:25, execute:10, dmg:8 }
  };

  if (n.includes('ainz')) return {
    name:'The Goal of All Life',
    text:'Dark magic pressure: boss damage, enemy defense reduction, and summon dominance.',
    effect:{ bossDmg:22, pen:12, dmg:10 }
  };

  if (n.includes('rimuru')) return {
    name:'Predator',
    text:'Adapts after attacking: lifesteal, defense steal, and bonus skill damage.',
    effect:{ lifesteal:14, pen:10, dmg:12 }
  };

  if (n.includes('makima')) return {
    name:'Control Devil',
    text:'Dominates the strongest enemy: enemy ATK down and team damage up.',
    effect:{ teamDmg:12, enemyAtk:-16, control:18 }
  };

  if (n.includes('gojo') || n.includes('gojou')) return {
    name:'Infinity',
    text:'Blocks the first heavy hit each battle, increases dodge, and boosts burst damage.',
    effect:{ shield:1, dodge:18, dmg:10 }
  };

  if (n.includes('eren')) return {
    name:'Titan Rage',
    text:'Gains defense and damage as HP drops, with bonus boss pressure.',
    effect:{ def:14, dmg:12, bossDmg:10 }
  };

  if (n.includes('saber') || n.includes('artoria')) return {
    name:'Excalibur',
    text:'Builds light burst power: anti-boss damage and defensive barrier.',
    effect:{ bossDmg:18, def:12, dmg:8 }
  };

  if (n.includes('all might') || n.includes('toshinori')) return {
    name:'Plus Ultra',
    text:'Heroic last stand: high defense, team protection, and heavy smash damage.',
    effect:{ def:18, teamDmg:8, dmg:12 }
  };

  if (n.includes('sukuna')) return { name:'Malevolent Shrine', text:'+25% boss damage and execute low HP enemies.', effect:{ bossDmg:25, execute:15 } };
  if (n.includes('madara')) return { name:'Wake Up To Reality', text:'+20% AoE damage and +10% defense.', effect:{ dmg:20, def:10 } };

  return { name:\`\${roleOf(c)} Combat Style\`, text:\`\${roleOf(c)} passive gives a small real battle bonus.\`, effect:{ dmg:6 } };
}`;

  const before = s;
  s = replaceFunctionBlock(s, 'passiveOf', passiveFn);

  if (s !== before) {
    fs.writeFileSync(indexPath, s, 'utf8');
    console.log(`✅ Patched passiveOf in src/index.js. Backup: ${path.relative(process.cwd(), backup)}`);
  } else {
    console.log('⚠️ passiveOf function not found or not patched.');
  }
}

async function main() {
  console.log('=== FINAL FIX: base/corrupted pairs + images + power + passives ===');

  const affectedIds = [];
  const baseById = {};
  const report = [];

  for (const entry of PLAN) {
    const base = await upsertBase(entry);
    const corr = await upsertCorrupted(entry);
    const disabled = await disableWrongVariants(entry, new Set([base.id, corr.id]));

    affectedIds.push(base.id, corr.id);
    baseById[base.id] = Number(base.basePower);
    baseById[corr.id] = Number(corr.basePower);

    report.push({
      key: entry.key,
      base: base.name,
      baseRarity: base.rarity,
      basePower: base.basePower,
      baseImage: base.imageUrl ? 'OK' : 'MISSING',
      corrupted: corr.name,
      corruptedPower: corr.basePower,
      corruptedImage: corr.imageUrl,
      disabled
    });
  }

  const scaled = await scaleOwnedCards(affectedIds, baseById);
  patchPassiveOf();

  console.log('\n=== Final Pair Report ===');
  console.table(report.map(r => ({
    key: r.key,
    base: r.base,
    baseRarity: r.baseRarity,
    basePower: r.basePower,
    baseImage: r.baseImage,
    corrupted: r.corrupted,
    corruptedPower: r.corruptedPower,
    disabled: r.disabled
  })));

  console.log(`\n✅ Owned cards scaled if insane power: ${scaled}`);
  console.log('✅ Done. Test /variants name:Lelouch and /character name:Lelouch + /character name:Corrupted Lelouch.');
}

main()
  .catch(err => {
    console.error('❌ Final fix failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
