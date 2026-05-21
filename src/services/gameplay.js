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

function money(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function hpFromPower(power) {
  return Math.max(120, Math.floor(power * 4.5));
}

function dmgFromPower(power) {
  const low = Math.floor(power * 0.14);
  const high = Math.floor(power * 0.25);
  return low + Math.floor(Math.random() * Math.max(1, high - low));
}

function bar(current, max, size = 12) {
  const pct = max <= 0 ? 0 : clamp(current / max, 0, 1);
  const filled = Math.round(pct * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
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
  return `${rarityEmoji(c.character.rarity)} ${c.character.name} • ${c.character.rarity} • PWR ${money(c.power)}`;
}

function teamPower(cards) {
  return cards.reduce((s, c) => s + c.power, 0);
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

  return slots.map(s => s.card).filter(Boolean);
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
      data: { id: nanoid(), userId, slot: i + 1, cardId: cards[i].id }
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

  if (!slots.length) return { text: 'You do not have a team yet. Use `/team auto` or `/team set`.' };

  const power = slots.reduce((s, x) => s + x.card.power, 0);
  const text = slots.map(s => `Slot ${s.slot}: ${shortCard(s.card)}`).join('\n');

  return { text, power };
}

function storyStatus(user) {
  const chapter = user.storyChapter || 1;
  const stage = user.storyStage || 1;
  const isBoss = stage % 5 === 0;
  const isFinal = stage === 30;
  const enemyPower = Math.floor(700 + chapter * 380 + stage * 95 + (isBoss ? chapter * 600 + stage * 70 : 0) + (isFinal ? chapter * 1200 : 0));
  const enemyName = isFinal ? `Chapter ${chapter} Final Boss` : isBoss ? `Chapter ${chapter} Stage ${stage} Boss` : `Chapter ${chapter} Enemy Squad`;
  return { chapter, stage, isBoss, isFinal, enemyPower, enemyName };
}

function dungeonStatus(user) {
  const stage = user.dungeonStage || 1;
  const isBoss = stage % 5 === 0;
  const enemyPower = Math.floor(1800 + stage * 520 + (isBoss ? stage * 450 : 0));
  const enemyName = isBoss ? `Dungeon Stage ${stage} Boss` : `Dungeon Stage ${stage} Monsters`;
  return {
    stage,
    isBoss,
    enemyPower,
    enemyName,
    gold: Math.floor(1000 + stage * 320 + (isBoss ? 2200 : 0)),
    tokens: isBoss ? 12 + Math.floor(stage / 5) : 3 + Math.floor(stage / 10),
    rolls: isBoss ? 3 : 0
  };
}

function towerStatus(user) {
  const floor = user.towerFloor || 1;
  return {
    floor,
    enemyName: `Tower Floor ${floor}`,
    enemyPower: Math.floor(1200 + floor * 500 + Math.pow(floor, 1.35) * 120),
    gold: Math.floor(1000 + floor * 350),
    tokens: Math.floor(2 + floor / 3),
    rolls: floor % 5 === 0 ? 5 : 1
  };
}

function bossList() {
  return [
    { name: 'Shadow Beast', enemyPower: 2500, gold: 2000, tokens: 4, rolls: 0 },
    { name: 'Flame Tyrant', enemyPower: 5000, gold: 4500, tokens: 9, rolls: 1 },
    { name: 'Void King', enemyPower: 10000, gold: 10000, tokens: 20, rolls: 3 }
  ];
}

function limitedBoss() {
  return { name: 'Sukuna, King of Curses', enemyPower: 15000, gold: 18000, tokens: 35, rolls: 10 };
}

function makeEnemyTeam(enemyName, enemyPower, count = 5) {
  const each = Math.max(100, Math.floor(enemyPower / count));
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const power = Math.floor(each * (0.8 + Math.random() * 0.4));
    enemies.push({
      name: count === 1 ? enemyName : `${enemyName} ${i + 1}`,
      power,
      hp: hpFromPower(power),
      maxHp: hpFromPower(power)
    });
  }
  return enemies;
}

function makePlayerTeam(cards) {
  return cards.map(c => ({
    id: c.id,
    name: c.character.name,
    rarity: c.character.rarity,
    power: c.power,
    hp: hpFromPower(c.power),
    maxHp: hpFromPower(c.power)
  }));
}

function alive(units) {
  return units.filter(x => x.hp > 0);
}

function simulateLiveBattle(cards, enemyData) {
  const players = makePlayerTeam(cards);
  const enemies = makeEnemyTeam(enemyData.enemyName || enemyData.name, enemyData.enemyPower || enemyData.power, 5);
  const snapshots = [];
  const logs = [];

  const push = (title) => {
    snapshots.push({
      title,
      players: players.map(x => ({ ...x })),
      enemies: enemies.map(x => ({ ...x })),
      logs: logs.slice(-6)
    });
  };

  push('Battle Started');

  for (let turn = 1; turn <= 20; turn++) {
    for (const p of alive(players)) {
      const targets = alive(enemies);
      if (!targets.length) break;
      const target = targets[Math.floor(Math.random() * targets.length)];
      let dmg = dmgFromPower(p.power);
      const crit = Math.random() < 0.12;
      if (crit) dmg = Math.floor(dmg * 1.8);
      target.hp = Math.max(0, target.hp - dmg);
      logs.push(`⚔️ ${p.name} hit ${target.name} for ${money(dmg)}${crit ? ' CRIT' : ''}.`);
      push(`Turn ${turn} • Your Attack`);
    }

    if (!alive(enemies).length) break;

    for (const e of alive(enemies)) {
      const targets = alive(players);
      if (!targets.length) break;
      const target = targets[Math.floor(Math.random() * targets.length)];
      let dmg = dmgFromPower(e.power);
      target.hp = Math.max(0, target.hp - dmg);
      logs.push(`💥 ${e.name} hit ${target.name} for ${money(dmg)}.`);
      push(`Turn ${turn} • Enemy Attack`);
    }

    if (!alive(players).length) break;
  }

  const win = alive(enemies).length === 0;
  const playerPower = teamPower(cards);
  const enemyPower = enemyData.enemyPower || enemyData.power;

  snapshots.push({
    title: win ? 'Victory' : 'Defeat',
    players: players.map(x => ({ ...x })),
    enemies: enemies.map(x => ({ ...x })),
    logs: logs.slice(-6),
    final: true
  });

  return { win, snapshots, teamPower: playerPower, enemyPower };
}

function formatSnapshot(snapshot, meta = {}) {
  const teamHp = snapshot.players.reduce((s, x) => s + x.hp, 0);
  const teamMax = snapshot.players.reduce((s, x) => s + x.maxHp, 0);
  const enemyHp = snapshot.enemies.reduce((s, x) => s + x.hp, 0);
  const enemyMax = snapshot.enemies.reduce((s, x) => s + x.maxHp, 0);

  const alivePlayers = snapshot.players.filter(x => x.hp > 0).length;
  const aliveEnemies = snapshot.enemies.filter(x => x.hp > 0).length;

  return (
    `**${snapshot.title}**\n` +
    `${meta.label ? `${meta.label}\n` : ''}` +
    `Your Team: ${bar(teamHp, teamMax)} ${money(teamHp)}/${money(teamMax)} HP • Alive ${alivePlayers}/5\n` +
    `Enemy Team: ${bar(enemyHp, enemyMax)} ${money(enemyHp)}/${money(enemyMax)} HP • Alive ${aliveEnemies}/5\n\n` +
    (snapshot.logs.length ? snapshot.logs.join('\n') : 'Preparing battle...')
  );
}

async function grantRewards(userId, rewards) {
  const data = {};
  if (rewards.gold) data.gold = { increment: BigInt(rewards.gold) };
  if (rewards.tokens) data.tokens = { increment: rewards.tokens };
  if (rewards.rolls) data.rolls = { increment: rewards.rolls };
  if (rewards.xp) data.xp = { increment: rewards.xp };
  if (Object.keys(data).length) await prisma.user.update({ where: { id: userId }, data });
  return rewards;
}

function rewardsText(rewards) {
  if (!rewards) return 'No rewards earned. Upgrade your team and try again.';
  const parts = [];
  if (rewards.gold) parts.push(`${money(rewards.gold)} Gold`);
  if (rewards.tokens) parts.push(`${rewards.tokens} Tokens`);
  if (rewards.rolls) parts.push(`${rewards.rolls} Rolls`);
  if (rewards.xp) parts.push(`${rewards.xp} XP`);
  return parts.length ? parts.join(' • ') : 'No rewards.';
}

async function prepareBattle(userId, mode) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const team = await getTeam(userId);
  if (!team.length) throw new Error('You need at least 1 card. Use /roll first.');

  let enemy;
  let rewards;
  let updateProgress = async () => {};
  let logMode = mode;

  if (mode === 'story') {
    const s = storyStatus(user);
    enemy = { name: s.enemyName, enemyName: s.enemyName, enemyPower: s.enemyPower };
    rewards = {
      gold: 1000 + s.chapter * 250 + s.stage * 75 + (s.isBoss ? 1500 : 0),
      tokens: s.isFinal ? 15 : s.isBoss ? 7 : 2,
      rolls: s.isBoss ? 2 : 0,
      xp: 80 + s.chapter * 10
    };
    updateProgress = async (win) => {
      if (!win) return;
      let nextChapter = s.chapter;
      let nextStage = s.stage + 1;
      if (nextStage > 30) {
        nextStage = 1;
        nextChapter = Math.min(60, nextChapter + 1);
      }
      await prisma.user.update({ where: { id: userId }, data: { storyChapter: nextChapter, storyStage: nextStage } });
    };
  }

  if (mode === 'dungeon') {
    const d = dungeonStatus(user);
    enemy = { name: d.enemyName, enemyName: d.enemyName, enemyPower: d.enemyPower };
    rewards = { gold: d.gold, tokens: d.tokens, rolls: d.rolls, xp: 120 + d.stage * 8 };
    updateProgress = async (win) => {
      if (!win) return;
      await prisma.user.update({ where: { id: userId }, data: { dungeonStage: { increment: 1 } } });
    };
  }

  if (mode === 'tower') {
    const t = towerStatus(user);
    enemy = { name: t.enemyName, enemyName: t.enemyName, enemyPower: t.enemyPower };
    rewards = { gold: t.gold, tokens: t.tokens, rolls: t.rolls, xp: 100 + t.floor * 8 };
    updateProgress = async (win) => {
      if (!win) return;
      await prisma.user.update({ where: { id: userId }, data: { towerFloor: { increment: 1 } } });
    };
  }

  if (mode === 'limited-boss') {
    const b = limitedBoss();
    enemy = { name: b.name, enemyName: b.name, enemyPower: b.enemyPower };
    rewards = { gold: b.gold, tokens: b.tokens, rolls: b.rolls, xp: 500 };
  }

  if (!enemy) throw new Error('Unknown battle mode.');

  const battle = simulateLiveBattle(team, enemy);

  return {
    user,
    team,
    enemy,
    battle,
    rewards,
    logMode,
    async finalize() {
      let finalRewards = null;
      if (battle.win) {
        finalRewards = rewards;
        await grantRewards(userId, rewards);
        await updateProgress(true);
      }

      await prisma.battleLog.create({
        data: {
          id: nanoid(),
          userId,
          mode: logMode,
          result: battle.win ? 'WIN' : 'LOSS',
          enemyName: enemy.enemyName,
          teamPower: battle.teamPower,
          enemyPower: battle.enemyPower,
          rewards: finalRewards || {}
        }
      });

      return finalRewards;
    }
  };
}

async function sacrificeCard(userId, mainCardId, sacrificeCardId) {
  if (mainCardId === sacrificeCardId) throw new Error('You cannot sacrifice the same card.');

  const main = await prisma.userCard.findFirst({ where: { id: mainCardId, userId }, include: { character: true } });
  if (!main) throw new Error('Main card not found.');

  const food = await prisma.userCard.findFirst({ where: { id: sacrificeCardId, userId }, include: { character: true } });
  if (!food) throw new Error('Sacrifice card not found.');
  if (food.locked) throw new Error('This card is locked.');

  const xpGain = RARITY_XP[food.character.rarity] || 50;
  const powerGain = Math.floor(xpGain * 0.55);

  await prisma.userCard.delete({ where: { id: food.id } });

  const updated = await prisma.userCard.update({
    where: { id: main.id },
    data: { xp: { increment: xpGain }, power: { increment: powerGain }, level: { increment: Math.max(1, Math.floor(xpGain / 1000)) } },
    include: { character: true }
  });

  return { main: updated, sacrificed: food, xpGain, powerGain };
}

async function claimPassiveFarm(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true } });
  if (!cards.length) return { gold: 0, tokens: 0, count: 0, hours: 0 };

  const now = new Date();
  const last = user.lastPassiveClaimAt || user.createdAt || now;
  const hours = Math.max(1, Math.min(24, Math.floor((now - last) / (1000 * 60 * 60)) || 1));

  let gold = 0;
  let tokenFloat = 0;
  for (const card of cards) {
    const rate = RARITY_FARM[card.character.rarity] || RARITY_FARM.COMMON;
    gold += Math.floor((rate.gold + card.power / 250) * hours);
    tokenFloat += rate.tokens * hours;
  }
  const tokens = Math.floor(tokenFloat);

  await grantRewards(userId, { gold, tokens });
  await prisma.user.update({ where: { id: userId }, data: { lastPassiveClaimAt: now } });

  return { gold, tokens, count: cards.length, hours };
}

module.exports = {
  autoTeam,
  setTeamSlot,
  showTeam,
  storyStatus,
  dungeonStatus,
  towerStatus,
  bossList,
  limitedBoss,
  prepareBattle,
  formatSnapshot,
  rewardsText,
  sacrificeCard,
  claimPassiveFarm
};
