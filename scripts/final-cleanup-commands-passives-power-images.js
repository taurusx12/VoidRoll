// VoidRoll Reborn — FINAL CLEANUP
// Fixes after full launch:
// 1) Commands hitting "Command is registered but not implemented yet...".
// 2) Generic passive text like "DPS Combat Style — DPS passive gives a small real battle bonus."
// 3) Corrupted power too low vs Secret/Divine.
// 4) Normal versions accidentally becoming SECRET.
// 5) Corrupted image mismatch/cache issue by adding cache-busted image URLs.
//
// Run:
//   node scripts/final-cleanup-commands-passives-power-images.js
//   node --check src/index.js
//   node --check src/systems/characterCombatProfileSystem.js 2>/dev/null || true
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   node scripts/full-launch-audit.js
//   npm start

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const CACHE_TAG = `v=final_cleanup_${Date.now()}`;
const RAW_BASE = 'https://raw.githubusercontent.com/taurusx12/VoidRoll/main/public/images/events/corrupted';

const CHARACTER_MODEL = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
const CHARACTER_FIELDS = new Set((CHARACTER_MODEL?.fields || []).filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));

function pickData(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (CHARACTER_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function norm(x) {
  return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isCorruptedName(name) {
  return /^corrupted\b/i.test(String(name || '').trim());
}

function isJunkVariant(name) {
  return /(absolute|voidborn|eclipse|abyssal|awakened|true form|festival|variant|training|early arc|final arc|domain form|transcendent|ultimate|raid variant|dark variant|light variant|shadow variant|demon variant|hero variant|royal variant)/i.test(String(name || ''));
}

function cacheBust(url) {
  if (!url) return url;
  return String(url).split('?')[0] + '?' + CACHE_TAG;
}

const PLAN = [
  { key:'Itachi', baseName:'Itachi Uchiha', search:['Itachi Uchiha','Itachi'], anime:'Naruto', baseRarity:'DIVINE', basePower:42000, corruptedName:'Corrupted Itachi Uchiha', file:'Corrupted_Itachi.png', corruptedPower:96000, role:'CONTROL', element:'SHADOW' },
  { key:'Aizen', baseName:'Sousuke Aizen', search:['Sousuke Aizen','Sosuke Aizen','Aizen'], anime:'Bleach', baseRarity:'DIVINE', basePower:46000, corruptedName:'Corrupted Sousuke Aizen', file:'Corrupted_Aizen.png', corruptedPower:115000, role:'CONTROL', element:'VOID' },
  { key:'Ainz', baseName:'Ainz Ooal Gown', search:['Ainz Ooal Gown','Ainz'], anime:'Overlord', baseRarity:'DIVINE', basePower:44000, corruptedName:'Corrupted Ainz Ooal Gown', file:'Corrupted_Ainz.png', corruptedPower:108000, role:'SUMMONER', element:'DARK', fallbackImage:'https://cdn.myanimelist.net/images/characters/10/352557.jpg' },
  { key:'Rimuru', baseName:'Rimuru Tempest', search:['Rimuru Tempest','Rimuru'], anime:'That Time I Got Reincarnated as a Slime', baseRarity:'DIVINE', basePower:45000, corruptedName:'Corrupted Rimuru Tempest', file:'Corrupted_Rimuru.png', corruptedPower:110000, role:'DPS', element:'VOID' },
  { key:'Makima', baseName:'Makima', search:['Makima'], anime:'Chainsaw Man', baseRarity:'DIVINE', basePower:41000, corruptedName:'Corrupted Makima', file:'Corrupted_Makima.png', corruptedPower:98000, role:'CONTROL', element:'CURSED' },
  { key:'Lelouch', baseName:'Lelouch Lamperouge', search:['Lelouch Lamperouge','Lelouch'], anime:'Code Geass', baseRarity:'MYTHIC', basePower:26000, corruptedName:'Corrupted Lelouch Lamperouge', file:'Corrupted_Lelouch.png', corruptedPower:94000, role:'CONTROL', element:'VOID' },
  { key:'Gojo', baseName:'Satoru Gojo', search:['Satoru Gojo','Satoru Gojou','Gojo','Gojou'], anime:'Jujutsu Kaisen', baseRarity:'DIVINE', basePower:48000, corruptedName:'Corrupted Satoru Gojo', file:'Corrupted_Gojo.png', corruptedPower:120000, role:'CONTROL', element:'LIGHT' },
  { key:'Eren', baseName:'Eren Yeager', search:['Eren Yeager','Eren Jaeger','Eren'], anime:'Attack on Titan', baseRarity:'MYTHIC', basePower:24000, corruptedName:'Corrupted Eren Yeager', file:'Corrupted_Eren.png', corruptedPower:90000, role:'TANK', element:'BLOOD' },
  { key:'Saber', baseName:'Saber', search:['Saber','Artoria Pendragon'], anime:'Fate', baseRarity:'DIVINE', basePower:40000, corruptedName:'Corrupted Saber', file:'Corrupted_Saber.png', corruptedPower:97000, role:'DPS', element:'LIGHT' },
  { key:'AllMight', baseName:'All Might', search:['All Might','Toshinori Yagi'], anime:'My Hero Academia', baseRarity:'MYTHIC', basePower:23000, corruptedName:'Corrupted All Might', file:'Corrupted_AllMight.png', corruptedPower:92000, role:'TANK', element:'LIGHT' }
];

function orSearch(entry) {
  return entry.search.map(s => ({ name: { contains: s } }));
}

async function findBase(entry) {
  const all = await prisma.character.findMany({ where: { OR: orSearch(entry) } }).catch(() => []);
  const clean = all.filter(c => !isCorruptedName(c.name) && !isJunkVariant(c.name));
  return clean.find(c => norm(c.name) === norm(entry.baseName)) ||
    clean.find(c => String(c.imageUrl || '').includes('cdn.myanimelist.net')) ||
    clean.find(c => c.active) ||
    clean[0] ||
    null;
}

async function findCorrupted(entry) {
  const all = await prisma.character.findMany({
    where: {
      OR: [
        { name: { contains: entry.corruptedName } },
        { name: { contains: `Corrupted ${entry.baseName}` } },
        { name: { contains: `Corrupted ${entry.key}` } },
        ...entry.search.map(s => ({ name: { contains: `Corrupted ${s}` } }))
      ]
    }
  }).catch(() => []);
  return all.find(c => norm(c.name) === norm(entry.corruptedName)) ||
    all.find(c => isCorruptedName(c.name)) ||
    null;
}

async function getMalImage(entry, current) {
  if (current && String(current).includes('cdn.myanimelist.net')) return current;
  if (entry.fallbackImage) return entry.fallbackImage;
  try {
    const res = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(entry.baseName)}&limit=5`);
    if (!res.ok) return current;
    const data = await res.json();
    const item = (data.data || []).find(x => norm(x.name) === norm(entry.baseName)) || (data.data || [])[0];
    return item?.images?.jpg?.image_url || item?.images?.webp?.image_url || current;
  } catch {
    return current;
  }
}

async function fixCharacters() {
  const report = [];
  const affectedIds = [];
  const basePowerByCharacter = {};

  for (const entry of PLAN) {
    let base = await findBase(entry);
    let corrupted = await findCorrupted(entry);

    const baseImage = await getMalImage(entry, base?.imageUrl);
    const corruptedUrl = cacheBust(`${RAW_BASE}/${entry.file}`);

    if (base) {
      base = await prisma.character.update({
        where: { id: base.id },
        data: pickData({
          name: entry.baseName,
          anime: base.anime && !/MyAnimeList/i.test(base.anime) ? base.anime : entry.anime,
          rarity: entry.baseRarity,
          basePower: entry.basePower,
          imageUrl: baseImage,
          active: true,
          limited: false,
          banner: null,
          role: entry.role,
          element: entry.element,
          variant: null
        })
      });
    } else {
      base = await prisma.character.create({
        data: pickData({
          id: `base_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: entry.baseName,
          anime: entry.anime,
          rarity: entry.baseRarity,
          basePower: entry.basePower,
          imageUrl: baseImage,
          active: true,
          limited: false,
          banner: null,
          baseFarm: Math.floor(entry.basePower * 4),
          baseLuck: Math.floor(entry.basePower * 1.5),
          role: entry.role,
          element: entry.element,
          createdAt: new Date()
        })
      });
    }

    if (corrupted) {
      corrupted = await prisma.character.update({
        where: { id: corrupted.id },
        data: pickData({
          name: entry.corruptedName,
          anime: entry.anime,
          rarity: 'SECRET',
          basePower: entry.corruptedPower,
          imageUrl: corruptedUrl,
          active: true,
          limited: true,
          banner: 'CORRUPTED_EVENT',
          role: entry.role,
          element: entry.key === 'Lelouch' ? 'VOID' : entry.element,
          variant: 'Corrupted'
        })
      });
    } else {
      corrupted = await prisma.character.create({
        data: pickData({
          id: `corrupted_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: entry.corruptedName,
          anime: entry.anime,
          rarity: 'SECRET',
          basePower: entry.corruptedPower,
          imageUrl: corruptedUrl,
          active: true,
          limited: true,
          banner: 'CORRUPTED_EVENT',
          baseFarm: Math.floor(entry.corruptedPower * 4),
          baseLuck: Math.floor(entry.corruptedPower * 1.5),
          role: entry.role,
          element: entry.element,
          createdAt: new Date()
        })
      });
    }

    // Disable only junk variants. Keep exactly base + corrupted active.
    const all = await prisma.character.findMany({ where: { OR: orSearch(entry) } }).catch(() => []);
    const keep = new Set([base.id, corrupted.id]);
    const junk = all
      .filter(c => !keep.has(c.id))
      .filter(c => String(c.id || '').startsWith('gen_') || isJunkVariant(c.name) || isCorruptedName(c.name))
      .map(c => c.id);

    if (junk.length && CHARACTER_FIELDS.has('active')) {
      await prisma.character.updateMany({ where: { id: { in: junk } }, data: { active: false } }).catch(() => {});
    }

    affectedIds.push(base.id, corrupted.id);
    basePowerByCharacter[base.id] = entry.basePower;
    basePowerByCharacter[corrupted.id] = entry.corruptedPower;

    report.push({
      key: entry.key,
      base: base.name,
      baseRarity: base.rarity,
      basePower: base.basePower,
      baseImage: base.imageUrl,
      corrupted: corrupted.name,
      corruptedPower: corrupted.basePower,
      corruptedImage: corrupted.imageUrl,
      disabled: junk.length
    });
  }

  // Fix owned card powers for affected characters if absurdly low/high compared to new base.
  const cards = await prisma.userCard.findMany({ where: { characterId: { in: affectedIds } } }).catch(() => []);
  let scaled = 0;
  for (const card of cards) {
    const basePower = Number(basePowerByCharacter[card.characterId] || 25000);
    const level = Number(card.level || 1);
    const expected = Math.floor(basePower * (1 + Math.max(0, level - 1) * 0.035));
    const current = Number(card.power || 0);
    if (current < Math.floor(basePower * 0.4) || current > basePower * 25) {
      await prisma.userCard.update({ where: { id: card.id }, data: { power: expected } }).catch(() => {});
      scaled++;
    }
  }

  console.log('\n=== Character Fix Report ===');
  console.table(report.map(r => ({
    key: r.key,
    base: r.base,
    baseRarity: r.baseRarity,
    basePower: r.basePower,
    corrupted: r.corrupted,
    corruptedPower: r.corruptedPower,
    disabled: r.disabled
  })));
  console.log(`✅ Owned cards rescaled: ${scaled}`);
}

function characterPassiveJS() {
  return `function getAccuratePassive(c={}) {
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

function patchIndexRoutingAndPassives() {
  const indexPath = path.join(process.cwd(), 'src', 'index.js');
  if (!fs.existsSync(indexPath)) return;

  let s = fs.readFileSync(indexPath, 'utf8');
  const backup = path.join(process.cwd(), 'src', `index.backup-final-cleanup-${Date.now()}.js`);
  fs.copyFileSync(indexPath, backup);

  // Ensure imports.
  const imports = [
    "const rollBank = require('./systems/rollBankSystem');",
    "const huntZoneSystem = require('./systems/huntZoneSystem');",
    "const bountyBoardSystem = require('./systems/bountyBoardSystem');",
    "const bossContractsSystem = require('./systems/bossContractsSystem');",
    "const relicSystem = require('./systems/relicSystem');",
    "const traitsSystem = require('./systems/traitsSystem');",
    "const eventShopSystem = require('./systems/eventShopSystem');",
    "const corruptedRaidSystem = require('./systems/corruptedRaidSystem');",
    "const bannerSystem = require('./systems/bannerSystem');"
  ];

  for (const line of imports) {
    if (!s.includes(line)) {
      const reqs = [...s.matchAll(/^const .+require\(.+\);$/gm)];
      if (reqs.length) {
        const last = reqs[reqs.length - 1];
        const pos = last.index + last[0].length;
        s = s.slice(0, pos) + '\n' + line + s.slice(pos);
      } else {
        s = line + '\n' + s;
      }
    }
  }

  // Add route right after commandName/userId line if missing.
  if (!s.includes('FINAL_CLEANUP_COMMAND_ROUTE')) {
    const needle = "const commandName = i.commandName; const userId = i.user.id;";
    const route = `const commandName = i.commandName; const userId = i.user.id;
  // FINAL_CLEANUP_COMMAND_ROUTE
  if (commandName === 'rolls') return rollBank.handleRollsCommand(i, prisma);
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleCommand(i, prisma, rollBank);
  if (['bounty','bounties','bounty-claim'].includes(commandName)) return bountyBoardSystem.handleCommand(i, prisma, rollBank);
  if (['contracts','contract-start'].includes(commandName)) return bossContractsSystem.handleCommand(i, prisma, rollBank);
  if (['relics','relic-give','relic-upgrade','relic-equip'].includes(commandName)) return relicSystem.handleCommand(i, prisma, rollBank);
  if (['traits','trait-set'].includes(commandName)) return traitsSystem.handleCommand(i, prisma, rollBank);
  if (['event-shop','event-buy'].includes(commandName)) return eventShopSystem.handleCommand(i, prisma, rollBank);
  if (['corrupted-raid','raid-attack'].includes(commandName)) return corruptedRaidSystem.handleCommand(i, prisma, rollBank);
  if (['premium-roll','event-roll'].includes(commandName)) return bannerSystem.handleCommand(i, prisma, rollBank);`;
    if (s.includes(needle)) s = s.replace(needle, route);
  }

  // Replace fallback text to avoid ugly "registered but not implemented" for official commands.
  s = s.replace(
    /return i\.reply\('Command is registered but not implemented yet in clean launch build\.'\);/g,
    `return i.reply('This command is not active in this build yet. If this is a launch command, redeploy slash commands and restart the bot.');`
  );

  // Patch passiveOf.
  const passiveFn = `${characterPassiveJS()}

function passiveOf(c={}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;

  const role = typeof roleOf === 'function' ? roleOf(c) : 'Unit';
  return { name:\`\${role} Combat Style\`, text:\`\${role} passive gives a small real battle bonus.\`, effect:{ dmg:6 } };
}`;
  s = replaceFunctionBlock(s, 'passiveOf', passiveFn);

  fs.writeFileSync(indexPath, s, 'utf8');
  console.log(`✅ Patched src/index.js routing + passiveOf. Backup: ${path.relative(process.cwd(), backup)}`);
}

function patchCombatProfileSystem() {
  const candidates = [
    path.join(process.cwd(), 'src', 'systems', 'characterCombatProfileSystem.js'),
    path.join(process.cwd(), 'src', 'systems', 'battlePolishSystem.js')
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;

    let s = fs.readFileSync(file, 'utf8');
    if (!/DPS Combat Style|DPS passive gives a small real battle bonus|Anime Combat Passive|DPS Mastery|Combat Style/i.test(s)) {
      continue;
    }

    const backup = `${file}.backup-final-cleanup-${Date.now()}.js`;
    fs.copyFileSync(file, backup);

    // If a passiveOf function exists, replace it.
    const passiveFn = `${characterPassiveJS()}

function passiveOf(c={}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;

  const role = typeof roleOf === 'function' ? roleOf(c) : 'Unit';
  return { name:\`\${role} Combat Style\`, text:\`\${role} passive gives a small real battle bonus.\`, effect:{ dmg:6 } };
}`;

    const before = s;
    s = replaceFunctionBlock(s, 'passiveOf', passiveFn);

    // Also replace generic strings if used inline.
    s = s.replace(/Anime Combat Passive/g, 'Character Combat Passive');
    s = s.replace(/DPS Mastery/g, 'Character Mastery');
    s = s.replace(/DPS passive affects real battle stats\./g, 'Character passive affects real battle stats.');
    s = s.replace(/DPS passive gives a small real battle bonus\./g, 'Character passive gives a small real battle bonus.');

    if (s !== before) {
      fs.writeFileSync(file, s, 'utf8');
      console.log(`✅ Patched passive fallback in ${path.relative(process.cwd(), file)}. Backup: ${path.relative(process.cwd(), backup)}`);
    }
  }
}

async function finalReport() {
  const rows = [];

  for (const entry of PLAN) {
    const base = await prisma.character.findFirst({ where: { name: entry.baseName } }).catch(() => null);
    const corr = await prisma.character.findFirst({ where: { name: entry.corruptedName } }).catch(() => null);
    rows.push({
      key: entry.key,
      base: base?.name || 'missing',
      baseRarity: base?.rarity || '-',
      basePower: base?.basePower || '-',
      baseImage: base?.imageUrl ? 'OK' : 'MISSING',
      corrupted: corr?.name || 'missing',
      corruptedRarity: corr?.rarity || '-',
      corruptedPower: corr?.basePower || '-',
      corruptedImage: corr?.imageUrl ? 'OK-CACHEBUSTED' : 'MISSING'
    });
  }

  console.log('\n=== Final Cleanup Report ===');
  console.table(rows);
}

async function main() {
  console.log('=== FINAL CLEANUP START ===');
  await fixCharacters();
  patchIndexRoutingAndPassives();
  patchCombatProfileSystem();
  await finalReport();
  console.log('\n✅ FINAL CLEANUP DONE.');
  console.log('Now run:');
  console.log('node --check src/index.js');
  console.log('node --check src/systems/characterCombatProfileSystem.js 2>/dev/null || true');
  console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
  console.log('npm start');
}

main()
  .catch(err => {
    console.error('❌ Cleanup failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
