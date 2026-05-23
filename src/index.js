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
const { autoFuseDuplicates, fusionText, starLabel } = require('./services/duplicateFusion');
const { isSecretCandidate, classifyCharacter } = require('./lib/secretCharacters');
const { syncAllCardPowers } = require('./powerSyncPatch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const activeBosses = new Map();
const pendingTrades = new Map();

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
  legendary_orb: { name: 'Legendary Orb Roll', gold: 300000, rarity: 'LEGENDARY' },
  mythic_orb: { name: 'Mythic Orb Roll', gold: 900000, rarity: 'MYTHIC' },
  divine_orb: { name: 'Divine Orb Roll', gold: 2500000, rarity: 'DIVINE' },
  secret_orb: { name: 'Secret Orb Roll', gold: 9000000, rarity: 'SECRET' }
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

async function applySecretCharacterBoosts() {
  const chars = await prisma.character.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      anime: true,
      rarity: true,
      basePower: true,
      baseFarm: true,
      baseLuck: true
    }
  });

  let updated = 0;

  for (const c of chars) {
    const cls = classifyCharacter(c);

    if (!cls) continue;

    // نعدل قوة الشخصية الأساسية فقط.
    // كروت اللاعبين القديمة محمية في syncAllCardPowers ولا تنقص.
    const newPower = cls.power;

    await prisma.character.update({
      where: { id: c.id },
      data: {
        rarity: cls.rarity,
        basePower: newPower,
        baseFarm: Math.floor(newPower / 8),
        baseLuck: Math.floor(newPower / 20)
      }
    });

    updated++;
  }

  console.log(`Safe rarity/base power balance updated: ${updated}`);
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

    if (nextChapter > 60) {
      nextChapter = 60;
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
  const teamPower = await getTeamPower(userId);

  const storyIndex = ((progress.chapter - 1) * 30) + progress.stage;
  const required = mode === 'story'
    ? 700 + storyIndex * 260
    : mode === 'tower'
      ? 1200 + progress.towerFloor * 420
      : 900 + progress.dungeonFloor * 330;

  const enemies = await getAnimeEnemies(5, Math.max(0, required / 8));
  let allyMana = 0;
  let enemyMana = 0;

  let text =
    `**${mode.toUpperCase()} BATTLE STARTED**\n` +
    `${getProgressTitle(mode, progress)}\n` +
    `Team Power: **${money(teamPower)}**\n` +
    `Required Power: **${money(required)}**\n` +
    `Enemies: **${enemies.join(', ')}**\n\n`;

  await interaction.editReply(text + 'Battle is starting...');

  for (let r = 1; r <= 7; r++) {
    const enemy = enemies[(r - 1) % enemies.length];
    const hit = Math.max(50, Math.floor(teamPower / (7 + r) + Math.random() * 350));
    const enemyHit = Math.max(30, Math.floor(required / (11 + r) + Math.random() * 220));

    allyMana += 24 + Math.floor(Math.random() * 20);
    enemyMana += 17 + Math.floor(Math.random() * 18);

    text += `\n__Round ${r}__\n`;
    text += `Your team hit **${enemy}** for **${money(hit)}**. Mana: ${Math.min(100, allyMana)}/100\n`;

    if (allyMana >= 100) {
      const ult = Math.floor(hit * 2.6);
      text += `**TEAM ULTIMATE!** Massive finisher dealt **${money(ult)}** damage!\n`;
      allyMana = 0;
    }

    text += `**${enemy}** hit back for **${money(enemyHit)}**. Enemy Mana: ${Math.min(100, enemyMana)}/100\n`;

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
  const tokens = mode === 'tower' ? 3 : mode === 'story' ? 4 : 3;
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
  await applySecretCharacterBoosts().catch(e => console.error('Secret boost failed:', e));
  await syncAllCardPowers(prisma).catch(e => console.error('Power sync failed:', e));

  const firstBossDelay = Number(process.env.BOSS_EVENT_FIRST_DELAY_SECONDS || 90) * 1000;
  const bossInterval = Number(process.env.BOSS_EVENT_INTERVAL_MINUTES || 60) * 60 * 1000;
  setTimeout(autoBossLoop, firstBossDelay);
  setInterval(autoBossLoop, bossInterval);
});

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      await ensureUser(i.user);
      await autoFuseDuplicates(prisma, i.user.id).catch(() => []);

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
    const fusionResultsAtStart = await autoFuseDuplicates(prisma, userId).catch(() => []);
    const commandName = i.commandName;
    const fusionResults = await autoFuseDuplicates(prisma, userId).catch(() => []);

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
        `/orb-shop /orb-roll /ascend - Upgrade and guaranteed rolls\n` +
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
          `Cost: **10 Tokens** per pull • Guaranteed: **20 pulls / 200 tokens**\n` +
          `Your pity: **${pity}/20**\n` +
          `Ends: <t:${Math.floor(b.endsAt.getTime() / 1000)}:R>\n` +
          `Pool: ${b.pool.join(', ')}\n`
        );
      }

      return i.reply(
        `🎯 **ACTIVE LIMITED BANNERS**\n\n` +
        lines.join('\n') +
        `\nUse **/pack banner:<id> amount:<1-10>**. Anime packs and Secret Pack are removed.`
      );
    }

    if (commandName === 'pack') {
      await i.deferReply();

      const bannerId = i.options.getString('banner', true);
      const amount = i.options.getInteger('amount') || 1;
      const pull = await bannerSystem.rollBanner(prisma, userId, bannerId, amount);

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
            `${result.guaranteed ? '✅ **Guaranteed featured triggered!**' : ''}`
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

    if (commandName === 'orb-shop') {
      return i.reply(
        `**ORB MARKET**\n\n` +
        `Legendary Orb Roll: **100 tokens**\n` +
        `Mythic Orb Roll: **250 tokens**\n` +
        `Divine Orb Roll: **350 tokens**\n` +
        `Secret Orb Roll: **500 tokens**\n\n` +
        `Use /orb-roll rarity:<rarity>.`
      );
    }

    if (commandName === 'orb-roll') {
      await i.deferReply();

      const rarityKey = i.options.getString('rarity', true);
      const cfg = ORB_ROLL_COSTS[rarityKey];

      if (!cfg) return i.editReply('Invalid orb rarity.');

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
        `**Guaranteed ${cfg.rarity} Orb Roll**\n` +
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
      const cards = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { power: 'desc' },
        take: 5
      });

      if (!cards.length) return i.reply('You do not have any cards yet.');

      await prisma.teamSlot.deleteMany({ where: { userId } });

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

      return i.reply(
        `**Auto Team Equipped!**\n\n` +
        cards.map((c, idx) => `Slot ${idx + 1}: ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${c.power}`).join('\n')
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
