const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const { sacrificeXp } = require('./economy');

function bar(current, max, size = 14) {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

function getTechnique(name = '') {
  const n = name.toLowerCase();
  if (n.includes('gojo')) return 'Hollow Purple';
  if (n.includes('sukuna')) return 'Malevolent Shrine';
  if (n.includes('naruto')) return 'Rasengan Barrage';
  if (n.includes('sasuke')) return 'Amaterasu';
  if (n.includes('luffy')) return 'Bajrang Gun';
  if (n.includes('zoro')) return 'King of Hell';
  if (n.includes('ichigo')) return 'Getsuga Tensho';
  if (n.includes('tanjiro')) return 'Sun Breathing';
  if (n.includes('goku')) return 'Kamehameha';
  if (n.includes('madara')) return 'Perfect Susanoo';
  if (n.includes('aizen')) return 'Kyoka Suigetsu';
  if (n.includes('muzan')) return 'Demon Blood Art';
  if (n.includes('yugi')) return 'Heart of the Cards';
  return 'Ultimate Art';
}

const enemyPools = [
  ['Konohamaru', 'Usopp', 'Krillin', 'Zenitsu', 'Rock Lee'],
  ['Bakugo', 'Todoroki', 'Mikasa', 'Megumi', 'Sanji'],
  ['Akaza', 'Toji', 'Kakashi', 'Law', 'Hisoka'],
  ['Muzan', 'Pain', 'Doflamingo', 'Meruem', 'Acnologia'],
  ['Sukuna', 'Madara', 'Aizen', 'Kaido', 'Yhwach']
];

function enemyTeamFor(stagePower) {
  const tier = Math.min(enemyPools.length - 1, Math.floor(stagePower / 8000));
  const pool = enemyPools[tier];
  return Array.from({ length: 5 }, (_, i) => {
    const name = pool[(stagePower + i) % pool.length];
    const power = Math.floor(stagePower / 5) + (i * 120);
    return {
      name,
      hp: 900 + power * 2,
      maxHp: 900 + power * 2,
      damage: 120 + Math.floor(power / 8),
      mana: 0,
      technique: getTechnique(name)
    };
  });
}

async function getOrCreateProgress(userId) {
  let progress = await prisma.storyProgress.findUnique({ where: { userId } });
  if (!progress) {
    progress = await prisma.storyProgress.create({ data: { id: nanoid(), userId } });
  }
  return progress;
}

async function getTeam(userId) {
  const slots = await prisma.teamSlot.findMany({
    where: { userId }, include: { card: { include: { character: true } } }, orderBy: { slot: 'asc' }
  });
  if (slots.length) return slots.map(s => s.card);
  return prisma.userCard.findMany({
    where: { userId }, include: { character: true }, orderBy: { power: 'desc' }, take: 5
  });
}

function teamPower(team) {
  return team.reduce((sum, c) => sum + c.power, 0);
}

async function setTeamSlot(userId, slot, cardId) {
  if (slot < 1 || slot > 5) throw new Error('Team slot must be from 1 to 5.');
  const card = await prisma.userCard.findFirst({ where: { id: cardId, userId } });
  if (!card) throw new Error('Card not found in your inventory.');
  return prisma.teamSlot.upsert({
    where: { userId_slot: { userId, slot } },
    update: { cardId },
    create: { id: nanoid(), userId, slot, cardId }
  });
}

async function showTeam(userId) {
  const team = await getTeam(userId);
  if (!team.length) return 'You do not have a team yet. Roll cards first.';
  return team.map((c, i) => `${i + 1}. ${c.character.name} • ${c.character.rarity} • PWR ${c.power}`).join('\n');
}


async function maybeDropStageItem(userId, mode, difficulty) {
  const chance = mode === 'story' ? 0.35 : mode === 'dungeon' ? 0.55 : 0.45;
  if (Math.random() > chance) return null;

  const rarityRoll = Math.random();
  let rarity = 'COMMON';
  if (difficulty > 25000 && rarityRoll > 0.985) rarity = 'DIVINE';
  else if (difficulty > 14000 && rarityRoll > 0.955) rarity = 'MYTHIC';
  else if (difficulty > 8000 && rarityRoll > 0.88) rarity = 'LEGENDARY';
  else if (rarityRoll > 0.70) rarity = 'EPIC';
  else if (rarityRoll > 0.40) rarity = 'RARE';

  let templates = await prisma.equipmentTemplate.findMany({ where: { active: true, rarity } });
  if (!templates.length) templates = await prisma.equipmentTemplate.findMany({ where: { active: true } });
  if (!templates.length) return null;

  const template = templates[Math.floor(Math.random() * templates.length)];
  const item = await prisma.userEquipment.create({
    data: {
      id: nanoid(),
      userId,
      templateId: template.id,
      power: template.basePower + Math.floor(difficulty / 50) + Math.floor(Math.random() * 120)
    }
  });

  return { item, template };
}

async function battle(userId, mode = 'story') {
  const progress = await getOrCreateProgress(userId);
  const team = await getTeam(userId);
  if (!team.length) throw new Error('You need at least 1 card to fight.');

  const chapter = progress.chapter;
  const stage = mode === 'story' ? progress.stage : mode === 'dungeon' ? progress.dungeonFloor : progress.towerFloor;
  const baseDifficulty = mode === 'story' ? (chapter * 450 + stage * 180) : mode === 'dungeon' ? stage * 620 : stage * 780;
  const enemies = enemyTeamFor(baseDifficulty);

  const allies = team.map(c => ({
    name: c.character.name,
    hp: 1200 + c.power * 2,
    maxHp: 1200 + c.power * 2,
    damage: 120 + Math.floor(c.power / 7),
    mana: 0,
    technique: getTechnique(c.character.name)
  }));

  const logs = [];
  let round = 1;
  while (round <= 8 && allies.some(x => x.hp > 0) && enemies.some(x => x.hp > 0)) {
    const a = allies.find(x => x.hp > 0);
    const e = enemies.find(x => x.hp > 0);
    if (!a || !e) break;

    a.mana += 35;
    let dmg = a.damage + Math.floor(Math.random() * 140);
    if (a.mana >= 100) {
      dmg = Math.floor(dmg * 2.7);
      a.mana = 0;
      logs.push(`🔥 ${a.name} used ${a.technique} on ${e.name} for ${dmg} damage.`);
    } else {
      logs.push(`⚔️ ${a.name} hit ${e.name} for ${dmg}. Mana ${a.mana}/100.`);
    }
    e.hp -= dmg;
    if (e.hp <= 0) logs.push(`💀 ${e.name} was defeated.`);
    if (!enemies.some(x => x.hp > 0)) break;

    const enemy = enemies.find(x => x.hp > 0);
    const target = allies.find(x => x.hp > 0);
    enemy.mana += 30;
    let edmg = enemy.damage + Math.floor(Math.random() * 120);
    if (enemy.mana >= 100) {
      edmg = Math.floor(edmg * 2.5);
      enemy.mana = 0;
      logs.push(`👹 ${enemy.name} used ${enemy.technique} on ${target.name} for ${edmg} damage.`);
    } else {
      logs.push(`🩸 ${enemy.name} hit ${target.name} for ${edmg}. Mana ${enemy.mana}/100.`);
    }
    target.hp -= edmg;
    if (target.hp <= 0) logs.push(`☠️ ${target.name} was knocked out.`);
    round++;
  }

  const won = enemies.every(e => e.hp <= 0) || teamPower(team) >= baseDifficulty * 1.2;
  const gold = won ? 800 + baseDifficulty : 100;
  const tokens = won ? Math.max(2, Math.floor(baseDifficulty / 900)) : 0;
  const rolls = won ? 1 : 0;
  const itemDrop = won ? await maybeDropStageItem(userId, mode, baseDifficulty) : null;

  if (won) {
    await prisma.user.update({ where: { id: userId }, data: { gold: { increment: gold }, tokens: { increment: tokens }, rolls: { increment: rolls } } });
    if (mode === 'story') {
      let nextStage = progress.stage + 1;
      let nextChapter = progress.chapter;
      if (nextStage > 30) { nextStage = 1; nextChapter = Math.min(60, nextChapter + 1); }
      await prisma.storyProgress.update({ where: { userId }, data: { chapter: nextChapter, stage: nextStage } });
    } else if (mode === 'dungeon') {
      await prisma.storyProgress.update({ where: { userId }, data: { dungeonFloor: { increment: 1 } } });
    } else {
      await prisma.storyProgress.update({ where: { userId }, data: { towerFloor: { increment: 1 } } });
    }
  }

  const enemyStatus = enemies.map(e => `${e.name}: ${bar(Math.max(0, e.hp), e.maxHp)} ${Math.max(0, e.hp)}/${e.maxHp}`).join('\n');
  const allyStatus = allies.map(a => `${a.name}: ${bar(Math.max(0, a.hp), a.maxHp)} ${Math.max(0, a.hp)}/${a.maxHp}`).join('\n');

  return { won, chapter, stage, logs: logs.slice(-12), enemyStatus, allyStatus, gold, tokens, rolls, itemDrop, power: teamPower(team), required: baseDifficulty };
}

async function sacrifice(userId, mainCardId, sacrificeCardId) {
  if (mainCardId === sacrificeCardId) throw new Error('You cannot sacrifice the same card.');
  const main = await prisma.userCard.findFirst({ where: { id: mainCardId, userId }, include: { character: true } });
  const food = await prisma.userCard.findFirst({ where: { id: sacrificeCardId, userId }, include: { character: true } });
  if (!main || !food) throw new Error('Card not found.');
  const gain = sacrificeXp(food.character.rarity);
  const newPower = main.power + gain;
  await prisma.$transaction([
    prisma.userCard.update({ where: { id: main.id }, data: { power: newPower, xp: { increment: gain } } }),
    prisma.userCard.delete({ where: { id: food.id } })
  ]);
  return { main, food, gain, newPower };
}

async function previewProgress(userId, mode) {
  const p = await getOrCreateProgress(userId);
  const team = await getTeam(userId);
  const pwr = teamPower(team);
  const stage = mode === 'story' ? p.stage : mode === 'dungeon' ? p.dungeonFloor : p.towerFloor;
  const chapter = p.chapter;
  const req = mode === 'story' ? (chapter * 450 + stage * 180) : mode === 'dungeon' ? stage * 620 : stage * 780;
  return { p, pwr, req, stage, chapter };
}

module.exports = { battle, sacrifice, setTeamSlot, showTeam, previewProgress, getTeam, teamPower, getTechnique };
