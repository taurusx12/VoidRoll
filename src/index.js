require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const { nanoid } = require('nanoid');

const config = require('./lib/config');
const { prisma } = require('./lib/db');
const { ensureUser } = require('./services/users');
const { rollCard } = require('./services/gacha');
const { checkCooldown, setCooldown } = require('./services/cooldowns');
const market = require('./services/market');
const equipment = require('./services/equipment');
const { getAura, embedColor } = require('./lib/aura');
const { renderCard } = require('./services/cardRender');
const { rollItem, itemLine, seedItemTemplates } = require('./services/itemSystem');
const bannerSystem = require('./services/bannerSystem');
const { fusionText, starLabel } = require('./services/duplicateFusion');
const { isSecretCandidate, classifyCharacter } = require('./lib/secretCharacters');
const { syncAllCardPowers } = require('./powerSyncPatch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const activeBosses = new Map();
const pendingTrades = new Map();




const RARITY_BASE_RANGES = {
  COMMON: { min: 50, max: 150 },
  RARE: { min: 150, max: 400 },
  EPIC: { min: 400, max: 900 },
  LEGENDARY: { min: 900, max: 1800 },
  MYTHIC: { min: 1800, max: 3500 },
  DIVINE: { min: 3500, max: 6000 },
  SECRET: { min: 6000, max: 10000 }
};

function rarityBasePower(rarity, seed = 1) {
  const range = RARITY_BASE_RANGES[rarity] || RARITY_BASE_RANGES.COMMON;
  const spread = Math.max(1, range.max - range.min);
  return range.min + (Math.abs(seed * 97) % spread);
}

function calculateDetailedStats(character, level = 1, ascension = 0) {
  const rarity = character?.rarity || 'COMMON';
  const role = characterRole(character);
  const basePower = Number(character?.basePower || rarityBasePower(rarity, level));
  const growth = 1 + ((level - 1) * 0.085) + (ascension * 0.18);

  let atkScale = 1;
  let hpScale = 1;
  let defScale = 1;
  let speedScale = 1;
  let critRate = 5;
  let critDmg = 150;
  let energyRegen = 100;
  let pen = 0;
  let lifesteal = 0;
  let shield = 0;
  let controlResist = 0;
  let ultCharge = 100;

  switch (role) {
    case 'Tank':
      hpScale = 2.4;
      defScale = 2.1;
      atkScale = 0.85;
      shield = 22;
      controlResist = 25;
      break;
    case 'Support':
      hpScale = 1.6;
      defScale = 1.3;
      energyRegen = 145;
      ultCharge = 135;
      shield = 12;
      break;
    case 'Control':
      hpScale = 1.4;
      defScale = 1.2;
      speedScale = 1.15;
      ultCharge = 125;
      controlResist = 15;
      break;
    case 'Assassin':
      atkScale = 1.45;
      speedScale = 1.4;
      critRate = 28;
      critDmg = 210;
      pen = 18;
      lifesteal = 8;
      break;
    case 'Mage':
      atkScale = 1.55;
      speedScale = 1.1;
      pen = 25;
      ultCharge = 120;
      break;
    default:
      atkScale = 1.3;
      hpScale = 1.3;
      critRate = 15;
      critDmg = 180;
      break;
  }

  const atk = Math.floor(basePower * atkScale * growth);
  const hp = Math.floor(basePower * 10 * hpScale * growth);
  const def = Math.floor(basePower * 0.85 * defScale * growth);
  const speed = Math.floor((100 + (basePower / 55)) * speedScale + (level * 0.8));

  return {
    atk,
    hp,
    def,
    speed,
    critRate,
    critDmg,
    energyRegen,
    pen,
    lifesteal,
    shield,
    controlResist,
    ultCharge
  };
}

function characterRole(character) {
  const n = phase2Normalize(character?.name || '');
  if (['lelouch','aizen','makima','kurapika'].some(x => n.includes(x))) return 'Control';
  if (['rimuru','megumi','kakashi'].some(x => n.includes(x))) return 'Support';
  if (['saber','artoria'].some(x => n.includes(x))) return 'Tank';
  if (['whitebeard','kaido','all might','escanor','ainz'].some(x => n.includes(x))) return 'Tank';
  if (['killua','toji','levi','hisoka'].some(x => n.includes(x))) return 'Assassin';
  if (['gojo','madara','gilgamesh','sukuna'].some(x => n.includes(x))) return 'Mage';
  return 'DPS';
}

function characterElement(character) {
  const n = phase2Normalize(character?.name || '');
  if (['sukuna','toji','lelouch','makima','ainz'].some(x => n.includes(x))) return 'Dark';
  if (['sung jin','igris','beru'].some(x => n.includes(x))) return 'Shadow';
  if (['gojo','rimuru','gilgamesh'].some(x => n.includes(x))) return 'Void';
  if (['saber','artoria','goku','naruto','luffy'].some(x => n.includes(x))) return 'Light';
  if (['ace','rengoku','natsu'].some(x => n.includes(x))) return 'Fire';
  if (['killua','zenitsu'].some(x => n.includes(x))) return 'Lightning';
  if (['aizen','ichigo'].some(x => n.includes(x))) return 'Soul';
  return character?.element || 'Neutral';
}

function characterPassive(character) {
  const n = phase2Normalize(character?.name || '');
  if (n.includes('lelouch')) return 'Geass: chance to disable enemy ultimate and boost team ult charge.';
  if (n.includes('gojo')) return 'Infinity: chance to ignore incoming damage.';
  if (n.includes('sung jin')) return 'Shadow Monarch: gains power for every defeated enemy.';
  if (n.includes('saber')) return 'Avalon: grants team shield when HP is low.';
  if (n.includes('ainz')) return 'Overlord: boosts dark allies and weakens enemies.';
  if (n.includes('gon') || n.includes('killua')) return 'Hunter Bond: bonus speed when paired with Hunter allies.';
  if (n.includes('kurapika')) return 'Chain Judgment: bonus damage against villain teams.';
  if (n.includes('madara')) return 'Uchiha Dominion: boosts AoE ultimate damage.';
  if (n.includes('aizen')) return 'Kyoka Suigetsu: reduces enemy accuracy.';
  return 'Battle Instinct: small bonus to ATK and Ultimate charge.';
}

function characterStatsText(card, character) {
  const level = Number(card?.level || 1);
  const ascension = getAscension(card);
  const stats = calculateDetailedStats(character, level, ascension);

  return (
    `Level: **${level}/99** | Ascension: **${ascension}**\n` +
    `Class: **${characterRole(character)}** | Element: **${characterElement(character)}**\n` +
    `ATK **${money(stats.atk)}** • HP **${money(stats.hp)}** • DEF **${money(stats.def)}** • SPD **${stats.speed}**\n` +
    `CRIT ${stats.critRate}% • CRIT DMG ${stats.critDmg}% • PEN ${stats.pen}%\n` +
    `Energy Regen ${stats.energyRegen}% • Ult Charge ${stats.ultCharge}%\n` +
    `Lifesteal ${stats.lifesteal}% • Shield ${stats.shield}% • Control Resist ${stats.controlResist}%\n` +
    `Passive: ${characterPassive(character)}`
  );
}

function levelCapForCard() {
  return 99;
}


async function ascendCard(cardId) {
  const card = await prisma.userCard.findUnique({
    where: { id: cardId },
    include: { character: true }
  });

  if (!card) throw new Error('Card not found.');

  const currentAsc = getAscension(card);
  const nextAsc = Math.min(15, currentAsc + 1);

  const rarityBonus = {
    COMMON: 15,
    RARE: 35,
    EPIC: 80,
    LEGENDARY: 150,
    MYTHIC: 280,
    DIVINE: 520,
    SECRET: 900
  }[card.character.rarity] || 10;

  const powerGain = rarityBonus * nextAsc;

  return prisma.userCard.update({
    where: { id: card.id },
    data: {
      trait: setAscensionTrait(card.trait, nextAsc),
      power: { increment: powerGain }
    },
    include: { character: true }
  });
}

async function addCardLevel(cardId, amount) {
  const card = await prisma.userCard.findUnique({ where: { id: cardId }, include: { character: true } });
  if (!card) throw new Error('Card not found.');
  const add = Math.max(1, Math.min(98, Number(amount || 1)));
  const newLevel = Math.min(99, (card.level || 1) + add);
  const gained = newLevel - (card.level || 1);
  const rarityMult = { COMMON: 25, RARE: 55, EPIC: 110, LEGENDARY: 240, MYTHIC: 520, DIVINE: 1100, SECRET: 2500 }[card.character.rarity] || 50;
  const powerGain = gained * rarityMult;
  return prisma.userCard.update({
    where: { id: card.id },
    data: { level: newLevel, power: { increment: powerGain } },
    include: { character: true }
  });
}

function phase2Normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

async function phase2FindUserCardByName(userId, name) {
  const q = phase2Normalize(name);
  if (!q) throw new Error('Write a character name.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' }
  });

  const exact = cards.find(c => phase2Normalize(c.character.name) === q);
  if (exact) return exact;

  const start = cards.find(c => phase2Normalize(c.character.name).startsWith(q));
  if (start) return start;

  const inc = cards.find(c => phase2Normalize(c.character.name).includes(q));
  if (inc) return inc;

  throw new Error(`No card found in your inventory for: ${name}`);
}

function phase2RaritySellValue(rarity, power = 0) {
  const base = {
    COMMON: 250,
    RARE: 1000,
    EPIC: 5000,
    LEGENDARY: 25000,
    MYTHIC: 90000,
    DIVINE: 250000,
    SECRET: 1000000
  }[rarity] || 100;

  return base + Math.floor(Number(power || 0) * 0.08);
}


function getAscension(card) {
  const trait = String(card?.trait || '');
  const match = trait.match(/ASC:(\d+)/);
  return Math.max(0, Number(match?.[1] || 0));
}

function setAscensionTrait(oldTrait, ascension) {
  const clean = String(oldTrait || '').replace(/ASC:\d+/g, '').trim();
  return `${clean} ASC:${Math.max(0, ascension)}`.trim();
}

function phase2GetStars(card) {
  const trait = String(card?.trait || '');
  const match = trait.match(/STAR:(\d+)/);
  return Math.max(0, Number(match?.[1] || 0));
}

function phase2SetStarsTrait(oldTrait, stars) {
  const clean = String(oldTrait || '').replace(/STAR:\d+/g, '').trim();
  return `${clean} STAR:${Math.max(0, stars)}`.trim();
}

function phase2StarLabel(card) {
  const stars = phase2GetStars(card);
  return stars ? ` ⭐${stars}` : '';
}

async function phase2FuseByName(userId, name) {
  const q = phase2Normalize(name);

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' }
  });

  const matches = cards.filter(c => phase2Normalize(c.character.name).includes(q));

  if (!matches.length) throw new Error(`No cards found for ${name}.`);

  const characterId = matches[0].characterId;
  const same = cards.filter(c => c.characterId === characterId)
    .sort((a, b) => {
      const starDiff = phase2GetStars(b) - phase2GetStars(a);
      if (starDiff !== 0) return starDiff;
      return Number(b.power || 0) - Number(a.power || 0);
    });

  if (same.length < 2) {
    return {
      fused: false,
      message: `You need at least 2 copies of **${same[0].character.name}** to fuse.`
    };
  }

  const keeper = same[0];
  const consume = same[1];
  const oldStars = phase2GetStars(keeper);
  const gainedStars = 1 + phase2GetStars(consume);
  const newStars = Math.min(10, oldStars + gainedStars);

  const basePower = Number(keeper.character.basePower || keeper.power || 0);
  const powerGain = Math.floor(basePower * 0.10 * gainedStars) + Math.floor(Number(consume.power || 0) * 0.08);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({
      where: { userId, cardId: consume.id }
    }),
    prisma.marketListing.updateMany({
      where: { cardId: consume.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    }),
    prisma.userCard.delete({
      where: { id: consume.id }
    }),
    prisma.userCard.update({
      where: { id: keeper.id },
      data: {
        power: { increment: powerGain },
        trait: phase2SetStarsTrait(keeper.trait, newStars)
      }
    })
  ]);

  return {
    fused: true,
    name: keeper.character.name,
    oldStars,
    newStars,
    powerGain
  };
}

async function phase2FuseList(userId) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { obtainedAt: 'desc' }
  });

  const map = new Map();

  for (const c of cards) {
    if (!map.has(c.characterId)) {
      map.set(c.characterId, {
        name: c.character.name,
        rarity: c.character.rarity,
        count: 0,
        maxPower: 0
      });
    }

    const row = map.get(c.characterId);
    row.count++;
    row.maxPower = Math.max(row.maxPower, Number(c.power || 0));
  }

  return Array.from(map.values())
    .filter(x => x.count >= 2)
    .sort((a, b) => b.count - a.count || b.maxPower - a.maxPower);
}

async function phase2SellAllByRarity(userId, rarity) {
  const target = String(rarity || '').toUpperCase();
  const allowed = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'];

  if (!allowed.includes(target)) throw new Error('Invalid rarity.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true }
  });

  const sellCards = cards.filter(c => c.character.rarity === target);

  if (!sellCards.length) return { sold: 0, gold: 0, rarity: target };

  const totalGold = sellCards.reduce((sum, c) => sum + phase2RaritySellValue(c.character.rarity, c.power), 0);
  const ids = sellCards.map(c => c.id);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({ where: { userId, cardId: { in: ids } } }),
    prisma.marketListing.updateMany({
      where: { cardId: { in: ids }, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    }),
    prisma.userCard.deleteMany({ where: { id: { in: ids } } }),
    prisma.user.update({
      where: { id: userId },
      data: { gold: { increment: totalGold } }
    })
  ]);

  return { sold: sellCards.length, gold: totalGold, rarity: target };
}

async function phase2ApplyRarityFixes() {
  const fixes = [
    { names: ['lelouch', 'lelouch lamperouge'], rarity: 'SECRET', power: 28000 },
    { names: ['saber'], rarity: 'DIVINE', power: 17000 },
    { names: ['ainz', 'ainz ooal gown'], rarity: 'DIVINE', power: 18000 },
    { names: ['gon', 'gon freecss'], rarity: 'DIVINE', power: 16000 },
    { names: ['killua', 'killua zoldyck'], rarity: 'DIVINE', power: 16000 },
    { names: ['kurapika'], rarity: 'DIVINE', power: 16000 },
    { names: ['kakashi', 'kakashi hatake'], rarity: 'DIVINE', power: 14000 },
    { names: ['gojo', 'satoru gojo', 'satoru gojou'], rarity: 'SECRET', power: 30000 }
  ];

  const chars = await prisma.character.findMany({
    where: { active: true }
  });

  let updated = 0;

  for (const c of chars) {
    const n = phase2Normalize(c.name);
    const fix = fixes.find(f => f.names.some(name => n === phase2Normalize(name) || n.includes(phase2Normalize(name))));

    if (!fix) continue;

    await prisma.character.update({
      where: { id: c.id },
      data: {
        rarity: fix.rarity,
        basePower: Math.max(Number(c.basePower || 0), fix.power),
        baseFarm: Math.floor(fix.power / 8),
        baseLuck: Math.floor(fix.power / 20)
      }
    });

    updated++;
  }

  console.log(`[Phase2] Rarity fixes updated ${updated} characters`);
}

function money(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function xpForLevel(level) {
  return 100 + ((level - 1) * 75);
}

function levelReward(level) {
  return {
    gold: 2500 * level,
    tokens: Math.floor(level / 2) + 1,
    rolls: Math.floor(level / 3) + 2
  };
}

async function addUserXp(userId, amount, reason = 'activity') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { leveled: false, level: 1, rewards: [] };

  let xp = (user.xp || 0) + amount;
  let level = user.level || 1;
  const rewards = [];

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    rewards.push({ level, ...levelReward(level) });
  }

  const rewardGold = rewards.reduce((sum, r) => sum + r.gold, 0);
  const rewardTokens = rewards.reduce((sum, r) => sum + r.tokens, 0);
  const rewardRolls = rewards.reduce((sum, r) => sum + r.rolls, 0);

  await prisma.user.update({
    where: { id: userId },
    data: {
      xp,
      level,
      gold: { increment: rewardGold },
      tokens: { increment: rewardTokens },
      rolls: { increment: rewardRolls }
    }
  });

  return {
    leveled: rewards.length > 0,
    level,
    xp,
    gained: amount,
    reason,
    rewards
  };
}

function levelUpText(result) {
  if (!result || !result.leveled) return '';

  return '\n\n🎉 **LEVEL UP!**\n' + result.rewards.map(r =>
    `Level **${r.level}** Rewards: **${money(r.gold)} Gold**, **${r.tokens} Tokens**, **${r.rolls} Rolls**`
  ).join('\n');
}



async function findUserCardByName(userId, name) {
  const query = String(name || '').trim().toLowerCase();
  if (!query) throw new Error('Write a character name.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 10000
  });

  const exact = cards.find(c => c.character.name.toLowerCase() === query);
  if (exact) return exact;

  const starts = cards.find(c => c.character.name.toLowerCase().startsWith(query));
  if (starts) return starts;

  const includes = cards.find(c => c.character.name.toLowerCase().includes(query));
  if (includes) return includes;

  throw new Error(`No card found in your inventory for: ${name}`);
}

function raritySellValue(rarity, power = 0) {
  const base = {
    COMMON: 250,
    RARE: 1000,
    EPIC: 5000,
    LEGENDARY: 25000,
    MYTHIC: 90000,
    DIVINE: 250000,
    SECRET: 1000000
  }[rarity] || 100;

  return base + Math.floor(Number(power || 0) * 0.08);
}

async function sellAllByRarity(userId, rarity) {
  const target = String(rarity || '').toUpperCase();

  const allowed = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'];
  if (!allowed.includes(target)) throw new Error('Invalid rarity.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    take: 10000
  });

  const sellCards = cards.filter(c => c.character.rarity === target);

  if (!sellCards.length) {
    return { sold: 0, gold: 0, rarity: target };
  }

  const totalGold = sellCards.reduce((sum, c) => sum + raritySellValue(c.character.rarity, c.power), 0);
  const ids = sellCards.map(c => c.id);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({
      where: { userId, cardId: { in: ids } }
    }),
    prisma.marketListing.updateMany({
      where: { cardId: { in: ids }, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    }),
    prisma.userCard.deleteMany({
      where: { id: { in: ids } }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { gold: { increment: totalGold } }
    })
  ]);

  return { sold: sellCards.length, gold: totalGold, rarity: target };
}

function rarityEmoji(rarity) {
  return {
    COMMON: '⚪',
    RARE: '🔵',
    EPIC: '🟣',
    LEGENDARY: '🟡',
    MYTHIC: '🔴',
    DIVINE: '🌈',
    SECRET: '🕳️'
  }[rarity] || '🎴';
}

function priceRange(rarity) {
  const ranges = {
    COMMON: [100, 5000],
    RARE: [5000, 25000],
    EPIC: [25000, 120000],
    LEGENDARY: [120000, 600000],
    MYTHIC: [600000, 2500000],
    DIVINE: [2500000, 15000000],
    SECRET: [10000000, 50000000]
  };

  return ranges[rarity] || [100, 5000];
}

const PACK_WEIGHTS = {
  COMMON: 720000,
  RARE: 220000,
  EPIC: 56500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

const GOLD_SHOP_ITEMS = {
  rolls_5: { name: '5 Rolls', gold: 6000, rolls: 5 },
  rolls_10: { name: '10 Rolls', gold: 10000, rolls: 10 },
  rolls_25: { name: '25 Rolls', gold: 22000, rolls: 25 },
  token_1: { name: '1 Token', gold: 10000, tokens: 1 },
  legendary_orb: { name: 'Legendary core Roll', gold: 300000, rarity: 'LEGENDARY' },
  mythic_orb: { name: 'Mythic core Roll', gold: 900000, rarity: 'MYTHIC' },
  divine_orb: { name: 'Divine core Roll', gold: 2500000, rarity: 'DIVINE' },
  secret_orb: { name: 'Secret core Roll', gold: 9000000, rarity: 'SECRET' }
};

const ORB_ROLL_COSTS = {
  legendary: { tokens: 100, rarity: 'LEGENDARY' },
  mythic: { tokens: 250, rarity: 'MYTHIC' },
  divine: { tokens: 350, rarity: 'DIVINE' },
  secret: { tokens: 500, rarity: 'SECRET' }
};

const TRAIN_POWER_CAPS = {
  COMMON: 1500,
  RARE: 3000,
  EPIC: 5500,
  LEGENDARY: 9000,
  MYTHIC: 13000,
  DIVINE: 19000,
  SECRET: 35000
};

const PVP_RANKS = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 100 },
  { name: 'Gold', min: 250 },
  { name: 'Platinum', min: 500 },
  { name: 'Diamond', min: 850 },
  { name: 'Master', min: 1300 },
  { name: 'Void King', min: 2000 }
];

function pvpRank(points = 0) {
  let rank = PVP_RANKS[0].name;
  for (const r of PVP_RANKS) if (points >= r.min) rank = r.name;
  return rank;
}

const RARITY_UPGRADE_COSTS = {
  RARE: { gold: 25000, tokens: 5, power: 900 },
  EPIC: { gold: 90000, tokens: 15, power: 1800 },
  LEGENDARY: { gold: 300000, tokens: 40, power: 3500 },
  MYTHIC: { gold: 900000, tokens: 100, power: 6500 },
  DIVINE: { gold: 2500000, tokens: 250, power: 10000 },
  SECRET: { gold: 8000000, tokens: 500, power: 15000 }
};

function trainingCost(amount) {
  const safeAmount = Math.max(1, Math.min(100, Number(amount || 1)));
  return {
    amount: safeAmount,
    gold: safeAmount * 15000,
    powerGain: safeAmount * 120
  };
}

function weightedPick(items, weightFn) {
  let total = 0;
  const rows = items.map(item => {
    const weight = Math.max(1, Math.floor(weightFn(item)));
    total += weight;
    return { item, weight };
  });

  let roll = Math.floor(Math.random() * total);

  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) return row.item;
  }

  return rows[rows.length - 1]?.item;
}


async function ensureSaberAnd5000Characters() {
  const total = await prisma.character.count().catch(() => 0);

  const saberExisting = await prisma.character.findFirst({
    where: {
      OR: [
        { name: { contains: 'Saber', mode: 'insensitive' } },
        { name: { contains: 'Artoria', mode: 'insensitive' } }
      ]
    }
  }).catch(() => null);

  if (saberExisting) {
    await prisma.character.update({
      where: { id: saberExisting.id },
      data: {
        rarity: 'SECRET',
        basePower: 30000,
        baseFarm: 3750,
        baseLuck: 1500,
        element: 'Light',
        active: true
      }
    }).catch(() => {});
  } else {
    await prisma.character.create({
      data: {
        id: 'secret_saber_artoria',
        name: 'Saber',
        anime: 'Fate Series',
        rarity: 'SECRET',
        element: 'Light',
        imageUrl: null,
        auraName: 'Avalon Oath',
        auraColor: '#f8fafc',
        auraSecondary: '#fbbf24',
        auraIntensity: 1.7,
        basePower: 30000,
        baseFarm: 3750,
        baseLuck: 1500,
        limited: true,
        banner: 'saber_oath',
        active: true
      }
    }).catch(() => {});
  }

  if (total >= 5000) {
    console.log(`[BigPool] Character count already ${total}. Saber checked.`);
    return;
  }

  const animeSeries = [
    'Naruto', 'One Piece', 'Bleach', 'Dragon Ball', 'Jujutsu Kaisen', 'Demon Slayer',
    'Hunter x Hunter', 'Fate Series', 'Overlord', 'Solo Leveling', 'Chainsaw Man',
    'Attack on Titan', 'Black Clover', 'My Hero Academia', 'One Punch Man', 'Fairy Tail',
    'Tokyo Ghoul', 'Code Geass', 'Fullmetal Alchemist', 'JoJo', 'Blue Lock',
    'Vinland Saga', 'Fire Force', 'Sword Art Online', 'ReZero', 'That Time I Got Reincarnated as a Slime'
  ];
  const archetypes = [
    'Guardian', 'Blade', 'Shadow', 'Flame', 'Frost', 'Thunder', 'Void', 'Spirit',
    'Dragon', 'Demon', 'Saint', 'Hunter', 'Knight', 'Monarch', 'Reaper', 'Oracle',
    'Beast', 'Phantom', 'Breaker', 'Vanguard', 'Sage', 'Titan', 'Rogue', 'Captain'
  ];
  const elements = ['Dark','Light','Fire','Ice','Shadow','Curse','Void','Lightning','Neutral'];
  const rarities = [
    ['COMMON', 45], ['RARE', 28], ['EPIC', 15], ['LEGENDARY', 7], ['MYTHIC', 3], ['DIVINE', 1.5], ['SECRET', 0.5]
  ];

  function pickRarity(i) {
    const mod = i % 200;
    if (mod === 0) return 'SECRET';
    if (mod <= 3) return 'DIVINE';
    if (mod <= 10) return 'MYTHIC';
    if (mod <= 25) return 'LEGENDARY';
    if (mod <= 70) return 'EPIC';
    if (mod <= 140) return 'RARE';
    return 'COMMON';
  }

  function basePowerFor(rarity, i) {
    const ranges = {
      COMMON: [120, 900],
      RARE: [900, 2200],
      EPIC: [2200, 5200],
      LEGENDARY: [5200, 9000],
      MYTHIC: [9000, 14000],
      DIVINE: [14000, 22000],
      SECRET: [24000, 36000]
    };
    const [min, max] = ranges[rarity] || ranges.COMMON;
    return min + (i * 97 % (max - min));
  }

  const missing = 5000 - total;
  const batch = [];

  for (let i = 1; i <= missing + 25; i++) {
    const globalIndex = total + i;
    const anime = animeSeries[globalIndex % animeSeries.length];
    const archetype = archetypes[globalIndex % archetypes.length];
    const rarity = pickRarity(globalIndex);
    const power = basePowerFor(rarity, globalIndex);
    const name = `${anime} ${archetype} ${String(globalIndex).padStart(4, '0')}`;

    batch.push({
      id: `gen_${globalIndex}_${phase2Normalize(name).replace(/\s+/g, '_').slice(0, 35)}`,
      name,
      anime,
      rarity,
      element: elements[globalIndex % elements.length],
      imageUrl: null,
      auraName: `${archetype} Aura`,
      auraColor: rarity === 'SECRET' ? '#111827' : rarity === 'DIVINE' ? '#f472b6' : rarity === 'MYTHIC' ? '#ef4444' : rarity === 'LEGENDARY' ? '#f59e0b' : '#3b82f6',
      auraSecondary: '#ffffff',
      auraIntensity: rarity === 'SECRET' ? 1.8 : rarity === 'DIVINE' ? 1.5 : 1.0,
      basePower: power,
      baseFarm: Math.max(1, Math.floor(power / 8)),
      baseLuck: Math.max(1, Math.floor(power / 20)),
      limited: false,
      banner: null,
      active: true
    });
  }

  for (let i = 0; i < batch.length; i += 500) {
    await prisma.character.createMany({
      data: batch.slice(i, i + 500),
      skipDuplicates: true
    }).catch(e => console.error('[BigPool] createMany failed:', e.message));
  }

  const finalCount = await prisma.character.count().catch(() => 0);
  console.log(`[BigPool] Character count: ${finalCount}. Generated ${batch.length} candidates. Saber is SECRET.`);
}

async function applySecretCharacterBoosts() {
  const chars = await prisma.character.findMany({
    where: { active: true },
    select: { id: true, name: true, anime: true, rarity: true, basePower: true, baseFarm: true, baseLuck: true }
  });

  let updated = 0;

  for (const c of chars) {
    const cls = classifyCharacter(c);
    if (!cls) continue;

    const newPower = rarityBasePower(cls.rarity, c.id.length + c.name.length);

    await prisma.character.update({
      where: { id: c.id },
      data: {
        rarity: cls.rarity,
        basePower: newPower,
        baseFarm: Math.floor(newPower / 8),
        baseLuck: Math.floor(newPower / 20),
        element: characterElement({ name: c.name, element: 'Neutral' })
      }
    });

    updated++;
  }

  console.log(`Rarity/class/power balance updated: ${updated}`);
}

async function createCardForUser(userId, character) {
  const updated = await prisma.character.update({
    where: { id: character.id },
    data: { globalPrint: { increment: 1 } }
  });

  const shiny = Math.random() < 0.015;
  const power = Math.round((updated.basePower || 100) * (shiny ? 1.35 : 1) + Math.random() * 80);

  const card = await prisma.userCard.create({
    data: {
      id: nanoid(12),
      userId,
      characterId: updated.id,
      serial: updated.globalPrint,
      power,
      shiny
    }
  });

  return { card, character: updated };
}

async function guaranteedCharacterRoll(userId, rarity) {
  let pool = await prisma.character.findMany({
    where: { active: true, rarity },
    take: 100000
  });

  if (!pool.length) {
    pool = await prisma.character.findMany({ where: { active: true }, take: 100000 });
  }

  if (!pool.length) throw new Error('No characters are available.');

  const character = pool[Math.floor(Math.random() * pool.length)];
  return createCardForUser(userId, character);
}

async function openPack(userId, type) {
  const pack = String(type || '').toLowerCase();

  const costs = {
    jjk: 10,
    demon: 10,
    naruto: 10,
    onepiece: 10,
    bleach: 10,
    mha: 10,
    hxh: 10,
    dbz: 10,
    aot: 10,
    villains: 18,
    secret: 500,
    event: 25
  };

  const cost = costs[pack];

  if (!cost) throw new Error('Invalid pack. Use /shop to see available packs.');

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if ((user.tokens || 0) < cost) {
    throw new Error(`Not enough tokens. This pack costs ${cost} tokens.`);
  }

  const allChars = await prisma.character.findMany({
    where: { active: true },
    take: 1000
  });

  if (!allChars.length) throw new Error('No characters are available.');

  const containsAny = (value, words) => {
    const text = String(value || '').toLowerCase();
    return words.some(w => text.includes(w));
  };

  let pool = allChars;

  if (pack === 'jjk') pool = allChars.filter(c => containsAny(c.anime, ['jujutsu', 'kaisen']));
  if (pack === 'demon') pool = allChars.filter(c => containsAny(c.anime, ['demon slayer', 'kimetsu']));
  if (pack === 'naruto') pool = allChars.filter(c => containsAny(c.anime, ['naruto']));
  if (pack === 'onepiece') pool = allChars.filter(c => containsAny(c.anime, ['one piece']));
  if (pack === 'bleach') pool = allChars.filter(c => containsAny(c.anime, ['bleach']));
  if (pack === 'mha') pool = allChars.filter(c => containsAny(c.anime, ['my hero', 'boku no hero']));
  if (pack === 'hxh') pool = allChars.filter(c => containsAny(c.anime, ['hunter x hunter', 'hunter×hunter']));
  if (pack === 'dbz') pool = allChars.filter(c => containsAny(c.anime, ['dragon ball']));
  if (pack === 'aot') pool = allChars.filter(c => containsAny(c.anime, ['attack on titan', 'shingeki']));
  if (pack === 'villains') {
    const villains = [
      'sukuna', 'muzan', 'madara', 'aizen', 'yhwach', 'kaido', 'doflamingo',
      'shigaraki', 'all for one', 'meruem', 'chrollo', 'hisoka', 'frieza',
      'zeref', 'acnologia', 'dio'
    ];

    pool = allChars.filter(c => containsAny(`${c.name} ${c.anime}`, villains));
  }
  if (pack === 'secret') pool = allChars.filter(c => c.rarity === 'SECRET' || isSecretCandidate(c));
  if (pack === 'event') pool = allChars.filter(c => ['EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'].includes(c.rarity));

  if (!pool.length) pool = allChars;

  const character = weightedPick(pool, c => {
    if (pack === 'event') {
      return {
        EPIC: 850000,
        LEGENDARY: 95000,
        MYTHIC: 22000,
        DIVINE: 7000,
        SECRET: 1200
      }[c.rarity] || 100;
    }

    if (pack === 'secret') {
      return c.rarity === 'SECRET' || isSecretCandidate(c) ? 1000000 : 1;
    }

    return PACK_WEIGHTS[c.rarity] || 1000;
  });

  await prisma.user.update({
    where: { id: userId },
    data: { tokens: { decrement: cost } }
  });

  return createCardForUser(userId, character);
}

async function inventoryEmbed(userId, index = 0) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { obtainedAt: 'desc' },
    take: 10000
  });

  if (!cards.length) return { empty: true };

  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const c = cards[safeIndex];
  const aura = getAura(c.character);

  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.character.rarity)} ${c.character.name}${starLabel(c)}`)
    .setDescription(
      `Anime: **${c.character.anime}**\n` +
      `Rarity: **${c.character.rarity}**\n` +
      `Power: **${c.power}**\n` +
      `Technique: **${aura.name}**\n` +
      `Stars: **${starLabel(c) || 'No Star'}**\n` +
      `Card ID: \`${c.id}\``
    )
    .setColor(embedColor(aura.color))
    .setFooter({ text: `Card ${safeIndex + 1}/${cards.length}` });

  if (c.character.imageUrl) embed.setImage(c.character.imageUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_prev_${safeIndex}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`inv_next_${safeIndex}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}


function teamRequirementFor(mode, progress) {
  const value = mode === 'story'
    ? progress.chapter
    : mode === 'tower'
      ? progress.towerFloor
      : progress.dungeonFloor;

  if (value >= 60 || value >= 201) return 6;
  if (value >= 50 || value >= 151) return 5;
  if (value >= 35 || value >= 101) return 4;
  if (value >= 20 || value >= 51) return 3;
  if (value >= 10 || value >= 21) return 2;
  return 1;
}

const SYNERGY_RULES = [
  { name: 'Hunter Bond', keys: ['gon', 'killua'], atk: 0.10, speed: 0.15, ult: 0.10 },
  { name: 'Kurta Revenge', keys: ['kurapika', 'leorio'], atk: 0.12, defBreak: 0.15 },
  { name: 'Rival Bond', keys: ['naruto', 'sasuke'], atk: 0.20, ult: 0.10 },
  { name: 'Monster Trio', keys: ['luffy', 'zoro', 'sanji'], atk: 0.20, hp: 0.15 },
  { name: 'Jujutsu Core', keys: ['yuji', 'megumi', 'nobara'], atk: 0.12, ult: 0.20 },
  { name: 'Strongest Duo', keys: ['gojo', 'geto'], ult: 0.25, control: 0.15 },
  { name: 'Saiyan Rivalry', keys: ['goku', 'vegeta'], atk: 0.25 },
  { name: 'Master Student', keys: ['gohan', 'piccolo'], def: 0.20, ult: 0.15 },
  { name: 'Uchiha Bloodline', keys: ['itachi', 'sasuke'], atk: 0.15, crit: 0.10 },
  { name: 'Akatsuki Pressure', keys: ['pain', 'obito', 'itachi'], atk: 0.18, control: 0.12 },
  { name: 'Shadow Army', keys: ['sung jin', 'igris'], atk: 0.18, ult: 0.12 },
  { name: 'Overlord Guardians', keys: ['ainz', 'albedo'], def: 0.20, ult: 0.10 },
  { name: 'Fate Oath', keys: ['saber', 'gilgamesh'], atk: 0.16, crit: 0.08 },
  { name: 'Control Kings', keys: ['lelouch', 'makima'], control: 0.25, ult: 0.15 }
];

function cardNameList(cards) {
  return cards.map(c => phase2Normalize(c.character?.name || '')).join(' | ');
}

function calculateSynergies(cards) {
  const text = cardNameList(cards);
  const active = [];

  for (const rule of SYNERGY_RULES) {
    if (rule.keys.every(k => text.includes(phase2Normalize(k)))) {
      active.push(rule);
    }
  }

  const roles = cards.map(c => characterRole(c.character)).filter(Boolean);
  const elements = cards.map(c => characterElement(c.character)).filter(Boolean);
  const roleCounts = {};
  const elementCounts = {};

  for (const r of roles) roleCounts[r] = (roleCounts[r] || 0) + 1;
  for (const e of elements) elementCounts[e] = (elementCounts[e] || 0) + 1;

  for (const [role, count] of Object.entries(roleCounts)) {
    if (count >= 3) active.push({ name: `${role} Formation`, atk: 0.06, def: 0.06, ult: 0.05 });
    if (count >= 5) active.push({ name: `Full ${role} Team`, atk: 0.15, def: 0.12, ult: 0.10 });
  }

  for (const [element, count] of Object.entries(elementCounts)) {
    if (count >= 3) active.push({ name: `${element} Aura`, atk: 0.10, hp: 0.08 });
    if (count >= 5) active.push({ name: `Pure ${element} Formation`, atk: 0.22, hp: 0.15, ult: 0.10 });
  }

  const bonus = active.reduce((sum, r) =>
    sum + (r.atk || 0) + (r.def || 0) + (r.hp || 0) + (r.ult || 0) + (r.control || 0) + (r.crit || 0) + (r.speed || 0) + (r.defBreak || 0),
  0);

  return { active, bonus };
}

async function getUserTeams(userId, teamCount = 1) {
  const slots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  const teams = [];

  for (let t = 1; t <= teamCount; t++) {
    const start = (t - 1) * 5 + 1;
    const end = start + 4;
    let team = slots.filter(s => s.slot >= start && s.slot <= end).map(s => s.card).filter(Boolean);

    if (!team.length) {
      const skip = (t - 1) * 5;
      team = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { power: 'desc' },
        skip,
        take: 5
      });
    }

    teams.push(team.slice(0, 5));
  }

  return teams;
}

function enemyTeamMultiplier(teamCount) {
  return 1 + (teamCount - 1) * 0.85;
}

async function getMultiTeamPower(userId, teamCount = 1) {
  const teams = await getUserTeams(userId, teamCount);
  let total = 0;
  const synergyNames = [];

  for (const team of teams) {
    const base = team.reduce((sum, c) => sum + Number(c.power || 0), 0);
    const syn = calculateSynergies(team);
    total += Math.floor(base * (1 + syn.bonus));
    synergyNames.push(...syn.active.map(s => s.name));
  }

  return {
    power: total,
    teams,
    synergies: [...new Set(synergyNames)]
  };
}

async function autoBuildTeams(userId, teamCount = 1) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: teamCount * 5
  });

  await prisma.teamSlot.deleteMany({
    where: { userId, slot: { lte: teamCount * 5 } }
  });

  for (let x = 0; x < cards.length; x++) {
    await prisma.teamSlot.create({
      data: {
        id: `${userId}_${x + 1}`,
        userId,
        slot: x + 1,
        cardId: cards[x].id
      }
    });
  }

  return cards;
}

async function getOrCreateProgress(userId) {
  return prisma.storyProgress.upsert({
    where: { userId },
    update: {},
    create: {
      id: nanoid(12),
      userId,
      chapter: 1,
      stage: 1,
      dungeonFloor: 1,
      towerFloor: 1
    }
  });
}

function getProgressTitle(mode, progress) {
  if (mode === 'story') return `Chapter ${progress.chapter}, Stage ${progress.stage}/30`;
  if (mode === 'tower') return `Tower Floor ${progress.towerFloor}`;
  return `Dungeon Floor ${progress.dungeonFloor}`;
}

async function updateProgressAfterWin(userId, mode, progress) {
  if (mode === 'story') {
    let nextStage = progress.stage + 1;
    let nextChapter = progress.chapter;

    if (nextStage > 30) {
      nextStage = 1;
      nextChapter += 1;
    }

    if (nextChapter > 80) {
      nextChapter = 80;
      nextStage = 30;
    }

    return prisma.storyProgress.update({
      where: { userId },
      data: { chapter: nextChapter, stage: nextStage }
    });
  }

  if (mode === 'tower') {
    return prisma.storyProgress.update({
      where: { userId },
      data: { towerFloor: progress.towerFloor + 1 }
    });
  }

  return prisma.storyProgress.update({
    where: { userId },
    data: { dungeonFloor: progress.dungeonFloor + 1 }
  });
}

async function getUserBattleTeam(userId) {
  const teamSlots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  const fromTeam = teamSlots.map(s => s.card).filter(Boolean).slice(0, 5);
  if (fromTeam.length) return fromTeam;

  return prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 5
  });
}

async function getTeamPower(userId) {
  const cards = await getUserBattleTeam(userId);
  return cards.reduce((sum, c) => sum + (c.power || 0), 0);
}

async function getAnimeEnemies(count = 5, minPower = 0) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    orderBy: { basePower: 'desc' },
    take: 350
  });

  const pool = chars.filter(c => (c.basePower || 0) >= minPower);
  const source = pool.length ? pool : chars;
  const shuffled = source.sort(() => Math.random() - 0.5);

  return shuffled.slice(0, count).map(c => c.name);
}

async function runProgressBattle(interaction, mode) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const progress = await getOrCreateProgress(userId);
  const requiredTeams = teamRequirementFor(mode, progress);
  const teamData = await getMultiTeamPower(userId, requiredTeams);
  const teamPower = teamData.power;

  const storyIndex = ((progress.chapter - 1) * 30) + progress.stage;
  const baseRequired = mode === 'story'
    ? 700 + storyIndex * 260
    : mode === 'tower'
      ? 1200 + progress.towerFloor * 420
      : 900 + progress.dungeonFloor * 330;

  const required = Math.floor(baseRequired * enemyTeamMultiplier(requiredTeams));
  const enemies = await getAnimeEnemies(requiredTeams * 5, Math.max(0, required / 8));
  let allyMana = 0;
  let enemyMana = 0;

  let text =
    `**${mode.toUpperCase()} BATTLE STARTED**\n` +
    `${getProgressTitle(mode, progress)}\n` +
    `Teams Required: **${requiredTeams}**\n` +
    `Team Power: **${money(teamPower)}**\n` +
    `Enemy Teams: **${requiredTeams}**\n` +
    `Required Power: **${money(required)}**\n` +
    (teamData.synergies.length ? `Synergies: **${teamData.synergies.join(', ')}**\n` : '') +
    `Enemies: **${enemies.join(', ')}**\n\n`;

  await interaction.editReply(text + 'Battle is starting...');

  for (let r = 1; r <= 7; r++) {
    const enemy = enemies[(r - 1) % enemies.length];
    const hit = Math.max(50, Math.floor(teamPower / (7 + r) + Math.random() * 350));
    const enemyHit = Math.max(30, Math.floor(required / (11 + r) + Math.random() * 220));

    allyMana += 24 + Math.floor(Math.random() * 20);
    enemyMana += 17 + Math.floor(Math.random() * 18);

    text += `\n__Round ${r}__\n`;
    text += `🩸 Your team hit **${enemy}** for **${money(hit)}**. Mana: ${Math.min(100, allyMana)}/100\n`;

    if (allyMana >= 100) {
      const ult = Math.floor(hit * 2.6);
      text += `**TEAM ULTIMATE!** Massive finisher dealt **${money(ult)}** damage!\n`;
      allyMana = 0;
    }

    text += `🩸 **${enemy}** hit back for **${money(enemyHit)}**. Enemy Mana: ${Math.min(100, enemyMana)}/100\n`;

    if (enemyMana >= 100) {
      const enemyUlt = Math.floor(enemyHit * 2.1);
      text += `**ENEMY ULTIMATE!** ${enemy} used a special attack for **${money(enemyUlt)}** damage!\n`;
      enemyMana = 0;
    }

    await new Promise(resolve => setTimeout(resolve, 1100));
    await interaction.editReply(text.slice(-1900)).catch(() => {});
  }

  const won = teamPower >= required || Math.random() < Math.min(0.45, teamPower / Math.max(1, required) / 3);

  if (!won) {
    text += `\nDefeat. Upgrade your team, train your characters, or use better items.`;
    return interaction.editReply(text.slice(-1900));
  }

  const gold = Math.floor(required * 0.75);
  const progressNumber = mode === 'story'
    ? (((progress.chapter - 1) * 30) + progress.stage)
    : mode === 'tower'
      ? progress.towerFloor
      : progress.dungeonFloor;

  const tokens = progressNumber % 5 === 0
    ? Math.max(1, Math.floor(progressNumber / 5)) * (mode === 'story' ? 5 : 4)
    : 0;
  const rolls = mode === 'story' ? 3 : 2;

  await prisma.user.update({
    where: { id: userId },
    data: {
      gold: { increment: gold },
      tokens: { increment: tokens },
      rolls: { increment: rolls }
    }
  });

  await updateProgressAfterWin(userId, mode, progress);
  const xpResult = await addUserXp(userId, mode === 'story' ? 45 : mode === 'tower' ? 55 : 40, mode);

  text +=
    `\n**Victory!**\n` +
    `Rewards: **${money(gold)} gold**, **${tokens} tokens**, **${rolls} rolls**.\n` +
    `Progress saved.` + levelUpText(xpResult);

  return interaction.editReply(text.slice(-1900));
}

async function sendBossAnnouncement(channel) {
  const bossNames = [
    'Sukuna, King of Curses',
    'Madara Uchiha',
    'Aizen, Lord of Illusions',
    'Kaido, Beast Emperor',
    'Muzan, Demon King',
    'Meruem, Chimera King',
    'Dio Brando',
    'Frieza, Emperor of Evil'
  ];

  const bossName = bossNames[Math.floor(Math.random() * bossNames.length)];
  const eventId = `${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const boss = {
    id: eventId,
    bossName,
    hp: 750000 + Math.floor(Math.random() * 500000),
    power: 250000 + Math.floor(Math.random() * 200000),
    rewardGold: 250000,
    rewardTokens: 50,
    entries: new Set(),
    channelId: channel.id
  };

  activeBosses.set(eventId, boss);

  const embed = new EmbedBuilder()
    .setTitle(`WORLD BOSS SPAWNED: ${bossName}`)
    .setDescription(
      `Boss Power: **${money(boss.power)}**\n` +
      `Boss HP: **${money(boss.hp)}**\n` +
      `Rewards: **${money(boss.rewardGold)} gold**, **${boss.rewardTokens} tokens**, rare drops.\n\n` +
      `اضغط الزر عشان تدخل البوس.\n` +
      `القتال يبدأ تلقائيًا بعد دقيقتين، وبتشوف لوق لايف للضربات والالتات.`
    )
    .setColor(0x8b0000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`boss_join_${eventId}`)
      .setLabel('Join Boss')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  setTimeout(async () => {
    const latest = activeBosses.get(eventId);
    if (!latest) return;

    await msg.edit({ components: [] }).catch(() => {});

    const players = Array.from(latest.entries);
    if (!players.length) {
      activeBosses.delete(eventId);
      return channel.send(`**${bossName}** disappeared. No one joined.`);
    }

    const battleMsg = await channel.send(
      `**BOSS FIGHT STARTED: ${bossName}**\n` +
      `Players joined: **${players.length}**\n` +
      `Boss HP: **${money(latest.hp)}**\n\n` +
      `Loading teams...`
    );

    const playerTeams = [];
    let totalPower = 0;

    for (const joinedUserId of players) {
      const cards = await getUserBattleTeam(joinedUserId);
      const power = cards.reduce((sum, c) => sum + (c.power || 0), 0);
      totalPower += power;
      playerTeams.push({ userId: joinedUserId, cards, power, mana: 0 });
    }

    let bossHp = latest.hp;
    let bossMana = 0;
    let log =
      `**BOSS FIGHT: ${bossName}**\n` +
      `Boss HP: **${money(bossHp)}**\n` +
      `Players: **${players.length}**\n\n`;

    log += `**Teams**\n`;
    for (const p of playerTeams) {
      const names = p.cards.map(c => c.character?.name || 'Unknown').join(', ');
      log += `<@${p.userId}>: ${names || 'No cards'} • PWR **${money(p.power)}**\n`;
    }

    await battleMsg.edit(log.slice(-1900)).catch(() => {});

    for (let round = 1; round <= 7; round++) {
      log += `\n__**Round ${round}**__\n`;

      for (const p of playerTeams) {
        const cards = p.cards.length ? p.cards : [{ power: 100, character: { name: 'Unknown Fighter' } }];

        for (const card of cards) {
          const name = card.character?.name || 'Unknown Fighter';
          const dmg = Math.max(50, Math.floor((card.power || 100) * (0.12 + Math.random() * 0.10)));
          bossHp -= dmg;
          p.mana += 22 + Math.floor(Math.random() * 18);

          log += `**${name}** hit ${bossName} for **${money(dmg)}**. Mana: ${Math.min(100, p.mana)}/100\n`;

          if (p.mana >= 100) {
            const ultDmg = Math.max(150, Math.floor((card.power || 100) * (0.42 + Math.random() * 0.22)));
            bossHp -= ultDmg;
            p.mana = 0;
            log += `**${name} ULTIMATE!** dealt **${money(ultDmg)}** damage!\n`;
          }

          if (bossHp <= 0) break;
        }

        if (bossHp <= 0) break;
      }

      bossMana += 28 + Math.floor(Math.random() * 22);

      if (bossHp > 0) {
        if (bossMana >= 100) {
          bossMana = 0;
          const target = playerTeams[Math.floor(Math.random() * playerTeams.length)];
          const targetCard = target.cards[Math.floor(Math.random() * Math.max(1, target.cards.length))];
          const targetName = targetCard?.character?.name || 'the team';
          const bossUlt = Math.floor(latest.power * (0.08 + Math.random() * 0.05));
          log += `**${bossName} ULTIMATE!** crushed **${targetName}** for **${money(bossUlt)}** damage!\n`;
        } else {
          const target = playerTeams[Math.floor(Math.random() * playerTeams.length)];
          const bossHit = Math.floor(latest.power * (0.025 + Math.random() * 0.025));
          log += `**${bossName}** attacks <@${target.userId}> team for **${money(bossHit)}**. Boss Mana: ${bossMana}/100\n`;
        }
      }

      log += `Boss HP left: **${money(Math.max(0, bossHp))}**\n`;

      await new Promise(resolve => setTimeout(resolve, 1200));
      await battleMsg.edit(log.slice(-1900)).catch(() => {});

      if (bossHp <= 0) break;
    }

    const won = bossHp <= 0 || totalPower >= latest.power;

    log += `\n__**Final Result**__\n`;
    log += `Total Team Power: **${money(totalPower)}** / Boss Power: **${money(latest.power)}**\n`;

    if (won) {
      const goldEach = Math.floor(latest.rewardGold / players.length);
      const tokensEach = Math.max(1, Math.floor(latest.rewardTokens / players.length));

      for (const joinedUserId of players) {
        await prisma.user.update({
          where: { id: joinedUserId },
          data: {
            gold: { increment: goldEach },
            tokens: { increment: tokensEach },
            rolls: { increment: 5 }
          }
        }).catch(() => {});
      }

      log += `Boss defeated! Each player got **${money(goldEach)} gold**, **${tokensEach} tokens**, **5 rolls**.`;
    } else {
      log += `Boss survived. Upgrade your team.`;
    }

    activeBosses.delete(eventId);
    return battleMsg.edit(log.slice(-1900)).catch(() => channel.send(log.slice(-1900)));
  }, 2 * 60 * 1000);

  return boss;
}

async function autoBossLoop() {
  const channelId = process.env.BOSS_EVENT_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.log('Auto boss skipped: invalid BOSS_EVENT_CHANNEL_ID');
    return;
  }

  await sendBossAnnouncement(channel);
}

async function passiveFarmClaim(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 5
  });

  if (!cards.length) throw new Error('You need at least one character to farm.');

  const now = Date.now();
  const last = new Date(user.lastPassiveClaimAt || now - 60 * 60 * 1000).getTime();
  const hours = Math.max(1, Math.min(12, Math.floor((now - last) / (60 * 60 * 1000)) || 1));
  const teamPower = cards.reduce((sum, c) => sum + (c.power || 0), 0);
  const gold = Math.floor((teamPower / 7) * hours);
  const tokens = Math.max(1, Math.floor(hours / 2));
  const rolls = Math.max(1, Math.floor(hours / 3));

  await prisma.user.update({
    where: { id: userId },
    data: {
      gold: { increment: gold },
      tokens: { increment: tokens },
      rolls: { increment: rolls },
      lastPassiveClaimAt: new Date()
    }
  });

  return { gold, tokens, rolls, hours, teamPower };
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await seedItemTemplates().catch(e => console.error('Item seed failed:', e));
  await ensureSaberAnd5000Characters().catch(e => console.error('Big pool seed failed:', e));
  await applySecretCharacterBoosts().catch(e => console.error('Secret boost failed:', e));
  await phase2ApplyRarityFixes().catch(e => console.error('Phase2 rarity fix failed:', e));
  await syncAllCardPowers(prisma).catch(e => console.error('Power sync failed:', e));

  const firstBossDelay = Number(process.env.BOSS_EVENT_FIRST_DELAY_SECONDS || 90) * 1000;
  const bossInterval = Number(process.env.BOSS_EVENT_INTERVAL_MINUTES || 60) * 60 * 1000;
  setTimeout(autoBossLoop, firstBossDelay);
  setInterval(autoBossLoop, bossInterval);
});


// ===== VOIDROLL CLEAN PHASES PATCH =====
// Built on stable 03eb125. Removes Orb wording and adds the requested systems without stacking old broken patches.

const vrActiveRuns = new Set();

async function vrDefer(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);
}

async function vrReply(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload).catch(() => null);
  return i.reply(payload).catch(() => null);
}

function vrNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[.\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function vrRole(c) {
  const n = vrNorm(c?.name || '');
  if (/(lelouch|aizen|makima|kurapika|shikamaru|light yagami|senku)/.test(n)) return 'Control';
  if (/(c c|cc|rimuru|megumi|kakashi|sakura|orihime|shoko|chopper|tsunade)/.test(n)) return 'Support';
  if (/(saber|artoria|ainz|whitebeard|kaido|all might|escanor|albedo|naofumi)/.test(n)) return 'Tank';
  if (/(gabimaru|killua|toji|levi|hisoka|zenitsu|yoroichi|akame|kirito)/.test(n)) return 'Assassin';
  if (/(gojo|madara|gilgamesh|sukuna|yhwach|dio|meruem|frieren|sinbad)/.test(n)) return 'Mage';
  return 'DPS';
}

function vrElement(c) {
  const current = String(c?.element || '').trim();
  if (current && !['Neutral', 'Anime', 'undefined', 'null'].includes(current)) return current;
  const t = `${vrNorm(c?.name)} ${vrNorm(c?.anime)}`;
  if (/(sukuna|makima|toji|ainz|dio|alucard|devil|demon|curse|muzan)/.test(t)) return 'Dark';
  if (/(sung jin|jinwoo|jin woo|shadow|igris|beru|cid kagenou)/.test(t)) return 'Shadow';
  if (/(gojo|rimuru|gilgamesh|aizen|yhwach|void|space|time)/.test(t)) return 'Void';
  if (/(saber|artoria|goku|naruto|luffy|saitama|all might|hero)/.test(t)) return 'Light';
  if (/(ace|rengoku|natsu|shinra|flame|fire|yamamoto|gabimaru)/.test(t)) return 'Fire';
  if (/(killua|zenitsu|kakashi|thunder|lightning)/.test(t)) return 'Lightning';
  if (/(ichigo|rukia|bleach|soul|spirit|shinigami)/.test(t)) return 'Soul';
  if (/(ice|frost|snow|todoroki)/.test(t)) return 'Ice';
  return 'Light';
}

function vrPassive(c) {
  const n = vrNorm(c?.name || '');
  const passives = [
    [/lelouch/, 'Geass Command: controls the battlefield, boosts team ultimate charge, and lowers enemy control resistance.'],
    [/c c|^cc$/, 'Immortal Witch: regenerates every round and gives extra energy to the strongest ally.'],
    [/gabimaru/, 'Ninja of the Hollow: gains dodge chance, poison resistance, and burst damage after ultimate.'],
    [/nanami/, 'Ratio Technique: critical chance and critical damage massively increase against enemies above 70% HP.'],
    [/gojo/, 'Limitless Infinity: reduces incoming damage and charges Hollow Purple when attacked.'],
    [/geto/, 'Cursed Spirit Manipulation: increases summon damage and weakens enemy DEF.'],
    [/sung jin|jinwoo|jin woo/, 'Shadow Monarch: defeated enemies empower Shadow allies and stack ATK.'],
    [/saber|artoria/, 'Avalon: grants a starting shield and reduces burst damage.'],
    [/gilgamesh/, 'Gate of Babylon: high penetration and massive ultimate burst.'],
    [/goku/, 'Limit Breaker: ultimate damage scales with battle rounds.'],
    [/vegeta/, 'Saiyan Pride: gains ATK after taking damage.'],
    [/sukuna/, 'Malevolent Shrine: executes weakened enemies and boosts Dark damage.'],
    [/aizen/, 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.'],
    [/madara/, 'Uchiha Dominion: increases AoE ultimate damage.'],
    [/itachi/, 'Tsukuyomi: chance to delay enemy ultimate.'],
    [/killua/, 'Godspeed: very high speed and crit burst.'],
    [/gon/, 'Jajanken: huge single-target ultimate damage.'],
    [/luffy/, 'Nika Rhythm: gains ATK and speed every round.'],
    [/zoro/, 'Three Sword Style: critical damage increases against bosses.'],
    [/sanji/, 'Diable Jambe: fire damage and dodge chance.'],
    [/ichigo/, 'Bankai Pressure: Soul damage and speed increase.'],
    [/makima/, 'Control Devil: lowers enemy ATK and increases control chance.'],
    [/tanjiro/, 'Hinokami Kagura: Fire burst and small team heal.'],
    [/nezuko/, 'Demon Blood Art: team regen and Dark resistance.'],
    [/rengoku/, 'Flame Hashira: boosts Fire allies and frontline damage.'],
    [/levi/, 'Humanity’s Strongest: high dodge and boss damage.']
  ];
  for (const [rx, text] of passives) if (rx.test(n)) return text;

  const role = vrRole(c);
  const element = vrElement(c);
  if (role === 'Tank') return `Iron Guard: DEF scaling and ${element} resistance.`;
  if (role === 'Support') return 'Battle Support: increases team energy regeneration.';
  if (role === 'Control') return 'Command Aura: increases control chance and reduces enemy ultimate charge.';
  if (role === 'Assassin') return 'Weak Point: high crit and partial DEF ignore.';
  if (role === 'Mage') return `${element} Burst: ultimate damage scales with penetration.`;
  return 'Battle Instinct: ATK rises every round.';
}

function vrStatCap(rarity) {
  return { COMMON: 180, RARE: 360, EPIC: 700, LEGENDARY: 1150, MYTHIC: 1750, DIVINE: 2400, SECRET: 3300 }[rarity] || 250;
}

function vrStats(card, c) {
  const level = Math.max(1, Math.min(99, Number(card?.level || 1)));
  const raw = Number(card?.power || c?.basePower || 100);
  const base = Math.min(Math.max(raw, 80), vrStatCap(c?.rarity));
  const role = vrRole(c);
  const mult = 1 + ((level - 1) * 0.03);

  let atkS = 1.05, hpS = 7.2, defS = 0.55, spd = 105, crit = 15, critDmg = 170, pen = 0;
  if (role === 'Tank') { atkS = .72; hpS = 13; defS = 1.2; spd = 90; crit = 8; }
  if (role === 'Support') { atkS = .8; hpS = 8.8; defS = .82; spd = 110; crit = 10; }
  if (role === 'Control') { atkS = .9; hpS = 8.4; defS = .76; spd = 118; crit = 12; }
  if (role === 'Assassin') { atkS = 1.28; hpS = 5.8; defS = .42; spd = 140; crit = 28; critDmg = 205; pen = 12; }
  if (role === 'Mage') { atkS = 1.34; hpS = 6.1; defS = .48; spd = 108; crit = 17; critDmg = 185; pen = 22; }
  if (/nanami/i.test(c?.name || '')) { crit = 40; critDmg = 235; pen = Math.max(pen, 12); }

  return {
    atk: Math.floor(base * atkS * mult),
    hp: Math.floor(base * hpS * mult),
    def: Math.floor(base * defS * mult),
    spd: Math.floor(spd + level * .2),
    crit,
    critDmg,
    pen,
    level
  };
}

function vrStatsBlock(card, c) {
  const s = vrStats(card, c);
  return `Class: **${vrRole(c)}** | Element: **${vrElement(c)}**
Level **${s.level}/99** • ATK **${money(s.atk)}** • HP **${money(s.hp)}** • DEF **${money(s.def)}** • SPD **${s.spd}
CRIT **${s.crit}%** • CRIT DMG **${s.critDmg}%** • PEN **${s.pen}%**
Character Passive: ${vrPassive(c)}`;
}

const VR_TEAMUPS = [
  { name: 'Zero Requiem', keys: ['lelouch', 'c c'], buff: '+20% control chance, +15% ultimate charge' },
  { name: 'Strongest Past', keys: ['gojo', 'geto'], buff: '+18% Void damage, +10% ultimate charge' },
  { name: 'Hunter Bond', keys: ['gon', 'killua'], buff: '+15% speed, +12% crit' },
  { name: 'Monster Trio', keys: ['luffy', 'zoro', 'sanji'], buff: '+18% ATK, +10% speed' },
  { name: 'Saiyan Rivalry', keys: ['goku', 'vegeta'], buff: '+18% ATK after round 3' },
  { name: 'Jujutsu Core', keys: ['yuji', 'megumi', 'nobara'], buff: '+12% ATK, +15% ultimate charge' },
  { name: 'Shadow Army', keys: ['sung jin', 'igris'], buff: '+15% Shadow damage' }
];

function vrTeamBuffs(cards) {
  const names = cards.map(c => vrNorm(c.character?.name || c.name || '')).join(' | ');
  return VR_TEAMUPS.filter(t => t.keys.every(k => names.includes(vrNorm(k))));
}

async function vrFindOwned(userId, q, limit = 10) {
  const tokens = vrNorm(q).split(/\s+/).filter(Boolean);
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 500
  });

  return cards.map(card => {
    const full = `${vrNorm(card.character.name)} ${vrNorm(card.character.anime)}`;
    let score = 0;
    for (const t of tokens) {
      if (full.includes(t)) score += 50;
      if (vrNorm(card.character.name).includes(t)) score += 70;
      if (vrNorm(card.character.anime).includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
    return { card, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score || Number(b.card.power || 0) - Number(a.card.power || 0)).slice(0, limit).map(x => x.card);
}

async function vrGetProgress(userId) {
  return getOrCreateProgress(userId);
}

function vrNeededFormations(mode, p) {
  const v = mode === 'story' ? p.chapter : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  if (v >= 60) return 6;
  if (v >= 48) return 5;
  if (v >= 36) return 4;
  if (v >= 24) return 3;
  if (v >= 12) return 2;
  return 1;
}

async function vrFormationCards(userId, formation) {
  const start = ((formation - 1) * 6) + 1;
  const end = start + 5;
  const slots = await prisma.teamSlot.findMany({
    where: { userId, slot: { gte: start, lte: end } },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  return slots.map(s => s.card).filter(Boolean).slice(0, 6);
}

async function vrTotalPower(userId, formations) {
  const fallback = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: formations * 6
  });

  let total = 0;
  const allBuffs = [];

  for (let f = 1; f <= formations; f++) {
    let cards = await vrFormationCards(userId, f);
    if (!cards.length) cards = fallback.slice((f - 1) * 6, f * 6);
    const base = cards.reduce((sum, c) => sum + Number(c.power || 0), 0);
    const buffs = vrTeamBuffs(cards);
    total += Math.floor(base * (1 + buffs.length * .08));
    allBuffs.push(...buffs.map(b => `${b.name}: ${b.buff}`));
  }

  return { total, buffs: [...new Set(allBuffs)] };
}

function vrRequired(mode, p, formations) {
  const storyIndex = ((p.chapter - 1) * 30) + p.stage;
  const base = mode === 'story'
    ? 650 + storyIndex * 300
    : mode === 'tower'
      ? 1100 + p.towerFloor * 520
      : 900 + p.dungeonFloor * 430;
  const late = mode === 'story' ? Math.max(0, p.chapter - 40) * .035 : 0;
  return Math.floor(base * (1 + ((formations - 1) * .95) + late));
}

function vrRewards(mode, required, p) {
  const progressNo = mode === 'story' ? (((p.chapter - 1) * 30) + p.stage) : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  return {
    gold: Math.floor(required * .8),
    tokens: Math.max(2, Math.floor(progressNo / 4) + 2),
    rolls: mode === 'story' ? 3 : 2,
    xp: mode === 'story' ? 75 : mode === 'tower' ? 85 : 65
  };
}

async function vrAdvance(userId, mode, p) {
  if (mode === 'story') {
    let stage = p.stage + 1;
    let chapter = p.chapter;
    if (stage > 30) { stage = 1; chapter += 1; }
    if (chapter > 80) { chapter = 80; stage = 30; }
    return prisma.storyProgress.update({ where: { userId }, data: { chapter, stage } });
  }
  if (mode === 'tower') return prisma.storyProgress.update({ where: { userId }, data: { towerFloor: p.towerFloor + 1 } });
  return prisma.storyProgress.update({ where: { userId }, data: { dungeonFloor: p.dungeonFloor + 1 } });
}

async function vrRunMode(i, mode, runs = 1) {
  await vrDefer(i);
  const key = `${i.user.id}:${mode}`;
  if (vrActiveRuns.has(key)) return vrReply(i, `⏳ You already have **${mode}** running.`);
  vrActiveRuns.add(key);

  try {
    const max = Math.max(1, Math.min(30, runs));
    let wins = 0;
    const total = { gold: 0, tokens: 0, rolls: 0, xp: 0 };
    let out = `**${max > 1 ? 'AUTO ' : ''}${mode.toUpperCase()} STARTED**\n`;

    for (let run = 1; run <= max; run++) {
      const p = await vrGetProgress(i.user.id);
      const formations = vrNeededFormations(mode, p);
      const power = await vrTotalPower(i.user.id, formations);
      const required = vrRequired(mode, p, formations);
      const title = mode === 'story'
        ? `Chapter ${p.chapter}/80 • Stage ${p.stage}/30`
        : mode === 'tower'
          ? `Tower Floor ${p.towerFloor}`
          : `Dungeon Floor ${p.dungeonFloor}`;

      out += `\nRun ${run}: **${title}** | Formations **${formations}** | ${money(power.total)} vs ${money(required)}\n`;
      if (power.buffs.length) out += `Buffs: ${power.buffs.slice(0, 2).join(' | ')}\n`;

      let energy = 0;
      for (let r = 1; r <= 3; r++) {
        const dmg = Math.floor(power.total / (4 + r) + Math.random() * 500);
        energy += 34;
        out += `• Round ${r}: dealt **${money(dmg)}** damage. Energy ${Math.min(100, energy)}/100\n`;
        if (energy >= 100) {
          out += `  🔥 **ULTIMATE COMBO!** Formation finisher activated.\n`;
          energy = 0;
        }
      }

      const won = power.total >= required || Math.random() < Math.min(.18, power.total / Math.max(1, required) / 5);
      if (!won) { out += `❌ **Defeat.** Upgrade your formations.\n`; break; }

      const latest = await vrGetProgress(i.user.id);
      const same = mode === 'story'
        ? latest.chapter === p.chapter && latest.stage === p.stage
        : mode === 'tower'
          ? latest.towerFloor === p.towerFloor
          : latest.dungeonFloor === p.dungeonFloor;
      if (!same) { out += `⛔ Duplicate reward blocked.\n`; break; }

      const rw = vrRewards(mode, required, p);
      await vrAdvance(i.user.id, mode, p);
      await prisma.user.update({
        where: { id: i.user.id },
        data: {
          gold: { increment: rw.gold },
          tokens: { increment: rw.tokens },
          rolls: { increment: rw.rolls }
        }
      });
      await addUserXp(i.user.id, rw.xp, mode).catch(() => null);

      wins++;
      total.gold += rw.gold;
      total.tokens += rw.tokens;
      total.rolls += rw.rolls;
      total.xp += rw.xp;
      out += `✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;

      if (run % 4 === 0) await vrReply(i, out.slice(-1800));
    }

    out += `\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
    return vrReply(i, out.slice(-1900));
  } finally {
    vrActiveRuns.delete(key);
  }
}

async function vrCleanPhaseHandler(i, userId, commandName) {
  if (commandName === 'stats' || commandName === 'inv-search') {
    const q = i.options.getString('name', true);
    const matches = await vrFindOwned(userId, q, 10);
    if (!matches.length) return i.reply(`No owned characters found for **${q}**.`);
    const first = matches[0];
    const embed = new EmbedBuilder()
      .setTitle(commandName === 'stats' ? `Stats: ${first.character.name}` : `Inventory Search: ${q}`)
      .setDescription(`${rarityEmoji(first.character.rarity)} **${first.character.name}** • ${first.character.anime} • PWR **${money(first.power)}**\n${vrStatsBlock(first, first.character)}${commandName === 'inv-search' ? `\n\n**Owned Results**\n${matches.map((c, idx) => `${idx+1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${money(c.power)}`).join('\n')}` : ''}`)
      .setColor(embedColor(getAura(first.character).color));
    if (first.character.imageUrl) embed.setThumbnail(first.character.imageUrl);
    return i.reply({ embeds: [embed] });
  }

  if (commandName === 'story') return vrRunMode(i, 'story', 1);
  if (commandName === 'tower') return vrRunMode(i, 'tower', 1);
  if (commandName === 'dungeon') return vrRunMode(i, 'dungeon', 1);
  if (commandName === 'auto-story') return vrRunMode(i, 'story', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-tower') return vrRunMode(i, 'tower', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-dungeon') return vrRunMode(i, 'dungeon', i.options.getInteger('runs') || 10);

  if (commandName === 'autoteam') {
    const count = Math.max(1, Math.min(6, i.options.getInteger('formations') || i.options.getInteger('teams') || 6));
    const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { power: 'desc' }, take: count * 6 });
    if (!cards.length) return i.reply('You do not have any cards yet.');

    for (let f = 1; f <= count; f++) {
      const start = ((f - 1) * 6) + 1;
      await prisma.teamSlot.deleteMany({ where: { userId, slot: { gte: start, lte: start + 5 } } }).catch(() => null);
      for (let x = 0; x < cards.slice((f - 1) * 6, f * 6).length; x++) {
        const slot = start + x;
        const card = cards[((f - 1) * 6) + x];
        await prisma.teamSlot.upsert({
          where: { userId_slot: { userId, slot } },
          update: { cardId: card.id },
          create: { id: `${userId}_${slot}`, userId, slot, cardId: card.id }
        }).catch(() => null);
      }
    }

    return i.reply(`✅ Auto equipped **${count} formation(s)**. Each formation has **6 characters**.`);
  }

  if (commandName === 'formations') {
    const count = Math.max(1, Math.min(6, i.options.getInteger('count') || 6));
    const lines = ['**Your Formations**', '6 formations max • each formation has 6 characters.'];

    for (let f = 1; f <= count; f++) {
      const cards = await vrFormationCards(userId, f);
      const buffs = vrTeamBuffs(cards);
      lines.push(`\n**Formation ${f}**`);
      if (!cards.length) lines.push('Empty.');
      else {
        lines.push(...cards.map((c, idx) => `${idx+1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${money(c.power)}`));
        if (buffs.length) lines.push(`Buffs: ${buffs.map(b => `${b.name} (${b.buff})`).join(' | ')}`);
      }
    }

    return i.reply(lines.join('\n').slice(0, 1900));
  }

  if (commandName === 'boss-rush' || commandName === 'coop-boss-rush') {
    await vrDefer(i);
    const coop = commandName === 'coop-boss-rush';
    const formations = coop ? 2 : 1;
    const power = await vrTotalPower(userId, formations);
    const bossHp = coop ? 2200000 : 1100000;
    let damage = 0;
    let out = `**${coop ? 'CO-OP ' : 'SOLO '}BOSS RUSH**\nBoss HP: **${money(bossHp)}**\nYour Power: **${money(power.total)}**\n`;

    for (let r = 1; r <= 6; r++) {
      const hit = Math.floor(power.total / (3 + r) + Math.random() * 8000);
      damage += hit;
      out += `\nRound ${r}: dealt **${money(hit)}** damage.`;
      if (r === 3 || r === 6) out += `\n🔥 **ULTIMATE COMBO!**`;
    }

    const clear = damage >= bossHp;
    const rw = { gold: Math.floor(damage * .45), tokens: Math.max(8, Math.floor(damage / 45000)), rolls: clear ? 10 : 4, xp: clear ? 220 : 100 };
    await prisma.user.update({ where: { id: userId }, data: { gold: { increment: rw.gold }, tokens: { increment: rw.tokens }, rolls: { increment: rw.rolls } } });
    await addUserXp(userId, rw.xp, 'boss-rush').catch(() => null);
    out += `\n\n**${clear ? 'Boss Cleared!' : 'Boss Escaped!'}**\nRewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**`;
    return vrReply(i, out.slice(0, 1900));
  }

  return false;
}
// ===== END VOIDROLL CLEAN PHASES PATCH =====


// ===== NO-START + RESTORE STATS + REWARDS PATCH =====
async function vxDefer(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);
}
async function vxReply(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload).catch(() => null);
  return i.reply(payload).catch(() => null);
}
function vxNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[.\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function vxRole(c) {
  const n = vxNorm(c?.name || '');
  if (/(lelouch|aizen|makima|kurapika|shikamaru|light yagami|senku)/.test(n)) return 'Control';
  if (/(c c|cc|rimuru|megumi|kakashi|sakura|orihime|shoko|chopper|tsunade)/.test(n)) return 'Support';
  if (/(saber|artoria|ainz|whitebeard|kaido|all might|escanor|albedo|naofumi)/.test(n)) return 'Tank';
  if (/(gabimaru|killua|toji|levi|hisoka|zenitsu|yoroichi|akame|kirito)/.test(n)) return 'Assassin';
  if (/(gojo|madara|gilgamesh|sukuna|yhwach|dio|meruem|frieren|sinbad)/.test(n)) return 'Mage';
  return 'DPS';
}
function vxElement(c) {
  const current = String(c?.element || '').trim();
  if (current && !['Neutral', 'Anime', 'undefined', 'null'].includes(current)) return current;
  const t = `${vxNorm(c?.name)} ${vxNorm(c?.anime)}`;
  if (/(sukuna|makima|toji|ainz|dio|alucard|devil|demon|curse|muzan)/.test(t)) return 'Dark';
  if (/(sung jin|jinwoo|jin woo|shadow|igris|beru|cid kagenou)/.test(t)) return 'Shadow';
  if (/(gojo|rimuru|gilgamesh|aizen|yhwach|void|space|time)/.test(t)) return 'Void';
  if (/(saber|artoria|goku|naruto|luffy|saitama|all might|hero)/.test(t)) return 'Light';
  if (/(ace|rengoku|natsu|shinra|flame|fire|yamamoto|gabimaru)/.test(t)) return 'Fire';
  if (/(killua|zenitsu|kakashi|thunder|lightning)/.test(t)) return 'Lightning';
  if (/(ichigo|rukia|bleach|soul|spirit|shinigami)/.test(t)) return 'Soul';
  if (/(ice|frost|snow|todoroki)/.test(t)) return 'Ice';
  return 'Light';
}
function vxPassive(c) {
  const n = vxNorm(c?.name || '');
  const p = [
    [/lelouch/, 'Geass Command: controls the battlefield, boosts team ultimate charge, and lowers enemy control resistance.'],
    [/c c|^cc$/, 'Immortal Witch: regenerates every round and gives extra energy to the strongest ally.'],
    [/gabimaru/, 'Ninja of the Hollow: gains dodge chance, poison resistance, and burst damage after ultimate.'],
    [/nanami/, 'Ratio Technique: critical chance and critical damage massively increase against enemies above 70% HP.'],
    [/gojo/, 'Limitless Infinity: reduces incoming damage and charges Hollow Purple when attacked.'],
    [/geto/, 'Cursed Spirit Manipulation: increases summon damage and weakens enemy DEF.'],
    [/sung jin|jinwoo|jin woo/, 'Shadow Monarch: defeated enemies empower Shadow allies and stack ATK.'],
    [/saber|artoria/, 'Avalon: grants a starting shield and reduces burst damage.'],
    [/gilgamesh/, 'Gate of Babylon: high penetration and massive ultimate burst.'],
    [/goku/, 'Limit Breaker: ultimate damage scales with battle rounds.'],
    [/vegeta/, 'Saiyan Pride: gains ATK after taking damage.'],
    [/sukuna/, 'Malevolent Shrine: executes weakened enemies and boosts Dark damage.'],
    [/aizen/, 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.'],
    [/madara/, 'Uchiha Dominion: increases AoE ultimate damage.'],
    [/itachi/, 'Tsukuyomi: chance to delay enemy ultimate.'],
    [/killua/, 'Godspeed: very high speed and crit burst.'],
    [/gon/, 'Jajanken: huge single-target ultimate damage.'],
    [/luffy/, 'Nika Rhythm: gains ATK and speed every round.'],
    [/zoro/, 'Three Sword Style: critical damage increases against bosses.'],
    [/ichigo/, 'Bankai Pressure: Soul damage and speed increase.'],
    [/makima/, 'Control Devil: lowers enemy ATK and increases control chance.']
  ];
  for (const [rx, text] of p) if (rx.test(n)) return text;
  const role = vxRole(c), element = vxElement(c);
  if (role === 'Tank') return `Iron Guard: DEF scaling and ${element} resistance.`;
  if (role === 'Support') return 'Battle Support: increases team energy regeneration.';
  if (role === 'Control') return 'Command Aura: increases control chance and reduces enemy ultimate charge.';
  if (role === 'Assassin') return 'Weak Point: high crit and partial DEF ignore.';
  if (role === 'Mage') return `${element} Burst: ultimate damage scales with penetration.`;
  return 'Battle Instinct: ATK rises every round.';
}
function vxCap(rarity) {
  return { COMMON: 180, RARE: 360, EPIC: 700, LEGENDARY: 1150, MYTHIC: 1750, DIVINE: 2400, SECRET: 3300 }[rarity] || 250;
}
function vxStats(card, c) {
  const level = Math.max(1, Math.min(99, Number(card?.level || 1)));
  const raw = Number(card?.power || c?.basePower || 100);
  const base = Math.min(Math.max(raw, 80), vxCap(c?.rarity));
  const role = vxRole(c), mult = 1 + ((level - 1) * 0.03);
  let atkS=1.05,hpS=7.2,defS=.55,spd=105,crit=15,critDmg=170,pen=0;
  if (role === 'Tank') { atkS=.72; hpS=13; defS=1.2; spd=90; crit=8; }
  if (role === 'Support') { atkS=.8; hpS=8.8; defS=.82; spd=110; crit=10; }
  if (role === 'Control') { atkS=.9; hpS=8.4; defS=.76; spd=118; crit=12; }
  if (role === 'Assassin') { atkS=1.28; hpS=5.8; defS=.42; spd=140; crit=28; critDmg=205; pen=12; }
  if (role === 'Mage') { atkS=1.34; hpS=6.1; defS=.48; spd=108; crit=17; critDmg=185; pen=22; }
  if (/nanami/i.test(c?.name || '')) { crit=40; critDmg=235; pen=Math.max(pen,12); }
  return { level, atk:Math.floor(base*atkS*mult), hp:Math.floor(base*hpS*mult), def:Math.floor(base*defS*mult), spd:Math.floor(spd+level*.2), crit, critDmg, pen };
}
function vxStatsBlock(card, c) {
  const s = vxStats(card, c);
  return `Class: **${vxRole(c)}** | Element: **${vxElement(c)}**
Level **${s.level}/99** • ATK **${money(s.atk)}** • HP **${money(s.hp)}** • DEF **${money(s.def)}** • SPD **${s.spd}**
CRIT **${s.crit}%** • CRIT DMG **${s.critDmg}%** • PEN **${s.pen}%**
Character Passive: ${vxPassive(c)}`;
}
async function vxFindOwned(userId, q, limit=10) {
  const tokens = vxNorm(q).split(/\s+/).filter(Boolean);
  const cards = await prisma.userCard.findMany({ where:{userId}, include:{character:true}, orderBy:{power:'desc'}, take:500 });
  return cards.map(card => {
    const full = `${vxNorm(card.character.name)} ${vxNorm(card.character.anime)}`;
    let score = 0;
    for (const t of tokens) {
      if (full.includes(t)) score += 50;
      if (vxNorm(card.character.name).includes(t)) score += 70;
      if (vxNorm(card.character.anime).includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
    return {card, score};
  }).filter(x => x.score > 0).sort((a,b)=>b.score-a.score || Number(b.card.power||0)-Number(a.card.power||0)).slice(0, limit).map(x=>x.card);
}
const vxLocks = new Set();
function vxNeed(mode, p) {
  const v = mode === 'story' ? p.chapter : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  if (v >= 60) return 6; if (v >= 48) return 5; if (v >= 36) return 4; if (v >= 24) return 3; if (v >= 12) return 2; return 1;
}
async function vxTeamPower(userId, f) {
  const cards = await prisma.userCard.findMany({ where:{userId}, include:{character:true}, orderBy:{power:'desc'}, take:f*6 });
  return cards.reduce((s,c)=>s+Number(c.power||0),0);
}
function vxReq(mode,p,f) {
  const storyIndex = ((p.chapter-1)*30)+p.stage;
  const base = mode==='story' ? 650+storyIndex*300 : mode==='tower' ? 1100+p.towerFloor*520 : 900+p.dungeonFloor*430;
  const late = mode==='story' ? Math.max(0,p.chapter-40)*.035 : 0;
  return Math.floor(base*(1+(f-1)*.95+late));
}
function vxRewards(mode, req, p) {
  const no = mode === 'story' ? (((p.chapter-1)*30)+p.stage) : mode==='tower' ? p.towerFloor : p.dungeonFloor;
  return { gold:Math.floor(req*.8), tokens:Math.max(2,Math.floor(no/4)+2), rolls:mode==='story'?3:2, xp:mode==='story'?75:mode==='tower'?85:65 };
}
async function vxAdvance(userId, mode, p) {
  if (mode==='story') {
    let stage=p.stage+1, chapter=p.chapter;
    if (stage>30) { stage=1; chapter++; }
    if (chapter>80) { chapter=80; stage=30; }
    return prisma.storyProgress.update({ where:{userId}, data:{chapter, stage} });
  }
  if (mode==='tower') return prisma.storyProgress.update({ where:{userId}, data:{towerFloor:p.towerFloor+1} });
  return prisma.storyProgress.update({ where:{userId}, data:{dungeonFloor:p.dungeonFloor+1} });
}
async function vxRunMode(i, mode, runs=1) {
  await vxDefer(i);
  const key = `${i.user.id}:${mode}`;
  if (vxLocks.has(key)) return vxReply(i, `⏳ You already have **${mode}** running.`);
  vxLocks.add(key);
  try {
    const max = Math.max(1, Math.min(30, runs));
    let wins=0, total={gold:0,tokens:0,rolls:0,xp:0};
    let out = `**${max>1?'AUTO ':''}${mode.toUpperCase()} STARTED**\n`;
    for (let run=1; run<=max; run++) {
      const p = await getOrCreateProgress(i.user.id);
      const f = vxNeed(mode,p), power = await vxTeamPower(i.user.id,f), req = vxReq(mode,p,f);
      const title = mode==='story' ? `Chapter ${p.chapter}/80 • Stage ${p.stage}/30` : mode==='tower' ? `Tower Floor ${p.towerFloor}` : `Dungeon Floor ${p.dungeonFloor}`;
      out += `\nRun ${run}: **${title}** | Formations **${f}** | ${money(power)} vs ${money(req)}\n`;
      let energy=0;
      for (let r=1;r<=3;r++) {
        const dmg = Math.floor(power/(4+r)+Math.random()*500);
        energy += 34;
        out += `• Round ${r}: dealt **${money(dmg)}** damage. Energy ${Math.min(100,energy)}/100\n`;
        if (energy>=100) { out += `  🔥 **ULTIMATE COMBO!** Formation finisher activated.\n`; energy=0; }
      }
      const won = power>=req || Math.random()<Math.min(.18,power/Math.max(1,req)/5);
      if (!won) { out += `❌ **Defeat.** Upgrade your formations.\n`; break; }
      const latest = await getOrCreateProgress(i.user.id);
      const same = mode==='story' ? latest.chapter===p.chapter && latest.stage===p.stage : mode==='tower' ? latest.towerFloor===p.towerFloor : latest.dungeonFloor===p.dungeonFloor;
      if (!same) { out += `⛔ Duplicate reward blocked.\n`; break; }
      const rw = vxRewards(mode,req,p);
      await vxAdvance(i.user.id,mode,p);
      await prisma.user.update({ where:{id:i.user.id}, data:{gold:{increment:rw.gold}, tokens:{increment:rw.tokens}, rolls:{increment:rw.rolls}} });
      await addUserXp(i.user.id,rw.xp,mode).catch(()=>null);
      wins++; total.gold+=rw.gold; total.tokens+=rw.tokens; total.rolls+=rw.rolls; total.xp+=rw.xp;
      out += `✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;
      if (run%4===0) await vxReply(i,out.slice(-1800));
    }
    out += `\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
    return vxReply(i,out.slice(-1900));
  } finally { vxLocks.delete(key); }
}
async function vxHandler(i,userId,commandName) {
  if (commandName === 'story-start' || commandName === 'tower-start' || commandName === 'dungeon-start') {
    return i.reply('This command was removed. Use /story, /tower, or /dungeon.');
  }
  if (commandName === 'stats' || commandName === 'inv-search') {
    const q = i.options.getString('name', true);
    const matches = await vxFindOwned(userId,q,10);
    if (!matches.length) return i.reply(`No owned characters found for **${q}**.`);
    const first = matches[0];
    const embed = new EmbedBuilder()
      .setTitle(commandName==='stats'?`Stats: ${first.character.name}`:`Inventory Search: ${q}`)
      .setDescription(`${rarityEmoji(first.character.rarity)} **${first.character.name}** • ${first.character.anime} • PWR **${money(first.power)}**\n${vxStatsBlock(first,first.character)}${commandName==='inv-search'?`\n\n**Owned Results**\n${matches.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${money(c.power)}`).join('\n')}`:''}`)
      .setColor(embedColor(getAura(first.character).color));
    if (first.character.imageUrl) embed.setThumbnail(first.character.imageUrl);
    return i.reply({embeds:[embed]});
  }
  if (commandName === 'story') return vxRunMode(i,'story',1);
  if (commandName === 'tower') return vxRunMode(i,'tower',1);
  if (commandName === 'dungeon') return vxRunMode(i,'dungeon',1);
  if (commandName === 'auto-story') return vxRunMode(i,'story',i.options.getInteger('runs')||10);
  if (commandName === 'auto-tower') return vxRunMode(i,'tower',i.options.getInteger('runs')||10);
  if (commandName === 'auto-dungeon') return vxRunMode(i,'dungeon',i.options.getInteger('runs')||10);
  return false;
}
// ===== END NO-START + RESTORE STATS + REWARDS PATCH =====


// ===== FINAL POLISH: STATS EVERYWHERE + LIVE LOGS + MANUAL FORMATIONS =====
async function fpDefer(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);
}
async function fpReply(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload).catch(() => null);
  return i.reply(payload).catch(() => null);
}
function fpNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[.\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function fpRole(c) {
  if (typeof vxRole === 'function') return vxRole(c);
  if (typeof vrRole === 'function') return vrRole(c);
  return 'DPS';
}
function fpElement(c) {
  if (typeof vxElement === 'function') return vxElement(c);
  if (typeof vrElement === 'function') return vrElement(c);
  return c?.element || 'Light';
}
function fpPassive(c) {
  if (typeof vxPassive === 'function') return vxPassive(c);
  if (typeof vrPassive === 'function') return vrPassive(c);
  return 'Battle Instinct: ATK rises every round.';
}
function fpStatsBlock(card, c) {
  if (typeof vxStatsBlock === 'function') return vxStatsBlock(card, c);
  if (typeof vrStatsBlock === 'function') return vrStatsBlock(card, c);
  const p = Math.max(80, Math.min(Number(card?.power || c?.basePower || 100), 3300));
  const level = Number(card?.level || 1);
  const mult = 1 + ((level - 1) * .03);
  return `Class: **${fpRole(c)}** | Element: **${fpElement(c)}**
Level **${level}/99** • ATK **${money(Math.floor(p*1.05*mult))}** • HP **${money(Math.floor(p*7.2*mult))}** • DEF **${money(Math.floor(p*.55*mult))}**
CRIT **15%** • PEN **0%**
Character Passive: ${fpPassive(c)}`;
}
async function fpFindOwned(userId, q, limit = 10) {
  const tokens = fpNorm(q).split(/\s+/).filter(Boolean);
  const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { power: 'desc' }, take: 600 });
  return cards.map(card => {
    const full = `${fpNorm(card.character.name)} ${fpNorm(card.character.anime)}`;
    let score = 0;
    for (const t of tokens) {
      if (full.includes(t)) score += 50;
      if (fpNorm(card.character.name).includes(t)) score += 80;
      if (fpNorm(card.character.anime).includes(t)) score += 25;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
    return { card, score };
  }).filter(x => x.score > 0).sort((a,b)=>b.score-a.score || Number(b.card.power||0)-Number(a.card.power||0)).slice(0, limit).map(x=>x.card);
}
async function fpFormationCards(userId, formation) {
  const start = ((formation - 1) * 6) + 1;
  const end = start + 5;
  const slots = await prisma.teamSlot.findMany({
    where: { userId, slot: { gte: start, lte: end } },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);
  return slots.map(s => s.card).filter(Boolean);
}
async function fpSetFormation(userId, formation, cards) {
  const start = ((formation - 1) * 6) + 1;
  const end = start + 5;
  await prisma.teamSlot.deleteMany({ where: { userId, slot: { gte: start, lte: end } } }).catch(()=>null);
  for (let x = 0; x < Math.min(6, cards.length); x++) {
    const slot = start + x;
    const card = cards[x];
    await prisma.teamSlot.upsert({
      where: { userId_slot: { userId, slot } },
      update: { cardId: card.id },
      create: { id: `${userId}_${slot}`, userId, slot, cardId: card.id }
    }).catch(async () => {
      await prisma.teamSlot.create({ data: { id: `${userId}_${Date.now()}_${slot}`, userId, slot, cardId: card.id } }).catch(()=>null);
    });
  }
}
async function fpLiveMode(i, mode, runs = 1) {
  await fpDefer(i);
  const max = Math.max(1, Math.min(30, runs));
  let wins = 0;
  const total = { gold: 0, tokens: 0, rolls: 0, xp: 0 };
  let out = `**${max > 1 ? 'AUTO ' : ''}${mode.toUpperCase()} STARTED**\n`;
  await i.editReply(out).catch(()=>null);
  for (let run = 1; run <= max; run++) {
    const p = await getOrCreateProgress(i.user.id);
    const f = typeof vxNeed === 'function' ? vxNeed(mode, p) : (typeof vrNeededFormations === 'function' ? vrNeededFormations(mode, p) : 1);
    const power = typeof vxTeamPower === 'function' ? await vxTeamPower(i.user.id, f) : (await prisma.userCard.findMany({where:{userId:i.user.id}, orderBy:{power:'desc'}, take:f*6})).reduce((s,c)=>s+Number(c.power||0),0);
    const req = typeof vxReq === 'function' ? vxReq(mode, p, f) : (typeof vrRequired === 'function' ? vrRequired(mode, p, f) : 1000);
    const title = mode === 'story' ? `Chapter ${p.chapter}/80 • Stage ${p.stage}/30` : mode === 'tower' ? `Tower Floor ${p.towerFloor}` : `Dungeon Floor ${p.dungeonFloor}`;
    out += `\nRun ${run}: **${title}** | Formations **${f}** | ${money(power)} vs ${money(req)}\n`;
    await i.editReply(out.slice(-1800)).catch(()=>null);
    let energy = 0;
    for (let r = 1; r <= 4; r++) {
      const dmg = Math.floor(power / (4 + r) + Math.random() * 500);
      energy += 28 + Math.floor(Math.random()*12);
      out += `• Round ${r}: dealt **${money(dmg)}** damage. Energy ${Math.min(100, energy)}/100\n`;
      if (energy >= 100) {
        out += `  🔥 **ULTIMATE COMBO!** Formation finisher activated.\n`;
        energy = 0;
      }
      await i.editReply(out.slice(-1800)).catch(()=>null);
      await new Promise(resolve => setTimeout(resolve, 650));
    }
    const won = power >= req || Math.random() < Math.min(.18, power / Math.max(1, req) / 5);
    if (!won) { out += `❌ **Defeat.** Upgrade your formations.\n`; await i.editReply(out.slice(-1800)).catch(()=>null); break; }
    const latest = await getOrCreateProgress(i.user.id);
    const same = mode==='story' ? latest.chapter===p.chapter && latest.stage===p.stage : mode==='tower' ? latest.towerFloor===p.towerFloor : latest.dungeonFloor===p.dungeonFloor;
    if (!same) { out += `⛔ Duplicate reward blocked.\n`; await i.editReply(out.slice(-1800)).catch(()=>null); break; }
    const rw = typeof vxRewards === 'function' ? vxRewards(mode, req, p) : (typeof vrRewards === 'function' ? vrRewards(mode, req, p) : {gold:1000,tokens:2,rolls:2,xp:50});
    if (typeof vxAdvance === 'function') await vxAdvance(i.user.id, mode, p);
    else if (typeof vrAdvance === 'function') await vrAdvance(i.user.id, mode, p);
    await prisma.user.update({ where:{id:i.user.id}, data:{gold:{increment:rw.gold}, tokens:{increment:rw.tokens}, rolls:{increment:rw.rolls}} }).catch(()=>null);
    if (typeof addUserXp === 'function') await addUserXp(i.user.id, rw.xp, mode).catch(()=>null);
    wins++; total.gold += rw.gold; total.tokens += rw.tokens; total.rolls += rw.rolls; total.xp += rw.xp;
    out += `✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;
    await i.editReply(out.slice(-1800)).catch(()=>null);
  }
  out += `\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
  return i.editReply(out.slice(-1900)).catch(()=>null);
}
async function fpPolishHandler(i, userId, commandName) {
  if (commandName === 'roll' || commandName === 'r') {
    await fpDefer(i);
    const amount = Math.max(1, Math.min(10, i.options.getInteger('amount') || 1));
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if ((user?.rolls || 0) < amount) return fpReply(i, `You need **${amount} rolls**, you have **${user?.rolls || 0}**.`);
    await prisma.user.update({ where:{id:userId}, data:{rolls:{decrement:amount}} });
    const lines = [];
    const embeds = [];
    for (let x=0; x<amount; x++) {
      const result = await rollCard(userId);
      lines.push(`${x+1}. ${rarityEmoji(result.character.rarity)} **${result.character.name}** • ${result.character.anime} • PWR ${money(result.card.power)}\n${fpStatsBlock(result.card, result.character).split('\n').slice(0,3).join(' | ')}`);
      const embed = new EmbedBuilder()
        .setTitle(`${x+1}. ${rarityEmoji(result.character.rarity)} ${result.character.name}`)
        .setDescription(`Anime: **${result.character.anime}**\nRarity: **${result.character.rarity}**\nPower: **${money(result.card.power)}**\n${fpStatsBlock(result.card, result.character)}`)
        .setColor(embedColor(getAura(result.character).color));
      if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
      embeds.push(embed);
    }
    return fpReply(i, { content: (`**ROLL x${amount}**\n${lines.join('\n\n')}\n\nRolls left: **${(user?.rolls || 0)-amount}**`).slice(0,1900), embeds: embeds.slice(0,10) });
  }
  if (commandName === 'search') {
    const q = i.options.getString('name', true);
    const tokens = fpNorm(q).split(/\s+/).filter(Boolean);
    const chars = await prisma.character.findMany({ where: { active: true, OR: tokens.map(t => ({ OR: [{ name: { contains: t, mode: 'insensitive' } }, { anime: { contains: t, mode: 'insensitive' } }] })) }, take: 80 });
    const ranked = chars.map(c => {
      const full = `${fpNorm(c.name)} ${fpNorm(c.anime)}`;
      let score = 0;
      for (const t of tokens) { if (full.includes(t)) score += 40; if (fpNorm(c.name).includes(t)) score += 70; }
      return { c, score };
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || Number(b.c.basePower||0)-Number(a.c.basePower||0)).slice(0,10).map(x=>x.c);
    if (!ranked.length) return i.reply(`No characters found for **${q}**.`);
    const first = ranked[0];
    const embed = new EmbedBuilder()
      .setTitle(`Search: ${q}`)
      .setDescription(`**Best Match**\n${rarityEmoji(first.rarity)} **${first.name}** • ${first.anime} • PWR **${money(first.basePower)}**\n${fpStatsBlock({power:first.basePower, level:1}, first)}\n\n**Results**\n${ranked.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.rarity)} **${c.name}** • ${c.anime} • PWR ${money(c.basePower)} • ${fpRole(c)} • ${fpElement(c)}`).join('\n')}`)
      .setColor(embedColor(getAura(first).color));
    if (first.imageUrl) embed.setThumbnail(first.imageUrl);
    return i.reply({ embeds:[embed] });
  }
  if (commandName === 'inventory') {
    const cards = await prisma.userCard.findMany({ where:{userId}, include:{character:true}, orderBy:{power:'desc'}, take:25 });
    if (!cards.length) return i.reply('You do not have any cards yet.');
    return i.reply((`**Top Inventory**\n${cards.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • ${c.character.anime} • PWR ${money(c.power)} • ${fpRole(c.character)} • ${fpElement(c.character)}`).join('\n')}`).slice(0,1900));
  }
  if (commandName === 'formations') {
    const count = Math.max(1, Math.min(6, i.options.getInteger('count') || 6));
    const lines = ['**Your Formations**', '6 formations max • each formation has 6 characters.'];
    for (let f=1; f<=count; f++) {
      const cards = await fpFormationCards(userId, f);
      lines.push(`\n**Formation ${f}**`);
      if (!cards.length) lines.push('Empty.');
      else lines.push(...cards.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${money(c.power)} • ${fpRole(c.character)}`));
    }
    return i.reply(lines.join('\n').slice(0,1900));
  }
  if (commandName === 'autoteam') {
    const count = Math.max(1, Math.min(6, i.options.getInteger('formations') || 6));
    const cards = await prisma.userCard.findMany({ where:{userId}, include:{character:true}, orderBy:{power:'desc'}, take:count*6 });
    if (!cards.length) return i.reply('You do not have any cards yet.');
    for (let f=1; f<=count; f++) await fpSetFormation(userId, f, cards.slice((f-1)*6, f*6));
    return i.reply(`✅ Auto equipped **${count} formation(s)**. Each formation has **6 characters**.\nUse /formations to view.`);
  }
  if (commandName === 'formation-set') {
    const formation = Math.max(1, Math.min(6, i.options.getInteger('formation', true)));
    const names = ['slot1','slot2','slot3','slot4','slot5','slot6'].map(x => i.options.getString(x)).filter(Boolean);
    const cards = [];
    const used = new Set();
    for (const name of names) {
      const found = (await fpFindOwned(userId, name, 1))[0];
      if (found && !used.has(found.id)) { used.add(found.id); cards.push(found); }
    }
    if (!cards.length) return i.reply('No owned characters found from those names.');
    await fpSetFormation(userId, formation, cards);
    return i.reply(`✅ Formation ${formation} updated manually.\n${cards.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${money(c.power)}`).join('\n')}`);
  }
  if (commandName === 'story') return fpLiveMode(i, 'story', 1);
  if (commandName === 'tower') return fpLiveMode(i, 'tower', 1);
  if (commandName === 'dungeon') return fpLiveMode(i, 'dungeon', 1);
  if (commandName === 'auto-story') return fpLiveMode(i, 'story', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-tower') return fpLiveMode(i, 'tower', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-dungeon') return fpLiveMode(i, 'dungeon', i.options.getInteger('runs') || 10);
  return false;
}
// ===== END FINAL POLISH PATCH =====


// ===== FINAL OVERRIDE: CAPPED POWER + UNIQUE INVENTORY + REAL LIVE LOGS =====
async function foDefer(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);
}
async function foReply(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload).catch(() => null);
  return i.reply(payload).catch(() => null);
}
function foNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[().\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function foBaseName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent)\b/ig, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function foHash(v = '') {
  let h = 0;
  for (const ch of String(v)) h = ((h << 5) - h) + ch.charCodeAt(0);
  return Math.abs(h);
}
function foRange(rarity) {
  return {
    COMMON: [80, 180],
    RARE: [190, 360],
    EPIC: [380, 700],
    LEGENDARY: [720, 1150],
    MYTHIC: [1200, 1750],
    DIVINE: [1800, 2400],
    SECRET: [2450, 3300]
  }[rarity] || [100, 250];
}
function foBalancedBase(c) {
  const [min, max] = foRange(c?.rarity || 'COMMON');
  const seed = foHash(`${foBaseName(c?.name)}:${c?.anime || ''}:${c?.rarity || ''}`);
  return min + (seed % Math.max(1, max - min));
}
function foDisplayPower(card, c) {
  const level = Math.max(1, Math.min(99, Number(card?.level || 1)));
  const base = foBalancedBase(c || card?.character || {});
  return Math.floor(base * (1 + ((level - 1) * 0.035)));
}
function foRole(c) {
  if (typeof vxRole === 'function') return vxRole(c);
  if (typeof fpRole === 'function') return fpRole(c);
  if (typeof vrRole === 'function') return vrRole(c);
  return 'DPS';
}
function foElement(c) {
  if (typeof vxElement === 'function') return vxElement(c);
  if (typeof fpElement === 'function') return fpElement(c);
  if (typeof vrElement === 'function') return vrElement(c);
  return c?.element || 'Light';
}
function foPassive(c) {
  if (typeof vxPassive === 'function') return vxPassive(c);
  if (typeof fpPassive === 'function') return fpPassive(c);
  if (typeof vrPassive === 'function') return vrPassive(c);
  return 'Battle Instinct: ATK rises every round.';
}
function foStatsBlock(card, c) {
  const power = foDisplayPower(card, c);
  const level = Math.max(1, Math.min(99, Number(card?.level || 1)));
  const role = foRole(c);
  let atkS=1.05,hpS=7.2,defS=.55,spd=105,crit=15,critDmg=170,pen=0;
  if (role === 'Tank') { atkS=.72; hpS=13; defS=1.2; spd=90; crit=8; }
  if (role === 'Support') { atkS=.8; hpS=8.8; defS=.82; spd=110; crit=10; }
  if (role === 'Control') { atkS=.9; hpS=8.4; defS=.76; spd=118; crit=12; }
  if (role === 'Assassin') { atkS=1.28; hpS=5.8; defS=.42; spd=140; crit=28; critDmg=205; pen=12; }
  if (role === 'Mage') { atkS=1.34; hpS=6.1; defS=.48; spd=108; crit=17; critDmg=185; pen=22; }
  if (/nanami/i.test(c?.name || '')) { crit=40; critDmg=235; pen=Math.max(pen,12); }
  return `Class: **${role}** | Element: **${foElement(c)}**
Level **${level}/99** • ATK **${money(Math.floor(power*atkS))}** • HP **${money(Math.floor(power*hpS))}** • DEF **${money(Math.floor(power*defS))}** • SPD **${Math.floor(spd+level*.2)}**
CRIT **${crit}%** • CRIT DMG **${critDmg}%** • PEN **${pen}%**
Character Passive: ${foPassive(c)}`;
}
function foUniqueCards(cards) {
  const map = new Map();
  for (const card of cards) {
    const key = `${foNorm(foBaseName(card.character?.name || card.name))}:${foNorm(card.character?.anime || card.anime)}`;
    const old = map.get(key);
    const p = foDisplayPower(card, card.character || card);
    const oldp = old ? foDisplayPower(old, old.character || old) : -1;
    if (!old || p > oldp) map.set(key, card);
  }
  return [...map.values()];
}
async function foOwned(userId, take = 500) {
  return prisma.userCard.findMany({ where:{userId}, include:{character:true}, orderBy:{power:'desc'}, take });
}
async function foFindOwned(userId, q, limit=10) {
  const tokens = foNorm(q).split(/\s+/).filter(Boolean);
  const cards = foUniqueCards(await foOwned(userId, 700));
  return cards.map(card => {
    const c = card.character;
    const full = `${foNorm(foBaseName(c.name))} ${foNorm(c.name)} ${foNorm(c.anime)}`;
    let score=0;
    for (const t of tokens) {
      if (full.includes(t)) score += 50;
      if (foNorm(c.name).includes(t)) score += 80;
      if (foNorm(c.anime).includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
    return {card, score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || foDisplayPower(b.card,b.card.character)-foDisplayPower(a.card,a.card.character)).slice(0, limit).map(x=>x.card);
}
async function foSetFormation(userId, formation, cards) {
  const start = ((formation-1)*6)+1;
  await prisma.teamSlot.deleteMany({ where:{userId, slot:{gte:start, lte:start+5}} }).catch(()=>null);
  for (let x=0; x<Math.min(6,cards.length); x++) {
    const slot = start+x, card = cards[x];
    await prisma.teamSlot.upsert({
      where:{userId_slot:{userId, slot}},
      update:{cardId:card.id},
      create:{id:`${userId}_${slot}`, userId, slot, cardId:card.id}
    }).catch(async()=> {
      await prisma.teamSlot.create({data:{id:`${userId}_${Date.now()}_${slot}`, userId, slot, cardId:card.id}}).catch(()=>null);
    });
  }
}
async function foFormation(userId, formation) {
  const start = ((formation-1)*6)+1;
  const slots = await prisma.teamSlot.findMany({ where:{userId, slot:{gte:start,lte:start+5}}, include:{card:{include:{character:true}}}, orderBy:{slot:'asc'} }).catch(()=>[]);
  return slots.map(s=>s.card).filter(Boolean);
}
function foNeed(mode,p) {
  const v = mode==='story' ? p.chapter : mode==='tower' ? p.towerFloor : p.dungeonFloor;
  if (v>=60) return 6; if (v>=48) return 5; if (v>=36) return 4; if (v>=24) return 3; if (v>=12) return 2; return 1;
}
async function foTeamPower(userId, formations) {
  let total = 0;
  const fallback = foUniqueCards(await foOwned(userId, formations*12));
  for (let f=1; f<=formations; f++) {
    let team = await foFormation(userId, f);
    if (!team.length) team = fallback.slice((f-1)*6, f*6);
    total += team.reduce((s,c)=>s+foDisplayPower(c,c.character),0);
  }
  return total;
}
function foReq(mode,p,f) {
  const storyIndex = ((p.chapter-1)*30)+p.stage;
  const base = mode==='story' ? 650+storyIndex*300 : mode==='tower' ? 1100+p.towerFloor*520 : 900+p.dungeonFloor*430;
  const late = mode==='story' ? Math.max(0,p.chapter-40)*.035 : 0;
  return Math.floor(base*(1+(f-1)*.95+late));
}
function foRewards(mode, req, p) {
  const no = mode==='story' ? (((p.chapter-1)*30)+p.stage) : mode==='tower' ? p.towerFloor : p.dungeonFloor;
  return {gold:Math.floor(req*.8), tokens:Math.max(2,Math.floor(no/4)+2), rolls:mode==='story'?3:2, xp:mode==='story'?75:mode==='tower'?85:65};
}
async function foAdvance(userId, mode, p) {
  if (mode==='story') {
    let stage=p.stage+1, chapter=p.chapter;
    if (stage>30) { stage=1; chapter++; }
    if (chapter>80) { chapter=80; stage=30; }
    return prisma.storyProgress.update({where:{userId}, data:{chapter,stage}}).catch(()=>null);
  }
  if (mode==='tower') return prisma.storyProgress.update({where:{userId}, data:{towerFloor:p.towerFloor+1}}).catch(()=>null);
  return prisma.storyProgress.update({where:{userId}, data:{dungeonFloor:p.dungeonFloor+1}}).catch(()=>null);
}
const foLocks = new Set();
async function foLiveMode(i, mode, runs=1) {
  await foDefer(i);
  const key = `${i.user.id}:${mode}`;
  if (foLocks.has(key)) return foReply(i, `⏳ You already have **${mode}** running.`);
  foLocks.add(key);
  try {
    const max=Math.max(1,Math.min(30,runs));
    let wins=0,total={gold:0,tokens:0,rolls:0,xp:0};
    let out=`**${max>1?'AUTO ':''}${mode.toUpperCase()} STARTED**\n`;
    await i.editReply(out).catch(()=>null);
    await new Promise(r=>setTimeout(r,900));
    for (let run=1; run<=max; run++) {
      const p = await getOrCreateProgress(i.user.id);
      const f = foNeed(mode,p), power = await foTeamPower(i.user.id,f), req=foReq(mode,p,f);
      const title = mode==='story' ? `Chapter ${p.chapter}/80 • Stage ${p.stage}/30` : mode==='tower' ? `Tower Floor ${p.towerFloor}` : `Dungeon Floor ${p.dungeonFloor}`;
      out += `\nRun ${run}: **${title}** | Formations **${f}** | ${money(power)} vs ${money(req)}\n`;
      await i.editReply(out.slice(-1850)).catch(()=>null);
      await new Promise(r=>setTimeout(r,900));
      let energy=0;
      for (let round=1; round<=4; round++) {
        const dmg=Math.floor(power/(4+round)+Math.random()*500);
        energy += 32;
        out += `• Round ${round}: dealt **${money(dmg)}** damage. Energy ${Math.min(100,energy)}/100\n`;
        if (energy>=100) { out += `  🔥 **ULTIMATE COMBO!** Formation finisher activated.\n`; energy=0; }
        await i.editReply(out.slice(-1850)).catch(()=>null);
        await new Promise(r=>setTimeout(r,1000));
      }
      const won = power>=req || Math.random()<Math.min(.18,power/Math.max(1,req)/5);
      if (!won) { out += `❌ **Defeat.** Upgrade your formations.\n`; await i.editReply(out.slice(-1850)).catch(()=>null); break; }
      const latest=await getOrCreateProgress(i.user.id);
      const same = mode==='story' ? latest.chapter===p.chapter && latest.stage===p.stage : mode==='tower' ? latest.towerFloor===p.towerFloor : latest.dungeonFloor===p.dungeonFloor;
      if (!same) { out += `⛔ Duplicate reward blocked.\n`; await i.editReply(out.slice(-1850)).catch(()=>null); break; }
      const rw=foRewards(mode,req,p);
      await foAdvance(i.user.id,mode,p);
      await prisma.user.update({where:{id:i.user.id}, data:{gold:{increment:rw.gold},tokens:{increment:rw.tokens},rolls:{increment:rw.rolls}}}).catch(()=>null);
      if (typeof addUserXp==='function') await addUserXp(i.user.id,rw.xp,mode).catch(()=>null);
      wins++; total.gold+=rw.gold; total.tokens+=rw.tokens; total.rolls+=rw.rolls; total.xp+=rw.xp;
      out += `✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;
      await i.editReply(out.slice(-1850)).catch(()=>null);
      await new Promise(r=>setTimeout(r,900));
    }
    out += `\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
    return i.editReply(out.slice(-1900)).catch(()=>null);
  } finally { foLocks.delete(key); }
}
async function foFinalHandler(i,userId,commandName) {
  if (commandName==='roll' || commandName==='r') {
    await foDefer(i);
    const amount=Math.max(1,Math.min(10,i.options.getInteger('amount')||1));
    const user=await prisma.user.findUnique({where:{id:userId}});
    if ((user?.rolls||0)<amount) return foReply(i,`You need **${amount} rolls**, you have **${user?.rolls||0}**.`);
    await prisma.user.update({where:{id:userId}, data:{rolls:{decrement:amount}}});
    const lines=[], embeds=[];
    for (let x=0; x<amount; x++) {
      const result=await rollCard(userId);
      const display=foDisplayPower(result.card,result.character);
      lines.push(`${x+1}. ${rarityEmoji(result.character.rarity)} **${foBaseName(result.character.name)}** • ${result.character.anime} • PWR ${money(display)}\n${foStatsBlock(result.card,result.character).split('\n').slice(0,2).join(' | ')}`);
      const embed=new EmbedBuilder().setTitle(`${x+1}. ${rarityEmoji(result.character.rarity)} ${foBaseName(result.character.name)}`).setDescription(`Anime: **${result.character.anime}**\nRarity: **${result.character.rarity}**\nPower: **${money(display)}**\n${foStatsBlock(result.card,result.character)}`).setColor(embedColor(getAura(result.character).color));
      if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
      embeds.push(embed);
    }
    return foReply(i,{content:(`**ROLL x${amount}**\n${lines.join('\n\n')}\n\nRolls left: **${(user?.rolls||0)-amount}**`).slice(0,1900), embeds:embeds.slice(0,10)});
  }
  if (commandName==='inventory') {
    const unique=foUniqueCards(await foOwned(userId,800)).slice(0,25);
    if (!unique.length) return i.reply('You do not have any cards yet.');
    return i.reply((`**Top Inventory - Unique Characters**\n${unique.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${foBaseName(c.character.name)}** • ${c.character.anime} • PWR ${money(foDisplayPower(c,c.character))} • ${foRole(c.character)} • ${foElement(c.character)}`).join('\n')}`).slice(0,1900));
  }
  if (commandName==='search') {
    const q=i.options.getString('name',true), tokens=foNorm(q).split(/\s+/).filter(Boolean);
    const chars=await prisma.character.findMany({where:{active:true, OR:tokens.map(t=>({OR:[{name:{contains:t,mode:'insensitive'}},{anime:{contains:t,mode:'insensitive'}}]}))}, take:120});
    const ranked=foUniqueCards(chars.map(c=>({character:c, power:foBalancedBase(c), level:1}))).map(card=>{
      const c=card.character, full=`${foNorm(foBaseName(c.name))} ${foNorm(c.name)} ${foNorm(c.anime)}`;
      let score=0; for (const t of tokens){ if(full.includes(t))score+=50; if(foNorm(c.name).includes(t))score+=80; if(foNorm(c.anime).includes(t))score+=30;}
      return {c,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||foBalancedBase(b.c)-foBalancedBase(a.c)).slice(0,10).map(x=>x.c);
    if(!ranked.length)return i.reply(`No characters found for **${q}**.`);
    const first=ranked[0];
    const embed=new EmbedBuilder().setTitle(`Search: ${q}`).setDescription(`**Best Match**\n${rarityEmoji(first.rarity)} **${foBaseName(first.name)}** • ${first.anime} • PWR **${money(foBalancedBase(first))}**\n${foStatsBlock({power:foBalancedBase(first),level:1},first)}\n\n**Results**\n${ranked.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.rarity)} **${foBaseName(c.name)}** • ${c.anime} • PWR ${money(foBalancedBase(c))} • ${foRole(c)} • ${foElement(c)}`).join('\n')}`).setColor(embedColor(getAura(first).color));
    if(first.imageUrl)embed.setThumbnail(first.imageUrl);
    return i.reply({embeds:[embed]});
  }
  if (commandName==='stats' || commandName==='inv-search') {
    const q=i.options.getString('name',true);
    const matches=await foFindOwned(userId,q,10);
    if(!matches.length)return i.reply(`No owned characters found for **${q}**.`);
    const first=matches[0], display=foDisplayPower(first,first.character);
    const embed=new EmbedBuilder().setTitle(commandName==='stats'?`Stats: ${foBaseName(first.character.name)}`:`Inventory Search: ${q}`).setDescription(`${rarityEmoji(first.character.rarity)} **${foBaseName(first.character.name)}** • ${first.character.anime} • PWR **${money(display)}**\n${foStatsBlock(first,first.character)}${commandName==='inv-search'?`\n\n**Owned Results**\n${matches.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${foBaseName(c.character.name)}** • PWR ${money(foDisplayPower(c,c.character))}`).join('\n')}`:''}`).setColor(embedColor(getAura(first.character).color));
    if(first.character.imageUrl)embed.setThumbnail(first.character.imageUrl);
    return i.reply({embeds:[embed]});
  }
  if (commandName==='formations') {
    const count=Math.max(1,Math.min(6,i.options.getInteger('count')||6));
    const lines=['**Your Formations**','6 formations max • each formation has 6 characters.'];
    for(let f=1;f<=count;f++){const cards=await foFormation(userId,f);lines.push(`\n**Formation ${f}**`);if(!cards.length)lines.push('Empty.');else lines.push(...cards.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${foBaseName(c.character.name)}** • PWR ${money(foDisplayPower(c,c.character))} • ${foRole(c.character)}`));}
    return i.reply(lines.join('\n').slice(0,1900));
  }
  if (commandName==='autoteam') {
    const count=Math.max(1,Math.min(6,i.options.getInteger('formations')||6));
    const unique=foUniqueCards(await foOwned(userId,900)).slice(0,count*6);
    if(!unique.length)return i.reply('You do not have any cards yet.');
    for(let f=1;f<=count;f++)await foSetFormation(userId,f,unique.slice((f-1)*6,f*6));
    return i.reply(`✅ Auto equipped **${count} formation(s)** with unique characters. Each formation has **6 characters**.`);
  }
  if (commandName==='formation-set') {
    const formation=Math.max(1,Math.min(6,i.options.getInteger('formation',true)));
    const names=['slot1','slot2','slot3','slot4','slot5','slot6'].map(x=>i.options.getString(x)).filter(Boolean);
    const cards=[]; const used=new Set();
    for(const name of names){const found=(await foFindOwned(userId,name,1))[0]; if(found&&!used.has(found.id)){used.add(found.id); cards.push(found);}}
    if(!cards.length)return i.reply('No owned characters found from those names.');
    await foSetFormation(userId,formation,cards);
    return i.reply(`✅ Formation ${formation} updated manually.\n${cards.map((c,idx)=>`${idx+1}. ${rarityEmoji(c.character.rarity)} **${foBaseName(c.character.name)}** • PWR ${money(foDisplayPower(c,c.character))}`).join('\n')}`);
  }
  if (commandName==='story')return foLiveMode(i,'story',1);
  if (commandName==='tower')return foLiveMode(i,'tower',1);
  if (commandName==='dungeon')return foLiveMode(i,'dungeon',1);
  if (commandName==='auto-story')return foLiveMode(i,'story',i.options.getInteger('runs')||10);
  if (commandName==='auto-tower')return foLiveMode(i,'tower',i.options.getInteger('runs')||10);
  if (commandName==='auto-dungeon')return foLiveMode(i,'dungeon',i.options.getInteger('runs')||10);
  return false;
}
// ===== END FINAL OVERRIDE PATCH =====


// ===== LOG NAMES + ASCEND/TRAIN + BOSS RUSH FIX =====
async function ftDefer(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);
}
async function ftReply(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload).catch(() => null);
  return i.reply(payload).catch(() => null);
}
function ftName(cardOrChar) {
  const c = cardOrChar?.character || cardOrChar;
  if (typeof foBaseName === 'function') return foBaseName(c?.name || '');
  return String(c?.name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
async function ftEnemyPool(limit = 120) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    orderBy: { basePower: 'desc' },
    take: limit
  }).catch(() => []);
  return chars.length ? chars : [
    { name: 'Sukuna', anime: 'Jujutsu Kaisen', rarity: 'SECRET', basePower: 3000 },
    { name: 'Madara', anime: 'Naruto', rarity: 'SECRET', basePower: 2800 },
    { name: 'Aizen', anime: 'Bleach', rarity: 'SECRET', basePower: 2700 }
  ];
}
async function ftPickEnemies(count = 6, offset = 0) {
  const pool = await ftEnemyPool(180);
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(pool[(offset + i * 7) % pool.length]);
  }
  return result;
}
function ftFormationNeeded(mode, p) {
  const v = mode === 'story' ? p.chapter : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  if (v >= 60) return 6;
  if (v >= 48) return 5;
  if (v >= 36) return 4;
  if (v >= 24) return 3;
  if (v >= 12) return 2;
  return 1;
}
async function ftFormationTeam(userId, formation) {
  if (typeof foFormation === 'function') return foFormation(userId, formation);
  const start = ((formation - 1) * 6) + 1;
  const slots = await prisma.teamSlot.findMany({
    where: { userId, slot: { gte: start, lte: start + 5 } },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);
  return slots.map(s => s.card).filter(Boolean);
}
async function ftFallbackTeam(userId, formation, count) {
  const cards = typeof foOwned === 'function'
    ? await foOwned(userId, count * 6 + 30)
    : await prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { power: 'desc' }, take: count * 6 + 30 });
  const unique = typeof foUniqueCards === 'function' ? foUniqueCards(cards) : cards;
  return unique.slice((formation - 1) * 6, formation * 6);
}
async function ftTeams(userId, count) {
  const teams = [];
  for (let f = 1; f <= count; f++) {
    let team = await ftFormationTeam(userId, f);
    if (!team.length) team = await ftFallbackTeam(userId, f, count);
    teams.push(team.slice(0, 6));
  }
  return teams;
}
function ftCardPower(card) {
  if (typeof foDisplayPower === 'function') return foDisplayPower(card, card.character);
  return Number(card?.power || 0);
}
async function ftTotalPower(userId, formations) {
  const teams = await ftTeams(userId, formations);
  return {
    teams,
    total: teams.flat().reduce((sum, c) => sum + ftCardPower(c), 0)
  };
}
function ftReq(mode, p, f) {
  if (typeof foReq === 'function') return foReq(mode, p, f);
  const storyIndex = ((p.chapter - 1) * 30) + p.stage;
  const base = mode === 'story' ? 650 + storyIndex * 300 : mode === 'tower' ? 1100 + p.towerFloor * 520 : 900 + p.dungeonFloor * 430;
  return Math.floor(base * (1 + (f - 1) * .95));
}
function ftRewards(mode, req, p) {
  if (typeof foRewards === 'function') return foRewards(mode, req, p);
  const no = mode === 'story' ? (((p.chapter - 1) * 30) + p.stage) : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  return { gold: Math.floor(req * .8), tokens: Math.max(2, Math.floor(no / 4) + 2), rolls: mode === 'story' ? 3 : 2, xp: mode === 'story' ? 75 : mode === 'tower' ? 85 : 65 };
}
async function ftAdvance(userId, mode, p) {
  if (typeof foAdvance === 'function') return foAdvance(userId, mode, p);
  if (mode === 'story') {
    let stage = p.stage + 1, chapter = p.chapter;
    if (stage > 30) { stage = 1; chapter += 1; }
    if (chapter > 80) { chapter = 80; stage = 30; }
    return prisma.storyProgress.update({ where: { userId }, data: { chapter, stage } }).catch(() => null);
  }
  if (mode === 'tower') return prisma.storyProgress.update({ where: { userId }, data: { towerFloor: p.towerFloor + 1 } }).catch(() => null);
  return prisma.storyProgress.update({ where: { userId }, data: { dungeonFloor: p.dungeonFloor + 1 } }).catch(() => null);
}
const ftLocks = new Set();
async function ftLiveMode(i, mode, runs = 1) {
  await ftDefer(i);
  const key = `${i.user.id}:${mode}`;
  if (ftLocks.has(key)) return ftReply(i, `⏳ You already have **${mode}** running.`);
  ftLocks.add(key);
  try {
    const max = Math.max(1, Math.min(30, runs));
    let wins = 0, total = { gold: 0, tokens: 0, rolls: 0, xp: 0 };
    let out = `**${max > 1 ? 'AUTO ' : ''}${mode.toUpperCase()} STARTED**\n`;
    await i.editReply(out).catch(() => null);
    await new Promise(r => setTimeout(r, 1000));
    for (let run = 1; run <= max; run++) {
      const p = await getOrCreateProgress(i.user.id);
      const formations = ftFormationNeeded(mode, p);
      const power = await ftTotalPower(i.user.id, formations);
      const req = ftReq(mode, p, formations);
      const enemies = await ftPickEnemies(formations * 6, run + (mode === 'story' ? p.chapter : mode === 'tower' ? p.towerFloor : p.dungeonFloor));
      const title = mode === 'story' ? `Chapter ${p.chapter}/80 • Stage ${p.stage}/30` : mode === 'tower' ? `Tower Floor ${p.towerFloor}` : `Dungeon Floor ${p.dungeonFloor}`;
      out += `\nRun ${run}: **${title}**\nRequired formations: **${formations}** × 6 characters\nYour Power: **${money(power.total)}** | Enemy Power: **${money(req)}**\n`;
      await i.editReply(out.slice(-1850)).catch(() => null);
      await new Promise(r => setTimeout(r, 1000));
      let energy = 0;
      for (let round = 1; round <= 4; round++) {
        const team = power.teams[(round - 1) % Math.max(1, power.teams.length)] || [];
        const hero = team[(round - 1) % Math.max(1, team.length)];
        const enemy = enemies[(round - 1) % Math.max(1, enemies.length)];
        const heroName = hero ? ftName(hero) : 'Your Formation';
        const enemyName = enemy ? ftName(enemy) : 'Enemy';
        const dmg = Math.floor(power.total / (4 + round) + Math.random() * 500);
        energy += 32;
        out += `• Round ${round}: **${heroName}** attacked **${enemyName}** for **${money(dmg)}** damage. Energy ${Math.min(100, energy)}/100\n`;
        if (energy >= 100) {
          const finisher = team[(round + 1) % Math.max(1, team.length)];
          out += `  🔥 **ULTIMATE COMBO!** **${ftName(finisher || hero)}** unleashed a finisher on **${enemyName}**.\n`;
          energy = 0;
        }
        await i.editReply(out.slice(-1850)).catch(() => null);
        await new Promise(r => setTimeout(r, 1100));
      }
      const won = power.total >= req || Math.random() < Math.min(.18, power.total / Math.max(1, req) / 5);
      if (!won) { out += `❌ **Defeat.** Upgrade your formations or add more teams.\n`; await i.editReply(out.slice(-1850)).catch(() => null); break; }
      const latest = await getOrCreateProgress(i.user.id);
      const same = mode === 'story' ? latest.chapter === p.chapter && latest.stage === p.stage : mode === 'tower' ? latest.towerFloor === p.towerFloor : latest.dungeonFloor === p.dungeonFloor;
      if (!same) { out += `⛔ Duplicate reward blocked.\n`; await i.editReply(out.slice(-1850)).catch(() => null); break; }
      const rw = ftRewards(mode, req, p);
      await ftAdvance(i.user.id, mode, p);
      await prisma.user.update({ where: { id: i.user.id }, data: { gold: { increment: rw.gold }, tokens: { increment: rw.tokens }, rolls: { increment: rw.rolls } } }).catch(() => null);
      if (typeof addUserXp === 'function') await addUserXp(i.user.id, rw.xp, mode).catch(() => null);
      wins++; total.gold += rw.gold; total.tokens += rw.tokens; total.rolls += rw.rolls; total.xp += rw.xp;
      out += `✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;
      await i.editReply(out.slice(-1850)).catch(() => null);
      await new Promise(r => setTimeout(r, 900));
    }
    out += `\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
    return i.editReply(out.slice(-1900)).catch(() => null);
  } finally { ftLocks.delete(key); }
}
async function ftTrain(i) {
  await ftDefer(i);
  const q = i.options.getString('name', true);
  const matches = await foFindOwned(i.user.id, q, 1);
  if (!matches.length) return ftReply(i, `No owned character found for **${q}**.`);
  const card = matches[0];
  const user = await prisma.user.findUnique({ where: { id: i.user.id } });
  const level = Math.max(1, Math.min(99, Number(card.level || 1)));
  if (level >= 99) return ftReply(i, `**${ftName(card)}** is already level 99.`);
  const cost = 500 + level * 250;
  if ((user?.gold || 0) < cost) return ftReply(i, `You need **${money(cost)} Gold** to train **${ftName(card)}**.`);
  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { decrement: cost } } });
  await prisma.userCard.update({ where: { id: card.id }, data: { level: level + 1, power: { increment: 25 } } }).catch(async () => {
    await prisma.userCard.update({ where: { id: card.id }, data: { power: { increment: 25 } } }).catch(() => null);
  });
  return ftReply(i, `✅ **${ftName(card)}** trained!\nLevel: **${level} → ${level + 1}**\nCost: **${money(cost)} Gold**`);
}
async function ftAscend(i) {
  await ftDefer(i);
  const q = i.options.getString('name', true);
  const matches = await foFindOwned(i.user.id, q, 20);
  if (!matches.length) return ftReply(i, `No owned character found for **${q}**.`);
  const main = matches[0];
  const same = (await prisma.userCard.findMany({ where: { userId: i.user.id, characterId: main.characterId }, include: { character: true }, orderBy: { power: 'asc' }, take: 20 })).filter(c => c.id !== main.id);
  if (!same.length) return ftReply(i, `You need a duplicate of **${ftName(main)}** to ascend.`);
  const consume = same[0];
  await prisma.userCard.delete({ where: { id: consume.id } }).catch(() => null);
  await prisma.userCard.update({ where: { id: main.id }, data: { power: { increment: 150 } } }).catch(() => null);
  return ftReply(i, `✨ **${ftName(main)} ascended!**\nConsumed duplicate: **${ftName(consume)}**\nPower bonus added.`);
}
async function ftBossRush(i, coop = false) {
  await ftDefer(i);
  const formations = coop ? 2 : 1;
  const power = await ftTotalPower(i.user.id, formations);
  const enemies = await ftPickEnemies(coop ? 8 : 5, coop ? 20 : 10);
  const boss = enemies[0];
  const bossHp = coop ? 2200000 : 1100000;
  let damage = 0;
  let out = `**${coop ? 'CO-OP ' : 'SOLO '}BOSS RUSH**\nBoss: **${ftName(boss)}** • ${boss.anime || 'Anime'}\nBoss HP: **${money(bossHp)}**\nYour Power: **${money(power.total)}**\n`;
  await i.editReply(out).catch(() => null);
  await new Promise(r => setTimeout(r, 1000));
  for (let round = 1; round <= 6; round++) {
    const team = power.teams[(round - 1) % Math.max(1, power.teams.length)] || [];
    const hero = team[(round - 1) % Math.max(1, team.length)];
    const enemy = enemies[(round - 1) % enemies.length] || boss;
    const hit = Math.floor(power.total / (3 + round) + Math.random() * 8000);
    damage += hit;
    out += `\nRound ${round}: **${ftName(hero || { name: 'Your Team' })}** hit **${ftName(enemy)}** for **${money(hit)}**.`;
    if (round === 3 || round === 6) {
      const ult = Math.floor(hit * 1.8);
      damage += ult;
      out += `\n🔥 **ULTIMATE COMBO!** Extra **${money(ult)}** damage.`;
    }
    await i.editReply(out.slice(-1850)).catch(() => null);
    await new Promise(r => setTimeout(r, 1100));
  }
  const clear = damage >= bossHp;
  const rw = { gold: Math.floor(damage * .45), tokens: Math.max(8, Math.floor(damage / 45000)), rolls: clear ? 10 : 4, xp: clear ? 220 : 100 };
  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { increment: rw.gold }, tokens: { increment: rw.tokens }, rolls: { increment: rw.rolls } } }).catch(() => null);
  if (typeof addUserXp === 'function') await addUserXp(i.user.id, rw.xp, 'boss-rush').catch(() => null);
  out += `\n\n**${clear ? 'Boss Cleared!' : 'Boss Escaped!'}**\nTotal Damage: **${money(damage)}**\nRewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**`;
  return i.editReply(out.slice(-1900)).catch(() => null);
}
async function ftFinalHandler(i, userId, commandName) {
  if (commandName === 'story') return ftLiveMode(i, 'story', 1);
  if (commandName === 'tower') return ftLiveMode(i, 'tower', 1);
  if (commandName === 'dungeon') return ftLiveMode(i, 'dungeon', 1);
  if (commandName === 'auto-story') return ftLiveMode(i, 'story', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-tower') return ftLiveMode(i, 'tower', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-dungeon') return ftLiveMode(i, 'dungeon', i.options.getInteger('runs') || 10);
  if (commandName === 'boss-rush') return ftBossRush(i, false);
  if (commandName === 'coop-boss-rush') return ftBossRush(i, true);
  if (commandName === 'train') return ftTrain(i);
  if (commandName === 'ascend') return ftAscend(i);
  return false;
}
// ===== END LOG NAMES + ASCEND/TRAIN + BOSS RUSH FIX =====


// ===== FINAL USER FIX: NO CARD ID + IMAGE INVENTORY + REAL BATTLE LOGS =====
async function fuDefer(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);
}
async function fuReply(i, payload) {
  if (i.deferred || i.replied) return i.editReply(payload).catch(() => null);
  return i.reply(payload).catch(() => null);
}
function fuNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[().\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function fuBaseName(name = '') {
  if (typeof foBaseName === 'function') return foBaseName(name);
  return String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}
function fuDisplayPower(card, c) {
  if (typeof foDisplayPower === 'function') return foDisplayPower(card, c || card?.character);
  return Number(card?.power || c?.basePower || 0);
}
function fuStatsBlock(card, c) {
  if (typeof foStatsBlock === 'function') return foStatsBlock(card, c || card?.character);
  if (typeof vxStatsBlock === 'function') return vxStatsBlock(card, c || card?.character);
  return `Power: **${money(fuDisplayPower(card, c))}**`;
}
function fuRole(c) {
  if (typeof foRole === 'function') return foRole(c);
  if (typeof vxRole === 'function') return vxRole(c);
  return 'DPS';
}
function fuElement(c) {
  if (typeof foElement === 'function') return foElement(c);
  if (typeof vxElement === 'function') return vxElement(c);
  return c?.element || 'Light';
}
async function fuOwned(userId, take = 900) {
  return prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { power: 'desc' }, take });
}
function fuUniqueCards(cards) {
  const map = new Map();
  for (const card of cards) {
    const c = card.character || card;
    const key = `${fuNorm(fuBaseName(c.name))}:${fuNorm(c.anime)}`;
    const old = map.get(key);
    if (!old || fuDisplayPower(card, c) > fuDisplayPower(old, old.character || old)) map.set(key, card);
  }
  return [...map.values()];
}
async function fuFindOwned(userId, q, limit = 10) {
  const tokens = fuNorm(q).split(/\s+/).filter(Boolean);
  const cards = fuUniqueCards(await fuOwned(userId));
  return cards.map(card => {
    const c = card.character;
    const full = `${fuNorm(fuBaseName(c.name))} ${fuNorm(c.name)} ${fuNorm(c.anime)}`;
    let score = 0;
    for (const t of tokens) {
      if (full.includes(t)) score += 60;
      if (fuNorm(c.name).includes(t)) score += 80;
      if (fuNorm(c.anime).includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 160;
    return { card, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score || fuDisplayPower(b.card,b.card.character)-fuDisplayPower(a.card,a.card.character)).slice(0, limit).map(x => x.card);
}
async function fuInventoryPage(userId, page = 0) {
  const cards = fuUniqueCards(await fuOwned(userId));
  if (!cards.length) return { empty: true };
  const safe = Math.max(0, Math.min(page, cards.length - 1));
  const card = cards[safe];
  const c = card.character;
  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.rarity)} ${fuBaseName(c.name)}`)
    .setDescription(
      `Anime: **${c.anime}**\n` +
      `Rarity: **${c.rarity}**\n` +
      `Power: **${money(fuDisplayPower(card, c))}**\n` +
      `${fuStatsBlock(card, c)}\n\n` +
      `Unique Card: **${safe + 1}/${cards.length}**`
    )
    .setColor(embedColor(getAura(c).color))
    .setFooter({ text: `Use buttons to move right/left • No card ID needed` });
  if (c.imageUrl) embed.setImage(c.imageUrl);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`vri_prev_${safe}`).setLabel('⬅️ Left').setStyle(ButtonStyle.Secondary).setDisabled(safe <= 0),
    new ButtonBuilder().setCustomId(`vri_next_${safe}`).setLabel('Right ➡️').setStyle(ButtonStyle.Secondary).setDisabled(safe >= cards.length - 1)
  );
  return { empty: false, embed, row };
}
async function fuEnemyPool(limit = 180) {
  const chars = await prisma.character.findMany({ where: { active: true }, orderBy: { basePower: 'desc' }, take: limit }).catch(() => []);
  return chars.length ? fuUniqueCards(chars.map(c => ({ character: c, power: c.basePower, level: 1 }))).map(x => x.character) : [
    { name: 'Sukuna', anime: 'Jujutsu Kaisen', rarity: 'SECRET', basePower: 3000 },
    { name: 'Madara', anime: 'Naruto', rarity: 'SECRET', basePower: 2800 },
    { name: 'Aizen', anime: 'Bleach', rarity: 'SECRET', basePower: 2700 }
  ];
}
async function fuPickEnemies(count = 6, offset = 0) {
  const pool = await fuEnemyPool();
  const arr = [];
  for (let i = 0; i < count; i++) arr.push(pool[(offset + i * 11) % pool.length]);
  return arr;
}
async function fuFormation(userId, formation) {
  const start = ((formation - 1) * 6) + 1;
  const slots = await prisma.teamSlot.findMany({ where: { userId, slot: { gte: start, lte: start + 5 } }, include: { card: { include: { character: true } } }, orderBy: { slot: 'asc' } }).catch(() => []);
  return slots.map(s => s.card).filter(Boolean);
}
async function fuSetFormation(userId, formation, cards) {
  const start = ((formation - 1) * 6) + 1;
  await prisma.teamSlot.deleteMany({ where: { userId, slot: { gte: start, lte: start + 5 } } }).catch(() => null);
  for (let i = 0; i < Math.min(6, cards.length); i++) {
    const slot = start + i, card = cards[i];
    await prisma.teamSlot.upsert({
      where: { userId_slot: { userId, slot } },
      update: { cardId: card.id },
      create: { id: `${userId}_${slot}`, userId, slot, cardId: card.id }
    }).catch(async () => {
      await prisma.teamSlot.create({ data: { id: `${userId}_${Date.now()}_${slot}`, userId, slot, cardId: card.id } }).catch(() => null);
    });
  }
}
function fuNeeded(mode, p) {
  const v = mode === 'story' ? p.chapter : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  if (v >= 60) return 6;
  if (v >= 48) return 5;
  if (v >= 36) return 4;
  if (v >= 24) return 3;
  if (v >= 12) return 2;
  return 1;
}
async function fuTeams(userId, count) {
  const unique = fuUniqueCards(await fuOwned(userId, 900));
  const teams = [];
  for (let f = 1; f <= count; f++) {
    let team = await fuFormation(userId, f);
    if (!team.length) team = unique.slice((f - 1) * 6, f * 6);
    teams.push(team.slice(0, 6));
  }
  return teams;
}
async function fuPower(userId, count) {
  const teams = await fuTeams(userId, count);
  return { teams, total: teams.flat().reduce((sum, c) => sum + fuDisplayPower(c, c.character), 0) };
}
function fuReq(mode, p, f) {
  const storyIndex = ((p.chapter - 1) * 30) + p.stage;
  const base = mode === 'story' ? 650 + storyIndex * 300 : mode === 'tower' ? 1100 + p.towerFloor * 520 : 900 + p.dungeonFloor * 430;
  const late = mode === 'story' ? Math.max(0, p.chapter - 40) * .035 : 0;
  return Math.floor(base * (1 + (f - 1) * .95 + late));
}
function fuRewards(mode, req, p) {
  const no = mode === 'story' ? (((p.chapter - 1) * 30) + p.stage) : mode === 'tower' ? p.towerFloor : p.dungeonFloor;
  return { gold: Math.floor(req * .8), tokens: Math.max(2, Math.floor(no / 4) + 2), rolls: mode === 'story' ? 3 : 2, xp: mode === 'story' ? 75 : mode === 'tower' ? 85 : 65 };
}
async function fuAdvance(userId, mode, p) {
  if (mode === 'story') {
    let stage = p.stage + 1, chapter = p.chapter;
    if (stage > 30) { stage = 1; chapter++; }
    if (chapter > 80) { chapter = 80; stage = 30; }
    return prisma.storyProgress.update({ where: { userId }, data: { chapter, stage } }).catch(() => null);
  }
  if (mode === 'tower') return prisma.storyProgress.update({ where: { userId }, data: { towerFloor: p.towerFloor + 1 } }).catch(() => null);
  return prisma.storyProgress.update({ where: { userId }, data: { dungeonFloor: p.dungeonFloor + 1 } }).catch(() => null);
}
const fuLocks = new Set();
async function fuBattle(i, mode, runs = 1) {
  await fuDefer(i);
  const key = `${i.user.id}:${mode}`;
  if (fuLocks.has(key)) return fuReply(i, `⏳ You already have **${mode}** running.`);
  fuLocks.add(key);
  try {
    const max = Math.max(1, Math.min(30, runs));
    let wins = 0, total = { gold: 0, tokens: 0, rolls: 0, xp: 0 };
    let out = `**${max > 1 ? 'AUTO ' : ''}${mode.toUpperCase()} LIVE BATTLE**\n`;
    await i.editReply(out).catch(() => null);
    await new Promise(r => setTimeout(r, 1200));
    for (let run = 1; run <= max; run++) {
      const p = await getOrCreateProgress(i.user.id);
      const formations = fuNeeded(mode, p);
      const my = await fuPower(i.user.id, formations);
      const req = fuReq(mode, p, formations);
      const enemies = await fuPickEnemies(formations * 6, run + (mode === 'story' ? p.chapter : mode === 'tower' ? p.towerFloor : p.dungeonFloor));
      const title = mode === 'story' ? `Chapter ${p.chapter}/80 • Stage ${p.stage}/30` : mode === 'tower' ? `Tower Floor ${p.towerFloor}` : `Dungeon Floor ${p.dungeonFloor}`;
      let enemyHp = Math.max(1200, req * 6);
      let teamHp = Math.max(1200, my.total * 6);
      out += `\n**${title}**\nRequired formations: **${formations}** × 6 characters\nTeam HP: **${money(teamHp)}** | Enemy HP: **${money(enemyHp)}**\n`;
      await i.editReply(out.slice(-1850)).catch(() => null);
      await new Promise(r => setTimeout(r, 1200));
      for (let round = 1; round <= 5; round++) {
        const team = my.teams[(round - 1) % Math.max(1, my.teams.length)] || [];
        const hero = team[(round - 1) % Math.max(1, team.length)];
        const enemy = enemies[(round - 1) % enemies.length];
        const heroName = hero ? fuBaseName(hero.character.name) : 'Your Formation';
        const enemyName = enemy ? fuBaseName(enemy.name) : 'Enemy';
        const hit = Math.floor(my.total / (4 + round) + Math.random() * 700);
        const enemyHit = Math.floor(req / (5 + round) + Math.random() * 400);
        enemyHp = Math.max(0, enemyHp - hit);
        teamHp = Math.max(0, teamHp - enemyHit);
        out += `• Round ${round}: **${heroName}** attacked **${enemyName}** for **${money(hit)}**. Enemy HP left: **${money(enemyHp)}**\n`;
        await i.editReply(out.slice(-1850)).catch(() => null);
        await new Promise(r => setTimeout(r, 1300));
        out += `  **${enemyName}** countered for **${money(enemyHit)}**. Your team HP left: **${money(teamHp)}**\n`;
        await i.editReply(out.slice(-1850)).catch(() => null);
        await new Promise(r => setTimeout(r, 1300));
        if (round === 3 || enemyHp <= req * 2) {
          const finisher = team[(round + 1) % Math.max(1, team.length)] || hero;
          const ult = Math.floor(hit * 1.9);
          enemyHp = Math.max(0, enemyHp - ult);
          out += `  🔥 **ULTIMATE! ${fuBaseName((finisher?.character || finisher || {}).name || heroName)}** used a finisher on **${enemyName}** for **${money(ult)}**. Enemy HP: **${money(enemyHp)}**\n`;
          await i.editReply(out.slice(-1850)).catch(() => null);
          await new Promise(r => setTimeout(r, 1500));
        }
        if (enemyHp <= 0 || teamHp <= 0) break;
      }
      const won = enemyHp <= 0 || (teamHp > 0 && my.total >= req);
      if (!won) {
        out += `❌ **Defeat.** Enemy survived with **${money(enemyHp)} HP**.\n`;
        await i.editReply(out.slice(-1850)).catch(() => null);
        break;
      }
      const latest = await getOrCreateProgress(i.user.id);
      const same = mode === 'story' ? latest.chapter === p.chapter && latest.stage === p.stage : mode === 'tower' ? latest.towerFloor === p.towerFloor : latest.dungeonFloor === p.dungeonFloor;
      if (!same) { out += `⛔ Duplicate reward blocked.\n`; await i.editReply(out.slice(-1850)).catch(() => null); break; }
      const rw = fuRewards(mode, req, p);
      await fuAdvance(i.user.id, mode, p);
      await prisma.user.update({ where: { id: i.user.id }, data: { gold: { increment: rw.gold }, tokens: { increment: rw.tokens }, rolls: { increment: rw.rolls } } }).catch(() => null);
      if (typeof addUserXp === 'function') await addUserXp(i.user.id, rw.xp, mode).catch(() => null);
      wins++; total.gold += rw.gold; total.tokens += rw.tokens; total.rolls += rw.rolls; total.xp += rw.xp;
      out += `✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;
      await i.editReply(out.slice(-1850)).catch(() => null);
      await new Promise(r => setTimeout(r, 1200));
    }
    out += `\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
    return i.editReply(out.slice(-1900)).catch(() => null);
  } finally { fuLocks.delete(key); }
}
async function fuTrain(i) {
  await fuDefer(i);
  const q = i.options.getString('name', true);
  const card = (await fuFindOwned(i.user.id, q, 1))[0];
  if (!card) return fuReply(i, `No owned character found for **${q}**.`);
  const user = await prisma.user.findUnique({ where: { id: i.user.id } });
  const level = Math.max(1, Number(card.level || 1));
  if (level >= 99) return fuReply(i, `**${fuBaseName(card.character.name)}** is already level 99.`);
  const cost = 500 + level * 250;
  if ((user?.gold || 0) < cost) return fuReply(i, `You need **${money(cost)} Gold** to train **${fuBaseName(card.character.name)}**.`);
  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { decrement: cost } } });
  await prisma.userCard.update({ where: { id: card.id }, data: { level: level + 1, power: { increment: 25 } } }).catch(() => null);
  return fuReply(i, `✅ **${fuBaseName(card.character.name)}** trained!\nLevel: **${level} → ${level + 1}**\nCost: **${money(cost)} Gold**\nNo card ID needed.`);
}
async function fuAscend(i) {
  await fuDefer(i);
  const q = i.options.getString('name', true);
  const card = (await fuFindOwned(i.user.id, q, 1))[0];
  if (!card) return fuReply(i, `No owned character found for **${q}**.`);
  const dupes = await prisma.userCard.findMany({ where: { userId: i.user.id, characterId: card.characterId }, include: { character: true }, orderBy: { power: 'asc' }, take: 10 });
  const consume = dupes.find(c => c.id !== card.id);
  if (!consume) return fuReply(i, `You need a duplicate of **${fuBaseName(card.character.name)}** to ascend.`);
  await prisma.userCard.delete({ where: { id: consume.id } }).catch(() => null);
  await prisma.userCard.update({ where: { id: card.id }, data: { power: { increment: 150 } } }).catch(() => null);
  return fuReply(i, `✨ **${fuBaseName(card.character.name)} ascended!**\nConsumed duplicate automatically.\nNo card ID needed.`);
}
async function fuBoss(i, coop = false) {
  await fuDefer(i);
  const formations = coop ? 2 : 1;
  const my = await fuPower(i.user.id, formations);
  const enemies = await fuPickEnemies(coop ? 8 : 5, coop ? 50 : 20);
  const boss = enemies[0];
  let bossHp = coop ? 2200000 : 1100000;
  let teamHp = Math.max(2000, my.total * 7);
  let out = `**${coop ? 'CO-OP ' : 'SOLO '}BOSS RUSH LIVE**\nBoss: **${fuBaseName(boss.name)}** • ${boss.anime || 'Anime'}\nBoss HP: **${money(bossHp)}** | Team HP: **${money(teamHp)}**\n`;
  await i.editReply(out).catch(() => null);
  await new Promise(r => setTimeout(r, 1200));
  const teams = my.teams || [];
  for (let round = 1; round <= 8; round++) {
    const team = teams[(round - 1) % Math.max(1, teams.length)] || [];
    const hero = team[(round - 1) % Math.max(1, team.length)];
    const heroName = hero ? fuBaseName(hero.character.name) : 'Your Team';
    const hit = Math.floor(my.total / (3 + round) + Math.random() * 9000);
    const bossHit = Math.floor((coop ? 90000 : 45000) + Math.random() * 5000);
    bossHp = Math.max(0, bossHp - hit);
    teamHp = Math.max(0, teamHp - bossHit);
    out += `\nRound ${round}: **${heroName}** hit **${fuBaseName(boss.name)}** for **${money(hit)}**. Boss HP: **${money(bossHp)}**`;
    await i.editReply(out.slice(-1850)).catch(() => null);
    await new Promise(r => setTimeout(r, 1200));
    out += `\nBoss countered for **${money(bossHit)}**. Team HP: **${money(teamHp)}**`;
    await i.editReply(out.slice(-1850)).catch(() => null);
    await new Promise(r => setTimeout(r, 1200));
    if (round === 3 || round === 6) {
      const ult = Math.floor(hit * 2.2);
      bossHp = Math.max(0, bossHp - ult);
      out += `\n🔥 **ULTIMATE! ${heroName}** dealt extra **${money(ult)}**. Boss HP: **${money(bossHp)}**`;
      await i.editReply(out.slice(-1850)).catch(() => null);
      await new Promise(r => setTimeout(r, 1400));
    }
    if (bossHp <= 0 || teamHp <= 0) break;
  }
  const clear = bossHp <= 0;
  const damage = (coop ? 2200000 : 1100000) - bossHp;
  const rw = { gold: Math.floor(damage * .45), tokens: Math.max(8, Math.floor(damage / 45000)), rolls: clear ? 10 : 4, xp: clear ? 220 : 100 };
  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { increment: rw.gold }, tokens: { increment: rw.tokens }, rolls: { increment: rw.rolls } } }).catch(() => null);
  if (typeof addUserXp === 'function') await addUserXp(i.user.id, rw.xp, 'boss-rush').catch(() => null);
  out += `\n\n**${clear ? 'Boss Cleared!' : 'Boss Escaped!'}**\nRewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**`;
  return i.editReply(out.slice(-1900)).catch(() => null);
}
async function fuFinalHandler(i, userId, commandName) {
  if (commandName === 'inventory') {
    const page = i.options?.getInteger?.('page') || 0;
    const data = await fuInventoryPage(userId, page);
    if (data.empty) return i.reply('You do not have any cards yet.');
    return i.reply({ embeds: [data.embed], components: [data.row] });
  }
  if (commandName === 'train') return fuTrain(i);
  if (commandName === 'ascend') return fuAscend(i);
  if (commandName === 'story') return fuBattle(i, 'story', 1);
  if (commandName === 'tower') return fuBattle(i, 'tower', 1);
  if (commandName === 'dungeon') return fuBattle(i, 'dungeon', 1);
  if (commandName === 'auto-story') return fuBattle(i, 'story', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-tower') return fuBattle(i, 'tower', i.options.getInteger('runs') || 10);
  if (commandName === 'auto-dungeon') return fuBattle(i, 'dungeon', i.options.getInteger('runs') || 10);
  if (commandName === 'boss-rush') return fuBoss(i, false);
  if (commandName === 'coop-boss-rush') return fuBoss(i, true);
  return false;
}
// ===== END FINAL USER FIX =====


// ===== MAL ONE VERSION DEDUPE PATCH =====
// Keeps one best version per character from MAL-style imports.
// Variants like (Base), (True Power), (Awakened), etc. are treated as the same character.

function malCleanName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function malKey(character) {
  return `${malCleanName(character?.name || '').toLowerCase()}::${String(character?.anime || '').toLowerCase().trim()}`;
}

function malRank(character) {
  const rarityScore = { SECRET: 7, DIVINE: 6, MYTHIC: 5, LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 }[character?.rarity] || 0;
  const power = Number(character?.basePower || character?.power || 0);
  const name = String(character?.name || '');
  // Prefer the clean MAL/original name without parentheses.
  const cleanBonus = name.includes('(') ? 0 : 50000;
  return cleanBonus + (rarityScore * 1000000) + power;
}

function malUniqueCharacters(chars) {
  const map = new Map();
  for (const c of chars) {
    const key = malKey(c.character || c);
    const old = map.get(key);
    const currentChar = c.character || c;
    const oldChar = old ? (old.character || old) : null;
    if (!old || malRank(currentChar) > malRank(oldChar)) map.set(key, c);
  }
  return [...map.values()];
}

async function malDedupeDatabase() {
  const chars = await prisma.character.findMany({
    where: { active: true },
    orderBy: [{ rarity: 'desc' }, { basePower: 'desc' }]
  });

  const groups = new Map();
  for (const c of chars) {
    const key = malKey(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  let disabled = 0;
  let groupsFixed = 0;

  for (const [, list] of groups) {
    if (list.length <= 1) continue;
    const sorted = list.sort((a, b) => malRank(b) - malRank(a));
    const keep = sorted[0];
    const remove = sorted.slice(1);
    groupsFixed++;

    // Move owned cards from removed variants to the kept character, then disable removed variants.
    for (const dead of remove) {
      await prisma.userCard.updateMany({
        where: { characterId: dead.id },
        data: { characterId: keep.id }
      }).catch(() => null);

      await prisma.marketListing.updateMany({
        where: { characterId: dead.id },
        data: { characterId: keep.id }
      }).catch(() => null);

      await prisma.character.update({
        where: { id: dead.id },
        data: { active: false }
      }).catch(() => null);

      disabled++;
    }
  }

  return { groupsFixed, disabled };
}

async function malOneVersionHandler(i, userId, commandName) {
  if (commandName === 'admin-dedupe-characters') {
    const confirm = i.options.getString('confirm', true);
    if (confirm !== 'YES') return i.reply('Type YES to confirm.');
    await i.deferReply();
    const result = await malDedupeDatabase();
    return i.editReply(
      `✅ MAL one-version cleanup done.\n` +
      `Groups fixed: **${result.groupsFixed}**\n` +
      `Duplicate variants disabled: **${result.disabled}**\n\n` +
      `From now on, only the best/clean version stays active.`
    );
  }
  return false;
}
// ===== END MAL ONE VERSION DEDUPE PATCH =====

// Override display cleanup globally for final handlers.
if (typeof foBaseName === 'function') {
  foBaseName = malCleanName;
}
if (typeof fuBaseName === 'function') {
  fuBaseName = malCleanName;
}



// ===== HARD OVERRIDE FIX: SECRETS DEDUPE + NO ID UPGRADE + DETAILED LIVE MODES =====
// This handler must run before old handlers.

function hxNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[().\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function hxCleanName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function hxKey(c) {
  return `${hxNorm(hxCleanName(c?.name || ''))}::${hxNorm(c?.anime || '')}`;
}
function hxRank(c) {
  const rarity = { SECRET: 7, DIVINE: 6, MYTHIC: 5, LEGENDARY: 4, EPIC: 3, RARE: 2, COMMON: 1 }[c?.rarity] || 0;
  const cleanBonus = String(c?.name || '').includes('(') ? 0 : 50000000;
  return cleanBonus + rarity * 1000000 + Number(c?.basePower || c?.power || 0);
}
function hxUniqueCharacters(list) {
  const map = new Map();
  for (const row of list) {
    const c = row.character || row;
    const key = hxKey(c);
    const old = map.get(key);
    const oldC = old ? (old.character || old) : null;
    if (!old || hxRank(c) > hxRank(oldC)) map.set(key, row);
  }
  return [...map.values()];
}
function hxHash(v = '') {
  let h = 0;
  for (const ch of String(v)) h = ((h << 5) - h) + ch.charCodeAt(0);
  return Math.abs(h);
}
function hxRange(rarity) {
  return { COMMON:[80,180], RARE:[190,360], EPIC:[380,700], LEGENDARY:[720,1150], MYTHIC:[1200,1750], DIVINE:[1800,2400], SECRET:[2450,3300] }[rarity] || [100,250];
}
function hxBasePower(c) {
  const [min, max] = hxRange(c?.rarity || 'COMMON');
  return min + (hxHash(`${hxCleanName(c?.name)}:${c?.anime}:${c?.rarity}`) % Math.max(1, max - min));
}
function hxCardPower(card) {
  const c = card.character || card;
  const level = Math.max(1, Math.min(99, Number(card?.level || 1)));
  return Math.floor(hxBasePower(c) * (1 + ((level - 1) * .035)));
}
function hxRole(c) {
  const n = hxNorm(c?.name || '');
  if (/(lelouch|aizen|makima|kurapika|shikamaru|light yagami|senku)/.test(n)) return 'Control';
  if (/(c c|cc|rimuru|megumi|kakashi|sakura|orihime|shoko|chopper|tsunade)/.test(n)) return 'Support';
  if (/(saber|artoria|ainz|whitebeard|kaido|all might|escanor|albedo|naofumi)/.test(n)) return 'Tank';
  if (/(gabimaru|killua|toji|levi|hisoka|zenitsu|yoroichi|akame|kirito)/.test(n)) return 'Assassin';
  if (/(gojo|madara|gilgamesh|sukuna|yhwach|dio|meruem|frieren|sinbad)/.test(n)) return 'Mage';
  return 'DPS';
}
function hxElement(c) {
  const t = `${hxNorm(c?.name)} ${hxNorm(c?.anime)}`;
  const current = String(c?.element || '').trim();
  if (current && !['Neutral','Anime','undefined','null'].includes(current)) return current;
  if (/(sukuna|makima|toji|ainz|dio|devil|demon|curse|muzan)/.test(t)) return 'Dark';
  if (/(sung jin|jinwoo|jin woo|shadow|igris|beru)/.test(t)) return 'Shadow';
  if (/(gojo|rimuru|gilgamesh|aizen|void|space|time)/.test(t)) return 'Void';
  if (/(goku|naruto|luffy|saitama|saber|artoria|all might)/.test(t)) return 'Light';
  if (/(ace|rengoku|natsu|flame|fire|gabimaru)/.test(t)) return 'Fire';
  if (/(killua|zenitsu|thunder|lightning)/.test(t)) return 'Lightning';
  if (/(ichigo|rukia|bleach|soul|spirit)/.test(t)) return 'Soul';
  return 'Light';
}
function hxPassive(c) {
  const n = hxNorm(c?.name || '');
  const p = [
    [/rimuru/, 'Predator / Great Sage: copies enemy buffs and boosts team sustain.'],
    [/gojo/, 'Limitless Infinity: reduces incoming damage and charges Hollow Purple when attacked.'],
    [/vegeta/, 'Saiyan Pride: gains ATK after taking damage.'],
    [/goku|gokuu/, 'Limit Breaker: ultimate damage scales with battle rounds.'],
    [/lelouch/, 'Geass Command: controls the battlefield and boosts team ultimate charge.'],
    [/nanami/, 'Ratio Technique: critical chance and critical damage massively increase above 70% enemy HP.'],
    [/sukuna/, 'Malevolent Shrine: executes weakened enemies and boosts Dark damage.'],
    [/aizen/, 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.'],
    [/madara/, 'Uchiha Dominion: increases AoE ultimate damage.']
  ];
  for (const [rx, text] of p) if (rx.test(n)) return text;
  return `${hxElement(c)} ${hxRole(c)} Passive: improves ${hxRole(c)} performance in long battles.`;
}
function hxStatsBlock(card) {
  const c = card.character || card;
  const p = hxCardPower(card);
  const level = Math.max(1, Math.min(99, Number(card?.level || 1)));
  const role = hxRole(c);
  let atkS=1.05,hpS=7.2,defS=.55,spd=105,crit=15,critDmg=170,pen=0;
  if (role==='Tank') { atkS=.72; hpS=13; defS=1.2; spd=90; crit=8; }
  if (role==='Support') { atkS=.8; hpS=8.8; defS=.82; spd=110; crit=10; }
  if (role==='Control') { atkS=.9; hpS=8.4; defS=.76; spd=118; crit=12; }
  if (role==='Assassin') { atkS=1.28; hpS=5.8; defS=.42; spd=140; crit=28; critDmg=205; pen=12; }
  if (role==='Mage') { atkS=1.34; hpS=6.1; defS=.48; spd=108; crit=17; critDmg=185; pen=22; }
  if (/nanami/i.test(c?.name || '')) { crit=40; critDmg=235; pen=Math.max(pen,12); }
  return `Class: **${role}** | Element: **${hxElement(c)}**
Level **${level}/99** • ATK **${money(Math.floor(p*atkS))}** • HP **${money(Math.floor(p*hpS))}** • DEF **${money(Math.floor(p*defS))}** • SPD **${Math.floor(spd+level*.2)}
CRIT **${crit}%** • CRIT DMG **${critDmg}%** • PEN **${pen}%**
Character Passive: ${hxPassive(c)}`;
}
async function hxOwned(userId, take = 1000) {
  const cards = await prisma.userCard.findMany({ where:{userId}, include:{character:true}, orderBy:{power:'desc'}, take });
  return hxUniqueCharacters(cards);
}
async function hxFindOwned(userId, q, limit=10) {
  const tokens = hxNorm(q).split(/\s+/).filter(Boolean);
  const cards = await hxOwned(userId);
  return cards.map(card => {
    const c = card.character;
    const full = `${hxNorm(hxCleanName(c.name))} ${hxNorm(c.name)} ${hxNorm(c.anime)}`;
    let score=0;
    for (const t of tokens) {
      if (full.includes(t)) score += 60;
      if (hxNorm(c.name).includes(t)) score += 80;
      if (hxNorm(c.anime).includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t=>full.includes(t))) score += 160;
    return {card,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||hxCardPower(b.card)-hxCardPower(a.card)).slice(0,limit).map(x=>x.card);
}
async function hxDedupeDB() {
  const chars = await prisma.character.findMany({ where:{active:true}, orderBy:{basePower:'desc'} });
  const groups = new Map();
  for (const c of chars) {
    const key = hxKey(c);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  let disabled = 0, groupsFixed = 0;
  for (const [, list] of groups) {
    if (list.length <= 1) continue;
    const sorted = list.sort((a,b)=>hxRank(b)-hxRank(a));
    const keep = sorted[0];
    groupsFixed++;
    for (const dead of sorted.slice(1)) {
      await prisma.userCard.updateMany({ where:{characterId:dead.id}, data:{characterId:keep.id} }).catch(()=>null);
      await prisma.character.update({ where:{id:dead.id}, data:{active:false} }).catch(()=>null);
      disabled++;
    }
  }
  return {groupsFixed, disabled};
}
async function hxInventoryPage(userId, page=0) {
  const cards = await hxOwned(userId);
  if (!cards.length) return {empty:true};
  const safe = Math.max(0, Math.min(page, cards.length-1));
  const card = cards[safe], c = card.character;
  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.rarity)} ${hxCleanName(c.name)}`)
    .setDescription(`Anime: **${c.anime}**\nRarity: **${c.rarity}**\nPower: **${money(hxCardPower(card))}**\n${hxStatsBlock(card)}\n\nUnique Card **${safe+1}/${cards.length}**`)
    .setColor(embedColor(getAura(c).color))
    .setFooter({text:'Use buttons to move right/left • No ID needed'});
  if (c.imageUrl) embed.setImage(c.imageUrl);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`hxi_prev_${safe}`).setLabel('⬅️ Left').setStyle(ButtonStyle.Secondary).setDisabled(safe <= 0),
    new ButtonBuilder().setCustomId(`hxi_next_${safe}`).setLabel('Right ➡️').setStyle(ButtonStyle.Secondary).setDisabled(safe >= cards.length-1)
  );
  return {empty:false, embed, row};
}
async function hxEnemyPool() {
  const chars = await prisma.character.findMany({ where:{active:true}, orderBy:{basePower:'desc'}, take:250 }).catch(()=>[]);
  return hxUniqueCharacters(chars);
}
async function hxPickEnemies(count=6, offset=0) {
  const pool = await hxEnemyPool();
  if (!pool.length) return [{name:'Sukuna', anime:'Jujutsu Kaisen', rarity:'SECRET', basePower:3000}];
  const arr = [];
  for (let i=0;i<count;i++) arr.push(pool[(offset+i*13)%pool.length]);
  return arr;
}
function hxNeeded(mode,p) {
  const v = mode==='story' ? p.chapter : mode==='tower' ? p.towerFloor : p.dungeonFloor;
  if (v>=60) return 6; if (v>=48) return 5; if (v>=36) return 4; if (v>=24) return 3; if (v>=12) return 2; return 1;
}
async function hxFormation(userId, f) {
  const start = ((f-1)*6)+1;
  const slots = await prisma.teamSlot.findMany({ where:{userId, slot:{gte:start,lte:start+5}}, include:{card:{include:{character:true}}}, orderBy:{slot:'asc'} }).catch(()=>[]);
  return slots.map(s=>s.card).filter(Boolean);
}
async function hxTeams(userId,count) {
  const fallback = await hxOwned(userId);
  const teams=[];
  for (let f=1; f<=count; f++) {
    let team = await hxFormation(userId,f);
    if (!team.length) team = fallback.slice((f-1)*6, f*6);
    teams.push(team.slice(0,6));
  }
  return teams;
}
async function hxPower(userId,count) {
  const teams = await hxTeams(userId,count);
  return {teams, total: teams.flat().reduce((s,c)=>s+hxCardPower(c),0)};
}
function hxReq(mode,p,f) {
  const storyIndex = ((p.chapter-1)*30)+p.stage;
  const base = mode==='story' ? 650+storyIndex*300 : mode==='tower' ? 1100+p.towerFloor*520 : 900+p.dungeonFloor*430;
  return Math.floor(base*(1+(f-1)*.95+(mode==='story'?Math.max(0,p.chapter-40)*.035:0)));
}
function hxRewards(mode,req,p) {
  const no = mode==='story' ? (((p.chapter-1)*30)+p.stage) : mode==='tower' ? p.towerFloor : p.dungeonFloor;
  return {gold:Math.floor(req*.8), tokens:Math.max(2,Math.floor(no/4)+2), rolls:mode==='story'?3:2, xp:mode==='story'?75:mode==='tower'?85:65};
}
async function hxAdvance(userId, mode, p) {
  if (mode==='story') {
    let stage=p.stage+1, chapter=p.chapter;
    if(stage>30){stage=1;chapter++;}
    if(chapter>80){chapter=80;stage=30;}
    return prisma.storyProgress.update({where:{userId},data:{chapter,stage}}).catch(()=>null);
  }
  if (mode==='tower') return prisma.storyProgress.update({where:{userId},data:{towerFloor:p.towerFloor+1}}).catch(()=>null);
  return prisma.storyProgress.update({where:{userId},data:{dungeonFloor:p.dungeonFloor+1}}).catch(()=>null);
}
const hxLocks = new Set();
async function hxBattle(i,mode,runs=1) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(()=>null);
  const key=`${i.user.id}:${mode}`;
  if(hxLocks.has(key)) return i.editReply(`⏳ You already have **${mode}** running.`);
  hxLocks.add(key);
  try {
    const max=Math.max(1,Math.min(30,runs));
    let wins=0,total={gold:0,tokens:0,rolls:0,xp:0};
    let out=`**${max>1?'AUTO ':''}${mode.toUpperCase()} LIVE BATTLE**\n`;
    await i.editReply(out).catch(()=>null);
    await new Promise(r=>setTimeout(r,1200));
    for(let run=1;run<=max;run++){
      const p=await getOrCreateProgress(i.user.id);
      const f=hxNeeded(mode,p), my=await hxPower(i.user.id,f), req=hxReq(mode,p,f), enemies=await hxPickEnemies(f*6,run+(p.chapter||p.towerFloor||p.dungeonFloor||1));
      let enemyHp=Math.max(1200,req*6), teamHp=Math.max(1200,my.total*6);
      const title=mode==='story'?`Chapter ${p.chapter}/80 • Stage ${p.stage}/30`:mode==='tower'?`Tower Floor ${p.towerFloor}`:`Dungeon Floor ${p.dungeonFloor}`;
      out+=`\n**${title}**\nRequired formations: **${f}** × 6 characters\nTeam HP: **${money(teamHp)}** | Enemy HP: **${money(enemyHp)}**\n`;
      await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1200));
      for(let round=1;round<=5;round++){
        const team=my.teams[(round-1)%Math.max(1,my.teams.length)]||[];
        const hero=team[(round-1)%Math.max(1,team.length)];
        const enemy=enemies[(round-1)%enemies.length];
        const heroName=hero?hxCleanName(hero.character.name):'Your Formation';
        const enemyName=enemy?hxCleanName(enemy.name):'Enemy';
        const hit=Math.floor(my.total/(4+round)+Math.random()*700);
        const enemyHit=Math.floor(req/(5+round)+Math.random()*400);
        enemyHp=Math.max(0,enemyHp-hit);
        out+=`• Round ${round}: **${heroName}** attacked **${enemyName}** for **${money(hit)}**. Enemy HP left: **${money(enemyHp)}**\n`;
        await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1300));
        teamHp=Math.max(0,teamHp-enemyHit);
        out+=`  **${enemyName}** countered for **${money(enemyHit)}**. Your team HP left: **${money(teamHp)}**\n`;
        await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1300));
        if(round===3 || enemyHp<=req*2){
          const finisher=team[(round+1)%Math.max(1,team.length)] || hero;
          const ult=Math.floor(hit*1.9);
          enemyHp=Math.max(0,enemyHp-ult);
          out+=`  🔥 **ULTIMATE! ${hxCleanName((finisher?.character||finisher||{}).name || heroName)}** used a finisher on **${enemyName}** for **${money(ult)}**. Enemy HP: **${money(enemyHp)}**\n`;
          await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1500));
        }
        if(enemyHp<=0 || teamHp<=0) break;
      }
      const won=enemyHp<=0 || (teamHp>0 && my.total>=req);
      if(!won){out+=`❌ **Defeat.** Enemy survived with **${money(enemyHp)} HP**.\n`; await i.editReply(out.slice(-1850)).catch(()=>null); break;}
      const latest=await getOrCreateProgress(i.user.id);
      const same=mode==='story'?latest.chapter===p.chapter&&latest.stage===p.stage:mode==='tower'?latest.towerFloor===p.towerFloor:latest.dungeonFloor===p.dungeonFloor;
      if(!same){out+=`⛔ Duplicate reward blocked.\n`; await i.editReply(out.slice(-1850)).catch(()=>null); break;}
      const rw=hxRewards(mode,req,p);
      await hxAdvance(i.user.id,mode,p);
      await prisma.user.update({where:{id:i.user.id},data:{gold:{increment:rw.gold},tokens:{increment:rw.tokens},rolls:{increment:rw.rolls}}}).catch(()=>null);
      if(typeof addUserXp==='function') await addUserXp(i.user.id,rw.xp,mode).catch(()=>null);
      wins++; total.gold+=rw.gold; total.tokens+=rw.tokens; total.rolls+=rw.rolls; total.xp+=rw.xp;
      out+=`✅ **Victory!** Rewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**\n`;
      await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1200));
    }
    out+=`\n**TOTAL**\nWins: **${wins}/${max}**\nRewards: **${money(total.gold)} Gold**, **${total.tokens} Tokens**, **${total.rolls} Rolls**, **${total.xp} XP**`;
    return i.editReply(out.slice(-1900)).catch(()=>null);
  } finally {hxLocks.delete(key);}
}
async function hxTrain(i) {
  if(!i.deferred&&!i.replied) await i.deferReply().catch(()=>null);
  const card=(await hxFindOwned(i.user.id,i.options.getString('name',true),1))[0];
  if(!card)return i.editReply(`No owned character found.`);
  const user=await prisma.user.findUnique({where:{id:i.user.id}});
  const level=Math.max(1,Number(card.level||1));
  const cost=500+level*250;
  if((user?.gold||0)<cost)return i.editReply(`You need **${money(cost)} Gold** to train **${hxCleanName(card.character.name)}**.`);
  await prisma.user.update({where:{id:i.user.id},data:{gold:{decrement:cost}}}).catch(()=>null);
  await prisma.userCard.update({where:{id:card.id},data:{level:level+1,power:{increment:25}}}).catch(()=>null);
  return i.editReply(`✅ **${hxCleanName(card.character.name)}** trained!\nLevel **${level} → ${level+1}**\nNo card ID needed.`);
}
async function hxAscend(i) {
  if(!i.deferred&&!i.replied) await i.deferReply().catch(()=>null);
  const card=(await hxFindOwned(i.user.id,i.options.getString('name',true),1))[0];
  if(!card)return i.editReply(`No owned character found.`);
  const dupes=await prisma.userCard.findMany({where:{userId:i.user.id,characterId:card.characterId},include:{character:true},orderBy:{power:'asc'},take:10});
  const consume=dupes.find(c=>c.id!==card.id);
  if(!consume)return i.editReply(`You need a duplicate of **${hxCleanName(card.character.name)}** to ascend.`);
  await prisma.userCard.delete({where:{id:consume.id}}).catch(()=>null);
  await prisma.userCard.update({where:{id:card.id},data:{power:{increment:150}}}).catch(()=>null);
  return i.editReply(`✨ **${hxCleanName(card.character.name)} ascended!**\nConsumed duplicate automatically.\nNo card ID needed.`);
}
async function hxBoss(i,coop=false) {
  if(!i.deferred&&!i.replied) await i.deferReply().catch(()=>null);
  const formations=coop?2:1, my=await hxPower(i.user.id,formations), enemies=await hxPickEnemies(coop?8:5,coop?50:20), boss=enemies[0];
  let bossHp=coop?2200000:1100000, teamHp=Math.max(2000,my.total*7);
  let out=`**${coop?'CO-OP ':'SOLO '}BOSS RUSH LIVE**\nBoss: **${hxCleanName(boss.name)}** • ${boss.anime||'Anime'}\nBoss HP: **${money(bossHp)}** | Team HP: **${money(teamHp)}**\n`;
  await i.editReply(out).catch(()=>null); await new Promise(r=>setTimeout(r,1200));
  for(let round=1;round<=8;round++){
    const team=my.teams[(round-1)%Math.max(1,my.teams.length)]||[], hero=team[(round-1)%Math.max(1,team.length)];
    const heroName=hero?hxCleanName(hero.character.name):'Your Team';
    const hit=Math.floor(my.total/(3+round)+Math.random()*9000), bossHit=Math.floor((coop?90000:45000)+Math.random()*5000);
    bossHp=Math.max(0,bossHp-hit); teamHp=Math.max(0,teamHp-bossHit);
    out+=`\nRound ${round}: **${heroName}** hit **${hxCleanName(boss.name)}** for **${money(hit)}**. Boss HP: **${money(bossHp)}**`;
    await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1200));
    out+=`\nBoss countered for **${money(bossHit)}**. Team HP: **${money(teamHp)}**`;
    await i.editReply(out.slice(-1850)).catch(()=>null); await new Promise(r=>setTimeout(r,1200));
    if(round===3||round===6){const ult=Math.floor(hit*2.2);bossHp=Math.max(0,bossHp-ult);out+=`\n🔥 **ULTIMATE! ${heroName}** dealt extra **${money(ult)}**. Boss HP: **${money(bossHp)}**`;await i.editReply(out.slice(-1850)).catch(()=>null);await new Promise(r=>setTimeout(r,1400));}
    if(bossHp<=0||teamHp<=0)break;
  }
  const clear=bossHp<=0, damage=(coop?2200000:1100000)-bossHp, rw={gold:Math.floor(damage*.45),tokens:Math.max(8,Math.floor(damage/45000)),rolls:clear?10:4,xp:clear?220:100};
  await prisma.user.update({where:{id:i.user.id},data:{gold:{increment:rw.gold},tokens:{increment:rw.tokens},rolls:{increment:rw.rolls}}}).catch(()=>null);
  if(typeof addUserXp==='function') await addUserXp(i.user.id,rw.xp,'boss-rush').catch(()=>null);
  out+=`\n\n**${clear?'Boss Cleared!':'Boss Escaped!'}**\nRewards: **${money(rw.gold)} Gold**, **${rw.tokens} Tokens**, **${rw.rolls} Rolls**, **${rw.xp} XP**`;
  return i.editReply(out.slice(-1900)).catch(()=>null);
}
async function hxHardHandler(i,userId,commandName){
  if(commandName==='admin-dedupe-characters'){
    const confirm=i.options.getString('confirm',true);
    if(confirm!=='YES') return i.reply('Type YES to confirm.');
    await i.deferReply();
    const r=await hxDedupeDB();
    return i.editReply(`✅ MAL cleanup done.\nGroups fixed: **${r.groupsFixed}**\nDuplicate variants disabled: **${r.disabled}**`);
  }
  if(commandName==='secrets'){
    const chars=hxUniqueCharacters(await prisma.character.findMany({where:{active:true,rarity:'SECRET'},orderBy:{basePower:'desc'},take:250}));
    return i.reply((`**SECRET CHARACTERS**\n\n${chars.slice(0,25).map(c=>`**${hxCleanName(c.name)}** • ${c.anime} • PWR ${money(hxBasePower(c))}`).join('\n')}`).slice(0,1900));
  }
  if(commandName==='inventory'){
    const data=await hxInventoryPage(userId,i.options.getInteger('page')||0);
    if(data.empty)return i.reply('You do not have any cards yet.');
    return i.reply({embeds:[data.embed],components:[data.row]});
  }
  if(commandName==='stats'||commandName==='inv-search'){
    const card=(await hxFindOwned(userId,i.options.getString('name',true),10))[0];
    if(!card)return i.reply(`No owned character found.`);
    const c=card.character;
    const embed=new EmbedBuilder().setTitle(`${commandName==='stats'?'Stats':'Inventory Search'}: ${hxCleanName(c.name)}`).setDescription(`${rarityEmoji(c.rarity)} **${hxCleanName(c.name)}** • ${c.anime} • PWR **${money(hxCardPower(card))}**\n${hxStatsBlock(card)}`).setColor(embedColor(getAura(c).color));
    if(c.imageUrl)embed.setThumbnail(c.imageUrl);
    return i.reply({embeds:[embed]});
  }
  if(commandName==='train') return hxTrain(i);
  if(commandName==='ascend') return hxAscend(i);
  if(commandName==='story') return hxBattle(i,'story',1);
  if(commandName==='tower') return hxBattle(i,'tower',1);
  if(commandName==='dungeon') return hxBattle(i,'dungeon',1);
  if(commandName==='auto-story') return hxBattle(i,'story',i.options.getInteger('runs')||10);
  if(commandName==='auto-tower') return hxBattle(i,'tower',i.options.getInteger('runs')||10);
  if(commandName==='auto-dungeon') return hxBattle(i,'dungeon',i.options.getInteger('runs')||10);
  if(commandName==='boss-rush') return hxBoss(i,false);
  if(commandName==='coop-boss-rush') return hxBoss(i,true);
  return false;
}
// ===== END HARD OVERRIDE FIX =====


// ===== QUICK SELL BY RARITY PATCH =====
function qsRarityValue(rarity) {
  return {
    COMMON: 250,
    RARE: 900,
    EPIC: 2500,
    LEGENDARY: 8000,
    MYTHIC: 18000,
    DIVINE: 40000,
    SECRET: 90000
  }[String(rarity || '').toUpperCase()] || 100;
}

async function qsQuickSellByRarity(i) {
  const rarity = String(i.options.getString('rarity', true) || '').toUpperCase();
  const confirm = String(i.options.getString('confirm', false) || '').toUpperCase();

  if (confirm !== 'YES') {
    return i.reply(
      `⚠️ Quick Sell **${rarity}** will sell all unequipped owned characters with this rarity.\n` +
      `Equipped formation characters are protected.\n\n` +
      `Run again with **confirm:YES** to sell.`
    );
  }

  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const equipped = await prisma.teamSlot.findMany({
    where: { userId: i.user.id },
    select: { cardId: true }
  }).catch(() => []);

  const protectedIds = new Set(equipped.map(x => x.cardId).filter(Boolean));

  const cards = await prisma.userCard.findMany({
    where: {
      userId: i.user.id,
      character: { rarity }
    },
    include: { character: true },
    take: 1000
  }).catch(() => []);

  const sellable = cards.filter(c => !protectedIds.has(c.id));
  const protectedCount = cards.length - sellable.length;

  if (!sellable.length) {
    return i.editReply(
      `No unequipped **${rarity}** characters to sell.` +
      (protectedCount ? `\nProtected equipped cards: **${protectedCount}**` : '')
    );
  }

  const gold = sellable.reduce((sum, c) => sum + qsRarityValue(c.character.rarity), 0);
  const ids = sellable.map(c => c.id);

  await prisma.marketListing.updateMany({
    where: { cardId: { in: ids }, status: 'ACTIVE' },
    data: { status: 'CANCELLED' }
  }).catch(() => null);

  await prisma.userCard.deleteMany({
    where: { id: { in: ids } }
  }).catch(async () => {
    for (const id of ids) {
      await prisma.userCard.delete({ where: { id } }).catch(() => null);
    }
  });

  await prisma.user.update({
    where: { id: i.user.id },
    data: { gold: { increment: gold } }
  }).catch(() => null);

  const sample = sellable.slice(0, 10).map(c => `• ${c.character.name} • ${c.character.anime}`).join('\n');

  return i.editReply(
    `✅ **Quick Sell Complete**\n` +
    `Rarity: **${rarity}**\n` +
    `Sold: **${sellable.length}** character(s)\n` +
    `Gold gained: **${money(gold)}**\n` +
    (protectedCount ? `Protected equipped: **${protectedCount}**\n` : '') +
    (sample ? `\nSold examples:\n${sample}` : '')
  );
}

async function qsQuickSellHandler(i, userId, commandName) {
  if (commandName === 'quick-sell') return qsQuickSellByRarity(i);
  return false;
}
// ===== END QUICK SELL BY RARITY PATCH =====


// ===== STARS ASCEND + RARITY EVOLUTION PATCH =====
// Ascend by name, no ID. Duplicates + Gold + Tokens raise stars.
// At specific stars, rarity can evolve up to SECRET.

function saTraitStars(trait = '') {
  const m = String(trait || '').match(/Stars:(\d+)/i);
  return m ? Math.max(0, Math.min(6, Number(m[1] || 0))) : 0;
}

function saSetStarsTrait(trait = '', stars = 0) {
  const clean = String(trait || '').replace(/\s*\|?\s*Stars:\d+/ig, '').trim();
  return `${clean}${clean ? ' | ' : ''}Stars:${Math.max(0, Math.min(6, stars))}`;
}

function saNextRarity(current, stars) {
  const rarity = String(current || '').toUpperCase();

  if (rarity === 'COMMON' && stars >= 5) return 'RARE';
  if (rarity === 'RARE' && stars >= 5) return 'EPIC';
  if (rarity === 'EPIC' && stars >= 5) return 'LEGENDARY';
  if (rarity === 'LEGENDARY' && stars >= 5) return 'MYTHIC';
  if (rarity === 'MYTHIC' && stars >= 4) return 'DIVINE';
  if (rarity === 'DIVINE' && stars >= 5) return 'SECRET';
  if (rarity === 'SECRET') return 'SECRET';

  return rarity;
}

function saAscendCost(rarity, nextStars) {
  const base = {
    COMMON: { gold: 1500, tokens: 1 },
    RARE: { gold: 4000, tokens: 2 },
    EPIC: { gold: 9000, tokens: 4 },
    LEGENDARY: { gold: 20000, tokens: 8 },
    MYTHIC: { gold: 50000, tokens: 18 },
    DIVINE: { gold: 95000, tokens: 35 },
    SECRET: { gold: 150000, tokens: 55 }
  }[String(rarity || '').toUpperCase()] || { gold: 2000, tokens: 1 };

  return {
    gold: base.gold * Math.max(1, nextStars),
    tokens: base.tokens * Math.max(1, nextStars)
  };
}

function saStarLine(stars) {
  return '★'.repeat(stars) + '☆'.repeat(6 - stars);
}

async function saFindOwnedByName(userId, q, limit = 20) {
  if (typeof hxFindOwned === 'function') return hxFindOwned(userId, q, limit);
  if (typeof fuFindOwned === 'function') return fuFindOwned(userId, q, limit);
  if (typeof foFindOwned === 'function') return foFindOwned(userId, q, limit);

  const tokens = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 500
  });

  return cards.filter(card => {
    const full = `${card.character.name} ${card.character.anime}`.toLowerCase();
    return tokens.every(t => full.includes(t));
  }).slice(0, limit);
}

async function saAscend(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const q = i.options.getString('name', true);
  const cards = await saFindOwnedByName(i.user.id, q, 50);

  if (!cards.length) {
    return i.editReply(`No owned character found for **${q}**.`);
  }

  // Pick the strongest card as the main card.
  const sorted = cards.sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
  const main = sorted[0];

  const sameCharacterDupes = await prisma.userCard.findMany({
    where: {
      userId: i.user.id,
      characterId: main.characterId
    },
    include: { character: true },
    orderBy: { power: 'asc' },
    take: 20
  });

  const consume = sameCharacterDupes.find(c => c.id !== main.id);

  if (!consume) {
    return i.editReply(
      `You need a duplicate of **${main.character.name}** to ascend.\n` +
      `Tip: roll more or use /quick-sell only for rarities you do not need.`
    );
  }

  const currentStars = saTraitStars(main.trait);
  if (currentStars >= 6) {
    return i.editReply(`**${main.character.name}** is already max stars: **${saStarLine(6)}**.`);
  }

  const nextStars = currentStars + 1;
  const currentRarity = String(main.character.rarity || 'COMMON').toUpperCase();
  const nextRarity = saNextRarity(currentRarity, nextStars);
  const cost = saAscendCost(currentRarity, nextStars);

  const user = await prisma.user.findUnique({ where: { id: i.user.id } });
  if ((user?.gold || 0) < cost.gold || (user?.tokens || 0) < cost.tokens) {
    return i.editReply(
      `Not enough resources to ascend **${main.character.name}**.\n` +
      `Need: **${money(cost.gold)} Gold** + **${cost.tokens} Tokens**\n` +
      `You have: **${money(user?.gold || 0)} Gold** + **${user?.tokens || 0} Tokens**`
    );
  }

  await prisma.marketListing.updateMany({
    where: { cardId: consume.id, status: 'ACTIVE' },
    data: { status: 'CANCELLED' }
  }).catch(() => null);

  await prisma.user.update({
    where: { id: i.user.id },
    data: {
      gold: { decrement: cost.gold },
      tokens: { decrement: cost.tokens }
    }
  });

  await prisma.userCard.delete({ where: { id: consume.id } }).catch(() => null);

  const powerGain = 125 + (nextStars * 75);
  await prisma.userCard.update({
    where: { id: main.id },
    data: {
      power: { increment: powerGain },
      trait: saSetStarsTrait(main.trait, nextStars)
    }
  }).catch(() => null);

  let rarityText = '';
  if (nextRarity !== currentRarity) {
    await prisma.character.update({
      where: { id: main.characterId },
      data: { rarity: nextRarity }
    }).catch(() => null);

    rarityText = `\n🔥 Rarity evolved: **${currentRarity} → ${nextRarity}**`;
  }

  return i.editReply(
    `✨ **ASCEND SUCCESS**\n` +
    `Character: **${main.character.name}**\n` +
    `Stars: **${saStarLine(currentStars)} → ${saStarLine(nextStars)}**\n` +
    `Consumed duplicate: **${consume.character.name}**\n` +
    `Power gained: **+${powerGain}**\n` +
    `Cost: **${money(cost.gold)} Gold** + **${cost.tokens} Tokens**` +
    rarityText
  );
}

async function saStarsInfo(i) {
  const q = i.options.getString('name', true);
  const card = (await saFindOwnedByName(i.user.id, q, 1))[0];

  if (!card) return i.reply(`No owned character found for **${q}**.`);

  const stars = saTraitStars(card.trait);
  const rarity = String(card.character.rarity || 'COMMON').toUpperCase();
  const nextStars = Math.min(6, stars + 1);
  const nextRarity = saNextRarity(rarity, nextStars);
  const cost = saAscendCost(rarity, nextStars);

  return i.reply(
    `**${card.character.name}**\n` +
    `Rarity: **${rarity}**\n` +
    `Stars: **${saStarLine(stars)}**\n` +
    `Next ascend cost: **${money(cost.gold)} Gold** + **${cost.tokens} Tokens**\n` +
    (nextRarity !== rarity ? `Next rarity evolution: **${rarity} → ${nextRarity}**` : `Next rarity evolution: **None yet**`)
  );
}

async function saHandler(i, userId, commandName) {
  if (commandName === 'ascend') return saAscend(i);
  if (commandName === 'stars') return saStarsInfo(i);
  return false;
}
// ===== END STARS ASCEND PATCH =====


// ===== QUICK SELL HARD FIX =====
// Runs before old handlers so /quick-sell never goes Not Responding.

function qhRarityValue(rarity) {
  return {
    COMMON: 250,
    RARE: 900,
    EPIC: 2500,
    LEGENDARY: 8000,
    MYTHIC: 18000,
    DIVINE: 40000,
    SECRET: 90000
  }[String(rarity || '').toUpperCase()] || 100;
}

async function qhQuickSell(i) {
  const rarity = String(i.options.getString('rarity', true) || '').toUpperCase();
  const confirm = String(i.options.getString('confirm', false) || '').toUpperCase();

  if (confirm !== 'YES') {
    return i.reply(
      `⚠️ **Quick Sell Preview**\n` +
      `Rarity: **${rarity}**\n` +
      `This will sell all **unequipped** ${rarity} characters.\n` +
      `Formation cards are protected.\n\n` +
      `Run again with **confirm:YES** to sell.`
    );
  }

  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const equipped = await prisma.teamSlot.findMany({
    where: { userId: i.user.id },
    select: { cardId: true }
  }).catch(() => []);

  const protectedIds = new Set(equipped.map(x => x.cardId).filter(Boolean));

  const allCards = await prisma.userCard.findMany({
    where: { userId: i.user.id },
    include: { character: true },
    take: 2000
  }).catch(() => []);

  const matching = allCards.filter(c => String(c.character?.rarity || '').toUpperCase() === rarity);
  const sellable = matching.filter(c => !protectedIds.has(c.id));
  const protectedCount = matching.length - sellable.length;

  if (!sellable.length) {
    return i.editReply(
      `No unequipped **${rarity}** characters to sell.` +
      (protectedCount ? `\nProtected equipped cards: **${protectedCount}**` : '')
    );
  }

  const gold = sellable.reduce((sum, c) => sum + qhRarityValue(c.character.rarity), 0);
  const ids = sellable.map(c => c.id);

  await prisma.marketListing.updateMany({
    where: { cardId: { in: ids }, status: 'ACTIVE' },
    data: { status: 'CANCELLED' }
  }).catch(() => null);

  // Delete in chunks so it does not timeout on large inventories.
  const chunkSize = 100;
  let deleted = 0;
  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);
    await prisma.userCard.deleteMany({ where: { id: { in: chunk } } }).catch(async () => {
      for (const id of chunk) {
        await prisma.userCard.delete({ where: { id } }).catch(() => null);
      }
    });
    deleted += chunk.length;
  }

  await prisma.user.update({
    where: { id: i.user.id },
    data: { gold: { increment: gold } }
  }).catch(() => null);

  const sample = sellable
    .slice(0, 8)
    .map(c => `• ${c.character.name} • ${c.character.anime}`)
    .join('\n');

  return i.editReply(
    `✅ **Quick Sell Complete**\n` +
    `Rarity: **${rarity}**\n` +
    `Sold: **${deleted}** character(s)\n` +
    `Gold gained: **${money(gold)}**\n` +
    (protectedCount ? `Protected equipped: **${protectedCount}**\n` : '') +
    (sample ? `\nSold examples:\n${sample}` : '')
  );
}

async function qhHandler(i, userId, commandName) {
  if (commandName === 'quick-sell') return qhQuickSell(i);
  return false;
}
// ===== END QUICK SELL HARD FIX =====


// ===== ONE FILE FINAL SYSTEMS PATCH =====
// Quick Sell hard handler + passives + team-up buffs + full rarity evolution to SECRET.
// This handler is intentionally inserted before old handlers.

function ofNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[().\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function ofCleanName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ofMoney(n) {
  return typeof money === 'function' ? money(n) : Number(n || 0).toLocaleString('en-US');
}

function ofRarityEmoji(rarity) {
  return typeof rarityEmoji === 'function' ? rarityEmoji(rarity) : '⭐';
}

function ofStarsFromTrait(trait = '') {
  const m = String(trait || '').match(/Stars:(\d+)/i);
  return m ? Math.max(0, Math.min(10, Number(m[1] || 0))) : 0;
}

function ofSetStarsTrait(trait = '', stars = 0) {
  const clean = String(trait || '').replace(/\s*\|?\s*Stars:\d+/ig, '').trim();
  return `${clean}${clean ? ' | ' : ''}Stars:${Math.max(0, Math.min(10, stars))}`;
}

function ofStarsLine(stars) {
  return '★'.repeat(Math.max(0, Math.min(10, stars))) + '☆'.repeat(Math.max(0, 10 - stars));
}

function ofRarityRank(rarity) {
  return { COMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5, DIVINE: 6, SECRET: 7 }[String(rarity || '').toUpperCase()] || 1;
}

function ofRankRarity(rank) {
  return { 1: 'COMMON', 2: 'RARE', 3: 'EPIC', 4: 'LEGENDARY', 5: 'MYTHIC', 6: 'DIVINE', 7: 'SECRET' }[rank] || 'COMMON';
}

function ofNextRarity(current, stars) {
  const rank = ofRarityRank(current);
  if (rank >= 7) return 'SECRET';

  // Every 2 stars can push one rarity up. This lets COMMON eventually reach SECRET.
  const upgradedRank = Math.min(7, rank + Math.floor(stars / 2));
  return ofRankRarity(upgradedRank);
}

function ofAscendCost(currentRarity, nextStars) {
  const base = {
    COMMON: { gold: 700, tokens: 0 },
    RARE: { gold: 1800, tokens: 1 },
    EPIC: { gold: 4500, tokens: 2 },
    LEGENDARY: { gold: 12000, tokens: 5 },
    MYTHIC: { gold: 28000, tokens: 12 },
    DIVINE: { gold: 65000, tokens: 25 },
    SECRET: { gold: 110000, tokens: 45 }
  }[String(currentRarity || '').toUpperCase()] || { gold: 1000, tokens: 0 };

  return {
    gold: base.gold * Math.max(1, nextStars),
    tokens: base.tokens * Math.max(1, Math.ceil(nextStars / 2))
  };
}

function ofBaseKey(character) {
  return `${ofNorm(ofCleanName(character?.name || ''))}::${ofNorm(character?.anime || '')}`;
}

function ofUniqueCards(cards) {
  const map = new Map();
  for (const card of cards) {
    const c = card.character || card;
    const key = ofBaseKey(c);
    const old = map.get(key);
    const currentScore = ofRarityRank(c.rarity) * 1000000 + Number(card.power || c.basePower || 0) + (String(c.name || '').includes('(') ? 0 : 5000000);
    const oldC = old ? (old.character || old) : null;
    const oldScore = old ? ofRarityRank(oldC.rarity) * 1000000 + Number(old.power || oldC.basePower || 0) + (String(oldC.name || '').includes('(') ? 0 : 5000000) : -1;
    if (!old || currentScore > oldScore) map.set(key, card);
  }
  return [...map.values()];
}

function ofElement(c) {
  const t = `${ofNorm(c?.name)} ${ofNorm(c?.anime)}`;
  const current = String(c?.element || '').trim();
  if (current && !['Neutral', 'Anime', 'undefined', 'null'].includes(current)) return current;
  if (/(sukuna|makima|toji|ainz|dio|devil|demon|curse|muzan)/.test(t)) return 'Dark';
  if (/(sung jin|jinwoo|jin woo|shadow|igris|beru|cid)/.test(t)) return 'Shadow';
  if (/(gojo|rimuru|gilgamesh|aizen|void|space|time|accelerator)/.test(t)) return 'Void';
  if (/(goku|gokuu|naruto|luffy|saitama|saber|artoria|all might)/.test(t)) return 'Light';
  if (/(ace|rengoku|natsu|flame|fire|shinra|yamamoto|gabimaru)/.test(t)) return 'Fire';
  if (/(killua|zenitsu|thunder|lightning|misaka)/.test(t)) return 'Lightning';
  if (/(ichigo|rukia|bleach|soul|spirit|shinigami)/.test(t)) return 'Soul';
  if (/(ice|frost|snow|todoroki)/.test(t)) return 'Ice';
  return 'Light';
}

function ofRole(c) {
  const n = ofNorm(c?.name || '');
  if (/(lelouch|aizen|makima|kurapika|shikamaru|light yagami|senku)/.test(n)) return 'Control';
  if (/(c c|cc|rimuru|megumi|kakashi|sakura|orihime|shoko|chopper|tsunade)/.test(n)) return 'Support';
  if (/(saber|artoria|ainz|whitebeard|kaido|all might|escanor|albedo|naofumi)/.test(n)) return 'Tank';
  if (/(gabimaru|killua|toji|levi|hisoka|zenitsu|yoroichi|akame|kirito)/.test(n)) return 'Assassin';
  if (/(gojo|madara|gilgamesh|sukuna|yhwach|dio|meruem|frieren|sinbad)/.test(n)) return 'Mage';
  return 'DPS';
}

function ofPassive(c) {
  const n = ofNorm(c?.name || '');
  const passives = [
    [/rimuru/, 'Predator / Great Sage: copies enemy buffs, improves sustain, and boosts team energy recovery.'],
    [/gojo/, 'Limitless Infinity: reduces incoming damage and charges Hollow Purple when attacked.'],
    [/geto/, 'Cursed Spirit Manipulation: summons weaken enemy DEF and increase curse damage.'],
    [/sukuna/, 'Malevolent Shrine: executes weakened enemies and boosts Dark ultimate damage.'],
    [/goku|gokuu/, 'Limit Breaker: ATK and ultimate damage scale every round.'],
    [/vegeta/, 'Saiyan Pride: gains ATK after taking damage and powers up after allies fall.'],
    [/lelouch/, 'Geass Command: controls the battlefield and boosts team ultimate charge.'],
    [/c c|^cc$/, 'Immortal Witch: regenerates each round and gives energy to the strongest ally.'],
    [/nanami/, 'Ratio Technique: critical chance and critical damage massively increase above 70% enemy HP.'],
    [/gabimaru/, 'Ninja of the Hollow: gains dodge, poison resistance, and burst damage after ultimate.'],
    [/makima/, 'Control Devil: reduces enemy ATK and increases control chance.'],
    [/aizen/, 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.'],
    [/madara/, 'Uchiha Dominion: increases AoE ultimate damage and pressure.'],
    [/itachi/, 'Tsukuyomi: delays enemy ultimate and increases control chance.'],
    [/killua/, 'Godspeed: very high speed, dodge, and crit burst.'],
    [/gon/, 'Jajanken: huge single-target ultimate damage.'],
    [/luffy/, 'Nika Rhythm: gains ATK and speed every round.'],
    [/zoro/, 'Three Sword Style: increases boss damage and critical damage.'],
    [/ichigo/, 'Bankai Pressure: Soul damage and speed increase after ultimate.'],
    [/saber|artoria/, 'Avalon: grants a starting shield and reduces burst damage.']
  ];
  for (const [rx, text] of passives) if (rx.test(n)) return text;

  const role = ofRole(c);
  const element = ofElement(c);
  if (role === 'Tank') return `Iron Guard: DEF scaling and ${element} resistance.`;
  if (role === 'Support') return `Battle Support: restores energy and strengthens ${element} allies.`;
  if (role === 'Control') return 'Command Aura: reduces enemy ultimate charge and increases control chance.';
  if (role === 'Assassin') return 'Weak Point: high crit and partial DEF ignore.';
  if (role === 'Mage') return `${element} Burst: ultimate damage scales with penetration.`;
  return 'Battle Instinct: ATK rises every round.';
}

const OF_TEAMUPS = [
  { name: 'Zero Requiem', keys: ['lelouch', 'c c'], buff: '+20% control chance, +15% ultimate charge' },
  { name: 'Strongest Past', keys: ['gojo', 'geto'], buff: '+18% Void damage, +10% ultimate charge' },
  { name: 'Saiyan Rivalry', keys: ['goku', 'vegeta'], buff: '+18% ATK after round 3' },
  { name: 'Jujutsu Core', keys: ['yuji', 'megumi', 'nobara'], buff: '+12% ATK, +15% ultimate charge' },
  { name: 'Monster Trio', keys: ['luffy', 'zoro', 'sanji'], buff: '+18% ATK, +10% speed' },
  { name: 'Hunter Bond', keys: ['gon', 'killua'], buff: '+15% speed, +12% crit' },
  { name: 'Uchiha Bloodline', keys: ['itachi', 'sasuke'], buff: '+15% crit, +10% control resist' },
  { name: 'Shadow Army', keys: ['sung jin', 'igris'], buff: '+15% Shadow damage' },
  { name: 'Fate Clash', keys: ['saber', 'gilgamesh'], buff: '+15% penetration, +12% shield' },
  { name: 'Devil Hunters', keys: ['denji', 'power', 'aki'], buff: '+15% damage against bosses' },
  { name: 'Demon Slayer Trio', keys: ['tanjiro', 'zenitsu', 'inosuke'], buff: '+12% speed, +12% crit' }
];

function ofTeamUps(cards) {
  const names = cards.map(card => ofNorm((card.character || card).name)).join(' | ');
  const active = OF_TEAMUPS.filter(rule => rule.keys.every(k => names.includes(ofNorm(k))));

  const elements = {};
  for (const card of cards) {
    const e = ofElement(card.character || card);
    elements[e] = (elements[e] || 0) + 1;
  }

  for (const [element, count] of Object.entries(elements)) {
    if (count >= 3) active.push({ name: `${element} Aura`, buff: count >= 6 ? '+24% team HP and damage' : '+12% team HP and damage' });
  }

  return active;
}

async function ofOwned(userId, take = 2000) {
  return prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { power: 'desc' }, take });
}

async function ofFindOwned(userId, q, limit = 20) {
  const tokens = ofNorm(q).split(/\s+/).filter(Boolean);
  const cards = await ofOwned(userId);
  return cards.map(card => {
    const c = card.character;
    const full = `${ofNorm(ofCleanName(c.name))} ${ofNorm(c.name)} ${ofNorm(c.anime)}`;
    let score = 0;
    for (const t of tokens) {
      if (full.includes(t)) score += 50;
      if (ofNorm(c.name).includes(t)) score += 80;
      if (ofNorm(c.anime).includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
    return { card, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || Number(b.card.power || 0) - Number(a.card.power || 0)).slice(0, limit).map(x => x.card);
}

function ofQuickSellValue(rarity) {
  return { COMMON: 250, RARE: 900, EPIC: 2500, LEGENDARY: 8000, MYTHIC: 18000, DIVINE: 40000, SECRET: 90000 }[String(rarity || '').toUpperCase()] || 100;
}

async function ofQuickSell(i) {
  const rarity = String(i.options.getString('rarity', true) || '').toUpperCase();
  const confirm = String(i.options.getString('confirm', false) || '').toUpperCase();

  if (confirm !== 'YES') {
    return i.reply(
      `⚠️ **Quick Sell Preview**\n` +
      `Rarity: **${rarity}**\n` +
      `This sells all **unequipped** ${rarity} characters.\n` +
      `Formation cards are protected.\n\n` +
      `Run again with **confirm:YES**.`
    );
  }

  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const equipped = await prisma.teamSlot.findMany({ where: { userId: i.user.id }, select: { cardId: true } }).catch(() => []);
  const protectedIds = new Set(equipped.map(x => x.cardId).filter(Boolean));

  const cards = await prisma.userCard.findMany({ where: { userId: i.user.id }, include: { character: true }, take: 3000 }).catch(() => []);
  const matching = cards.filter(c => String(c.character?.rarity || '').toUpperCase() === rarity);
  const sellable = matching.filter(c => !protectedIds.has(c.id));
  const protectedCount = matching.length - sellable.length;

  if (!sellable.length) {
    return i.editReply(`No unequipped **${rarity}** characters to sell.` + (protectedCount ? `\nProtected equipped cards: **${protectedCount}**` : ''));
  }

  const gold = sellable.reduce((sum, c) => sum + ofQuickSellValue(c.character.rarity), 0);
  const ids = sellable.map(c => c.id);

  await prisma.marketListing.updateMany({ where: { cardId: { in: ids }, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }).catch(() => null);

  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    await prisma.userCard.deleteMany({ where: { id: { in: chunk } } }).catch(async () => {
      for (const id of chunk) await prisma.userCard.delete({ where: { id } }).catch(() => null);
    });
  }

  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { increment: gold } } }).catch(() => null);

  return i.editReply(
    `✅ **Quick Sell Complete**\n` +
    `Rarity: **${rarity}**\n` +
    `Sold: **${sellable.length}** character(s)\n` +
    `Gold gained: **${ofMoney(gold)}**\n` +
    (protectedCount ? `Protected equipped: **${protectedCount}**` : '')
  );
}

async function ofAscend(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const q = i.options.getString('name', true);
  const matches = await ofFindOwned(i.user.id, q, 50);
  if (!matches.length) return i.editReply(`No owned character found for **${q}**.`);

  const main = matches.sort((a, b) => Number(b.power || 0) - Number(a.power || 0))[0];

  const dupes = await prisma.userCard.findMany({
    where: { userId: i.user.id, characterId: main.characterId },
    include: { character: true },
    orderBy: { power: 'asc' },
    take: 50
  });

  const consume = dupes.find(c => c.id !== main.id);
  if (!consume) return i.editReply(`You need a duplicate of **${ofCleanName(main.character.name)}** to ascend.`);

  const currentStars = ofStarsFromTrait(main.trait);
  if (currentStars >= 10) return i.editReply(`**${ofCleanName(main.character.name)}** is already max stars: **${ofStarsLine(10)}**.`);

  const nextStars = currentStars + 1;
  const currentRarity = String(main.character.rarity || 'COMMON').toUpperCase();
  const nextRarity = ofNextRarity(currentRarity, nextStars);
  const cost = ofAscendCost(currentRarity, nextStars);

  const user = await prisma.user.findUnique({ where: { id: i.user.id } });
  if ((user?.gold || 0) < cost.gold || (user?.tokens || 0) < cost.tokens) {
    return i.editReply(
      `Not enough resources.\n` +
      `Need: **${ofMoney(cost.gold)} Gold** + **${cost.tokens} Tokens**\n` +
      `You have: **${ofMoney(user?.gold || 0)} Gold** + **${user?.tokens || 0} Tokens**`
    );
  }

  await prisma.marketListing.updateMany({ where: { cardId: consume.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }).catch(() => null);
  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { decrement: cost.gold }, tokens: { decrement: cost.tokens } } });
  await prisma.userCard.delete({ where: { id: consume.id } }).catch(() => null);

  const powerGain = 125 + (nextStars * 75);
  await prisma.userCard.update({ where: { id: main.id }, data: { power: { increment: powerGain }, trait: ofSetStarsTrait(main.trait, nextStars) } }).catch(() => null);

  let rarityText = '';
  if (nextRarity !== currentRarity) {
    await prisma.character.update({ where: { id: main.characterId }, data: { rarity: nextRarity } }).catch(() => null);
    rarityText = `\n🔥 Rarity evolved: **${currentRarity} → ${nextRarity}**`;
  }

  return i.editReply(
    `✨ **ASCEND SUCCESS**\n` +
    `Character: **${ofCleanName(main.character.name)}**\n` +
    `Stars: **${ofStarsLine(currentStars)} → ${ofStarsLine(nextStars)}**\n` +
    `Consumed duplicate automatically.\n` +
    `Power gained: **+${powerGain}**\n` +
    `Cost: **${ofMoney(cost.gold)} Gold** + **${cost.tokens} Tokens**` +
    rarityText
  );
}

async function ofStarsInfo(i) {
  const card = (await ofFindOwned(i.user.id, i.options.getString('name', true), 1))[0];
  if (!card) return i.reply('No owned character found.');

  const stars = ofStarsFromTrait(card.trait);
  const rarity = String(card.character.rarity || 'COMMON').toUpperCase();
  const nextStars = Math.min(10, stars + 1);
  const nextRarity = ofNextRarity(rarity, nextStars);
  const cost = ofAscendCost(rarity, nextStars);

  return i.reply(
    `**${ofCleanName(card.character.name)}**\n` +
    `Rarity: **${rarity}**\n` +
    `Stars: **${ofStarsLine(stars)}**\n` +
    `Next cost: **${ofMoney(cost.gold)} Gold** + **${cost.tokens} Tokens**\n` +
    (nextRarity !== rarity ? `Next rarity evolution: **${rarity} → ${nextRarity}**` : `Next rarity evolution: **None yet**`)
  );
}

async function ofStatsOrSearch(i, userId, commandName) {
  if (commandName === 'stats' || commandName === 'inv-search') {
    const card = (await ofFindOwned(userId, i.options.getString('name', true), 1))[0];
    if (!card) return i.reply('No owned character found.');
    const c = card.character;
    const stars = ofStarsFromTrait(card.trait);
    const teamups = OF_TEAMUPS.filter(rule => ofNorm(c.name).includes(ofNorm(rule.keys[0])) || rule.keys.some(k => ofNorm(c.name).includes(ofNorm(k))));
    const embed = new EmbedBuilder()
      .setTitle(`${commandName === 'stats' ? 'Stats' : 'Inventory Search'}: ${ofCleanName(c.name)}`)
      .setDescription(
        `${ofRarityEmoji(c.rarity)} **${ofCleanName(c.name)}** • ${c.anime}\n` +
        `Rarity: **${c.rarity}** | Stars: **${ofStarsLine(stars)}**\n` +
        `Role: **${ofRole(c)}** | Element: **${ofElement(c)}**\n` +
        `Passive: ${ofPassive(c)}\n\n` +
        `Possible Team-Ups:\n${teamups.length ? teamups.slice(0, 5).map(t => `• **${t.name}**: ${t.buff}`).join('\n') : 'None'}`
      )
      .setColor(embedColor(getAura(c).color));
    if (c.imageUrl) embed.setThumbnail(c.imageUrl);
    return i.reply({ embeds: [embed] });
  }
  return false;
}

async function ofFinalHandler(i, userId, commandName) {
  if (commandName === 'quick-sell') return ofQuickSell(i);
  if (commandName === 'ascend') return ofAscend(i);
  if (commandName === 'stars') return ofStarsInfo(i);
  if (commandName === 'stats' || commandName === 'inv-search') return ofStatsOrSearch(i, userId, commandName);
  return false;
}
// ===== END ONE FILE FINAL SYSTEMS PATCH =====


// ===== ABSOLUTE FIX: QUICK SELL + STARS + DAILY BANNER =====
// This block is inserted before every old handler. It does not depend on old systems.

function absNorm(v = '') {
  return String(v || '').toLowerCase().replace(/[().\-_:\/]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function absCleanName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function absMoney(n) {
  return typeof money === 'function' ? money(n) : Number(n || 0).toLocaleString('en-US');
}
function absStarsFromTrait(trait = '') {
  const m = String(trait || '').match(/Stars:(\d+)/i);
  return m ? Math.max(0, Math.min(10, Number(m[1] || 0))) : 0;
}
function absSetStarsTrait(trait = '', stars = 0) {
  const clean = String(trait || '').replace(/\s*\|?\s*Stars:\d+/ig, '').trim();
  return `${clean}${clean ? ' | ' : ''}Stars:${Math.max(0, Math.min(10, stars))}`;
}
function absStarsLine(stars) {
  stars = Math.max(0, Math.min(10, Number(stars || 0)));
  return '★'.repeat(stars) + '☆'.repeat(10 - stars);
}
function absRarityRank(rarity) {
  return { COMMON: 1, RARE: 2, EPIC: 3, LEGENDARY: 4, MYTHIC: 5, DIVINE: 6, SECRET: 7 }[String(rarity || '').toUpperCase()] || 1;
}
function absRankRarity(rank) {
  return { 1: 'COMMON', 2: 'RARE', 3: 'EPIC', 4: 'LEGENDARY', 5: 'MYTHIC', 6: 'DIVINE', 7: 'SECRET' }[rank] || 'COMMON';
}
function absNextRarity(current, stars) {
  const rank = absRarityRank(current);
  if (rank >= 7) return 'SECRET';
  return absRankRarity(Math.min(7, rank + Math.floor(Number(stars || 0) / 2)));
}
function absAscendCost(rarity, nextStars) {
  const base = {
    COMMON: { gold: 700, tokens: 0 },
    RARE: { gold: 1800, tokens: 1 },
    EPIC: { gold: 4500, tokens: 2 },
    LEGENDARY: { gold: 12000, tokens: 5 },
    MYTHIC: { gold: 28000, tokens: 12 },
    DIVINE: { gold: 65000, tokens: 25 },
    SECRET: { gold: 110000, tokens: 45 }
  }[String(rarity || '').toUpperCase()] || { gold: 1000, tokens: 0 };
  return { gold: base.gold * Math.max(1, nextStars), tokens: base.tokens * Math.max(1, Math.ceil(nextStars / 2)) };
}
async function absFindOwned(userId, q, limit = 20) {
  const tokens = absNorm(q).split(/\s+/).filter(Boolean);
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 2000
  }).catch(() => []);
  return cards.map(card => {
    const full = `${absNorm(absCleanName(card.character?.name || ''))} ${absNorm(card.character?.name || '')} ${absNorm(card.character?.anime || '')}`;
    let score = 0;
    for (const t of tokens) {
      if (full.includes(t)) score += 50;
      if (absNorm(card.character?.name || '').includes(t)) score += 80;
      if (absNorm(card.character?.anime || '').includes(t)) score += 30;
    }
    if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
    return { card, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || Number(b.card.power || 0) - Number(a.card.power || 0)).slice(0, limit).map(x => x.card);
}
function absQuickSellValue(rarity) {
  return { COMMON: 250, RARE: 900, EPIC: 2500, LEGENDARY: 8000, MYTHIC: 18000, DIVINE: 40000, SECRET: 90000 }[String(rarity || '').toUpperCase()] || 100;
}
async function absQuickSell(i) {
  const rarity = String(i.options.getString('rarity', true) || '').toUpperCase();
  const confirm = String(i.options.getString('confirm', false) || '').toUpperCase();

  if (confirm !== 'YES') {
    return i.reply(
      `⚠️ **Quick Sell Preview**\n` +
      `Rarity: **${rarity}**\n` +
      `This sells all **unequipped** ${rarity} characters.\n` +
      `Cards equipped in formations are protected.\n\n` +
      `Run again with **confirm:YES**.`
    );
  }

  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const equipped = await prisma.teamSlot.findMany({
    where: { userId: i.user.id },
    select: { cardId: true }
  }).catch(() => []);
  const protectedIds = new Set(equipped.map(x => x.cardId).filter(Boolean));

  const cards = await prisma.userCard.findMany({
    where: { userId: i.user.id },
    include: { character: true },
    take: 5000
  }).catch(() => []);

  const matching = cards.filter(c => String(c.character?.rarity || '').toUpperCase() === rarity);
  const sellable = matching.filter(c => !protectedIds.has(c.id));
  const protectedCount = matching.length - sellable.length;

  if (!sellable.length) {
    return i.editReply(
      `No unequipped **${rarity}** characters to sell.` +
      (protectedCount ? `\nProtected equipped cards: **${protectedCount}**` : '')
    );
  }

  const ids = sellable.map(c => c.id);
  const gold = sellable.reduce((sum, c) => sum + absQuickSellValue(c.character?.rarity), 0);

  await prisma.marketListing.updateMany({
    where: { cardId: { in: ids }, status: 'ACTIVE' },
    data: { status: 'CANCELLED' }
  }).catch(() => null);

  let deleted = 0;
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    await prisma.userCard.deleteMany({ where: { id: { in: chunk } } }).catch(async () => {
      for (const id of chunk) await prisma.userCard.delete({ where: { id } }).catch(() => null);
    });
    deleted += chunk.length;
  }

  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { increment: gold } } }).catch(() => null);

  return i.editReply(
    `✅ **Quick Sell Complete**\n` +
    `Rarity: **${rarity}**\n` +
    `Sold: **${deleted}** character(s)\n` +
    `Gold gained: **${absMoney(gold)}**\n` +
    (protectedCount ? `Protected equipped: **${protectedCount}**` : '')
  );
}
async function absStarsInfo(i) {
  const q = i.options.getString('name', true);
  const card = (await absFindOwned(i.user.id, q, 1))[0];
  if (!card) return i.reply(`No owned character found for **${q}**.`);

  const stars = absStarsFromTrait(card.trait);
  const rarity = String(card.character?.rarity || 'COMMON').toUpperCase();
  const nextStars = Math.min(10, stars + 1);
  const nextRarity = absNextRarity(rarity, nextStars);
  const cost = absAscendCost(rarity, nextStars);

  return i.reply(
    `**${absCleanName(card.character.name)}**\n` +
    `Rarity: **${rarity}**\n` +
    `Stars: **${absStarsLine(stars)}**\n` +
    `Next cost: **${absMoney(cost.gold)} Gold** + **${cost.tokens} Tokens**\n` +
    (nextRarity !== rarity ? `Next rarity evolution: **${rarity} → ${nextRarity}**` : `Next rarity evolution: **None yet**`)
  );
}
async function absAscend(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const q = i.options.getString('name', true);
  const matches = await absFindOwned(i.user.id, q, 50);
  if (!matches.length) return i.editReply(`No owned character found for **${q}**.`);

  const main = matches.sort((a, b) => Number(b.power || 0) - Number(a.power || 0))[0];
  const dupes = await prisma.userCard.findMany({
    where: { userId: i.user.id, characterId: main.characterId },
    include: { character: true },
    orderBy: { power: 'asc' },
    take: 50
  }).catch(() => []);
  const consume = dupes.find(c => c.id !== main.id);

  if (!consume) return i.editReply(`You need a duplicate of **${absCleanName(main.character.name)}** to ascend.`);

  const currentStars = absStarsFromTrait(main.trait);
  if (currentStars >= 10) return i.editReply(`**${absCleanName(main.character.name)}** is already max stars: **${absStarsLine(10)}**.`);

  const nextStars = currentStars + 1;
  const currentRarity = String(main.character?.rarity || 'COMMON').toUpperCase();
  const nextRarity = absNextRarity(currentRarity, nextStars);
  const cost = absAscendCost(currentRarity, nextStars);

  const user = await prisma.user.findUnique({ where: { id: i.user.id } });
  if ((user?.gold || 0) < cost.gold || (user?.tokens || 0) < cost.tokens) {
    return i.editReply(
      `Not enough resources.\n` +
      `Need: **${absMoney(cost.gold)} Gold** + **${cost.tokens} Tokens**\n` +
      `You have: **${absMoney(user?.gold || 0)} Gold** + **${user?.tokens || 0} Tokens**`
    );
  }

  await prisma.marketListing.updateMany({ where: { cardId: consume.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }).catch(() => null);
  await prisma.user.update({ where: { id: i.user.id }, data: { gold: { decrement: cost.gold }, tokens: { decrement: cost.tokens } } }).catch(() => null);
  await prisma.userCard.delete({ where: { id: consume.id } }).catch(() => null);

  const powerGain = 125 + (nextStars * 75);
  await prisma.userCard.update({
    where: { id: main.id },
    data: { power: { increment: powerGain }, trait: absSetStarsTrait(main.trait, nextStars) }
  }).catch(() => null);

  let rarityText = '';
  if (nextRarity !== currentRarity) {
    await prisma.character.update({ where: { id: main.characterId }, data: { rarity: nextRarity } }).catch(() => null);
    rarityText = `\n🔥 Rarity evolved: **${currentRarity} → ${nextRarity}**`;
  }

  return i.editReply(
    `✨ **ASCEND SUCCESS**\n` +
    `Character: **${absCleanName(main.character.name)}**\n` +
    `Stars: **${absStarsLine(currentStars)} → ${absStarsLine(nextStars)}**\n` +
    `Consumed duplicate automatically.\n` +
    `Power gained: **+${powerGain}**\n` +
    `Cost: **${absMoney(cost.gold)} Gold** + **${cost.tokens} Tokens**` +
    rarityText
  );
}
function absDaySeed() {
  return Math.floor(Date.now() / 86400000);
}
async function absDailyBanner(i) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    orderBy: { basePower: 'desc' },
    take: 250
  }).catch(() => []);

  const pool = chars.length ? chars : [];
  const seed = absDaySeed();
  const picks = [];
  for (let x = 0; x < Math.min(5, pool.length); x++) {
    picks.push(pool[(seed * 13 + x * 29) % pool.length]);
  }

  const ends = Math.floor(((seed + 1) * 86400000) / 1000);

  const embed = new EmbedBuilder()
    .setTitle('Daily Void Banner')
    .setDescription(
      `Refreshes daily automatically.\nEnds: <t:${ends}:R>\n\n` +
      (picks.length
        ? picks.map((c, idx) => `${idx + 1}. ${absCleanName(c.name)} • ${c.anime} • **${c.rarity}**`).join('\n')
        : 'No banner characters found.')
    )
    .setColor(0x9b59b6);

  if (picks[0]?.imageUrl) embed.setThumbnail(picks[0].imageUrl);

  return i.reply({ embeds: [embed] });
}
async function absAbsoluteHandler(i, userId, commandName) {
  if (commandName === 'quick-sell') return absQuickSell(i);
  if (commandName === 'stars') return absStarsInfo(i);
  if (commandName === 'ascend') return absAscend(i);
  if (commandName === 'banner') return absDailyBanner(i);
  return false;
}
// ===== END ABSOLUTE FIX PATCH =====


// ===== SECRET DAILY BANNER + SOFT/HARD PITY PATCH =====
// Banner: 4 SECRET characters only, rotates daily.
// Roll pity: soft pity starts after 60 rolls, hard pity at 90 rolls.
// Pity counters are stored in user.trait when available, fallback is memory for current session.

const pityMemory = new Map();

function pityTodaySeed() {
  return Math.floor(Date.now() / 86400000);
}

function pityCleanName(name = '') {
  if (typeof absCleanName === 'function') return absCleanName(name);
  if (typeof hxCleanName === 'function') return hxCleanName(name);
  return String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function pityMoney(n) {
  return typeof money === 'function' ? money(n) : Number(n || 0).toLocaleString('en-US');
}

function pityEmoji(r) {
  return typeof rarityEmoji === 'function' ? rarityEmoji(r) : '⭐';
}

function pityGetUserCounter(user) {
  const trait = String(user?.trait || '');
  const m = trait.match(/Pity:(\d+)/i);
  if (m) return Number(m[1] || 0);
  return pityMemory.get(user?.id) || 0;
}

function pitySetUserTrait(trait = '', counter = 0) {
  const clean = String(trait || '').replace(/\s*\|?\s*Pity:\d+/ig, '').trim();
  return `${clean}${clean ? ' | ' : ''}Pity:${Math.max(0, Number(counter || 0))}`;
}

async function pitySaveCounter(userId, counter) {
  pityMemory.set(userId, counter);
  const user = await prisma.user.findUnique({ where: { id: userId } }).catch(() => null);
  if (!user) return;
  // Some schemas may not have trait on User, so safely fallback to memory if update fails.
  await prisma.user.update({
    where: { id: userId },
    data: { trait: pitySetUserTrait(user.trait, counter) }
  }).catch(() => null);
}

async function pitySecretPool() {
  let secrets = await prisma.character.findMany({
    where: { active: true, rarity: 'SECRET' },
    orderBy: { basePower: 'desc' },
    take: 300
  }).catch(() => []);

  // Unique by clean name + anime to avoid duplicate forms.
  const seen = new Set();
  const unique = [];
  for (const c of secrets) {
    const key = `${pityCleanName(c.name).toLowerCase()}::${String(c.anime || '').toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return unique;
}

async function pityDailyBannerCharacters() {
  const pool = await pitySecretPool();
  const seed = pityTodaySeed();
  const picks = [];

  if (!pool.length) return picks;

  for (let i = 0; i < Math.min(4, pool.length); i++) {
    picks.push(pool[(seed * 17 + i * 31) % pool.length]);
  }

  return picks;
}

async function pityDailyBanner(i) {
  const picks = await pityDailyBannerCharacters();
  const seed = pityTodaySeed();
  const ends = Math.floor(((seed + 1) * 86400000) / 1000);

  const embed = new EmbedBuilder()
    .setTitle('Daily SECRET Banner')
    .setDescription(
      `Only **SECRET** characters.\n` +
      `Rotates daily automatically.\n` +
      `Soft pity: **60 rolls**\n` +
      `Hard pity: **90 rolls**\n` +
      `Ends: <t:${ends}:R>\n\n` +
      (picks.length
        ? picks.map((c, idx) => `${idx + 1}. **${pityCleanName(c.name)}** • ${c.anime} • SECRET`).join('\n')
        : 'No SECRET characters found.')
    )
    .setColor(0xe74c3c);

  if (picks[0]?.imageUrl) embed.setThumbnail(picks[0].imageUrl);
  return i.reply({ embeds: [embed] });
}

async function pityPickBannerSecret() {
  const banner = await pityDailyBannerCharacters();
  if (banner.length) return banner[Math.floor(Math.random() * banner.length)];
  const pool = await pitySecretPool();
  return pool[Math.floor(Math.random() * Math.max(1, pool.length))] || null;
}

async function pityCreateCard(userId, character) {
  // Prefer original rollCard behavior if creating userCard schema is different.
  // But if we need guaranteed SECRET from banner, create directly.
  const cardId = typeof nanoid === 'function' ? nanoid(12) : `${userId}_${character.id}_${Date.now()}`;
  return prisma.userCard.create({
    data: {
      id: cardId,
      userId,
      characterId: character.id,
      power: Number(character.basePower || 3000)
    }
  }).catch(async () => {
    // fallback if schema auto-generates id
    return prisma.userCard.create({
      data: {
        userId,
        characterId: character.id,
        power: Number(character.basePower || 3000)
      }
    });
  });
}

async function pityRoll(i) {
  if (!i.deferred && !i.replied) await i.deferReply().catch(() => null);

  const amount = Math.max(1, Math.min(10, i.options.getInteger('amount') || 1));
  const user = await prisma.user.findUnique({ where: { id: i.user.id } });
  if ((user?.rolls || 0) < amount) {
    return i.editReply(`You need **${amount} rolls**, you have **${user?.rolls || 0}**.`);
  }

  await prisma.user.update({
    where: { id: i.user.id },
    data: { rolls: { decrement: amount } }
  });

  let pity = pityGetUserCounter(user);
  const lines = [];
  const embeds = [];
  let gotSecret = false;

  for (let n = 0; n < amount; n++) {
    pity += 1;

    // Soft pity starts at 60: increasing chance every roll.
    const softBonus = pity >= 60 ? Math.min(0.45, (pity - 59) * 0.025) : 0;
    const hard = pity >= 90;

    let forcedSecret = hard || Math.random() < softBonus;
    let result;

    if (forcedSecret) {
      const secret = await pityPickBannerSecret();
      if (secret) {
        const card = await pityCreateCard(i.user.id, secret);
        result = { character: secret, card };
        gotSecret = true;
        pity = 0;
      }
    }

    if (!result) {
      result = await rollCard(i.user.id);
      if (String(result.character?.rarity || '').toUpperCase() === 'SECRET') {
        gotSecret = true;
        pity = 0;
      }
    }

    const c = result.character;
    const card = result.card;
    const pityText = gotSecret && String(c.rarity).toUpperCase() === 'SECRET'
      ? ' • PITY RESET'
      : ` • Pity ${pity}/90`;

    lines.push(
      `${n + 1}. ${pityEmoji(c.rarity)} **${pityCleanName(c.name)}** • ${c.anime} • ${c.rarity} • PWR ${pityMoney(card.power || c.basePower)}${pityText}`
    );

    if (embeds.length < 5) {
      const embed = new EmbedBuilder()
        .setTitle(`${n + 1}. ${pityEmoji(c.rarity)} ${pityCleanName(c.name)}`)
        .setDescription(
          `Anime: **${c.anime}**\n` +
          `Rarity: **${c.rarity}**\n` +
          `Power: **${pityMoney(card.power || c.basePower)}**\n` +
          `Pity: **${pity}/90**\n` +
          (String(c.rarity).toUpperCase() === 'SECRET' ? `🔥 SECRET obtained. Pity reset.` : `Soft pity starts at 60. Hard pity at 90.`)
        )
        .setColor(String(c.rarity).toUpperCase() === 'SECRET' ? 0xe74c3c : 0x9b59b6);
      if (c.imageUrl) embed.setImage(c.imageUrl);
      embeds.push(embed);
    }
  }

  await pitySaveCounter(i.user.id, pity);

  return i.editReply({
    content:
      (`**ROLL x${amount}**\n` +
      `${lines.join('\n')}\n\n` +
      `Rolls left: **${(user?.rolls || 0) - amount}**\n` +
      `Current pity: **${pity}/90**`).slice(0, 1900),
    embeds
  });
}

async function pityHandler(i, userId, commandName) {
  if (commandName === 'banner') return pityDailyBanner(i);
  if (commandName === 'roll' || commandName === 'r') return pityRoll(i);
  return false;
}
// ===== END SECRET DAILY BANNER + PITY PATCH =====

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      if (i.customId.startsWith('hxi_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await hxInventoryPage(i.user.id, next);
        if (data.empty) return i.reply({ content: 'You do not have any cards yet.', ephemeral: true });
        return i.update({ embeds: [data.embed], components: [data.row] });
      }
      if (i.customId.startsWith('vri_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await fuInventoryPage(i.user.id, next);
        if (data.empty) return i.reply({ content: 'You do not have any cards yet.', ephemeral: true });
        return i.update({ embeds: [data.embed], components: [data.row] });
      }
      await ensureUser(i.user);
      if (i.customId.startsWith('inv_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await inventoryEmbed(i.user.id, next);

        if (data.empty) {
          return i.reply({ content: 'You do not have any cards yet.', ephemeral: true });
        }

        return i.update({ embeds: [data.embed], components: [data.row] });
      }

      if (i.customId.startsWith('boss_join_')) {
        const eventId = i.customId.replace('boss_join_', '');
        const boss = activeBosses.get(eventId);

        if (!boss) {
          return i.reply({ content: 'This boss event is no longer active.', ephemeral: true });
        }

        boss.entries.add(i.user.id);

        return i.reply({
          content: `دخلت البوس **${boss.bossName}**. عدد اللاعبين: **${boss.entries.size}**`,
          ephemeral: true
        });
      }

      if (i.customId.startsWith('trade_accept_') || i.customId.startsWith('trade_decline_')) {
        const isAccept = i.customId.startsWith('trade_accept_');
        const tradeId = i.customId.replace('trade_accept_', '').replace('trade_decline_', '');
        const trade = pendingTrades.get(tradeId);

        if (!trade) {
          return i.reply({ content: 'This trade offer is expired or already completed.', ephemeral: true });
        }

        if (i.user.id !== trade.targetId) {
          return i.reply({ content: 'Only the trade receiver can accept or decline this trade.', ephemeral: true });
        }

        if (!isAccept) {
          pendingTrades.delete(tradeId);
          return i.update({ content: `Trade declined by <@${trade.targetId}>.`, embeds: [], components: [] });
        }

        const offerCard = await prisma.userCard.findFirst({
          where: { id: trade.offerCardId, userId: trade.offerUserId },
          include: { character: true }
        });

        const requestCard = await prisma.userCard.findFirst({
          where: { id: trade.requestCardId, userId: trade.targetId },
          include: { character: true }
        });

        if (!offerCard || !requestCard) {
          pendingTrades.delete(tradeId);
          return i.update({
            content: 'Trade failed. One of the cards is no longer owned by the correct player.',
            embeds: [],
            components: []
          });
        }

        await prisma.$transaction([
          prisma.teamSlot.deleteMany({
            where: {
              OR: [
                { cardId: offerCard.id },
                { cardId: requestCard.id }
              ]
            }
          }),
          prisma.marketListing.updateMany({
            where: {
              OR: [
                { cardId: offerCard.id },
                { cardId: requestCard.id }
              ],
              status: 'ACTIVE'
            },
            data: { status: 'CANCELLED' }
          }),
          prisma.userCard.update({
            where: { id: offerCard.id },
            data: { userId: trade.targetId }
          }),
          prisma.userCard.update({
            where: { id: requestCard.id },
            data: { userId: trade.offerUserId }
          })
        ]);

        pendingTrades.delete(tradeId);

        return i.update({
          content:
            `**TRADE COMPLETE**\n` +
            `<@${trade.offerUserId}> gave **${offerCard.character.name}** to <@${trade.targetId}>.\n` +
            `<@${trade.targetId}> gave **${requestCard.character.name}** to <@${trade.offerUserId}>.`,
          embeds: [],
          components: []
        });
      }

      return;
    }

    if (!i.isChatInputCommand()) return;

    await ensureUser(i.user);

    const userId = i.user.id;
    const commandName = i.commandName;

    const pityHandled = await pityHandler(i, userId, commandName);
    if (pityHandled !== false) return pityHandled;

    const absHandled = await absAbsoluteHandler(i, userId, commandName);
    if (absHandled !== false) return absHandled;

    const hxHandled = await hxHardHandler(i, userId, commandName);
    if (hxHandled !== false) return hxHandled;

    const foHandled = await foFinalHandler(i, userId, commandName);
    if (foHandled !== false) return foHandled;

    const vxHandled = await vxHandler(i, userId, commandName);
    if (vxHandled !== false) return vxHandled;
    const fusionResults = [];


    if (commandName === 'characters-count') {
      const total = await prisma.character.count({ where: { active: true } });
      const saber = await prisma.character.findFirst({
        where: { name: { contains: 'Saber', mode: 'insensitive' } }
      });
      return i.reply(
        `📚 Active characters: **${total}**\n` +
        `Saber: **${saber ? `${saber.rarity} • PWR ${money(saber.basePower)}` : 'Missing'}**`
      );
    }

    if (commandName === 'help') {
      await i.deferReply({ ephemeral: true });
      return i.editReply(
        `**VOIDROLL COMMANDS**\n` +
        `/r - Quick character roll\n` +
        `/i - Quick item roll\n` +
        `/roll - Roll a character or item\n` +
        `/search - Search characters\n` +
        `/inventory - Card inventory with arrows\n` +
        `/trade - Trade cards with another player\n` +
        `/secrets - Show SECRET characters\n` +
        `/rarity - Show roll rates\n` +
        `/autoteam - Equip strongest 5 cards\n` +
        `/profile - Show your profile\n` +
        `/story /dungeon /tower - Progress battles\n` +
        `/farm-claim - Claim passive farm\n` +
        `/gold-shop /gold-buy /train - Spend gold\n` +
        `/core-shop /core-roll /ascend - Upgrade and guaranteed rolls\n` +
        `/shop /banner /pack - Multiple rotating banners\n` +
        `/transfer /list /buy - Market\n` +
        `/admin-spawn-boss - Admin boss event`
      );
    }


    if (commandName === 'level') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      return i.reply(
        `⭐ **LEVEL PROFILE**\n` +
        `Level: **${u.level || 1}**\n` +
        `XP: **${u.xp || 0}/${xpForLevel(u.level || 1)}**\n\n` +
        `Next level reward:\n` +
        `Gold: **${money(levelReward((u.level || 1) + 1).gold)}**\n` +
        `Tokens: **${levelReward((u.level || 1) + 1).tokens}**\n` +
        `Rolls: **${levelReward((u.level || 1) + 1).rolls}**`
      );
    }

    if (commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const last = new Date(u.lastRollRefillAt || Date.now());
      const next = new Date(last.getTime() + (60 * 60 * 1000));

      return i.reply(
        `**${i.user.username}**\n` +
        `Gold: ${money(u.gold)}\n` +
        `Tokens: ${u.tokens ?? 0}\n` +
        `Rolls: ${u.rolls ?? 0}\n` +
        `Next Refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
        `Level: ${u.level}
XP: ${u.xp || 0}/${xpForLevel(u.level || 1)}`
      );
    }

    if (commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');

      if (cd) {
        return i.reply({ content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`, ephemeral: true });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: 1500 },
          tokens: { increment: 3 },
          dailyStreak: { increment: 1 }
        }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);

      const xpResult = await addUserXp(userId, 25, 'daily');
      return i.reply('Daily claimed: 1,500 gold + 3 tokens.' + levelUpText(xpResult));
    }

    if (commandName === 'roll' || commandName === 'r' || commandName === 'i') {
      await i.deferReply();

      let type = 'character';
      if (commandName === 'i') type = 'item';
      else if (commandName === 'r') type = 'character';
      else type = i.options.getString('type') || 'character';

      const amount = Math.max(1, Math.min(10, i.options.getInteger('amount') || 1));
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.rolls ?? 0) < amount) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));
        return i.editReply(`You need **${amount} rolls** but you only have **${user.rolls ?? 0}**.\nNext refill: <t:${Math.floor(next.getTime() / 1000)}:R>`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { rolls: { decrement: amount } }
      });

      if (type === 'item') {
        const lines = [];
        for (let x = 0; x < amount; x++) {
          const eq = await rollItem(userId);
          lines.push(`${x + 1}. ${eq.id} • ${eq.template.name} • ${eq.template.rarity} • PWR ${eq.power}`);
        }

        const xpResult = typeof addUserXp === 'function'
          ? await addUserXp(userId, amount * 5, 'item roll')
          : null;

        return i.editReply((`**ITEM ROLL x${amount}**\n` + lines.join('\n') + `\n\nRolls left: **${(user.rolls ?? 0) - amount}**` + (typeof levelUpText === 'function' ? levelUpText(xpResult) : '')).slice(0, 1900));
      }

      if (amount === 1) {
        const result = await rollCard(userId);
        const xpResult = typeof addUserXp === 'function'
          ? await addUserXp(userId, 8, 'character roll')
          : null;

        if (xpResult && xpResult.leveled && typeof levelUpText === 'function') {
          result.text += levelUpText(xpResult);
        }
          result.text += fusionText(fusionResults);

        const aura = getAura(result.character);

        const embed = new EmbedBuilder()
          .setTitle('New Character Roll!')
          .setDescription(
            `${result.text}\n\n` +
            `Anime: **${result.character.anime}**\n` +
            `Technique: **${aura.name}**\n` +
            characterStatsText(result.card, result.character) + `\n` +
            `Rolls left: **${(user.rolls ?? 1) - 1}**`
          )
          .setColor(embedColor(aura.color))
          .setFooter({ text: `Card ID: ${result.card.id}` });

        try {
          const png = await renderCard({ card: result.card, character: result.character });
          const file = new AttachmentBuilder(png, { name: 'card.png' });
          embed.setImage('attachment://card.png');
          return i.editReply({ embeds: [embed], files: [file] });
        } catch (err) {
          console.error(err);
          if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
          return i.editReply({ embeds: [embed] });
        }
      }

      const embeds = [];
      const files = [];
      const lines = [];

      for (let x = 0; x < amount; x++) {
        const result = await rollCard(userId);
        const aura = getAura(result.character);

        lines.push(`${x + 1}. ${rarityEmoji(result.character.rarity)} **${result.character.name}** • ${result.character.rarity} • PWR ${result.card.power}`);

        const embed = new EmbedBuilder()
          .setTitle(`${x + 1}. ${rarityEmoji(result.character.rarity)} ${result.character.name}`)
          .setDescription(
            `Anime: **${result.character.anime}**\n` +
            `Rarity: **${result.character.rarity}**\n` +
            `Power: **${result.card.power}**\n` +
            `Card ID: \`${result.card.id}\`` + fusionText(fusionResults) + fusionText(fusionResults)
          )
          .setColor(embedColor(aura.color));

        try {
          const png = await renderCard({ card: result.card, character: result.character });
          const fileName = `roll-${x + 1}.png`;
          const file = new AttachmentBuilder(png, { name: fileName });
          embed.setImage(`attachment://${fileName}`);
          files.push(file);
        } catch (_) {
          if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        }

        embeds.push(embed);
      }

      const xpResult = typeof addUserXp === 'function'
        ? await addUserXp(userId, amount * 8, 'character roll')
        : null;

      return i.editReply({
        content: (`**CHARACTER ROLL x${amount}**\n` + lines.join('\n') + `\n\nRolls left: **${(user.rolls ?? 0) - amount}**` + (typeof levelUpText === 'function' ? levelUpText(xpResult) : '') + fusionText(fusionResults)).slice(0, 1800),
        embeds: embeds.slice(0, 10),
        files: files.slice(0, 10)
      });
    }

    if (commandName === 'search') {
      const query = i.options.getString('name', true).trim().toLowerCase();

      const allChars = await prisma.character.findMany({
        where: { active: true },
        orderBy: { basePower: 'desc' },
        take: 1000
      });

      const chars = allChars.filter(c => `${c.name} ${c.anime}`.toLowerCase().includes(query)).slice(0, 10);

      if (!chars.length) return i.reply('No characters found.');

      const first = chars[0];
      const aura = getAura(first);
      const globalOwned = await prisma.userCard.count({ where: { characterId: first.id } });
      const matches = chars
        .map((c, idx) => `${idx + 1}. ${rarityEmoji(c.rarity)} **${c.name}** • ${c.anime} • PWR ${c.basePower}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`Search Results for "${query}"`)
        .setDescription(
          `**Best Match Preview**\n` +
          `${rarityEmoji(first.rarity)} **${first.name}**\n` +
          `Anime: **${first.anime}**\n` +
          `Rarity: **${first.rarity}**\n` +
          `Base Power: **${first.basePower}**\n` +
          `Global Owned: **${globalOwned}**\n` +
          `Technique: **${aura.name}**\n\n` +
          `**Matches**\n${matches}`
        )
        .setColor(embedColor(aura.color));

      try {
        const preview = await renderCard({
          card: { id: 'preview', serial: 0, power: first.basePower },
          character: first
        });

        const file = new AttachmentBuilder(preview, { name: 'search-preview.png' });
        embed.setImage('attachment://search-preview.png');
        return i.reply({ embeds: [embed], files: [file] });
      } catch (_) {
        if (first.imageUrl) embed.setImage(first.imageUrl);
        return i.reply({ embeds: [embed] });
      }
    }

    if (commandName === 'secrets') {
      await applySecretCharacterBoosts();
    await syncAllCardPowers(prisma);

      const chars = await prisma.character.findMany({
        where: { rarity: 'SECRET' },
        orderBy: { basePower: 'desc' },
        take: 25
      });

      if (!chars.length) return i.reply('No SECRET characters found yet.');

      const content = (`**SECRET CHARACTERS**\n\n` + chars.map(c => `${c.name} • ${c.anime} • PWR ${c.basePower}`).join('\n')).slice(0, 1900);
      return i.reply(content);
    }

    if (commandName === 'rarity') {
      return i.reply(
        `**NORMAL ROLL RATES**\n\n` +
        `Character Roll\n` +
        `Common: 72%\nRare: 22%\nEpic: 5.65%\nLegendary: 1%\nMythic: 0.75%\nDivine: 0.5%\nSecret: 0.1%\n\n` +
        `Item Roll\n` +
        `Common: 65%\nRare: 26%\nEpic: 7.65%\nLegendary: 1%\nMythic: 0.75%\nDivine: 0.5%\nSecret: 0.1%`
      );
    }


    if (commandName === 'inv-search') {
      const query = i.options.getString('name', true).trim().toLowerCase();

      const cards = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { power: 'desc' },
        take: 10000
      });

      const matches = cards.filter(c => `${c.character.name} ${c.character.anime}`.toLowerCase().includes(query)).slice(0, 15);

      if (!matches.length) return i.reply('No matching cards found in your inventory.');

      const first = matches[0];
      const aura = getAura(first.character);

      const embed = new EmbedBuilder()
        .setTitle(`Inventory Search: "${query}"`)
        .setDescription(matches.map((c, idx) =>
          `${idx + 1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}${starLabel(c)}** • ${c.character.rarity} • PWR ${c.power} • ID: \`${c.id}\``
        ).join('\n'))
        .setColor(embedColor(aura.color));

      if (first.character.imageUrl) embed.setImage(first.character.imageUrl);

      return i.reply({ embeds: [embed] });
    }

    if (commandName === 'inventory') {
      const data = await inventoryEmbed(userId, 0);
      if (data.empty) return i.reply('You do not have any cards yet.');
      return i.reply({ embeds: [data.embed], components: [data.row] });
    }

    if (commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({
        where: { userId },
        include: { template: true },
        take: 15,
        orderBy: { createdAt: 'desc' }
      });

      if (!eq.length) return i.reply('You do not have any items yet. Use /roll type:item.');
      return i.reply(('**Equipment**\n' + eq.map(itemLine).join('\n')).slice(0, 1900));
    }

    if (commandName === 'shop' || commandName === 'banner') {
      const banners = bannerSystem.activeBanners();
      const lines = [];

      for (const b of banners) {
        const pity = await bannerSystem.getPity(prisma, userId, b.id);
        lines.push(
          `**${b.name}** \`${b.id}\`\n` +
          `Featured: **${b.featuredDisplay}**\n` +
          `Cost: **1000 Tokens** per 10-pull • Guaranteed SECRET: **50 multis**\n` +
          `Your pity: **${pity}/50**\n` +
          `Ends: <t:${Math.floor(b.endsAt.getTime() / 1000)}:R>\n` +
          `Pool: ${b.pool.join(', ')}\n`
        );
      }

      return i.reply(
        `🎯 **ACTIVE LIMITED BANNERS**\n\n` +
        lines.join('\n') +
        `\nUse **/pack banner:<id>**. Anime packs and Secret Pack are removed.`
      );
    }

    if (commandName === 'pack') {
      await i.deferReply();

      const bannerId = i.options.getString('banner', true);
      const pull = await bannerSystem.rollBanner(prisma, userId, bannerId);

      const embeds = [];
      const files = [];
      const lines = [];

      for (let x = 0; x < pull.results.length; x++) {
        const result = pull.results[x];
        const aura = getAura(result.character);
        lines.push(`${x + 1}. ${rarityEmoji(result.character.rarity)} **${result.character.name}** • ${result.character.rarity} • PWR ${result.card.power}${result.guaranteed ? ' • GUARANTEED' : ''}`);

        const embed = new EmbedBuilder()
          .setTitle(`${x + 1}. ${result.character.name}`)
          .setDescription(
            `Banner: **${pull.banner.name}**\n` +
            `Anime: **${result.character.anime}**\n` +
            `Rarity: **${result.character.rarity}**\n` +
            `Power: **${result.card.power}**\n` +
            `Level: **${result.card.level || 1}/99**\n` +
            characterStatsText(result.card, result.character) + `\n` +
            `${result.guaranteed ? '✅ **Guaranteed SECRET triggered!**' : ''}`
          )
          .setColor(embedColor(aura.color));

        try {
          const png = await renderCard({ card: result.card, character: result.character });
          const fileName = `banner-${x + 1}.png`;
          const file = new AttachmentBuilder(png, { name: fileName });
          embed.setImage(`attachment://${fileName}`);
          files.push(file);
        } catch (_) {
          if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        }

        embeds.push(embed);
      }

      return i.editReply({
        embeds: embeds.slice(0, 10),
        files: files.slice(0, 10),
        content:
          `🎯 **${pull.banner.name} Pull x${pull.results.length}**\n` +
          `Cost: **${pull.cost} Tokens** • Pity: **${pull.pity}/20**\n\n` +
          lines.join('\n')
      });
    }



    if (commandName === 'class-tower') {
      await i.deferReply();

      const element = i.options.getString('element', true);
      const progress = await getOrCreateProgress(userId);
      const requiredTeams = teamRequirementFor('tower', progress);
      const teams = await getUserTeams(userId, requiredTeams);
      const allCards = teams.flat();
      const matching = allCards.filter(c => phase2Normalize(characterElement(c.character)) === phase2Normalize(element));

      if (matching.length < requiredTeams) {
        return i.editReply(`You need more **${element}** characters in your teams. Required teams: **${requiredTeams}**.`);
      }

      const power = matching.reduce((sum, c) => sum + Number(c.power || 0), 0);
      const required = Math.floor((1500 + progress.towerFloor * 500) * enemyTeamMultiplier(requiredTeams));
      const won = power >= required || Math.random() < Math.min(0.20, power / Math.max(1, required) / 4);

      if (!won) {
        return i.editReply(
          `**${element} Tower** Floor ${progress.towerFloor}\n` +
          `Element Power: **${money(power)}**\n` +
          `Required: **${money(required)}**\n` +
          `Result: **Defeat**`
        );
      }

      await prisma.storyProgress.update({
        where: { userId },
        data: { towerFloor: progress.towerFloor + 1 }
      });

      const gold = Math.floor(required * 0.7);
      const tokens = progress.towerFloor % 5 === 0 ? Math.max(1, Math.floor(progress.towerFloor / 5)) * 4 : 0;

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: gold },
          tokens: { increment: tokens }
        }
      });

      return i.editReply(
        `**${element} Tower Victory!**\n` +
        `Floor cleared: **${progress.towerFloor}**\n` +
        `Teams Required: **${requiredTeams}**\n` +
        `Rewards: **${money(gold)} Gold**, **${tokens} Tokens**`
      );
    }

    if (commandName === 'auto-story' || commandName === 'auto-tower' || commandName === 'auto-dungeon') {
      await i.deferReply();
      const mode = commandName.replace('auto-', '');
      const maxRuns = Math.max(1, Math.min(25, i.options.getInteger('runs') || 10));
      let text = `**AUTO ${mode.toUpperCase()} STARTED**\n`;
      let wins = 0;

      for (let run = 1; run <= maxRuns; run++) {
        const progress = await getOrCreateProgress(userId);
        const requiredTeams = teamRequirementFor(mode, progress);
        const teamData = await getMultiTeamPower(userId, requiredTeams);
        const storyIndex = ((progress.chapter - 1) * 30) + progress.stage;
        const baseRequired = mode === 'story'
          ? 700 + storyIndex * 260
          : mode === 'tower'
            ? 1200 + progress.towerFloor * 420
            : 900 + progress.dungeonFloor * 330;
        const required = Math.floor(baseRequired * enemyTeamMultiplier(requiredTeams));
        const won = teamData.power >= required || Math.random() < Math.min(0.25, teamData.power / Math.max(1, required) / 4);

        text += `\nRun ${run}: ${getProgressTitle(mode, progress)} | Teams ${requiredTeams} | Power ${money(teamData.power)} vs ${money(required)} → ${won ? 'WIN' : 'LOSE'}`;

        if (!won) break;

        wins++;
        const progressNumber = mode === 'story'
          ? (((progress.chapter - 1) * 30) + progress.stage)
          : mode === 'tower'
            ? progress.towerFloor
            : progress.dungeonFloor;
        const gold = Math.floor(required * 0.55);
        const tokens = progressNumber % 5 === 0 ? Math.max(1, Math.floor(progressNumber / 5)) * (mode === 'story' ? 5 : 4) : 0;

        await prisma.user.update({
          where: { id: userId },
          data: {
            gold: { increment: gold },
            tokens: { increment: tokens },
            rolls: { increment: 1 }
          }
        });

        await updateProgressAfterWin(userId, mode, progress);

        if (run % 3 === 0) await i.editReply(text.slice(-1900)).catch(() => {});
      }

      text += `\n\nFinished. Wins: **${wins}**`;
      return i.editReply(text.slice(-1900));
    }

    if (commandName === 'story' || commandName === 'dungeon' || commandName === 'tower') {
      const action = i.options.getString('action') || 'info';
      const mode = commandName;
      const progress = await getOrCreateProgress(userId);
      const teamPower = await getTeamPower(userId);

      const storyIndex = ((progress.chapter - 1) * 30) + progress.stage;
      const required = mode === 'story'
        ? 700 + storyIndex * 260
        : mode === 'tower'
          ? 1200 + progress.towerFloor * 420
          : 900 + progress.dungeonFloor * 330;

      if (action === 'start') return runProgressBattle(i, mode);

      return i.reply(
        `**${mode.toUpperCase()}**\n` +
        `Current: **${getProgressTitle(mode, progress)}**\n` +
        `Your Team Power: **${money(teamPower)}**\n` +
        `Recommended Power: **${money(required)}**\n\n` +
        `Use **/${mode} action:start** to fight.`
      );
    }

    if (commandName === 'farm-claim') {
      await i.deferReply();
      const r = await passiveFarmClaim(userId);
      const xpResult = await addUserXp(userId, r.hours * 10, 'passive farm');
      return i.editReply(
        `**Passive Farm Claimed**\n` +
        `Farmed Hours: **${r.hours}h**\n` +
        `Team Power: **${money(r.teamPower)}**\n` +
        `Gold: **${money(r.gold)}**\n` +
        `Tokens: **${r.tokens}**\n` +
        `Rolls: **${r.rolls}**` + levelUpText(xpResult)
      );
    }

    if (commandName === 'gold-shop') {
      return i.reply(
        `**GOLD SHOP**\n\n` +
        `rolls_5 = 5 Rolls → **6,000 Gold**\n` +
        `rolls_10 = 10 Rolls → **10,000 Gold**\n` +
        `rolls_25 = 25 Rolls → **22,000 Gold**\n` +
        `token_1 = 1 Token → **10,000 Gold**\n\n` +
        `legendary_orb → **300,000 Gold**\n` +
        `mythic_orb → **900,000 Gold**\n` +
        `divine_orb → **2,500,000 Gold**\n` +
        `secret_orb → **9,000,000 Gold**\n\n` +
        `Use /gold-buy item:<item>.`
      );
    }

    if (commandName === 'gold-buy') {
      await i.deferReply();

      const itemKey = i.options.getString('item', true);
      const item = GOLD_SHOP_ITEMS[itemKey];

      if (!item) return i.editReply('Invalid gold shop item. Use /gold-shop.');

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < item.gold) {
        return i.editReply(`You need **${money(item.gold)} Gold** to buy **${item.name}**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { decrement: item.gold } }
      });

      if (item.tokens) {
        const updated = await prisma.user.update({ where: { id: userId }, data: { tokens: { increment: item.tokens } } });
        return i.editReply(`Bought **${item.name}** for **${money(item.gold)} Gold**.\nNew Tokens: **${updated.tokens}**`);
      }

      if (item.rolls) {
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { rolls: { increment: item.rolls } }
        });

        return i.editReply(`Bought **${item.name}** for **${money(item.gold)} Gold**.\nNew Rolls: **${updated.rolls}**`);
      }

      if (item.rarity) {
        const result = await guaranteedCharacterRoll(userId, item.rarity);
          return i.editReply(
          `**Gold Shop ${item.rarity} Roll**\n` +
          `${rarityEmoji(result.character.rarity)} **${result.character.name}** • ${result.character.anime}\n` +
          `Power: **${result.card.power}**\n` +
          `Card ID: \`${result.card.id}\``
        );
      }

      return i.editReply('Purchase completed.');
    }

    if (commandName === 'train') {
      const cardId = i.options.getString('card_id', true);
      const amount = i.options.getInteger('amount') || 1;
      const cost = trainingCost(amount);

      const card = await prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: { character: true }
      });

      if (!card) return i.reply({ content: 'Card not found in your inventory.', ephemeral: true });

      const cap = TRAIN_POWER_CAPS[card.character.rarity] || 1500;

      if (card.power >= cap) {
        return i.reply(
          `**${card.character.name}** reached the power cap for **${card.character.rarity}**.\n` +
          `Cap: **${cap} Power**\n` +
          `Use **/ascend** to raise rarity and continue training.`
        );
      }

      const allowedGain = Math.max(0, cap - card.power);
      const finalGain = Math.min(cost.powerGain, allowedGain);
      const finalGold = Math.ceil(cost.gold * (finalGain / Math.max(1, cost.powerGain)));
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < finalGold) {
        return i.reply(`You need **${money(finalGold)} Gold** for this training.\nPower Gain: **+${finalGain}**`);
      }

      await prisma.user.update({ where: { id: userId }, data: { gold: { decrement: finalGold } } });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: { increment: finalGain } },
        include: { character: true }
      });

      const capText = updated.power >= cap ? `\nPower cap reached. Use **/ascend** to continue.` : '';

      const xpResult = await addUserXp(userId, Math.max(5, Math.floor(finalGain / 60)), 'training');

      return i.reply(
        `**TRAINING COMPLETE**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** gained **+${finalGain} Power**.\n` +
        `Cost: **${money(finalGold)} Gold**\n` +
        `New Power: **${updated.power}/${cap}**${capText}` + levelUpText(xpResult)
      );
    }

    if (commandName === 'core-shop') {
      return i.reply(
        `**core MARKET**\n\n` +
        `Legendary core Roll: **100 tokens**\n` +
        `Mythic core Roll: **250 tokens**\n` +
        `Divine core Roll: **350 tokens**\n` +
        `Secret core Roll: **500 tokens**\n\n` +
        `Use /core-roll rarity:<rarity>.`
      );
    }

    if (commandName === 'core-roll') {
      await i.deferReply();

      const rarityKey = i.options.getString('rarity', true);
      const cfg = ORB_ROLL_COSTS[rarityKey];

      if (!cfg) return i.editReply('Invalid core rarity.');

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.tokens || 0) < cfg.tokens) {
        return i.editReply(`You need **${cfg.tokens} tokens** for this guaranteed roll.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { tokens: { decrement: cfg.tokens } }
      });

      const result = await guaranteedCharacterRoll(userId, cfg.rarity);
      return i.editReply(
        `**Guaranteed ${cfg.rarity} core Roll**\n` +
        `${rarityEmoji(result.character.rarity)} **${result.character.name}** • ${result.character.anime}\n` +
        `Power: **${result.card.power}**\n` +
        `Card ID: \`${result.card.id}\``
      );
    }

    if (commandName === 'ascend') {
      const cardId = i.options.getString('card_id', true);
      const target = i.options.getString('rarity', true);
      const cfg = RARITY_UPGRADE_COSTS[target];

      if (!cfg) return i.reply({ content: 'Invalid rarity.', ephemeral: true });

      const card = await prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: { character: true }
      });

      if (!card) return i.reply({ content: 'Card not found.', ephemeral: true });

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cfg.gold || (user.tokens || 0) < cfg.tokens) {
        return i.reply(`You need **${money(cfg.gold)} gold** and **${cfg.tokens} tokens** to ascend to **${target}**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { decrement: cfg.gold },
          tokens: { decrement: cfg.tokens }
        }
      });

      await prisma.character.update({
        where: { id: card.characterId },
        data: {
          rarity: target,
          basePower: Math.max(card.character.basePower || 0, cfg.power)
        }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: Math.max(card.power || 0, cfg.power + Math.floor(Math.random() * 500)) },
        include: { character: true }
      });

      return i.reply(`**ASCENSION COMPLETE**\n${updated.character.name} is now **${target}**.\nNew Power: **${updated.power}**`);
    }

    if (commandName === 'autoteam') {
      const count = Math.max(1, Math.min(6, i.options.getInteger('teams') || 1));
      const cards = await autoBuildTeams(userId, count);

      if (!cards.length) return i.reply('You do not have any cards yet.');

      const lines = [];
      for (let t = 1; t <= count; t++) {
        const teamCards = cards.slice((t - 1) * 5, t * 5);
        lines.push(`\n**Team ${t}**`);
        lines.push(...teamCards.map((c, idx) => `Slot ${idx + 1}: ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${money(c.power)}`));
      }

      return i.reply((`**Auto Teams Equipped!**\n` + lines.join('\n')).slice(0, 1900));
    }

    if (commandName === 'teams') {
      const count = Math.max(1, Math.min(6, i.options.getInteger('count') || 6));
      const teams = await getUserTeams(userId, count);
      const lines = [];

      for (let t = 1; t <= count; t++) {
        const team = teams[t - 1] || [];
        const syn = calculateSynergies(team);
        lines.push(`\n**Team ${t}** • Power ${money(team.reduce((s,c)=>s+Number(c.power||0),0))}`);
        if (syn.active.length) lines.push(`Synergy: ${syn.active.map(x => x.name).join(', ')}`);
        lines.push(...team.map((c, idx) => `${idx + 1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • ${characterRole(c.character)} • ${characterElement(c.character)} • PWR ${money(c.power)}`));
      }

      return i.reply(lines.join('\n').slice(0, 1900));
    }

    if (commandName === 'synergy') {
      const cards = await getUserBattleTeam(userId);
      const syn = calculateSynergies(cards);

      if (!syn.active.length) return i.reply('No active synergies in your main team.');

      return i.reply(
        `**Active Synergies**\n` +
        syn.active.map(s => `• **${s.name}**`).join('\n') +
        `\n\nEstimated Bonus Score: **${Math.round(syn.bonus * 100)}%**`
      );
    }

    if (commandName === 'pvp') {
      const target = i.options.getUser('user', true);
      if (target.bot) return i.reply({ content: 'You cannot PVP bots.', ephemeral: true });
      if (target.id === userId) return i.reply({ content: 'You cannot PVP yourself.', ephemeral: true });

      await ensureUser(target);
      const myPower = await getTeamPower(userId);
      const theirPower = await getTeamPower(target.id);
      if (myPower <= 0) return i.reply('You need cards to PVP.');

      let text = `**PVP BATTLE**\n<@${userId}> vs <@${target.id}>\nYour Power: **${money(myPower)}**\n${target.username} Power: **${money(theirPower)}**\n\n`;
      await i.reply(text + 'Battle starting...');
      const msg = await i.fetchReply();

      let myMana = 0;
      let theirMana = 0;
      for (let r = 1; r <= 5; r++) {
        const myHit = Math.floor(myPower / (8 + r) + Math.random() * 250);
        const theirHit = Math.floor(theirPower / (8 + r) + Math.random() * 250);
        myMana += 25 + Math.floor(Math.random() * 20);
        theirMana += 25 + Math.floor(Math.random() * 20);
        text += `\n__Round ${r}__\n<@${userId}> hits for **${money(myHit)}**. Mana ${Math.min(100, myMana)}/100\n`;
        if (myMana >= 100) { text += `<@${userId}> **ULTIMATE** for **${money(myHit * 2)}**!\n`; myMana = 0; }
        text += `<@${target.id}> hits for **${money(theirHit)}**. Mana ${Math.min(100, theirMana)}/100\n`;
        if (theirMana >= 100) { text += `<@${target.id}> **ULTIMATE** for **${money(theirHit * 2)}**!\n`; theirMana = 0; }
        await new Promise(resolve => setTimeout(resolve, 1000));
        await msg.edit(text.slice(-1900)).catch(() => {});
      }

      const myScore = myPower * (0.85 + Math.random() * 0.35);
      const theirScore = theirPower * (0.85 + Math.random() * 0.35);
      const winnerId = myScore >= theirScore ? userId : target.id;
      const loserId = winnerId === userId ? target.id : userId;

      await prisma.user.update({ where: { id: winnerId }, data: { xp: { increment: 25 }, gold: { increment: 5000 } } }).catch(() => {});
      await prisma.user.update({ where: { id: loserId }, data: { xp: { decrement: 10 } } }).catch(() => {});

      const winner = await prisma.user.findUnique({ where: { id: winnerId } });
      text += `\n**PVP RESULT**\nWinner: <@${winnerId}>\nRank: **${pvpRank(winner?.xp || 0)}**\nRewards: **5,000 Gold + 25 Rank Points**`;
      return msg.edit(text.slice(-1900)).catch(() => {});
    }

    if (commandName === 'trade') {
      const target = i.options.getUser('user', true);
      const offerCardId = i.options.getString('my_card', true);
      const requestCardId = i.options.getString('their_card', true);

      if (target.bot) return i.reply({ content: 'You cannot trade with bots.', ephemeral: true });
      if (target.id === userId) return i.reply({ content: 'You cannot trade with yourself.', ephemeral: true });

      const offerCard = await prisma.userCard.findFirst({
        where: { id: offerCardId, userId },
        include: { character: true }
      });

      if (!offerCard) return i.reply({ content: 'Your offered card was not found in your inventory.', ephemeral: true });

      const requestCard = await prisma.userCard.findFirst({
        where: { id: requestCardId, userId: target.id },
        include: { character: true }
      });

      if (!requestCard) return i.reply({ content: 'The requested card was not found in that player inventory.', ephemeral: true });

      const tradeId = nanoid(10);

      pendingTrades.set(tradeId, {
        id: tradeId,
        offerUserId: userId,
        targetId: target.id,
        offerCardId,
        requestCardId,
        createdAt: Date.now()
      });

      setTimeout(() => pendingTrades.delete(tradeId), 5 * 60 * 1000);

      const embed = new EmbedBuilder()
        .setTitle('Trade Offer')
        .setDescription(
          `<@${userId}> wants to trade with <@${target.id}>.\n\n` +
          `**${i.user.username} gives:**\n` +
          `${rarityEmoji(offerCard.character.rarity)} **${offerCard.character.name}** • ${offerCard.character.rarity} • PWR ${offerCard.power}\n\n` +
          `**${target.username} gives:**\n` +
          `${rarityEmoji(requestCard.character.rarity)} **${requestCard.character.name}** • ${requestCard.character.rarity} • PWR ${requestCard.power}\n\n` +
          `Only <@${target.id}> can accept or decline.\n` +
          `Expires in 5 minutes.`
        )
        .setColor(0x22c55e);

      if (offerCard.character.imageUrl) embed.setThumbnail(offerCard.character.imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${tradeId}`)
          .setLabel('Accept Trade')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_decline_${tradeId}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

      return i.reply({
        content: `<@${target.id}> عندك عرض مقايضة.`,
        embeds: [embed],
        components: [row]
      });
    }

    if (commandName === 'transfer' || commandName === 'market') {
      const items = await market.latest(10);
      if (!items.length) return i.reply('The Transfer Market is currently empty.');
      return i.reply(('**TRANSFER MARKET**\n\n' + items.map(x => `${x.id} • ${x.card.character.name} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n')).slice(0, 1900));
    }

    if (commandName === 'sell' || commandName === 'list') {
      const cardId = i.options.getString('card_id', true);
      const price = i.options.getInteger('price', true);

      const card = await prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: { character: true }
      });

      if (!card) return i.reply({ content: 'Card not found in your inventory.', ephemeral: true });

      const [min, max] = priceRange(card.character.rarity);

      if (price < min || price > max) {
        return i.reply({ content: `Price range for ${card.character.rarity}: ${money(min)} - ${money(max)} gold.`, ephemeral: true });
      }

      const l = await market.sell(userId, cardId, price);
      return i.reply(`Listed on Transfer Market.\nListing ID: ${l.id}\nPrice: ${money(price)} gold`);
    }

    if (commandName === 'buy') {
      const listingId = i.options.getString('listing_id', true);
      const r = await market.buy(userId, listingId);
      return i.reply(`Purchase complete.\nMarket tax: ${money(r.tax)} gold.`);
    }

    if (commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);

      return i.reply(
        r.success
          ? `Upgrade successful. Equipment is now +${r.nextLevel}.`
          : `Upgrade failed. You lost ${money(r.cost)} gold.`
      );
    }

    if (commandName === 'admin-spawn-boss') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const channel = i.options.getChannel('channel', true);

      if (!channel || !channel.isTextBased()) {
        return i.reply({ content: 'Choose a text channel.', ephemeral: true });
      }

      const boss = await sendBossAnnouncement(channel);
      return i.reply({ content: `Boss spawned in ${channel}: **${boss.bossName}**`, ephemeral: true });
    }


    if (commandName === 'admin-repair-rewards') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const users = await prisma.user.findMany({ select: { id: true } });
      const gold = i.options.getInteger('gold') || 500000;
      const tokens = i.options.getInteger('tokens') || 50;
      const rolls = i.options.getInteger('rolls') || 50;

      for (const u of users) {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            gold: { increment: gold },
            tokens: { increment: tokens },
            rolls: { increment: rolls }
          }
        }).catch(() => {});
      }

      return i.reply(`Repair rewards sent to **${users.length}** users: ${money(gold)} gold, ${tokens} tokens, ${rolls} rolls.`);
    }



    if (commandName === 'lvl') {
      const name = i.options.getString('name') || i.options.getString('card_id');
      const amount = i.options.getInteger('amount') || 1;
      const card = await phase2FindUserCardByName(userId, name);
      const cost = Math.max(1, amount) * 2500;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost) {
        return i.reply(`You need **${money(cost)} Gold** to level up **${card.character.name}**.`);
      }

      await prisma.user.update({ where: { id: userId }, data: { gold: { decrement: cost } } });
      const updated = await addCardLevel(card.id, amount);

      return i.reply(
        `📈 **LEVEL UP**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** is now Level **${updated.level}/99**.\n` +
        `Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 't') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const cost = trainingCost(amount);

      const card = await findUserCardByName(userId, name);
      const cap = typeof TRAIN_POWER_CAPS !== 'undefined'
        ? (TRAIN_POWER_CAPS[card.character.rarity] || 1500)
        : 999999999;

      if (card.power >= cap) {
        return i.reply(
          `**${card.character.name}** reached the power cap for **${card.character.rarity}**.\n` +
          `Cap: **${cap} Power**\n` +
          `Use **/a name:${card.character.name} rarity:<next rarity>** to continue.`
        );
      }

      const allowedGain = Math.max(0, cap - card.power);
      const finalGain = Math.min(cost.powerGain, allowedGain);
      const finalGold = Math.ceil(cost.gold * (finalGain / Math.max(1, cost.powerGain)));

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < finalGold) {
        return i.reply(`You need **${money(finalGold)} Gold** for this training.\nPower Gain: **+${finalGain}**`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { decrement: finalGold } }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: { increment: finalGain } },
        include: { character: true }
      });

      return i.reply(
        `🏋️ **TRAINING COMPLETE**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** gained **+${finalGain} Power**.\n` +
        `Cost: **${money(finalGold)} Gold**\n` +
        `New Power: **${updated.power}/${cap}**`
      );
    }

    if (commandName === 'a') {
      const name = i.options.getString('name', true);
      const target = i.options.getString('rarity', true);
      const cfg = RARITY_UPGRADE_COSTS[target];

      if (!cfg) return i.reply({ content: 'Invalid rarity.', ephemeral: true });

      const card = await findUserCardByName(userId, name);
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cfg.gold || (user.tokens || 0) < cfg.tokens) {
        return i.reply(`You need **${money(cfg.gold)} gold** and **${cfg.tokens} tokens** to ascend **${card.character.name}** to **${target}**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { decrement: cfg.gold },
          tokens: { decrement: cfg.tokens }
        }
      });

      await prisma.character.update({
        where: { id: card.characterId },
        data: {
          rarity: target,
          basePower: Math.max(card.character.basePower || 0, cfg.power)
        }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: {
          power: Math.max(card.power || 0, cfg.power + Math.floor(Math.random() * 500))
        },
        include: { character: true }
      });

      return i.reply(
        `✨ **ASCENSION COMPLETE**\n` +
        `**${updated.character.name}** is now **${target}**.\n` +
        `New Power: **${updated.power}**`
      );
    }

    if (commandName === 'sell-rarity') {
      const rarity = i.options.getString('rarity', true);
      const result = await sellAllByRarity(userId, rarity);

      if (!result.sold) {
        return i.reply(`You do not have any **${result.rarity}** cards to sell.`);
      }

      return i.reply(
        `💰 **SOLD ${result.rarity} CARDS**\n` +
        `Sold: **${result.sold}** cards\n` +
        `Gold earned: **${money(result.gold)}**`
      );
    }

    if (commandName === 'admin-give-gold') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { gold: { increment: amount } }
      });

      return i.reply(`Added **${money(amount)} gold** to **${target.username}**.\nNew gold: **${money(updated.gold)}**`);
    }

    if (commandName === 'admin-give-tokens') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { tokens: { increment: amount } }
      });

      return i.reply(`Added **${amount} tokens** to **${target.username}**.\nNew tokens: **${updated.tokens}**`);
    }


    if (commandName === 'fuse-list') {
      const list = await phase2FuseList(userId);

      if (!list.length) {
        return i.reply('You do not have duplicate characters ready to fuse.');
      }

      return i.reply(
        (`**FUSION READY**\n\n` +
        list.slice(0, 30).map(x =>
          `${rarityEmoji(x.rarity)} **${x.name}** x${x.count} • Max PWR ${money(x.maxPower)}`
        ).join('\n')).slice(0, 1900)
      );
    }

    if (commandName === 'fuse') {
      const name = i.options.getString('name', true);
      const result = await phase2FuseByName(userId, name);

      if (!result.fused) return i.reply(result.message);

      return i.reply(
        `⭐ **FUSION COMPLETE**\n` +
        `**${result.name}**: ⭐${result.oldStars} → ⭐${result.newStars}\n` +
        `Power gained: **+${money(result.powerGain)}**`
      );
    }


    if (commandName === 'lvl') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const card = await phase2FindUserCardByName(userId, name);
      const cost = Math.max(1, amount) * 2500;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost) {
        return i.reply(`You need **${money(cost)} Gold** to level up **${card.character.name}**.`);
      }

      await prisma.user.update({ where: { id: userId }, data: { gold: { decrement: cost } } });
      const updated = await addCardLevel(card.id, amount);

      return i.reply(
        `📈 **LEVEL UP**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** is now Level **${updated.level}/99**.\n` +
        `Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 't') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const cost = trainingCost(amount);
      const card = await phase2FindUserCardByName(userId, name);

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost.gold) {
        return i.reply(`You need **${money(cost.gold)} Gold** for this training.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { decrement: cost.gold } }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: { increment: cost.powerGain } },
        include: { character: true }
      });

      return i.reply(
        `🏋️ **TRAINING COMPLETE**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}${phase2StarLabel(updated)}** gained **+${money(cost.powerGain)} Power**.\n` +
        `New Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 'a') {
      const name = i.options.getString('name', true);
      const target = i.options.getString('rarity', true);
      const cfg = RARITY_UPGRADE_COSTS[target];

      if (!cfg) return i.reply({ content: 'Invalid rarity.', ephemeral: true });

      const card = await phase2FindUserCardByName(userId, name);
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cfg.gold || (user.tokens || 0) < cfg.tokens) {
        return i.reply(`You need **${money(cfg.gold)} gold** and **${cfg.tokens} tokens**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { decrement: cfg.gold },
          tokens: { decrement: cfg.tokens }
        }
      });

      await prisma.character.update({
        where: { id: card.characterId },
        data: {
          rarity: target,
          basePower: Math.max(card.character.basePower || 0, cfg.power)
        }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: {
          power: Math.max(card.power || 0, cfg.power + Math.floor(Math.random() * 500))
        },
        include: { character: true }
      });

      return i.reply(
        `✨ **ASCENSION COMPLETE**\n` +
        `**${updated.character.name}** is now **${target}**.\n` +
        `New Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 'sell-rarity') {
      const rarity = i.options.getString('rarity', true);
      const result = await phase2SellAllByRarity(userId, rarity);

      if (!result.sold) return i.reply(`You do not have any **${result.rarity}** cards.`);

      return i.reply(
        `💰 **SOLD ${result.rarity} CARDS**\n` +
        `Sold: **${result.sold}**\n` +
        `Gold earned: **${money(result.gold)}**`
      );
    }

    if (commandName === 'admin-give-gold') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);
      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { gold: { increment: amount } }
      });

      return i.reply(`Added **${money(amount)} gold** to **${target.username}**. New gold: **${money(updated.gold)}**`);
    }

    if (commandName === 'admin-give-tokens') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);
      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { tokens: { increment: amount } }
      });

      return i.reply(`Added **${amount} tokens** to **${target.username}**. New tokens: **${updated.tokens}**`);
    }

    if (commandName === 'admin-reset-all') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const confirm = i.options.getString('confirm', true);

      if (confirm !== 'YES') {
        return i.reply({ content: 'Type confirm:YES to reset all players.', ephemeral: true });
      }

      await prisma.$transaction([
        prisma.teamSlot.deleteMany({}),
        prisma.marketListing.deleteMany({}),
        prisma.userEquipment.deleteMany({}),
        prisma.userCard.deleteMany({}),
        prisma.storyProgress.deleteMany({}),
        prisma.user.updateMany({
          data: {
            gold: 0,
            tokens: 0,
            rolls: 10,
            xp: 0,
            level: 1
          }
        })
      ]);

      return i.reply('⚠️ **RESET ALL COMPLETE**');
    }

    if (commandName === 'admin-give-rolls') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      if (amount <= 0) return i.reply({ content: 'Amount must be greater than 0.', ephemeral: true });

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { rolls: { increment: amount } }
      });

      return i.reply(`Added **${amount} rolls** to **${target.username}**.\nNew rolls balance: **${updated.rolls}**`);
    }

    if (commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const eq = await equipment.dropEquipment(userId, i.options.getString('rarity') || 'COMMON');
      return i.reply(eq ? `Equipment granted: ${eq.id}` : 'No equipment template exists for this rarity.');
    }

    if (commandName === 'events') {
      return i.reply(
        `**ACTIVE EVENTS**\n` +
        `Boss events can spawn automatically in the configured channel.\n` +
        `Use /admin-spawn-boss to force spawn one.`
      );
    }

    if (commandName === 'quests') {
      return i.reply(
        `**QUESTS**\n` +
        `Roll 10 cards → 5 Tokens\n` +
        `Clear dungeon → 10 Tokens\n` +
        `Defeat boss → 25 Tokens\n` +
        `Train characters with gold to grow stronger.`
      );
    }
  } catch (err) {
    console.error(err);

    if (i.deferred || i.replied) {
      return i.editReply({ content: `Error: ${err.message}` }).catch(() => {});
    }

    return i.reply({ content: `Error: ${err.message}`, ephemeral: true }).catch(() => {});
  }
});

const app = express();

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

app.listen(config.port, () => console.log(`Health server on ${config.port}`));

if (!config.token) throw new Error('DISCORD_TOKEN missing');

client.login(config.token);
