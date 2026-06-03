// VoidRoll Reborn — REAL FINAL FIX
// Fixes:
// 1) No active VOIDBORN characters in launch.
// 2) No VOIDBORN from normal/premium/event roll.
// 3) Registered commands that hit "clean launch build" fallback.
// 4) Generic passive text if it still appears.
// 5) Keeps Corrupted as SECRET event-only.
//
// Run:
//   node scripts/real-final-no-voidborn-router-passives-fix.js
//   node --check src/index.js
//   node --check src/systems/battlePolishSystem.js
//   node --check src/systems/characterCombatProfileSystem.js
//   node --check scripts/phase27-fast-guild-deploy.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   node scripts/full-launch-audit.js
//   npm start

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const ROOT = process.cwd();

function backup(file, tag) {
  const b = `${file}.backup-${tag}-${Date.now()}.js`;
  fs.copyFileSync(file, b);
  return b;
}

function check(file) {
  try {
    cp.execFileSync('node', ['--check', file], { stdio:'pipe' });
    console.log(`✅ Syntax OK: ${path.relative(ROOT, file)}`);
    return true;
  } catch (err) {
    console.error(`❌ Syntax failed: ${path.relative(ROOT, file)}`);
    console.error(String(err.stderr || err.message || err).slice(0, 1200));
    return false;
  }
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

const ACCURATE_PASSIVE = `function getAccuratePassive(c={}) {
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

const PASSIVE_OF = `${ACCURATE_PASSIVE}

function passiveOf(c={}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;

  const role = typeof roleOf === 'function' ? roleOf(c) : (c.role || 'Unit');
  return { name:\`\${role} Combat Style\`, text:\`\${role} passive gives a real battle bonus.\`, effect:{ dmg:6 } };
}`;

async function removeVoidbornCharacters() {
  console.log('1) Remove active VOIDBORN from launch');

  const chars = await prisma.character.findMany({
    where: {
      OR: [
        { rarity: 'VOIDBORN' },
        { name: { contains: 'Voidborn' } },
        { banner: { contains: 'VOIDBORN' } }
      ]
    },
    select: { id:true, name:true, rarity:true, active:true, banner:true }
  }).catch(() => []);

  let disabled = 0;
  let converted = 0;

  for (const c of chars) {
    const baseName = String(c.name || '').replace(/^Voidborn\s+/i, '').trim();

    const baseExists = await prisma.character.findFirst({
      where: {
        name: baseName,
        NOT: { id: c.id }
      }
    }).catch(() => null);

    if (baseExists || /^Voidborn\s+/i.test(c.name || '')) {
      await prisma.character.update({
        where: { id: c.id },
        data: {
          active: false,
          rarity: c.rarity === 'VOIDBORN' ? 'DIVINE' : c.rarity,
          banner: null
        }
      }).catch(() => {});
      disabled++;
    } else {
      await prisma.character.update({
        where: { id: c.id },
        data: {
          rarity: 'DIVINE',
          banner: null,
          active: true
        }
      }).catch(() => {});
      converted++;
    }
  }

  const remaining = await prisma.character.count({
    where: {
      active: true,
      OR: [
        { rarity: 'VOIDBORN' },
        { name: { contains: 'Voidborn' } },
        { banner: { contains: 'VOIDBORN' } }
      ]
    }
  }).catch(() => -1);

  console.log(`✅ Voidborn disabled: ${disabled}, converted: ${converted}, remaining active voidborn: ${remaining}`);
}

function patchRollSystems() {
  console.log('2) Remove VOIDBORN from roll systems');

  const rollBank = path.join(ROOT, 'src', 'systems', 'rollBankSystem.js');
  if (fs.existsSync(rollBank)) {
    let s = fs.readFileSync(rollBank, 'utf8');
    const before = s;
    backup(rollBank, 'no-voidborn');

    // Premium highest stays Divine. No Voidborn for launch.
    s = s.replace(/return\s+['"`]VOIDBORN['"`]\s*;/g, "return 'DIVINE';");
    s = s.replace(/rare Voidborn/gi, 'rare Divine');
    s = s.replace(/VOIDBORN/g, 'DIVINE');

    fs.writeFileSync(rollBank, s);
    if (s !== before) console.log('✅ Patched rollBankSystem no VOIDBORN');
  }

  const banner = path.join(ROOT, 'src', 'systems', 'bannerSystem.js');
  if (fs.existsSync(banner)) {
    let s = fs.readFileSync(banner, 'utf8');
    const before = s;
    backup(banner, 'no-voidborn');

    s = s.replace(/if\s*\(x\s*<\s*3\.0\)\s*return\s+['"`]VOIDBORN['"`]\s*;/g, "if (x < 3.0) return 'DIVINE';");
    s = s.replace(/return\s+['"`]VOIDBORN['"`]\s*;/g, "return 'DIVINE';");
    s = s.replace(/VOIDBORN/g, 'DIVINE');

    fs.writeFileSync(banner, s);
    if (s !== before) console.log('✅ Patched bannerSystem no VOIDBORN');
  }
}

function patchPassives() {
  console.log('3) Patch passives and generic text');

  const files = [
    path.join(ROOT, 'src', 'index.js'),
    path.join(ROOT, 'src', 'systems', 'battlePolishSystem.js'),
    path.join(ROOT, 'src', 'systems', 'characterCombatProfileSystem.js')
  ].filter(fs.existsSync);

  for (const file of files) {
    let s = fs.readFileSync(file, 'utf8');
    const before = s;
    backup(file, 'passives-real-final');

    if (s.includes('function passiveOf')) {
      s = replaceFunctionBlock(s, 'passiveOf', PASSIVE_OF);
    }

    // If helper duplicated, it's okay syntactically only if not duplicated in same scope? Avoid exact duplicate by not adding separately.
    s = s.replace(/DPS Mastery/g, 'Character Mastery');
    s = s.replace(/DPS Combat Style/g, 'Character Combat Style');
    s = s.replace(/DPS passive affects real battle stats\./g, 'Character passive affects real battle stats.');
    s = s.replace(/DPS passive gives a small real battle bonus\./g, 'Character passive gives a real battle bonus.');
    s = s.replace(/Passive: DPS/g, 'Passive: Character');

    fs.writeFileSync(file, s);
    if (s !== before) console.log(`✅ Patched ${path.relative(ROOT, file)}`);
  }
}

function patchIndexCommandRouter() {
  console.log('4) Patch command router/fallback');

  const file = path.join(ROOT, 'src', 'index.js');
  if (!fs.existsSync(file)) return;

  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  backup(file, 'router-real-final');

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

  const routeBlock = `
// REAL_FINAL_LAUNCH_COMMAND_GUARD
  if (commandName === 'rolls') return rollBank.handleRollsCommand(i, prisma);
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleCommand(i, prisma, rollBank);
  if (['bounty','bounties','bounty-claim'].includes(commandName)) return bountyBoardSystem.handleCommand(i, prisma, rollBank);
  if (['contracts','contract-start'].includes(commandName)) return bossContractsSystem.handleCommand(i, prisma, rollBank);
  if (['relics','relic-give','relic-upgrade','relic-equip'].includes(commandName)) return relicSystem.handleCommand(i, prisma, rollBank);
  if (['traits','trait-set'].includes(commandName)) return traitsSystem.handleCommand(i, prisma, rollBank);
  if (['event-shop','event-buy'].includes(commandName)) return eventShopSystem.handleCommand(i, prisma, rollBank);
  if (['corrupted-raid','raid-attack'].includes(commandName)) return corruptedRaidSystem.handleCommand(i, prisma, rollBank);
  if (['premium-roll','event-roll'].includes(commandName)) return bannerSystem.handleCommand(i, prisma, rollBank);
`;

  if (!s.includes('REAL_FINAL_LAUNCH_COMMAND_GUARD')) {
    const needle = "const commandName = i.commandName; const userId = i.user.id;";
    if (s.includes(needle)) {
      s = s.replace(needle, needle + routeBlock);
    } else {
      console.log('⚠️ commandName anchor not found; adding guard before fallback only');
    }
  }

  // Add the same guard right before any fallback message, so registered commands never fall through.
  const fallbackOld = "return i.reply('Command is registered but not implemented yet in clean launch build.');";
  const fallbackNew = "return i.reply('This command is not active yet. If it should be active, redeploy slash commands and restart the bot.');";
  if (s.includes(fallbackOld) && !s.includes('REAL_FINAL_BEFORE_FALLBACK_GUARD')) {
    s = s.replace(fallbackOld, `// REAL_FINAL_BEFORE_FALLBACK_GUARD${routeBlock}\n  ${fallbackNew}`);
  } else {
    s = s.replace(/return i\.reply\('Command is registered but not implemented yet in clean launch build\.'\);/g, fallbackNew);
  }

  fs.writeFileSync(file, s);
  if (s !== before) console.log('✅ Patched index router/fallback');
}

function patchDeploy() {
  console.log('5) Patch deploy commands');

  const file = path.join(ROOT, 'scripts', 'phase27-fast-guild-deploy.js');
  if (!fs.existsSync(file)) return;

  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  backup(file, 'deploy-real-final');

  s = s.replace(/const\s+commands\s*=\s*\[/, 'let commands = [');

  const def = `
// REAL_FINAL_COMMANDS
const realFinalCommands = [
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

  if (!s.includes('REAL_FINAL_COMMANDS')) s = def + '\n' + s;

  if (!s.includes('...realFinalCommands')) {
    const pos = s.indexOf('let commands = [');
    if (pos !== -1) {
      const b = s.indexOf('[', pos) + 1;
      s = s.slice(0, b) + '\n  ...realFinalCommands,\n' + s.slice(b);
    }
  }

  if (!s.includes('REAL_FINAL_DEDUPE')) {
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
        if (depth === 0) { end = i; break; }
      }
    }

    if (end !== -1) {
      let insertAt = end + 1;
      if (s[insertAt] === ';') insertAt++;
      const dedupe = `

// REAL_FINAL_DEDUPE
{
  const seen = new Set();
  const before = commands.length;
  const removed = [];
  commands = commands.filter(cmd => {
    if (!cmd || !cmd.name) return false;
    if (seen.has(cmd.name)) { removed.push(cmd.name); return false; }
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

  fs.writeFileSync(file, s);
  if (s !== before) console.log('✅ Patched deploy script');
}

async function report() {
  const voidborn = await prisma.character.count({
    where: {
      active: true,
      OR: [
        { rarity: 'VOIDBORN' },
        { name: { contains: 'Voidborn' } },
        { banner: { contains: 'VOIDBORN' } }
      ]
    }
  }).catch(() => -1);

  const corrupted = await prisma.character.count({
    where: { active:true, rarity:'SECRET', name:{ contains:'Corrupted' } }
  }).catch(() => -1);

  console.log(`\nReport: active voidborn=${voidborn}, active corrupted secret=${corrupted}`);
}

async function main() {
  console.log('=== REAL FINAL NO VOIDBORN / ROUTER / PASSIVES FIX ===');

  await removeVoidbornCharacters();
  patchRollSystems();
  patchPassives();
  patchIndexCommandRouter();
  patchDeploy();

  const files = [
    path.join(ROOT, 'src', 'index.js'),
    path.join(ROOT, 'src', 'systems', 'rollBankSystem.js'),
    path.join(ROOT, 'src', 'systems', 'bannerSystem.js'),
    path.join(ROOT, 'src', 'systems', 'battlePolishSystem.js'),
    path.join(ROOT, 'src', 'systems', 'characterCombatProfileSystem.js'),
    path.join(ROOT, 'scripts', 'phase27-fast-guild-deploy.js')
  ].filter(fs.existsSync);

  let ok = true;
  for (const f of files) ok = check(f) && ok;

  await report();

  if (!ok) {
    console.log('\n❌ One syntax check failed. Send the failing output.');
    process.exit(1);
  }

  console.log('\n✅ REAL FINAL FIX DONE');
  console.log('Run next:');
  console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
  console.log('node scripts/full-launch-audit.js');
  console.log('npm start');
}

main()
  .catch(err => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
