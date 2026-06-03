// VoidRoll Reborn — FINAL REPAIR AFTER CLEANUP
// Fixes remaining launch issues:
// 1) Discord deploy showing only 24 commands instead of full launch commands.
// 2) Commands still going to clean fallback.
// 3) Rimuru base incorrectly SECRET / missing base image.
// 4) Generic passives still showing from combat profile / battle polish systems.
// 5) Forces visible character/passive text to be character-accurate.
//
// Run:
//   node scripts/final-repair-after-cleanup.js
//   node --check src/index.js
//   node --check scripts/phase27-fast-guild-deploy.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   node scripts/full-launch-audit.js
//   npm start

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const ROOT = process.cwd();
const RAW_BASE = 'https://raw.githubusercontent.com/taurusx12/VoidRoll/main/public/images/events/corrupted';
const CACHE_TAG = `v=final_repair_${Date.now()}`;

const CHARACTER_MODEL = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
const CHARACTER_FIELDS = new Set((CHARACTER_MODEL?.fields || []).filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));

function pickData(data) {
  const out = {};
  for (const [k,v] of Object.entries(data)) {
    if (CHARACTER_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function replaceFunctionBlock(src, functionName, replacement) {
  const start = src.indexOf(`function ${functionName}`);
  if (start < 0) return src;

  const brace = src.indexOf('{', start);
  if (brace < 0) return src;

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

const ACCURATE_PASSIVE_HELPER = `function getAccuratePassive(c={}) {
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

const PASSIVE_OF_FN = `${ACCURATE_PASSIVE_HELPER}

function passiveOf(c={}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;

  const role = typeof roleOf === 'function' ? roleOf(c) : 'Unit';
  return { name:\`\${role} Combat Style\`, text:\`\${role} passive gives a small real battle bonus.\`, effect:{ dmg:6 } };
}`;

async function fetchMalImage(name, fallback) {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&limit=10`, {
      headers: { 'User-Agent': 'VoidRollReborn/1.0' }
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const list = Array.isArray(json.data) ? json.data : [];
    const target = list.find(x => norm(x.name) === norm(name)) || list[0];
    return target?.images?.jpg?.image_url || target?.images?.webp?.image_url || fallback;
  } catch {
    return fallback;
  }
}

async function fixRimuruAndRarities() {
  console.log('1) Fix base/corrupted rarities, powers, and images');

  const plan = [
    { base:'Itachi Uchiha', corrupted:'Corrupted Itachi Uchiha', baseRarity:'DIVINE', basePower:42000, corruptedPower:96000, file:'Corrupted_Itachi.png', anime:'Naruto' },
    { base:'Sousuke Aizen', corrupted:'Corrupted Sousuke Aizen', baseRarity:'DIVINE', basePower:46000, corruptedPower:115000, file:'Corrupted_Aizen.png', anime:'Bleach' },
    { base:'Ainz Ooal Gown', corrupted:'Corrupted Ainz Ooal Gown', baseRarity:'DIVINE', basePower:44000, corruptedPower:108000, file:'Corrupted_Ainz.png', anime:'Overlord', fallback:'https://cdn.myanimelist.net/images/characters/10/352557.jpg' },
    { base:'Rimuru Tempest', corrupted:'Corrupted Rimuru Tempest', baseRarity:'DIVINE', basePower:45000, corruptedPower:110000, file:'Corrupted_Rimuru.png', anime:'That Time I Got Reincarnated as a Slime' },
    { base:'Makima', corrupted:'Corrupted Makima', baseRarity:'DIVINE', basePower:41000, corruptedPower:98000, file:'Corrupted_Makima.png', anime:'Chainsaw Man' },
    { base:'Lelouch Lamperouge', corrupted:'Corrupted Lelouch Lamperouge', baseRarity:'MYTHIC', basePower:26000, corruptedPower:94000, file:'Corrupted_Lelouch.png', anime:'Code Geass' },
    { base:'Satoru Gojo', corrupted:'Corrupted Satoru Gojo', baseRarity:'DIVINE', basePower:48000, corruptedPower:120000, file:'Corrupted_Gojo.png', anime:'Jujutsu Kaisen' },
    { base:'Eren Yeager', corrupted:'Corrupted Eren Yeager', baseRarity:'MYTHIC', basePower:24000, corruptedPower:90000, file:'Corrupted_Eren.png', anime:'Attack on Titan' },
    { base:'Saber', corrupted:'Corrupted Saber', baseRarity:'DIVINE', basePower:40000, corruptedPower:97000, file:'Corrupted_Saber.png', anime:'Fate' },
    { base:'All Might', corrupted:'Corrupted All Might', baseRarity:'MYTHIC', basePower:23000, corruptedPower:92000, file:'Corrupted_AllMight.png', anime:'My Hero Academia' }
  ];

  const report = [];

  for (const p of plan) {
    let base = await prisma.character.findFirst({ where: { name: p.base } }).catch(()=>null);

    let img = base?.imageUrl;
    if (!img || !String(img).includes('cdn.myanimelist.net')) {
      img = await fetchMalImage(p.base, p.fallback || img);
    }

    if (!base) {
      base = await prisma.character.create({
        data: pickData({
          id: `base_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: p.base,
          anime: p.anime,
          rarity: p.baseRarity,
          basePower: p.basePower,
          imageUrl: img,
          active: true,
          limited: false,
          banner: null,
          createdAt: new Date()
        })
      });
    } else {
      base = await prisma.character.update({
        where: { id: base.id },
        data: pickData({
          rarity: p.baseRarity,
          basePower: p.basePower,
          imageUrl: img,
          active: true,
          limited: false,
          banner: null,
          variant: null
        })
      });
    }

    let corr = await prisma.character.findFirst({ where: { name: p.corrupted } }).catch(()=>null);
    const corrUrl = `${RAW_BASE}/${p.file}?${CACHE_TAG}`;

    if (!corr) {
      corr = await prisma.character.create({
        data: pickData({
          id: `corr_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          name: p.corrupted,
          anime: p.anime,
          rarity: 'SECRET',
          basePower: p.corruptedPower,
          imageUrl: corrUrl,
          active: true,
          limited: true,
          banner: 'CORRUPTED_EVENT',
          variant: 'Corrupted',
          createdAt: new Date()
        })
      });
    } else {
      corr = await prisma.character.update({
        where: { id: corr.id },
        data: pickData({
          rarity: 'SECRET',
          basePower: p.corruptedPower,
          imageUrl: corrUrl,
          active: true,
          limited: true,
          banner: 'CORRUPTED_EVENT',
          variant: 'Corrupted'
        })
      });
    }

    report.push({
      base: base.name,
      baseRarity: base.rarity,
      basePower: base.basePower,
      baseImage: base.imageUrl ? 'OK' : 'MISSING',
      corrupted: corr.name,
      corruptedPower: corr.basePower,
      corruptedImage: corr.imageUrl ? 'OK' : 'MISSING'
    });
  }

  console.table(report);
}

function walkJs(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walkJs(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

function patchPassivesEverywhere() {
  console.log('2) Patch generic passives everywhere');

  const files = [
    path.join(ROOT, 'src', 'index.js'),
    ...walkJs(path.join(ROOT, 'src', 'systems'))
  ].filter((v, i, a) => a.indexOf(v) === i && fs.existsSync(v));

  let patched = 0;

  for (const file of files) {
    let s = fs.readFileSync(file, 'utf8');
    const before = s;

    if (s.includes('function passiveOf')) {
      s = replaceFunctionBlock(s, 'passiveOf', PASSIVE_OF_FN);
    }

    // Patch common display strings.
    s = s.replace(/Anime Combat Passive/g, 'Character Combat Passive');
    s = s.replace(/DPS Mastery/g, 'Character Mastery');
    s = s.replace(/DPS Combat Style/g, 'Character Combat Style');
    s = s.replace(/DPS passive affects real battle stats\./g, 'Character passive affects real battle stats.');
    s = s.replace(/DPS passive gives a small real battle bonus\./g, 'Character passive gives a small real battle bonus.');

    if (s !== before) {
      const backup = `${file}.backup-final-repair-${Date.now()}.js`;
      fs.copyFileSync(file, backup);
      fs.writeFileSync(file, s);
      console.log(`✅ Patched ${path.relative(ROOT, file)}`);
      patched++;
    }
  }

  console.log(`✅ Passive files patched: ${patched}`);
}

function patchIndexRoutes() {
  console.log('3) Patch index command routing');

  const file = path.join(ROOT, 'src', 'index.js');
  if (!fs.existsSync(file)) return;

  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  const backup = `${file}.backup-final-repair-route-${Date.now()}.js`;

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

  if (!s.includes('FINAL_REPAIR_COMMAND_ROUTE')) {
    const needle = "const commandName = i.commandName; const userId = i.user.id;";
    const route = `const commandName = i.commandName; const userId = i.user.id;
  // FINAL_REPAIR_COMMAND_ROUTE
  if (commandName === 'rolls') return rollBank.handleRollsCommand(i, prisma);
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleCommand(i, prisma, rollBank);
  if (['bounty','bounties','bounty-claim'].includes(commandName)) return bountyBoardSystem.handleCommand(i, prisma, rollBank);
  if (['contracts','contract-start'].includes(commandName)) return bossContractsSystem.handleCommand(i, prisma, rollBank);
  if (['relics','relic-give','relic-upgrade','relic-equip'].includes(commandName)) return relicSystem.handleCommand(i, prisma, rollBank);
  if (['traits','trait-set'].includes(commandName)) return traitsSystem.handleCommand(i, prisma, rollBank);
  if (['event-shop','event-buy'].includes(commandName)) return eventShopSystem.handleCommand(i, prisma, rollBank);
  if (['corrupted-raid','raid-attack'].includes(commandName)) return corruptedRaidSystem.handleCommand(i, prisma, rollBank);
  if (['premium-roll','event-roll'].includes(commandName)) return bannerSystem.handleCommand(i, prisma, rollBank);`;

    if (s.includes(needle)) {
      s = s.replace(needle, route);
    } else {
      console.log('⚠️ commandName anchor not found');
    }
  }

  s = s.replace(
    /return i\.reply\('Command is registered but not implemented yet in clean launch build\.'\);/g,
    `return i.reply('This command is not active in this build yet. If this should be active, redeploy slash commands and restart the bot.');`
  );

  if (s !== before) {
    fs.copyFileSync(file, backup);
    fs.writeFileSync(file, s);
    console.log(`✅ Patched index routes. Backup: ${path.relative(ROOT, backup)}`);
  } else {
    console.log('✅ index routes already patched');
  }
}

function patchDeploy() {
  console.log('4) Patch deploy script to include all commands');

  const file = path.join(ROOT, 'scripts', 'phase27-fast-guild-deploy.js');
  if (!fs.existsSync(file)) {
    console.log('⚠️ phase27-fast-guild-deploy.js not found');
    return;
  }

  let s = fs.readFileSync(file, 'utf8');
  const backup = `${file}.backup-final-repair-deploy-${Date.now()}.js`;
  const before = s;

  s = s.replace(/const\s+commands\s*=\s*\[/, 'let commands = [');

  const def = `
// FINAL_REPAIR_FULL_COMMANDS
const finalRepairCommands = [
  ...require('../src/systems/rollBankSystem').commandDefinitions(),
  ...require('../src/systems/huntZoneSystem').commandDefinitions(),
  ...require('../src/systems/bountyBoardSystem').commandDefinitions(),
  ...require('../src/systems/bossContractsSystem').commandDefinitions(),
  ...require('../src/systems/relicSystem').commandDefinitions(),
  ...require('../src/systems/traitsSystem').commandDefinitions(),
  ...require('../src/systems/eventShopSystem').commandDefinitions(),
  ...require('../src/systems/corruptedRaidSystem').commandDefinitions(),
  ...require('../src/systems/bannerSystem').commandDefinitions(),
];
`;

  if (!s.includes('FINAL_REPAIR_FULL_COMMANDS')) {
    s = def + '\n' + s;
  }

  if (!s.includes('...finalRepairCommands')) {
    const pos = s.indexOf('let commands = [');
    if (pos !== -1) {
      const b = s.indexOf('[', pos) + 1;
      s = s.slice(0, b) + '\n  ...finalRepairCommands,\n' + s.slice(b);
    }
  }

  if (!s.includes('FINAL_REPAIR_DEDUPE')) {
    const pos = s.indexOf('let commands = [');
    const bracketStart = s.indexOf('[', pos);
    let depth = 0, quote = null, esc = false, end = -1;

    for (let i = bracketStart; i < s.length; i++) {
      const ch = s[i];

      if (quote) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === quote) quote = null;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end !== -1) {
      let insertAt = end + 1;
      if (s[insertAt] === ';') insertAt++;
      const dedupe = `

// FINAL_REPAIR_DEDUPE
{
  const seen = new Set();
  const before = commands.length;
  const removed = [];
  commands = commands.filter(cmd => {
    if (!cmd || !cmd.name) return false;
    if (seen.has(cmd.name)) {
      removed.push(cmd.name);
      return false;
    }
    seen.add(cmd.name);
    return true;
  });
  if (removed.length) console.log('⚠️ Removed duplicate command names:', [...new Set(removed)].join(', '));
  console.log(\`✅ Commands deduped: \${before} → \${commands.length}\`);
}
`;
      s = s.slice(0, insertAt) + dedupe + s.slice(insertAt);
    }
  }

  if (s !== before) {
    fs.copyFileSync(file, backup);
    fs.writeFileSync(file, s);
    console.log(`✅ Patched deploy. Backup: ${path.relative(ROOT, backup)}`);
  } else {
    console.log('✅ deploy already patched');
  }
}

async function main() {
  console.log('=== FINAL REPAIR AFTER CLEANUP START ===');
  await fixRimuruAndRarities();
  patchPassivesEverywhere();
  patchIndexRoutes();
  patchDeploy();
  console.log('\n✅ FINAL REPAIR DONE');
  console.log('Run next:');
  console.log('node --check src/index.js');
  console.log('node --check scripts/phase27-fast-guild-deploy.js');
  console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
  console.log('node scripts/full-launch-audit.js');
  console.log('npm start');
}

main()
  .catch(e => {
    console.error('❌ Final repair failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
