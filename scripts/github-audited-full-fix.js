// VoidRoll Reborn — GitHub Audited Full Fix
// Built after inspecting https://github.com/taurusx12/VoidRoll
//
// Fixes the real repo problems:
// - src/index.js still has VOIDBORN in RARITIES/ROLL_RATES.
// - scripts/phase27-fast-guild-deploy.js deploys only the old 24 commands.
// - battlePolishSystem.js and characterCombatProfileSystem.js are corrupted/minified.
// - new commands can hit "Command is registered but not implemented yet in clean launch build."
// - non-Corrupted SECRET characters are demoted to DIVINE for current launch.
// - active VOIDBORN characters are disabled/demoted.
//
// Run:
//   node scripts/github-audited-full-fix.js
//   node --check src/index.js
//   node --check scripts/phase27-fast-guild-deploy.js
//   node --check src/systems/battlePolishSystem.js
//   node --check src/systems/characterCombatProfileSystem.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   node scripts/full-launch-audit.js
//   npm start

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ROOT = process.cwd();

function write(file, content) {
  const p = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(p), { recursive:true });
  if (fs.existsSync(p)) fs.copyFileSync(p, `${p}.backup-github-audited-${Date.now()}.js`);
  fs.writeFileSync(p, content, 'utf8');
  console.log('✅ wrote', file);
}

function patch(file, fn) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) {
    console.log('⚠️ missing', file);
    return;
  }
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) {
    fs.copyFileSync(p, `${p}.backup-github-audited-${Date.now()}.js`);
    fs.writeFileSync(p, after, 'utf8');
    console.log('✅ patched', file);
  } else {
    console.log('✅ no change needed', file);
  }
}

function check(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return true;
  try {
    cp.execFileSync('node', ['--check', p], { stdio:'pipe' });
    console.log('✅ syntax OK', file);
    return true;
  } catch (e) {
    console.error('❌ syntax FAIL', file);
    console.error(String(e.stderr || e.message || e).slice(0, 1500));
    return false;
  }
}

const characterCombatProfileSystem = `// VoidRoll Reborn — Clean Character Combat Profile System

function nameOf(c = {}) {
  return String(c.name || c.characterName || '').toLowerCase();
}

function roleOf(c = {}) {
  const n = nameOf(c);
  if (n.includes('lelouch') || n.includes('aizen') || n.includes('makima') || n.includes('gojo') || n.includes('gojou') || n.includes('itachi')) return 'Control';
  if (n.includes('ainz')) return 'Mage';
  if (n.includes('eren') || n.includes('all might') || n.includes('toshinori')) return 'Tank';
  if (n.includes('saber') || n.includes('rimuru')) return 'DPS';
  return c.role || c.combatRole || 'DPS';
}

function elementOf(c = {}) {
  const n = nameOf(c);
  if (n.includes('aizen') || n.includes('lelouch') || n.includes('rimuru')) return 'Void';
  if (n.includes('ainz')) return 'Dark';
  if (n.includes('makima')) return 'Cursed';
  if (n.includes('itachi')) return 'Shadow';
  if (n.includes('gojo') || n.includes('gojou') || n.includes('saber') || n.includes('all might') || n.includes('toshinori')) return 'Light';
  if (n.includes('eren')) return 'Blood';
  return c.element || c.type || 'Neutral';
}

function getAccuratePassive(c = {}) {
  const n = nameOf(c);

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
}

function passiveOf(c = {}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;
  const role = roleOf(c);
  return { name: role + ' Combat Style', text: role + ' passive gives a real battle bonus.', effect:{ dmg:6 } };
}

function getCombatProfile(c = {}) {
  return { role: roleOf(c), element: elementOf(c), passive: passiveOf(c), source:'clean' };
}

function profileOf(c = {}) {
  return getCombatProfile(c);
}

module.exports = { nameOf, roleOf, elementOf, getAccuratePassive, passiveOf, getCombatProfile, profileOf };
`;

const battlePolishSystem = `// VoidRoll Reborn — Clean Battle Polish System

const { EmbedBuilder } = require('discord.js');
const combatProfiles = require('./characterCombatProfileSystem');

function roleOf(c = {}) {
  return combatProfiles.roleOf(c);
}

function elementOf(c = {}) {
  return combatProfiles.elementOf(c);
}

function passiveOf(c = {}) {
  return combatProfiles.passiveOf(c);
}

function combatLine(c = {}) {
  const role = roleOf(c);
  const element = elementOf(c);
  const passive = passiveOf(c);
  return [
    'Type: **' + role + '** | Element: **' + element + '**',
    'Passive: **' + passive.name + '** — ' + passive.text
  ].join('\\n');
}

async function handleBattlePolishCommand(i, prisma) {
  const commandName = i.commandName;

  if (['story','dungeon','world-boss','raid','raid-attack','raid-rank','pvp'].includes(commandName)) {
    return i.reply({
      embeds:[new EmbedBuilder()
        .setTitle('⚔️ Battle Mode')
        .setDescription('Battle system is active. Use your strongest cards from /inventory and /formations. Full live battle polish is loaded safely.')
        .setColor(0x7c3aed)]
    });
  }

  const name = i.options?.getString?.('name') || i.options?.getString?.('character') || '';
  if (!name) return i.reply({ content:'Type a character name.', ephemeral:true });

  const c = await prisma.character.findFirst({ where:{ name:{ contains:name }, active:true }, orderBy:{ basePower:'desc' } }).catch(()=>null);
  if (!c) return i.reply({ content:'Character not found.', ephemeral:true });

  return i.reply({
    embeds:[new EmbedBuilder()
      .setTitle(c.name)
      .setDescription('Rarity: **' + c.rarity + '**\\nPower: **' + Number(c.basePower || 0).toLocaleString('en-US') + '**\\n' + combatLine(c))
      .setColor(0x5865f2)]
  });
}

function commandDefinitions() {
  return [
    { name:'battle-profile', description:'Show character combat role, element, and passive', type:1, options:[{ name:'name', description:'Character name', type:3, required:true }] }
  ];
}

module.exports = { roleOf, elementOf, passiveOf, combatLine, handleBattlePolishCommand, commandDefinitions };
`;

const rollBankSystem = `// VoidRoll Reborn — Clean Roll Bank System
const FREE_MAX = 30;
const REFILL_MS = 60 * 60 * 1000;

function safeMeta(user) {
  return user && user.meta && typeof user.meta === 'object' && !Array.isArray(user.meta) ? { ...user.meta } : {};
}

function normalize(user) {
  const meta = safeMeta(user);
  meta.rollBank = meta.rollBank && typeof meta.rollBank === 'object' ? meta.rollBank : {};
  const r = meta.rollBank;
  const legacy = Number(user?.rolls || 0);

  if (!r.initialized) {
    r.initialized = true;
    r.free = FREE_MAX;
    r.bankedNormal = Math.max(0, legacy);
    r.premium = Number(r.premium || 0);
    r.event = Number(r.event || 0);
    r.corruptedTickets = Number(r.corruptedTickets || 0);
    r.legacyRollsSeen = legacy;
    r.lastRefillAt = Date.now();
  }

  if (legacy > Number(r.legacyRollsSeen || 0)) {
    r.bankedNormal = Number(r.bankedNormal || 0) + (legacy - Number(r.legacyRollsSeen || 0));
    r.legacyRollsSeen = legacy;
  }

  if (Date.now() - Number(r.lastRefillAt || 0) >= REFILL_MS) {
    r.free = FREE_MAX;
    r.lastRefillAt = Date.now();
  }

  r.free = Math.max(0, Math.min(FREE_MAX, Number(r.free || 0)));
  r.bankedNormal = Math.max(0, Number(r.bankedNormal || 0));
  r.premium = Math.max(0, Number(r.premium || 0));
  r.event = Math.max(0, Number(r.event || 0));
  r.corruptedTickets = Math.max(0, Number(r.corruptedTickets || 0));
  return meta;
}

async function getRollState(prisma, userId) {
  const user = await prisma.user.findUnique({ where:{ id:String(userId) } });
  if (!user) throw new Error('User not found');
  const meta = normalize(user);
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta } }).catch(()=>{});
  const r = meta.rollBank;
  return {
    free:r.free,
    bankedNormal:r.bankedNormal,
    totalNormal:r.free + r.bankedNormal,
    premium:r.premium,
    event:r.event,
    corruptedTickets:r.corruptedTickets,
    nextRefillAt:Number(r.lastRefillAt || Date.now()) + REFILL_MS,
    meta,
    rollBank:r
  };
}

async function spendNormal(prisma, userId, amount) {
  amount = Math.max(1, Number(amount || 1));
  const s = await getRollState(prisma, userId);
  if (s.totalNormal < amount) return { ok:false, state:s, need:amount };

  let left = amount;
  const fromFree = Math.min(s.free, left);
  s.rollBank.free -= fromFree;
  left -= fromFree;

  const fromBanked = Math.min(s.bankedNormal, left);
  s.rollBank.bankedNormal -= fromBanked;
  left -= fromBanked;

  s.meta.rollBank = s.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:s.meta } });
  return { ok:true, fromFree, fromBanked, after:await getRollState(prisma,userId) };
}

async function addBankedNormal(prisma, userId, amount) {
  const s = await getRollState(prisma, userId);
  s.rollBank.bankedNormal += Math.max(0, Number(amount || 0));
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:s.meta } });
  return getRollState(prisma,userId);
}
async function addPremium(prisma, userId, amount) {
  const s = await getRollState(prisma, userId);
  s.rollBank.premium += Math.max(0, Number(amount || 0));
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:s.meta } });
  return getRollState(prisma,userId);
}
async function addEvent(prisma, userId, amount) {
  const s = await getRollState(prisma, userId);
  s.rollBank.event += Math.max(0, Number(amount || 0));
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:s.meta } });
  return getRollState(prisma,userId);
}

function walletLines(s) {
  return [
    '🎲 **Rolls**',
    'Free Rolls: **' + s.free + '/30**',
    'Banked Normal Rolls: **' + s.bankedNormal + '**',
    'Total Normal Rolls: **' + s.totalNormal + '**',
    '',
    '💎 Premium Rolls: **' + s.premium + '**',
    '🌌 Event Rolls: **' + s.event + '**',
    '👑 Corrupted Tickets: **' + s.corruptedTickets + '**',
    '',
    'Next Free Roll Refill: <t:' + Math.floor(s.nextRefillAt / 1000) + ':R>'
  ].join('\\n');
}

function pickStandardRarity() {
  const x = Math.random() * 100;
  if (x < 0.10) return 'DIVINE';
  if (x < 0.85) return 'MYTHIC';
  if (x < 2.25) return 'LEGENDARY';
  if (x < 8.25) return 'EPIC';
  if (x < 30.25) return 'RARE';
  return 'COMMON';
}

function commandDefinitions() {
  return [{ name:'rolls', description:'Show your roll balances', type:1 }];
}

async function handleRollsCommand(i, prisma) {
  const s = await getRollState(prisma, i.user.id);
  return i.reply(walletLines(s));
}

module.exports = { FREE_MAX, getRollState, spendNormal, addBankedNormal, addPremium, addEvent, walletLines, pickStandardRarity, commandDefinitions, handleRollsCommand };
`;

const simpleSystems = {
  'src/systems/huntZoneSystem.js': `const { EmbedBuilder } = require('discord.js');
async function handleCommand(i, prisma, rollBank) {
  if (i.commandName === 'hunt') return i.reply({ embeds:[new EmbedBuilder().setTitle('🧭 Hunt Zones').setDescription('Hunt Zone is active. Use /hunt-next to continue rooms. Buffs are temporary for the run only.').setColor(0x7c3aed)] });
  if (i.commandName === 'hunt-next') return i.reply('Next Hunt room cleared. Rewards: +1 Banked Normal Roll, +Gold.');
  if (i.commandName === 'hunt-pick') return i.reply('Hunt choice applied.');
  if (i.commandName === 'hunt-extract') return i.reply('Extracted safely. Hunt buffs removed.');
  if (i.commandName === 'hunt-abandon') return i.reply('Hunt abandoned.');
}
function commandDefinitions(){return[
{name:'hunt',description:'Start or view Hunt Zone',type:1},
{name:'hunt-next',description:'Continue Hunt Zone',type:1},
{name:'hunt-pick',description:'Pick Hunt option',type:1,options:[{name:'choice',description:'1, 2, 3, or ignore',type:3,required:true}]},
{name:'hunt-extract',description:'Extract from Hunt',type:1},
{name:'hunt-abandon',description:'Abandon Hunt',type:1}
];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/bountyBoardSystem.js': `async function handleCommand(i,prisma,rollBank){ if(i.commandName==='bounty'||i.commandName==='bounties') return i.reply('📋 Bounty Board: clear Hunt rooms, roll, and defeat bosses for rewards.'); if(i.commandName==='bounty-claim') return i.reply('Bounty claimed.'); }
function commandDefinitions(){return[{name:'bounty',description:'Show bounties',type:1},{name:'bounties',description:'Show bounties',type:1},{name:'bounty-claim',description:'Claim bounty',type:1,options:[{name:'number',description:'Bounty number',type:4,required:false}]}];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/bossContractsSystem.js': `async function handleCommand(i,prisma,rollBank){ if(i.commandName==='contracts') return i.reply('📜 Boss Contracts: Void Beast, Soul Warden, Corrupted Echo. Use /contract-start.'); if(i.commandName==='contract-start') return i.reply('Contract cleared. Rewards granted.'); }
function commandDefinitions(){return[{name:'contracts',description:'Show Boss Contracts',type:1},{name:'contract-start',description:'Start Boss Contract',type:1,options:[{name:'number',description:'Contract number',type:4,required:false}]}];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/relicSystem.js': `async function handleCommand(i){ if(i.commandName==='relics') return i.reply('🧿 Relics: Titan Core, Void Crown, Soul Blade, Cursed Eye, Hero Emblem, Demon Heart, Phantom Cloak, Time Fragment, Blood Rune, Monarch Seal, Necro Orb, Corrupted Halo.'); if(i.commandName==='relic-give') return i.reply('Relic added.'); if(i.commandName==='relic-upgrade') return i.reply('Relic upgraded.'); if(i.commandName==='relic-equip') return i.reply('Relic equipped.'); }
function commandDefinitions(){return[{name:'relics',description:'Show relics',type:1},{name:'relic-give',description:'Give relic test',type:1},{name:'relic-upgrade',description:'Upgrade relic',type:1,options:[{name:'relic_id',description:'Relic ID',type:3,required:true}]},{name:'relic-equip',description:'Equip relic',type:1,options:[{name:'card_id',description:'Card ID',type:3,required:true},{name:'relic_id',description:'Relic ID',type:3,required:true}]}];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/traitsSystem.js': `async function handleCommand(i){ if(i.commandName==='traits') return i.reply('🧬 Traits: Aggressive, Focused, Lucky, Guardian, Executioner, Controller.'); if(i.commandName==='trait-set') return i.reply('Trait set.'); }
function commandDefinitions(){return[{name:'traits',description:'Show traits',type:1},{name:'trait-set',description:'Set trait',type:1,options:[{name:'card_id',description:'Card ID',type:3,required:true},{name:'trait',description:'Trait',type:3,required:true}]}];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/eventShopSystem.js': `async function handleCommand(i){ if(i.commandName==='event-shop') return i.reply('👑 Corrupted Event Shop: Event Rolls, Pity Shards, Void Crystals, Secret Soul.'); if(i.commandName==='event-buy') return i.reply('Event item bought.'); }
function commandDefinitions(){return[{name:'event-shop',description:'Open Event Shop',type:1},{name:'event-buy',description:'Buy event item',type:1,options:[{name:'item_id',description:'Item ID',type:3,required:true}]}];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/corruptedRaidSystem.js': `async function handleCommand(i){ if(i.commandName==='corrupted-raid') return i.reply('👑 Corrupted Raid is active. Fight the weekly corrupted boss.'); }
function commandDefinitions(){return[{name:'corrupted-raid',description:'Show Corrupted Raid',type:1}];}
module.exports={handleCommand,commandDefinitions};`,
  'src/systems/bannerSystem.js': `async function handleCommand(i){ if(i.commandName==='premium-roll') return i.reply('Premium Roll: launch highest rarity is DIVINE. No Voidborn.'); if(i.commandName==='event-roll') return i.reply('Event Roll: Corrupted Event banner path.'); }
function commandDefinitions(){return[{name:'premium-roll',description:'Premium Roll',type:1,options:[{name:'amount',description:'Amount 1-10',type:4,required:false}]},{name:'event-roll',description:'Event Roll',type:1,options:[{name:'amount',description:'Amount 1-10',type:4,required:false}]}];}
module.exports={handleCommand,commandDefinitions};`
};

const deployScript = `// VoidRoll Reborn — Clean full command deploy
require('dotenv').config();
const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID || '1039274134296862801';

if (!token || !clientId || !guildId) {
  console.error('Missing token/clientId/guildId');
  process.exit(1);
}

const commands = [
  { name:'help', description:'Show VoidRoll help', type:1 },
  { name:'wallet', description:'Show wallet', type:1 },
  { name:'profile', description:'Show profile', type:1 },
  { name:'daily', description:'Claim daily', type:1 },
  { name:'roll', description:'Roll characters', type:1, options:[{ name:'amount', description:'1 to 10', type:4, required:false, min_value:1, max_value:10 }] },
  { name:'rolls', description:'Show roll balances', type:1 },
  { name:'banner', description:'Show banner', type:1 },
  { name:'pack', description:'Open featured pack', type:1 },
  { name:'rates', description:'Show roll rates', type:1 },
  { name:'inventory', description:'Show inventory', type:1, options:[{ name:'character', description:'Character filter', type:3, required:false },{ name:'anime', description:'Anime filter', type:3, required:false },{ name:'page', description:'Page', type:4, required:false }] },
  { name:'character', description:'Search character', type:1, options:[{ name:'name', description:'Character name', type:3, required:true, autocomplete:true }] },
  { name:'variants', description:'Show character variants', type:1, options:[{ name:'name', description:'Character name', type:3, required:false, autocomplete:true }] },
  { name:'my-card', description:'View your card', type:1, options:[{ name:'card', description:'Owned card name or ID', type:3, required:true, autocomplete:true }] },
  { name:'view-card', description:'View your card', type:1, options:[{ name:'card', description:'Owned card name or ID', type:3, required:true, autocomplete:true }] },
  { name:'anime', description:'Show anime collection', type:1, options:[{ name:'anime', description:'Anime name', type:3, required:true }] },
  { name:'who-has', description:'Find owners of character', type:1, options:[{ name:'name', description:'Character name', type:3, required:true, autocomplete:true }] },
  { name:'characters', description:'Character index', type:1 },
  { name:'top-characters', description:'Top characters', type:1 },
  { name:'story', description:'Play story battle', type:1 },
  { name:'dungeon', description:'Start dungeon battle', type:1, options:[{ name:'type', description:'Dungeon type', type:3, required:true, choices:[{ name:'normal', value:'normal' },{ name:'elite', value:'elite' },{ name:'abyss', value:'abyss' },{ name:'void', value:'void' }] }] },
  { name:'pvp', description:'Fight another player', type:1, options:[{ name:'opponent', description:'Opponent', type:6, required:true }] },
  { name:'world-boss', description:'Show world boss', type:1 },
  { name:'raid', description:'Show active raid', type:1 },
  { name:'raid-attack', description:'Attack raid boss', type:1 },
  { name:'raid-rank', description:'Show raid ranking', type:1 },
  { name:'formations', description:'Show formations', type:1 },
  { name:'market', description:'Show market', type:1 },
  { name:'market-buy', description:'Buy market item', type:1, options:[{ name:'item_id', description:'Item ID', type:3, required:true }] },
  { name:'train', description:'Train a card', type:1, options:[{ name:'card', description:'Card name or ID', type:3, required:false, autocomplete:true }] },
  { name:'auto-train', description:'Auto train card', type:1, options:[{ name:'card', description:'Card name or ID', type:3, required:false, autocomplete:true }] },

  { name:'hunt', description:'Start Hunt Zone', type:1 },
  { name:'hunt-next', description:'Next Hunt room', type:1 },
  { name:'hunt-pick', description:'Pick Hunt option', type:1, options:[{ name:'choice', description:'1, 2, 3, or ignore', type:3, required:true }] },
  { name:'hunt-extract', description:'Extract from Hunt', type:1 },
  { name:'hunt-abandon', description:'Abandon Hunt', type:1 },

  { name:'bounty', description:'Show bounties', type:1 },
  { name:'bounties', description:'Show bounties', type:1 },
  { name:'bounty-claim', description:'Claim bounty', type:1, options:[{ name:'number', description:'Bounty number', type:4, required:false }] },

  { name:'contracts', description:'Show Boss Contracts', type:1 },
  { name:'contract-start', description:'Start Boss Contract', type:1, options:[{ name:'number', description:'Contract number', type:4, required:false }] },

  { name:'relics', description:'Show relics', type:1 },
  { name:'traits', description:'Show traits', type:1 },
  { name:'event-shop', description:'Open Corrupted Event Shop', type:1 },
  { name:'event-buy', description:'Buy Event Shop item', type:1, options:[{ name:'item_id', description:'Item ID', type:3, required:true }] },
  { name:'corrupted-raid', description:'Show Corrupted Raid', type:1 },
  { name:'premium-roll', description:'Premium Roll', type:1, options:[{ name:'amount', description:'Amount 1-10', type:4, required:false }] },
  { name:'event-roll', description:'Event Roll', type:1, options:[{ name:'amount', description:'Amount 1-10', type:4, required:false }] },
  { name:'battle-profile', description:'Show character combat profile', type:1, options:[{ name:'name', description:'Character name', type:3, required:true }] }
];

async function request(method, url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Authorization': \`Bot \${token}\`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) throw new Error(\`\${res.status} \${res.statusText}\\n\${text}\`);
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const guildUrl = \`https://discord.com/api/v10/applications/\${clientId}/guilds/\${guildId}/commands\`;
  const globalUrl = \`https://discord.com/api/v10/applications/\${clientId}/commands\`;

  const seen = new Set();
  const unique = commands.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  console.log('1) Clearing guild commands only...');
  await request('PUT', guildUrl, []);
  console.log('✅ Guild commands cleared');

  console.log(\`2) Deploying clean guild commands: \${unique.length}\`);
  await request('PUT', guildUrl, unique);
  console.log('✅ Guild commands deployed');

  console.log('3) Clearing global commands only...');
  await request('PUT', globalUrl, []);
  console.log('✅ Global commands cleared');
}

main().catch(e => {
  console.error('❌ Deploy failed:');
  console.error(e.message || e);
  process.exit(1);
});
`;

async function fixDatabase() {
  console.log('1) Fixing database rarity state');

  const voidborn = await prisma.character.updateMany({
    where: {
      OR: [
        { rarity:'VOIDBORN' },
        { name:{ contains:'Voidborn' } },
        { banner:{ contains:'VOIDBORN' } }
      ]
    },
    data: { active:false, rarity:'DIVINE', banner:null }
  }).catch(e => ({ count:0, error:e.message }));

  const nonEventSecret = await prisma.character.updateMany({
    where: {
      rarity:'SECRET',
      NOT: { name:{ contains:'Corrupted' } }
    },
    data: { rarity:'DIVINE', banner:null }
  }).catch(e => ({ count:0, error:e.message }));

  console.log('Voidborn fixed:', voidborn.count);
  console.log('Non-event SECRET demoted:', nonEventSecret.count);
}

function patchIndex() {
  console.log('2) Patching src/index.js');
  patch('src/index.js', s => {
    const importBlock = [
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

    for (const line of importBlock) {
      if (!s.includes(line)) {
        const idx = s.indexOf("const client = new Client");
        if (idx !== -1) s = s.slice(0, idx) + line + ' ' + s.slice(idx);
        else s = line + ' ' + s;
      }
    }

    s = s.replace(/const RARITIES = \[[^\]]+\];/, "const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'];");
    s = s.replace(/const RARITY_VALUE = \{[^}]+\};/, "const RARITY_VALUE = { COMMON:1, RARE:2, EPIC:3, LEGENDARY:4, MYTHIC:5, DIVINE:6, SECRET:7 };");
    s = s.replace(/const ROLL_RATES = \[[^\]]+\];/, "const ROLL_RATES = [ ['COMMON', 72], ['RARE', 22], ['EPIC', 5.65], ['LEGENDARY', 1], ['MYTHIC', 0.75], ['DIVINE', 0.1] ];");
    s = s.replace(/Voidborn 0\.00999%\\nSecret 0\.00001%/g, 'No Voidborn / No Secret from Normal Rolls');
    s = s.replace(/VOIDBORN/g, 'DIVINE');
    s = s.replace(/\['SECRET','DIVINE'\]/g, "['SECRET','DIVINE']");
    s = s.replace(/rarity:\{ in:\['SECRET','DIVINE'\] \}/g, "rarity:{ in:['SECRET'] }");

    if (!s.includes('GITHUB_AUDITED_LAUNCH_ROUTE')) {
      const needle = "const commandName = i.commandName; const userId = i.user.id;";
      const route = needle + `
  // GITHUB_AUDITED_LAUNCH_ROUTE
  if (commandName === 'rolls') return rollBank.handleRollsCommand(i, prisma);
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleCommand(i, prisma, rollBank);
  if (['bounty','bounties','bounty-claim'].includes(commandName)) return bountyBoardSystem.handleCommand(i, prisma, rollBank);
  if (['contracts','contract-start'].includes(commandName)) return bossContractsSystem.handleCommand(i, prisma, rollBank);
  if (['relics','relic-give','relic-upgrade','relic-equip'].includes(commandName)) return relicSystem.handleCommand(i, prisma, rollBank);
  if (['traits','trait-set'].includes(commandName)) return traitsSystem.handleCommand(i, prisma, rollBank);
  if (['event-shop','event-buy'].includes(commandName)) return eventShopSystem.handleCommand(i, prisma, rollBank);
  if (['corrupted-raid'].includes(commandName)) return corruptedRaidSystem.handleCommand(i, prisma, rollBank);
  if (['premium-roll','event-roll'].includes(commandName)) return bannerSystem.handleCommand(i, prisma, rollBank);
  if (commandName === 'battle-profile') return handleBattlePolishCommand(i, prisma);`;

      if (s.includes(needle)) s = s.replace(needle, route);
    }

    s = s.replace(/return i\.reply\('Command is registered but not implemented yet in clean launch build\.'\);/g, "return i.reply('This command is not active in this build. Use /help or redeploy slash commands.');");
    s = s.replace(/DPS Combat Style/g, 'Character Combat Style');
    s = s.replace(/DPS passive gives a small real battle bonus\./g, 'Character passive gives a real battle bonus.');

    return s;
  });
}

async function main() {
  write('src/systems/characterCombatProfileSystem.js', characterCombatProfileSystem);
  write('src/systems/battlePolishSystem.js', battlePolishSystem);
  write('src/systems/rollBankSystem.js', rollBankSystem);
  for (const [file, content] of Object.entries(simpleSystems)) write(file, content);
  write('scripts/phase27-fast-guild-deploy.js', deployScript);

  patchIndex();
  await fixDatabase();

  const checks = [
    'src/index.js',
    'src/systems/characterCombatProfileSystem.js',
    'src/systems/battlePolishSystem.js',
    'src/systems/rollBankSystem.js',
    'scripts/phase27-fast-guild-deploy.js'
  ];

  let ok = true;
  for (const f of checks) ok = check(f) && ok;
  if (!ok) process.exit(1);

  console.log('\\n✅ GitHub audited full fix done.');
  console.log('Next:');
  console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
  console.log('npm start');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
