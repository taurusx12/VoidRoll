const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');

const RARITY_XP = {
  COMMON: 80,
  RARE: 180,
  EPIC: 420,
  LEGENDARY: 950,
  MYTHIC: 2200,
  DIVINE: 4500,
  SECRET: 9000
};

const RARITY_FARM = {
  COMMON: { gold: 8, tokens: 0.01 },
  RARE: { gold: 18, tokens: 0.03 },
  EPIC: { gold: 40, tokens: 0.08 },
  LEGENDARY: { gold: 100, tokens: 0.18 },
  MYTHIC: { gold: 240, tokens: 0.45 },
  DIVINE: { gold: 600, tokens: 1.0 },
  SECRET: { gold: 1200, tokens: 2.0 }
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hpFromPower(power) {
  return Math.max(100, Math.floor(power * 4.5));
}

function dmgFromPower(power) {
  const low = Math.floor(power * 0.16);
  const high = Math.floor(power * 0.24);
  return low + Math.floor(Math.random() * Math.max(1, high - low));
}

function critChanceFromTeam(cards) {
  const avg = cards.length ? cards.reduce((s, c) => s + c.power, 0) / cards.length : 0;
  return clamp(0.05 + avg / 100000, 0.05, 0.25);
}

function rarityEmoji(r) {
  return {
    COMMON: '⚪',
    RARE: '🔵',
    EPIC: '🟣',
    LEGENDARY: '🟡',
    MYTHIC: '🔴',
    DIVINE: '🌈',
    SECRET: '🕳️'
  }[r] || '🎴';
}

function shortCard(c) {
  return `${rarityEmoji(c.character.rarity)} ${c.character.name} • ${c.character.rarity} • PWR ${c.power}`;
}

async function getTeam(userId) {
  let slots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  });

  if (!slots.length) {
    await autoTeam(userId);
    slots = await prisma.teamSlot.findMany({
      where: { userId },
      include: { card: { include: { character: true } } },
      orderBy: { slot: 'asc' }
    });
  }

  return slots.map(s => s.card);
}

async function autoTeam(userId) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 5
  });

  await prisma.teamSlot.deleteMany({ where: { userId } });

  for (let i = 0; i < cards.length; i++) {
    await prisma.teamSlot.create({
      data: {
        id: nanoid(),
        userId,
        slot: i + 1,
        cardId: cards[i].id
      }
    });
  }

  return cards;
}

async function setTeamSlot(userId, slot, cardId) {
  if (slot < 1 || slot > 5) throw new Error('Team slot must be between 1 and 5.');

  const card = await prisma.userCard.findFirst({
    where: { id: cardId, userId },
    include: { character: true }
  });

  if (!card) throw new Error('Card not found in your inventory.');

  await prisma.teamSlot.upsert({
    where: { userId_slot: { userId, slot } },
    update: { cardId },
    create: { id: nanoid(), userId, slot, cardId }
  });

  return card;
}

async function showTeam(userId) {
  const slots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  });

  if (!slots.length) return { text: 'You do not have a team yet. Use /team auto or /team set.' };

  const power = slots.reduce((s, x) => s + x.card.power, 0);
  const text = slots.map(s => `Slot ${s.slot}: ${shortCard(s.card)}`).join('\n');

  return { text, power };
}

function storyEnemy(user) {
  const chapter = user.storyChapter || 1;
  const stage = user.storyStage || 1;
  const isBoss = stage % 5 === 0;
  const isFinal = stage === 30;
  const enemyPower = Math.floor(700 + chapter * 380 + stage * 95 + (isBoss ? chapter * 600 + stage * 70 : 0) + (isFinal ? chapter * 1200 : 0));
  const enemyName = isFinal ? `Chapter ${chapter} Final Boss` : isBoss ? `Chapter ${chapter} Stage ${stage} Boss` : `Chapter ${chapter} Enemy Squad`;
  return { chapter, stage, isBoss, isFinal, enemyPower, enemyName };
}

function dungeonEnemy(type, userLevel = 1) {
  const table = {
    fire: { name: 'Flame Dungeon', power: 3500, gold: 2800, tokens: 6 },
    shadow: { name: 'Shadow Dungeon', power: 6500, gold: 5200, tokens: 12 },
    ice: { name: 'Ice Dungeon', power: 9500, gold: 8000, tokens: 18 },
    void: { name: 'Void Dungeon', power: 15000, gold: 14000, tokens: 32 }
  };
  const d = table[type] || table.fire;
  return { ...d, power: d.power + userLevel * 80 };
}

function bossList() {
  return [
    { name: 'Shadow Beast', power: 2500, gold: 2000, tokens: 4 },
    { name: 'Flame Tyrant', power: 5000, gold: 4500, tokens: 9 },
    { name: 'Void King', power: 10000, gold: 10000, tokens: 20 }
  ];
}

function limitedBoss() {
  return {
    name: 'Sukuna, King of Curses',
    power: 15000,
    gold: 18000,
    tokens: 35
  };
}

function towerEnemy(floor) {
  return {
    name: `Tower Floor ${floor}`,
    power: Math.floor(1200 + floor * 500 + Math.pow(floor, 1.35) * 120),
    gold: Math.floor(1000 + floor * 350),
    tokens: Math.floor(2 + floor / 3),
    rolls: floor % 5 === 0 ? 5 : 1
  };
}

function simulateBattle(teamCards, enemy) {
  const teamPower = teamCards.reduce((s, c) => s + c.power, 0);
  let teamHp = teamCards.reduce((s, c) => s + hpFromPower(c.power), 0);
  let enemyHp = hpFromPower(enemy.power || enemy.enemyPower);
  const enemyPower = enemy.power || enemy.enemyPower;
  const critChance = critChanceFromTeam(teamCards);
  const lines = [];

  for (let turn = 1; turn <= 12; turn++) {
    let teamDamage = 0;

    for (const card of teamCards) {
      let dmg = dmgFromPower(card.power);
      if (Math.random() < critChance) {
        dmg = Math.floor(dmg * 1.8);
      }
      teamDamage += dmg;
    }

    enemyHp -= teamDamage;
    lines.push(`Turn ${turn}: Your team dealt **${teamDamage.toLocaleString('en-US')}** damage.`);

    if (enemyHp <= 0) {
      return { win: true, teamPower, enemyPower, remainingHp: Math.max(0, teamHp), lines };
    }

    let enemyDamage = dmgFromPower(enemyPower);
    teamHp -= enemyDamage;
    lines.push(`Turn ${turn}: ${enemy.name || enemy.enemyName} dealt **${enemyDamage.toLocaleString('en-US')}** damage.`);

    if (teamHp <= 0) {
      return { win: false, teamPower, enemyPower, remainingHp: 0, lines };
    }
  }

  return { win: enemyHp <= teamHp, teamPower, enemyPower, remainingHp: Math.max(0, teamHp), lines };
}

async function grantRewards(userId, rewards) {
  const data = {};

  if (rewards.gold) data.gold = { increment: BigInt(rewards.gold) };
  if (rewards.tokens) data.tokens = { increment: rewards.tokens };
  if (rewards.rolls) data.rolls = { increment: rewards.rolls };
  if (rewards.xp) data.xp = { increment: rewards.xp };

  if (Object.keys(data).length) {
    await prisma.user.update({ where: { id: userId }, data });
  }

  return rewards;
}

async function runStoryFight(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const team = await getTeam(userId);
  if (!team.length) throw new Error('You need at least 1 card. Use /roll first.');

  const enemy = storyEnemy(user);
  const battle = simulateBattle(team, { name: enemy.enemyName, power: enemy.enemyPower });
  let rewards = null;

  if (battle.win) {
    rewards = {
      gold: 1000 + enemy.chapter * 250 + enemy.stage * 75 + (enemy.isBoss ? 1500 : 0),
      tokens: enemy.isFinal ? 15 : enemy.isBoss ? 7 : 2,
      rolls: enemy.isBoss ? 2 : 0,
      xp: 80 + enemy.chapter * 10
    };

    let nextChapter = enemy.chapter;
    let nextStage = enemy.stage + 1;

    if (nextStage > 30) {
      nextStage = 1;
      nextChapter = Math.min(60, nextChapter + 1);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        storyChapter: nextChapter,
        storyStage: nextStage
      }
    });

    await grantRewards(userId, rewards);
  }

  await prisma.battleLog.create({
    data: {
      id: nanoid(),
      userId,
      mode: 'story',
      result: battle.win ? 'WIN' : 'LOSS',
      enemyName: enemy.enemyName,
      teamPower: battle.teamPower,
      enemyPower: battle.enemyPower,
      rewards: rewards || {}
    }
  });

  return { enemy, battle, rewards };
}

async function runDungeon(userId, type) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const team = await getTeam(userId);
  if (!team.length) throw new Error('You need at least 1 card. Use /roll first.');

  const enemy = dungeonEnemy(type, user.level || 1);
  const battle = simulateBattle(team, enemy);

  let rewards = null;
  if (battle.win) {
    rewards = {
      gold: enemy.gold,
      tokens: enemy.tokens,
      rolls: Math.random() < 0.35 ? 3 : 0,
      xp: 120
    };

    await grantRewards(userId, rewards);
  }

  await prisma.battleLog.create({
    data: {
      id: nanoid(),
      userId,
      mode: `dungeon:${type}`,
      result: battle.win ? 'WIN' : 'LOSS',
      enemyName: enemy.name,
      teamPower: battle.teamPower,
      enemyPower: battle.enemyPower,
      rewards: rewards || {}
    }
  });

  return { enemy, battle, rewards };
}

async function runTower(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const team = await getTeam(userId);
  if (!team.length) throw new Error('You need at least 1 card. Use /roll first.');

  const enemy = towerEnemy(user.towerFloor || 1);
  const battle = simulateBattle(team, enemy);

  let rewards = null;
  if (battle.win) {
    rewards = {
      gold: enemy.gold,
      tokens: enemy.tokens,
      rolls: enemy.rolls,
      xp: 100 + (user.towerFloor || 1) * 8
    };

    await grantRewards(userId, rewards);

    await prisma.user.update({
      where: { id: userId },
      data: { towerFloor: { increment: 1 } }
    });
  }

  await prisma.battleLog.create({
    data: {
      id: nanoid(),
      userId,
      mode: 'tower',
      result: battle.win ? 'WIN' : 'LOSS',
      enemyName: enemy.name,
      teamPower: battle.teamPower,
      enemyPower: battle.enemyPower,
      rewards: rewards || {}
    }
  });

  return { enemy, battle, rewards };
}

async function runLimitedBoss(userId) {
  const team = await getTeam(userId);
  if (!team.length) throw new Error('You need at least 1 card. Use /roll first.');

  const enemy = limitedBoss();
  const battle = simulateBattle(team, enemy);

  let rewards = null;
  if (battle.win) {
    rewards = {
      gold: enemy.gold,
      tokens: enemy.tokens,
      rolls: 10,
      xp: 500
    };

    await grantRewards(userId, rewards);
  }

  await prisma.battleLog.create({
    data: {
      id: nanoid(),
      userId,
      mode: 'limited-boss',
      result: battle.win ? 'WIN' : 'LOSS',
      enemyName: enemy.name,
      teamPower: battle.teamPower,
      enemyPower: battle.enemyPower,
      rewards: rewards || {}
    }
  });

  return { enemy, battle, rewards };
}

async function sacrificeCard(userId, mainCardId, sacrificeCardId) {
  if (mainCardId === sacrificeCardId) throw new Error('You cannot sacrifice the same card.');

  const main = await prisma.userCard.findFirst({
    where: { id: mainCardId, userId },
    include: { character: true }
  });

  if (!main) throw new Error('Main card not found.');

  const food = await prisma.userCard.findFirst({
    where: { id: sacrificeCardId, userId },
    include: { character: true }
  });

  if (!food) throw new Error('Sacrifice card not found.');

  if (food.locked) throw new Error('This card is locked.');

  const xpGain = RARITY_XP[food.character.rarity] || 50;
  const powerGain = Math.floor(xpGain * 0.55);

  await prisma.userCard.delete({ where: { id: food.id } });

  const updated = await prisma.userCard.update({
    where: { id: main.id },
    data: {
      xp: { increment: xpGain },
      power: { increment: powerGain },
      level: { increment: Math.max(1, Math.floor(xpGain / 1000)) }
    },
    include: { character: true }
  });

  return { main: updated, sacrificed: food, xpGain, powerGain };
}

async function claimPassiveFarm(userId) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true }
  });

  if (!cards.length) return { gold: 0, tokens: 0, count: 0 };

  let gold = 0;
  let tokenFloat = 0;

  for (const card of cards) {
    const rate = RARITY_FARM[card.character.rarity] || RARITY_FARM.COMMON;
    gold += Math.floor(rate.gold + card.power / 250);
    tokenFloat += rate.tokens;
  }

  const tokens = Math.floor(tokenFloat);

  await grantRewards(userId, { gold, tokens });

  return { gold, tokens, count: cards.length };
}

function formatRewards(rewards) {
  if (!rewards) return 'No rewards earned. Upgrade your team and try again.';

  const parts = [];
  if (rewards.gold) parts.push(`${rewards.gold.toLocaleString('en-US')} Gold`);
  if (rewards.tokens) parts.push(`${rewards.tokens} Tokens`);
  if (rewards.rolls) parts.push(`${rewards.rolls} Rolls`);
  if (rewards.xp) parts.push(`${rewards.xp} XP`);

  return parts.length ? parts.join(' • ') : 'No rewards.';
}

function battleText(result) {
  const lines = result.battle.lines.slice(-6).join('\n');
  return (
    `Result: **${result.battle.win ? 'VICTORY' : 'DEFEAT'}**\n` +
    `Your Team Power: **${result.battle.teamPower.toLocaleString('en-US')}**\n` +
    `Enemy Power: **${result.battle.enemyPower.toLocaleString('en-US')}**\n\n` +
    `${lines}\n\n` +
    `Rewards: ${formatRewards(result.rewards)}`
  );
}

module.exports = {
  autoTeam,
  setTeamSlot,
  showTeam,
  bossList,
  limitedBoss,
  runStoryFight,
  runDungeon,
  runTower,
  runLimitedBoss,
  sacrificeCard,
  claimPassiveFarm,
  battleText
};
