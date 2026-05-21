require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ChannelType,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

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
const { renderItemCard } = require('./services/itemCardRender');
const { isSecretCandidate } = require('./lib/secretCharacters');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function money(n) {
  return Number(n || 0).toLocaleString('en-US');
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
    if (!isSecretCandidate(c)) continue;

    const newPower = Math.max(c.basePower || 0, 10000);

    await prisma.character.update({
      where: { id: c.id },
      data: {
        rarity: 'SECRET',
        basePower: newPower,
        baseFarm: Math.max(c.baseFarm || 0, Math.floor(newPower / 8)),
        baseLuck: Math.max(c.baseLuck || 0, Math.floor(newPower / 20))
      }
    });

    updated++;
  }

  console.log(`Secret characters updated: ${updated}`);
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

const PACK_WEIGHTS = {
  COMMON: 720000,
  RARE: 220000,
  EPIC: 56500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

async function createCardForUser(userId, character) {
  const updated = await prisma.character.update({
    where: { id: character.id },
    data: { globalPrint: { increment: 1 } }
  });

  const shiny = Math.random() < 0.015;
  const power = Math.round((updated.basePower || 100) * (shiny ? 1.35 : 1) + Math.random() * 80);

  const card = await prisma.userCard.create({
    data: {
      id: require('nanoid').nanoid(12),
      userId,
      characterId: updated.id,
      serial: updated.globalPrint,
      power,
      shiny
    }
  });

  return { card, character: updated };
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
      return c.rarity === 'SECRET' ? 1000000 : 1;
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
    take: 200
  });

  if (!cards.length) return { empty: true };

  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const c = cards[safeIndex];
  const aura = getAura(c.character);

  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.character.rarity)} ${c.character.name}`)
    .setDescription(
      `🎌 Anime: **${c.character.anime}**\n` +
      `💎 Rarity: **${c.character.rarity}**\n` +
      `⚔️ Power: **${c.power}**\n` +
      `🌌 Technique: **${aura.name}**\n` +
      `🆔 Card ID: \`${c.id}\``
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


const activeManualBosses = new Map();

function getProgressField(mode) {
  return null;
}

function getProgressTitle(mode, value, user) {
  if (mode === 'story') return `Chapter ${user.storyChapter || 1}, Stage ${value}/30`;
  if (mode === 'tower') return `Tower Floor ${value}`;
  return `Dungeon Stage ${value}`;
}


async function getUserBattleTeam(userId) {
  const teamSlots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  const fromTeam = teamSlots
    .map(s => s.card)
    .filter(Boolean)
    .slice(0, 5);

  if (fromTeam.length) return fromTeam;

  return prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 5
  });
}

async function getTeamPower(userId) {
  const team = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  if (team.length) return team.reduce((sum, s) => sum + (s.card?.power || 0), 0);

  const cards = await prisma.userCard.findMany({
    where: { userId },
    orderBy: { power: 'desc' },
    take: 5
  });

  return cards.reduce((sum, c) => sum + (c.power || 0), 0);
}

async function runProgressBattle(interaction, mode) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const current = 1;
  const teamPower = await getTeamPower(userId);
  const chapter = 1;
  const required = mode === 'story' ? 700 + ((chapter - 1) * 30 + current) * 260 : mode === 'tower' ? 1200 + current * 420 : 900 + current * 330;
  const enemies = await getAnimeEnemies(5, Math.max(0, required / 8));
  let allyMana = 0;
  let enemyMana = 0;
  const logs = [];
  logs.push(`⚔️ **${mode.toUpperCase()} BATTLE**`);
  logs.push(`📍 ${getProgressTitle(mode, current, user)}`);
  logs.push(`👥 Team Power: **${money(teamPower)}**`);
  logs.push(`👹 Required Power: **${money(required)}**`);
  logs.push('');
  logs.push(`**Enemies:** ${enemies.join(', ')}`);
  logs.push('');
  for (let r = 1; r <= 6; r++) {
    const enemy = enemies[(r - 1) % enemies.length];
    const hit = Math.max(50, Math.floor(teamPower / (7 + r) + Math.random() * 350));
    const enemyHit = Math.max(30, Math.floor(required / (11 + r) + Math.random() * 200));
    allyMana += 25 + Math.floor(Math.random() * 18);
    enemyMana += 18 + Math.floor(Math.random() * 15);
    logs.push(`⚔️ Round ${r}: Your team hit **${enemy}** for **${money(hit)}**. Mana: ${Math.min(100, allyMana)}/100`);
    if (allyMana >= 100) {
      logs.push(`🌌 **ULTIMATE ACTIVATED!** Your team unleashed a finisher for **${money(Math.floor(hit * 2.4))}** damage.`);
      allyMana = 0;
    }
    logs.push(`💢 **${enemy}** hit back for **${money(enemyHit)}**. Enemy Mana: ${Math.min(100, enemyMana)}/100`);
    if (enemyMana >= 100) {
      logs.push(`☠️ **Enemy Ultimate!** ${enemy} used a special attack for **${money(Math.floor(enemyHit * 2))}** damage.`);
      enemyMana = 0;
    }
  }
  const won = teamPower >= required || Math.random() < Math.min(0.45, teamPower / Math.max(1, required) / 3);
  if (!won) {
    logs.push('');
    logs.push('❌ Defeat. Upgrade your team, items, and rarity.');
    return interaction.editReply(logs.join('\\n').slice(0, 1900));
  }
  const gold = Math.floor(required * 0.75);
  const tokens = mode === 'tower' ? 3 : mode === 'story' ? 4 : 3;
  const rolls = mode === 'story' ? 3 : 2;
  const data = { gold: { increment: gold }, tokens: { increment: tokens }, rolls: { increment: rolls } };
  if (mode === 'story') {
    let nextStage = current + 1;
    let nextChapter = chapter;
    if (nextStage > 30) { nextStage = 1; nextChapter += 1; }
    if (nextChapter > 60) { nextChapter = 60; nextStage = 30; }
    data.storyStage = nextStage;
    data.storyChapter = nextChapter;
  } else {
    data[field] = current + 1;
  }
  await prisma.user.update({ where: { id: userId }, data });
  logs.push('');
  logs.push('✅ Victory!');
  logs.push(`🎁 Rewards: **${money(gold)} gold**, **${tokens} tokens**, **${rolls} rolls**.`);
  logs.push('➡️ Rewards saved.');
  return interaction.editReply(logs.join('\\n').slice(0, 1900));
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

  activeManualBosses.set(eventId, boss);

  const embed = new EmbedBuilder()
    .setTitle(`🚨 WORLD BOSS SPAWNED: ${bossName}`)
    .setDescription(
      `👹 Boss Power: **${money(boss.power)}**\n` +
      `❤️ Boss HP: **${money(boss.hp)}**\n` +
      `🎁 Rewards: **${money(boss.rewardGold)} gold**, **${boss.rewardTokens} tokens**, rare drops.\n\n` +
      `اضغط الزر عشان تدخل البوس.\n` +
      `القتال يبدأ تلقائيًا بعد دقيقتين، وبتشوف لوق لايف للضربات والالتات.`
    )
    .setColor(0x8b0000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`manual_boss_join_${eventId}`)
      .setLabel('Join Boss')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });


  setTimeout(async () => {
    const latest = activeManualBosses.get(eventId);
    if (!latest) return;

    await msg.edit({ components: [] }).catch(() => {});

    const players = Array.from(latest.entries);
    if (!players.length) {
      activeManualBosses.delete(eventId);
      return channel.send(`👹 **${bossName}** disappeared. No one joined.`);
    }

    const battleMsg = await channel.send(
      `👹 **BOSS FIGHT STARTED: ${bossName}**
` +
      `Players joined: **${players.length}**
` +
      `Boss HP: **${money(latest.hp)}**

` +
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
      `👹 **BOSS FIGHT: ${bossName}**
` +
      `❤️ Boss HP: **${money(bossHp)}**
` +
      `👥 Players: **${players.length}**

`;

    log += `**Teams**
`;
    for (const p of playerTeams) {
      const names = p.cards.map(c => c.character?.name || 'Unknown').join(', ');
      log += `<@${p.userId}>: ${names || 'No cards'} • PWR **${money(p.power)}**
`;
    }

    log += `
`;

    await battleMsg.edit(log.slice(-1900)).catch(() => {});

    const rounds = 7;

    for (let round = 1; round <= rounds; round++) {
      log += `
__**Round ${round}**__
`;

      for (const p of playerTeams) {
        const cards = p.cards.length ? p.cards : [{ power: 100, character: { name: 'Unknown Fighter' } }];

        for (const card of cards) {
          const name = card.character?.name || 'Unknown Fighter';
          const dmg = Math.max(50, Math.floor((card.power || 100) * (0.12 + Math.random() * 0.10)));
          bossHp -= dmg;
          p.mana += 22 + Math.floor(Math.random() * 18);

          log += `⚔️ **${name}** hit ${bossName} for **${money(dmg)}**. Mana: ${Math.min(100, p.mana)}/100
`;

          if (p.mana >= 100) {
            const ultDmg = Math.max(150, Math.floor((card.power || 100) * (0.42 + Math.random() * 0.22)));
            bossHp -= ultDmg;
            p.mana = 0;
            log += `🌌 **${name} ULTIMATE!** dealt **${money(ultDmg)}** massive damage!
`;
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
          log += `☠️ **${bossName} ULTIMATE!** crushed **${targetName}** for **${money(bossUlt)}** damage!
`;
        } else {
          const target = playerTeams[Math.floor(Math.random() * playerTeams.length)];
          const bossHit = Math.floor(latest.power * (0.025 + Math.random() * 0.025));
          log += `💢 **${bossName}** attacks <@${target.userId}> team for **${money(bossHit)}**. Boss Mana: ${bossMana}/100
`;
        }
      }

      log += `❤️ Boss HP left: **${money(Math.max(0, bossHp))}**
`;

      await new Promise(resolve => setTimeout(resolve, 1200));
      await battleMsg.edit(log.slice(-1900)).catch(() => {});

      if (bossHp <= 0) break;
    }

    const won = bossHp <= 0 || totalPower >= latest.power;

    log += `
__**Final Result**__
`;
    log += `Total Team Power: **${money(totalPower)}** / Boss Power: **${money(latest.power)}**
`;

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

      log += `✅ **Boss defeated!** Each player got **${money(goldEach)} gold**, **${tokensEach} tokens**, **5 rolls**.`;
    } else {
      log += `❌ **Boss survived.** Upgrade your team and try again.`;
    }

    activeManualBosses.delete(eventId);
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


async function getAnimeEnemies(count = 5, minPower = 0) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    orderBy: { basePower: 'desc' },
    take: 300
  });
  const pool = chars.filter(c => (c.basePower || 0) >= minPower);
  const source = pool.length ? pool : chars;
  return source.sort(() => Math.random() - 0.5).slice(0, count).map(c => c.name);
}

const RARITY_UPGRADE_COSTS = {
  RARE: { gold: 25000, tokens: 5, power: 900 },
  EPIC: { gold: 90000, tokens: 15, power: 1800 },
  LEGENDARY: { gold: 300000, tokens: 40, power: 3500 },
  MYTHIC: { gold: 900000, tokens: 100, power: 6500 },
  DIVINE: { gold: 2500000, tokens: 250, power: 10000 },
  SECRET: { gold: 8000000, tokens: 500, power: 15000 }
};

const ORB_ROLL_COSTS = {
  legendary: { tokens: 100, rarity: 'LEGENDARY' },
  mythic: { tokens: 250, rarity: 'MYTHIC' },
  divine: { tokens: 350, rarity: 'DIVINE' },
  secret: { tokens: 500, rarity: 'SECRET' }
};

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
  const last = new Date(user.lastRollRefillAt || now - 3600000).getTime();
  const hours = Math.max(1, Math.min(12, Math.floor((now - last) / 3600000) || 1));
  const teamPower = cards.reduce((sum, c) => sum + (c.power || 0), 0);
  const gold = Math.floor((teamPower / 7) * hours);
  const tokens = Math.max(1, Math.floor(hours / 2));
  const rolls = Math.max(1, Math.floor(hours / 3));
  await prisma.user.update({
    where: { id: userId },
    data: { gold: { increment: gold }, tokens: { increment: tokens }, rolls: { increment: rolls }, lastRollRefillAt: new Date() }
  });
  return { gold, tokens, rolls, hours, teamPower };
}

async function guaranteedCharacterRoll(userId, rarity) {
  let pool = await prisma.character.findMany({ where: { active: true, rarity }, take: 500 });
  if (!pool.length) pool = await prisma.character.findMany({ where: { active: true }, take: 500 });
  const character = pool[Math.floor(Math.random() * pool.length)];
  return createCardForUser(userId, character);
}


const GOLD_SHOP_ITEMS = {
  rolls_5: { name: '5 Rolls', gold: 6000, rolls: 5 },
  rolls_10: { name: '10 Rolls', gold: 10000, rolls: 10 },
  rolls_25: { name: '25 Rolls', gold: 22000, rolls: 25 },
  legendary_orb: { name: 'Legendary Orb Roll', gold: 300000, rarity: 'LEGENDARY' },
  mythic_orb: { name: 'Mythic Orb Roll', gold: 900000, rarity: 'MYTHIC' },
  divine_orb: { name: 'Divine Orb Roll', gold: 2500000, rarity: 'DIVINE' },
  secret_orb: { name: 'Secret Orb Roll', gold: 9000000, rarity: 'SECRET' }
};

function trainingCost(amount) {
  const safeAmount = Math.max(1, Math.min(100, Number(amount || 1)));
  return {
    amount: safeAmount,
    gold: safeAmount * 15000,
    powerGain: safeAmount * 120
  };
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    await seedItemTemplates();
  } catch (e) {
    console.error('Item seed failed:', e);
  }

  try {
    await applySecretCharacterBoosts();
  } catch (e) {
    console.error('Secret boost failed:', e);
  }

  const firstBossDelay = Number(process.env.BOSS_EVENT_FIRST_DELAY_SECONDS || 90) * 1000;
  const bossInterval = Number(process.env.BOSS_EVENT_INTERVAL_MINUTES || 60) * 60 * 1000;
  setTimeout(autoBossLoop, firstBossDelay);
  setInterval(autoBossLoop, bossInterval);
});

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      await ensureUser(i.user);

      if (i.customId.startsWith('inv_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await inventoryEmbed(i.user.id, next);

        if (data.empty) {
          return i.reply({
            content: 'You do not have any cards yet.',
            ephemeral: true
          });
        }

        return i.update({
          embeds: [data.embed],
          components: [data.row]
        });
      }


      if (i.customId.startsWith('manual_boss_join_')) {
        const eventId = i.customId.replace('manual_boss_join_', '');
        const boss = activeManualBosses.get(eventId);

        if (!boss) {
          return i.reply({
            content: 'This boss event is no longer active.',
            ephemeral: true
          });
        }

        boss.entries.add(i.user.id);

        return i.reply({
          content: `⚔️ دخلت البوس **${boss.bossName}**. عدد اللاعبين: **${boss.entries.size}**`,
          ephemeral: true
        });
      }

      return;
    }

    if (!i.isChatInputCommand()) return;

    await ensureUser(i.user);

    const userId = i.user.id;
    const commandName = i.commandName;

    if (commandName === 'help') {
      return i.reply(
        `📘 **VOIDROLL COMMANDS**\n\n` +
        `🎴 /r - Quick character roll\n` +
        `⚔️ /i - Quick item roll\n` +
        `🎴 /roll type:character - Roll an anime character\n` +
        `⚔️ /roll type:item - Roll weapons, armor, rings, and artifacts\n` +
        `🔎 /search - Search characters by one letter, name, or anime\n` +
        `🕳️ /secrets - Show SECRET characters\n` +
        `🎲 /rarity - Show normal roll rates\n` +
        `🚀 /autoteam - Equip strongest 5 cards\n` +
        `👤 /profile - Show gold, rolls, tokens, and timer\n` +
        `🎒 /inventory - Image inventory with arrows\n` +
        `⚙️ /equipment - Show your items\n` +
        `🛒 /shop - Official packs and events\n` +
        `📦 /pack - Open an anime pack\n` +
        `🔁 /transfer - Transfer Market listings\n` +
        `💰 /list - List a card on Transfer Market\n` +
        `🛍️ /buy - Buy a listing\n` +
        `🌾 /farm-claim - Claim passive farm rewards\n` +
        `🔮 /orb-shop - Guaranteed orb market\n` +
        `🔮 /orb-roll - Guaranteed rarity character\n` +
        `✨ /ascend - Upgrade character rarity/power\n` +
        `💰 /gold-shop - Spend gold on rolls/orbs\n` +
        `💸 /gold-buy - Buy using gold\n` +
        `🏋️ /train - Spend gold to raise card power\n` +
        `💰 /gold-shop - Spend gold on rolls/orbs\n` +
        `💸 /gold-buy - Buy using gold\n` +
        `🏋️ /train - Spend gold to raise card power\n` +
        `📜 /quests - Show quests`
      );
    }

    if (commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const last = new Date(u.lastRollRefillAt || Date.now());
      const next = new Date(last.getTime() + (60 * 60 * 1000));

      return i.reply(
        `👤 ${i.user.username}\n` +
        `Gold: ${money(u.gold)}\n` +
        `Tokens: ${u.tokens ?? 0}\n` +
        `Rolls: ${u.rolls ?? 0}\n` +
        `Next Refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
        `Level: ${u.level}\n`
      );
    }

    if (commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');

      if (cd) {
        return i.reply({
          content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`,
          ephemeral: true
        });
      }

      const reward = 1500;

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: reward },
          tokens: { increment: 3 },
          dailyStreak: { increment: 1 }
        }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);

      return i.reply(`🎁 Daily reward claimed: ${money(reward)} gold + 3 tokens.`);
    }

    if (commandName === 'roll' || commandName === 'r' || commandName === 'i') {
      await i.deferReply();

      let type = 'character';
      if (commandName === 'i') type = 'item';
      else if (commandName === 'r') type = 'character';
      else type = i.options.getString('type') || 'character';

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.rolls ?? 0) <= 0) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));

        return i.editReply(
          `❌ You do not have any rolls left.\n` +
          `⏳ Next refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
          `🎲 Refill amount: +15 Rolls`
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { rolls: { decrement: 1 } }
      });

      if (type === 'item') {
        const eq = await rollItem(userId);

        const embed = new EmbedBuilder()
          .setTitle('⚔️ New Item Roll!')
          .setDescription(
            `**${eq.template.name}**\n` +
            `Slot: **${eq.template.slot}**\n` +
            `Rarity: **${eq.template.rarity}**\n` +
            `Power: **${eq.power}**\n` +
            `🎲 Rolls left: **${(user.rolls ?? 1) - 1}**`
          )
          .setColor(embedColor('#8B5CF6'))
          .setFooter({ text: `Item ID: ${eq.id}` });

        const png = await renderItemCard(eq);
        const file = new AttachmentBuilder(png, { name: 'item.png' });

        embed.setImage('attachment://item.png');

        return i.editReply({ embeds: [embed], files: [file] });
      }

      const result = await rollCard(userId);
      const aura = getAura(result.character);

      const embed = new EmbedBuilder()
        .setTitle('🎴 New Character Roll!')
        .setDescription(
          `${result.text}\n\n` +
          `🎌 Anime: **${result.character.anime}**\n` +
          `🌌 Technique: **${aura.name}**\n` +
          `🎲 Rolls left: **${(user.rolls ?? 1) - 1}**`
        )
        .setColor(embedColor(aura.color))
        .setFooter({ text: `Card ID: ${result.card.id}` });

      try {
        const png = await renderCard({
          card: result.card,
          character: result.character
        });

        const file = new AttachmentBuilder(png, { name: 'card.png' });

        embed.setImage('attachment://card.png');

        return i.editReply({ embeds: [embed], files: [file] });
      } catch (err) {
        console.error(err);

        if (result.character.imageUrl) embed.setImage(result.character.imageUrl);

        return i.editReply({ embeds: [embed] });
      }
    }

    if (commandName === 'search') {
      const query = i.options.getString('name', true).trim().toLowerCase();

      const allChars = await prisma.character.findMany({
        where: { active: true },
        orderBy: { basePower: 'desc' },
        take: 1000
      });

      const chars = allChars
        .filter(c => `${c.name} ${c.anime}`.toLowerCase().includes(query))
        .slice(0, 10);

      if (!chars.length) {
        return i.reply('❌ No characters found.');
      }

      const first = chars[0];
      const aura = getAura(first);

      const matches = chars
        .map((c, idx) => `${idx + 1}. ${rarityEmoji(c.rarity)} **${c.name}** • ${c.anime} • PWR ${c.basePower}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🔎 Search Results for "${query}"`)
        .setDescription(
          `**Best Match Preview**\n` +
          `${rarityEmoji(first.rarity)} **${first.name}**\n` +
          `🎌 Anime: **${first.anime}**\n` +
          `💎 Rarity: **${first.rarity}**\n` +
          `⚔️ Base Power: **${first.basePower}**\n` +
          `🌌 Technique: **${aura.name}**\n\n` +
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

      const chars = await prisma.character.findMany({
        where: { rarity: 'SECRET' },
        orderBy: { basePower: 'desc' },
        take: 25
      });

      if (!chars.length) {
        return i.reply('No SECRET characters found yet.');
      }

      const lines = chars.map(c => `🕳️ ${c.name} • ${c.anime} • PWR ${c.basePower}`);
      const content = (`🕳️ **SECRET CHARACTERS**\n\n` + lines.join('\n')).slice(0, 1900);

      return i.reply(content);
    }

    if (commandName === 'rarity') {
      return i.reply(
        `🎲 **NORMAL ROLL RATES**\n\n` +
        `🎴 **Character Roll**\n` +
        `⚪ Common: 72%\n` +
        `🔵 Rare: 22%\n` +
        `🟣 Epic: 5.65%\n` +
        `🟡 Legendary: 1%\n` +
        `🔴 Mythic: 0.75%\n` +
        `🌈 Divine: 0.5%\n` +
        `🕳️ Secret: 0.1%\n\n` +
        `⚔️ **Item Roll**\n` +
        `⚪ Common: 65%\n` +
        `🔵 Rare: 26%\n` +
        `🟣 Epic: 7.65%\n` +
        `🟡 Legendary: 1%\n` +
        `🔴 Mythic: 0.75%\n` +
        `🌈 Divine: 0.5%\n` +
        `🕳️ Secret: 0.1%`
      );
    }

    if (commandName === 'inventory') {
      const data = await inventoryEmbed(userId, 0);

      if (data.empty) {
        return i.reply('You do not have any cards yet. Use /roll type:character.');
      }

      return i.reply({
        embeds: [data.embed],
        components: [data.row]
      });
    }

    if (commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({
        where: { userId },
        include: { template: true },
        take: 15,
        orderBy: { createdAt: 'desc' }
      });

      if (!eq.length) {
        return i.reply('You do not have any items yet. Use /roll type:item.');
      }

      const first = eq[0];
      const png = await renderItemCard(first);
      const file = new AttachmentBuilder(png, { name: 'item.png' });

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Equipment Inventory')
        .setDescription(eq.map(itemLine).join('\n').slice(0, 3500))
        .setImage('attachment://item.png');

      return i.reply({ embeds: [embed], files: [file] });
    }

    if (commandName === 'shop') {
      return i.reply(
        `🛒 **VOIDROLL SHOP**\n\n` +
        `🔥 Jujutsu Pack - 10 Tokens\n` +
        `🗡️ Demon Slayer Pack - 10 Tokens\n` +
        `🍥 Naruto Pack - 10 Tokens\n` +
        `🏴‍☠️ One Piece Pack - 10 Tokens\n` +
        `🧿 Bleach Pack - 10 Tokens\n` +
        `💥 My Hero Pack - 10 Tokens\n` +
        `🎣 Hunter x Hunter Pack - 10 Tokens\n` +
        `🐉 Dragon Ball Pack - 10 Tokens\n` +
        `🧱 Attack on Titan Pack - 10 Tokens\n` +
        `😈 Villains Pack - 18 Tokens\n` +
        `🕳️ Secret Pack - 500 Tokens - Guaranteed SECRET\n` +
        `🌌 Event Pack - 25 Tokens\n\n` +
        `Use /pack type:<pack>.`
      );
    }

    if (commandName === 'pack') {
      await i.deferReply();

      const type = i.options.getString('type', true);
      const result = await openPack(userId, type);
      const aura = getAura(result.character);

      const embed = new EmbedBuilder()
        .setTitle(`📦 ${type.toUpperCase()} Pack`)
        .setDescription(
          `${rarityEmoji(result.character.rarity)} **${result.character.name}**\n` +
          `🎌 Anime: **${result.character.anime}**\n` +
          `💎 Rarity: **${result.character.rarity}**\n` +
          `⚔️ Power: **${result.card.power}**\n` +
          `🌌 Technique: **${aura.name}**`
        )
        .setColor(embedColor(aura.color))
        .setFooter({ text: `Card ID: ${result.card.id}` });

      try {
        const png = await renderCard({
          card: result.card,
          character: result.character
        });

        const file = new AttachmentBuilder(png, { name: 'pack-card.png' });
        embed.setImage('attachment://pack-card.png');

        return i.editReply({ embeds: [embed], files: [file] });
      } catch (_) {
        if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        return i.editReply({ embeds: [embed] });
      }
    }

    if (commandName === 'events') {
      return i.reply(
        `🌌 **ACTIVE EVENTS**\n\n` +
        `🔥 Sukuna Raid Event\n` +
        `⚡ Event Pack has boosted high-tier odds\n` +
        `⚔️ Bosses drop high rarity equipment\n` +
        `🔁 Transfer Market tax: 5%`
      );
    }

    if (commandName === 'market' || commandName === 'transfer') {
      const items = await market.latest(10);

      if (!items.length) return i.reply('The Transfer Market is currently empty.');

      return i.reply(
        `🔁 **TRANSFER MARKET**\n\n` +
        items.map(x => `${x.id} • ${x.card.character.name} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n')
      );
    }

    if (commandName === 'sell' || commandName === 'list') {
      const cardId = i.options.getString('card_id', true);
      const price = i.options.getInteger('price', true);

      const card = await prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: { character: true }
      });

      if (!card) {
        return i.reply({
          content: 'Card not found in your inventory.',
          ephemeral: true
        });
      }

      const [min, max] = priceRange(card.character.rarity);

      if (price < min || price > max) {
        return i.reply({
          content: `Price range for ${card.character.rarity}: ${money(min)} - ${money(max)} gold.`,
          ephemeral: true
        });
      }

      const l = await market.sell(userId, cardId, price);

      return i.reply(
        `✅ Listed on Transfer Market.\n` +
        `Listing ID: ${l.id}\n` +
        `Price: ${money(price)} gold`
      );
    }

    if (commandName === 'buy') {
      const listingId = i.options.getString('listing_id', true);
      const r = await market.buy(userId, listingId);

      return i.reply(`✅ Purchase complete.\nMarket tax: ${money(r.tax)} gold.`);
    }

    if (commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);

      return i.reply(
        r.success
          ? `✅ Upgrade successful. Equipment is now +${r.nextLevel}.`
          : `💥 Upgrade failed. You lost ${money(r.cost)} gold.`
      );
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
        `🚀 **Auto Team Equipped!**\n\n` +
        cards.map((c, idx) => `Slot ${idx + 1}: ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${c.power}`).join('\n')
      );
    }


    if (commandName === 'story' || commandName === 'dungeon' || commandName === 'tower') {
      const action = i.options.getString('action') || 'info';
      const mode = commandName;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const current = 1;
      const teamPower = await getTeamPower(userId);
      const required = mode === 'story'
        ? 700 + current * 260
        : mode === 'tower'
          ? 1200 + current * 420
          : 900 + current * 330;

      if (action === 'start') {
        return runProgressBattle(i, mode);
      }

      return i.reply(
        `📍 **${mode.toUpperCase()}**\n` +
        `Current: **${getProgressTitle(mode, current, user)}**\n` +
        `Your Team Power: **${money(teamPower)}**\n` +
        `Recommended Power: **${money(required)}**\n\n` +
        `Use **/${mode} action:start** to fight.`
      );
    }

    if (commandName === 'admin-spawn-boss') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({
          content: 'Admin only.',
          ephemeral: true
        });
      }

      const channel = i.options.getChannel('channel', true);

      if (!channel || !channel.isTextBased()) {
        return i.reply({
          content: 'Choose a text channel.',
          ephemeral: true
        });
      }

      const boss = await sendBossAnnouncement(channel);

      return i.reply({
        content: `✅ Boss spawned in ${channel}: **${boss.bossName}**`,
        ephemeral: true
      });
    }


    if (commandName === 'farm-claim') {
      await i.deferReply();
      const r = await passiveFarmClaim(userId);
      return i.editReply(`🌾 **Passive Farm Claimed**\n⏳ Farmed Hours: **${r.hours}h**\n👥 Team Power: **${money(r.teamPower)}**\n💰 Gold: **${money(r.gold)}**\n🪙 Tokens: **${r.tokens}**\n🎲 Rolls: **${r.rolls}**\n\nYour strongest characters farm for you even while you are not playing.`);
    }

    if (commandName === 'orb-shop') {
      return i.reply(`🔮 **ORB MARKET**\n\n🟡 Legendary Orb Roll: **100 tokens**\n🔴 Mythic Orb Roll: **250 tokens**\n🌈 Divine Orb Roll: **350 tokens**\n🕳️ Secret Orb Roll: **500 tokens**\n\nUse **/orb-roll rarity:<rarity>** for a guaranteed character.`);
    }

    if (commandName === 'orb-roll') {
      await i.deferReply();
      const rarityKey = i.options.getString('rarity', true);
      const cfg = ORB_ROLL_COSTS[rarityKey];
      if (!cfg) return i.editReply('Invalid orb rarity.');
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if ((user.tokens || 0) < cfg.tokens) return i.editReply(`You need **${cfg.tokens} tokens** for this guaranteed roll.`);
      await prisma.user.update({ where: { id: userId }, data: { tokens: { decrement: cfg.tokens } } });
      const result = await guaranteedCharacterRoll(userId, cfg.rarity);
      const aura = getAura(result.character);
      const embed = new EmbedBuilder().setTitle(`🔮 Guaranteed ${cfg.rarity} Orb Roll`).setDescription(`${rarityEmoji(result.character.rarity)} **${result.character.name}**\n🎌 Anime: **${result.character.anime}**\n💎 Rarity: **${result.character.rarity}**\n⚔️ Power: **${result.card.power}**`).setColor(embedColor(aura.color)).setFooter({ text: `Card ID: ${result.card.id}` });
      try {
        const png = await renderCard({ card: result.card, character: result.character });
        const file = new AttachmentBuilder(png, { name: 'orb-card.png' });
        embed.setImage('attachment://orb-card.png');
        return i.editReply({ embeds: [embed], files: [file] });
      } catch (_) {
        if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        return i.editReply({ embeds: [embed] });
      }
    }

    if (commandName === 'ascend') {
      const cardId = i.options.getString('card_id', true);
      const target = i.options.getString('rarity', true);
      const cfg = RARITY_UPGRADE_COSTS[target];
      if (!cfg) return i.reply({ content: 'Invalid rarity.', ephemeral: true });
      const card = await prisma.userCard.findFirst({ where: { id: cardId, userId }, include: { character: true } });
      if (!card) return i.reply({ content: 'Card not found.', ephemeral: true });
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if ((user.gold || 0) < cfg.gold || (user.tokens || 0) < cfg.tokens) return i.reply(`You need **${money(cfg.gold)} gold** and **${cfg.tokens} tokens** to ascend to **${target}**.`);
      await prisma.user.update({ where: { id: userId }, data: { gold: { decrement: cfg.gold }, tokens: { decrement: cfg.tokens } } });
      await prisma.character.update({ where: { id: card.characterId }, data: { rarity: target, basePower: Math.max(card.character.basePower || 0, cfg.power) } });
      const updated = await prisma.userCard.update({ where: { id: card.id }, data: { power: Math.max(card.power || 0, cfg.power + Math.floor(Math.random() * 500)) }, include: { character: true } });
      return i.reply(`✨ **ASCENSION COMPLETE**\n${updated.character.name} is now **${target}**.\nNew Power: **${updated.power}**`);
    }


    if (commandName === 'gold-shop') {
      return i.reply(
        `💰 **GOLD SHOP**\n\n` +
        `🎲 **Rolls**\n` +
        `• rolls_5 = 5 Rolls → **6,000 Gold**\n` +
        `• rolls_10 = 10 Rolls → **10,000 Gold**\n` +
        `• rolls_25 = 25 Rolls → **22,000 Gold**\n\n` +
        `🔮 **Guaranteed Orb Rolls**\n` +
        `• legendary_orb → **300,000 Gold**\n` +
        `• mythic_orb → **900,000 Gold**\n` +
        `• divine_orb → **2,500,000 Gold**\n` +
        `• secret_orb → **9,000,000 Gold**\n\n` +
        `🏋️ **Training**\n` +
        `Use **/train card_id:<id> amount:<1-100>**\n` +
        `Each amount costs **15,000 Gold** and gives **+120 Power**.\n\n` +
        `Buy with: **/gold-buy item:<item_name>**`
      );
    }

    if (commandName === 'gold-buy') {
      await i.deferReply();

      const itemKey = i.options.getString('item', true);
      const item = GOLD_SHOP_ITEMS[itemKey];

      if (!item) {
        return i.editReply('Invalid gold shop item. Use /gold-shop.');
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < item.gold) {
        return i.editReply(`You need **${money(item.gold)} Gold** to buy **${item.name}**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { decrement: item.gold } }
      });

      if (item.rolls) {
        const updated = await prisma.user.update({
          where: { id: userId },
          data: { rolls: { increment: item.rolls } }
        });

        return i.editReply(
          `✅ Bought **${item.name}** for **${money(item.gold)} Gold**.\n` +
          `New Rolls: **${updated.rolls}**`
        );
      }

      if (item.rarity) {
        const result = await guaranteedCharacterRoll(userId, item.rarity);
        const aura = getAura(result.character);

        const embed = new EmbedBuilder()
          .setTitle(`💰 Gold Shop ${item.rarity} Roll`)
          .setDescription(
            `${rarityEmoji(result.character.rarity)} **${result.character.name}**\n` +
            `🎌 Anime: **${result.character.anime}**\n` +
            `💎 Rarity: **${result.character.rarity}**\n` +
            `⚔️ Power: **${result.card.power}**\n` +
            `💰 Cost: **${money(item.gold)} Gold**`
          )
          .setColor(embedColor(aura.color))
          .setFooter({ text: `Card ID: ${result.card.id}` });

        try {
          const png = await renderCard({ card: result.card, character: result.character });
          const file = new AttachmentBuilder(png, { name: 'gold-card.png' });
          embed.setImage('attachment://gold-card.png');
          return i.editReply({ embeds: [embed], files: [file] });
        } catch (_) {
          if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
          return i.editReply({ embeds: [embed] });
        }
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

      if (!card) {
        return i.reply({
          content: 'Card not found in your inventory.',
          ephemeral: true
        });
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost.gold) {
        return i.reply(
          `You need **${money(cost.gold)} Gold** for this training.\n` +
          `Training amount: **${cost.amount}** → Power Gain: **+${cost.powerGain}**`
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { decrement: cost.gold }
        }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: { increment: cost.powerGain } },
        include: { character: true }
      });

      return i.reply(
        `🏋️ **TRAINING COMPLETE**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** gained **+${cost.powerGain} Power**.\n` +
        `Cost: **${money(cost.gold)} Gold**\n` +
        `New Power: **${updated.power}**`
      );
    }

    if (commandName === 'admin-give-rolls') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({
          content: 'Admin only.',
          ephemeral: true
        });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      if (amount <= 0) {
        return i.reply({
          content: 'Amount must be greater than 0.',
          ephemeral: true
        });
      }

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: {
          rolls: {
            increment: amount
          }
        }
      });

      return i.reply(
        `✅ Added **${amount} rolls** to **${target.username}**.\n` +
        `New rolls balance: **${updated.rolls}**`
      );
    }

    if (commandName === 'quests') {
      return i.reply(
        `📜 **QUESTS**\n` +
        `• Roll 10 cards → 5 Tokens\n` +
        `• Clear 1 dungeon → 10 Tokens\n` +
        `• Defeat a boss → 25 Tokens\n` +
        `• Equip an anime item → 5 Tokens`
      );
    }

    if (commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({
          content: 'Admin only.',
          ephemeral: true
        });
      }

      const eq = await equipment.dropEquipment(userId, i.options.getString('rarity') || 'COMMON');

      return i.reply(eq ? `Equipment granted: ${eq.id}` : 'No equipment template exists for this rarity.');
    }
  } catch (err) {
    console.error(err);

    if (i.deferred || i.replied) {
      return i.editReply({ content: `Error: ${err.message}` }).catch(() => {});
    }

    return i.reply({
      content: `Error: ${err.message}`,
      ephemeral: true
    }).catch(() => {});
  }
});

const app = express();

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

app.listen(config.port, () => console.log(`Health server on ${config.port}`));

if (!config.token) throw new Error('DISCORD_TOKEN missing');

client.login(config.token);
