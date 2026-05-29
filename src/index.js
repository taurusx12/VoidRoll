require('dotenv').config();

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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const pendingTrades = global.pendingTrades || new Map();
global.pendingTrades = pendingTrades;

const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','VOIDBORN','SECRET'];
const RARITY_EMOJI = { COMMON:'🟢', RARE:'🔵', EPIC:'🟣', LEGENDARY:'🟡', MYTHIC:'🔴', DIVINE:'⚪', VOIDBORN:'🌌', SECRET:'🌠' };
const RARITY_VALUE = { COMMON:1, RARE:2, EPIC:3, LEGENDARY:4, MYTHIC:5, DIVINE:6, VOIDBORN:7, SECRET:8 };
const ROLL_RATES = [
  ['COMMON', 72], ['RARE', 22], ['EPIC', 5.65], ['LEGENDARY', 1], ['MYTHIC', 0.75], ['DIVINE', 0.1], ['SECRET', 0.00001]
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
async function addWallet(userId, { gold=0n, tokens=0, rolls=0 } = {}) {
  const u = await ensureUser(String(userId));
  const data = {};
  if (gold) data.gold = big(u.gold) + big(gold);
  if (tokens) data.tokens = Math.max(0, Number(u.tokens || 0) + Number(tokens));
  if (rolls) data.rolls = Math.max(0, Number(u.rolls || 0) + Number(rolls));
  return prisma.user.update({ where:{ id:String(userId) }, data });
}

function roleOf(c) {
  const n = norm(c?.name);
  if (['aizen','lelouch','makima','kurapika','shikamaru','light yagami'].some(x=>n.includes(x))) return 'Control';
  if (['all might','kaido','whitebeard','escanor','reinhard','saber','artoria'].some(x=>n.includes(x))) return 'Tank';
  if (['rimuru','orihime','tsunade','rem','emilia','kakashi'].some(x=>n.includes(x))) return 'Support';
  if (['toji','killua','levi','hisoka','zenitsu','yoriichi'].some(x=>n.includes(x))) return 'Assassin';
  if (['gojo','sukuna','madara','gilgamesh','ainz','megumin'].some(x=>n.includes(x))) return 'Mage';
  return 'DPS';
}
function elementOf(c) {
  const n = norm(c?.name); const a = norm(c?.anime);
  if (['aizen','ichigo','yhwach','rukia'].some(x=>n.includes(x)) || a.includes('bleach')) return 'Soul';
  if (['gojo','sukuna','yuta','toji','geto'].some(x=>n.includes(x)) || a.includes('jujutsu')) return 'Cursed';
  if (['jin woo','igris','beru','ashborn'].some(x=>n.includes(x))) return 'Shadow';
  if (['rimuru','aizen','madara','makima','lelouch'].some(x=>n.includes(x))) return 'Void';
  if (['natsu','ace','rengoku'].some(x=>n.includes(x))) return 'Fire';
  if (['killua','zenitsu','laxus'].some(x=>n.includes(x))) return 'Lightning';
  if (['naruto','goku','luffy','saber'].some(x=>n.includes(x))) return 'Light';
  return c?.element || 'Neutral';
}
function passiveOf(c) {
  const n = norm(c?.name);
  if (n.includes('aizen')) return { name:'Kyoka Suigetsu', text:'20% enemy miss chance and -10% enemy ATK.', effect:{ miss:20, enemyAtk:-10 } };
  if (n.includes('gojo')) return { name:'Infinity', text:'Blocks the first heavy hit each battle and +15% dodge.', effect:{ shield:1, dodge:15 } };
  if (n.includes('makima')) return { name:'Control Devil', text:'Weakens the strongest enemy and gives team +12% damage.', effect:{ teamDmg:12, enemyAtk:-15 } };
  if (n.includes('rimuru')) return { name:'Predator', text:'Heals after attacking and steals 8% enemy defense.', effect:{ lifesteal:12, pen:8 } };
  if (n.includes('lelouch')) return { name:'Geass Command', text:'30% chance to stun and reduce enemy damage.', effect:{ stun:30, enemyAtk:-12 } };
  if (n.includes('sukuna')) return { name:'Malevolent Shrine', text:'+25% boss damage and execute low HP enemies.', effect:{ bossDmg:25, execute:15 } };
  if (n.includes('madara')) return { name:'Wake Up To Reality', text:'+20% AoE damage and +10% defense.', effect:{ dmg:20, def:10 } };
  if (n.includes('itachi')) return { name:'Tsukuyomi', text:'High control accuracy and 15% enemy miss chance.', effect:{ miss:15, control:20 } };
  if (n.includes('saber') || n.includes('artoria')) return { name:'Excalibur', text:'Tank barrier and burst light damage.', effect:{ def:20, dmg:12 } };
  return { name:`${roleOf(c)} Mastery`, text:`${roleOf(c)} passive affects real battle stats.`, effect:{ dmg:8 } };
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
  const s = statsFor(card,c); const p = passiveOf(c);
  return `Type: **${s.role}** | Element: **${s.element}**\n`+
    `Level: **${s.level}/100** | Power: **${money(s.power)}**\n`+
    `HP **${money(s.hp)}** • ATK **${money(s.atk)}** • DEF **${money(s.def)}** • SPD **${money(s.speed)}**\n`+
    `Crit **${s.critRate}%** • Crit DMG **${s.critDamage}%** • Dodge **${s.dodge}%** • Accuracy **${s.accuracy}%**\n`+
    `Passive: **${p.name}** — ${p.text}`;
}

async function findCharacter(query) {
  const q = norm(query);
  if (!q) return null;
  const chars = await prisma.character.findMany({ where:{ active:true }, take:1000, orderBy:{ basePower:'desc' } }).catch(()=>[]);
  return chars.map(c=>{
    const txt = `${norm(clean(c.name))} ${norm(c.name)} ${norm(c.anime)}`;
    let score = 0; for (const t of q.split(' ').filter(Boolean)) if (txt.includes(t)) score += 100;
    if (norm(clean(c.name)) === q) score += 500;
    return { c, score };
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || b.c.basePower-a.c.basePower)[0]?.c || null;
}
async function ownedCardByIdOrBest(userId, value) {
  if (!value) return null;
  let card = await prisma.userCard.findFirst({ where:{ id:String(value), userId:String(userId) }, include:{ character:true } }).catch(()=>null);
  if (card) return card;
  const q = norm(value);
  const cards = await prisma.userCard.findMany({ where:{ userId:String(userId) }, include:{ character:true }, orderBy:{ power:'desc' }, take:2000 }).catch(()=>[]);
  return cards.map(card=>{
    const txt = `${norm(clean(card.character.name))} ${norm(card.character.name)} ${norm(card.character.anime)} ${shortId(card.id).toLowerCase()}`;
    let score = 0; for (const t of q.split(' ').filter(Boolean)) if (txt.includes(t)) score += 100;
    if (shortId(card.id).toLowerCase() === q) score += 1000;
    return { card, score };
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || b.card.power-a.card.power)[0]?.card || null;
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
  const pool = await prisma.character.findMany({ where:{ active:true, rarity:'SECRET' }, orderBy:{ basePower:'desc' }, take:500 }).catch(()=>[]);
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
    if (['card','name'].includes(name) && ['gift-character','trade-offer','train','auto-train','view-card'].includes(cmd)) {
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
    if (['character','name'].includes(name) && ['character','who-has','characters','wishlist-add'].includes(cmd)) {
      const chars = await prisma.character.findMany({ where:{ active:true }, orderBy:{ basePower:'desc' }, take:1500 }).catch(()=>[]);
      const out = chars
        .filter(c=>!q || `${norm(c.name)} ${norm(c.anime)}`.includes(q))
        .slice(0,25)
        .map(c=>choice(`${clean(c.name)} • ${c.anime} • ${c.rarity}`, clean(c.name)));
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
function revealQuote(name='') { const n=norm(name); if(n.includes('madara'))return 'Wake up to reality.'; if(n.includes('aizen'))return 'Since when were you under the impression?'; if(n.includes('gojo'))return 'Throughout heaven and earth...'; if(n.includes('sukuna'))return 'Know your place.'; if(n.includes('lelouch'))return 'Obey me, world.'; if(n.includes('rimuru'))return 'I will devour everything.'; if(n.includes('makima'))return 'You belong to me.'; if(n.includes('itachi'))return 'Reality is only an illusion.'; return 'A legend has awakened from the void.'; }

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
  await i.deferReply(); const userId=i.user.id; const p=await getProgress(userId); const team=await bestTeam(userId, mode==='story'?6:12); if(!team.length) return i.editReply('You need characters first. Use /roll.');
  const current = mode==='story' ? ((p.chapter-1)*30+p.stage) : mode==='tower' ? p.towerFloor : p.dungeonFloor;
  const required = mode==='story' ? 2500 + current*850 : mode==='tower' ? 4500 + current*1200 : 3500 + current*1000;
  const b = await battleScore(team, mode==='tower'?'boss':mode);
  const won = b.score >= required || Math.random() < Math.min(.20, b.score/Math.max(1,required)/5);
  if(won){ const data={}; if(mode==='story'){ let st=p.stage+1, ch=p.chapter; if(st>30){ch++;st=1;} data.chapter=ch; data.stage=st; } if(mode==='tower') data.towerFloor=p.towerFloor+1; if(mode==='dungeon') data.dungeonFloor=p.dungeonFloor+1; await prisma.storyProgress.update({ where:{ userId:String(userId) }, data }); await addWallet(userId,{ gold:BigInt(Math.floor(required*.8)), tokens: current%5===0?5:0, rolls:1 }); }
  const embed=new EmbedBuilder().setTitle(`${mode.toUpperCase()} ${won?'VICTORY':'DEFEAT'}`).setDescription(`Stage: **${current}**\nTeam Score: **${money(b.score)}**\nRequired: **${money(required)}**\nRoles: **${b.roles.join(', ')}**\n\n${b.logs.slice(0,6).join('\n')}\n\n${won?`Rewards: **${money(Math.floor(required*.8))} Gold**, **1 Roll**`:'Tip: use Tank + Support + Control, not only Power.'}`).setColor(won?0x2ecc71:0xe74c3c);
  return i.editReply({ embeds:[embed] });
}

async function command(i) {
  const commandName = i.commandName; const userId = i.user.id; await ensureUser(i.user);
  if (commandName === 'help') return i.reply('**VoidRoll 2.0**\nCore: /profile /inventory /view-card /characters /character /anime /collection /who-has\nSummon: /roll /banner /pack /pity /rates\nProgress: /train /auto-train /formations /autoteam /story /tower /dungeon\nEconomy: /market /market-buy /gift-character /trade-offer /trades\nAdmin: /admin-reset-all /admin-give-gold /admin-give-tokens /admin-give-rolls');
  if (commandName === 'profile') { const u=await ensureUser(i.user); const count=await prisma.userCard.count({where:{userId}}); return i.reply(`**${i.user.username}**\nGold: **${money(u.gold)}**\nTokens: **${money(u.tokens)}**\nRolls: **${money(u.rolls)}**\nCards: **${count}**\nStory: **${u.storyChapter}-${u.storyStage}**`); }
  if (commandName === 'daily') { const u=await ensureUser(i.user); const now=Date.now(); if(u.lastDailyAt && now - new Date(u.lastDailyAt).getTime() < 20*3600000) return i.reply('Daily already claimed.'); await prisma.user.update({where:{id:userId},data:{lastDailyAt:new Date(),dailyStreak:{increment:1},gold:{increment:50000},tokens:{increment:100},rolls:{increment:5}}}); return i.reply('Daily claimed: **50,000 Gold**, **100 Tokens**, **5 Rolls**.'); }
  if (commandName === 'rates' || commandName === 'rarity') return i.reply('**Normal Roll Rates**\nCommon 72%\nRare 22%\nEpic 5.65%\nLegendary 1%\nMythic 0.75%\nDivine 0.1%\nSecret 0.00001%');
  if (commandName === 'roll' || commandName === 'r') { await i.deferReply(); const amount=clamp(i.options.getInteger('amount')||1,1,10); const u=await ensureUser(i.user); if(Number(u.rolls)<amount) return i.editReply(`Not enough rolls. You have **${u.rolls}**.`); await prisma.user.update({where:{id:userId},data:{rolls:{decrement:amount}}}); const lines=[]; const embeds=[]; for(let x=0;x<amount;x++){ const r=pickRarity(); const c=await randomCharacterByRarity(r); if(!c) continue; const card=await createCard(userId,c); lines.push(`${x+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.anime} • ${c.rarity} • PWR **${money(card.power)}**`); if(c.rarity==='SECRET'){ await i.channel?.send({ embeds:[new EmbedBuilder().setTitle('🌠 SECRET REVEAL').setDescription(`“${revealQuote(c.name)}”`).setColor(0x000000)] }).catch(()=>{}); } if(amount<=3){ const e=new EmbedBuilder().setTitle(`${emoji(c.rarity)} ${clean(c.name)}`).setDescription(`${c.anime}\n${statBlock(card,c)}`).setColor(c.rarity==='SECRET'?0xe74c3c:0x5865f2); if(c.imageUrl)e.setImage(c.imageUrl); embeds.push(e); } } return i.editReply({ content:lines.join('\n').slice(0,1900), embeds }); }
  if (commandName === 'banner') { const picks=await bannerCharacters(); const lines=[]; for(const c of picks) lines.push(`${emoji(c.rarity)} **${clean(c.name)}** • ${c.anime} • Pulls **${await pityGet(userId,c.id)}/50**`); return i.reply({embeds:[new EmbedBuilder().setTitle('Daily SECRET Banner').setDescription(`${lines.join('\n')}\n\n10 pulls cost **4,000 Tokens**. Guaranteed selected SECRET at **50 pulls**.`).setColor(0xe74c3c)]}); }
  if (commandName === 'pack') { await i.deferReply(); const charId=i.options.getString('banner',true); const selected=await prisma.character.findUnique({where:{id:charId}}).catch(()=>null); if(!selected) return i.editReply('Choose a banner character from autocomplete.'); const u=await ensureUser(i.user); if(Number(u.tokens)<4000) return i.editReply(`Need **4,000 Tokens**. You have **${u.tokens}**.`); await prisma.user.update({where:{id:userId},data:{tokens:{decrement:4000}}}); let pity=await pityGet(userId,selected.id); const before=pity; const rarities=['RARE','RARE','RARE','EPIC','EPIC','EPIC','LEGENDARY','LEGENDARY','MYTHIC','DIVINE']; let secretAt=-1; for(let j=0;j<10;j++){ const next=pity+j+1; const soft=next>=35?Math.min(.20,(next-34)*.01):0; if(next>=50 || Math.random()<(.01+soft)){secretAt=j; break;} } if(secretAt>=0) rarities[secretAt]='SECRET'; const lines=[]; for(let j=0;j<10;j++){ pity++; let c; if(rarities[j]==='SECRET'){ c=selected; pity=0; await i.channel?.send({ embeds:[new EmbedBuilder().setTitle('🌠 SECRET REVEAL').setDescription(`“${revealQuote(c.name)}”`).setColor(0x000000)] }).catch(()=>{}); } else c=await randomCharacterByRarity(rarities[j]); const card=await createCard(userId,c); lines.push(`${j+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.rarity} • PWR **${money(card.power)}**`); } await pitySet(userId,selected.id,pity); return i.editReply(`**PACK x10**\nSelected: **${clean(selected.name)}**\nPity: **${before}/50 → ${pity}/50**\n\n${lines.join('\n')}`); }
  if (commandName === 'pity') { const picks=await bannerCharacters(); const lines=[]; for(const c of picks) lines.push(`**${clean(c.name)}**: ${await pityGet(userId,c.id)}/50`); return i.reply(lines.join('\n')||'No banner.'); }
  if (commandName === 'inventory') { const res=await ownedCards(userId,{ character:i.options.getString('character'), anime:i.options.getString('anime'), rarity:i.options.getString('rarity'), role:i.options.getString('type'), element:i.options.getString('element'), sort:i.options.getString('sort')||'power', page:i.options.getInteger('page')||1 }); const lines=res.items.map((card,idx)=>`${(res.page-1)*10+idx+1}. ${emoji(card.character.rarity)} **${clean(card.character.name)}** • ${card.character.anime}\n   ID **${shortId(card.id)}** • Lv **${card.level}** • PWR **${money(card.power)}** • ${roleOf(card.character)} • ${elementOf(card.character)}`).join('\n'); return i.reply({embeds:[new EmbedBuilder().setTitle('Inventory').setDescription(`Page **${res.page}/${res.pages}** • Total **${res.total}**\n\n${lines||'No cards found.'}`).setColor(0x5865f2)]}); }
  if (commandName === 'view-card' || commandName==='character') { const val=i.options.getString('card') || i.options.getString('name') || i.options.getString('character'); let card=await ownedCardByIdOrBest(userId,val); if(card){ const e=new EmbedBuilder().setTitle(`${emoji(card.character.rarity)} ${clean(card.character.name)} • ${shortId(card.id)}`).setDescription(`${card.character.anime}\nRarity: **${card.character.rarity}**\n${statBlock(card,card.character)}`).setColor(0x8e44ad); if(card.character.imageUrl)e.setImage(card.character.imageUrl); return i.reply({embeds:[e]}); } const c=await findCharacter(val); if(!c)return i.reply('Character not found.'); const fake={power:c.basePower,level:1}; const e=new EmbedBuilder().setTitle(`${emoji(c.rarity)} ${clean(c.name)}`).setDescription(`${c.anime}\nRarity: **${c.rarity}**\n${statBlock(fake,c)}`).setColor(0x8e44ad); if(c.imageUrl)e.setImage(c.imageUrl); return i.reply({embeds:[e]}); }
  if (commandName === 'characters' || commandName==='top-characters') { const anime=i.options.getString('anime'); const rarity=i.options.getString('rarity'); const role=i.options.getString('type'); const page=i.options.getInteger('page')||1; let chars=await prisma.character.findMany({ where:{ active:true }, orderBy:{basePower:'desc'}, take:5000 }).catch(()=>[]); if(anime)chars=chars.filter(c=>norm(c.anime).includes(norm(anime))); if(rarity&&rarity!=='ALL')chars=chars.filter(c=>c.rarity===rarity); if(role&&role!=='ALL')chars=chars.filter(c=>roleOf(c)===role); const pages=Math.max(1,Math.ceil(chars.length/10)); const p=pageBounds(page,pages); const items=chars.slice((p-1)*10,p*10); return i.reply({embeds:[new EmbedBuilder().setTitle('Character Index').setDescription(`Page **${p}/${pages}** • Total **${chars.length}**\n\n${items.map((c,k)=>`${(p-1)*10+k+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.anime} • PWR **${money(c.basePower)}** • ${roleOf(c)}`).join('\n')}`).setColor(0x3498db)]}); }
  if (commandName === 'anime' || commandName==='collection') { const anime=i.options.getString('anime',true); const all=await prisma.character.findMany({where:{active:true},orderBy:{basePower:'desc'},take:6000}).catch(()=>[]); const chars=all.filter(c=>norm(c.anime).includes(norm(anime))); if(!chars.length)return i.reply('Anime not found.'); const owned=await prisma.userCard.findMany({where:{userId},include:{character:true},take:10000}).catch(()=>[]); const ownedNames=new Set(owned.map(x=>norm(clean(x.character.name))+'|'+norm(x.character.anime))); const got=chars.filter(c=>ownedNames.has(norm(clean(c.name))+'|'+norm(c.anime))); const missing=chars.filter(c=>!ownedNames.has(norm(clean(c.name))+'|'+norm(c.anime))).slice(0,15); return i.reply({embeds:[new EmbedBuilder().setTitle(`📚 ${chars[0].anime} Library`).setDescription(`Collected: **${got.length}/${chars.length}** (${Math.floor(got.length/Math.max(1,chars.length)*100)}%)\nStrongest: **${clean(chars[0].name)}**\n\n**Missing preview**\n${missing.map(c=>`${emoji(c.rarity)} ${clean(c.name)} • ${c.rarity}`).join('\n')||'Complete!'}\n\nRewards: 25% / 50% / 75% / 100% collection chests.`).setColor(0x1abc9c)]}); }
  if (commandName === 'who-has') { const name=i.options.getString('name',true); const c=await findCharacter(name); if(!c)return i.reply('Character not found.'); const cards=await prisma.userCard.findMany({where:{characterId:c.id},include:{user:true,character:true},orderBy:{power:'desc'},take:10}).catch(()=>[]); return i.reply({embeds:[new EmbedBuilder().setTitle(`Who has ${clean(c.name)}?`).setDescription(cards.map((card,idx)=>`${idx+1}. <@${card.userId}> • Lv **${card.level}** • PWR **${money(card.power)}** • ID **${shortId(card.id)}**`).join('\n')||'Nobody owns this character yet.').setColor(0xf39c12)]}); }
  if (commandName === 'train' || commandName==='auto-train') { await i.deferReply(); const card=await ownedCardByIdOrBest(userId, i.options.getString('card') || i.options.getString('name')); if(!card)return i.editReply('Card not found. Use autocomplete.'); const u=await ensureUser(i.user); let gold=big(u.gold); let level=card.level; let power=card.power; let spent=0n; let gains=0; const maxRuns=commandName==='train'?1:100; for(let k=0;k<maxRuns && level<100;k++){ const cost=BigInt(5000 + level*3500 + Math.floor(power*.03)); if(gold<cost)break; gold-=cost; spent+=cost; level++; power+=Math.floor(card.character.basePower*.045 + level*50); gains++; } if(!gains)return i.editReply('Not enough Gold or already max level.'); await prisma.user.update({where:{id:userId},data:{gold}}); await prisma.userCard.update({where:{id:card.id},data:{level,power}}); return i.editReply(`Trained **${clean(card.character.name)}** +${gains} levels.\nLevel: **${card.level} → ${level}**\nPower: **${money(card.power)} → ${money(power)}**\nSpent: **${money(spent)} Gold**`); }
  if (commandName === 'formations') { const cards=await bestTeam(i.options.getUser('user')?.id||userId,36); const chunks=[]; for(let k=0;k<cards.length;k+=6)chunks.push(cards.slice(k,k+6)); const desc=chunks.slice(0,6).map((g,idx)=>`**Formation ${idx+1}** — PWR **${money(g.reduce((s,c)=>s+c.power,0))}**\n${g.map((card,j)=>`${j+1}. ${emoji(card.character.rarity)} ${clean(card.character.name)} • Lv${card.level} • PWR ${money(card.power)} • ${roleOf(card.character)}`).join('\n')}`).join('\n\n'); return i.reply({embeds:[new EmbedBuilder().setTitle('Formations').setDescription(desc||'No cards.').setColor(0x5865f2)]}); }
  if (commandName === 'autoteam') return i.reply('Auto team now uses your strongest upgraded inventory cards automatically in /formations and battles.');
  if (['story','tower','dungeon'].includes(commandName)) return progressBattle(i,commandName);
  if (commandName === 'pvp') { await i.deferReply(); const opp=i.options.getUser('opponent',true); const a=await battleScore(await bestTeam(userId,6),'pvp'); const b=await battleScore(await bestTeam(opp.id,6),'pvp'); const win=a.score>=b.score; return i.editReply(`**PVP ${win?'WIN':'LOSE'}**\nYour Score: **${money(a.score)}**\n${opp}'s Score: **${money(b.score)}**\nRoles matter: Tank/Support/Control give real bonuses.`); }
  if (commandName === 'boss-rush') { await i.deferReply(); const cards=await bestTeam(userId,6); const b=await battleScore(cards,'boss'); const boss=Math.floor(10000+Math.random()*50000); const dmg=Math.floor(b.score*(.8+Math.random()*.4)); const win=dmg>=boss; const rewardGold=BigInt(Math.floor(dmg*.6)); await addWallet(userId,{gold:rewardGold,tokens:8,rolls:Math.max(1,Math.floor(dmg/50000))}); return i.editReply(`**Boss Rush**\nDamage: **${money(dmg)}**\nBoss HP: **${money(boss)}**\nResult: **${win?'CLEARED':'DAMAGED'}**\nRewards: **${money(rewardGold)} Gold**, **8 Tokens**, Rolls scale with damage.`); }
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

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

const app = express();
app.get('/', (req,res)=>res.send('VoidRoll 2.0 is alive'));
app.get('/health', (req,res)=>res.json({ ok:true }));
const port = process.env.PORT || 10000;
app.listen(port, () => console.log(`Health server on ${port}`));

const token = config.discordToken || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
if (!token) { console.error('Missing DISCORD_TOKEN/BOT_TOKEN'); process.exit(1); }
client.login(token);
