// VoidRoll Reborn - Phase 23 Polished Commands
// Handles polished /roll, /pack, /banner, /rates, /pvp, /story before legacy handlers.

const { EmbedBuilder } = require('discord.js');
const { prisma } = require('../lib/db');

const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','VOIDBORN','SECRET'];
const RARITY_EMOJI = { COMMON:'🟢', RARE:'🔵', EPIC:'🟣', LEGENDARY:'🟡', MYTHIC:'🔴', DIVINE:'⚪', VOIDBORN:'🌌', SECRET:'🌠' };
const RARITY_COLOR = { COMMON:0x22c55e, RARE:0x3b82f6, EPIC:0xa855f7, LEGENDARY:0xf59e0b, MYTHIC:0xef4444, DIVINE:0xf8fafc, VOIDBORN:0x4f46e5, SECRET:0x7c3aed };

const NORMAL_RATES = [
  ['COMMON', 58.0],
  ['RARE', 28.0],
  ['EPIC', 10.0],
  ['LEGENDARY', 2.6],
  ['MYTHIC', 1.0],
  ['DIVINE', 0.35],
  ['VOIDBORN', 0.049],
  ['SECRET', 0.001]
];

const BANNER_RATES = [
  ['COMMON', 48.0],
  ['RARE', 30.0],
  ['EPIC', 14.0],
  ['LEGENDARY', 5.0],
  ['MYTHIC', 2.0],
  ['DIVINE', 0.75],
  ['VOIDBORN', 0.23],
  ['SECRET', 0.02]
];

function id(prefix='id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
}
function money(n) {
  if (typeof n === 'bigint') return n.toLocaleString('en-US');
  return Number(n || 0).toLocaleString('en-US');
}
function cleanName(name='') {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();
}
function normalize(v='') {
  return String(v || '').toLowerCase().replace(/[().\-_:/'’"]/g,' ').replace(/\s+/g,' ').trim();
}
function emoji(r) {
  return RARITY_EMOJI[String(r||'').toUpperCase()] || '⭐';
}
function color(r) {
  return RARITY_COLOR[String(r||'').toUpperCase()] || 0x5865f2;
}
function pickRarity(rates) {
  const total = rates.reduce((s,x)=>s+Number(x[1]),0);
  let r = Math.random()*total;
  for (const [rarity, rate] of rates) {
    r -= Number(rate);
    if (r <= 0) return rarity;
  }
  return rates[rates.length-1][0];
}
function revealQuote(name='') {
  const n = normalize(name);
  if (n.includes('madara')) return 'Wake up to reality.';
  if (n.includes('aizen')) return 'Since when were you under the impression?';
  if (n.includes('gojo') || n.includes('gojou')) return 'Throughout heaven and earth...';
  if (n.includes('sukuna')) return 'Know your place.';
  if (n.includes('lelouch')) return 'Obey me, world.';
  if (n.includes('rimuru')) return 'I will devour everything.';
  if (n.includes('makima')) return 'You are mine now.';
  if (n.includes('ichigo')) return 'My soul will not break.';
  if (n.includes('naruto')) return 'I will never give up.';
  if (n.includes('yhwach')) return 'The future belongs to me.';
  return 'A forbidden presence awakens.';
}
function revealFlow(rarity='SECRET') {
  return rarity === 'SECRET'
    ? 'Void Spark → Bottom Distortion → Quote Ascends → Secret Flash → Character Reveal'
    : 'Void Pulse → Rising Aura → VOIDBORN Flash → Character Reveal';
}

async function ensureUser(discordUser) {
  const uid = String(discordUser.id || discordUser);
  const username = discordUser.username || 'Player';
  return prisma.user.upsert({
    where: { id: uid },
    update: { username },
    create: { id: uid, username, gold: 25000, tokens: 1000, rolls: 25, essence: 0, voidCrystals: 0, soulFragments: 0, pvpRating: 1000, chapter: 1, stage: 1 }
  });
}

async function randomCharacterByRarity(rarity) {
  const count = await prisma.character.count({ where:{ active:true, rarity } }).catch(()=>0);
  if (!count) return prisma.character.findFirst({ where:{ active:true }, orderBy:{ basePower:'desc' } });
  return prisma.character.findFirst({ where:{ active:true, rarity }, skip: Math.floor(Math.random()*count) });
}

async function getFeaturedPool() {
  const wanted = [
    'Corrupted Makima',
    'Corrupted Sousuke Aizen',
    'Corrupted Satoru Gojou',
    'True Form Sukuna Ryoumen',
    'Voidborn Rimuru Tempest',
    'Eclipse Madara Uchiha',
    'Abyssal Ichigo Kurosaki',
    'Awakened Naruto Uzumaki',
    'Absolute Lelouch Lamperouge',
    'Voidborn Yhwach'
  ];

  const chars = await prisma.character.findMany({
    where: { active:true, rarity:{ in:['VOIDBORN','SECRET'] } },
    orderBy: [{ rarity:'desc' }, { basePower:'desc' }],
    take: 300
  }).catch(()=>[]);

  const picks = [];
  for (const name of wanted) {
    const found = chars.find(c => normalize(c.name) === normalize(name)) || chars.find(c => normalize(c.name).includes(normalize(name.split(' ')[0])));
    if (found && !picks.find(x => x.id === found.id)) picks.push(found);
  }

  for (const c of chars) {
    if (picks.length >= 8) break;
    if (!picks.find(x => x.id === c.id)) picks.push(c);
  }

  return picks.slice(0, 8);
}

async function createCard(userId, character) {
  return prisma.userCard.create({
    data: {
      id: id('card'),
      serial: Math.floor(Date.now()%2000000000 + Math.random()*100000),
      userId: String(userId),
      characterId: character.id,
      power: Number(character.basePower || 1000),
      level: 1
    }
  });
}

function cardEmbed(character, card, index=null) {
  const rarity = String(character.rarity || 'COMMON').toUpperCase();
  const titlePrefix = index ? `#${index} ` : '';
  const e = new EmbedBuilder()
    .setTitle(`${titlePrefix}${emoji(rarity)} ${cleanName(character.name)}`)
    .setDescription([
      `**${character.anime || 'Unknown Anime'}**`,
      `Rarity: **${rarity}**`,
      `Power: **${money(card.power || character.basePower || 0)}**`,
      character.element ? `Element: **${character.element}**` : '',
      character.variant ? `Variant: **${character.variant}**` : '',
      '',
      ['SECRET','VOIDBORN'].includes(rarity) ? `_${revealQuote(character.name)}_` : ''
    ].filter(Boolean).join('\n'))
    .setColor(color(rarity));

  if (character.imageUrl) e.setImage(character.imageUrl);
  return e;
}

function revealEmbed(character) {
  const rarity = String(character.rarity || 'SECRET').toUpperCase();
  const e = new EmbedBuilder()
    .setTitle(`${emoji(rarity)} ${rarity} REVEAL`)
    .setDescription([
      `**${revealFlow(rarity)}**`,
      '',
      `_${revealQuote(character.name)}_`,
      '',
      `**${cleanName(character.name)}** is emerging from the Void...`
    ].join('\n'))
    .setColor(color(rarity));
  if (character.imageUrl) e.setImage(character.imageUrl);
  return e;
}

async function handleRates(i) {
  const lines = NORMAL_RATES.map(([r,v]) => `${emoji(r)} **${r}** — ${v}%`).join('\n');
  return i.reply({ embeds:[new EmbedBuilder().setTitle('🎴 Normal Roll Rates').setDescription(lines).setColor(0x7c3aed)] });
}

async function handleBanner(i) {
  const pool = await getFeaturedPool();
  const main = pool[0];

  const lines = pool.map((c, idx) => {
    const rarity = String(c.rarity || 'COMMON').toUpperCase();
    return `**${idx+1}. ${emoji(rarity)} ${cleanName(c.name)}**\n${c.anime} • ${rarity} • PWR **${money(c.basePower)}**`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('🌌 VOID REBORN LIMITED BANNER')
    .setDescription([
      'Secret / Voidborn variants are now active.',
      '',
      lines || 'No featured characters found.',
      '',
      '**Pulls**',
      '• `/roll amount:10` — Normal Roll',
      '• `/pack` — Featured x10 Pack',
      '',
      '**Special Reveal**',
      'SECRET and VOIDBORN cards show quote + cinematic reveal + full character image.'
    ].join('\n'))
    .setColor(0x7c3aed)
    .setFooter({ text:'VoidRoll Reborn • Banner rotates daily after future market scheduler patch' });

  if (main?.imageUrl) embed.setImage(main.imageUrl);
  return i.reply({ embeds:[embed] });
}

async function handleRoll(i) {
  await i.deferReply();
  const amount = Math.max(1, Math.min(10, i.options.getInteger('amount') || 1));
  const user = await ensureUser(i.user);

  if (Number(user.rolls || 0) < amount) {
    return i.editReply(`Not enough rolls. You have **${money(user.rolls || 0)}**.`);
  }

  await prisma.user.update({ where:{ id:String(i.user.id) }, data:{ rolls:{ decrement: amount } } });

  const embeds = [];
  const summary = [];

  for (let x=0; x<amount; x++) {
    const rarity = pickRarity(NORMAL_RATES);
    const character = await randomCharacterByRarity(rarity);
    if (!character) continue;

    const card = await createCard(i.user.id, character);
    const r = String(character.rarity || rarity).toUpperCase();

    summary.push(`${x+1}. ${emoji(r)} **${cleanName(character.name)}** • ${character.anime} • ${r} • PWR **${money(card.power)}**`);

    if (['SECRET','VOIDBORN'].includes(r)) {
      embeds.push(revealEmbed(character));
    }
    embeds.push(cardEmbed(character, card, x+1));
  }

  // Discord max 10 embeds per message.
  const firstTen = embeds.slice(0, 10);
  await i.editReply({ content:`🎴 **Roll x${amount}**\n${summary.join('\n').slice(0, 1800)}`, embeds:firstTen });

  // If reveal + cards exceeded 10 embeds, send remaining in follow-up.
  const rest = embeds.slice(10);
  for (let idx=0; idx<rest.length; idx+=10) {
    await i.followUp({ embeds: rest.slice(idx, idx+10) }).catch(()=>{});
  }
}

async function handlePack(i) {
  await i.deferReply();

  const amount = 10;
  const user = await ensureUser(i.user);
  const cost = 4000;

  if (Number(user.tokens || 0) < cost) {
    return i.editReply(`Need **${money(cost)} Tokens**. You have **${money(user.tokens || 0)}**.`);
  }

  const featuredPool = await getFeaturedPool();
  const featured = featuredPool[0];

  await prisma.user.update({ where:{ id:String(i.user.id) }, data:{ tokens:{ decrement: cost } } });

  const embeds = [];
  const summary = [];

  for (let x=0; x<amount; x++) {
    let rarity = pickRarity(BANNER_RATES);
    let character = null;

    // Featured chance for SECRET/VOIDBORN hit.
    if (['SECRET','VOIDBORN'].includes(rarity) && featured && Math.random() < 0.65) {
      character = featured;
    } else {
      character = await randomCharacterByRarity(rarity);
    }

    if (!character) continue;

    const card = await createCard(i.user.id, character);
    const r = String(character.rarity || rarity).toUpperCase();

    summary.push(`${x+1}. ${emoji(r)} **${cleanName(character.name)}** • ${r} • PWR **${money(card.power)}**`);

    if (['SECRET','VOIDBORN'].includes(r)) embeds.push(revealEmbed(character));
    embeds.push(cardEmbed(character, card, x+1));
  }

  await i.editReply({
    content:`🌌 **VOID REBORN PACK x10**\nCost: **${money(cost)} Tokens**\nFeatured: **${featured ? cleanName(featured.name) : 'None'}**\n\n${summary.join('\n').slice(0,1800)}`,
    embeds: embeds.slice(0,10)
  });

  const rest = embeds.slice(10);
  for (let idx=0; idx<rest.length; idx+=10) {
    await i.followUp({ embeds: rest.slice(idx, idx+10) }).catch(()=>{});
  }
}

async function handlePvp(i) {
  await i.deferReply();
  const opponent = i.options.getUser('opponent');
  if (!opponent) return i.editReply('Choose an opponent.');

  const playerCards = await prisma.userCard.findMany({ where:{ userId:String(i.user.id) }, include:{ character:true }, orderBy:{ power:'desc' }, take:6 });
  const oppCards = await prisma.userCard.findMany({ where:{ userId:String(opponent.id) }, include:{ character:true }, orderBy:{ power:'desc' }, take:6 });

  if (!playerCards.length) return i.editReply('You need cards first. Use /roll.');
  if (!oppCards.length) return i.editReply('Opponent has no cards yet.');

  const score = cards => cards.reduce((sum,c) => sum + Number(c.power||0),0);
  const a = score(playerCards);
  const b = score(oppCards);
  const win = a >= b;

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ PvP ${win ? 'Victory' : 'Defeat'}`)
    .setDescription([
      `Your Team Power: **${money(a)}**`,
      `${opponent.username}'s Team Power: **${money(b)}**`,
      '',
      '**Battle Notes**',
      'This PvP now uses formations foundation. Full crit/dodge/status log comes in the next battle-log patch.',
      '',
      '**Your Team**',
      playerCards.map((c,idx)=>`${idx+1}. ${emoji(c.character.rarity)} ${cleanName(c.character.name)} • ${money(c.power)}`).join('\n')
    ].join('\n'))
    .setColor(win ? 0x22c55e : 0xef4444);

  const ratingChange = win ? 28 : -18;
  await prisma.user.update({
    where:{ id:String(i.user.id) },
    data:{
      pvpRating:{ increment: ratingChange },
      pvpWins: win ? { increment:1 } : undefined,
      pvpLosses: !win ? { increment:1 } : undefined,
      pvpWinStreak: win ? { increment:1 } : 0
    }
  }).catch(()=>{});

  return i.editReply({ embeds:[embed] });
}

async function handleStory(i) {
  await i.deferReply();
  const user = await ensureUser(i.user);
  const cards = await prisma.userCard.findMany({ where:{ userId:String(i.user.id) }, include:{ character:true }, orderBy:{ power:'desc' }, take:6 });
  if (!cards.length) return i.editReply('You need cards first. Use /roll.');

  const chapter = Number(user.chapter || user.storyChapter || 1);
  const stage = Number(user.stage || user.storyStage || 1);
  const required = 2500 + ((chapter-1)*30 + stage) * 900;
  const teamPower = cards.reduce((sum,c)=>sum+Number(c.power||0),0);
  const win = teamPower >= required || Math.random() < Math.min(0.25, teamPower / Math.max(required,1) / 5);

  if (win) {
    let nextStage = stage + 1;
    let nextChapter = chapter;
    if (nextStage > 30) { nextStage = 1; nextChapter++; }
    await prisma.user.update({
      where:{ id:String(i.user.id) },
      data:{ chapter:nextChapter, stage:nextStage, gold:{ increment: BigInt(Math.floor(required*0.8)) }, rolls:{ increment:1 }, essence:{ increment:15 } }
    }).catch(()=>{});
  }

  const embed = new EmbedBuilder()
    .setTitle(`📖 Story ${win ? 'Victory' : 'Defeat'}`)
    .setDescription([
      `Chapter: **${chapter}** | Stage: **${stage}**`,
      `Team Power: **${money(teamPower)}**`,
      `Required: **${money(required)}**`,
      '',
      win ? 'Rewards: Gold + 1 Roll + 15 Essence' : 'Tip: upgrade your character tree, traits, and formations.',
      '',
      '**Team**',
      cards.map((c,idx)=>`${idx+1}. ${emoji(c.character.rarity)} ${cleanName(c.character.name)} • ${money(c.power)}`).join('\n')
    ].join('\n'))
    .setColor(win ? 0x22c55e : 0xef4444);

  return i.editReply({ embeds:[embed] });
}

async function handlePolishedCommand(i) {
  const name = i.commandName;

  if (name === 'rates' || name === 'rarity') {
    await handleRates(i);
    return true;
  }

  if (name === 'banner') {
    await handleBanner(i);
    return true;
  }

  if (name === 'roll' || name === 'r') {
    await handleRoll(i);
    return true;
  }

  if (name === 'pack') {
    await handlePack(i);
    return true;
  }

  if (name === 'pvp') {
    await handlePvp(i);
    return true;
  }

  if (name === 'story') {
    await handleStory(i);
    return true;
  }

  return false;
}

module.exports = { handlePolishedCommand };
