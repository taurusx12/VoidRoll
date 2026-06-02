// FINAL_VARIANTS_READY
require('dotenv').config();
// VOIDROLL_CLEAN_INDEX_VERSION_V2: legacy progressBattle route removed, help syntax fixed.

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const config = require('./lib/config');
const { prisma } = require('./lib/db');
const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');
const variantPresentation = require('./systems/variantPresentationSystem');
const combatProfiles = require('./systems/characterCombatProfileSystem');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// VOIDROLL_SAFE_ERROR_GUARD
client.on('error', err => {
  if (err?.code === 10062) {
    console.warn('Ignored expired Discord interaction.');
    return;
  }
  console.error('Discord client error:', err);
});

process.on('unhandledRejection', err => {
  if (err?.code === 10062) {
    console.warn('Ignored expired Discord interaction.');
    return;
  }
  console.error('Unhandled rejection:', err);
});

const pendingTrades = global.pendingTrades || new Map();
global.pendingTrades = pendingTrades;

const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','VOIDBORN','SECRET'];
const RARITY_EMOJI = { COMMON:'🟢', RARE:'🔵', EPIC:'🟣', LEGENDARY:'🟡', MYTHIC:'🔴', DIVINE:'⚪', VOIDBORN:'🌌', SECRET:'🌠' };
const RARITY_VALUE = { COMMON:1, RARE:2, EPIC:3, LEGENDARY:4, MYTHIC:5, DIVINE:6, VOIDBORN:7, SECRET:8 };
const ROLL_RATES = [
  ['COMMON', 72], ['RARE', 22], ['EPIC', 5.65], ['LEGENDARY', 1], ['MYTHIC', 0.75], ['DIVINE', 0.1], ['VOIDBORN', 0.00999], ['SECRET', 0.00001]
];
const ROLE_LIST = ['DPS','Tank','Support','Control','Assassin','Mage'];
const ELEMENT_LIST = ['Neutral','Fire','Ice','Lightning','Light','Dark','Shadow','Void','Soul','Cursed'];

function id(prefix='id') { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`; }
function money(n) { if (typeof n === 'bigint') return n.toLocaleString('en-US'); return Number(n || 0).toLocaleString('en-US'); }
function big(v) { if (typeof v === 'bigint') return v; try { return BigInt(String(v ?? 0)); } catch { return 0n; } }
function toNum(v) { if (typeof v === 'bigint') return Number(v > 9007199254740991n ? 9007199254740991n : v); return Number(v || 0); }
function clean(name='') { return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig,' ').replace(/\s+/g,' ').trim(); }
function norm(v='') { return String(v || '').toLowerCase().replace(/[().\-_:/'’]/g,' ').replace(/\s+/g,' ').trim(); }
function emoji(r) { return RARITY_EMOJI[String(r||'').toUpperCase()] || '⭐'; }
function clamp(n,a,b){ return Math.max(a, Math.min(b, Number(n || 0))); }
function pageBounds(page, max){ page = Math.max(1, Number(page || 1)); return Math.min(page, Math.max(1, max)); }
function shortId(cardId='') { return String(cardId).slice(-6).toUpperCase(); }

async function ensureUser(discordUser) {
  const uid = typeof discordUser === 'string' ? discordUser : discordUser.id;
  const username = typeof discordUser === 'string' ? undefined : discordUser.username;
  return prisma.user.upsert({
    where: { id: String(uid) },
    update: username ? { username } : {},
    create: { id: String(uid), username, gold: 25000, tokens: 1000, rolls: 25 }
  });
}
async function getUserMeta(userId) {
  const u = await prisma.user.findUnique({ where:{ id:String(userId) } }).catch(()=>null);
  return (u && u.meta && typeof u.meta === 'object') ? u.meta : {};
}
async function setUserMeta(userId, meta) {
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta } }).catch(()=>null);
}
async function addWallet(userId, { gold=0n, tokens=0, rolls=0, essence=0, voidCrystals=0 } = {}) {
  const u = await ensureUser(String(userId));
  const data = {};
  if (gold) data.gold = big(u.gold) + big(gold);
  if (tokens) data.tokens = Math.max(0, Number(u.tokens || 0) + Number(tokens));
  if (rolls) data.rolls = Math.max(0, Number(u.rolls || 0) + Number(rolls));
  if (essence) data.essence = Math.max(0, Number(u.essence || 0) + Number(essence));
  if (voidCrystals) data.voidCrystals = Math.max(0, Number(u.voidCrystals || 0) + Number(voidCrystals));
  return prisma.user.update({ where:{ id:String(userId) }, data });
}

function roleOf(c) { return combatProfiles.roleOf(c); }
function elementOf(c) { return combatProfiles.elementOf(c); }
function passiveOf(c) {
  const vp = variantPresentation.getVariantProfile(c);
  if (vp.isVariant && vp.passiveName) return { name:vp.passiveName, text:vp.passiveText || 'Special variant passive active in battle.', effect:{ dmg:15, teamDmg:10, silence:12, energyGain:8 } };
  const p = combatProfiles.passiveOf(c);
  const effect = p.effect || {};
  const parts = [];
  if (effect.dmg) parts.push(`+${effect.dmg}% Damage`);
  if (effect.teamDmg) parts.push(`+${effect.teamDmg}% Team Damage`);
  if (effect.bossDmg) parts.push(`+${effect.bossDmg}% Boss Damage`);
  if (effect.crit) parts.push(`+${effect.crit}% Crit`);
  if (effect.dodge) parts.push(`+${effect.dodge}% Dodge`);
  if (effect.shield) parts.push('Starts with Shield');
  if (effect.heal) parts.push(`+${effect.heal}% Healing`);
  if (effect.lifesteal) parts.push(`+${effect.lifesteal}% Lifesteal`);
  if (effect.counter) parts.push(`+${effect.counter}% Counter`);
  if (effect.burn) parts.push(`${effect.burn}% Burn`);
  if (effect.bleed) parts.push(`${effect.bleed}% Bleed`);
  if (effect.poison) parts.push(`${effect.poison}% Poison`);
  if (effect.freeze) parts.push(`${effect.freeze}% Freeze`);
  if (effect.stun) parts.push(`${effect.stun}% Stun`);
  if (effect.silence) parts.push(`${effect.silence}% Silence`);
  if (effect.miss) parts.push(`${effect.miss}% Enemy Miss`);
  if (effect.enemyAtk) parts.push(`${effect.enemyAtk}% Enemy ATK`);
  if (effect.energyGain) parts.push(`+${effect.energyGain} Energy Gain`);
  if (effect.energyDrain) parts.push(`${effect.energyDrain} Energy Drain`);
  if (effect.execute) parts.push(`${effect.execute}% Execute`);
  if (effect.summon) parts.push('Summon Assist');
  return { name:p.name || 'Anime Combat Passive', text:parts.length ? parts.join(' • ') : 'Anime-linked passive active in battle.', effect };
}
function statsFor(card, c=card?.character) {
  const p = Number(card?.power || c?.basePower || 1000);
  const lv = Number(card?.level || 1);
  const role = roleOf(c);
  const base = p * (1 + (lv-1)*0.012);
  let atk=1, hp=1, def=1, speed=1, crit=8, critDmg=150;
  if (role==='Tank') { hp=2.35; def=1.9; atk=.75; crit=4; }
  if (role==='Support') { hp=1.55; def=1.25; atk=.9; speed=1.1; }
  if (role==='Control') { hp=1.3; def=1.15; atk=1; speed=1.25; crit=10; }
  if (role==='Assassin') { hp=.95; def=.8; atk=1.65; speed=1.55; crit=30; critDmg=220; }
  if (role==='Mage') { hp=1.1; def=.9; atk=1.75; speed=1.1; crit=18; critDmg=200; }
  if (role==='DPS') { hp=1.15; def=1; atk=1.45; speed=1.05; crit=16; critDmg=180; }
  const pass = passiveOf(c).effect || {};
  atk *= 1 + (pass.dmg || 0)/100;
  def *= 1 + (pass.def || 0)/100;
  return {
    power:p, level:lv, role, element:elementOf(c),
    hp: Math.floor(base*9*hp), atk: Math.floor(base*atk), def: Math.floor(base*.7*def), speed: Math.floor(100 + (base/70)*speed),
    critRate: crit, critDamage: critDmg, dodge: pass.dodge || 4, accuracy: 95 + (pass.control || 0), lifesteal: pass.lifesteal || 0, pen: pass.pen || 0
  };
}
function statBlock(card,c=card.character) {
  const s = statsFor(card,c);
  const p = passiveOf(c);
  const vp = variantPresentation.getVariantProfile(c);
  const variantLine = vp.isVariant ? `Variant: **${vp.variant}** • Event: **${vp.eventType}**\n` : '';
  return `${variantLine}Type: **${s.role}** | Element: **${s.element}**\n`+
    `Level: **${s.level}/100** | Power: **${money(s.power)}**\n`+
    `HP **${money(s.hp)}** • ATK **${money(s.atk)}** • DEF **${money(s.def)}** • SPD **${money(s.speed)}**\n`+
    `Crit **${s.critRate}%** • Crit DMG **${s.critDamage}%** • Dodge **${s.dodge}%** • Accuracy **${s.accuracy}%**\n`+
    `Passive: **${p.name}** — ${p.text}`;
}


// FINAL_VARIANT_SEARCH_HELPERS
function searchTokens(v='') { return norm(v).split(' ').filter(Boolean); }
function isCharacterId(value='') { const v=String(value||'').trim(); return v.startsWith('char_') || /^[a-zA-Z0-9_-]{16,}$/.test(v); }
function characterSearchScoreStrict(c, query) {
  const raw=String(query||'').trim(), q=norm(raw); if(!q) return 0;
  const qTokens=searchTokens(q), rawName=norm(c.name), cleanName=norm(clean(c.name)), anime=norm(c.anime), rawTokens=searchTokens(rawName), cleanTokens=searchTokens(cleanName);
  let score=0;
  if(rawName===q) score+=2000000;
  if(cleanName===q) score+=1900000;
  if(rawTokens[0]===q) score+=1500000;
  if(cleanTokens[0]===q) score+=1450000;
  if(rawName.startsWith(q+' ')) score+=1200000;
  if(cleanName.startsWith(q+' ')) score+=1150000;
  const all=qTokens.length && qTokens.every(t=>rawTokens.includes(t)||cleanTokens.includes(t));
  if(all) score+=900000+qTokens.length*30000;
  let matched=0;
  for(const t of qTokens){ if(rawTokens.includes(t)){score+=70000;matched++;} else if(cleanTokens.includes(t)){score+=65000;matched++;} else if(rawName.includes(t)){score+=10000;matched++;} else if(cleanName.includes(t)){score+=9000;matched++;} else if(anime.includes(t)) score+=500; }
  if(matched===0 && !rawName.includes(q) && !cleanName.includes(q)) return 0;
  try{ score += variantPresentation.searchScoreAdjustment(c, raw); const profile=combatProfiles.getCombatProfile(c); if(profile.source==='exact') score+=3000; if(profile.source==='anime') score+=1000; }catch{}
  if(String(c.imageUrl||'').includes('cdn.myanimelist')) score+=300;
  score += Math.min(999, Number(c.basePower||0)/10000);
  return score;
}

async function findCharacter(query) {
  const raw = String(query || '').trim();
  const q = norm(raw);
  if (!q) return null;
  if (isCharacterId(raw)) {
    const byId = await prisma.character.findFirst({ where:{ id:raw, active:true } }).catch(()=>null);
    if (byId) return byId;
  }
  const chars = await prisma.character.findMany({ where:{ active:true }, take:50000, orderBy:{ basePower:'desc' } }).catch(()=>[]);
  return chars.map(c=>({c,score:characterSearchScoreStrict(c,raw)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || Number(b.c.basePower||0)-Number(a.c.basePower||0))[0]?.c || null;
}
async function ownedCardByIdOrBest(userId, value) {
  if (!value) return null;
  const raw=String(value||'').trim(), q=norm(raw);
  let card=await prisma.userCard.findFirst({ where:{ id:raw, userId:String(userId) }, include:{ character:true } }).catch(()=>null);
  if(card) return card;
  if(isCharacterId(raw)){
    card=await prisma.userCard.findFirst({ where:{ userId:String(userId), characterId:raw }, include:{ character:true }, orderBy:{ power:'desc' } }).catch(()=>null);
    if(card) return card;
  }
  const cards=await prisma.userCard.findMany({ where:{ userId:String(userId) }, include:{ character:true }, orderBy:{ power:'desc' }, take:10000 }).catch(()=>[]);
  return cards.map(card=>{const sid=shortId(card.id).toLowerCase();let score=characterSearchScoreStrict(card.character||{},raw);if(sid===q)score+=3000000;if(q&&sid.includes(q))score+=100000;score+=Math.min(999,Number(card.power||0)/10000);return{card,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || Number(b.card.power||0)-Number(a.card.power||0))[0]?.card || null;
}
async function ownedCards(userId, { character, anime, rarity, role, element, sort='power', page=1, take=10 }={}) {
  const cards = await prisma.userCard.findMany({ where:{ userId:String(userId) }, include:{ character:true }, take:5000 }).catch(()=>[]);
  let list = cards;
  if (character) { const q=norm(character); list = list.filter(x=>norm(clean(x.character.name)).includes(q) || norm(x.character.name).includes(q)); }
  if (anime) { const q=norm(anime); list = list.filter(x=>norm(x.character.anime).includes(q)); }
  if (rarity && rarity !== 'ALL') list = list.filter(x=>String(x.character.rarity)===rarity);
  if (role && role !== 'ALL') list = list.filter(x=>roleOf(x.character)===role);
  if (element && element !== 'ALL') list = list.filter(x=>elementOf(x.character)===element);
  list.sort((a,b)=>{
    if (sort==='level') return (b.level-a.level) || (b.power-a.power);
    if (sort==='rarity') return (RARITY_VALUE[b.character.rarity]-RARITY_VALUE[a.character.rarity]) || (b.power-a.power);
    if (sort==='name') return clean(a.character.name).localeCompare(clean(b.character.name));
    return (b.power-a.power);
  });
  const pages = Math.max(1, Math.ceil(list.length/take)); page = pageBounds(page,pages);
  return { total:list.length, pages, page, items:list.slice((page-1)*take, page*take) };
}

function pickRarity() {
  const total = ROLL_RATES.reduce((s,x)=>s+x[1],0); let r = Math.random()*total;
  for (const [rarity, rate] of ROLL_RATES) { r-=rate; if (r<=0) return rarity; }
  return 'COMMON';
}
async function randomCharacterByRarity(rarity) {
  const count = await prisma.character.count({ where:{ active:true, rarity } }).catch(()=>0);
  if (!count) return prisma.character.findFirst({ where:{ active:true }, orderBy:{ basePower:'desc' } });
  return prisma.character.findFirst({ where:{ active:true, rarity }, skip:Math.floor(Math.random()*count) }).catch(()=>null);
}
async function createCard(userId, character) {
  return prisma.userCard.create({ data:{ id:id('card'), serial:Math.floor(Date.now()%2000000000 + Math.random()*100000), userId:String(userId), characterId:character.id, power:Number(character.basePower || 1000), level:1 } });
}

async function bannerCharacters() {
  const pool = await prisma.character.findMany({ where:{ active:true, rarity:{ in:['SECRET','VOIDBORN'] } }, orderBy:[{ rarity:'desc' }, { basePower:'desc' }], take:500 }).catch(()=>[]);
  if (!pool.length) return [];
  const must = ['aizen','rimuru','makima'];
  const picks = [];
  for (const m of must) { const c = pool.find(x=>norm(x.name).includes(m)); if (c && !picks.find(p=>p.id===c.id)) picks.push(c); }
  const day = Math.floor(Date.now()/86400000); const start = (day*53+97)%pool.length;
  let k=0; while (picks.length<4 && k<pool.length*2) { const c = pool[(start+k*17)%pool.length]; if (c && !picks.find(p=>p.id===c.id)) picks.push(c); k++; }
  return picks.slice(0,4);
}
async function pityGet(userId, charId) { const m=await getUserMeta(userId); return Number(m?.pity?.[charId] || 0); }
async function pitySet(userId, charId, val) { const m=await getUserMeta(userId); m.pity = m.pity || {}; m.pity[charId]=Number(val||0); await setUserMeta(userId,m); }

async function autocomplete(i) {
  try {
    const focused = i.options.getFocused(true);
    const name = focused?.name;
    const q = norm(focused?.value || '');
    const cmd = i.commandName;
    const choice = (name, value) => ({
      name: String(name || 'Unknown').slice(0, 100),
      value: String(value || 'none').slice(0, 100)
    });
    const empty = (text='No results found') => i.respond([choice(text, 'none')]).catch(()=>{});

    // Owned card autocomplete: gift, trade, train, view-card.
    // This shows duplicates separately so the player can choose Lv100 or Lv1 safely.
    if (['card','name'].includes(name) && ['gift-character','trade-offer','train','auto-train','view-card','my-card'].includes(cmd)) {
      const cards = await prisma.userCard.findMany({
        where:{ userId:String(i.user.id) },
        include:{ character:true },
        orderBy:[{ power:'desc' }, { id:'desc' }],
        take:500
      }).catch(()=>[]);

      const out = cards
        .filter(card => card?.character && (!q || `${norm(card.character.name)} ${norm(card.character.anime)} ${shortId(card.id).toLowerCase()}`.includes(q)))
        .slice(0,25)
        .map(card => choice(`${clean(card.character.name)} • Lv${card.level||1} • PWR ${money(card.power||0)} • ${shortId(card.id)}`, card.id));
      return out.length ? i.respond(out).catch(()=>{}) : empty('No owned cards found');
    }

    // Inventory character filter: use owned characters first, not the full database.
    // This fixes Loading options failed from huge lists / long choice names.
    if (name === 'character' && cmd === 'inventory') {
      const cards = await prisma.userCard.findMany({
        where:{ userId:String(i.user.id) },
        include:{ character:true },
        orderBy:[{ power:'desc' }, { id:'desc' }],
        take:800
      }).catch(()=>[]);
      const seen = new Set();
      const out = [];
      for (const card of cards) {
        const c = card?.character;
        if (!c) continue;
        const key = `${clean(c.name)}|${c.anime}`;
        if (seen.has(key)) continue;
        if (q && !`${norm(c.name)} ${norm(c.anime)}`.includes(q)) continue;
        seen.add(key);
        out.push(choice(`${clean(c.name)} • ${c.anime} • Best PWR ${money(card.power||0)}`, clean(c.name)));
        if (out.length >= 25) break;
      }
      return out.length ? i.respond(out).catch(()=>{}) : empty('No owned characters found');
    }

    // Global character database search.
    if (['character','name'].includes(name) && ['character','who-has','variants','characters','wishlist-add'].includes(cmd)) {
      const chars = await prisma.character.findMany({ where:{ active:true }, orderBy:{ basePower:'desc' }, take:1500 }).catch(()=>[]);
      const out = chars
        .filter(c=>!q || `${norm(c.name)} ${norm(c.anime)}`.includes(q))
        .slice(0,25)
        .map(c=>choice(`${clean(c.name)} • ${c.anime} • ${c.rarity}`, c.id));
      return out.length ? i.respond(out).catch(()=>{}) : empty('No characters found');
    }

    // Anime autocomplete.
    if (name === 'anime') {
      const rows = await prisma.character.groupBy({
        by:['anime'],
        where:{ active:true },
        _count:{ anime:true },
        orderBy:{ anime:'asc' }
      }).catch(()=>[]);
      const out = rows
        .filter(r=>!q || norm(r.anime).includes(q))
        .slice(0,25)
        .map(r=>choice(`${r.anime} • ${r._count.anime} chars`, r.anime));
      return out.length ? i.respond(out).catch(()=>{}) : empty('No anime found');
    }

    // Banner autocomplete.
    if (name === 'banner') {
      const picks = await bannerCharacters().catch(()=>[]);
      const out = picks.map(c=>choice(`Rate Up: ${clean(c.name)} • ${c.anime}`, c.id)).slice(0,25);
      return out.length ? i.respond(out).catch(()=>{}) : empty('No banner found');
    }

    // Market item autocomplete.
    if (name === 'item_id') {
      const out = dailyMarket().items.map(x=>choice(`${x.name} • ${money(x.costGold)} Gold`, x.id)).slice(0,25);
      return out.length ? i.respond(out).catch(()=>{}) : empty('No market items found');
    }

    return empty('No options available');
  } catch (err) {
    console.error('Autocomplete failed:', err);
    return i.respond([{ name:'Search failed - type manually', value:'none' }]).catch(()=>{});
  }
}

function dailyMarket() {
  const day = Math.floor(Date.now()/86400000);
  const rollPack = [5,10,20,50][day%4]; const tokenPack=[250,500,750,1000][(day+1)%4];
  return { reset: Math.floor(((day+1)*86400000)/1000), items:[
    { id:'normal_rolls', name:`${rollPack} Normal Rolls`, costGold:BigInt(rollPack*85000), reward:{rolls:rollPack}, stock:3 },
    { id:'token_bundle', name:`${tokenPack} Tokens`, costGold:BigInt(tokenPack*5500), reward:{tokens:tokenPack}, stock:2 },
    { id:'premium_rolls', name:'Premium Roll Chest', costGold:2000000n, reward:{rolls:15,tokens:250}, stock:1 },
    { id:'void_luxury', name:'Void Luxury Chest', costGold:25000000n, reward:{rolls:25,tokens:2500}, stock:1 }
  ]};
}
async function marketBought(userId,itemId){ const m=await getUserMeta(userId); const key=`${Math.floor(Date.now()/86400000)}:${itemId}`; return Number(m.market?.[key]||0); }
async function marketAdd(userId,itemId){ const m=await getUserMeta(userId); m.market=m.market||{}; const key=`${Math.floor(Date.now()/86400000)}:${itemId}`; m.market[key]=Number(m.market[key]||0)+1; await setUserMeta(userId,m); }
function revealStepTitle(rarity='SECRET') {
  return rarity === 'SECRET'
    ? 'Void Spark → Bottom Distortion → Quote Ascends → Secret Flash → Character Reveal'
    : 'Void Distortion → Rising Aura → Voidborn Flash → Character Reveal';
}

function revealQuote(name='') { const n=norm(name); if(n.includes('madara'))return 'Wake up to reality.'; if(n.includes('aizen'))return 'Since when were you under the impression?'; if(n.includes('gojo'))return 'Throughout heaven and earth...'; if(n.includes('sukuna'))return 'Know your place.'; if(n.includes('lelouch'))return 'Obey me, world.'; if(n.includes('rimuru'))return 'I will devour everything.'; if(n.includes('makima'))return 'You are mine now.'; if(n.includes('itachi'))return 'Reality is only an illusion.'; return 'A legend has awakened from the void.'; }


async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function sendCinematicReveal(channel, character, card=null) {
  if (!channel || !character) return;
  const extra = card ? `Card ID: **${shortId(card.id)}** • Power: **${money(card.power)}**` : '';
  const embeds = variantPresentation.buildRevealEmbeds(EmbedBuilder, character, extra);
  for (const embed of embeds) {
    await channel.send({ embeds:[embed] }).catch(()=>{});
    await sleep(750);
  }
}

async function battleScore(cards, mode='story') {
  let score = 0; const roles = new Set(); const logs=[];
  for (const card of cards) { const c=card.character; const s=statsFor(card,c); roles.add(s.role); let v=s.power; const pass=passiveOf(c).effect||{}; v*=1+((pass.dmg||0)+(mode==='boss'?(pass.bossDmg||0):0))/100; if(s.role==='Tank') v*=1.10; if(s.role==='Support') v*=1.08; if(s.role==='Control') v*=1.08; score += Math.floor(v); logs.push(`${clean(c.name)} used **${passiveOf(c).name}** (${s.role})`); }
  if (roles.has('Tank') && roles.has('Support') && roles.has('DPS')) score*=1.18;
  if (roles.has('Control')) score*=1.10;
  return { score:Math.floor(score), logs, roles:[...roles] };
}
async function bestTeam(userId, take=6) { return prisma.userCard.findMany({ where:{ userId:String(userId) }, include:{ character:true }, orderBy:{ power:'desc' }, take }).catch(()=>[]); }
async function getProgress(userId){ return prisma.storyProgress.upsert({ where:{ userId:String(userId) }, update:{}, create:{ id:id('progress'), userId:String(userId) } }); }
async function progressBattle(i, mode) {
  // VOIDROLL_PROGRESSBATTLE_REPLACED
  // Legacy score-only battle screen is permanently disabled.
  return handleBattlePolishCommand(i);
}

async function command(i) {
  const commandName = i.commandName; const userId = i.user.id;

  // VOIDROLL_BATTLE_FORCE_HOOK
  if (['story','dungeon','pvp','world-boss','raid','raid-attack','raid-rank'].includes(commandName)) {
    return handleBattlePolishCommand(i);
  }

  await ensureUser(i.user);
  if (commandName === 'help') return i.reply([
    '**🌌 VoidRoll Reborn**',
    'Economy: /profile /wallet /daily /market /market-buy',
    'Collection: /inventory /my-card /character /variants /who-has /characters /anime /collection',
    'Gacha: /roll /banner /pack /pity /rates',
    'Battle: /story /dungeon /pvp /world-boss /raid /raid-attack /raid-rank',
    'Progress: /train /formations',
    'Trading: /gift-character /trade-offer /trade-accept /trade-decline /trade-cancel /trades',
    'Admin: /admin-reset-all /admin-give-gold /admin-give-tokens /admin-give-rolls /admin-give-resource'
  ].join('\n'));
  if (commandName === 'profile' || commandName === 'wallet') { const u=await ensureUser(i.user); const count=await prisma.userCard.count({where:{userId}}); return i.reply({embeds:[new EmbedBuilder().setTitle(`🌌 ${i.user.username} — VoidRoll Reborn`).setDescription(`Gold: **${money(u.gold)}**\nTokens: **${money(u.tokens)}**\nEssence: **${money(u.essence || 0)}**\nVoid Crystals: **${money(u.voidCrystals || 0)}**\nRolls: **${money(u.rolls)}**\nCards: **${count}**\nStory: **${u.storyChapter}-${u.storyStage}**`).setColor(0x7c3aed)]}); }
  if (commandName === 'daily') { const u=await ensureUser(i.user); const now=Date.now(); if(u.lastDailyAt && now - new Date(u.lastDailyAt).getTime() < 20*3600000) return i.reply('Daily already claimed.'); await prisma.user.update({where:{id:userId},data:{lastDailyAt:new Date(),dailyStreak:{increment:1},gold:{increment:50000},tokens:{increment:100},essence:{increment:25},rolls:{increment:5}}}); return i.reply('Daily claimed: **50,000 Gold**, **100 Tokens**, **25 Essence**, **5 Rolls**.'); }
  if (commandName === 'rates' || commandName === 'rarity') return i.reply('**Normal Roll Rates**\nCommon 72%\nRare 22%\nEpic 5.65%\nLegendary 1%\nMythic 0.75%\nDivine 0.1%\nVoidborn 0.00999%\nSecret 0.00001%');
  if (commandName === 'roll' || commandName === 'r') { await i.deferReply(); const amount=clamp(i.options.getInteger('amount')||1,1,10); const u=await ensureUser(i.user); if(Number(u.rolls)<amount) return i.editReply(`Not enough rolls. You have **${u.rolls}**.`); await prisma.user.update({where:{id:userId},data:{rolls:{decrement:amount}}}); const lines=[]; const embeds=[]; for(let x=0;x<amount;x++){ const r=pickRarity(); const c=await randomCharacterByRarity(r); if(!c) continue; const card=await createCard(userId,c); lines.push(`${x+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.anime} • ${c.rarity} • PWR **${money(card.power)}**`); if(['SECRET','VOIDBORN'].includes(c.rarity)){ await i.channel?.send({ embeds:[new EmbedBuilder().setTitle(`${emoji(c.rarity)} ${c.rarity} REVEAL`).setDescription(`**${revealStepTitle(c.rarity)}**\n“${revealQuote(c.name)}”\nThe reveal rises from the bottom until the full card appears.`).setColor(c.rarity==='SECRET'?0x6d28d9:0x4f46e5)] }).catch(()=>{}); } if(amount<=3){ const e=new EmbedBuilder().setTitle(`${emoji(c.rarity)} ${clean(c.name)}`).setDescription(`${c.anime}\n${statBlock(card,c)}`).setColor(c.rarity==='SECRET'?0xe74c3c:0x5865f2); if(c.imageUrl)e.setImage(c.imageUrl); embeds.push(e); } } return i.editReply({ content:lines.join('\n').slice(0,1900), embeds }); }
  if (commandName === 'banner') { const picks=await bannerCharacters(); const lines=[]; for(const c of picks) lines.push(`${emoji(c.rarity)} **${clean(c.name)}** • ${c.anime} • Pulls **${await pityGet(userId,c.id)}/50**`); return i.reply({embeds:[new EmbedBuilder().setTitle('Daily SECRET Banner').setDescription(`${lines.join('\n')}\n\n10 pulls cost **4,000 Tokens**. Guaranteed selected SECRET at **50 pulls**.`).setColor(0xe74c3c)]}); }
  if (commandName === 'pack') { await i.deferReply(); const charId=i.options.getString('banner',true); const selected=await prisma.character.findUnique({where:{id:charId}}).catch(()=>null); if(!selected) return i.editReply('Choose a banner character from autocomplete.'); const u=await ensureUser(i.user); if(Number(u.tokens)<4000) return i.editReply(`Need **4,000 Tokens**. You have **${u.tokens}**.`); await prisma.user.update({where:{id:userId},data:{tokens:{decrement:4000}}}); let pity=await pityGet(userId,selected.id); const before=pity; const rarities=['RARE','RARE','RARE','EPIC','EPIC','EPIC','LEGENDARY','LEGENDARY','MYTHIC','DIVINE']; let secretAt=-1; for(let j=0;j<10;j++){ const next=pity+j+1; const soft=next>=35?Math.min(.20,(next-34)*.01):0; if(next>=50 || Math.random()<(.01+soft)){secretAt=j; break;} } if(secretAt>=0) rarities[secretAt]='SECRET'; const lines=[]; for(let j=0;j<10;j++){ pity++; let c; if(rarities[j]==='SECRET'){ c=selected; pity=0; await sendCinematicReveal(i.channel, c).catch(()=>{}); } else c=await randomCharacterByRarity(rarities[j]); const card=await createCard(userId,c); lines.push(`${j+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.rarity} • PWR **${money(card.power)}**`); } await pitySet(userId,selected.id,pity); return i.editReply(`**PACK x10**\nSelected: **${clean(selected.name)}**\nPity: **${before}/50 → ${pity}/50**\n\n${lines.join('\n')}`); }
  if (commandName === 'pity') { const picks=await bannerCharacters(); const lines=[]; for(const c of picks) lines.push(`**${clean(c.name)}**: ${await pityGet(userId,c.id)}/50`); return i.reply(lines.join('\n')||'No banner.'); }
  if (commandName === 'inventory') { const res=await ownedCards(userId,{ character:i.options.getString('character'), anime:i.options.getString('anime'), rarity:i.options.getString('rarity'), role:i.options.getString('type'), element:i.options.getString('element'), sort:i.options.getString('sort')||'power', page:i.options.getInteger('page')||1 }); const lines=res.items.map((card,idx)=>`${(res.page-1)*10+idx+1}. ${emoji(card.character.rarity)} **${clean(card.character.name)}** • ${card.character.anime}\n   ID **${shortId(card.id)}** • Lv **${card.level}** • PWR **${money(card.power)}** • ${roleOf(card.character)} • ${elementOf(card.character)}`).join('\n'); return i.reply({embeds:[new EmbedBuilder().setTitle('Inventory').setDescription(`Page **${res.page}/${res.pages}** • Total **${res.total}**\n\n${lines||'No cards found.'}`).setColor(0x5865f2)]}); }
  if (commandName === 'view-card' || commandName === 'my-card') {
    const val = i.options.getString('card') || i.options.getString('name') || i.options.getString('character');
    const card = await ownedCardByIdOrBest(userId, val);
    if (!card) return i.reply('Owned card not found. Use /my-card and pick from autocomplete.');
    const e = new EmbedBuilder().setTitle(`${emoji(card.character.rarity)} ${clean(card.character.name)} • ${shortId(card.id)}`).setDescription(`${card.character.anime}\nRarity: **${card.character.rarity}**\n${statBlock(card, card.character)}`).setColor(0x8e44ad);
    if (card.character.imageUrl) e.setImage(card.character.imageUrl);
    return i.reply({ embeds:[e] });
  }

  if (commandName === 'character') {
    const val = i.options.getString('name') || i.options.getString('character') || i.options.getString('card');
    const c = await findCharacter(val);
    if (!c) return i.reply('Character not found. Pick from autocomplete or type the full name.');
    const fake = { power:c.basePower, level:1, character:c };
    const vp = variantPresentation.getVariantProfile(c);
    const e = new EmbedBuilder().setTitle(`${emoji(c.rarity)} ${clean(c.name)}`).setDescription(`${c.anime}\nRarity: **${c.rarity}**\n${vp.isVariant ? `Base: **${vp.baseName}** • Event: **${vp.eventType}**\n` : ''}${statBlock(fake, c)}`).setColor(vp.color || 0x8e44ad);
    if (c.imageUrl) e.setImage(c.imageUrl);
    return i.reply({ embeds:[e] });
  }
  if (commandName === 'variants') {
    const val = i.options.getString('name');
    const chars = await prisma.character.findMany({ where:{ active:true }, orderBy:{ basePower:'desc' }, take:50000 }).catch(()=>[]);
    const q = norm(val || '');
    const list = chars.map(c => ({ c, profile: variantPresentation.getVariantProfile(c) }))
      .filter(x => x.profile.isVariant || (q && (norm(x.c.name).includes(q) || norm(clean(x.c.name)).includes(q))))
      .filter(x => !q || norm(x.profile.baseName).includes(q) || norm(x.c.name).includes(q) || norm(clean(x.c.name)).includes(q))
      .slice(0,25);
    const lines = list.map(x => `${emoji(x.c.rarity)} **${clean(x.c.name)}** • Base: **${x.profile.baseName}** • ${x.profile.eventType} • ${x.profile.role || roleOf(x.c)}/${x.profile.element || elementOf(x.c)}`);
    return i.reply({ embeds:[new EmbedBuilder().setTitle(val ? `Variants for ${val}` : 'Special Variants').setDescription(lines.join('\n') || 'No variants found.').setColor(0x7c3aed)] });
  }
  if (commandName === 'characters' || commandName==='top-characters') { const anime=i.options.getString('anime'); const rarity=i.options.getString('rarity'); const role=i.options.getString('type'); const page=i.options.getInteger('page')||1; let chars=await prisma.character.findMany({ where:{ active:true }, orderBy:{basePower:'desc'}, take:5000 }).catch(()=>[]); if(anime)chars=chars.filter(c=>norm(c.anime).includes(norm(anime))); if(rarity&&rarity!=='ALL')chars=chars.filter(c=>c.rarity===rarity); if(role&&role!=='ALL')chars=chars.filter(c=>roleOf(c)===role); const pages=Math.max(1,Math.ceil(chars.length/10)); const p=pageBounds(page,pages); const items=chars.slice((p-1)*10,p*10); return i.reply({embeds:[new EmbedBuilder().setTitle('Character Index').setDescription(`Page **${p}/${pages}** • Total **${chars.length}**\n\n${items.map((c,k)=>`${(p-1)*10+k+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.anime} • PWR **${money(c.basePower)}** • ${roleOf(c)}`).join('\n')}`).setColor(0x3498db)]}); }
  if (commandName === 'anime' || commandName==='collection') { const anime=i.options.getString('anime',true); const all=await prisma.character.findMany({where:{active:true},orderBy:{basePower:'desc'},take:6000}).catch(()=>[]); const chars=all.filter(c=>norm(c.anime).includes(norm(anime))); if(!chars.length)return i.reply('Anime not found.'); const owned=await prisma.userCard.findMany({where:{userId},include:{character:true},take:10000}).catch(()=>[]); const ownedNames=new Set(owned.map(x=>norm(clean(x.character.name))+'|'+norm(x.character.anime))); const got=chars.filter(c=>ownedNames.has(norm(clean(c.name))+'|'+norm(c.anime))); const missing=chars.filter(c=>!ownedNames.has(norm(clean(c.name))+'|'+norm(c.anime))).slice(0,15); return i.reply({embeds:[new EmbedBuilder().setTitle(`📚 ${chars[0].anime} Library`).setDescription(`Collected: **${got.length}/${chars.length}** (${Math.floor(got.length/Math.max(1,chars.length)*100)}%)\nStrongest: **${clean(chars[0].name)}**\n\n**Missing preview**\n${missing.map(c=>`${emoji(c.rarity)} ${clean(c.name)} • ${c.rarity}`).join('\n')||'Complete!'}\n\nRewards: 25% / 50% / 75% / 100% collection chests.`).setColor(0x1abc9c)]}); }
  if (commandName === 'who-has') { const name=i.options.getString('name',true); const c=await findCharacter(name); if(!c)return i.reply('Character not found.'); const cards=await prisma.userCard.findMany({where:{characterId:c.id},include:{user:true,character:true},orderBy:{power:'desc'},take:10}).catch(()=>[]); return i.reply({embeds:[new EmbedBuilder().setTitle(`Who has ${clean(c.name)}?`).setDescription(cards.map((card,idx)=>`${idx+1}. <@${card.userId}> • Lv **${card.level}** • PWR **${money(card.power)}** • ID **${shortId(card.id)}**`).join('\n')||'Nobody owns this character yet.').setColor(0xf39c12)]}); }
  if (commandName === 'train' || commandName==='auto-train') { await i.deferReply(); const card=await ownedCardByIdOrBest(userId, i.options.getString('card') || i.options.getString('name')); if(!card)return i.editReply('Card not found. Use autocomplete.'); const u=await ensureUser(i.user); let gold=big(u.gold); let level=card.level; let power=card.power; let spent=0n; let gains=0; const maxRuns=commandName==='train'?1:100; for(let k=0;k<maxRuns && level<100;k++){ const cost=BigInt(5000 + level*3500 + Math.floor(power*.03)); if(gold<cost)break; gold-=cost; spent+=cost; level++; power+=Math.floor(card.character.basePower*.045 + level*50); gains++; } if(!gains)return i.editReply('Not enough Gold or already max level.'); await prisma.user.update({where:{id:userId},data:{gold}}); await prisma.userCard.update({where:{id:card.id},data:{level,power}}); return i.editReply(`Trained **${clean(card.character.name)}** +${gains} levels.\nLevel: **${card.level} → ${level}**\nPower: **${money(card.power)} → ${money(power)}**\nSpent: **${money(spent)} Gold**`); }
  if (commandName === 'formations') { const cards=await bestTeam(i.options.getUser('user')?.id||userId,36); const chunks=[]; for(let k=0;k<cards.length;k+=6)chunks.push(cards.slice(k,k+6)); const desc=chunks.slice(0,6).map((g,idx)=>`**Formation ${idx+1}** — PWR **${money(g.reduce((s,c)=>s+c.power,0))}**\n${g.map((card,j)=>`${j+1}. ${emoji(card.character.rarity)} ${clean(card.character.name)} • Lv${card.level} • PWR ${money(card.power)} • ${roleOf(card.character)}`).join('\n')}`).join('\n\n'); return i.reply({embeds:[new EmbedBuilder().setTitle('Formations').setDescription(desc||'No cards.').setColor(0x5865f2)]}); }
  if (commandName === 'autoteam') return i.reply('Auto team now uses your strongest upgraded inventory cards automatically in /formations and battles.');
  if (commandName === 'tower') return i.reply({ content:'❌ /tower is disabled in VoidRoll Reborn. Use /story or /dungeon.', ephemeral:true });
  if (commandName === 'pvp') return handleBattlePolishCommand(i);
  if (commandName === 'boss-rush') return i.reply({ content:'❌ /boss-rush is disabled. Use /world-boss and /raid-attack.', ephemeral:true });
  if (commandName === 'market') { const m=dailyMarket(); const u=await ensureUser(i.user); const lines=[]; for(const item of m.items){ lines.push(`**${item.name}**\nID: \`${item.id}\` • Cost **${money(item.costGold)} Gold** • Stock **${item.stock}**\nReward: ${item.reward.rolls?`Rolls +${item.reward.rolls}`:''} ${item.reward.tokens?`Tokens +${item.reward.tokens}`:''}`); } return i.reply({embeds:[new EmbedBuilder().setTitle('Daily Market').setDescription(`Resets <t:${m.reset}:R>\nYour Gold: **${money(u.gold)}**\n\n${lines.join('\n\n')}`).setColor(0x8e44ad)]}); }
  if (commandName === 'market-buy') { await i.deferReply(); const itemId=i.options.getString('item_id',true); const m=dailyMarket(); const item=m.items.find(x=>x.id===itemId); if(!item)return i.editReply('Item not found.'); const bought=await marketBought(userId,itemId); if(bought>=item.stock)return i.editReply('Daily stock reached for this item.'); const u=await ensureUser(i.user); if(big(u.gold)<item.costGold)return i.editReply(`Need **${money(item.costGold)} Gold**.`); await prisma.user.update({where:{id:userId},data:{gold:big(u.gold)-item.costGold,tokens:Number(u.tokens||0)+(item.reward.tokens||0),rolls:Number(u.rolls||0)+(item.reward.rolls||0)}}); await marketAdd(userId,itemId); return i.editReply(`Bought **${item.name}**.`); }
  if (commandName === 'gift-character') { await i.deferReply(); const target=i.options.getUser('user',true); const card=await ownedCardByIdOrBest(userId,i.options.getString('card',true)); if(!card)return i.editReply('Card not found.'); if(target.bot || target.id===userId)return i.editReply('Invalid target.'); await ensureUser(target); await prisma.userCard.update({where:{id:card.id},data:{userId:target.id}}); return i.editReply(`${i.user} gifted ${target}: ${emoji(card.character.rarity)} **${clean(card.character.name)}** Lv${card.level} PWR ${money(card.power)}.`); }
  if (commandName === 'trade-offer') { await i.deferReply(); const buyer=i.options.getUser('user',true); const card=await ownedCardByIdOrBest(userId,i.options.getString('card',true)); const price=i.options.getInteger('tokens',true); if(!card)return i.editReply('Card not found.'); if(buyer.id===userId || buyer.bot)return i.editReply('Invalid buyer.'); const tradeId=id('trade'); pendingTrades.set(tradeId,{sellerId:userId,buyerId:buyer.id,cardId:card.id,price,expiresAt:Date.now()+600000}); const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`accept_${tradeId}`).setLabel('Accept Trade').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`decline_${tradeId}`).setLabel('Decline').setStyle(ButtonStyle.Danger)); return i.editReply({content:`**Trade Offer**\nSeller: ${i.user}\nBuyer: ${buyer}\nCard: ${emoji(card.character.rarity)} **${clean(card.character.name)}** Lv${card.level} PWR ${money(card.power)}\nPrice: **${money(price)} Tokens**\nTrade ID: \`${tradeId}\``,components:[row]}); }
  if (commandName === 'trade-accept') { await i.deferReply(); return completeTrade(i,i.options.getString('trade_id',true)); }
  if (commandName === 'trade-decline' || commandName === 'trade-cancel') { const tradeId=i.options.getString('trade_id',true); pendingTrades.delete(tradeId); return i.reply(`Trade \`${tradeId}\` cancelled.`); }
  if (commandName === 'trades') { const rows=[]; for(const [tid,t] of pendingTrades.entries()) if(t.sellerId===userId || t.buyerId===userId) rows.push(`\`${tid}\` <@${t.sellerId}> → <@${t.buyerId}> • ${money(t.price)} Tokens`); return i.reply(rows.join('\n')||'No pending trades.'); }
  if (commandName === 'admin-reset-all') { const confirm=i.options.getString('confirm',true); if(confirm!=='YES')return i.reply('Type YES.'); await prisma.teamSlot.deleteMany({}).catch(()=>{}); await prisma.userEquipment.deleteMany({}).catch(()=>{}); await prisma.marketListing.deleteMany({}).catch(()=>{}); await prisma.deployment.deleteMany({}).catch(()=>{}); await prisma.userCard.deleteMany({}); await prisma.storyProgress.deleteMany({}).catch(()=>{}); await prisma.user.updateMany({data:{gold:25000,tokens:1000,rolls:25,storyChapter:1,storyStage:1,dungeonStage:1,towerFloor:1,meta:{}}}).catch(()=>{}); return i.reply('Full player reset complete. Characters database kept.'); }
  if (commandName === 'admin-give-gold') { const u=i.options.getUser('user',true); const amount=BigInt(i.options.getInteger('amount',true)); await ensureUser(u); await prisma.user.update({where:{id:u.id},data:{gold:{increment:amount}}}); return i.reply(`Gave ${u} ${money(amount)} Gold.`); }
  if (commandName === 'admin-give-tokens') { const u=i.options.getUser('user',true); const amount=i.options.getInteger('amount',true); await ensureUser(u); await prisma.user.update({where:{id:u.id},data:{tokens:{increment:amount}}}); return i.reply(`Gave ${u} ${money(amount)} Tokens.`); }
  if (commandName === 'admin-give-rolls') { const u=i.options.getUser('user',true); const amount=i.options.getInteger('amount',true); await ensureUser(u); await prisma.user.update({where:{id:u.id},data:{rolls:{increment:amount}}}); return i.reply(`Gave ${u} ${money(amount)} Rolls.`); }
  if (commandName === 'admin-give-resource') { const u=i.options.getUser('user',true); const resource=i.options.getString('resource',true); const amount=i.options.getInteger('amount',true); await ensureUser(u); const data={}; if(resource==='essence') data.essence={increment:amount}; else if(resource==='void_crystals') data.voidCrystals={increment:amount}; else return i.reply('Unknown resource.'); await prisma.user.update({where:{id:u.id},data}); return i.reply(`Gave ${u} ${money(amount)} ${resource==='essence'?'Essence':'Void Crystals'}.`); }
  if (commandName === 'admin-dedupe-characters') return i.reply('Dedupe skipped in 2.0 clean build. Use active character curation list instead.');
  return i.reply('Command is registered but not implemented yet in clean launch build.');
}
async function completeTrade(i, tradeId) { const t=pendingTrades.get(tradeId); if(!t)return i.editReply('Trade not found.'); if(Date.now()>t.expiresAt){pendingTrades.delete(tradeId);return i.editReply('Trade expired.');} if(i.user.id!==t.buyerId)return i.editReply('Only buyer can accept.'); const card=await prisma.userCard.findUnique({where:{id:t.cardId},include:{character:true}}).catch(()=>null); if(!card || card.userId!==t.sellerId){pendingTrades.delete(tradeId);return i.editReply('Seller no longer owns card.');} const buyer=await ensureUser(t.buyerId); const seller=await ensureUser(t.sellerId); if(Number(buyer.tokens)<t.price)return i.editReply(`Not enough Tokens. Need **${money(t.price)}**, you have **${money(buyer.tokens)}**.`); await prisma.user.update({where:{id:t.buyerId},data:{tokens:{decrement:t.price}}}); await prisma.user.update({where:{id:t.sellerId},data:{tokens:{increment:t.price}}}); await prisma.userCard.update({where:{id:t.cardId},data:{userId:t.buyerId}}); pendingTrades.delete(tradeId); return i.editReply(`Trade completed: <@${t.buyerId}> bought **${clean(card.character.name)}** from <@${t.sellerId}> for **${money(t.price)} Tokens**.`); }

client.on('interactionCreate', async i => {
  try {
    if (i.isAutocomplete()) return autocomplete(i);
    if (i.isButton()) { await i.deferReply({ ephemeral:false }).catch(()=>{}); const [action, tradeId] = i.customId.split('_'); if(action==='accept') return completeTrade(i,tradeId); if(action==='decline'){ pendingTrades.delete(tradeId); return i.editReply('Trade declined.'); } }
    if (!i.isChatInputCommand()) return;
    return command(i);
  } catch (err) {
    console.error(err);
    const msg = `Error: ${String(err.message || err).slice(0,1500)}`;
    if (i.deferred || i.replied) return i.editReply(msg).catch(()=>{});
    return i.reply({ content: msg, ephemeral:true }).catch(()=>{});
  }
});

client.once('clientReady', () => console.log(`Logged in as ${client.user.tag}`));

const app = express();
app.get('/', (req,res)=>res.send('VoidRoll 2.0 is alive'));
app.get('/health', (req,res)=>res.json({ ok:true }));
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Health server on ${port}`));

const token = config.discordToken || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
if (!token) { console.error('Missing DISCORD_TOKEN/BOT_TOKEN'); process.exit(1); }
client.login(token);
