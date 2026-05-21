const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');

const RARITY_XP = {
  COMMON: 50,
  RARE: 120,
  EPIC: 300,
  LEGENDARY: 800,
  MYTHIC: 2000,
  DIVINE: 5000,
  SECRET: 10000
};

const RARITY_FARM = {
  COMMON: { gold: 18, tokens: 0.01, rolls: 0.01 },
  RARE: { gold: 45, tokens: 0.03, rolls: 0.02 },
  EPIC: { gold: 100, tokens: 0.08, rolls: 0.04 },
  LEGENDARY: { gold: 260, tokens: 0.18, rolls: 0.08 },
  MYTHIC: { gold: 650, tokens: 0.45, rolls: 0.15 },
  DIVINE: { gold: 1400, tokens: 0.9, rolls: 0.3 },
  SECRET: { gold: 2500, tokens: 1.5, rolls: 0.5 }
};

function getStageInfo(chapter = 1, stage = 1) {
  const safeChapter = Math.max(1, Math.min(60, chapter));
  const safeStage = Math.max(1, Math.min(30, stage));
  const isBoss = safeStage % 5 === 0;
  const enemyPower = Math.floor((safeChapter * 900) + (safeStage * 220) + (isBoss ? safeChapter * 1400 : 0));
  return { chapter: safeChapter, stage: safeStage, isBoss, enemyPower };
}

async function getTeam(userId) {
  return prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  });
}

async function getTeamPower(userId) {
  const team = await getTeam(userId);
  return team.reduce((sum, s) => sum + (s.card?.power || 0), 0);
}

async function setTeamSlot(userId, slot, cardId) {
  if (slot < 1 || slot > 5) throw new Error('Team slot must be between 1 and 5.');

  const card = await prisma.userCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new Error('Card not found in your inventory.');

  return prisma.teamSlot.upsert({
    where: { userId_slot: { userId, slot } },
    update: { cardId },
    create: { id: nanoid(), userId, slot, cardId }
  });
}

async function playStory(userId, chapterInput, stageInput) {
  const chapter = Math.max(1, Math.min(60, chapterInput || 1));
  const stage = Math.max(1, Math.min(30, stageInput || 1));
  const info = getStageInfo(chapter, stage);
  const teamPower = await getTeamPower(userId);

  if (teamPower <= 0) {
    return { ok: false, message: 'You need to set a team first. Use /team slot:1 card_id:YOUR_CARD_ID.' };
  }

  const winChance = Math.max(15, Math.min(95, Math.floor((teamPower / info.enemyPower) * 55)));
  const won = Math.random() * 100 <= winChance;

  if (!won) {
    return {
      ok: false,
      message:
        `📖 **Chapter ${chapter} - Stage ${stage}**\n` +
        `Enemy Power: **${info.enemyPower.toLocaleString('en-US')}**\n` +
        `Your Team Power: **${teamPower.toLocaleString('en-US')}**\n` +
        `Result: **Defeat**\n\nUpgrade your cards/equipment and try again.`
    };
  }

  const gold = Math.floor(500 + chapter * 90 + stage * 35 + (info.isBoss ? 1500 + chapter * 100 : 0));
  const tokens = info.isBoss ? Math.max(2, Math.floor(chapter / 4) + 2) : Math.random() < 0.25 ? 1 : 0;
  const rolls = info.isBoss ? 3 : Math.random() < 0.2 ? 1 : 0;

  await prisma.user.update({
    where: { id: userId },
    data: {
      gold: { increment: gold },
      tokens: { increment: tokens },
      rolls: { increment: rolls }
    }
  });

  await prisma.storyProgress.upsert({
    where: { userId },
    update: { chapter, stage },
    create: { id: nanoid(), userId, chapter, stage }
  });

  return {
    ok: true,
    message:
      `📖 **Chapter ${chapter} - Stage ${stage}${info.isBoss ? ' BOSS' : ''} Cleared!**\n` +
      `Enemy Power: **${info.enemyPower.toLocaleString('en-US')}**\n` +
      `Your Team Power: **${teamPower.toLocaleString('en-US')}**\n\n` +
      `Rewards:\n` +
      `• Gold: **${gold.toLocaleString('en-US')}**\n` +
      `• Tokens: **${tokens}**\n` +
      `• Rolls: **${rolls}**`
  };
}

async function runDungeon(userId, type = 'void') {
  const teamPower = await getTeamPower(userId);
  if (teamPower <= 0) return 'You need a team first. Use /team.';

  const difficulty = { fire: 3500, shadow: 6500, ice: 9000, void: 14000 }[type] || 5000;
  const won = teamPower >= difficulty || Math.random() < Math.min(0.75, teamPower / difficulty / 2);

  if (!won) return `🏰 **${type} Dungeon Failed**\nRequired Power: ${difficulty.toLocaleString('en-US')}\nYour Power: ${teamPower.toLocaleString('en-US')}`;

  const gold = Math.floor(difficulty / 2 + Math.random() * 1500);
  const tokens = Math.random() < 0.2 ? 0 : Math.floor(4 + difficulty / 2500 + Math.random() * 8);
  const rolls = Math.random() < 0.35 ? 1 : 0;

  await prisma.user.update({ where: { id: userId }, data: { gold: { increment: gold }, tokens: { increment: tokens }, rolls: { increment: rolls } } });

  return `🏰 **${type} Dungeon Cleared!**\nRewards:\n• Gold: ${gold.toLocaleString('en-US')}\n• Tokens: ${tokens}\n• Rolls: ${rolls}`;
}

async function fightBoss(userId, limited = false) {
  const teamPower = await getTeamPower(userId);
  const required = limited ? 18000 : 8000;
  const name = limited ? 'Sukuna, King of Curses' : 'Void King';

  if (teamPower <= 0) return 'You need a team first. Use /team.';

  const won = teamPower >= required || Math.random() < Math.min(0.6, teamPower / required / 2);
  if (!won) return `👹 **${name} defeated you.**\nRequired Power: ${required.toLocaleString('en-US')}\nYour Power: ${teamPower.toLocaleString('en-US')}`;

  const gold = limited ? 8000 : 3500;
  const tokens = limited ? 20 : 10;
  const rolls = limited ? 8 : 3;

  await prisma.user.update({ where: { id: userId }, data: { gold: { increment: gold }, tokens: { increment: tokens }, rolls: { increment: rolls } } });

  return `👑 **${name} Defeated!**\nRewards:\n• Gold: ${gold.toLocaleString('en-US')}\n• Tokens: ${tokens}\n• Rolls: ${rolls}`;
}

async function climbTower(userId) {
  const teamPower = await getTeamPower(userId);
  if (teamPower <= 0) return 'You need a team first. Use /team.';

  const floor = Math.max(1, Math.floor(teamPower / 1300));
  const rewardGold = floor * 450;
  const rewardTokens = Math.floor(floor / 5);
  const rewardRolls = Math.floor(floor / 8);

  await prisma.user.update({ where: { id: userId }, data: { gold: { increment: rewardGold }, tokens: { increment: rewardTokens }, rolls: { increment: rewardRolls } } });

  return `🗼 **Tower Cleared**\nReached Floor: **${floor}**\nRewards:\n• Gold: ${rewardGold.toLocaleString('en-US')}\n• Tokens: ${rewardTokens}\n• Rolls: ${rewardRolls}`;
}

async function sacrificeCard(userId, mainCardId, sacrificeCardId) {
  if (mainCardId === sacrificeCardId) throw new Error('You cannot sacrifice the same card you are upgrading.');

  const main = await prisma.userCard.findFirst({ where: { id: mainCardId, userId }, include: { character: true } });
  const sacrifice = await prisma.userCard.findFirst({ where: { id: sacrificeCardId, userId }, include: { character: true } });

  if (!main) throw new Error('Main card not found.');
  if (!sacrifice) throw new Error('Sacrifice card not found.');
  if (sacrifice.locked) throw new Error('This sacrifice card is locked.');

  const gain = RARITY_XP[sacrifice.character.rarity] || 50;
  const powerGain = Math.floor(gain / 4);

  await prisma.$transaction([
    prisma.userCard.update({ where: { id: main.id }, data: { xp: { increment: gain }, power: { increment: powerGain } } }),
    prisma.userCard.delete({ where: { id: sacrifice.id } })
  ]);

  return `🔥 **Sacrifice Complete**\n${sacrifice.character.name} was sacrificed.\n${main.character.name} gained **${gain} XP** and **+${powerGain} PWR**.`;
}

async function claimPassiveFarm(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { cards: { include: { character: true } } } });
  if (!user || !user.cards.length) return { message: 'You do not have any cards farming yet. Roll cards first.' };

  const now = new Date();
  const last = user.lastPassiveClaimAt || user.createdAt || now;
  const hours = Math.min(12, Math.max(0, Math.floor((now - last) / (1000 * 60 * 60))));

  if (hours <= 0) return { message: 'Your cards are still farming. Come back later.' };

  let gold = 0;
  let tokenFloat = 0;
  let rollFloat = 0;

  for (const card of user.cards) {
    const mult = RARITY_FARM[card.character.rarity] || RARITY_FARM.COMMON;
    gold += Math.floor((mult.gold + card.power * 0.015) * hours);
    tokenFloat += mult.tokens * hours;
    rollFloat += mult.rolls * hours;
  }

  const tokens = Math.floor(tokenFloat);
  const rolls = Math.floor(rollFloat);

  await prisma.user.update({ where: { id: userId }, data: { gold: { increment: gold }, tokens: { increment: tokens }, rolls: { increment: rolls }, lastPassiveClaimAt: now } });

  return { message: `📦 **Passive Farm Claimed**\nHours: ${hours}\nCards Farming: ${user.cards.length}\nRewards:\n• Gold: ${gold.toLocaleString('en-US')}\n• Tokens: ${tokens}\n• Rolls: ${rolls}` };
}

module.exports = {
  setTeamSlot,
  getTeam,
  getTeamPower,
  playStory,
  runDungeon,
  fightBoss,
  climbTower,
  sacrificeCard,
  claimPassiveFarm
};
