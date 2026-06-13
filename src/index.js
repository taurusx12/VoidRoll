// VoidRoll Reborn — OFFICIAL V5 FULL LAUNCH
// One stable entry point. No patch-chain routers. No command-clear deploy requirement.

require('dotenv').config();
const VOIDROLL_BUILD_VERSION = 'V5.20_BANNER_FRAGMENT_TEXT';
const fs = require('fs');
const path = require('path');

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 10000;
const ADMIN_IDS = new Set(String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
const EVENT_PITY_LIMIT = 100;
const EVENT_ROLL_FRAGMENT_COST = 5000;

const app = express();
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));
app.get('/', (_, res) => res.send('VoidRoll Official V5 Full Launch is live.'));
app.get('/health', (_, res) => res.json({ ok: true, version: 'V5_FULL_LAUNCH' }));
app.listen(PORT, () => console.log('Health server on', PORT));

const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'];
const RARITY_ICON = {
  COMMON:    '🪨',
  RARE:      '🔹',
  EPIC:      '🔮',
  LEGENDARY: '💎',
  MYTHIC:    '🌙',
  DIVINE:    '☀️',
  SECRET:    '🌌'
};
const RARITY_BADGE = {
  COMMON:    '🪨 COMMON',
  RARE:      '🔹 RARE',
  EPIC:      '🔮 EPIC',
  LEGENDARY: '💎 LEGENDARY',
  MYTHIC:    '🌙 MYTHIC',
  DIVINE:    '☀️ DIVINE',
  SECRET:    '🌌 SECRET'
};
const RARITY_COLOR = {
  COMMON:   0x6b7280,
  RARE:     0x3b82f6,
  EPIC:     0x8b5cf6,
  LEGENDARY:0xf59e0b,
  MYTHIC:   0xec4899,
  DIVINE:   0xfbbf24,
  SECRET:   0x7c3aed
};

const HUNT_ZONES = [
  { id:'training_fields', name:'Training Fields', tier:1, minPower:5000, color:0x94a3b8,
    story:'The old battlefield where warriors hone their skills. Weak enemies, but good practice.',
    enemies:['Field Soldier','Rookie Duelist','Wandering Knight','Training Golem'],
    bosses:['Field Commander','Iron Sentinel'],
    pool:['gold','tokens','rolls'] },
  { id:'neon_ruins', name:'Neon Ruins', tier:2, minPower:10000, color:0x00d4ff,
    story:'Ancient ruins pulsing with strange energy. Something stirs in the flickering light.',
    enemies:['Neon Phantom','Ruin Stalker','Glitch Shade','Static Wraith'],
    bosses:['Neon Overlord','Circuit Breaker'],
    pool:['gold','tokens','rolls','huntCoins'] },
  { id:'cursed_forest', name:'Cursed Forest', tier:3, minPower:30000, color:0x22c55e,
    story:'A forest where the trees bleed shadow. Every step echoes with ancient curses.',
    enemies:['Cursed Treant','Shadow Wolf','Hexed Hunter','Plague Specter'],
    bosses:['Forest Witch','Ancient Horror'],
    pool:['gold','tokens','essence','huntCoins','rolls'] },
  { id:'frozen_keep', name:'Frozen Keep', tier:4, minPower:50000, color:0x38bdf8,
    story:'A fortress frozen in eternal winter. The ice here is not natural — it hungers.',
    enemies:['Frost Knight','Glacial Wraith','Ice Golem','Blizzard Shade'],
    bosses:['Frozen Warden','Absolute Zero'],
    pool:['gold','tokens','essence','relicStones','rolls'] },
  { id:'abyss_gate', name:'Abyss Gate', tier:5, minPower:70000, color:0x7c3aed,
    story:'The gate between worlds. Those who pass through are never the same.',
    enemies:['Abyss Crawler','Void Sentry','Gate Guardian','Rift Walker'],
    bosses:['Abyss Sovereign','Gate Devourer'],
    pool:['gold','tokens','voidCrystals','essence','relicStones'] },
  { id:'demon_market', name:'Demon Market', tier:6, minPower:110000, color:0xef4444,
    story:'A bazaar run by demons. Everything has a price — including your soul.',
    enemies:['Demon Broker','Blood Merchant','Soul Trader','Infernal Guard'],
    bosses:['Market Overlord','Demon King Vassal'],
    pool:['gold','tokens','corruptedFragments','traitStones','relicStones'] },
  { id:'celestial_peak', name:'Celestial Peak', tier:7, minPower:160000, color:0xfacc15,
    story:'Where heaven meets destruction. Divine warriors fell here — their power lingers.',
    enemies:['Fallen Seraph','Celestial Wraith','Divine Exile',"Heaven's Shard"],
    bosses:['Fallen Archangel','Celestial Tyrant'],
    pool:['gold','tokens','relicStones','voidCrystals','premiumRolls'] },
  { id:'void_sanctum', name:'Void Sanctum', tier:8, minPower:220000, color:0x4c1d95,
    story:'The heart of the Void. Reality breaks down here. Only the strongest survive.',
    enemies:['Void Apostle','Reality Breaker','Sanctum Keeper','Null Entity'],
    bosses:['Void High Priest','Sanctum Destroyer'],
    pool:['gold','tokens','voidCrystals','corruptedFragments','relicStones','traitStones'] },
  { id:'corrupted_throne', name:'Corrupted Throne', tier:9, minPower:300000, color:0x581c87,
    story:'The throne of a fallen god, now consumed by Corruption. Power here is absolute.',
    enemies:['Corrupted Champion','Void Paladin','Throne Phantom','Dark Sovereign'],
    bosses:['Corrupted Throne Guard','Void God Fragment'],
    pool:['gold','tokens','corruptedFragments','voidCrystals','traitStones','eventRolls'] },
  { id:'eternal_void', name:'Eternal Void', tier:10, minPower:420000, color:0x111827,
    story:'The end of all things. Time does not exist here. Only the Void remains.',
    enemies:['Eternal Devourer','Void Incarnate','End Walker','Oblivion Shade'],
    bosses:['Void Eternal','The Undying'],
    pool:['gold','tokens','voidCrystals','corruptedFragments','eventRolls','premiumRolls'] }
];

// Daily Zone rotates every day
function getDailyZone(){
  const dayIdx = Math.floor(Date.now() / 86400000);
  return HUNT_ZONES[dayIdx % HUNT_ZONES.length].id;
}

// Loot rarity tiers
function lootRarity(zone, room){
  const roll = Math.random();
  if(roll < 0.05 + zone.tier * 0.01) return { label:'🌌 VOID', mult:3.5 };
  if(roll < 0.12 + zone.tier * 0.02) return { label:'💎 LEGENDARY', mult:2.5 };
  if(roll < 0.28 + zone.tier * 0.02) return { label:'🔮 EPIC', mult:1.8 };
  if(roll < 0.55) return { label:'🔹 RARE', mult:1.3 };
  return { label:'🪨 COMMON', mult:1.0 };
}

const DUNGEON_ROOMS = [
  { id:'resource', name:'Resource Room', mult:0.85, reward:'essence' },
  { id:'elite', name:'Elite Room', mult:1.25, reward:'relicStones' },
  { id:'treasure', name:'Treasure Room', mult:0.95, reward:'tokens' },
  { id:'boss', name:'Boss Room', mult:1.65, reward:'voidCrystals' },
  { id:'merchant', name:'Merchant Room', mult:0.7, reward:'huntCoins' },
  { id:'wizard', name:'Wizard Room', mult:0.75, reward:'traitStones' }
];

function nid(prefix='id'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
function money(n){ return Number(n || 0).toLocaleString('en-US'); }
function clamp(n,min,max){ return Math.max(min, Math.min(max, Number(n || 0))); }
function norm(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
function title(s){ return String(s || '').replace(/([A-Z])/g,' $1').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()).trim(); }
function safeImage(url){ return url && /^https?:\/\//i.test(String(url)) ? String(url) : null; }
function corruptedImageFile(characterName){
  const n = norm(characterName);
  const map = [
    ['ainz', 'Corrupted_Ainz.png'],
    ['aizen', 'Corrupted_Aizen.png'],
    ['all might', 'Corrupted_AllMight.png'],
    ['eren', 'Corrupted_Eren.png'],
    ['gojo', 'Corrupted_Gojo.png'],
    ['itachi', 'Corrupted_Itachi.png'],
    ['lelouch', 'Corrupted_Lelouch.png'],
    ['makima', 'Corrupted_Makima.png'],
    ['rimuru', 'Corrupted_Rimuru.png'],
    ['saber', 'Corrupted_Saber.png']
  ];
  if(!n.startsWith('corrupted')) return null;
  const hit = map.find(([key]) => n.includes(key));
  if(!hit) return null;
  const filePath = path.join(__dirname, '..', 'public', 'images', 'events', 'corrupted', hit[1]);
  return fs.existsSync(filePath) ? { filePath, fileName: hit[1] } : null;
}
function applyCharacterImage(embed, character){
  const local = corruptedImageFile(character?.name);
  if(local){
    embed.setImage(`attachment://${local.fileName}`).setThumbnail(`attachment://${local.fileName}`);
    return { embed, files:[local.filePath] };
  }
  const img = safeImage(character?.imageUrl);
  if(img) embed.setImage(img).setThumbnail(img);
  return { embed, files:[] };
}
function isAdmin(id){ return ADMIN_IDS.has(String(id)); }
function rIcon(r){ return RARITY_BADGE[r] || (r || 'COMMON'); }
function levelXp(level){ return Math.floor(120 + level * level * 18); }

function metaOf(user){ return user?.meta && typeof user.meta === 'object' && !Array.isArray(user.meta) ? user.meta : {}; }
async function ensureUser(discordUser){
  const id = typeof discordUser === 'string' ? discordUser : discordUser.id;
  const username = typeof discordUser === 'string' ? null : discordUser.username;
  return prisma.user.upsert({
    where:{ id },
    update:{ username: username || undefined },
    create:{ id, username, gold:1000n, tokens:0, gems:0, essence:0, voidCrystals:0, rolls:30, meta:{ resources:{ premiumRolls:0, eventRolls:0 } } }
  });
}
async function updateMeta(userId, fn){
  const user = await prisma.user.findUnique({ where:{ id:userId } }) || await ensureUser(userId);
  const meta = metaOf(user);
  const next = await fn(meta, user) || meta;
  await prisma.user.update({ where:{ id:userId }, data:{ meta: next } });
  return next;
}
function getMetaResource(user, key){ return Number(metaOf(user).resources?.[key] || 0); }
async function addResource(userId, key, amount){
  amount = Math.floor(Number(amount || 0));
  await ensureUser(userId);
  if(key === 'gold') return prisma.user.update({ where:{ id:userId }, data:{ gold:{ increment: BigInt(amount) } } });
  if(['tokens','gems','essence','voidCrystals','rolls'].includes(key)){
    return prisma.user.update({ where:{ id:userId }, data:{ [key]:{ increment: amount } } });
  }
  return updateMeta(userId, meta => {
    meta.resources = meta.resources || {};
    meta.resources[key] = Number(meta.resources[key] || 0) + amount;
    return meta;
  });
}
async function spendResource(userId, key, amount){
  amount = Math.floor(Number(amount || 0));
  const user = await ensureUser(userId);
  if(key === 'gold'){
    if(user.gold < BigInt(amount)) return false;
    await prisma.user.update({ where:{ id:userId }, data:{ gold:{ decrement: BigInt(amount) } } });
    return true;
  }
  if(['tokens','gems','essence','voidCrystals','rolls'].includes(key)){
    if(Number(user[key] || 0) < amount) return false;
    await prisma.user.update({ where:{ id:userId }, data:{ [key]:{ decrement: amount } } });
    return true;
  }
  const meta = metaOf(user);
  meta.resources = meta.resources || {};
  if(Number(meta.resources[key] || 0) < amount) return false;
  meta.resources[key] = Number(meta.resources[key] || 0) - amount;
  await prisma.user.update({ where:{ id:userId }, data:{ meta } });
  return true;
}

function roleOf(c={}){
  const n = norm(c.name), a = norm(c.anime);
  if(/gojo|aizen|lelouch|makima|itachi|light yagami/.test(n)) return 'Control';
  if(/ainz|rimuru|frieren|megumin|merlin|yuta|medea/.test(n)) return 'Mage';
  if(/eren|all might|reiner|guts|escanor|edward newgate/.test(n)) return 'Tank';
  if(/sakura|orihime|tsunade|chopper|rem/.test(n)) return 'Support';
  if(/levi|zoro|killua|sasuke/.test(n)) return 'Assassin';
  if(/luffy|naruto|ichigo|goku|saber|tanjiro|sukuna|natsu/.test(n)) return 'DPS';
  if(/jojo|bleach|naruto|one piece|jujutsu|dragon ball|demon slayer/.test(a)) return 'DPS';
  return 'DPS';
}
function elementOf(c={}){
  const n = norm(c.name), a = norm(c.anime);
  if(/^corrupted/.test(n)) return 'Void';
  if(/ainz|sukuna|madara|makima|alucard/.test(n)) return 'Dark';
  if(/gojo|saber|all might|naruto/.test(n)) return 'Light';
  if(/itachi|sasuke|levi|lelouch|aizen/.test(n)) return 'Shadow';
  if(/eren|guts|kenpachi/.test(n)) return 'Blood';
  if(/ace|natsu|rengoku/.test(n)) return 'Flame';
  if(/todoroki|rukia/.test(n)) return 'Ice';
  if(/one piece/.test(a)) return 'Will';
  if(/jujutsu/.test(a)) return 'Cursed';
  return 'Neutral';
}
// passiveOf returns { name, text, fx } where fx drives real combat
function passiveOf(c={}){
  const n = norm(c.name), a = norm(c.anime);
  const exact = [
    ['corrupted satoru gojo','Hollow Infinity','Starts with a Void barrier. Dodge triggers burst counter damage.'],
    ['corrupted sousuke aizen','Shattered Kyoka','Enemies lose accuracy and control resistance every turn.'],
    ['corrupted ainz','Eclipse of Nazarick','Dark magic drains DEF and executes weakened targets.'],
    ['corrupted itachi','Black Moon Tsukuyomi','Blinds enemies and amplifies damage against controlled targets.'],
    ['corrupted rimuru','Void Predator','Absorbs enemy strength and converts it into healing and skill damage.'],
    ['corrupted makima','Absolute Control','Suppresses the strongest enemy and boosts ally damage.'],
    ['corrupted lelouch','Dominion Geass','Commands enemy tempo, delaying attacks and increasing team control.'],
    ['corrupted eren','Founding Cataclysm','Gains rage each wave, increasing HP and damage.'],
    ['corrupted saber','Abyss Excalibur','Charges a Void holy strike that pierces shields.'],
    ['corrupted all might','Dark Plus Ultra','Protects allies and detonates stored damage.'],
    ['satoru gojo','Infinity','Blocks the first heavy hit and converts dodge into counter damage.'],
    ['sousuke aizen','Kyoka Suigetsu','Illusions lower enemy accuracy and strengthen control effects.'],
    ['ainz ooal gown','The Goal of All Life','Dark spells gain boss damage, penetration, and execute pressure.'],
    ['itachi uchiha','Tsukuyomi','Genjutsu increases blind chance and finisher damage.'],
    ['rimuru tempest','Predator','Adapts after each room, gaining lifesteal and skill damage.'],
    ['makima','Control Devil','Weakens the highest-power enemy and empowers the team.'],
    ['lelouch lamperouge','Geass Command','Chance to stun and reduce enemy damage for the next turn.'],
    ['eren yeager','Titan Rage','Gains DEF and ATK when HP drops.'],
    ['saber','Excalibur','Holy burst damage with a defensive barrier.'],
    ['all might','Plus Ultra','Converts DEF into smash damage and shields allies.'],
    ['monkey d luffy','Gear Will','Builds momentum every turn, increasing ATK and speed.'],
    ['naruto uzumaki','Nine-Tails Drive','Regenerates energy and boosts team pressure.'],
    ['ichigo kurosaki','Bankai Surge','High burst damage against weakened enemies.'],
    ['goku','Saiyan Limit Break','Power rises after every wave survived.'],
    ['roronoa zoro','Three-Sword Focus','Critical hits shred enemy DEF.'],
    ['levi','Humanity’s Strongest','High dodge and execute damage against elite enemies.'],
    ['tanjiro','Hinokami Kagura','Flame combo damage ramps during long fights.'],
    ['sukuna','Malevolent Shrine','Cursed area damage and execute pressure.'],
    ['madara','Wake Up To Reality','AoE pressure and high DEF scaling.'],
    ['killua','Godspeed','Speed and dodge increase after every strike.'],
    ['light yagami','Death Note','Control effects become stronger against low-HP targets.'],
    // ── More unique passives ───────────────────────────────────────────────
    ['yuta okkotsu','Rika Manifestation','Rika amplifies every attack and heals based on damage dealt.'],
    ['toji fushiguro','Heavenly Restriction','Zero cursed energy grants supreme physical dominance.'],
    ['kenjaku','Cursed Architect','Steals passive effects from enemies and amplifies team control.'],
    ['geto suguru','Maximum Uzumaki','Absorbs cursed spirits to increase ATK each turn.'],
    ['nanami kento','Ratio Technique','Guaranteed weakness hit every 7th strike.'],
    ['yhwach','Almighty','Predicts and negates the first enemy attack each fight.'],
    ['kisuke urahara','Benihime','Seals enemy passives and converts DEF into explosive damage.'],
    ['ulquiorra cifer','Murcielago','Second form activates below 40% HP — full reset and lifesteal.'],
    ['byakuya kuchiki','Senbonzakura','Petal scatter lands crit hits and shreds enemy defense.'],
    ['kenpachi zaraki','Blood Frenzy','The more damage taken, the stronger attacks become.'],
    ['pain','Six Paths','Repels first hit of each fight and drains enemy energy.'],
    ['kakashi hatake','Sharingan Copy','Copies the strongest enemy passive for one room.'],
    ['minato namikaze','Flying Thunder God','Teleport dodge and guaranteed first-strike bonus.'],
    ['obito uchiha','Kamui','Phases through two attacks and counters with Void damage.'],
    ['kaguya otsutsuki','Ash Killing Bones','Ignores all defenses and deals pure true damage.'],
    ['shanks','Conqueror Haki','Paralyzes weaker enemies and boosts team ATK.'],
    ['kaido','Dragon Form','Dragon scale armor reduces all damage by 20%.'],
    ['whitebeard','Gura Gura','Seismic shockwave lowers enemy DEF and stuns.'],
    ['blackbeard','Yami Yami','Nullifies one enemy passive per fight.'],
    ['boa hancock','Mero Mero','Petrifies an enemy — they deal 0 damage for 2 turns.'],
    ['trafalgar law','Room','Swaps HP values with the strongest enemy at battle start.'],
    ['dracule mihawk','Black Blade','Cuts through shields and deals 30% bonus damage to bosses.'],
    ['frieza','Golden Form','Regenerates 10% HP per turn and shreds enemy DEF.'],
    ['beerus','God of Destruction','30% chance to instantly delete an enemy.'],
    ['gohan','Hidden Power','Power doubles when an ally falls.'],
    ['zeke yeager','Beast Titan','Converts DEF into throw damage. Screams reduce enemy ATK.'],
    ['mikasa ackerman','Ackerman Instinct','Activates at 25% HP — full counter and damage immunity.'],
    ['muzan kibutsuji','Progenitor Blood','Regenerates 15% HP per turn and immunizes to status effects.'],
    ['rengoku kyoujurou','Flame Pillar','Shields weakest ally and amplifies team crit.'],
    ['kyojuro rengoku','Flame Pillar','Shields weakest ally and amplifies team crit.'],
    ['rengoku','Flame Pillar','Shields weakest ally and amplifies team crit.'],
    ['gyomei himejima','Stone Pillar','Reduces all enemy ATK by 20% and absorbs damage for team.'],
    ['kokushibo','Moon Breathing','Moon slash ignores dodge and always crits.'],
    ['all for one','Ability Theft','Steals the highest ATK passive from the enemy team.'],
    ['izuku midoriya','One For All Surge','Power builds each turn. 100% OFA deals execute damage.'],
    ['tomura shigaraki','Decay Wave','Disintegrates enemy DEF and poisons all enemies.'],
    ['endeavor','Prominence Burn','Burning aura increases crit and applies DoT.'],
    ['katsuki bakugou','Howitzer Impact','Explosion crits always trigger and penetrate armor.'],
    ['meruem','Nen Absorption','Absorbs enemy abilities to grow stronger each room.'],
    ['hisoka morow','Bungee Gum','Redirects one enemy attack back at them each fight.'],
    ['gon freecss','Nen Awakening','Trades 50% max HP to triple ATK for 3 turns.'],
    ['neferpitou','Doctor Blythe','Heals the lowest HP ally each turn.'],
    ['chrollo lucilfer','Skill Hunter','Seals one random enemy passive per fight.'],
    ['father','Homunculus Core','Absorbs the first lethal hit and converts to bonus ATK.'],
    ['edward elric','Alchemic Instinct','Transmutes DEF into ATK when shields break.'],
    ['roy mustang','Flame Alchemy','Fire ignition boosts crit and applies burn DoT.'],
    ['suzaku kururugi','Lancelot Reflex','Counterattack triggers on every dodge.'],
    ['l','Deductive Mastery','Reads enemy patterns — first 3 hits always crit.'],
    ['albedo','Mate of Ainz','Shields Ainz and raises DEF of all allies.'],
    ['shalltear bloodfallen','Blood Pool','Lifesteal on every hit. Full HP reset once per fight.'],
    ['roswaal','Court Magician','Elemental mastery boosts skill damage by element advantage.'],
    ['guts','Berserker Armor','Ignores death once per fight. Triples ATK below 20% HP.'],
    ['griffith','Femto Wings','Dodges all physical attacks for 1 turn.'],
    ['dio brando','The World','Time stop — skips enemy turn once per fight.'],
    ['jotaro kujo','Star Platinum','Counter deals 2x damage and stuns.'],
    ['giorno giovanna','Gold Experience Requiem','Nullifies the first enemy action in each fight.'],
    ['kira yoshikage','Killer Queen','If defeated, the killer takes 30% HP damage.'],
    ['alucard','Schrodinger','Respawns at 50% HP once per fight. Cannot die permanently.'],
    ['saitama','Limitless','First hit always deals maximum damage. Cannot die from one hit.'],
    ['tatsumaki','Psychic Barrier','Barrier absorbs all damage until broken. Then ATK surges.'],
    ['garou','Human Monster','Adapts to hits — each hit received reduces future damage by 5%.'],
    ['boros','Meteoric Burst','First hit deals 3x damage. Regenerates after defeat once.'],
    ['denji','Chainsaw Frenzy','Regenerates from blood — heals on every crit hit.'],
    ['power','Blood Manipulation','Sacrifices HP to massively boost one attack.'],
    ['zeref dragneel','Black Magic','Death magic executes targets below 25% HP instantly.'],
    ['acnologia','Dragon King','Dragon slayer magic immunity and massive boss damage.'],
    ['natsu dragneel','Dragonfire','Flame empowerment builds each turn. Dragon Force at max.'],
    ['erza scarlet','Requip','Changes armor each turn to counter the enemy element.'],
    ['meliodas','Full Counter','Reflects all magic damage back at attackers.'],
    ['escanor','The One','Absolute power for 1 turn — ATK reaches maximum.'],
    ['zeldris','Ominous Nebula','Drains ATK and absorbs enemy actions for 2 turns.'],
    ['milim nava','Dragonoid','Limitless destruction — ignores all damage caps.'],
    ['guy crimson','Blood Oath','Seals the most dangerous enemy ability for the fight.'],
    ['thorfinn','True Warrior','Pure technique — crits never miss without weapons.'],
    ['askeladd','Norse Cunning','Tricks the enemy into missing 20% of attacks.'],
    ['shigeo kageyama','100 Percent','Awakens at full emotion — resets battle with 3x all stats.'],
    ['younger toguro','100% Power','Grows stronger as HP drops — peak power at 20% HP.'],
    ['gintoki sakata','White Yaksha','Sword of the Joui war — ignores all enemy buffs.'],
    ['yusuke urameshi','Spirit Gun','Spirit energy crit always triggers on the 4th hit.'],
  ];
  // Exact passive fx (combat multipliers used in combat())
  const exactFx = {
    'corrupted satoru gojo': { dmg:0.55, dodge:0.40, counter:0.30, defPen:0.20, missFx:0.35 },
    'corrupted sousuke aizen': { dmg:0.50, missFx:0.40, control:0.30, defPen:0.18 },
    'corrupted ainz': { dmg:0.52, execute:0.25, defPen:0.22, silence:0.28 },
    'corrupted itachi': { dmg:0.50, control:0.35, missFx:0.30, execute:0.20 },
    'corrupted rimuru': { dmg:0.55, lifesteal:0.28, defPen:0.22, teamDmg:0.18 },
    'corrupted makima': { dmg:0.50, control:0.32, teamDmg:0.20, silence:0.25 },
    'corrupted lelouch': { dmg:0.45, control:0.38, delay:0.30, teamDmg:0.18 },
    'corrupted eren': { dmg:0.52, defMult:0.30, teamDmg:0.18, heal:0.15 },
    'corrupted saber': { dmg:0.58, execute:0.28, defPen:0.25, crit:0.30 },
    'corrupted all might': { dmg:0.52, defMult:0.28, teamDmg:0.20, shield:0.25 },
    'satoru gojo': { dmg:0.28, dodge:0.25, counter:0.15, defPen:0.10 },
    'sousuke aizen': { dmg:0.25, missFx:0.22, control:0.18, defPen:0.10 },
    'ainz ooal gown': { dmg:0.25, execute:0.14, defPen:0.12, silence:0.15 },
    'itachi uchiha': { dmg:0.22, control:0.20, missFx:0.16, execute:0.12 },
    'rimuru tempest': { dmg:0.28, lifesteal:0.16, defPen:0.12, teamDmg:0.10 },
    'makima': { dmg:0.22, control:0.18, teamDmg:0.12, silence:0.14 },
    'lelouch lamperouge': { dmg:0.20, control:0.22, delay:0.15, teamDmg:0.10 },
    'eren yeager': { dmg:0.22, defMult:0.18, teamDmg:0.10, heal:0.08 },
    'saber': { dmg:0.28, execute:0.14, defPen:0.12, crit:0.18 },
    'all might': { dmg:0.24, defMult:0.16, teamDmg:0.12, shield:0.15 },
    'monkey d luffy': { dmg:0.22, teamDmg:0.14, crit:0.12, speed:0.10 },
    'naruto uzumaki': { dmg:0.20, heal:0.10, teamDmg:0.12, energy:0.10 },
    'ichigo kurosaki': { dmg:0.26, execute:0.12, defPen:0.10, crit:0.14 },
    'goku': { dmg:0.28, crit:0.14, energy:0.12, teamDmg:0.10 },
    'roronoa zoro': { dmg:0.26, crit:0.20, defPen:0.12, execute:0.10 },
    'levi': { dmg:0.24, dodge:0.18, execute:0.14, crit:0.16 },
    'tanjiro': { dmg:0.22, crit:0.12, energy:0.10, teamDmg:0.08 },
    'sukuna': { dmg:0.30, execute:0.16, defPen:0.14, crit:0.12 },
    'madara': { dmg:0.28, defMult:0.14, teamDmg:0.12, silence:0.10 },
    'killua': { dmg:0.22, dodge:0.18, crit:0.16, speed:0.14 },
    'light yagami': { dmg:0.20, control:0.22, execute:0.16, silence:0.14 },
    'yuta okkotsu':     { dmg:0.24, heal:0.12, teamDmg:0.14 },
    'toji fushiguro':   { dmg:0.30, dodge:0.20, crit:0.16, speed:0.14 },
    'kenjaku':          { dmg:0.22, control:0.18, silence:0.16, teamDmg:0.12 },
    'geto suguru':      { dmg:0.20, teamDmg:0.14, energy:0.10 },
    'nanami kento':     { dmg:0.26, defPen:0.14, crit:0.12 },
    'yhwach':           { dmg:0.30, missFx:0.20, defPen:0.16, execute:0.14 },
    'kisuke urahara':   { dmg:0.24, defPen:0.16, silence:0.12, control:0.10 },
    'ulquiorra cifer':  { dmg:0.28, lifesteal:0.20, execute:0.14, heal:0.15 },
    'byakuya kuchiki':  { dmg:0.24, crit:0.18, defPen:0.14 },
    'kenpachi zaraki':  { dmg:0.32, crit:0.16, execute:0.12 },
    'pain':             { dmg:0.26, missFx:0.16, energyDrain:0.15 },
    'kakashi hatake':   { dmg:0.22, dodge:0.14, crit:0.12, teamDmg:0.10 },
    'minato namikaze':  { dmg:0.24, dodge:0.22, speed:0.18 },
    'obito uchiha':     { dmg:0.26, dodge:0.20, defPen:0.14 },
    'kaguya otsutsuki': { dmg:0.35, defPen:0.30, execute:0.20 },
    'shanks':           { dmg:0.28, teamDmg:0.18, control:0.14 },
    'kaido':            { dmg:0.30, defMult:0.22, heal:0.10 },
    'whitebeard':       { dmg:0.28, defPen:0.18, control:0.14 },
    'blackbeard':       { dmg:0.26, silence:0.20, defPen:0.16 },
    'boa hancock':      { dmg:0.22, control:0.24, silence:0.18 },
    'trafalgar law':    { dmg:0.24, control:0.20, defPen:0.14 },
    'dracule mihawk':   { dmg:0.30, defPen:0.22, bossDmg:0.20 },
    'frieza':           { dmg:0.28, heal:0.14, defPen:0.14 },
    'beerus':           { dmg:0.32, execute:0.28, control:0.16 },
    'gohan':            { dmg:0.30, teamDmg:0.16, crit:0.14 },
    'zeke yeager':      { dmg:0.24, defPen:0.16, control:0.14 },
    'mikasa ackerman':  { dmg:0.26, counter:0.20, dodge:0.14 },
    'muzan kibutsuji':  { dmg:0.28, heal:0.18, defMult:0.14 },
    'rengoku kyoujurou':{ dmg:0.24, crit:0.14, teamDmg:0.12, shield:0.10 },
    'gyomei himejima':  { dmg:0.22, defMult:0.22, shield:0.18 },
    'kokushibo':        { dmg:0.30, crit:0.20, dodge:0.12 },
    'all for one':      { dmg:0.32, silence:0.22, teamDmg:0.18 },
    'izuku midoriya':   { dmg:0.26, teamDmg:0.14, energy:0.12 },
    'tomura shigaraki': { dmg:0.28, defPen:0.22, poison:0.16 },
    'endeavor':         { dmg:0.26, crit:0.16, burn:0.14 },
    'katsuki bakugou':  { dmg:0.28, crit:0.18, defPen:0.14 },
    'meruem':           { dmg:0.34, execute:0.22, defPen:0.18 },
    'hisoka morow':     { dmg:0.28, counter:0.22, crit:0.16 },
    'gon freecss':      { dmg:0.30, crit:0.14, energy:0.12 },
    'neferpitou':       { dmg:0.22, heal:0.18, teamDmg:0.12 },
    'chrollo lucilfer': { dmg:0.26, silence:0.20, control:0.16 },
    'father':           { dmg:0.30, defPen:0.18, execute:0.16 },
    'edward elric':     { dmg:0.24, defPen:0.14, crit:0.12 },
    'roy mustang':      { dmg:0.26, crit:0.16, burn:0.14 },
    'suzaku kururugi':  { dmg:0.24, counter:0.18, dodge:0.14 },
    'l':                { dmg:0.20, crit:0.20, control:0.14 },
    'albedo':           { dmg:0.18, defMult:0.22, shield:0.18 },
    'shalltear bloodfallen':{ dmg:0.28, lifesteal:0.22, heal:0.16 },
    'roswaal':          { dmg:0.28, defPen:0.14, teamDmg:0.12 },
    'guts':             { dmg:0.32, execute:0.20, crit:0.16 },
    'griffith':         { dmg:0.28, dodge:0.24, teamDmg:0.14 },
    'dio brando':       { dmg:0.30, control:0.22, silence:0.16 },
    'jotaro kujo':      { dmg:0.28, counter:0.22, crit:0.14 },
    'giorno giovanna':  { dmg:0.30, control:0.20, silence:0.16 },
    'kira yoshikage':   { dmg:0.26, execute:0.18, silence:0.14 },
    'alucard':          { dmg:0.30, lifesteal:0.24, heal:0.16 },
    'saitama':          { dmg:0.40, execute:0.35, defPen:0.30 },
    'tatsumaki':        { dmg:0.26, shield:0.22, defMult:0.18 },
    'garou':            { dmg:0.28, defMult:0.16, counter:0.14 },
    'boros':            { dmg:0.34, heal:0.14, execute:0.16 },
    'denji':            { dmg:0.26, lifesteal:0.18, crit:0.14 },
    'zeref dragneel':   { dmg:0.30, execute:0.22, defPen:0.16 },
    'acnologia':        { dmg:0.34, defPen:0.24, bossDmg:0.20 },
    'natsu dragneel':   { dmg:0.24, crit:0.14, teamDmg:0.12 },
    'erza scarlet':     { dmg:0.24, defMult:0.14, crit:0.12 },
    'meliodas':         { dmg:0.30, counter:0.28, defPen:0.14 },
    'escanor':          { dmg:0.38, crit:0.24, execute:0.18 },
    'zeldris':          { dmg:0.28, control:0.20, energyDrain:0.16 },
    'milim nava':       { dmg:0.36, defPen:0.24, execute:0.18 },
    'guy crimson':      { dmg:0.28, silence:0.20, control:0.14 },
    'thorfinn':         { dmg:0.26, crit:0.20, dodge:0.16 },
    'askeladd':         { dmg:0.22, missFx:0.18, dodge:0.14 },
    'shigeo kageyama':  { dmg:0.32, teamDmg:0.20, defPen:0.16 },
    'younger toguro':   { dmg:0.34, execute:0.20, defPen:0.16 },
    'gintoki sakata':   { dmg:0.24, silence:0.16, crit:0.14 },
    'yusuke urameshi':  { dmg:0.26, crit:0.18, energy:0.12 },
  };
  // Also check exact array for Demon Slayer name variations
  const extraExact = [
    ['kyojuro rengoku','Flame Pillar','Shields weakest ally and amplifies team crit.'],
    ['tanjiro kamado','Hinokami Kagura','Flame combo ramps. Sun Breathing bonus boss damage.'],
    ['zenitsu agatsuma','Thunderclap Flash','Lightning speed — first strike always crits and stuns.'],
    ['inosuke hashibira','Beast Breathing','Dual blade frenzy increases speed and combo damage.'],
    ['giyu tomioka','Water Breathing','Calm style — redirects attacks and increases dodge.'],
    ['shinobu kocho','Insect Breathing','Poison stacks on every hit — deadly over time.'],
    ['kanao tsuyuri','Flower Breathing','Future sight — dodges 30% of attacks.'],
    ['muichiro tokito','Mist Breathing','Invisible strikes — ignores enemy dodge.'],
    ['sanemi shinazugawa','Wind Breathing','Raging wind increases ATK and reduces enemy speed.'],
    ['mitsuri kanroji','Love Breathing','Flexible blade — ignores enemy shields.'],
    ['uzui tengen','Sound Breathing','Explosive rhythm — AoE damage every 3rd turn.'],
    ['yoriichi tsugikuni','Sun Breathing','Original breathing form — all attacks deal true damage.'],
    // Common MAL name order variations
    ['roronoa zoro','Three-Sword Focus','Critical hits shred DEF. Asura form triggers below 30% HP.'],
    ['monkey d luffy','Gear Fifth','Joy Boy power — rubber reality bending increases with each hit.'],
    ['uzumaki naruto','Nine-Tails Drive','Kurama energy heals and boosts team damage each turn.'],
    ['uchiha sasuke','Rinnegan','Absorbs one attack per fight and counters with AoE damage.'],
    ['uchiha madara','Infinite Tsukuyomi','AoE darkness and massive DEF scaling.'],
    ['uchiha itachi','Tsukuyomi','Genjutsu blinds and amplifies finisher damage.'],
    ['uchiha obito','Kamui','Phases through two attacks and counters with Void damage.'],
    ['namikaze minato','Flying Thunder God','Teleport dodge and guaranteed first-strike bonus.'],
    ['kurosaki ichigo','Bankai Surge','Hollowification burst triples damage against weakened enemies.'],
    ['yeager eren','Titan Rage','Gains DEF and ATK as HP drops.'],
    ['ackerman levi','Humanity\'s Strongest','Triple dodge against elites. Execute on low HP.'],
  ];
  // extraExact is now handled by matchPassive above
  // Smart matching — tries all word combinations
  function matchPassive(nameStr, list){
    const words = nameStr.split(' ').filter(w => w.length > 1);
    for(const [key,pname,ptext] of list){
      // Direct include
      if(nameStr.includes(key)) return { name:pname, text:ptext, fx: exactFx[key] || {} };
      // All key words in name
      const kwords = key.split(' ');
      if(kwords.length >= 2 && kwords.every(w => nameStr.includes(w)))
        return { name:pname, text:ptext, fx: exactFx[key] || {} };
      // Reversed order (family name first)
      const reversed = words.slice().reverse().join(' ');
      if(reversed.includes(key)) return { name:pname, text:ptext, fx: exactFx[key] || {} };
    }
    return null;
  }
  const exactMatch = matchPassive(n, exact);
  if(exactMatch) return exactMatch;
  const extraMatch = matchPassive(n, extraExact);
  if(extraMatch) return extraMatch;
  // ── INTELLIGENT PASSIVE SYSTEM ─────────────────────────────────────────────
  // Covers all 28,000 characters with unique-feeling passives
  // Priority: name keywords → anime → role → rarity scaling

  const rVal = { COMMON:1, RARE:1.05, EPIC:1.10, LEGENDARY:1.16, MYTHIC:1.24, DIVINE:1.34, SECRET:1.55 };
  const rm = rVal[String(c.rarity||'COMMON').toUpperCase()] || 1;
  const sc = v => Math.round(v * rm * 10) / 10;

  // ── Name keyword passives ────────────────────────────────────────────────
  const nameKeywords = [
    // Elements / powers
    [['fire','flame','blaze','inferno','pyro','ignis','kagutsuchi','agni'],
     'Blazing Soul', 'Flame energy amplifies crit and applies burn on hit.',
     { dmg:sc(0.12), crit:sc(0.10), burn:sc(0.08) }],
    [['ice','frost','cryo','glacier','freeze','blizzard','tundra','kori'],
     'Frozen Domain', 'Ice aura reduces enemy speed and freezes on crit.',
     { dmg:sc(0.10), control:sc(0.12), speed:sc(0.08) }],
    [['thunder','lightning','bolt','electro','raiden','volt','kaminari'],
     'Lightning Strike', 'Electric charge grants first-strike advantage and stuns.',
     { dmg:sc(0.14), crit:sc(0.08), speed:sc(0.10) }],
    [['wind','air','storm','gale','tempest','fujin','kaze'],
     'Gale Force', 'Wind speed increases dodge and attack frequency.',
     { dmg:sc(0.10), dodge:sc(0.14), speed:sc(0.12) }],
    [['dark','shadow','void','abyss','black','noir','kage','yami'],
     'Shadow Veil', 'Darkness amplifies execute damage and reduces enemy accuracy.',
     { dmg:sc(0.12), execute:sc(0.12), missFx:sc(0.10) }],
    [['light','holy','divine','sacred','angel','seraph','hikari'],
     'Sacred Light', 'Holy power heals allies and amplifies team damage.',
     { dmg:sc(0.10), heal:sc(0.10), teamDmg:sc(0.08) }],
    [['blood','crimson','scarlet','red','chi','aka'],
     'Blood Frenzy', 'Blood power grants lifesteal and increases ATK when wounded.',
     { dmg:sc(0.12), lifesteal:sc(0.14), crit:sc(0.08) }],
    [['poison','toxic','venom','plague','blight','doku'],
     'Toxic Essence', 'Poison stacks on every hit and increases damage over time.',
     { dmg:sc(0.10), poison:sc(0.16), defPen:sc(0.08) }],
    [['earth','stone','rock','terra','geo','tsuchi'],
     'Earth Armor', 'Stone body reduces incoming damage and counters on block.',
     { dmg:sc(0.08), defMult:sc(0.18), counter:sc(0.10) }],
    [['water','ocean','sea','wave','aqua','mizu'],
     'Tidal Flow', 'Water energy heals and cleanses debuffs each turn.',
     { dmg:sc(0.08), heal:sc(0.12), defMult:sc(0.10) }],
    [['dragon','ryuu','wyvern','drake','drakon'],
     'Dragon Force', 'Dragon power overwhelms enemies with raw destructive might.',
     { dmg:sc(0.16), crit:sc(0.10), defPen:sc(0.10) }],
    [['demon','devil','oni','fiend','rakshasa','mazoku'],
     'Demonic Surge', 'Demonic energy grows stronger with each enemy defeated.',
     { dmg:sc(0.14), execute:sc(0.10), lifesteal:sc(0.08) }],
    [['god','deity','divine','kami','celestial'],
     'Divine Authority', 'Godly presence reduces all enemy stats and amplifies team.',
     { dmg:sc(0.12), teamDmg:sc(0.12), defPen:sc(0.12) }],
    [['death','reaper','soul','grim','shinigami','shi'],
     'Death Mark', 'Marks the weakest enemy — they receive 30% more damage.',
     { dmg:sc(0.12), execute:sc(0.16), control:sc(0.08) }],
    [['wolf','beast','feral','wild','lycan','ookami'],
     'Wild Instinct', 'Beast instinct increases speed and critical rate.',
     { dmg:sc(0.12), crit:sc(0.14), speed:sc(0.10) }],
    [['spirit','ghost','phantom','specter','wraith','yuurei'],
     'Spirit Form', 'Ethereal body grants dodge chance and blocks debuffs.',
     { dmg:sc(0.10), dodge:sc(0.14), defMult:sc(0.08) }],
    [['sword','blade','katana','saber','ken','tachi'],
     'Blade Mastery', 'Perfect blade technique ensures critical hits pierce armor.',
     { dmg:sc(0.14), crit:sc(0.12), defPen:sc(0.10) }],
    [['magic','mage','wizard','witch','sorcerer','arcane','mahou'],
     'Arcane Mastery', 'Magical power amplifies skill damage and energy gain.',
     { dmg:sc(0.14), defPen:sc(0.08), energy:sc(0.10) }],
    [['hero','knight','paladin','guardian','yuusha'],
     'Heroic Spirit', 'Protects allies and increases team combat effectiveness.',
     { dmg:sc(0.10), shield:sc(0.12), teamDmg:sc(0.10) }],
    [['king','queen','emperor','lord','overlord','majesty','ruler'],
     'Royal Command', 'Authority over the battlefield boosts team and weakens enemies.',
     { dmg:sc(0.12), teamDmg:sc(0.12), control:sc(0.10) }],
    [['ninja','shinobi','kunoichi','ninjutsu'],
     'Ninja Arts', 'Stealth techniques maximize critical damage and evasion.',
     { dmg:sc(0.12), dodge:sc(0.14), crit:sc(0.10) }],
    [['samurai','ronin','bushido','bushi'],
     'Bushido', 'Samurai code increases finisher damage and honor counter.',
     { dmg:sc(0.14), crit:sc(0.10), counter:sc(0.12) }],
    [['angel','seraph','cherub','archangel','tenshi'],
     'Celestial Grace', 'Divine wings grant dodge and amplify holy attacks.',
     { dmg:sc(0.12), dodge:sc(0.10), heal:sc(0.10) }],
    [['vampire','undead','lich','zombie','nosferatu'],
     'Undying Hunger', 'Life drain on every hit and resistance to death.',
     { dmg:sc(0.10), lifesteal:sc(0.16), heal:sc(0.08) }],
    [['titan','giant','colossus','behemoth','golem'],
     'Titan Strength', 'Massive power crushes enemy defenses.',
     { dmg:sc(0.16), defPen:sc(0.14), defMult:sc(0.10) }],
    [['psychic','esper','telepath','psi','mental'],
     'Psychic Force', 'Mental power bends reality — enemies miss more often.',
     { dmg:sc(0.12), missFx:sc(0.14), control:sc(0.10) }],
    [['poison','acid','corrosive','toxic'],
     'Corrosive Touch', 'Acid burns through armor and poisons over time.',
     { dmg:sc(0.10), defPen:sc(0.14), poison:sc(0.12) }],
    [['time','chrono','temporal','clock'],
     'Time Manipulation', 'Temporal mastery slows enemies and accelerates allies.',
     { dmg:sc(0.10), speed:sc(0.14), control:sc(0.12) }],
    [['space','gravity','cosmos','void','dimensional'],
     'Spatial Control', 'Gravitational mastery crushes enemies and warps attacks.',
     { dmg:sc(0.12), defPen:sc(0.12), missFx:sc(0.10) }],
    [['heal','cure','medic','doctor','nurse','chiryo'],
     'Healing Touch', 'Restorative power heals the team and cleanses each turn.',
     { dmg:sc(0.04), heal:sc(0.20), defMult:sc(0.10) }],
    [['spy','assassin','agent','rogue','thief','dorobou'],
     'Shadow Strike', 'Perfect execution from stealth — first hit always crits.',
     { dmg:sc(0.14), dodge:sc(0.12), execute:sc(0.10) }],
    [['soldier','warrior','fighter','gladiator','senshi'],
     'Battle Hardened', 'Combat experience increases damage output every turn.',
     { dmg:sc(0.12), crit:sc(0.08), defMult:sc(0.08) }],
    [['princess','prince','noble','royalty','hime'],
     'Noble Presence', 'Royal aura boosts all team stats and inspires allies.',
     { dmg:sc(0.08), teamDmg:sc(0.14), heal:sc(0.08) }],
    [['robot','mech','android','cyborg','machine','automaton'],
     'System Override', 'Mechanical precision maximizes crit and ignores pain.',
     { dmg:sc(0.12), crit:sc(0.14), defMult:sc(0.08) }],
    [['akatsuki','organization','guild','clan','secret'],
     'Hidden Agenda', 'Covert power activates mid-battle for a decisive strike.',
     { dmg:sc(0.14), execute:sc(0.10), silence:sc(0.08) }],
  ];

  for(const [keys, pname, ptext, pfx] of nameKeywords){
    if(keys.some(k => n.includes(k))){
      return { name:pname, text:ptext, fx:pfx };
    }
  }

  // ── Anime-based passives ─────────────────────────────────────────────────
  const animePassives = [
    ['jujutsu kaisen',  'Cursed Technique',     'Cursed energy boosts skill damage and control resistance.',       { dmg:sc(0.10), control:sc(0.08), defPen:sc(0.06) }],
    ['naruto',          'Shinobi Instinct',      'Ninja training maximizes speed, dodge, and strike precision.',    { dmg:sc(0.09), dodge:sc(0.10), speed:sc(0.08) }],
    ['one piece',       'Pirate Will',           'Pirate spirit builds momentum and treasure-hunting instincts.',   { dmg:sc(0.10), teamDmg:sc(0.06), crit:sc(0.06) }],
    ['bleach',          'Spiritual Pressure',    'Reiatsu crushes weaker enemies and strengthens burst attacks.',   { dmg:sc(0.10), defPen:sc(0.08), execute:sc(0.06) }],
    ['dragon ball',     'Saiyan Will',           'Saiyan power grows stronger after every battle survived.',        { dmg:sc(0.12), crit:sc(0.08), energy:sc(0.08) }],
    ['demon slayer',    'Breathing Form',        'Total Concentration Breathing amplifies crit and speed.',         { dmg:sc(0.08), crit:sc(0.12), speed:sc(0.08) }],
    ['attack on titan', 'Survey Corps',          'Desperate resolve — DEF and ATK surge when allies fall.',        { dmg:sc(0.08), defMult:sc(0.12), teamDmg:sc(0.08) }],
    ['my hero academia','Quirk Awakening',       'Quirk reaches full power mid-battle for a decisive surge.',       { dmg:sc(0.10), crit:sc(0.08), teamDmg:sc(0.08) }],
    ['hunter x hunter','Nen Mastery',            'Nen aura amplifies every stat and counters enemy abilities.',     { dmg:sc(0.10), defPen:sc(0.08), energy:sc(0.10) }],
    ['fullmetal alchemist','Alchemy',            'Transmutation converts DEF into ATK and pierces armor.',          { dmg:sc(0.10), defPen:sc(0.10), crit:sc(0.08) }],
    ['fairy tail',      'Guild Bond',            'Nakama power amplifies team damage and provides sustain.',        { dmg:sc(0.10), teamDmg:sc(0.10), heal:sc(0.06) }],
    ['black clover',    'Anti-Magic',            'Nullifies enemy magic and converts it to raw power.',             { dmg:sc(0.12), defPen:sc(0.10), silence:sc(0.08) }],
    ['sword art online','Cardinal System',       'Game mastery grants crit precision and skill speed bonuses.',     { dmg:sc(0.10), crit:sc(0.10), speed:sc(0.08) }],
    ['overlord',        'Floor Guardian',        'Nazarick loyalty grants DEF bonuses and execute pressure.',       { dmg:sc(0.10), defMult:sc(0.10), execute:sc(0.08) }],
    ['re:zero',         'Return by Death',       'Cannot be truly defeated — restores 20% HP when near death.',    { dmg:sc(0.08), heal:sc(0.14), defMult:sc(0.08) }],
    ['seven deadly sins','Sacred Treasure',      'Sacred treasure amplifies all stats and unlocks true power.',     { dmg:sc(0.12), teamDmg:sc(0.08), crit:sc(0.08) }],
    ['one punch man',   'Hero Association',      'Hero training maximizes combat efficiency and execution.',        { dmg:sc(0.12), execute:sc(0.10), crit:sc(0.08) }],
    ['mob psycho',      'Psychic Awakening',     'Suppressed power releases at 100% emotion for a massive surge.', { dmg:sc(0.14), teamDmg:sc(0.10), defPen:sc(0.08) }],
    ['code geass',      'Britannian Power',      'Strategic genius weakens enemies and amplifies team tactics.',    { dmg:sc(0.10), control:sc(0.12), teamDmg:sc(0.08) }],
    ['death note',      'Kira Judgment',         'Judgment power executes marked targets and reduces enemy morale.',{ dmg:sc(0.10), execute:sc(0.12), control:sc(0.08) }],
    ['chainsaw man',    'Devil Contract',        'Devil power fuels reckless attacks with lifesteal.',              { dmg:sc(0.14), lifesteal:sc(0.12), crit:sc(0.08) }],
    ['berserk',         'Brand of Sacrifice',    'Cursed brand grants berserker strength in dire situations.',      { dmg:sc(0.14), crit:sc(0.10), execute:sc(0.08) }],
    ['vinland saga',    'Viking Spirit',         'Norse warrior spirit increases raw damage and endurance.',        { dmg:sc(0.12), defMult:sc(0.10), crit:sc(0.08) }],
    ['made in abyss',   'Relics Power',          'Relic artifacts enhance combat abilities unpredictably.',         { dmg:sc(0.10), crit:sc(0.10), energy:sc(0.08) }],
    ['spy x family',    'Mission Protocol',      'Perfect mission execution grants stealth and burst damage.',      { dmg:sc(0.10), dodge:sc(0.10), crit:sc(0.08) }],
    ['that time i got reincarnated as a slime','Great Sage','Analytical combat AI maximizes all battle parameters.',{ dmg:sc(0.10), teamDmg:sc(0.10), defPen:sc(0.08) }],
    ['tensei shitara slime','Great Sage',        'Analytical combat AI maximizes all battle parameters.',           { dmg:sc(0.10), teamDmg:sc(0.10), defPen:sc(0.08) }],
    ['jojo',            'Stand Power',           'Stand ability grants unique combat advantages.',                   { dmg:sc(0.12), crit:sc(0.08), control:sc(0.10) }],
    ['hellsing',        'Vampire Power',         'Vampire blood grants lifesteal and regeneration.',                { dmg:sc(0.12), lifesteal:sc(0.14), heal:sc(0.08) }],
    ['fate',            'Noble Phantasm',        'Noble Phantasm releases ultimate power against enemies.',          { dmg:sc(0.14), bossDmg:sc(0.12), crit:sc(0.08) }],
    ['danmachi',        'Falna',                 'Divine blessing amplifies all combat stats progressively.',       { dmg:sc(0.10), teamDmg:sc(0.08), energy:sc(0.10) }],
    ['no game no life', 'Blank Strategy',        'Perfect game theory — predicts and counters every move.',         { dmg:sc(0.10), missFx:sc(0.12), control:sc(0.10) }],
    ['tokyo ghoul',     'Kagune',                'Kagune appendages deal bonus damage and pierce defense.',          { dmg:sc(0.12), defPen:sc(0.12), lifesteal:sc(0.06) }],
    ['parasyte',        'Parasite Bond',         'Alien parasite amplifies reaction speed and healing.',            { dmg:sc(0.10), speed:sc(0.12), heal:sc(0.08) }],
    ['assassination classroom','Mach Speed',     'Anti-sensei training maximizes speed and precision.',             { dmg:sc(0.10), speed:sc(0.14), crit:sc(0.08) }],
    ['blue exorcist',   'Exorcist Art',          'Exorcism power deals bonus damage to corrupted enemies.',         { dmg:sc(0.10), bossDmg:sc(0.10), defPen:sc(0.08) }],
    ['soul eater',      'Soul Resonance',        'Soul wavelength synergy amplifies all team abilities.',           { dmg:sc(0.08), teamDmg:sc(0.14), energy:sc(0.08) }],
    ['magi',            'Magoi',                 'Magoi flows into every attack, amplifying all abilities.',        { dmg:sc(0.10), energy:sc(0.12), teamDmg:sc(0.08) }],
    ['noragami',        'God\'s Will',           'Divine authority cuts through all mortal defenses.',              { dmg:sc(0.12), defPen:sc(0.10), crit:sc(0.08) }],
    ['haikyuu',         'Team Synergy',          'Volleyball teamwork boosts all allied performance.',              { dmg:sc(0.06), teamDmg:sc(0.18), speed:sc(0.08) }],
    ['kuroko no basket','Phantom Sixth Man',     'Invisible presence amplifies team damage unpredictably.',         { dmg:sc(0.08), teamDmg:sc(0.16), dodge:sc(0.08) }],
    ['toradora',        'Tiger\'s Roar',         'Fierce spirit surprises enemies with unexpected power.',          { dmg:sc(0.10), crit:sc(0.10), teamDmg:sc(0.08) }],
    ['steins gate',     'Reading Steiner',       'Future vision allows perfect timing of every attack.',            { dmg:sc(0.10), dodge:sc(0.10), control:sc(0.10) }],
    ['neon genesis evangelion','AT Field',       'Absolute Terror Field blocks the first heavy attack.',            { dmg:sc(0.08), shield:sc(0.16), defMult:sc(0.10) }],
    ['cowboy bebop',    'Jeet Kune Do',          'Fluid combat style adapts to every situation.',                   { dmg:sc(0.12), dodge:sc(0.12), counter:sc(0.08) }],
    ['trigun',          'Maximum',               'Humanoid Typhoon unleashes maximum force when pushed.',           { dmg:sc(0.14), execute:sc(0.10), crit:sc(0.08) }],
    ['gurren lagann',   'Spiral Power',          'Spiral energy grows infinitely — power has no limits.',           { dmg:sc(0.14), teamDmg:sc(0.10), energy:sc(0.10) }],
    ['angel beats',     'Afterlife Army',        'Fighting for a second chance — power spikes in dire moments.',    { dmg:sc(0.10), heal:sc(0.10), teamDmg:sc(0.08) }],
    ['clannad',         'Dango Family',          'Family bond provides steady healing and team support.',           { dmg:sc(0.04), heal:sc(0.16), teamDmg:sc(0.10) }],
    ['violet evergarden','Auto Memory Doll',     'Precision and dedication maximize every action taken.',           { dmg:sc(0.10), crit:sc(0.10), defMult:sc(0.08) }],
    ['your lie in april','Resonance',            'Musical resonance uplifts team morale and combat flow.',          { dmg:sc(0.06), teamDmg:sc(0.14), heal:sc(0.08) }],
    ['anohana',         'Boundless Love',        'Pure devotion heals allies and protects from debuffs.',           { dmg:sc(0.04), heal:sc(0.18), defMult:sc(0.08) }],
    ['food wars',       'Ultimate Recipe',       'Perfect technique maximizes efficiency and output.',              { dmg:sc(0.10), teamDmg:sc(0.10), crit:sc(0.08) }],
    ['black lagoon',    'Gunslinger',            'Dual pistol mastery maximizes bullet precision and crit.',        { dmg:sc(0.14), crit:sc(0.12), dodge:sc(0.08) }],
    ['gintama',         'Joui Spirit',           'Eccentric power surprises all enemies with unpredictable might.', { dmg:sc(0.12), crit:sc(0.10), control:sc(0.08) }],
    ['yu yu hakusho',   'Spirit Energy',         'Spirit energy surges in battle, amplifying all attacks.',         { dmg:sc(0.12), energy:sc(0.12), crit:sc(0.08) }],
    ['rurouni kenshin', 'Hiten Mitsurugi',       'God-speed sword technique ensures unmatched first-strike power.', { dmg:sc(0.14), speed:sc(0.12), crit:sc(0.08) }],
    ['inuyasha',        'Tessaiga',              'Powerful blade amplifies damage against demon enemies.',          { dmg:sc(0.12), bossDmg:sc(0.10), defPen:sc(0.08) }],
    ['dragon ball super','Ultra Instinct',       'Auto-dodge triggers and power grows beyond all limits.',          { dmg:sc(0.14), dodge:sc(0.12), crit:sc(0.10) }],
    ['nanatsu no taizai','Sacred Treasure',      'Sacred treasure amplifies all stats and unlocks true power.',     { dmg:sc(0.12), teamDmg:sc(0.08), crit:sc(0.08) }],
    ['ouran',           'Host Club',             'Charm and elegance boost team morale and support.',               { dmg:sc(0.04), teamDmg:sc(0.14), heal:sc(0.10) }],
    ['madoka magica',   'Magical Girl',          'Wish-granted power converts hope into overwhelming force.',       { dmg:sc(0.12), teamDmg:sc(0.08), heal:sc(0.08) }],
    ['k-on',            'Band Spirit',           'Musical harmony provides team-wide buffs and sustain.',           { dmg:sc(0.04), teamDmg:sc(0.16), heal:sc(0.08) }],
    ['sao',             'Dual Wielding',         'Twin blade technique doubles crit frequency.',                    { dmg:sc(0.12), crit:sc(0.12), speed:sc(0.08) }],
    ['danganronpa',     'Ultimate Talent',       'Ultimate talent activates to turn the tide of battle.',           { dmg:sc(0.12), execute:sc(0.10), control:sc(0.08) }],
  ];

  for(const [animeKey, pname, ptext, pfx] of animePassives){
    if(a.includes(animeKey)){
      return { name:pname, text:ptext, fx:pfx };
    }
  }

  // ── Role + Rarity based fallback ─────────────────────────────────────────
  const role = roleOf(c);
  const roleMap = {
    DPS:      ['Killing Intent',      'ATK surges after defeating an enemy — power builds each kill.',       { dmg:sc(0.10), crit:sc(0.06), execute:sc(0.05) }],
    Assassin: ['Silent Execution',    'Strike from shadows — first hit crits, dodge increases after.',      { dmg:sc(0.12), dodge:sc(0.10), execute:sc(0.08) }],
    Control:  ['Battlefield Control', 'Debuffs spread further and enemy combat effectiveness drops.',        { dmg:sc(0.06), control:sc(0.12), silence:sc(0.08) }],
    Mage:     ['Arcane Overload',     'Mana surges amplify skill damage and energy regeneration.',           { dmg:sc(0.12), defPen:sc(0.06), energy:sc(0.08) }],
    Tank:     ['Immovable',           'Shields absorb damage and DEF surges when allies are threatened.',    { dmg:sc(0.04), defMult:sc(0.15), shield:sc(0.10) }],
    Support:  ['Resonance',           'Team healing, energy, and damage bonuses flow through every action.', { dmg:sc(0.04), teamDmg:sc(0.10), heal:sc(0.10) }],
    Healer:   ['Restoration Aura',    'Steady healing and debuff cleansing every turn keep allies alive.',   { dmg:sc(0.02), heal:sc(0.15), defMult:sc(0.08) }],
    Summoner: ['Spirit Pact',         'Summoned spirits boost team pressure and deal supplemental damage.',   { dmg:sc(0.08), teamDmg:sc(0.12), defPen:sc(0.06) }],
  };
  const m = roleMap[role] || roleMap.DPS;
  return { name:m[0], text:m[1], fx: m[2] || {} };
}
function gearNames(c={}){
  const e = elementOf(c);
  const role = roleOf(c);
  return {
    weapon: `${e} ${role} Weapon`,
    armor: `${e} Guard Armor`,
    accessory: `${e} Core Ring`,
    boots: `${e} Step Boots`
  };
}
function baseStats(power, level=1, gearPower=0, skillBonus=0){
  const levelMult = 1 + (Number(level || 1)-1) * 0.045 + Number(skillBonus||0);
  const p = Math.floor((Number(power||1000) + Number(gearPower||0)) * levelMult);
  return {
    power:p,
    hp:Math.floor(p*3.2),
    atk:Math.floor(p*0.62),
    def:Math.floor(p*0.34),
    crit:clamp(5+Math.floor(level/6)+Math.floor(p/80000),5,70),
    dodge:clamp(3+Math.floor(level/9),3,45),
    shield:Math.floor(p*0.18),
    speed:clamp(90+Math.floor(level/2)+Math.floor(p/25000),90,230),
    energy:clamp(100+Math.floor(level/4),100,200)
  };
}
function skillInfo(meta, cardId){
  const t = meta.skillTrees?.[cardId] || {};
  return {
    core:Number(t.core||0), skill:Number(t.skill||0), trait:Number(t.trait||0), gear:Number(t.gear||0), ultimate:Number(t.ultimate||0)
  };
}
function skillBonus(meta, cardId){
  const s = skillInfo(meta, cardId);
  return (s.core*0.01) + (s.skill*0.012) + (s.trait*0.008) + (s.gear*0.006) + (s.ultimate*0.02);
}

async function ownedCards(userId, take=100){
  return prisma.userCard.findMany({
    where:{ userId },
    include:{ character:true, equipment:{ include:{ template:true } } },
    orderBy:{ power:'desc' },
    take
  });
}
async function attachStarterGear(userId, cardId, character){
  const names = gearNames(character);
  const items = [
    ['WEAPON', names.weapon, 'ATK', 800],
    ['ARMOR', names.armor, 'DEF', 700],
    ['RING', names.accessory, 'CRIT', 450],
    ['ARTIFACT', names.boots, 'SPD', 350]
  ];
  for(const [slot,name,bonusType,power] of items){
    let tpl = await prisma.equipmentTemplate.findFirst({ where:{ name, slot } });
    if(!tpl){
      tpl = await prisma.equipmentTemplate.create({
        data:{ id:nid('eqtpl'), name, slot, rarity:character.rarity, basePower:power, imageUrl:null, bonusType, bonusValue:power, characterHint:character.name }
      });
    }
    const exists = await prisma.userEquipment.findFirst({ where:{ cardId, templateId:tpl.id } });
    if(!exists){
      await prisma.userEquipment.create({ data:{ id:nid('eq'), userId, cardId, templateId:tpl.id, level:1, power:tpl.basePower } });
    }
  }
}
function shardValueByRarity(rarity){
  return { COMMON:1, RARE:3, EPIC:8, LEGENDARY:20, MYTHIC:45, DIVINE:100, SECRET:250 }[rarity] || 1;
}
async function grantCard(userId, character, shiny=false, keepDuplicate=false){
  const existing = await prisma.userCard.findFirst({ where:{ userId, characterId:character.id }, include:{ character:true } });
  if(existing){
    const shards = shardValueByRarity(character.rarity);
    if(keepDuplicate){
      // Keep the duplicate as a second copy
      const serial = await prisma.userCard.count({ where:{ characterId:character.id } }) + 1;
      const card = await prisma.userCard.create({
        data:{ id:nid('card'), userId, characterId:character.id, serial, level:1, xp:0, power:character.basePower, shiny },
        include:{ character:true }
      });
      return { duplicate:true, kept:true, character, shards:0, existing, card };
    }
    // Default: convert to shards
    await addResource(userId, 'cardShards', shards);
    return { duplicate:true, kept:false, character, shards, existing };
  }
  const serial = await prisma.userCard.count({ where:{ characterId:character.id } }) + 1;
  const card = await prisma.userCard.create({
    data:{ id:nid('card'), userId, characterId:character.id, serial, level:1, xp:0, power:character.basePower, shiny },
    include:{ character:true }
  });
  await attachStarterGear(userId, card.id, character);
  return card;
}
async function gearPower(card){
  const eq = card.equipment || await prisma.userEquipment.findMany({ where:{ cardId:card.id }, include:{ template:true } });
  return eq.reduce((a,e)=>a + Number(e.power||0) + Number(e.level||1)*250, 0);
}
async function recalcCard(card, userMeta=null){
  const gp = await gearPower(card);
  const bonus = userMeta ? skillBonus(userMeta, card.id) : 0;
  const stats = baseStats(card.character.basePower, card.level, gp, bonus);
  await prisma.userCard.update({ where:{ id:card.id }, data:{ power:stats.power } }).catch(()=>{});
  return stats;
}

async function findCharacter(query){
  query = String(query || '').trim();
  if(!query) return null;
  const raw = query.replace(/\b(COMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SECRET)\b/gi,'').replace(/\bPWR\b.*$/i,'').trim();
  const q = norm(raw);
  const wantsCorrupted = /\bcorrupted\b/i.test(query);
  const rarity = RARITIES.find(r => query.toUpperCase().includes(r));

  let rows = await prisma.character.findMany({ where:{ active:true, name:{ equals: raw, mode:'insensitive' } }, take:10 });
  if(!rows.length) rows = await prisma.character.findMany({ where:{ active:true, name:{ contains: raw, mode:'insensitive' } }, take:60 });
  if(!rows.length){
    const words = q.split(/\s+/).filter(w=>w.length>1).slice(0,4);
    rows = await prisma.character.findMany({ where:{ active:true, OR:words.map(w=>({ name:{ contains:w, mode:'insensitive' } })) }, take:80 });
  }
  if(!rows.length) return null;

  rows.sort((a,b)=>{
    const score = c => {
      const n = norm(c.name);
      let s = 0;
      if(n === q) s += 100000;
      if(n.includes(q)) s += 25000;
      if(q.includes(n)) s += 10000;
      for(const w of q.split(/\s+/)){ if(w && n.includes(w)) s += 1200; }
      if(wantsCorrupted && /^corrupted/i.test(c.name)) s += 30000;
      if(!wantsCorrupted && !/^corrupted/i.test(c.name)) s += 10000;
      if(rarity && c.rarity === rarity) s += 15000;
      if(rarity && rarity !== 'SECRET' && /^corrupted/i.test(c.name)) s -= 50000;
      if(q.includes('ainz') && n.includes('ainz')) s += 50000;
      if(q.includes('zero two') && n.includes('zero two')) s += 50000;
      s += Math.min(Number(c.basePower||0)/1000, 500);
      return s;
    };
    return score(b)-score(a);
  });
  return rows[0];
}
async function findOwnedCard(userId, query){
  const cards = await ownedCards(userId, 300);
  const q = norm(query);
  return cards.find(c=>c.id===query) || cards.find(c=>norm(c.character.name)===q) || cards.find(c=>norm(c.character.name).includes(q));
}
async function autocompleteAnime(i){
  const q = String(i.options.getFocused() || '').trim();
  // Get distinct anime names matching query
  const rows = await prisma.character.findMany({
    where:{ active:true, ...(q ? { anime:{ contains:q, mode:'insensitive' } } : {}) },
    orderBy:{ basePower:'desc' },
    take:500
  }).catch(()=>[]);
  // Deduplicate anime names and count characters
  const map = new Map();
  for(const r of rows){
    const a = r.anime || 'Unknown';
    if(!map.has(a)) map.set(a, 0);
    map.set(a, map.get(a) + 1);
  }
  // Sort by character count desc
  const sorted = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25);
  return i.respond(sorted.map(([anime, count])=>({ name:`${anime} (${count} characters)`.slice(0,100), value:anime }))).catch(()=>{});
}

async function autocompleteCharacters(i){
  const q = String(i.options.getFocused() || '').trim();
  let rows = [];
  if(i.commandName === 'my-card' || i.commandName === 'view-card' || i.commandName === 'train' || i.commandName === 'gear' || i.commandName === 'gear-upgrade' || i.commandName === 'skill-tree' || i.commandName === 'skill-upgrade'){
    rows = await ownedCards(i.user.id, 25);
    rows = rows.filter(c => !q || norm(c.character.name).includes(norm(q)));
    return i.respond(rows.slice(0,25).map(c=>({ name:`${c.character.name} • Lv.${c.level} • ${money(c.power)}`.slice(0,100), value:c.character.name }))).catch(()=>{});
  }
  // Case-insensitive search - split query into words for better matching
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length){
    rows = await prisma.character.findMany({ where:{ active:true }, orderBy:{ basePower:'desc' }, take:25 }).catch(()=>[]);
  } else {
    // Try exact first, then word-by-word
    rows = await prisma.character.findMany({
      where:{ active:true, name:{ contains:q, mode:'insensitive' } },
      orderBy:{ basePower:'desc' }, take:25
    }).catch(()=>[]);
    // If less than 5 results, try first word only
    if(rows.length < 5 && words[0]){
      const extra = await prisma.character.findMany({
        where:{ active:true, name:{ contains:words[0], mode:'insensitive' } },
        orderBy:{ basePower:'desc' }, take:25
      }).catch(()=>[]);
      // Merge, deduplicate
      const seen = new Set(rows.map(r=>r.id));
      for(const r of extra) if(!seen.has(r.id)){ rows.push(r); seen.add(r.id); }
      rows = rows.slice(0,25);
    }
  }
  return i.respond(rows.map(c=>({ name:`${c.name} • ${c.rarity} • ${money(c.basePower)}`.slice(0,100), value:c.name }))).catch(()=>{});
}

function characterEmbed(character, card=null, userMeta={}){
  const gp = card?.equipment ? card.equipment.reduce((a,e)=>a+Number(e.power||0)+Number(e.level||1)*250,0) : 0;
  const stats = baseStats(character.basePower, card?.level || 1, gp, card ? skillBonus(userMeta, card.id) : 0);
  const p = passiveOf(character);
  const gear = gearNames(character);
  // Read upgrade tiers
  const meta2 = (userMeta && typeof userMeta === 'object') ? userMeta : {};
  const cardMeta = (card?.meta && typeof card.meta === 'object') ? card.meta : {};
  const gearTierVal  = card?.gearTier  || cardMeta.gearTier  || meta2[card?.id+'_gear']  || 'COMMON';
  const skillTierVal = Number(card?.skillTier || cardMeta.skillTier || 0);
  const coreTierVal  = Number(card?.coreTier  || cardMeta.coreTier  || 0);
  const GEAR_TIERS2 = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'];
  const gearIdx2 = Math.max(0, GEAR_TIERS2.indexOf(gearTierVal));
  const gearBar2 = '▰'.repeat(gearIdx2+1) + '▱'.repeat(Math.max(0,6-gearIdx2));
  const isCorrupted2 = String(character.name||'').toLowerCase().includes('corrupted');

  const desc = [
    '**Anime:** ' + (character.animeCanonical || character.anime || 'Unknown'),
    (isCorrupted2 ? '🌌 **CORRUPTED** • ' : '') + '**Rarity:** ' + rIcon(character.rarity) + '  •  **Role:** ' + roleOf(character) + '  •  **Element:** ' + elementOf(character),
    card ? '**Level:** ' + card.level + '/100  •  **EXP:** ' + card.xp + '/' + levelXp(card.level) : '**Base Level:** 1',
    '**Power:** ' + money(card?.power || character.basePower),
    card ? '⚔️ **Gear:** ' + rIcon(gearTierVal) + ' ' + gearBar2 + '  •  **Skill:** ' + skillTierVal + '/10  •  **Core:** ' + coreTierVal + '/10' : '',
    '',
    '**Stats**',
    'HP ' + money(stats.hp) + ' • ATK ' + money(stats.atk) + ' • DEF ' + money(stats.def),
    'CRIT ' + stats.crit + '% • DODGE ' + stats.dodge + '% • SHIELD ' + money(stats.shield) + ' • SPD ' + stats.speed + ' • ENERGY ' + stats.energy,
    '',
    '**Passive — ' + p.name + '**',
    p.text,
    '',
    '**Gear Set**',
    'Weapon: ' + gear.weapon,
    'Armor: ' + gear.armor,
    'Accessory: ' + gear.accessory,
    'Boots: ' + gear.boots
  ].filter(x => x !== null && x !== undefined);
  const e = new EmbedBuilder().setTitle(`${rIcon(character.rarity)} ${character.name}`).setColor(RARITY_COLOR[character.rarity] || 0x5865f2).setDescription(desc.join('\n').slice(0,4000));
  return applyCharacterImage(e, character).embed;
}

/* ---------- Commands: Core ---------- */
async function cmdHelp(i){
  const e = new EmbedBuilder().setTitle('VoidRoll Help').setColor(0x6d28d9).setDescription([
    '**Core Commands**',
    '`/roll` — Use Normal Rolls to summon characters. Max rarity: DIVINE.',
    '`/premium-roll` — Use Premium Rolls for better MYTHIC/DIVINE chances.',
    '`/event-roll` — Use Event Rolls or Corrupted Fragments for event units.',
    '`/fragment-roll` — Pull the Corrupted Event banner using Corrupted Fragments only.',
    '`/fragments` — View your Corrupted Fragments, Event Rolls, and Event pity.',
    '`/banner` — View the active event banner.',
    '`/rates` — View roll rates for each banner.',
    '`/sacrifice-rolls` — Convert Normal Rolls into Premium Rolls.',
    '',
    '**Progression**',
    '`/my-card` — View your owned card, level, EXP, gear, stats, and skill tree.',
    '`/train` — Level up a card using Gold and Essence.',
    '`/gear` — View your card’s gear.',
    '`/gear-upgrade` — Upgrade Weapon, Armor, Accessory, or Boots.',
    '`/skill-tree` — View a card’s upgrade tree.',
    '`/skill-upgrade` — Upgrade skill tree nodes.',
    '`/shards` — View your Card Shards.',
    '`/shard-shop` — Spend Card Shards.',
    '`/auto-shard` — Convert old duplicate cards into Card Shards.',
    '',
    '**Formations**',
    '`/auto-formation` — Build your 3 strongest formations.',
    '`/formation` — View your formations.',
    '`/formation-set` — Place a card into a specific formation slot.',
    '',
    '**Game Modes**',
    '`/hunt` — Enter Hunt Zones, clear rooms, meet Merchants/Wizards, and extract rewards.',
    '`/survival` — Fight waves until your team is defeated.',
    '`/dungeon` — Enter dungeons using Dungeon Keys.',
    '`/gate` — Enter rare gates using Gate Keys.',
    '`/corrupted-raid` — Fight the active Corrupted Raid boss.',
    '',
    '**Resources**',
    'Gold — Training and gear upgrades.',
    'Tokens — Shop and market currency.',
    'Gems — Special upgrades and premium shop.',
    'Essence — Card growth and skill tree upgrades.',
    'Void Crystals — High-tier upgrades and Corrupted progression.',
    'Rolls — Used for Normal Roll.',
    'Premium Rolls — Used for Premium Roll.',
    'Event Rolls — Used for Event banners.',
    'Hunt Coins — Spent with Hunt Merchants.',
    'Corrupted Fragments — Used for Corrupted Event rolls and event shop.',
    'Relic Stones — Gear upgrades.',
    'Trait Stones — Trait rerolls and passive upgrades.',
    'Survival Coins — Survival shop.',
    'Dungeon Keys — Enter dungeons.',
    'Gate Keys — Enter special gates.',
    'Card Shards — Duplicate character currency used in Shard Shop.'
  ].join('\n'));
  return i.reply({ embeds:[e] });
}
async function cmdProfile(i){
  const u = await ensureUser(i.user);
  const m = metaOf(u), r = m.resources || {};
  const cards = await prisma.userCard.count({ where:{ userId:i.user.id } });
  const e = new EmbedBuilder().setTitle(`VoidRoll Profile — ${i.user.username}`).setColor(0x6d28d9).setDescription([
    `Gold: **${money(u.gold)}**`,
    `Tokens: **${money(u.tokens)}** • Gems: **${money(u.gems)}**`,
    `Essence: **${money(u.essence)}** • Void Crystals: **${money(u.voidCrystals)}**`,
    `Normal Rolls: **${money(u.rolls)}** • Premium Rolls: **${money(r.premiumRolls)}** • Event Rolls: **${money(r.eventRolls)}**`,
    `Hunt Coins: **${money(r.huntCoins)}** • Corrupted Fragments: **${money(r.corruptedFragments)}**`,
    `Relic Stones: **${money(r.relicStones)}** • Trait Stones: **${money(r.traitStones)}**`,
    `Survival Coins: **${money(r.survivalCoins)}** • Card Shards: **${money(r.cardShards)}**`,
    `Dungeon Keys: **${money(r.dungeonKeys)}** • Gate Keys: **${money(r.gateKeys)}**`,
    `Cards Owned: **${cards}**`
  ].join('\n'));
  return i.reply({ embeds:[e] });
}
async function cmdDaily(i){
  const u = await ensureUser(i.user);
  const now = Date.now();
  if(u.lastDailyAt && now - new Date(u.lastDailyAt).getTime() < 20*60*60*1000){
    return i.reply({ content:'Daily reward is not ready yet.', ephemeral:true });
  }
  await prisma.user.update({ where:{ id:i.user.id }, data:{ lastDailyAt:new Date(), dailyStreak:{ increment:1 }, gold:{ increment:1500n }, tokens:{ increment:75 }, rolls:{ increment:10 } } });
  await addResource(i.user.id,'premiumRolls',1);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Daily Claimed').setColor(0x22c55e).setDescription('Gold +1,500\nTokens +75\nNormal Rolls +10\nPremium Rolls +1')] });
}
async function cmdRates(i){
  const e = new EmbedBuilder().setTitle('Roll Rates').setColor(0x2563eb).setDescription([
    '**Normal Roll**',
    'COMMON 62% • RARE 24% • EPIC 10% • LEGENDARY 3% • MYTHIC 0.9% • DIVINE 0.1%',
    '',
    '**Premium Roll**',
    'COMMON 35% • RARE 30% • EPIC 20% • LEGENDARY 10% • MYTHIC 4% • DIVINE 1%',
    '',
    '**Corrupted Event Roll**',
    'LEGENDARY 55% • MYTHIC 35% • DIVINE 8.5% • SECRET 1.5%',
    'Pity: 100 event pulls guarantees a Corrupted SECRET.',
    '',
    '**Sacrifice Rate**',
    '25 Normal Rolls → 1 Premium Roll',
    '100 Normal Rolls → 5 Premium Rolls',
    '250 Normal Rolls → 15 Premium Rolls'
  ].join('\n'));
  return i.reply({ embeds:[e] });
}

async function cmdCharactersCount(i){
  const total = await prisma.character.count({ where:{ active:true } });
  const groups = await prisma.character.groupBy({ by:['rarity'], where:{ active:true }, _count:{ _all:true } });
  const order = Object.fromEntries(RARITIES.map((r,idx)=>[r,idx]));
  groups.sort((a,b)=>(order[a.rarity]??99)-(order[b.rarity]??99));
  const lines = groups.map(g=>`${rIcon(g.rarity)}: **${money(g._count._all)}**`);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Character Database').setColor(0x2563eb).setDescription(`Total Active Characters: **${money(total)}**\n\n${lines.join('\n')}`)] });
}
async function cmdRarity(i){
  const e = new EmbedBuilder().setTitle('Rarity Drop Rates').setColor(0x2563eb).setDescription([
    '**Normal Roll**',
    'COMMON 62% • RARE 24% • EPIC 10% • LEGENDARY 3% • MYTHIC 0.9% • DIVINE 0.1%',
    '',
    '**Premium Roll**',
    'COMMON 35% • RARE 30% • EPIC 20% • LEGENDARY 10% • MYTHIC 4% • DIVINE 1%',
    '',
    '**Corrupted Event Roll**',
    'LEGENDARY 55% • MYTHIC 35% • DIVINE 8.5% • SECRET 1.5%',
    'Pity: 100 event pulls guarantees a Corrupted SECRET.',
    '',
    'Normal and Premium rolls do not drop SECRET units.'
  ].join('\n'));
  return i.reply({ embeds:[e] });
}

/* ---------- Roll / Banner ---------- */
function rollRarity(type){
  const x = Math.random()*100;
  if(type === 'premium'){
    if(x < 1) return 'DIVINE';
    if(x < 5) return 'MYTHIC';
    if(x < 15) return 'LEGENDARY';
    if(x < 35) return 'EPIC';
    if(x < 65) return 'RARE';
    return 'COMMON';
  }
  if(x < 0.1) return 'DIVINE';
  if(x < 1.0) return 'MYTHIC';
  if(x < 4.0) return 'LEGENDARY';
  if(x < 14.0) return 'EPIC';
  if(x < 38.0) return 'RARE';
  return 'COMMON';
}
async function pickByRarity(rarity){
  const pool = await prisma.character.findMany({ where:{ active:true, rarity, limited:false }, take:300 });
  if(!pool.length) return prisma.character.findFirst({ where:{ active:true, limited:false }, orderBy:{ basePower:'desc' } });
  return pool[Math.floor(Math.random()*pool.length)];
}
async function pickCorrupted(){
  const pool = await prisma.character.findMany({ where:{ active:true, rarity:'SECRET', name:{ startsWith:'Corrupted' } }, orderBy:{ basePower:'desc' } });
  return pool[Math.floor(Math.random()*pool.length)];
}
function eventFillerRarity(){
  const x = Math.random()*100;
  if(x < 8.5) return 'DIVINE';
  if(x < 35) return 'MYTHIC';
  return 'LEGENDARY';
}
async function pickEventCharacter(userId){
  const user = await ensureUser(userId);
  const meta = metaOf(user);
  const pity = Number(meta.pity?.corrupted || 0);
  const hitSecret = pity >= EVENT_PITY_LIMIT - 1 || Math.random() < 0.015;

  if(hitSecret){
    const c = await pickCorrupted();
    await updateMeta(userId, m=>{ m.pity=m.pity||{}; m.pity.corrupted=0; return m; });
    return { character:c, secret:true, pityBefore:pity, pityAfter:0 };
  }

  const rarity = eventFillerRarity();
  const c = await pickByRarity(rarity);
  await updateMeta(userId, m=>{ m.pity=m.pity||{}; m.pity.corrupted=Number(m.pity.corrupted||0)+1; return m; });
  return { character:c, secret:false, pityBefore:pity, pityAfter:pity+1 };
}
async function cmdFragments(i){
  const u = await ensureUser(i.user);
  const r = metaOf(u).resources || {};
  const pity = Number(metaOf(u).pity?.corrupted || 0);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Corrupted Fragments').setColor(0x6d28d9).setDescription([
    `Corrupted Fragments: **${money(r.corruptedFragments || 0)}**`,
    `Event Rolls: **${money(r.eventRolls || 0)}**`,
    `Event Pity: **${pity}/100**`,
    '',
    `1 Event Pull costs **${money(EVENT_ROLL_FRAGMENT_COST)} Corrupted Fragments** if you do not use Event Rolls.`,
    `10 Event Pulls cost **${money(EVENT_ROLL_FRAGMENT_COST * 10)} Corrupted Fragments**.`,
    '',
    'Use `/fragment-roll amount:1` or `/fragment-roll amount:10` to pull using fragments only.'
  ].join('\n'))] });
}
async function fragmentRollMany(i){
  const amount = clamp(i.options.getInteger('amount') || 1, 1, 10);
  const u = await ensureUser(i.user);
  const need = amount * EVENT_ROLL_FRAGMENT_COST;
  const frags = getMetaResource(u, 'corruptedFragments');

  if(frags < need){
    return i.reply({ content:`Need ${money(need)} Corrupted Fragments. You have ${money(frags)}.`, ephemeral:true });
  }

  await spendResource(i.user.id, 'corruptedFragments', need);
  await i.deferReply();

  const results = [];
  for(let k=0;k<amount;k++){
    const eventInfo = await pickEventCharacter(i.user.id);
    const c = eventInfo.character;
    if(!c) continue;
    const card = await grantCard(i.user.id, c);
    results.push({ c, card, duplicate:!!card?.duplicate, shards:card?.shards || 0, eventInfo });
  }

  const embedPayloads = results.map((r,idx)=>{
    const p = passiveOf(r.c);
    const st = baseStats(r.c.basePower, 1, 0, 0);
    const e = new EmbedBuilder().setTitle(`#${idx+1} ${rIcon(r.c.rarity)} ${r.c.name}`).setColor(RARITY_COLOR[r.c.rarity] || 0x5865f2)
      .setDescription([
        `Anime: **${r.c.anime || 'Unknown'}**`,
        `Power: **${money(r.c.basePower)}**${r.duplicate && !r.kept ? `  •  Duplicate → 🪙 Shards +${r.shards}` : r.kept ? '  •  Duplicate → Kept as copy' : ''}`,
        `HP ${money(st.hp)} • ATK ${money(st.atk)} • DEF ${money(st.def)}`,
        `CRIT ${st.crit}% • DODGE ${st.dodge}% • SHIELD ${money(st.shield)} • SPD ${st.speed}`,
        `Passive: **${p.name}** — ${p.text}`,
        r.eventInfo?.secret ? '**BANNER HIT:** Corrupted SECRET pulled. Pity reset to 0/100.' : `Pity: **${r.eventInfo?.pityAfter || 0}/100**`
      ].filter(Boolean).join('\n'));
    return applyCharacterImage(e, r.c);
  });

  for(let x=0;x<embedPayloads.length;x+=10){
    const chunk = embedPayloads.slice(x,x+10);
    const embeds = chunk.map(p=>p.embed);
    const files = chunk.flatMap(p=>p.files);
    if(x===0) await i.editReply({ embeds, files });
    else await i.followUp({ embeds, files });
  }

  await i.followUp({ embeds:[new EmbedBuilder().setTitle(`Fragment Roll Summary x${results.length}`).setColor(0x6d28d9).setDescription([
    `Corrupted Fragments -${money(need)}`,
    '',
    ...results.map((r,idx)=>`${idx+1}. ${rIcon(r.c.rarity)} **${r.c.name}** — ${money(r.c.basePower)}${r.eventInfo?.secret ? ' — BANNER SECRET' : ''}${r.duplicate && !r.kept ? ` — 🪙 Shards +${r.shards}` : r.kept ? ' — Copy kept' : ''}`)
  ].join('\n').slice(0,4000))] });
}

async function cmdBanner(i){
  const units = await prisma.character.findMany({ where:{ active:true, rarity:'SECRET', name:{ startsWith:'Corrupted' } }, orderBy:{ basePower:'desc' }, take:10 });
  const u = await ensureUser(i.user); const meta = metaOf(u); const pity = Number(meta.pity?.corrupted || 0);
  const featured = units[0];
  const e = new EmbedBuilder().setTitle('🕳️ Corrupted Event Banner').setColor(0x6d28d9).setDescription([
    '**Featured Units**',
    ...units.map(c=>`${RARITY_ICON.SECRET} **${c.name}** — ${money(c.basePower)}`),
    '',
    '**How to Pull**',
    'This banner supports **two pull methods**:',
    '• **Event Rolls**',
    '• **Corrupted Fragments**',
    '',
    '**Cost**',
    '1 pull = 1 Event Roll **OR** 5,000 Corrupted Fragments',
    '10 pulls = 10 Event Rolls **OR** 50,000 Corrupted Fragments',
    '',
    `Your Pity: **${pity}/100**`,
    '',
    '**Rates**',
    'LEGENDARY 55% • MYTHIC 35% • DIVINE 8.5% • SECRET 1.5%',
    'Pity: 100 pulls guarantees one Corrupted SECRET.',
    '',
    '**Commands**',
    '**Event Roll Method**',
    'Use `/event-roll amount:1` or `/event-roll amount:10`.',
    '',
    '**Fragment Method**',
    'Use `/fragment-roll amount:1` or `/fragment-roll amount:10`.',
    '',
    '`/fragments` shows your Corrupted Fragments, Event Rolls, and Pity.'
  ].join('\n'));
  if(featured){
    const payload = applyCharacterImage(e, featured);
    return i.reply({ embeds:[payload.embed], files:payload.files });
  }
  return i.reply({ embeds:[e] });
}
async function cmdSacrifice(i){
  const amount = i.options.getInteger('amount', true);
  const table = { 25:1, 100:5, 250:15 };
  if(!table[amount]) return i.reply({ content:'Choose 25, 100, or 250 Normal Rolls.', ephemeral:true });
  const u = await ensureUser(i.user);
  if(Number(u.rolls) < amount) return i.reply({ content:`You need ${amount} Normal Rolls. You have ${u.rolls}.`, ephemeral:true });
  await prisma.user.update({ where:{ id:i.user.id }, data:{ rolls:{ decrement:amount } } });
  await addResource(i.user.id, 'premiumRolls', table[amount]);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Rolls Sacrificed').setColor(0xb084f5).setDescription(`Normal Rolls -${amount}\nPremium Rolls +${table[amount]}`)] });
}
async function rollMany(i, type='normal'){
  const amount = clamp(i.options.getInteger('amount') || 1, 1, type==='normal'?30:10);
  const u = await ensureUser(i.user);
  if(type === 'normal'){
    if(Number(u.rolls) < amount) return i.reply({ content:`Need ${amount} Normal Rolls. You have ${u.rolls}.`, ephemeral:true });
    await prisma.user.update({ where:{ id:i.user.id }, data:{ rolls:{ decrement:amount } } });
  }
  if(type === 'premium'){
    if(getMetaResource(u,'premiumRolls') < amount) return i.reply({ content:`Need ${amount} Premium Rolls.`, ephemeral:true });
    await spendResource(i.user.id,'premiumRolls',amount);
  }
  if(type === 'event'){
    const have = getMetaResource(u,'eventRolls');
    const frags = getMetaResource(u,'corruptedFragments');
    if(have < amount && frags < amount*EVENT_ROLL_FRAGMENT_COST) return i.reply({ content:`Need ${amount} Event Rolls or ${amount*1000} Corrupted Fragments.`, ephemeral:true });
    if(have >= amount) await spendResource(i.user.id,'eventRolls',amount);
    else await spendResource(i.user.id,'corruptedFragments',amount*EVENT_ROLL_FRAGMENT_COST);
  }
  await i.deferReply();
  const results = [];
  for(let k=0;k<amount;k++){
    let c, eventInfo = null;
    if(type === 'event'){
      eventInfo = await pickEventCharacter(i.user.id);
      c = eventInfo.character;
    }else{
      c = await pickByRarity(rollRarity(type));
    }
    if(!c) continue;
    const card = await grantCard(i.user.id, c);
    results.push({ c, card, duplicate:!!card?.duplicate, shards:card?.shards || 0, eventInfo });
  }
  const embedPayloads = results.map((r,idx)=>{
    const p = passiveOf(r.c);
    const st = baseStats(r.c.basePower, 1, 0, 0);
    const e = new EmbedBuilder().setTitle(`#${idx+1} ${rIcon(r.c.rarity)} ${r.c.name}`).setColor(RARITY_COLOR[r.c.rarity] || 0x5865f2)
      .setDescription([
        `Anime: **${r.c.anime || 'Unknown'}**`,
        `Power: **${money(r.c.basePower)}**${r.duplicate && !r.kept ? `  •  Duplicate → 🪙 Shards +${r.shards}` : r.kept ? '  •  Duplicate → Kept as copy' : ''}`,
        `HP ${money(st.hp)} • ATK ${money(st.atk)} • DEF ${money(st.def)}`,
        `CRIT ${st.crit}% • DODGE ${st.dodge}% • SHIELD ${money(st.shield)} • SPD ${st.speed}`,
        `Passive: **${p.name}** — ${p.text}`,
        r.eventInfo ? (r.eventInfo.secret ? '**BANNER HIT:** Corrupted SECRET pulled. Pity reset to 0/100.' : `Pity: **${r.eventInfo.pityAfter}/100**`) : null
      ].filter(Boolean).join('\n'));
    return applyCharacterImage(e, r.c);
  });
  for(let x=0;x<embedPayloads.length;x+=10){
    const chunk = embedPayloads.slice(x,x+10);
    const embeds = chunk.map(p=>p.embed);
    const files = chunk.flatMap(p=>p.files);
    if(x===0) await i.editReply({ embeds, files });
    else await i.followUp({ embeds, files });
  }
  await i.followUp({ embeds:[new EmbedBuilder().setTitle(`Roll Summary x${results.length}`).setColor(0x111827).setDescription(results.map((r,idx)=>`${idx+1}. ${rIcon(r.c.rarity)} **${r.c.name}** — ${money(r.c.basePower)}${r.eventInfo?.secret ? ' — BANNER SECRET' : ''}${r.duplicate && !r.kept ? ` — 🪙 Shards +${r.shards}` : r.kept ? ' — Copy kept' : ''}`).join('\n').slice(0,4000) || 'No results.')] });
}


async function cmdAnime(i){
  const animeQuery = i.options.getString('anime', true).trim();
  const page = clamp(i.options.getInteger('page') || 1, 1, 999);
  const take = 10;
  const skip = (page - 1) * take;

  const total = await prisma.character.count({
    where:{ active:true, anime:{ contains:animeQuery, mode:'insensitive' } }
  });

  if(!total){
    return i.reply({ content:`No characters found for anime: **${animeQuery}**\nTip: try a shorter name like "Naruto" or "Bleach"`, ephemeral:true });
  }

  const rows = await prisma.character.findMany({
    where:{ active:true, anime:{ contains:animeQuery, mode:'insensitive' } },
    orderBy:[{ basePower:'desc' }, { name:'asc' }],
    skip,
    take
  });

  const maxPage = Math.max(1, Math.ceil(total / take));
  const lines = rows.map((c,idx)=>`${skip+idx+1}. ${rIcon(c.rarity)} **${c.name}** — ${money(c.basePower)} PWR`);

  const e = new EmbedBuilder()
    .setTitle(`Anime Search — ${animeQuery}`)
    .setColor(0x2563eb)
    .setDescription([
      `Found: **${money(total)}** characters`,
      `Page: **${page}/${maxPage}**`,
      '',
      ...lines,
      '',
      'Use `/anime anime:<name> page:<number>` to browse more.'
    ].join('\n').slice(0,3900));

  const first = rows[0];
  if(first){
    const payload = applyCharacterImage(e, first);
    return i.reply({ embeds:[payload.embed], files:payload.files });
  }
  return i.reply({ embeds:[e] });
}

async function animePagePayload(animeQuery, page=1){
  const take = 10;
  const total = await prisma.character.count({ where:{ active:true, anime:{ contains:animeQuery, mode:'insensitive' } } });
  if(!total) return { empty:true };
  const maxPage = Math.max(1, Math.ceil(total / take));
  page = clamp(page, 1, maxPage);
  const skip = (page - 1) * take;

  const rows = await prisma.character.findMany({
    where:{ active:true, anime:{ contains:animeQuery, mode:'insensitive' } },
    orderBy:[{ basePower:'desc' }, { name:'asc' }],
    skip,
    take
  });

  const e = new EmbedBuilder()
    .setTitle(`Anime Search — ${animeQuery}`)
    .setColor(0x2563eb)
    .setDescription([
      `Found: **${money(total)}** characters`,
      `Page: **${page}/${maxPage}**`,
      '',
      ...rows.map((c,idx)=>`${skip+idx+1}. ${rIcon(c.rarity)} **${c.name}** — ${money(c.basePower)} PWR`)
    ].join('\n').slice(0,3900));

  const payload = applyCharacterImage(e, rows[0]);
  payload.components = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`anime:${encodeURIComponent(animeQuery)}:${Math.max(1,page-1)}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page<=1),
    new ButtonBuilder().setCustomId(`anime:${encodeURIComponent(animeQuery)}:${Math.min(maxPage,page+1)}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page>=maxPage)
  )];
  return payload;
}

/* ---------- Character / inventory / progression ---------- */
async function cmdCharacter(i){
  const c = await findCharacter(i.options.getString('name', true));
  if(!c) return i.reply({ content:'No character found.', ephemeral:true });
  {
    const embed = characterEmbed(c);
    const imgPayload = applyCharacterImage(embed, c);
    return i.reply({ embeds:[imgPayload.embed], files:imgPayload.files });
  }
}
async function cmdVariants(i){
  const input = i.options.getString('name', true);
  const clean = norm(input).replace(/^corrupted /,'');
  const famous = [
    ['ainz', ['Ainz Ooal Gown','Corrupted Ainz Ooal Gown']],
    ['aizen', ['Sousuke Aizen','Corrupted Sousuke Aizen']],
    ['lelouch', ['Lelouch Lamperouge','Corrupted Lelouch Lamperouge']],
    ['gojo', ['Satoru Gojo','Corrupted Satoru Gojo']],
    ['itachi', ['Itachi Uchiha','Corrupted Itachi Uchiha']],
    ['rimuru', ['Rimuru Tempest','Corrupted Rimuru Tempest']],
    ['makima', ['Makima','Corrupted Makima']],
    ['eren', ['Eren Yeager','Corrupted Eren Yeager']],
    ['saber', ['Saber','Corrupted Saber']],
    ['all might', ['All Might','Corrupted All Might']]
  ];
  const pack = famous.find(([k]) => clean.includes(k));
  if(pack){
    const list = await prisma.character.findMany({ where:{ active:true, name:{ in:pack[1] } }, orderBy:{ basePower:'asc' } });
    if(list.length){
      const e = new EmbedBuilder().setTitle(`Variants — ${input}`).setColor(0x6d28d9).setDescription(list.map((c,idx)=>`${idx+1}. ${rIcon(c.rarity)} **${c.name}** — ${money(c.basePower)}`).join('\n'));
      const imgChar = list.find(x=>/^corrupted/i.test(x.name)) || list[0];
      const payload = applyCharacterImage(e, imgChar);
      return i.reply({ embeds:[payload.embed], files:payload.files });
    }
  }
  const base = norm(input).replace(/^corrupted /,'');
  const first = base.split(' ')[0];
  const rows = await prisma.character.findMany({ where:{ active:true, name:{ contains:first } }, take:80 });
  const list = rows.filter(c => norm(c.name).includes(base) || base.includes(norm(c.name).replace(/^corrupted /,''))).slice(0,10);
  if(!list.length) return i.reply({ content:'No variants found.', ephemeral:true });
  const e = new EmbedBuilder().setTitle(`Variants — ${input}`).setColor(0x6d28d9).setDescription(list.map((c,idx)=>`${idx+1}. ${rIcon(c.rarity)} **${c.name}** — ${money(c.basePower)}`).join('\n'));
  const img = safeImage((list.find(x=>/^corrupted/i.test(x.name)) || list[0]).imageUrl);
  if(img) e.setImage(img);
  return i.reply({ embeds:[e] });
}
async function cmdMyCard(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found in your inventory.', ephemeral:true });
  const u = await ensureUser(i.user);
  await recalcCard(card, metaOf(u));
  const fresh = await prisma.userCard.findUnique({ where:{ id:card.id }, include:{ character:true, equipment:{ include:{ template:true } } } });
  {
    const embed = characterEmbed(fresh.character, fresh, metaOf(u));
    const imgPayload = applyCharacterImage(embed, fresh.character);
    return i.reply({ embeds:[imgPayload.embed], files:imgPayload.files });
  }
}
async function inventoryPagePayload(userId, page=0){
  const cards = await prisma.userCard.findMany({
    where:{ userId },
    include:{ character:true, equipment:{ include:{ template:true } } },
    orderBy:{ power:'desc' }
  });
  if(!cards.length) return { empty:true };
  page = clamp(page, 0, cards.length-1);
  const c = cards[page];
  const e = characterEmbed(c.character, c, {});
  e.setFooter({ text:`Card ${page+1}/${cards.length}` });
  const payload = applyCharacterImage(e, c.character);
  payload.components = [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`inv:${Math.max(0,page-1)}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page<=0),
    new ButtonBuilder().setCustomId(`inv:${Math.min(cards.length-1,page+1)}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page>=cards.length-1),
    new ButtonBuilder().setCustomId(`quicksellone:${c.id}`).setLabel('Quick Sell This').setStyle(ButtonStyle.Danger)
  )];
  return payload;
}
async function cmdInventory(i){
  const payload = await inventoryPagePayload(i.user.id, 0);
  if(payload.empty) return i.reply({ content:'Your inventory is empty. Use /roll.', ephemeral:true });
  return i.reply({ embeds:[payload.embed], files:payload.files, components:payload.components });
}
async function cmdTrain(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  const requestedLevels = clamp(i.options.getInteger('levels') || 1, 1, 100);
  const u = await ensureUser(i.user);

  // Calculate how many levels we CAN actually afford
  let costGold = 0n, costEssence = 0;
  let affordableLevels = 0;
  const maxLevel = 100;

  for(let x = 0; x < requestedLevels; x++){
    const curLv = card.level + x;
    if(curLv >= maxLevel) break;
    const g = BigInt(Math.floor(curLv * 480 + 2000));
    const e = Math.ceil(curLv / 8);
    if(u.gold - costGold < g) break;
    if(Number(u.essence) - costEssence < e) break;
    costGold += g;
    costEssence += e;
    affordableLevels++;
  }

  if(affordableLevels === 0){
    // Tell player exactly how far they CAN go
    let canAfford = 0;
    let tmpG = 0n, tmpE = 0;
    for(let x = 0; x < (maxLevel - card.level); x++){
      const curLv = card.level + x;
      const g = BigInt(Math.floor(curLv * 480 + 2000));
      const e = Math.ceil(curLv / 8);
      if(u.gold < tmpG + g || Number(u.essence) < tmpE + e) break;
      tmpG += g; tmpE += e; canAfford++;
    }
    if(card.level >= maxLevel) return i.reply({ content:`**${card.character.name}** is already at max level (100).`, ephemeral:true });
    return i.reply({ content:[
      `Not enough resources to train **${card.character.name}**.`,
      `Current Level: **${card.level}/100**`,
      `Your Gold: **${money(u.gold)}** • Your Essence: **${money(u.essence)}**`,
      canAfford > 0 ? `With your current resources you can train up to **${canAfford} more levels** (to Lv.${card.level + canAfford}).` : 'You need more Gold and Essence to train this card.'
    ].join('\n'), ephemeral:true });
  }

  const newLevel = Math.min(maxLevel, card.level + affordableLevels);
  await prisma.user.update({ where:{ id:i.user.id }, data:{ gold:{ decrement:costGold }, essence:{ decrement:costEssence } } });
  await prisma.userCard.update({ where:{ id:card.id }, data:{ level:newLevel, xp:0 } });
  const fresh = await prisma.userCard.findUnique({ where:{ id:card.id }, include:{ character:true, equipment:{ include:{ template:true } } } });
  const stats = await recalcCard(fresh, metaOf(u));

  const msg = affordableLevels < requestedLevels
    ? `Trained **${affordableLevels}** levels (wanted ${requestedLevels} — ran out of resources at Lv.${newLevel}).`
    : `Trained **${affordableLevels}** levels.`;

  return i.reply({ embeds:[new EmbedBuilder().setTitle('Training Complete').setColor(0x22c55e).setDescription([
    msg,
    `**${fresh.character.name}** — Lv.**${card.level} → ${newLevel}**/100`,
    `Power: **${money(stats.power)}**`,
    `Gold: -${money(costGold)}  •  Essence: -${costEssence}`
  ].join('\n'))] });
}
async function cmdGear(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  if(!card.equipment?.length) await attachStarterGear(i.user.id, card.id, card.character);
  const fresh = await prisma.userCard.findUnique({ where:{ id:card.id }, include:{ character:true, equipment:{ include:{ template:true } } } });
  const lines = fresh.equipment.map(e=>`${e.template.slot === 'RING' ? 'ACCESSORY' : e.template.slot === 'ARTIFACT' ? 'BOOTS' : e.template.slot}: **${e.template.name}** Lv.${e.level} • Power ${money(e.power)}`);
  return i.reply({ embeds:[new EmbedBuilder().setTitle(`Gear — ${fresh.character.name}`).setColor(0x0ea5e9).setDescription(lines.join('\n'))] });
}
async function cmdGearUpgrade(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  const slotRaw = String(i.options.getString('slot', true)).toUpperCase();
  const slot = slotRaw === 'ACCESSORY' ? 'RING' : slotRaw === 'BOOTS' ? 'ARTIFACT' : slotRaw;
  if(!card.equipment?.length) await attachStarterGear(i.user.id, card.id, card.character);
  const fresh = await prisma.userCard.findUnique({ where:{ id:card.id }, include:{ character:true, equipment:{ include:{ template:true } } } });
  const eq = fresh.equipment.find(e=>e.template.slot === slot);
  if(!eq) return i.reply({ content:'Gear slot not found.', ephemeral:true });
  const u = await ensureUser(i.user);
  const costGold = eq.level * 650;
  const costStone = Math.ceil(eq.level/5);
  if(u.gold < BigInt(costGold)) return i.reply({ content:`Need ${money(costGold)} Gold.`, ephemeral:true });
  if(getMetaResource(u,'relicStones') < costStone) return i.reply({ content:`Need ${costStone} Relic Stones.`, ephemeral:true });
  await prisma.user.update({ where:{ id:i.user.id }, data:{ gold:{ decrement:BigInt(costGold) } } });
  await spendResource(i.user.id,'relicStones',costStone);
  await prisma.userEquipment.update({ where:{ id:eq.id }, data:{ level:{ increment:1 }, power:{ increment:Math.floor(eq.template.basePower*0.25)+250 } } });
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Gear Upgraded').setColor(0x0ea5e9).setDescription(`${eq.template.name} reached Lv.${eq.level+1}.\nGold -${money(costGold)}\nRelic Stones -${costStone}`)] });
}
async function cmdSkillTree(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  const u = await ensureUser(i.user);
  const s = skillInfo(metaOf(u), card.id);
  const e = new EmbedBuilder().setTitle(`Skill Tree — ${card.character.name}`).setColor(0x9333ea).setDescription([
    `Core: Lv.${s.core}/10 — HP/Power growth`,
    `Skill: Lv.${s.skill}/10 — Passive strength`,
    `Trait: Lv.${s.trait}/10 — Crit/Dodge identity`,
    `Gear Sync: Lv.${s.gear}/10 — Gear power scaling`,
    `Ultimate: Lv.${s.ultimate}/5 — High-tier burst growth`,
    '',
    'Use `/skill-upgrade card:<card> node:<node>`.'
  ].join('\n'));
  return i.reply({ embeds:[e] });
}
async function cmdSkillUpgrade(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  const node = i.options.getString('node', true);
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  const u = await ensureUser(i.user);
  const s = skillInfo(metaOf(u), card.id);
  const max = node === 'ultimate' ? 5 : 10;
  if(s[node] >= max) return i.reply({ content:'This node is already maxed.', ephemeral:true });
  const next = s[node] + 1;
  const costGold = next * 1200;
  const costEssence = next * 3;
  const costVoid = node === 'ultimate' ? next : 0;
  if(u.gold < BigInt(costGold)) return i.reply({ content:`Need ${money(costGold)} Gold.`, ephemeral:true });
  if(Number(u.essence) < costEssence) return i.reply({ content:`Need ${costEssence} Essence.`, ephemeral:true });
  if(Number(u.voidCrystals) < costVoid) return i.reply({ content:`Need ${costVoid} Void Crystals.`, ephemeral:true });
  await prisma.user.update({ where:{ id:i.user.id }, data:{ gold:{ decrement:BigInt(costGold) }, essence:{ decrement:costEssence }, voidCrystals:{ decrement:costVoid } } });
  await updateMeta(i.user.id, meta=>{ meta.skillTrees=meta.skillTrees||{}; meta.skillTrees[card.id]=meta.skillTrees[card.id]||{}; meta.skillTrees[card.id][node]=next; return meta; });
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Skill Node Upgraded').setColor(0x9333ea).setDescription(`${card.character.name}\n${title(node)} Lv.${next}\nGold -${money(costGold)}\nEssence -${costEssence}${costVoid?`\nVoid Crystals -${costVoid}`:''}`)] });
}

/* ---------- Formations ---------- */
async function formationCards(userId, formation=1){
  formation = Number(formation);
  if(!Number.isFinite(formation) || formation < 1 || formation > 3) formation = 1;
  const start = (formation-1)*5 + 1, end = start+4;
  const rows = await prisma.teamSlot.findMany({ where:{ userId, slot:{ gte:start, lte:end } }, include:{ card:{ include:{ character:true, equipment:{ include:{ template:true } } } } }, orderBy:{ slot:'asc' } });
  return rows.map(r=>r.card).filter(Boolean);
}
async function autoFormation(userId){
  const cards = await ownedCards(userId, 15);
  await prisma.teamSlot.deleteMany({ where:{ userId } });
  let slot=1;
  for(const c of cards){
    await prisma.teamSlot.upsert({ where:{ userId_slot:{ userId, slot } }, update:{ cardId:c.id }, create:{ id:nid('slot'), userId, slot, cardId:c.id } });
    slot++;
  }
  return cards.length;
}
async function cmdAutoFormation(i){ const n = await autoFormation(i.user.id); return i.reply(`Auto Formation complete. Assigned **${n}** cards across 3 formations.`); }
async function cmdFormation(i){
  const rows = await prisma.teamSlot.findMany({ where:{ userId:i.user.id }, include:{ card:{ include:{ character:true } } }, orderBy:{ slot:'asc' } });
  const lines = [];
  for(let f=1; f<=3; f++){
    lines.push(`**Formation ${f}**`);
    for(let s=1; s<=5; s++){
      const global = (f-1)*5+s; const r = rows.find(x=>x.slot===global);
      lines.push(`Slot ${s}: ${r ? `${r.card.character.name} Lv.${r.card.level} • ${money(r.card.power)}` : 'Empty'}`);
    }
    lines.push('');
  }
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Formations').setColor(0x2563eb).setDescription(lines.join('\n'))] });
}
async function cmdFormationSet(i){
  const formation = clamp(i.options.getInteger('formation', true), 1, 3);
  const slot = clamp(i.options.getInteger('slot', true), 1, 5);
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  const global = (formation-1)*5 + slot;
  await prisma.teamSlot.upsert({ where:{ userId_slot:{ userId:i.user.id, slot:global } }, update:{ cardId:card.id }, create:{ id:nid('slot'), userId:i.user.id, slot:global, cardId:card.id } });
  return i.reply(`Formation ${formation} Slot ${slot} set to **${card.character.name}**.`);
}

/* ---------- Combat helpers ---------- */
function teamPower(cards){ return cards.reduce((a,c)=>a + Number(c.power || c.character?.basePower || 0), 0); }

// Build team combat profile from passives + roles
function buildTeamProfile(cards){
  let dmgMult=1, defMult=1, rewardMult=1, executeMult=0, healMult=0;
  let dodgeBonus=0, critBonus=0, defPenBonus=0, controlBonus=0, lifestealBonus=0;
  let teamDmgBonus=0, missFxBonus=0;
  const roles = new Set();
  const passiveLines = [];

  for(const card of cards){
    const c = card.character || card;
    const p = passiveOf(c);
    const fx = p.fx || {};
    const role = roleOf(c);
    const isCorrupted = norm(c.name||'').includes('corrupted');
    const corruptMult = isCorrupted ? 1.55 : 1.0;
    roles.add(role);

    if(fx.dmg)      dmgMult    += (fx.dmg  || 0) * corruptMult;
    if(fx.defMult)  defMult    += (fx.defMult || 0) * corruptMult;
    if(fx.execute)  executeMult += (fx.execute || 0) * corruptMult;
    if(fx.heal)     healMult   += (fx.heal || 0) * corruptMult;
    if(fx.dodge)    dodgeBonus += (fx.dodge || 0) * corruptMult;
    if(fx.crit)     critBonus  += (fx.crit  || 0) * corruptMult;
    if(fx.defPen)   defPenBonus += (fx.defPen || 0) * corruptMult;
    if(fx.control)  controlBonus += (fx.control || 0) * corruptMult;
    if(fx.lifesteal) lifestealBonus += (fx.lifesteal || 0) * corruptMult;
    if(fx.teamDmg)  teamDmgBonus += (fx.teamDmg || 0) * corruptMult;
    if(fx.missFx)   missFxBonus += (fx.missFx || 0) * corruptMult;
    if(isCorrupted) passiveLines.push(`⚫ **${c.name}** — ${p.name}`);
    else passiveLines.push(`**${c.name}** — ${p.name}`);
  }

  // Role synergy bonuses
  if(roles.has('Tank'))     defMult    += 0.18;
  if(roles.has('Healer'))   healMult   += 0.20;
  if(roles.has('Support'))  teamDmgBonus += 0.10;
  if(roles.has('Assassin')) executeMult += 0.10;
  if(roles.has('Control'))  controlBonus += 0.12;

  // Apply teamDmg to final dmgMult
  dmgMult += teamDmgBonus;
  // Cap multipliers
  dmgMult  = Math.min(dmgMult,  3.5);
  defMult  = Math.min(defMult,  2.5);

  return { dmgMult, defMult, rewardMult, executeMult, healMult, dodgeBonus, critBonus,
           defPenBonus, controlBonus, lifestealBonus, missFxBonus, passiveLines };
}

function combat(cards, enemyName, enemyPower, buffs=[], startingHp=null, startingHpMax=null){
  const profile = buildTeamProfile(cards);
  let { dmgMult, defMult, rewardMult } = profile;

  // Buff items from Merchant/Wizard
  for(const b of buffs || []){
    const name = String(b.name || b.id || '').toLowerCase();
    if(name.includes('arcane') || name.includes('blood') || name.includes('energy')) dmgMult += 0.20;
    if(name.includes('glass')) dmgMult += 0.12;
    if(name.includes('heavy') || name.includes('iron')) defMult += 0.20;
    if(name.includes('silent')) defMult += 0.08;
    if(name.includes('lucky')) rewardMult += 0.15;
    if(name.includes('void') || name.includes('mana')) dmgMult += 0.10;
  }

  const power = teamPower(cards);
  // Enemy is weakened by defPen and control
  const effectiveEnemyPower = Math.floor(enemyPower * (1 - Math.min(0.40, profile.defPenBonus + profile.controlBonus * 0.5)));

  // teamHpMax is locked to starting value — never grows between rooms
  const baseHpMax = Math.floor((power * 2.8) * defMult);
  let teamHpMax = startingHpMax ? Math.min(startingHpMax, baseHpMax) : baseHpMax;
  let teamHp    = Math.min(teamHpMax, Math.floor(startingHp == null ? teamHpMax : startingHp));
  let enemyHpMax = Math.floor(effectiveEnemyPower * 3.0);
  let enemyHp    = enemyHpMax;

  const log = [`Team HP: **${money(teamHp)}/${money(teamHpMax)}** • Enemy HP: **${money(enemyHp)}/${money(enemyHpMax)}**`];
  if(profile.passiveLines.length) log.push('**Passives Active**', ...profile.passiveLines.slice(0,5));

  for(let t=1; t<=8; t++){
    const lead = cards[(t-1)%cards.length]?.character?.name || 'Team';

    // Crit chance
    const critChance = 0.12 + profile.critBonus;
    const isCrit = Math.random() < critChance;
    const critLabel = isCrit ? ' ⚡CRIT' : '';
    const critFactor = isCrit ? 1.65 : 1.0;

    const dmg = Math.floor(power * (0.28 + Math.random()*0.18) * dmgMult * critFactor);
    enemyHp -= dmg;
    log.push(`T${t}: ${lead} dealt **${money(dmg)}**${critLabel} to ${enemyName}. Enemy HP: **${money(Math.max(0,enemyHp))}/${money(enemyHpMax)}**`);

    // Execute threshold — Corrupted/Assassin can finish low-HP enemies
    if(enemyHp > 0 && profile.executeMult > 0){
      const executeThreshold = enemyHpMax * profile.executeMult;
      if(enemyHp < executeThreshold){
        log.push(`⚡ **EXECUTE** — ${lead} finishes ${enemyName}!`);
        enemyHp = 0;
      }
    }
    if(enemyHp <= 0) return { win:true, log, teamHp:Math.max(1,teamHp), teamHpMax, enemyHp:0, enemyHpMax, rewardMult };

    // Enemy attack — reduced by dodge chance
    if(profile.dodgeBonus > 0 && Math.random() < Math.min(0.45, profile.dodgeBonus)){
      log.push(`T${t}: Team dodges ${enemyName}'s attack!`);
      continue;
    }
    // Miss from Aizen/Corrupted passives
    if(profile.missFxBonus > 0 && Math.random() < Math.min(0.40, profile.missFxBonus)){
      log.push(`T${t}: ${enemyName} is lost in illusion — attack fails!`);
      continue;
    }

    const edmg = Math.floor(effectiveEnemyPower * (0.20+Math.random()*0.16) / defMult);
    teamHp -= edmg;

    // Lifesteal heals team
    if(profile.lifestealBonus > 0 && dmg > 0){
      const heal = Math.floor(dmg * Math.min(0.35, profile.lifestealBonus));
      teamHp = Math.min(teamHpMax, teamHp + heal);
    }
    // Passive heal per turn
    if(profile.healMult > 0){
      const passiveHeal = Math.floor(teamHpMax * 0.04 * profile.healMult);
      teamHp = Math.min(teamHpMax, teamHp + passiveHeal);
    }

    log.push(`T${t}: ${enemyName} dealt **${money(edmg)}**. Team HP: **${money(Math.max(0,teamHp))}/${money(teamHpMax)}**`);
    if(teamHp <= 0) return { win:false, log, teamHp:0, teamHpMax, enemyHp:Math.max(1,enemyHp), enemyHpMax, rewardMult };
  }
  return { win: teamHp >= enemyHp, log, teamHp:Math.max(0,teamHp), teamHpMax, enemyHp:Math.max(0,enemyHp), enemyHpMax, rewardMult };
}
async function grantModeRewards(userId, rewards){
  for(const [k,v] of Object.entries(rewards)){ await addResource(userId,k,v); }
}
function rewardsText(rewards){ return Object.entries(rewards).map(([k,v])=>`${title(k)} +${money(v)}`).join('\n'); }
function randomHuntRewards(zone, room){
  const tier = Number(zone.tier || 1);
  const rewards = {
    gold: Math.floor((180 + tier*120 + room*80) * (0.8 + Math.random()*0.7)),
    tokens: Math.floor((4 + tier*3 + room) * (0.7 + Math.random()*0.8)),
    huntCoins: Math.max(1, Math.floor((tier + room) / 3))
  };

  const pool = zone.pool || ['gold','tokens'];
  const picks = Math.min(2 + Math.floor(tier/4), pool.length);
  const shuffled = [...pool].sort(()=>Math.random()-0.5);

  for(const key of shuffled.slice(0,picks)){
    if(key === 'gold' || key === 'tokens' || key === 'huntCoins') continue;
    if(key === 'rolls') rewards.rolls = (rewards.rolls || 0) + (Math.random() < 0.45 ? 1 : 0);
    if(key === 'premiumRolls' && tier >= 7 && Math.random() < 0.08) rewards.premiumRolls = (rewards.premiumRolls || 0) + 1;
    if(key === 'eventRolls' && tier >= 9 && room >= 10 && Math.random() < (tier === 10 ? 0.025 : 0.012)) rewards.eventRolls = (rewards.eventRolls || 0) + 1;
    if(key === 'essence') rewards.essence = (rewards.essence || 0) + Math.max(1, Math.floor(tier*2 + room/2));
    if(key === 'relicStones') rewards.relicStones = (rewards.relicStones || 0) + Math.max(1, Math.floor(tier/2 + room/4));
    if(key === 'traitStones') rewards.traitStones = (rewards.traitStones || 0) + Math.max(1, Math.floor(tier/3 + room/5));
    if(key === 'voidCrystals') rewards.voidCrystals = (rewards.voidCrystals || 0) + Math.max(1, Math.floor(tier/5 + room/10));
    // Corrupted Fragments are intentionally controlled so they do not flood the economy.
    if(key === 'corruptedFragments') rewards.corruptedFragments = (rewards.corruptedFragments || 0) + Math.max(10, Math.floor(tier*10 + room*4));
  }

  if(room % 3 === 0) rewards.rolls = (rewards.rolls || 0) + 1;
  if(room % 7 === 0) rewards.rolls = (rewards.rolls || 0) + 2;

  return cleanRewards(rewards);
}
function mergeRewards(a={}, b={}){
  const out = { ...(a || {}) };
  for(const [k,v] of Object.entries(b || {})){
    out[k] = Number(out[k] || 0) + Number(v || 0);
    if(out[k] <= 0) delete out[k];
  }
  return out;
}
function cleanRewards(rewards={}){
  const out = {};
  for(const [k,v] of Object.entries(rewards || {})){
    if(Number(v || 0) > 0) out[k] = Number(v);
  }
  return out;
}

function disabledComponentsFrom(message){
  try{
    return message.components.map(row => {
      const newRow = ActionRowBuilder.from(row);
      newRow.components = newRow.components.map(c => ButtonBuilder.from(c).setDisabled(true));
      return newRow;
    });
  }catch{
    return [];
  }
}
async function lockButtonInteraction(i){
  try{
    if(i.message && i.message.components?.length){
      const disabled = disabledComponentsFrom(i.message);
      if(disabled.length) await i.message.edit({ components: disabled }).catch(()=>{});
    }
  }catch{}
}

/* ---------- Hunt ---------- */
async function cmdHunt(i, zoneId=null, formation=1){
  if(!zoneId){
    const rows = [];
    for(let x=0;x<HUNT_ZONES.length;x+=3){
      rows.push(new ActionRowBuilder().addComponents(...HUNT_ZONES.slice(x,x+3).map(z=>new ButtonBuilder().setCustomId(`huntzone:${z.id}`).setLabel(z.name).setStyle(ButtonStyle.Primary))));
    }
    return i.reply({ embeds:[new EmbedBuilder().setTitle('Choose Hunt Zone').setColor(0x6d28d9).setDescription(HUNT_ZONES.map(z=>`**${z.name}** — Recommended Power ${money(z.minPower)}`).join('\n'))], components:rows });
  }
  formation = clamp(formation,1,3);
  let cards = await formationCards(i.user.id, formation);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id, formation); }
  if(!cards.length) return i.reply({ content:'You need cards first. Use /roll amount:10, then /auto-formation.', ephemeral:true });
  await updateMeta(i.user.id, meta=>{ meta.hunt={ zone:zoneId, room:1, formation, createdAt:Date.now(), teamHp:null, teamHpMax:null }; return meta; });
  return resolveHuntRoom(i, zoneId, formation);
}
async function resolveHuntRoom(i, zoneId, formation=1){
  const zone = HUNT_ZONES.find(z=>z.id===zoneId) || HUNT_ZONES[0];
  const user = await ensureUser(i.user);
  const meta = metaOf(user);
  const hunt = meta.hunt || { zone:zone.id, room:1, formation, combo:0, wantedKills:0, mastery:0 };
  hunt.awaitingNext = false;
  meta.hunt = hunt;
  formation = clamp(hunt.formation || formation,1,3);
  const cards = await formationCards(i.user.id, formation);
  if(!cards.length) return i.reply({ content:'No formation found. Use /auto-formation.', ephemeral:true });

  const room = Number(hunt.room || 1);
  const isBossRoom = room % 5 === 0;
  const isDailyZone = zoneId === getDailyZone();
  const combo = Number(hunt.combo || 0);

  // Named enemies
  const enemyList = isBossRoom ? (zone.bosses || [`${zone.name} Boss`]) : (zone.enemies || [`${zone.name} Warden`]);
  const enemy = enemyList[Math.floor(Math.random() * enemyList.length)] + (isBossRoom ? '' : ` R${room}`);

  // Wanted Board — 3 random enemies at start of run
  if(!hunt.wantedBoard) {
    const allEnemies = [...(zone.enemies||[]), ...(zone.bosses||[])];
    hunt.wantedBoard = allEnemies.sort(()=>Math.random()-0.5).slice(0,3);
    hunt.wantedKills = hunt.wantedKills || 0;
  }
  const isWanted = hunt.wantedBoard.some(w => enemy.includes(w));

  // Boss room power multiplier
  const bossMult = isBossRoom ? 2.2 : 1.0;
  const enemyPower = Math.floor(zone.minPower*(0.65+room*0.17)*bossMult + Math.random()*zone.minPower*0.2);

  // Combo bonus
  const comboMult = 1 + Math.min(combo * 0.05, 0.50);
  const dailyMult = isDailyZone ? 2.0 : 1.0;

  // Formation synergy
  const roles = new Set(cards.map(c => roleOf(c.character || c)));
  const hasSynergy = roles.has('TANK') && roles.has('DPS') && (roles.has('HEALER') || roles.has('SUPPORT'));
  const synergyMult = hasSynergy ? 1.15 : 1.0;

  const fight = combat(cards, enemy, enemyPower, hunt.buffs || [], hunt.teamHp, hunt.teamHpMax);

  // Loot rarity
  const loot = lootRarity(zone, room);

  const desc = [
    (isDailyZone ? '⭐ **DAILY ZONE — 2x Rewards!**' : ''),
    isBossRoom ? '👑 **BOSS ROOM!**' : '',
    zone.story ? ('*' + zone.story + '*') : '',
    '',
    '**Zone:** ' + zone.name + ' • **Room:** ' + room + (isBossRoom ? ' 👑' : ''),
    '**Enemy:** ' + enemy + (isWanted ? ' 🎯 WANTED' : ''),
    '**Team Power:** ' + money(teamPower(cards)) + ' • **Enemy Power:** ' + money(enemyPower),
    combo > 0 ? ('**Combo:** x' + combo + ' — Rewards +' + Math.floor(combo*5) + '%') : '',
    hasSynergy ? '**Formation Synergy:** +15% Damage ⚔️' : '',
    '',
    ...fight.log.slice(0,8)
  ].filter(Boolean);

  if(fight.win){
    // Update combo
    const tookDamage = fight.teamHp < (hunt.teamHp || fight.teamHpMax);
    const newCombo = tookDamage ? 0 : combo + 1;
    hunt.combo = newCombo;
    // Track achievements
    await updateMeta(i.user.id, m => {
      m.huntWins = (Number(m.huntWins||0)) + 1;
      if(!tookDamage) m.huntNoDmg = (Number(m.huntNoDmg||0)) + 1;
      else m.huntNoDmg = 0;
      if(isBossRoom) m.huntBosses = (Number(m.huntBosses||0)) + 1;
      if(hunt.wantedComplete && !meta['wantedDone_counted_'+room]) {
        m.wantedDone = (Number(m.wantedDone||0)) + 1;
        m['wantedDone_counted_'+room] = true;
      }
      m.maxCombo = Math.max(Number(m.maxCombo||0), newCombo);
      return m;
    }).catch(()=>{});

    // Wanted kill
    if(isWanted){
      hunt.wantedKills = (hunt.wantedKills || 0) + 1;
    }

    const rewards = randomHuntRewards(zone, room);

    // Apply multipliers
    const totalMult = comboMult * dailyMult * synergyMult * loot.mult * (fight.rewardMult || 1);
    for(const k of Object.keys(rewards)){
      if(['gold','tokens','huntCoins','essence','relicStones','traitStones','voidCrystals','corruptedFragments'].includes(k)){
        rewards[k] = Math.floor(rewards[k] * totalMult);
      }
    }

    // Boss room bonus
    if(isBossRoom){
      rewards.premiumRolls = (rewards.premiumRolls || 0) + 1;
      rewards.voidCrystals = (rewards.voidCrystals || 0) + 1;
      if(zone.tier >= 7) rewards.eventRolls = (rewards.eventRolls || 0) + 1;
    }

    // Wanted kill bonus
    if(isWanted) rewards.huntCoins = (rewards.huntCoins || 0) + 5;

    // Wanted board complete
    let wantedBonus = '';
    if(hunt.wantedKills >= 3 && !hunt.wantedComplete){
      rewards.tokens = (rewards.tokens || 0) + 500;
      rewards.voidCrystals = (rewards.voidCrystals || 0) + 2;
      hunt.wantedComplete = true;
      wantedBonus = '\n🎯 **WANTED BOARD COMPLETE!** Bonus rewards claimed!';
    }

    // Random event (20% chance)
    let eventMsg = '';
    if(!hunt.eventUsed && Math.random() < 0.20){
      const events = [
        { msg:'📦 Hidden chest found! Gold +' + money(zone.minPower*2), reward:{ gold: zone.minPower*2 } },
        { msg:'⚡ Surge of power! Tokens +' + money(zone.tier*50), reward:{ tokens: zone.tier*50 } },
        { msg:'💀 Cursed trap! Lost 8% HP', reward:{}, trap:true },
        { msg:'🌟 Zone blessing! All rewards x1.5', multiplier:1.5 },
        { msg:'🔮 Essence vein discovered! Essence +' + money(zone.tier*30), reward:{ essence: zone.tier*30 } },
      ];
      const ev = events[Math.floor(Math.random()*events.length)];
      eventMsg = '\n' + ev.msg;
      if(ev.reward) for(const[k,v] of Object.entries(ev.reward)) rewards[k] = (rewards[k]||0) + v;
      if(ev.trap) fight.teamHp = Math.max(1, Math.floor(fight.teamHp * 0.92));
      if(ev.multiplier) for(const k of Object.keys(rewards)) if(typeof rewards[k]==='number') rewards[k] = Math.floor(rewards[k]*ev.multiplier);
    }

    const clean = cleanRewards(rewards);
    hunt.pendingRewards = mergeRewards(hunt.pendingRewards, clean);
    hunt.teamHp = fight.teamHp;
    hunt.teamHpMax = fight.teamHpMax;

    // Zone mastery
    const masteryKey = 'mastery_' + zoneId;
    meta[masteryKey] = (Number(meta[masteryKey]||0)) + 1;

    desc.push('');
    desc.push('**Loot Quality:** ' + loot.label + ' • **Reward Mult:** x' + totalMult.toFixed(2));
    desc.push('**Team HP:** ' + money(fight.teamHp) + '/' + money(fight.teamHpMax));
    if(newCombo > 1) desc.push('🔥 **COMBO x' + newCombo + '** — No damage taken!');
    if(isWanted) desc.push('🎯 Wanted target eliminated! (' + hunt.wantedKills + '/3)');
    desc.push('');
    desc.push('**Room Loot**', rewardsText(clean));
    desc.push(wantedBonus + eventMsg);
    desc.push('');
    desc.push('**Wanted Board:** ' + (hunt.wantedBoard||[]).map(w => (hunt.wantedComplete || (isWanted && enemy.includes(w))) ? '~~'+w+'~~' : w).join(' • '));
    desc.push('*Extract to claim. Losing means losing all unextracted loot.*');

    hunt.room = room+1;
    hunt.awaitingNext = true;
    hunt.eventUsed = false;
    meta.hunt = hunt;
    await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });

    const buttons = [
      new ButtonBuilder().setCustomId('huntnext').setLabel('Next Room').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('huntextract').setLabel('Extract').setStyle(ButtonStyle.Success)
    ];
    const roll = Math.random();
    if(roll < 0.10){
      // Cursed Room option
      const cursed = CURSED_ROOMS[Math.floor(Math.random()*CURSED_ROOMS.length)];
      hunt.pendingCursed = cursed.id;
      buttons.splice(1,0,new ButtonBuilder().setCustomId('huntcursed').setLabel(cursed.icon + ' ' + cursed.name).setStyle(ButtonStyle.Danger));
    } else if(roll < 0.24) buttons.splice(1,0,new ButtonBuilder().setCustomId('huntmerchant').setLabel('🛒 Merchant').setStyle(ButtonStyle.Secondary));
    else if(roll < 0.35) buttons.splice(1,0,new ButtonBuilder().setCustomId('huntwizard').setLabel('🔮 Wizard').setStyle(ButtonStyle.Secondary));

    const title = isBossRoom ? '👑 Boss Defeated!' : (newCombo>2 ? '🔥 COMBO x'+newCombo+'!' : '⚔️ Room Cleared');
    return i.reply({ embeds:[new EmbedBuilder().setTitle(title).setColor(isBossRoom ? 0xfacc15 : zone.color).setDescription(desc.join('\n').slice(0,3900))], components:[new ActionRowBuilder().addComponents(...buttons)] });
  }

  // Defeat
  delete meta.hunt;
  await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });
  desc.push('');
  desc.push('💀 **Defeated at Room ' + room + '.**');
  desc.push('Run failed. Unextracted loot was lost.');
  if(combo > 0) desc.push('Combo broken at x' + combo + '.');
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Hunt Defeat').setColor(0xef4444).setDescription(desc.join('\n').slice(0,3900))] });
}
async function cmdHuntNext(i){
  const user = await ensureUser(i.user); const hunt = metaOf(user).hunt;
  if(!hunt) return i.reply({ content:'No active Hunt run. Use /hunt.', ephemeral:true });
  if(!hunt.awaitingNext) return i.reply({ content:'Your current Hunt room is already resolved. Use the buttons from the latest Hunt message.', ephemeral:true });
  return resolveHuntRoom(i, hunt.zone, hunt.formation);
}
async function cmdMerchant(i){
  await lockButtonInteraction(i);
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  if(!meta.hunt) return i.reply({ content:'No active Hunt run.', ephemeral:true });
  if(meta.hunt.eventUsed) return i.reply({ content:'This Hunt event was already used. Continue to the next room.', ephemeral:true });
  meta.hunt.eventUsed = true;
  const stockPool = [
    { id:'heal', name:'Field Potion', cost:3, text:'Restores 35% of team HP.' },
    { id:'compass', name:'Lucky Compass', cost:5, text:'Rewards +15% for this Hunt run.' },
    { id:'guard', name:'Iron Guard', cost:4, text:'Defense +20% for this Hunt run.' },
    { id:'energy', name:'Energy Flask', cost:4, text:'Damage +10% for this Hunt run.' },
    { id:'extract', name:'Escape Rope', cost:2, text:'Safe extraction option remains available.' }
  ];
  const stock = stockPool.sort(()=>Math.random()-0.5).slice(0,4);
  meta.hunt.merchantStock = stock;
  await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });
  const coins = getMetaResource(u,'huntCoins');
  return i.reply({ embeds:[new EmbedBuilder().setTitle('A Merchant appears from the fog...').setColor(0xf59e0b).setDescription([
    `Hunt Coins: **${money(coins)}**`,
    '',
    ...stock.map((x,idx)=>`${idx+1}. **${x.name}** — ${x.cost} Hunt Coins — ${x.text}`)
  ].join('\n'))], components:[
    new ActionRowBuilder().addComponents(...stock.map((x,idx)=>new ButtonBuilder().setCustomId(`merchantbuy:${idx}`).setLabel(`${x.name} (${x.cost})`).setStyle(ButtonStyle.Secondary))),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('huntnext').setLabel('Next Room').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('huntextract').setLabel('Extract').setStyle(ButtonStyle.Success)
    )
  ] });
}
async function cmdWizard(i){
  await lockButtonInteraction(i);
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  if(!meta.hunt) return i.reply({ content:'No active Hunt run.', ephemeral:true });
  if(meta.hunt.eventUsed) return i.reply({ content:'This Hunt event was already used. Continue to the next room.', ephemeral:true });
  meta.hunt.eventUsed = true;
  await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });
  const pool = [
    ['Arcane Rush','Damage +20%, Defense -10%'],
    ['Glass Focus','Crit +18%, HP -12%'],
    ['Heavy Guard','Defense +20%, Speed -8%'],
    ['Void Spark','Energy +25%, Dodge -8%'],
    ['Blood Pact','ATK +28%, Healing -15%'],
    ['Silent Step','Dodge +16%, Shield -10%'],
    ['Mana Burn','Energy +30%, HP -14%'],
    ['Iron Curse','DEF +25%, Speed -12%'],
    ['Lucky Hex','Rewards +15%, Enemy Power +10%']
  ];
  const opts = pool.sort(()=>Math.random()-0.5).slice(0,4);
  meta.hunt.wizardOffers = opts;
  await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });
  return i.reply({ embeds:[new EmbedBuilder().setTitle('The Wizard offers a pact...').setColor(0x8b5cf6).setDescription(opts.map((o,k)=>`${k+1}. **${o[0]}** — ${o[1]}`).join('\n'))], components:[new ActionRowBuilder().addComponents(...opts.map((o,k)=>new ButtonBuilder().setCustomId(`wizard:${k}`).setLabel(o[0]).setStyle(ButtonStyle.Secondary)), new ButtonBuilder().setCustomId('huntnext').setLabel('Ignore').setStyle(ButtonStyle.Primary))] });
}

/* ---------- Survival / Dungeon / Gate ---------- */
async function cmdSurvival(i){
  let cards = await formationCards(i.user.id, 1);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id,1); }
  if(!cards.length) return i.reply({ content:'You need cards first. Use /roll amount:10.', ephemeral:true });
  await i.deferReply();
  let wave=1, cleared=0, total={ gold:0, tokens:0, survivalCoins:0, essence:0, rolls:0 };
  let logs = [];
  while(wave<=60){
    const enemyPower = Math.floor(12000*Math.pow(1.12,wave)+wave*900);
    const fight = combat(cards, `Wave ${wave} Enemy`, enemyPower);
    logs.push(`**Wave ${wave} Started**`);
    logs.push(...fight.log.slice(0,4));
    if(!fight.win){ logs.push(`**Defeated at Wave ${wave}.**`); break; }
    cleared++;
    const rewards = { gold:100+wave*45, tokens:2+Math.floor(wave/3), survivalCoins:1+Math.floor(wave/5), essence:Math.floor(wave/4), rolls:(wave % 5 === 0 ? 1 : 0) };
    for(const [k,v] of Object.entries(rewards)) total[k]+=v;
    logs.push(`Wave ${wave} cleared — ${rewardsText(rewards)}`);
    wave++;
    if(logs.join('\n').length>3000){ await i.followUp({ embeds:[new EmbedBuilder().setTitle('Survival Combat').setColor(0x14b8a6).setDescription(logs.join('\n').slice(0,3900))] }); logs=[]; }
  }
  await grantModeRewards(i.user.id,total);
  const e = new EmbedBuilder().setTitle(`Survival Ended — Reached Wave ${cleared+1}`).setColor(0x14b8a6).setDescription([...logs,'','**Total Rewards**',rewardsText(total)].join('\n').slice(0,3900));
  return i.editReply({ embeds:[e] }).catch(()=>i.followUp({ embeds:[e] }));
}
async function startDungeonLike(i, type='dungeon'){
  const key = type==='gate' ? 'gateKeys' : 'dungeonKeys';
  const user = await ensureUser(i.user);
  if(getMetaResource(user,key) < 1) return i.reply({ content:`You need 1 ${title(key)}.`, ephemeral:true });
  await spendResource(i.user.id,key,1);
  const roomA = DUNGEON_ROOMS[Math.floor(Math.random()*DUNGEON_ROOMS.length)];
  const roomB = DUNGEON_ROOMS[Math.floor(Math.random()*DUNGEON_ROOMS.length)];
  await updateMeta(i.user.id, meta=>{ meta[type]={ floor:1, type, rooms:[roomA,roomB], createdAt:Date.now() }; return meta; });
  return i.reply({ embeds:[new EmbedBuilder().setTitle(`${title(type)} Gate Opened`).setColor(0x7c3aed).setDescription(`Choose your path:\n1. **${roomA.name}**\n2. **${roomB.name}**`)], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${type}:0`).setLabel(roomA.name).setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`${type}:1`).setLabel(roomB.name).setStyle(ButtonStyle.Primary))] });
}
async function resolveDungeonRoom(i, type, choice){
  const user = await ensureUser(i.user); const meta = metaOf(user); const run = meta[type];
  if(!run) return i.reply({ content:`No active ${type}.`, ephemeral:true });
  const room = run.rooms[Number(choice)] || run.rooms[0];
  let cards = await formationCards(i.user.id, 1); if(!cards.length){ await autoFormation(i.user.id); cards=await formationCards(i.user.id,1); }
  const floor = Number(run.floor||1); const enemyPower = Math.floor(25000*Math.pow(1.16,floor)*room.mult);
  const fight = combat(cards, `${room.name} Guardian`, enemyPower);
  const desc = [`**${room.name} — Floor ${floor}**`, ...fight.log.slice(0,10)];
  if(fight.win){
    const rewards = { gold:500+floor*120, tokens:15+floor*3, [room.reward]:Math.max(1,Math.floor(floor/2)+1), rolls:(floor % 3 === 0 ? 1 : 0) };
    await grantModeRewards(i.user.id,rewards);
    desc.push('','**Rewards**',rewardsText(rewards));
    run.floor = floor+1;
    run.rooms = [DUNGEON_ROOMS[Math.floor(Math.random()*DUNGEON_ROOMS.length)], DUNGEON_ROOMS[Math.floor(Math.random()*DUNGEON_ROOMS.length)]];
    meta[type]=run; await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });
    return i.reply({ embeds:[new EmbedBuilder().setTitle(`${title(type)} Room Cleared`).setColor(0x22c55e).setDescription(desc.join('\n').slice(0,3900))], components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`${type}:0`).setLabel(run.rooms[0].name).setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`${type}:1`).setLabel(run.rooms[1].name).setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`${type}:extract`).setLabel('Extract').setStyle(ButtonStyle.Success))] });
  }
  delete meta[type]; await prisma.user.update({ where:{ id:i.user.id }, data:{ meta } });
  return i.reply({ embeds:[new EmbedBuilder().setTitle(`${title(type)} Failed`).setColor(0xef4444).setDescription(desc.concat(['','Run ended.']).join('\n').slice(0,3900))] });
}

/* ---------- Raid ---------- */
// ── RAID SYSTEM ─────────────────────────────────────────────────────────────
const RAID_BOSSES = [
  // [name, hp, power, tier, description]
  ['Corrupted Satoru Gojo',       180000000, 420000, 'LEGENDARY', 'The Void consumes Infinity. Attacks pierce all defenses.'],
  ['Corrupted Sousuke Aizen',     165000000, 405000, 'LEGENDARY', 'Shattered illusions — no one can see the truth.'],
  ['Corrupted Ainz Ooal Gown',    175000000, 415000, 'LEGENDARY', 'Eclipse of Nazarick. Execute pressure at every turn.'],
  ['Corrupted Lelouch Lamperouge',150000000, 380000, 'LEGENDARY', 'Zero Requiem rewritten in Void. Commands cannot be broken.'],
  ['Corrupted Itachi Uchiha',     155000000, 390000, 'LEGENDARY', 'Black Moon Tsukuyomi. All allies are blinded.'],
  ['Corrupted Rimuru Tempest',    185000000, 425000, 'LEGENDARY', 'Void God Azathoth — absorbs all damage as strength.'],
  ['Corrupted Makima',            160000000, 395000, 'LEGENDARY', 'Absolute control. The strongest ally turns against you.'],
  ['Corrupted Eren Yeager',       145000000, 370000, 'ELITE',     'Founding Void Titan. Grows stronger each wave.'],
  ['Corrupted Saber',             170000000, 410000, 'ELITE',     'Abyss Excalibur charges — a single strike can end all.'],
  ['Corrupted All Might',         155000000, 385000, 'ELITE',     'Dark Plus Ultra — stores damage and detonates.'],
];
const RAID_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours per boss

async function spawnRaidBoss(){
  // Rotate through bosses in order, not random
  const last = await prisma.bossEvent.findFirst({ orderBy:{ startedAt:'desc' } });
  const lastIdx = last ? RAID_BOSSES.findIndex(b => b[0] === last.bossName) : -1;
  const nextIdx = (lastIdx + 1) % RAID_BOSSES.length;
  const pick = RAID_BOSSES[nextIdx];
  const expiresAt = new Date(Date.now() + RAID_DURATION_MS);
  return prisma.bossEvent.create({
    data:{
      id: nid('raid'),
      bossName: pick[0],
      bossHp: pick[1],
      bossPower: pick[2],
      status: 'ACTIVE',
      joinEndsAt: expiresAt,
      battleEndsAt: expiresAt,
      rewardGold: 10000,
      rewardTokens: 1000
    }
  });
}

async function activeRaid(){
  let raid = await prisma.bossEvent.findFirst({ where:{ status:'ACTIVE' }, orderBy:{ startedAt:'desc' } });
  if(!raid){ raid = await spawnRaidBoss(); return raid; }

  // Check if timer expired — auto-settle even if boss not dead
  const now = Date.now();
  const endsAt = raid.battleEndsAt ? new Date(raid.battleEndsAt).getTime() : new Date(raid.joinEndsAt).getTime();
  if(now > endsAt && raid.status === 'ACTIVE'){
    await settleRaid(raid);
    raid = await spawnRaidBoss();
  }
  return raid;
}

function raidTimeLeft(raid){
  const endsAt = raid.battleEndsAt ? new Date(raid.battleEndsAt).getTime() : new Date(raid.joinEndsAt).getTime();
  const ms = Math.max(0, endsAt - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return ms <= 0 ? 'Expired' : `${h}h ${m}m`;
}
async function settleRaid(raid){
  const entries = await prisma.bossEventEntry.findMany({ where:{ eventId:raid.id }, orderBy:{ damage:'desc' } });
  if(!entries.length){
    await prisma.bossEvent.update({ where:{ id:raid.id }, data:{ status:'DEFEATED', endedAt:new Date() } }).catch(()=>{});
    return { lines:['No participants.'], entries:[] };
  }

  const lines = [];
  for(let idx=0; idx<entries.length; idx++){
    const e = entries[idx];
    const rank = idx+1;
    const dmg = Number(e.damage || 0);
    const rewards = {
      gold: Math.floor(1200 + dmg/350),
      tokens: Math.floor(100 + dmg/12000),
      corruptedFragments: Math.floor(25 + dmg/100000),
      voidCrystals: Math.floor(dmg/650000)
    };
    if(rank === 1){ rewards.eventRolls = 1; rewards.corruptedFragments += 75; }
    else if(rank <= 3){ rewards.corruptedFragments += 35; }
    await grantModeRewards(e.userId, cleanRewards(rewards));
    lines.push(`#${rank} <@${e.userId}> — ${money(dmg)} DMG — ${rewardsText(cleanRewards(rewards))}`);
  }

  await prisma.bossEvent.update({ where:{ id:raid.id }, data:{ status:'DEFEATED', endedAt:new Date() } }).catch(()=>{});
  return { lines, entries };
}
async function cmdRaid(i){
  let raid = await activeRaid();
  let done = await prisma.bossEventEntry.aggregate({ where:{ eventId:raid.id }, _sum:{ damage:true } });
  let dmg = Number(done._sum.damage || 0);
  const hpLeft = Math.max(0, raid.bossHp - dmg);
  const hpPct = Math.floor((hpLeft / raid.bossHp) * 100);
  const bar = '█'.repeat(Math.floor(hpPct/10)) + '░'.repeat(10 - Math.floor(hpPct/10));
  const bossInfo = RAID_BOSSES.find(b => b[0] === raid.bossName);
  const tier = bossInfo?.[3] || 'ELITE';
  const desc = bossInfo?.[4] || '';
  const timeLeft = raidTimeLeft(raid);

  if(dmg >= raid.bossHp){
    const result = await settleRaid(raid);
    const next = await spawnRaidBoss();
    const nextInfo = RAID_BOSSES.find(b => b[0] === next.bossName);
    return i.reply({ embeds:[
      new EmbedBuilder().setTitle(`💀 ${raid.bossName} Defeated!`).setColor(0x22c55e).setDescription(['**Raid Rewards Distributed**', ...result.lines.slice(0,10)].join('\n').slice(0,3900)),
      new EmbedBuilder().setTitle(`⚔️ New Raid — ${next.bossName}`).setColor(0x6d28d9)
        .setDescription([`**Tier:** ${nextInfo?.[3] || 'ELITE'}`, `**HP:** ${money(next.bossHp)}`, `**Timer:** 72 hours`, '', nextInfo?.[4] || '', '', 'Use `/raid-attack` to attack.'].join('\n'))
    ] });
  }

  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle(`⚔️ Corrupted Raid — ${raid.bossName}`)
    .setColor(tier === 'LEGENDARY' ? 0x7c3aed : 0xef4444)
    .setDescription([
      `**Tier:** ${tier}  •  **Time Left:** ${timeLeft}`,
      `*${desc}*`,
      '',
      `**HP** ${bar} ${hpPct}%`,
      `${money(hpLeft)} / ${money(raid.bossHp)}`,
      '',
      `**Total Damage Dealt:** ${money(dmg)}`,
      '',
      '`/raid-attack` — Attack the boss',
      '`/raid-rank` — View damage rankings',
    ].join('\n'))] });
}
async function cmdRaidAttack(i){
  let raid = await activeRaid();
  let current = await prisma.bossEventEntry.aggregate({ where:{ eventId:raid.id }, _sum:{ damage:true } });
  let currentDmg = Number(current._sum.damage || 0);

  if(currentDmg >= raid.bossHp){
    const result = await settleRaid(raid);
    const next = await spawnRaidBoss();
    return i.reply({ embeds:[
      new EmbedBuilder().setTitle(`${raid.bossName} Already Defeated`).setColor(0x22c55e).setDescription(['**Raid Rewards Distributed**', ...result.lines.slice(0,10)].join('\n').slice(0,3900)),
      new EmbedBuilder().setTitle(`New Corrupted Raid — ${next.bossName}`).setColor(0x6d28d9).setDescription(`HP: **${money(next.bossHp)}/${money(next.bossHp)}**`)
    ] });
  }

  let cards = await formationCards(i.user.id,1);
  if(!cards.length){ await autoFormation(i.user.id); cards=await formationCards(i.user.id,1); }
  if(!cards.length) return i.reply({ content:'You need a formation first.', ephemeral:true });

  const rawDamage = Math.floor(teamPower(cards)*(0.30+Math.random()*0.22));
  const damage = Math.min(rawDamage, Math.max(0, raid.bossHp-currentDmg));
  await prisma.bossEventEntry.upsert({ where:{ eventId_userId:{ eventId:raid.id, userId:i.user.id } }, update:{ damage:{ increment:damage } }, create:{ id:nid('entry'), eventId:raid.id, userId:i.user.id, damage } });

  currentDmg += damage;
  if(currentDmg >= raid.bossHp){
    const result = await settleRaid(raid);
    const next = await spawnRaidBoss();
    return i.reply({ embeds:[
      new EmbedBuilder().setTitle(`${raid.bossName} Defeated`).setColor(0x22c55e).setDescription(`Final Hit Damage: **${money(damage)}**\n\n**Raid Rewards Distributed**\n${result.lines.slice(0,10).join('\n')}`.slice(0,3900)),
      new EmbedBuilder().setTitle(`New Corrupted Raid — ${next.bossName}`).setColor(0x6d28d9).setDescription(`HP: **${money(next.bossHp)}/${money(next.bossHp)}**\nUse \`/raid-attack\` to attack.`)
    ] });
  }

  return i.reply({ embeds:[new EmbedBuilder().setTitle('Raid Attack').setColor(0x6d28d9).setDescription(`Damage dealt: **${money(damage)}**\nBoss HP: **${money(Math.max(0,raid.bossHp-currentDmg))}/${money(raid.bossHp)}**\nRewards are distributed when the raid boss dies.`)] });
}
async function cmdRaidRank(i){
  const raid = await activeRaid();
  const rows = await prisma.bossEventEntry.findMany({ where:{ eventId:raid.id }, orderBy:{ damage:'desc' }, take:10 });
  return i.reply({ embeds:[new EmbedBuilder().setTitle(`Raid Rank — ${raid.bossName}`).setColor(0x6d28d9).setDescription(rows.map((r,idx)=>`${idx+1}. <@${r.userId}> — ${money(r.damage)} DMG`).join('\n') || 'No attacks yet.')] });
}

// ═══════════════════════════════════════════════════════════════
// SHOPS
// ═══════════════════════════════════════════════════════════════

const TOKEN_SHOP = {
  rolls:          { cost:200,  rewards:{ rolls:10 },                 icon:'🎲', label:'Normal Rolls x10',        desc:'10 normal rolls' },
  premium:        { cost:1200, rewards:{ premiumRolls:1 },           icon:'💎', label:'Premium Roll x1',          desc:'1 premium roll with better rates' },
  'premium-pack': { cost:5500, rewards:{ premiumRolls:5 },           icon:'💎', label:'Premium Roll x5',          desc:'5 premium rolls — save 500 tokens' },
  'dungeon-key':  { cost:800,  rewards:{ dungeonKeys:1 },            icon:'🗝️', label:'Dungeon Key x1',           desc:'Enter any dungeon' },
  'gate-key':     { cost:2500, rewards:{ gateKeys:1 },               icon:'🔑', label:'Gate Key x1',              desc:'Enter Nightmare or Gate dungeon' },
  essence:        { cost:400,  rewards:{ essence:150 },              icon:'🔮', label:'Essence x150',             desc:'For skill upgrades' },
  relics:         { cost:600,  rewards:{ relicStones:8 },            icon:'⚒️', label:'Relic Stones x8',          desc:'For gear upgrades' },
  traits:         { cost:600,  rewards:{ traitStones:8 },            icon:'🧬', label:'Trait Stones x8',          desc:'For trait upgrades' },
  'void-crystal': { cost:3000, rewards:{ voidCrystals:1 },          icon:'🌌', label:'Void Crystal x1',          desc:'Rare upgrade material' },
  fragments:      { cost:1500, rewards:{ corruptedFragments:2000 },  icon:'⚫', label:'Corrupted Fragments x2000', desc:'For event banner pulls' },
};
const SURVIVAL_SHOP = {
  rolls:         { cost:8,  rewards:{ rolls:5 },          icon:'🎲', label:'Normal Rolls x5' },
  premium:       { cost:25, rewards:{ premiumRolls:1 },   icon:'💎', label:'Premium Roll x1' },
  relics:        { cost:12, rewards:{ relicStones:8 },    icon:'⚒️', label:'Relic Stones x8' },
  traits:        { cost:12, rewards:{ traitStones:8 },    icon:'🧬', label:'Trait Stones x8' },
  essence:       { cost:10, rewards:{ essence:50 },       icon:'🔮', label:'Essence x50' },
  'dungeon-key': { cost:30, rewards:{ dungeonKeys:1 },    icon:'🗝️', label:'Dungeon Key x1' },
  'void-crystal':{ cost:80, rewards:{ voidCrystals:1 },  icon:'🌌', label:'Void Crystal x1' },
};
const HUNT_COIN_SHOP = {
  heal:    { cost:3,  effect:'heal',    icon:'💊', label:'Field Potion',   desc:'Restores 35% team HP in current Hunt run' },
  compass: { cost:5,  effect:'compass', icon:'🧭', label:'Lucky Compass',  desc:'Rewards +20% for this Hunt run' },
  guard:   { cost:4,  effect:'guard',   icon:'🛡️', label:'Iron Guard',     desc:'Defense +25% for this Hunt run' },
  flask:   { cost:4,  effect:'flask',   icon:'⚡', label:'Energy Flask',   desc:'Damage +15% for this Hunt run' },
  revive:  { cost:8,  effect:'revive',  icon:'✨', label:'Revive Charm',   desc:'Survive one defeat at 1 HP' },
  rolls:   { cost:15, rewards:{ rolls:3 },           icon:'🎲', label:'Normal Rolls x3',   desc:'Buy rolls with Hunt Coins' },
  relics:  { cost:12, rewards:{ relicStones:3 },     icon:'⚒️', label:'Relic Stones x3',  desc:'Buy relics with Hunt Coins' },
};
const SHARD_SHOP = {
  'premium-roll':    { cost:100, rewards:{ premiumRolls:1 },         icon:'💎', label:'Premium Roll x1' },
  'event-fragments': { cost:160, rewards:{ corruptedFragments:800 }, icon:'⚫', label:'Corrupted Fragments x800' },
  relics:            { cost:65,  rewards:{ relicStones:6 },          icon:'⚒️', label:'Relic Stones x6' },
  traits:            { cost:65,  rewards:{ traitStones:6 },          icon:'🧬', label:'Trait Stones x6' },
  essence:           { cost:40,  rewards:{ essence:120 },            icon:'🔮', label:'Essence x120' },
  rolls:             { cost:30,  rewards:{ rolls:12 },               icon:'🎲', label:'Normal Rolls x12' },
  'void-crystal':    { cost:300, rewards:{ voidCrystals:1 },        icon:'🌌', label:'Void Crystal x1' },
  'dungeon-key':     { cost:200, rewards:{ dungeonKeys:1 },          icon:'🗝️', label:'Dungeon Key x1' },
};
function shopLines(items, currency){
  return Object.entries(items).map(([id,s]) =>
    s.desc
      ? s.icon + ' **' + s.label + '** — `' + money(s.cost) + '` ' + currency + '\n   *' + s.desc + '*'
      : s.icon + ' **' + s.label + '** — `' + money(s.cost) + '` ' + currency
  );
}
async function cmdTokenShop(i){
  const u = await ensureUser(i.user);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('🎟️ Token Shop').setColor(0xf59e0b).setDescription(['Tokens: **' + money(u.tokens) + '**','', ...shopLines(TOKEN_SHOP,'Tokens'),'','Use `/token-buy item:<item> amount:<n>`.'].join('\n').slice(0,3900))] });
}
async function cmdTokenBuy(i){
  const item = i.options.getString('item', true);
  const amount = clamp(i.options.getInteger('amount') || 1, 1, 50);
  const pack = TOKEN_SHOP[item];
  if(!pack) return i.reply({ content:'Invalid token shop item.', ephemeral:true });
  const total = pack.cost * amount;
  const ok = await spendResource(i.user.id, 'tokens', total);
  if(!ok){ const u = await ensureUser(i.user); return i.reply({ content:'Need **' + money(total) + ' Tokens**. You have **' + money(u.tokens) + '**.', ephemeral:true }); }
  const rewards = {};
  for(const [k,v] of Object.entries(pack.rewards)) rewards[k] = v * amount;
  await grantModeRewards(i.user.id, rewards);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Token Shop').setColor(0xf59e0b).setDescription(pack.icon + ' **' + pack.label + '** x' + amount + '\nTokens -' + money(total) + '\n' + rewardsText(rewards))] });
}
async function cmdSurvivalShop(i){
  const u = await ensureUser(i.user);
  const coins = getMetaResource(u,'survivalCoins');
  return i.reply({ embeds:[new EmbedBuilder().setTitle('🌊 Survival Shop').setColor(0x14b8a6).setDescription(['Survival Coins: **' + money(coins) + '**','', ...shopLines(SURVIVAL_SHOP,'Survival Coins'),'','Use `/survival-buy item:<item>`.'].join('\n').slice(0,3900))] });
}
async function cmdSurvivalBuy(i){
  const item = i.options.getString('item', true);
  const pack = SURVIVAL_SHOP[item];
  if(!pack) return i.reply({ content:'Invalid item.', ephemeral:true });
  const ok = await spendResource(i.user.id,'survivalCoins', pack.cost);
  if(!ok) return i.reply({ content:'Need **' + pack.cost + ' Survival Coins**.', ephemeral:true });
  await grantModeRewards(i.user.id, pack.rewards);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Survival Shop').setColor(0x14b8a6).setDescription(pack.icon + ' **' + pack.label + '**\nSurvival Coins -' + pack.cost + '\n' + rewardsText(pack.rewards))] });
}
async function cmdHuntShop(i){
  const u = await ensureUser(i.user);
  const coins = getMetaResource(u,'huntCoins');
  return i.reply({ embeds:[new EmbedBuilder().setTitle('🏹 Hunt Shop').setColor(0xf59e0b).setDescription(['Hunt Coins: **' + money(coins) + '**','', ...shopLines(HUNT_COIN_SHOP,'Hunt Coins'),'','Use `/hunt-buy item:<item>`.'].join('\n').slice(0,3900))] });
}
async function cmdHuntBuy(i){
  const item = i.options.getString('item', true);
  const pack = HUNT_COIN_SHOP[item];
  if(!pack) return i.reply({ content:'Invalid item.', ephemeral:true });
  const u = await ensureUser(i.user);
  const coins = getMetaResource(u,'huntCoins');
  if(coins < pack.cost) return i.reply({ content:'Need **' + pack.cost + ' Hunt Coins**. You have **' + coins + '**.', ephemeral:true });
  await spendResource(i.user.id,'huntCoins', pack.cost);
  if(pack.rewards){ await grantModeRewards(i.user.id, pack.rewards); return i.reply({ embeds:[new EmbedBuilder().setTitle('Hunt Shop').setColor(0xf59e0b).setDescription(pack.icon + ' **' + pack.label + '**\nHunt Coins -' + pack.cost + '\n' + rewardsText(pack.rewards))] }); }
  const meta = metaOf(u);
  if(!meta.hunt) return i.reply({ content:'No active Hunt run. Start a Hunt first.', ephemeral:true });
  const buffMap = { heal:{name:'Field Potion',stats:{hp:35}}, compass:{name:'Lucky Compass',stats:{resources:20}}, guard:{name:'Iron Guard',stats:{def:25}}, flask:{name:'Energy Flask',stats:{atk:15}}, revive:{name:'Revive Charm',stats:{revive:1}} };
  const buff = buffMap[pack.effect];
  if(buff) await updateMeta(i.user.id, m => { m.hunt.buffs=[...(m.hunt.buffs||[]),{id:pack.effect,name:buff.name,rarity:'SHOP',buff:pack.desc,debuff:'No debuff',stats:buff.stats}]; return m; });
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Hunt Shop').setColor(0xf59e0b).setDescription(pack.icon + ' **' + pack.label + '** applied!\nHunt Coins -' + pack.cost)] });
}
async function cmdGift(i){
  const target = i.options.getUser('user', true);
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  if(target.id === i.user.id) return i.reply({ content:'You cannot gift to yourself.', ephemeral:true });
  await ensureUser(target);
  await prisma.teamSlot.deleteMany({ where:{ cardId:card.id } }).catch(()=>{});
  await prisma.userEquipment.updateMany({ where:{ cardId:card.id }, data:{ userId:target.id } }).catch(()=>{});
  await prisma.userCard.update({ where:{ id:card.id }, data:{ userId:target.id } });
  return i.reply(`Gift sent: **${card.character.name}** → ${target}.`);
}
async function cmdTrade(i){
  const target = i.options.getUser('user', true);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Trade Request').setColor(0x2563eb).setDescription(`${i.user} wants to trade with ${target}.\\nUse /gift for direct card transfer until both-sided confirmations are enabled.`)] });
}
async function cmdQuickSell(i){
  const rarity = i.options.getString('rarity', true);
  const cards = await prisma.userCard.findMany({ where:{ userId:i.user.id, character:{ rarity } }, include:{ character:true } });
  if(!cards.length) return i.reply({ content:`No ${rarity} cards found.`, ephemeral:true });
  const values = { COMMON:25, RARE:75, EPIC:200, LEGENDARY:600, MYTHIC:1500, DIVINE:4000, SECRET:10000 };
  const gold = (values[rarity] || 25) * cards.length;
  await prisma.teamSlot.deleteMany({ where:{ cardId:{ in:cards.map(c=>c.id) } } }).catch(()=>{});
  await prisma.userEquipment.deleteMany({ where:{ cardId:{ in:cards.map(c=>c.id) } } }).catch(()=>{});
  await prisma.userCard.deleteMany({ where:{ id:{ in:cards.map(c=>c.id) } } });
  await addResource(i.user.id,'gold',gold);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Quick Sell Complete').setColor(0xf59e0b).setDescription(`${rarity} cards sold: **${cards.length}**\\nGold +${money(gold)}`)] });
}


async function cmdShards(i){
  const u = await ensureUser(i.user);
  const shards = getMetaResource(u, 'cardShards');
  const e = new EmbedBuilder().setTitle('Card Shards').setColor(0xa371f7).setDescription([
    `Card Shards: **${money(shards)}**`,
    '',
    'Card Shards come from duplicate pulls or `/auto-shard`.',
    '',
    '**Duplicate value**',
    'COMMON +1 • RARE +3 • EPIC +8',
    'LEGENDARY +20 • MYTHIC +45 • DIVINE +100 • SECRET +250',
    '',
    'Use `/shard-shop` to spend shards.'
  ].join('\n'));
  return i.reply({ embeds:[e] });
}
async function cmdShardShop(i){
  const u = await ensureUser(i.user);
  const shards = getMetaResource(u, 'cardShards');
  const e = new EmbedBuilder().setTitle('Shard Shop').setColor(0xa371f7).setDescription([
    `Card Shards: **${money(shards)}**`,
    '',
    '**Items**',
    'premium-roll — 120 shards → Premium Rolls +1',
    'event-fragments — 200 shards → Corrupted Fragments +500',
    'relics — 80 shards → Relic Stones +5',
    'traits — 80 shards → Trait Stones +5',
    'essence — 50 shards → Essence +100',
    'rolls — 40 shards → Normal Rolls +10',
    '',
    'Use `/shard-buy item:<item> amount:<amount>`.'
  ].join('\n'));
  return i.reply({ embeds:[e] });
}
async function cmdShardBuy(i){
  const item = i.options.getString('item', true);
  const amount = clamp(i.options.getInteger('amount') || 1, 1, 50);
  const shop = {
    'premium-roll': { cost:120, rewards:{ premiumRolls:1 }, label:'Premium Roll' },
    'event-fragments': { cost:200, rewards:{ corruptedFragments:500 }, label:'Corrupted Fragments' },
    'relics': { cost:80, rewards:{ relicStones:5 }, label:'Relic Stones' },
    'traits': { cost:80, rewards:{ traitStones:5 }, label:'Trait Stones' },
    'essence': { cost:50, rewards:{ essence:100 }, label:'Essence' },
    'rolls': { cost:40, rewards:{ rolls:10 }, label:'Normal Rolls' }
  };
  const pack = shop[item];
  if(!pack) return i.reply({ content:'Invalid shard shop item.', ephemeral:true });
  const totalCost = pack.cost * amount;
  const ok = await spendResource(i.user.id, 'cardShards', totalCost);
  if(!ok) return i.reply({ content:`Need ${money(totalCost)} Card Shards.`, ephemeral:true });
  const rewards = {};
  for(const [k,v] of Object.entries(pack.rewards)) rewards[k] = v * amount;
  await grantModeRewards(i.user.id, rewards);
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Shard Shop Purchase').setColor(0xa371f7).setDescription(`Card Shards -${money(totalCost)}\n${rewardsText(rewards)}`)] });
}
async function cmdAutoShard(i){
  const keepRarity = i.options.getString('keep_rarity') || 'SECRET';
  const rarityRank = { COMMON:1, RARE:2, EPIC:3, LEGENDARY:4, MYTHIC:5, DIVINE:6, SECRET:7 };
  const keepRank = rarityRank[keepRarity] || 7;
  const cards = await prisma.userCard.findMany({
    where:{ userId:i.user.id },
    include:{ character:true },
    orderBy:[{ power:'desc' }, { obtainedAt:'asc' }]
  });
  const byChar = new Map();
  for(const card of cards){
    if(!byChar.has(card.characterId)) byChar.set(card.characterId, []);
    byChar.get(card.characterId).push(card);
  }
  const toShard = [];
  for(const list of byChar.values()){
    if(list.length <= 1) continue;
    list.sort((a,b)=>Number(b.power||0)-Number(a.power||0));
    for(const card of list.slice(1)){
      // Keep duplicates of very high rarity if user chose a low keep threshold.
      if((rarityRank[card.character.rarity] || 1) >= keepRank) continue;
      toShard.push(card);
    }
  }
  if(!toShard.length){
    return i.reply({ content:'No duplicate cards available for auto-shard with your current keep setting.', ephemeral:true });
  }
  let shards = 0;
  for(const card of toShard) shards += shardValueByRarity(card.character.rarity);
  const ids = toShard.map(c=>c.id);
  await prisma.teamSlot.deleteMany({ where:{ cardId:{ in:ids } } }).catch(()=>{});
  await prisma.userEquipment.deleteMany({ where:{ cardId:{ in:ids } } }).catch(()=>{});
  await prisma.userCard.deleteMany({ where:{ id:{ in:ids } } });
  await addResource(i.user.id, 'cardShards', shards);
  const byRarity = {};
  for(const card of toShard) byRarity[card.character.rarity] = (byRarity[card.character.rarity] || 0) + 1;
  const lines = Object.entries(byRarity).map(([r,c])=>`${r}: ${c}`).join('\n');
  return i.reply({ embeds:[new EmbedBuilder().setTitle('Auto Shard Complete').setColor(0xa371f7).setDescription(`Cards converted: **${toShard.length}**\nCard Shards +${money(shards)}\n\n${lines}`)] });
}

/* ---------- Admin ---------- */
async function cmdAdminGive(i){
  if(!isAdmin(i.user.id)) return i.reply({ content:'Admin only.', ephemeral:true });
  const target = i.options.getUser('user', true), resource = i.options.getString('resource', true), amount = i.options.getInteger('amount', true);
  await ensureUser(target); await addResource(target.id, resource, amount);
  return i.reply(`Admin: gave **${money(amount)} ${resource}** to ${target}.`);
}
async function cmdAdminGiveCard(i){
  if(!isAdmin(i.user.id)) return i.reply({ content:'Admin only.', ephemeral:true });
  const target = i.options.getUser('user', true), name = i.options.getString('name', true);
  await ensureUser(target); const c = await findCharacter(name);
  if(!c) return i.reply({ content:'Character not found.', ephemeral:true });
  const card = await grantCard(target.id, c);
  return i.reply(`Admin: gave **${c.name}** to ${target} (${card.id}).`);
}
async function cmdAdminResetUser(i){
  if(!isAdmin(i.user.id)) return i.reply({ content:'Admin only.', ephemeral:true });
  const target = i.options.getUser('user', true);
  await prisma.teamSlot.deleteMany({ where:{ userId:target.id } });
  await prisma.userEquipment.deleteMany({ where:{ userId:target.id } });
  await prisma.userCard.deleteMany({ where:{ userId:target.id } });
  await prisma.user.upsert({ where:{ id:target.id }, update:{ gold:1000n, tokens:0, gems:0, essence:0, voidCrystals:0, rolls:30, meta:{ resources:{ premiumRolls:0, eventRolls:0 } } }, create:{ id:target.id, username:target.username, gold:1000n, rolls:30, meta:{ resources:{ premiumRolls:0, eventRolls:0 } } } });
  return i.reply(`Admin: reset ${target}.`);
}
async function cmdAdminResetGame(i){
  if(!isAdmin(i.user.id)) return i.reply({ content:'Admin only.', ephemeral:true });
  await prisma.teamSlot.deleteMany({});
  await prisma.userEquipment.deleteMany({});
  await prisma.userCard.deleteMany({});
  await prisma.marketListing.deleteMany({}).catch(()=>{});
  await prisma.bossEventEntry.deleteMany({}).catch(()=>{});
  await prisma.bossEvent.deleteMany({}).catch(()=>{});
  await prisma.user.updateMany({ data:{ gold:1000n, tokens:0, gems:0, essence:0, voidCrystals:0, rolls:30, meta:{ resources:{ premiumRolls:0, eventRolls:0 } } } });
  return i.reply('Admin: game player data reset. Characters remain seeded.');
}

/* ---------- Route ---------- */
async function route(i){
  const c = i.commandName;
  if(c==='help') return cmdHelp(i);
  if(c==='profile'||c==='wallet') return cmdProfile(i);
  if(c==='daily') return cmdDaily(i);
  if(c==='rates') return cmdRates(i);
  if(c==='rarity') return cmdRarity(i);
  if(c==='characters-count') return cmdCharactersCount(i);
  if(c==='banner') return cmdBanner(i);
  if(c==='fragments') return cmdFragments(i);
  if(c==='fragment-roll') return fragmentRollMany(i);
  if(c==='sacrifice-rolls') return cmdSacrifice(i);
  if(c==='roll') return rollMany(i,'normal');
  if(c==='premium-roll') return rollMany(i,'premium');
  if(c==='event-roll') return rollMany(i,'event');
  if(c==='anime') return cmdAnime(i);
  if(c==='character') return cmdCharacter(i);
  if(c==='variants') return cmdVariants(i);
  if(c==='my-card'||c==='view-card') return cmdMyCard(i);
  if(c==='inventory') return cmdInventory(i);
  if(c==='train') return cmdTrain(i);
  if(c==='gear') return cmdGear(i);
  if(c==='gear-upgrade') return cmdGearUpgrade(i);
  if(c==='skill-tree') return cmdSkillTree(i);
  if(c==='skill-upgrade') return cmdSkillUpgrade(i);
  if(c==='auto-formation') return cmdAutoFormation(i);
  if(c==='formation') return cmdFormation(i);
  if(c==='formation-set') return cmdFormationSet(i);
  if(c==='hunt') return cmdHunt(i, i.options.getString('zone'), i.options.getInteger('formation') || 1);
  if(c==='hunt-next') return cmdHuntNext(i);
  if(c==='survival') return cmdSurvival(i);
  if(c==='dungeon') return startDungeonLike(i,'dungeon');
  if(c==='gate') return startDungeonLike(i,'gate');
  if(c==='corrupted-raid') return cmdRaid(i);
  if(c==='raid-attack') return cmdRaidAttack(i);
  if(c==='raid-rank') return cmdRaidRank(i);
  if(c==='zone-mastery') return cmdZoneMastery(i);
  if(c==='events') return cmdEvents(i);
  if(c==='achievements') return cmdAchievements(i);
  if(c==='claim-achievement') return cmdClaimAchievement(i);
  if(c==='rival') return cmdRival(i);
  if(c==='hunt-achievements') return cmdHuntAchievements(i);
  if(c==='hunt-claim') return cmdHuntClaim(i);
  if(c==='arena') return cmdArena(i);
  if(c==='abyss-tower') return cmdAbyssTower(i);
  if(c==='missions') return cmdMissions(i);
  if(c==='void-rift') return cmdVoidRift(i);
  if(c==='blitz') return cmdBlitz(i);
  if(c==='gacha-dungeon') return cmdGachaDungeon(i);
  if(c==='gacha-dungeon-next') return cmdGachaDungeonNext(i);
  if(c==='nightmare') return cmdNightmare(i);
  if(c==='weekly-challenge') return cmdWeeklyChallenge(i);
  if(c==='void-trial') return cmdVoidTrial(i);
  if(c==='ascend') return cmdAscend(i);
  if(c==='relics') return i.reply({ embeds:[new EmbedBuilder().setTitle('Relics').setColor(0x0891b2).setDescription('Relic Stones upgrade Gear. Use `/gear` and `/gear-upgrade`.')] });
  if(c==='traits') return i.reply({ embeds:[new EmbedBuilder().setTitle('Traits').setColor(0x9333ea).setDescription('Trait Stones are used for trait rerolls and passive growth. They are part of card progression.')] });
  if(c==='token-shop') return cmdTokenShop(i);
  if(c==='token-buy') return cmdTokenBuy(i);
  if(c==='survival-shop') return cmdSurvivalShop(i);
  if(c==='survival-buy') return cmdSurvivalBuy(i);
  if(c==='hunt-shop') return cmdHuntShop(i);
  if(c==='hunt-buy') return cmdHuntBuy(i);
  if(c==='gift') return cmdGift(i);
  if(c==='trade') return cmdTrade(i);
  if(c==='quick-sell') return cmdQuickSell(i);
  if(c==='shards') return cmdShards(i);
  if(c==='shard-shop') return cmdShardShop(i);
  if(c==='shard-buy') return cmdShardBuy(i);
  if(c==='auto-shard') return cmdAutoShard(i);
  if(c==='event-shop') return i.reply({ embeds:[new EmbedBuilder().setTitle('Corrupted Event Shop').setColor(0x6d28d9).setDescription('Corrupted Fragments buy Event Rolls and event resources.\n1 Event Roll = 5,000 Corrupted Fragments.')] });
  if(c==='admin-give') return cmdAdminGive(i);
  if(c==='admin-give-card') return cmdAdminGiveCard(i);
  if(c==='admin-reset-user') return cmdAdminResetUser(i);
  if(c==='admin-reset-game') return cmdAdminResetGame(i);
  return i.reply({ content:'Command unavailable.', ephemeral:true });
}


// ═══════════════════════════════════════════════════════════════
// NEW GAME MODES
// ═══════════════════════════════════════════════════════════════

// ── ARENA PvP ────────────────────────────────────────────────────
async function cmdArena(i){
  await i.deferReply();
  const opponent = i.options.getUser('opponent', true);
  if(opponent.id === i.user.id) return i.editReply({ content:'You cannot fight yourself.', ephemeral:true });
  if(opponent.bot) return i.editReply({ content:'You cannot fight a bot.', ephemeral:true });

  let myCards = await formationCards(i.user.id, 1);
  let theirCards = await formationCards(opponent.id, 1);
  if(!myCards.length){ await autoFormation(i.user.id); myCards = await formationCards(i.user.id, 1); }
  if(!theirCards.length) return i.editReply({ content:`${opponent.username} has no formation set up yet.` });

  const myPower = teamPower(myCards);
  const theirPower = teamPower(theirCards);
  const fight = combat(myCards, `${opponent.username}'s Team`, theirPower);

  const win = fight.win;
  const rewards = win
    ? { tokens: 80, gold: 15000, cardShards: 3 }
    : { tokens: 20, gold: 3000 };

  await grantModeRewards(i.user.id, rewards);

  const e = new EmbedBuilder()
    .setTitle(`⚔️ Arena — ${i.user.username} vs ${opponent.username}`)
    .setColor(win ? 0x22c55e : 0xef4444)
    .setDescription([
      `**Your Power:** ${money(myPower)}  vs  **Their Power:** ${money(theirPower)}`,
      '',
      ...fight.log.slice(0, 12),
      '',
      win ? `🏆 **Victory!** +${money(rewards.tokens)} Tokens +${money(rewards.gold)} Gold` : `💀 **Defeated.** +${money(rewards.tokens)} Tokens`
    ].join('\n').slice(0, 3900));

  return i.editReply({ embeds:[e] });
}

// ── ABYSS TOWER ───────────────────────────────────────────────────
async function cmdAbyssTower(i){
  await i.deferReply();
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const floor = Number(meta.towerFloor || 1);

  let cards = await formationCards(i.user.id, 1);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id, 1); }
  if(!cards.length) return i.editReply({ content:'You need cards first. Use /roll then /auto-formation.' });

  const enemyPower = Math.floor(8000 * Math.pow(1.08, floor));
  const bossFloor = floor % 10 === 0;
  const enemyName = bossFloor ? `Floor ${floor} Boss` : `Abyss Floor ${floor} Guardian`;
  const fight = combat(cards, enemyName, enemyPower * (bossFloor ? 2.5 : 1));

  const rewards = fight.win ? {
    gold: Math.floor(500 + floor * 180),
    tokens: Math.floor(5 + floor * 1.5),
    essence: Math.floor(floor / 3),
    ...(bossFloor ? { premiumRolls: 1, traitStones: Math.floor(floor/10) } : {}),
    ...(floor >= 50 ? { voidCrystals: 1 } : {}),
    ...(floor >= 100 ? { eventRolls: 1 } : {})
  } : {};

  if(fight.win){
    const newFloor = Math.min(100, floor + 1);
    await updateMeta(i.user.id, m => { m.towerFloor = newFloor; return m; });
    await grantModeRewards(i.user.id, rewards);
  }

  const e = new EmbedBuilder()
    .setTitle(`🌊 Abyss Tower — Floor ${floor}${bossFloor ? ' 👑 BOSS' : ''}`)
    .setColor(bossFloor ? 0x7c3aed : 0x6366f1)
    .setDescription([
      `**Your Power:** ${money(teamPower(cards))}  vs  **Enemy:** ${money(enemyPower)}`,
      bossFloor ? '**⚠️ BOSS FLOOR — Defeat for a guaranteed Premium Roll!**' : '',
      '',
      ...fight.log.slice(0, 10),
      '',
      fight.win
        ? [`✅ **Floor ${floor} Cleared!** → Now on Floor **${Math.min(100, floor+1)}**`, rewardsText(cleanRewards(rewards))].join('\n')
        : `❌ **Defeated at Floor ${floor}.** Your progress is saved. Try again with a stronger team.`
    ].filter(Boolean).join('\n').slice(0, 3900));

  return i.editReply({ embeds:[e] });
}

// ── DAILY MISSIONS ────────────────────────────────────────────────
const MISSION_POOL = [
  { id:'hunt3',    text:'Win 3 Hunt rooms',              req:3,  reward:{ tokens:120, gold:8000 } },
  { id:'roll5',    text:'Roll 5 times (any type)',        req:5,  reward:{ essence:30, tokens:80 } },
  { id:'train1',   text:'Train a card 1 time',           req:1,  reward:{ gold:15000, tokens:60 } },
  { id:'raid1',    text:'Attack the Raid Boss once',     req:1,  reward:{ corruptedFragments:800, tokens:100 } },
  { id:'survive5', text:'Survive 5 Survival waves',      req:5,  reward:{ survivalCoins:15, tokens:80 } },
  { id:'gear1',    text:'Upgrade a gear slot once',      req:1,  reward:{ relicStones:3, tokens:100 } },
  { id:'dungeon1', text:'Clear a Dungeon floor',         req:1,  reward:{ tokens:150, essence:25 } },
  { id:'tower3',   text:'Climb 3 Abyss Tower floors',    req:3,  reward:{ tokens:120, voidCrystals:1 } },
];
function todayMissions(){
  const day = Math.floor(Date.now() / 86400000);
  const seed = day * 7;
  const shuffled = [...MISSION_POOL].sort((a,b) => {
    const ha = (seed * 1103515245 + a.id.charCodeAt(0)) % 100;
    const hb = (seed * 1103515245 + b.id.charCodeAt(0)) % 100;
    return ha - hb;
  });
  return shuffled.slice(0, 5);
}
async function cmdMissions(i){
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const missions = todayMissions();
  const progress = meta.missions || {};
  const todayKey = `day_${Math.floor(Date.now()/86400000)}`;
  const todayDone = progress[todayKey] || {};

  const lines = missions.map((m, idx) => {
    const done = Number(todayDone[m.id] || 0);
    const complete = done >= m.req;
    const bar = complete ? '✅' : `${done}/${m.req}`;
    return `${complete ? '✅' : '🔲'} **${m.text}** (${bar}) — ${Object.entries(m.reward).map(([k,v])=>`${title(k)} +${money(v)}`).join(', ')}`;
  });

  const allDone = missions.every(m => Number(todayDone[m.id]||0) >= m.req);

  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🎯 Daily Missions')
    .setColor(allDone ? 0x22c55e : 0x3b82f6)
    .setDescription([
      allDone ? '**🎉 All missions complete for today!**' : 'Complete missions for bonus rewards. Resets daily.',
      '',
      ...lines
    ].join('\n'))] });
}

async function completeMission(userId, missionId, amount=1){
  const missions = todayMissions();
  const m = missions.find(x => x.id === missionId);
  if(!m) return;
  const todayKey = `day_${Math.floor(Date.now()/86400000)}`;
  await updateMeta(userId, meta => {
    meta.missions = meta.missions || {};
    meta.missions[todayKey] = meta.missions[todayKey] || {};
    const prev = Number(meta.missions[todayKey][missionId] || 0);
    if(prev >= m.req) return meta; // already done
    const newVal = Math.min(m.req, prev + amount);
    meta.missions[todayKey][missionId] = newVal;
    if(newVal >= m.req && prev < m.req){
      // Grant reward async (fire and forget)
      grantModeRewards(userId, m.reward).catch(()=>{});
    }
    return meta;
  });
}

// ── VOID RIFT (weekly event) ──────────────────────────────────────
async function cmdVoidRift(i){
  await i.deferReply();
  // Void Rift opens every Sunday-Monday (48 hours)
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const isOpen = day === 0 || day === 1;

  if(!isOpen){
    const daysUntil = day === 0 ? 0 : 7 - day;
    return i.editReply({ embeds:[new EmbedBuilder()
      .setTitle('🔥 Void Rift — Closed')
      .setColor(0x374151)
      .setDescription(`The Void Rift is only open **Sunday & Monday** each week.\nOpens in **${daysUntil} days**.`)] });
  }

  let cards = await formationCards(i.user.id, 1);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id, 1); }
  if(!cards.length) return i.editReply({ content:'You need cards first.' });

  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const weekKey = `rift_week_${Math.floor(Date.now() / (7*24*3600*1000))}`;
  const attemptsThisWeek = Number(meta[weekKey] || 0);
  const MAX_ATTEMPTS = 3;

  if(attemptsThisWeek >= MAX_ATTEMPTS){
    return i.editReply({ embeds:[new EmbedBuilder()
      .setTitle('🔥 Void Rift — Limit Reached')
      .setColor(0x374151)
      .setDescription(`You've used all **${MAX_ATTEMPTS}** Void Rift attempts this week.\nComes back next Sunday.`)] });
  }

  const riftPower = Math.floor(teamPower(cards) * (1.8 + attemptsThisWeek * 0.4));
  const fight = combat(cards, `Void Rift Aberration Lv.${attemptsThisWeek+1}`, riftPower);

  await updateMeta(i.user.id, m => { m[weekKey] = attemptsThisWeek + 1; return m; });

  const rewards = fight.win ? {
    corruptedFragments: Math.floor(2500 + attemptsThisWeek * 1500),
    voidCrystals: 2 + attemptsThisWeek,
    eventRolls: attemptsThisWeek >= 2 ? 1 : 0,
    traitStones: 3 + attemptsThisWeek * 2
  } : {
    corruptedFragments: 500,
    voidCrystals: 1
  };

  await grantModeRewards(i.user.id, cleanRewards(rewards));

  return i.editReply({ embeds:[new EmbedBuilder()
    .setTitle(`🔥 Void Rift — Attempt ${attemptsThisWeek+1}/${MAX_ATTEMPTS}`)
    .setColor(fight.win ? 0x7c3aed : 0xef4444)
    .setDescription([
      `**Rift Power:** ${money(riftPower)}  •  **Your Power:** ${money(teamPower(cards))}`,
      '',
      ...fight.log.slice(0, 10),
      '',
      fight.win ? `✅ **Void Rift Cleared!**\n${rewardsText(cleanRewards(rewards))}` : `❌ **Defeated.** Consolation rewards granted.\n${rewardsText(cleanRewards(rewards))}`
    ].join('\n').slice(0, 3900))] });
}

// ── BLITZ MODE ────────────────────────────────────────────────────
async function cmdBlitz(i){
  await i.deferReply();
  let cards = await formationCards(i.user.id, 1);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id, 1); }
  if(!cards.length) return i.editReply({ content:'You need cards first.' });

  const power = teamPower(cards);
  let wave = 1, total = { gold:0, tokens:0, blitzCoins:0 };
  const logs = [];
  const MAX_WAVES = 30;

  while(wave <= MAX_WAVES){
    const enemyPower = Math.floor(power * (0.4 + wave * 0.08));
    const fight = combat(cards, `Blitz Wave ${wave}`, enemyPower);
    if(!fight.win){ logs.push(`⚡ Stopped at Wave **${wave}**`); break; }
    total.gold += 200 + wave * 60;
    total.tokens += Math.floor(wave / 2);
    total.blitzCoins += 1 + Math.floor(wave / 5);
    if(wave % 5 === 0) logs.push(`✅ Wave **${wave}** cleared`);
    wave++;
  }

  if(wave > MAX_WAVES) logs.push(`🏆 **MAX WAVES CLEARED!**`);
  await grantModeRewards(i.user.id, cleanRewards(total));

  return i.editReply({ embeds:[new EmbedBuilder()
    .setTitle(`⚡ Blitz Mode — Wave ${Math.min(wave, MAX_WAVES)} Reached`)
    .setColor(0xf59e0b)
    .setDescription([
      `**Team Power:** ${money(power)}`,
      '',
      ...logs,
      '',
      '**Rewards**',
      rewardsText(cleanRewards(total))
    ].join('\n').slice(0, 3900))] });
}

// ── GACHA DUNGEON ─────────────────────────────────────────────────
async function cmdGachaDungeon(i){
  const u = await ensureUser(i.user);
  if(getMetaResource(u, 'dungeonKeys') < 1) return i.reply({ content:'You need 1 Dungeon Key.', ephemeral:true });
  await spendResource(i.user.id, 'dungeonKeys', 1);

  // Pick 3 random characters as temp allies
  const pool = await prisma.character.findMany({ where:{ active:true, rarity:{ in:['EPIC','LEGENDARY','MYTHIC'] } }, orderBy:{ basePower:'desc' }, take:100 }).catch(()=>[]);
  const picks = pool.sort(()=>Math.random()-0.5).slice(0,3);

  await updateMeta(i.user.id, m => {
    m.gachaDungeon = { floor:1, tempAllies: picks.map(c=>c.id), createdAt:Date.now() };
    return m;
  });

  const e = new EmbedBuilder()
    .setTitle('🎰 Gacha Dungeon — Floor 1')
    .setColor(0x8b5cf6)
    .setDescription([
      'Three random warriors join your formation for this run!',
      '',
      ...picks.map(c => `${rIcon(c.rarity)} **${c.name}** — ${money(c.basePower)} PWR`),
      '',
      '**Use `/gacha-dungeon-next` to fight with your temp allies.**',
      'All 3 floors must be cleared to claim rewards.'
    ].join('\n'));

  return i.reply({ embeds:[e] });
}

async function cmdGachaDungeonNext(i){
  await i.deferReply();
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const run = meta.gachaDungeon;
  if(!run) return i.editReply({ content:'No active Gacha Dungeon. Use /gacha-dungeon to start.', ephemeral:true });

  const floor = Number(run.floor || 1);
  const tempAllies = await prisma.character.findMany({ where:{ id:{ in: run.tempAllies || [] } } }).catch(()=>[]);
  const myCards = await formationCards(i.user.id, 1);
  const allCards = [...myCards, ...tempAllies.map(c => ({ character:c, power:c.basePower, level:1 }))];

  const enemyPower = Math.floor(35000 * Math.pow(1.4, floor));
  const fight = combat(allCards, `Gacha Floor ${floor} Boss`, enemyPower);

  const rewards = fight.win && floor >= 3 ? {
    gold: 25000,
    tokens: 200,
    essence: 50,
    relicStones: 5,
    rolls: 2
  } : fight.win ? {
    gold: 8000 * floor,
    tokens: 50 * floor
  } : {};

  if(fight.win){
    if(floor >= 3){
      await updateMeta(i.user.id, m => { delete m.gachaDungeon; return m; });
      await grantModeRewards(i.user.id, cleanRewards(rewards));
    } else {
      await updateMeta(i.user.id, m => { m.gachaDungeon.floor = floor + 1; return m; });
    }
  } else {
    await updateMeta(i.user.id, m => { delete m.gachaDungeon; return m; });
  }

  return i.editReply({ embeds:[new EmbedBuilder()
    .setTitle(`🎰 Gacha Dungeon — Floor ${floor}`)
    .setColor(fight.win ? 0x22c55e : 0xef4444)
    .setDescription([
      `**Team Power (with allies):** ${money(teamPower(allCards))}  vs  **Boss:** ${money(enemyPower)}`,
      '',
      ...fight.log.slice(0,10),
      '',
      fight.win
        ? (floor >= 3 ? `🏆 **Gacha Dungeon Complete!**\n${rewardsText(cleanRewards(rewards))}` : `✅ Floor ${floor} cleared! Proceed to Floor ${floor+1} with \`/gacha-dungeon-next\`.`)
        : `❌ **Run Failed at Floor ${floor}.** Dungeon key consumed.`
    ].join('\n').slice(0,3900))] });
}

// ── NIGHTMARE HUNT ────────────────────────────────────────────────
async function cmdNightmare(i){
  await i.deferReply();
  const u = await ensureUser(i.user);
  // Nightmare costs a Gate Key
  if(getMetaResource(u, 'gateKeys') < 1) return i.editReply({ content:'Nightmare Hunt requires 1 Gate Key.', ephemeral:true });
  await spendResource(i.user.id, 'gateKeys', 1);

  let cards = await formationCards(i.user.id, 1);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id, 1); }
  if(!cards.length) return i.editReply({ content:'You need cards first.' });

  const power = teamPower(cards);
  let cleared = 0;
  const rewards = { gold:0, voidCrystals:0, corruptedFragments:0, eventRolls:0, traitStones:0 };
  const logs = [];

  for(let room = 1; room <= 8; room++){
    const enemyPower = Math.floor(power * (1.2 + room * 0.15));
    const fight = combat(cards, `Nightmare Entity ${room}`, enemyPower);
    if(!fight.win){ logs.push(`💀 Fell at Room **${room}**`); break; }
    cleared++;
    rewards.gold += 2000 + room * 800;
    rewards.voidCrystals += room >= 5 ? 1 : 0;
    rewards.corruptedFragments += 200 + room * 100;
    rewards.traitStones += room >= 3 ? 1 : 0;
    if(room === 8) rewards.eventRolls += 1;
    logs.push(`✅ Room **${room}** cleared`);
  }

  await grantModeRewards(i.user.id, cleanRewards(rewards));

  return i.editReply({ embeds:[new EmbedBuilder()
    .setTitle(`🌙 Nightmare Hunt — ${cleared}/8 Rooms`)
    .setColor(0x1e1b4b)
    .setDescription([
      `**Team Power:** ${money(power)}`,
      '',
      ...logs,
      '',
      '**Rewards**',
      rewardsText(cleanRewards(rewards))
    ].join('\n').slice(0,3900))] });
}

// ── WEEKLY CHALLENGE ─────────────────────────────────────────────
const WEEKLY_CHALLENGES = [
  { id:'no_tank',    text:'Clear a Hunt Zone without any TANK in formation',   bonusReward:{ eventRolls:1, voidCrystals:3 } },
  { id:'all_epic',   text:'Clear Survival wave 20 with all-EPIC formation',    bonusReward:{ premiumRolls:2, traitStones:5 } },
  { id:'speed_run',  text:'Clear Dungeon Floor 3 in one attempt',              bonusReward:{ voidCrystals:2, relicStones:8 } },
  { id:'full_power', text:'Deal 5,000,000 total Raid damage in one week',      bonusReward:{ eventRolls:2, corruptedFragments:3000 } },
];
async function cmdWeeklyChallenge(i){
  const weekIdx = Math.floor(Date.now() / (7*24*3600*1000)) % WEEKLY_CHALLENGES.length;
  const challenge = WEEKLY_CHALLENGES[weekIdx];
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const weekKey = `wc_${Math.floor(Date.now()/(7*24*3600*1000))}`;
  const done = meta[weekKey] === true;

  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle(`📅 Weekly Challenge${done ? ' — ✅ Complete' : ''}`)
    .setColor(done ? 0x22c55e : 0xf59e0b)
    .setDescription([
      done ? '**You completed this week challenge!**' : '**Complete for a special bonus reward:**',
      '',
      `📌 **${challenge.text}**`,
      '',
      '**Bonus Reward:**',
      Object.entries(challenge.bonusReward).map(([k,v])=>`${title(k)} +${money(v)}`).join(' • '),
      '',
      done ? 'Come back next week for a new challenge.' : '*Progress is tracked automatically when you play.*'
    ].join('\n'))] });
}

// ── VOID TRIAL ────────────────────────────────────────────────────
async function cmdVoidTrial(i){
  await i.deferReply();
  // Each day features a random powerful character as the trial boss
  const dayIdx = Math.floor(Date.now() / 86400000);
  const trialBosses = ['Goku','Naruto Uzumaki','Ichigo Kurosaki','Madara Uchiha','Sukuna','Saitama','Ainz Ooal Gown','Rimuru Tempest'];
  const bossName = trialBosses[dayIdx % trialBosses.length];

  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const todayKey = `trial_${dayIdx}`;
  if(meta[todayKey]) return i.editReply({ embeds:[new EmbedBuilder().setTitle('🔮 Void Trial — Already Attempted').setColor(0x374151).setDescription(`You already faced **${bossName}** today. Come back tomorrow for a new trial.`)] });

  let cards = await formationCards(i.user.id, 1);
  if(!cards.length){ await autoFormation(i.user.id); cards = await formationCards(i.user.id, 1); }
  if(!cards.length) return i.editReply({ content:'You need cards first.' });

  const bossChar = await prisma.character.findFirst({ where:{ active:true, name:{ contains:bossName, mode:'insensitive' } }, orderBy:{ basePower:'desc' } });
  const bossPower = bossChar ? bossChar.basePower * 3 : teamPower(cards) * 1.5;
  const fight = combat(cards, `Trial: ${bossName}`, bossPower);

  await updateMeta(i.user.id, m => { m[todayKey] = true; return m; });

  const rewards = fight.win
    ? { tokens:250, essence:40, voidCrystals:2, cardShards:10 }
    : { tokens:50, essence:10 };

  await grantModeRewards(i.user.id, cleanRewards(rewards));

  return i.editReply({ embeds:[new EmbedBuilder()
    .setTitle(`🔮 Void Trial — ${bossName}`)
    .setColor(fight.win ? 0x22c55e : 0xef4444)
    .setDescription([
      `**Boss Power:** ${money(bossPower)}  •  **Your Power:** ${money(teamPower(cards))}`,
      '',
      ...fight.log.slice(0,10),
      '',
      fight.win ? `🏆 **Trial Cleared!**\n${rewardsText(cleanRewards(rewards))}` : `❌ **Defeated.** Consolation rewards granted.\n${rewardsText(cleanRewards(rewards))}`
    ].join('\n').slice(0,3900))] });
}

// ── ASCENSION ────────────────────────────────────────────────────
async function cmdAscend(i){
  const card = await findOwnedCard(i.user.id, i.options.getString('card', true));
  if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
  if(card.level < 100) return i.reply({ content:`**${card.character.name}** must be Level 100 to Ascend.\nCurrent level: **${card.level}/100**`, ephemeral:true });

  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const ascensions = Number(meta.ascensions?.[card.id] || 0);
  const MAX_ASCENSIONS = 5;
  if(ascensions >= MAX_ASCENSIONS) return i.reply({ content:`**${card.character.name}** has reached max Ascension (${MAX_ASCENSIONS}).`, ephemeral:true });

  const cost = {
    gold: BigInt(Math.floor(5000000 * Math.pow(2, ascensions))),
    voidCrystals: 5 + ascensions * 5,
    essence: 500 + ascensions * 200
  };

  if(u.gold < cost.gold) return i.reply({ content:`Need **${money(cost.gold)} Gold** to Ascend.\nYou have: **${money(u.gold)}**`, ephemeral:true });
  if(getMetaResource(u,'voidCrystals') < cost.voidCrystals) return i.reply({ content:`Need **${cost.voidCrystals} Void Crystals** to Ascend.`, ephemeral:true });
  if(Number(u.essence) < cost.essence) return i.reply({ content:`Need **${cost.essence} Essence** to Ascend.`, ephemeral:true });

  const newAscension = ascensions + 1;
  const powerBoost = Math.floor(card.character.basePower * 0.35 * newAscension);
  const newPower = card.power + powerBoost;

  await prisma.user.update({ where:{ id:i.user.id }, data:{ gold:{ decrement:cost.gold }, essence:{ decrement:cost.essence } } });
  await spendResource(i.user.id, 'voidCrystals', cost.voidCrystals);
  await updateMeta(i.user.id, m => { m.ascensions = m.ascensions || {}; m.ascensions[card.id] = newAscension; return m; });
  await prisma.userCard.update({ where:{ id:card.id }, data:{ power: newPower, level:1, xp:0 } });

  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle(`💫 Ascension ${newAscension} — ${card.character.name}`)
    .setColor(0x7c3aed)
    .setDescription([
      `**${card.character.name}** has Ascended!`,
      '',
      `Ascension: **${ascensions} → ${newAscension}** / ${MAX_ASCENSIONS}`,
      `Power Boost: **+${money(powerBoost)}**`,
      `New Power: **${money(newPower)}**`,
      `Level reset to **1** — train to 100 again for even greater power.`,
      '',
      `Cost: ${money(cost.gold)} Gold • ${cost.voidCrystals} Void Crystals • ${cost.essence} Essence`
    ].join('\n'))] });
}

// ─────────────────────────────────────────────────────────────────



// ═══════════════════════════════════════════════════════════════
// CURSED ROOMS, RIVAL SYSTEM, EVENT SYSTEM, ACHIEVEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════

// ── CURSED ROOMS ─────────────────────────────────────────────────────────────
const CURSED_ROOMS = [
  { id:'weak_cursed',   name:'Cursed Cache',      desc:'Enemies are weak but rewards are halved. Safe passage.',           enemyMult:0.5,  rewardMult:0.5,  icon:'💀' },
  { id:'hard_cursed',   name:'Cursed Trial',       desc:'Enemies are twice as powerful. Rewards are doubled.',              enemyMult:2.0,  rewardMult:2.0,  icon:'⚠️' },
  { id:'void_cursed',   name:'Void Anomaly',       desc:'Reality tears — enemies deal void damage. Rare loot drops.',       enemyMult:1.6,  rewardMult:1.8,  icon:'🌌' },
  { id:'blood_cursed',  name:'Blood Altar',        desc:'Sacrifice 15% HP for 3x rewards. Your team takes upfront damage.', enemyMult:0.8,  rewardMult:3.0,  hpCost:0.15, icon:'🩸' },
  { id:'ghost_cursed',  name:'Ghost Realm',        desc:'Enemies cannot be executed. But their HP is very low.',            enemyMult:0.3,  rewardMult:1.4,  noExecute:true, icon:'👻' },
];

// ── TIMED EVENTS ─────────────────────────────────────────────────────────────
const TIMED_EVENTS = [
  {
    id:'double_exp',
    name:'EXP Surge',
    icon:'⚡',
    desc:'All Hunt and combat rewards doubled.',
    effect:'doubleRewards',
    // Day 1-3 of each month
    isActive(){ const d=new Date(); return d.getUTCDate()<=3; }
  },
  {
    id:'corrupted_surge',
    name:'Corrupted Surge',
    icon:'🌑',
    desc:'Corrupted Fragment rewards tripled from all sources.',
    effect:'tripleFragments',
    // Days 14-17
    isActive(){ const d=new Date(); return d.getUTCDate()>=14 && d.getUTCDate()<=17; }
  },
  {
    id:'void_weekend',
    name:'Void Weekend',
    icon:'🌌',
    desc:'Void Crystal drops doubled in all game modes.',
    effect:'doubleVoid',
    // Saturday and Sunday
    isActive(){ const d=new Date(); return d.getUTCDay()===0||d.getUTCDay()===6; }
  },
  {
    id:'anniversary',
    name:'VoidRoll Anniversary',
    icon:'🎉',
    desc:'Double all rewards for 3 days. Login for a free Premium Roll!',
    effect:'anniversary',
    // Days 25-27
    isActive(){ const d=new Date(); return d.getUTCDate()>=25 && d.getUTCDate()<=27; }
  }
];

function getActiveEvents(){
  return TIMED_EVENTS.filter(e => e.isActive());
}

async function cmdEvents(i){
  const active = getActiveEvents();
  const upcoming = TIMED_EVENTS.filter(e => !e.isActive());
  const lines = [];
  if(active.length){
    lines.push('**🟢 Active Events**');
    for(const e of active) lines.push(e.icon + ' **' + e.name + '** — ' + e.desc);
    lines.push('');
  }
  if(upcoming.length){
    lines.push('**📅 Upcoming Events**');
    for(const e of upcoming) lines.push(e.icon + ' ' + e.name + ' — ' + e.desc);
  }
  if(!active.length && !upcoming.length) lines.push('No events scheduled right now. Check back soon!');

  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🗓️ VoidRoll Events')
    .setColor(active.length ? 0x22c55e : 0x374151)
    .setDescription(lines.join('\n'))] });
}

// ── GLOBAL ACHIEVEMENT SYSTEM ─────────────────────────────────────────────────
const GLOBAL_ACHIEVEMENTS = [
  { id:'first_pull',    text:'Pull your first character',            req:1,   key:'totalPulls',    reward:{ rolls:5, tokens:100 } },
  { id:'collector_100', text:'Own 100 unique characters',           req:100, key:'uniqueCards',   reward:{ premiumRolls:1, tokens:500 } },
  { id:'collector_500', text:'Own 500 unique characters',           req:500, key:'uniqueCards',   reward:{ eventRolls:1, voidCrystals:3 } },
  { id:'first_divine',  text:'Pull your first DIVINE character',    req:1,   key:'divinePulls',   reward:{ tokens:1000, essence:100 } },
  { id:'first_secret',  text:'Pull your first SECRET character',    req:1,   key:'secretPulls',   reward:{ voidCrystals:5, tokens:2000 } },
  { id:'max_level',     text:'Reach Level 100 on any card',         req:1,   key:'maxLevelCards', reward:{ premiumRolls:2, voidCrystals:2 } },
  { id:'ascended',      text:'Ascend any card',                     req:1,   key:'ascensions',    reward:{ voidCrystals:5, eventRolls:1 } },
  { id:'raider',        text:'Deal damage in 10 Raids',             req:10,  key:'raidAttacks',   reward:{ corruptedFragments:3000, tokens:500 } },
  { id:'tower_50',      text:'Reach Abyss Tower Floor 50',          req:50,  key:'towerFloorMax', reward:{ eventRolls:1, premiumRolls:2 } },
  { id:'tower_100',     text:'Conquer Abyss Tower Floor 100',       req:100, key:'towerFloorMax', reward:{ eventRolls:3, voidCrystals:10 } },
  { id:'wealthy',       text:'Accumulate 10,000,000 Gold total',    req:10000000, key:'goldEarned', reward:{ tokens:1000, premiumRolls:1 } },
  { id:'arena_10',      text:'Win 10 Arena battles',                req:10,  key:'arenaWins',     reward:{ tokens:500, premiumRolls:1 } },
];

async function cmdAchievements(i){
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const lines = GLOBAL_ACHIEVEMENTS.map(a => {
    const prog = Number(meta[a.key] || 0);
    const done = prog >= a.req;
    const claimed = meta['gach_'+a.id] === true;
    const bar = done ? '█████' : '░'.repeat(5).split('').map((_,idx) => idx < Math.floor((prog/a.req)*5) ? '█' : '░').join('');
    return (claimed?'✅':done?'🎁':'🔲') + ' **' + a.text + '** ' + bar + ' (' + Math.min(prog,a.req).toLocaleString() + '/' + Number(a.req).toLocaleString() + ')' +
      (done && !claimed ? ' — Use `/claim-achievement ' + a.id + '`' : '');
  });
  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🏆 Achievements')
    .setColor(0xf59e0b)
    .setDescription(lines.join('\n').slice(0,3900))] });
}

async function cmdClaimAchievement(i){
  const achId = i.options.getString('achievement', true);
  const ach = GLOBAL_ACHIEVEMENTS.find(a => a.id === achId);
  if(!ach) return i.reply({ content:'Unknown achievement ID.', ephemeral:true });
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  if(meta['gach_'+achId]) return i.reply({ content:'Already claimed!', ephemeral:true });
  const prog = Number(meta[ach.key] || 0);
  if(prog < ach.req) return i.reply({ content:'Not completed yet. Progress: ' + prog.toLocaleString() + '/' + Number(ach.req).toLocaleString(), ephemeral:true });
  await updateMeta(i.user.id, m => { m['gach_'+achId] = true; return m; });
  await grantModeRewards(i.user.id, ach.reward);
  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🏆 Achievement Unlocked!')
    .setColor(0xf59e0b)
    .setDescription('**' + ach.text + '**\n' + rewardsText(ach.reward))] });
}

// ── RIVAL SYSTEM ─────────────────────────────────────────────────────────────
async function cmdRival(i){
  await i.deferReply();
  // Pick a random active player as rival
  const allUsers = await prisma.user.findMany({ take:50, orderBy:{ updatedAt:'desc' } });
  const u = await ensureUser(i.user);
  const rivals = allUsers.filter(x => x.id !== u.id);
  if(!rivals.length) return i.editReply({ content:'No rivals found yet. More players needed!', ephemeral:true });

  const rival = rivals[Math.floor(Math.random() * Math.min(rivals.length, 10))];
  const myCards = await formationCards(i.user.id, 1);
  const theirCards = await formationCards(rival.id, 1);
  if(!myCards.length) return i.editReply({ content:'Set up your formation first with /auto-formation.' });
  if(!theirCards.length) return i.editReply({ content:'Your rival has no formation yet. Try challenging someone else.' });

  const myPow = teamPower(myCards);
  const theirPow = teamPower(theirCards);
  const fight = combat(myCards, (rival.username || 'Rival') + "'s Team", theirPow);

  const win = fight.win;
  const rewards = win
    ? { tokens:150, gold:20000, huntCoins:10 }
    : { tokens:30, gold:5000 };

  await grantModeRewards(i.user.id, rewards);
  if(win) await updateMeta(i.user.id, m => { m.arenaWins = (Number(m.arenaWins||0)) + 1; return m; });

  return i.editReply({ embeds:[new EmbedBuilder()
    .setTitle('⚔️ Rival Challenge — ' + (rival.username || 'Unknown Player'))
    .setColor(win ? 0x22c55e : 0xef4444)
    .setDescription([
      '**Your Power:** ' + money(myPow) + '  vs  **Rival Power:** ' + money(theirPow),
      '',
      ...fight.log.slice(0,10),
      '',
      win
        ? '🏆 **Victory!** ' + rewardsText(rewards)
        : '💀 **Defeated.** ' + rewardsText(rewards)
    ].join('\n').slice(0,3900))] });
}

// ── ZONE MASTERY ─────────────────────────────────────────────────────────────
async function cmdZoneMastery(i){
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const lines = HUNT_ZONES.map(z => {
    const runs = Number(meta['mastery_'+z.id] || 0);
    const tier = runs >= 100 ? '💎 Master' : runs >= 50 ? '🔮 Expert' : runs >= 20 ? '🔹 Skilled' : runs >= 5 ? '🪨 Novice' : '○ Unranked';
    const bonus = runs >= 100 ? '+50% rewards' : runs >= 50 ? '+30% rewards' : runs >= 20 ? '+15% rewards' : runs >= 5 ? '+5% rewards' : 'No bonus';
    return tier + ' **' + z.name + '** — ' + runs + ' runs — ' + bonus;
  });
  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🏆 Zone Mastery')
    .setColor(0x7c3aed)
    .setDescription(['Run zones to increase mastery and earn permanent reward bonuses.','', ...lines].join('\n'))] });
}

// ── HUNT ACHIEVEMENTS ─────────────────────────────────────────────────────────
const HUNT_ACHIEVEMENTS = [
  { id:'first_blood',   text:'Win your first Hunt room',        req:1,   key:'huntWins',    reward:{ tokens:100 } },
  { id:'veteran',       text:'Win 50 Hunt rooms',               req:50,  key:'huntWins',    reward:{ premiumRolls:1, tokens:300 } },
  { id:'legend',        text:'Win 200 Hunt rooms',              req:200, key:'huntWins',    reward:{ eventRolls:1, voidCrystals:3 } },
  { id:'no_damage',     text:'Clear 10 rooms without damage',   req:10,  key:'huntNoDmg',   reward:{ tokens:500, essence:50 } },
  { id:'boss_slayer',   text:'Defeat 20 Boss Rooms',            req:20,  key:'huntBosses',  reward:{ premiumRolls:2, voidCrystals:2 } },
  { id:'wanted_hunter', text:'Complete Wanted Board 5 times',   req:5,   key:'wantedDone',  reward:{ tokens:800, corruptedFragments:2000 } },
  { id:'combo_master',  text:'Reach Combo x10 in a single run', req:10,  key:'maxCombo',    reward:{ voidCrystals:5, eventRolls:1 } },
];
async function cmdHuntAchievements(i){
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  const lines = HUNT_ACHIEVEMENTS.map(a => {
    const prog = Number(meta[a.key] || 0);
    const done = prog >= a.req;
    const claimed = meta['ach_'+a.id] === true;
    return (claimed ? '✅' : done ? '🎁' : '🔲') + ' **' + a.text + '** (' + Math.min(prog,a.req) + '/' + a.req + ')' + (claimed ? ' — Claimed' : done ? ' — **/hunt-claim ' + a.id + '**' : '');
  });
  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🏅 Hunt Achievements')
    .setColor(0xf59e0b)
    .setDescription(lines.join('\n'))] });
}
async function cmdHuntClaim(i){
  const achId = i.options.getString('achievement', true);
  const ach = HUNT_ACHIEVEMENTS.find(a => a.id === achId);
  if(!ach) return i.reply({ content:'Unknown achievement.', ephemeral:true });
  const u = await ensureUser(i.user);
  const meta = metaOf(u);
  if(meta['ach_'+achId]) return i.reply({ content:'Already claimed.', ephemeral:true });
  const prog = Number(meta[ach.key] || 0);
  if(prog < ach.req) return i.reply({ content:'Not completed yet. Progress: ' + prog + '/' + ach.req, ephemeral:true });
  await updateMeta(i.user.id, m => { m['ach_'+achId] = true; return m; });
  await grantModeRewards(i.user.id, ach.reward);
  return i.reply({ embeds:[new EmbedBuilder()
    .setTitle('🏅 Achievement Claimed!')
    .setColor(0x22c55e)
    .setDescription('**' + ach.text + '**\n' + rewardsText(ach.reward))] });
}

client.on('interactionCreate', async i => {
  try{
    if(i.isAutocomplete()){
      if(i.commandName === 'anime') return autocompleteAnime(i);
      return autocompleteCharacters(i);
    }
    if(i.isButton()){
      await ensureUser(i.user);
      if(i.customId.startsWith('huntzone:')) return cmdHunt(i, i.customId.split(':')[1], 1);
      if(i.customId==='huntnext'){ await lockButtonInteraction(i); return cmdHuntNext(i); }
      if(i.customId==='huntextract'){
        await lockButtonInteraction(i);
        const user = await ensureUser(i.user);
        const meta = metaOf(user);
        const rewards = cleanRewards(meta.hunt?.pendingRewards || {});
        if(Object.keys(rewards).length){
          await grantModeRewards(i.user.id, rewards);
        }
        await updateMeta(i.user.id, m=>{ delete m.hunt; return m; });
        return i.reply({
          embeds:[new EmbedBuilder().setTitle('Extracted Successfully').setColor(0x22c55e).setDescription(Object.keys(rewards).length ? `**Claimed Loot**\n${rewardsText(rewards)}` : 'No loot was carried out.')]
        });
      }
      if(i.customId==='huntmerchant') return cmdMerchant(i);
      if(i.customId==='huntwizard') return cmdWizard(i);
      if(i.customId==='huntcursed'){
        await lockButtonInteraction(i);
        const u2 = await ensureUser(i.user);
        const meta2 = metaOf(u2);
        if(!meta2.hunt) return i.reply({ content:'No active Hunt run.', ephemeral:true });
        const cursedId = meta2.hunt.pendingCursed;
        const cursed = CURSED_ROOMS.find(r=>r.id===cursedId) || CURSED_ROOMS[0];
        meta2.hunt.cursedRoom = cursed;
        meta2.hunt.pendingCursed = null;
        await prisma.user.update({ where:{id:i.user.id}, data:{meta:meta2} });
        return i.reply({ embeds:[new EmbedBuilder()
          .setTitle(cursed.icon + ' ' + cursed.name)
          .setColor(0x6d28d9)
          .setDescription([
            '*' + cursed.desc + '*',
            '',
            cursed.hpCost ? '⚠️ Your team takes **' + Math.floor(cursed.hpCost*100) + '% HP damage** upfront.' : '',
            '**Enemy Power:** ' + (cursed.enemyMult < 1 ? 'Weakened' : cursed.enemyMult > 1.5 ? 'Extremely Powerful' : 'Enhanced'),
            '**Reward Modifier:** x' + cursed.rewardMult,
            '',
            'The cursed room will apply to your **Next Room**.'
          ].filter(Boolean).join('\n'))
        ], components:[new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('huntnext').setLabel('Enter Cursed Room').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('huntextract').setLabel('Extract Instead').setStyle(ButtonStyle.Success)
        )] });
      }
      if(i.customId==='buyheal' || i.customId.startsWith('merchantbuy:')){
        await lockButtonInteraction(i);
        let item = { id:'heal', name:'Field Potion', cost:3, text:'Restores 35% of team HP.' };
        if(i.customId.startsWith('merchantbuy:')){
          const idx = Number(String(i.customId).split(':')[1] || 0);
          const user = await ensureUser(i.user);
          const meta = metaOf(user);
          item = meta.hunt?.merchantStock?.[idx] || item;
        }
        const ok = await spendResource(i.user.id,'huntCoins',Number(item.cost || 0));
        if(!ok) return i.reply({ content:`Need ${item.cost} Hunt Coins.`, ephemeral:true });
        let hpLine = '';
        await updateMeta(i.user.id, m=>{
          m.hunt=m.hunt||{}; m.hunt.buffs=m.hunt.buffs||[];
          if(item.id === 'compass') m.hunt.buffs.push({ name:'Lucky Hex', effect:'Rewards +15%' });
          if(item.id === 'guard') m.hunt.buffs.push({ name:'Iron Curse', effect:'Defense +20%' });
          if(item.id === 'energy') m.hunt.buffs.push({ name:'Energy Flask', effect:'Damage +10%' });
          if(item.id === 'heal'){
            const max = Number(m.hunt.teamHpMax || 0);
            const cur = Number(m.hunt.teamHp || 0);
            // Heal 35% of max but NEVER exceed teamHpMax
            const heal = Math.max(1, Math.floor(max * 0.35));
            m.hunt.teamHp = Math.min(max, cur + heal);
            hpLine = `\nTeam HP +${money(heal)} → ${money(m.hunt.teamHp)}/${money(max)}`;
          }
          return m;
        });
        return i.reply({
          embeds:[new EmbedBuilder().setTitle('Merchant Purchase Complete').setColor(0x22c55e).setDescription(`**${item.name}** purchased.\nHunt Coins -${item.cost}\n${item.text}${hpLine}`)],
          components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('huntnext').setLabel('Next Room').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('huntextract').setLabel('Extract').setStyle(ButtonStyle.Success)
          )]
        });
      }
      if(i.customId.startsWith('wizard:')){
        await lockButtonInteraction(i);
        const picked = Number(String(i.customId).split(':')[1] || 0);
        const user = await ensureUser(i.user);
        const meta = metaOf(user);
        const offer = meta.hunt?.wizardOffers?.[picked] || ['Wizard Pact','Buff and debuff are active'];
        await updateMeta(i.user.id, m=>{ m.hunt=m.hunt||{}; m.hunt.buffs=m.hunt.buffs||[]; m.hunt.buffs.push({ id:i.customId, name:offer[0], effect:offer[1] }); return m; });
        return i.reply({
          embeds:[new EmbedBuilder().setTitle('Wizard Pact Accepted').setColor(0x8b5cf6).setDescription(`**${offer[0]}**\n${offer[1]}\n\nThe pact is active for this Hunt run.`)],
          components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('huntnext').setLabel('Next Room').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('huntextract').setLabel('Extract').setStyle(ButtonStyle.Success)
          )]
        });
      }
      if(i.customId.startsWith('anime:')){
        const parts = i.customId.split(':');
        const animeQuery = decodeURIComponent(parts[1] || '');
        const page = Number(parts[2] || 1);
        const payload = await animePagePayload(animeQuery, page);
        if(payload.empty) return i.reply({ content:'No anime results found.', ephemeral:true });
        return i.update({ embeds:[payload.embed], files:payload.files, components:payload.components });
      }
      if(i.customId.startsWith('inv:')){
        const page = Number(i.customId.split(':')[1] || 0);
        const payload = await inventoryPagePayload(i.user.id, page);
        if(payload.empty) return i.reply({ content:'Inventory empty.', ephemeral:true });
        return i.update({ embeds:[payload.embed], files:payload.files, components:payload.components });
      }
      if(i.customId.startsWith('quicksellone:')){
        const cardId = i.customId.split(':')[1];
        const card = await prisma.userCard.findFirst({ where:{ id:cardId, userId:i.user.id }, include:{ character:true } });
        if(!card) return i.reply({ content:'Card not found.', ephemeral:true });
        const values = { COMMON:25, RARE:75, EPIC:200, LEGENDARY:600, MYTHIC:1500, DIVINE:4000, SECRET:10000 };
        const gold = values[card.character.rarity] || 25;
        await prisma.teamSlot.deleteMany({ where:{ cardId } }).catch(()=>{});
        await prisma.userEquipment.deleteMany({ where:{ cardId } }).catch(()=>{});
        await prisma.userCard.delete({ where:{ id:cardId } });
        await addResource(i.user.id,'gold',gold);
        return i.update({ embeds:[new EmbedBuilder().setTitle('Quick Sell Complete').setColor(0xf59e0b).setDescription(`Sold **${card.character.name}**\nGold +${money(gold)}`)], files:[], components:[] });
      }
      if(i.customId.startsWith('dungeon:')){
        const x = i.customId.split(':')[1]; if(x==='extract'){ await updateMeta(i.user.id,m=>{ delete m.dungeon; return m; }); return i.reply('Dungeon extracted.'); }
        return resolveDungeonRoom(i,'dungeon',x);
      }
      if(i.customId.startsWith('gate:')){
        const x = i.customId.split(':')[1]; if(x==='extract'){ await updateMeta(i.user.id,m=>{ delete m.gate; return m; }); return i.reply('Gate extracted.'); }
        return resolveDungeonRoom(i,'gate',x);
      }
    }
    if(i.isChatInputCommand()){ await ensureUser(i.user); return route(i); }
  }catch(err){
    console.error('Interaction error:', err);
    const msg = `Error: ${String(err.message || err).slice(0,1500)}`;
    if(i.deferred || i.replied) return i.editReply({ content:msg }).catch(()=>i.followUp({ content:msg, ephemeral:true }).catch(()=>{}));
    return i.reply({ content:msg, ephemeral:true }).catch(()=>{});
  }
});

client.once('clientReady', () => console.log(`Logged in as ${client.user.tag}`));
client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err));

if(!TOKEN){ console.error('Missing BOT_TOKEN or DISCORD_TOKEN'); process.exit(1); }
client.login(TOKEN);
