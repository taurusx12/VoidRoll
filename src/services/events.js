const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const { getTeam, teamPower, getTechnique } = require('./gameplay');

const BOSSES = [
  { name: 'Sukuna', power: 90000, hpMult: 12, rewardGold: 250000, rewardTokens: 250 },
  { name: 'Madara Uchiha', power: 110000, hpMult: 12, rewardGold: 300000, rewardTokens: 300 },
  { name: 'Aizen Sosuke', power: 125000, hpMult: 13, rewardGold: 350000, rewardTokens: 350 },
  { name: 'Kaido', power: 140000, hpMult: 14, rewardGold: 420000, rewardTokens: 420 },
  { name: 'Muzan Kibutsuji', power: 100000, hpMult: 12, rewardGold: 260000, rewardTokens: 260 },
  { name: 'Yhwach', power: 160000, hpMult: 15, rewardGold: 550000, rewardTokens: 500 },
  { name: 'Gojo Satoru', power: 150000, hpMult: 14, rewardGold: 500000, rewardTokens: 480 },
  { name: 'Gear 5 Luffy', power: 145000, hpMult: 14, rewardGold: 460000, rewardTokens: 450 }
];

function bar(current, max, size = 18) {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

function bossImage(name = '') {
  const n = name.toLowerCase();
  if (n.includes('sukuna')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b163930-zAZmUXNn3u0K.png';
  if (n.includes('madara')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b63279-Cxhmn9zCw93g.png';
  if (n.includes('aizen')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b1375-9R8hQQ78M8A8.png';
  if (n.includes('kaido')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b12753-rN1P4hjlLM1s.png';
  if (n.includes('muzan')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b127518-qmrKJuZ7e86p.png';
  if (n.includes('yhwach')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b13016-TYDbloDTA0cs.png';
  if (n.includes('gojo')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b164471-3G0ruLQyZfQ5.png';
  if (n.includes('luffy')) return 'https://s4.anilist.co/file/anilistcdn/character/large/b40-MjsZ83asjQpR.png';
  return null;
}


async function dropBossRewardItem(userId, bossPower) {
  const roll = Math.random();
  let rarity = 'LEGENDARY';
  if (roll > 0.985) rarity = 'SECRET';
  else if (roll > 0.94) rarity = 'DIVINE';
  else if (roll > 0.78) rarity = 'MYTHIC';

  let templates = await prisma.equipmentTemplate.findMany({ where: { active: true, rarity } });
  if (!templates.length) templates = await prisma.equipmentTemplate.findMany({ where: { active: true } });
  if (!templates.length) return null;

  const template = templates[Math.floor(Math.random() * templates.length)];
  const item = await prisma.userEquipment.create({
    data: {
      id: nanoid(),
      userId,
      templateId: template.id,
      power: template.basePower + Math.floor(bossPower / 80) + Math.floor(Math.random() * 500)
    }
  });

  return { item, template };
}

async function getActiveEvent() {
  return prisma.bossEvent.findFirst({
    where: { status: { in: ['JOINING', 'ACTIVE'] } },
    orderBy: { createdAt: 'desc' },
    include: { entries: { include: { user: true } } }
  });
}

async function createBossEvent() {
  const existing = await getActiveEvent();
  if (existing) return existing;

  const now = new Date();
  const boss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
  const joinMinutes = Number(process.env.BOSS_JOIN_MINUTES || 3);
  const joinEndsAt = new Date(now.getTime() + joinMinutes * 60 * 1000);

  return prisma.bossEvent.create({
    data: {
      id: nanoid(),
      bossName: boss.name,
      bossPower: boss.power,
      bossHp: boss.power * boss.hpMult,
      status: 'JOINING',
      joinEndsAt,
      rewardGold: boss.rewardGold,
      rewardTokens: boss.rewardTokens
    },
    include: { entries: { include: { user: true } } }
  });
}

async function joinEvent(userId, eventId = null) {
  const event = eventId
    ? await prisma.bossEvent.findUnique({ where: { id: eventId } })
    : await getActiveEvent();

  if (!event) throw new Error('No boss event is active right now.');
  if (event.status !== 'JOINING') throw new Error('This boss event already started.');
  if (new Date() > event.joinEndsAt) throw new Error('Join time is over.');

  await prisma.bossEventEntry.upsert({
    where: { eventId_userId: { eventId: event.id, userId } },
    update: {},
    create: { id: nanoid(), eventId: event.id, userId }
  });

  return prisma.bossEvent.findUnique({
    where: { id: event.id },
    include: { entries: { include: { user: true } } }
  });
}

async function runEventBattle(eventId = null) {
  const event = eventId
    ? await prisma.bossEvent.findUnique({ where: { id: eventId }, include: { entries: { include: { user: true } } } })
    : await prisma.bossEvent.findFirst({ where: { status: 'JOINING' }, include: { entries: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });

  if (!event) return null;
  if (event.status !== 'JOINING') return null;
  if (new Date() < event.joinEndsAt) return { waiting: true, event };

  await prisma.bossEvent.update({ where: { id: event.id }, data: { status: 'ACTIVE' } });

  let bossHp = event.bossHp;
  const logs = [];

  if (!event.entries.length) {
    await prisma.bossEvent.update({ where: { id: event.id }, data: { status: 'ENDED', battleEndsAt: new Date() } });
    return { waiting: false, event, won: false, logs: ['Nobody joined the boss event. The boss vanished into the void.'], statusText: `${event.bossName}: ${bar(bossHp, event.bossHp)} ${bossHp}/${event.bossHp}` };
  }

  for (const entry of event.entries) {
    const team = await getTeam(entry.userId);
    if (!team.length) {
      logs.push(`⚠️ ${entry.user.username || entry.userId} joined, but has no team.`);
      continue;
    }

    const pwr = teamPower(team);
    const teamNames = team.map(c => c.character.name).join(', ');
    let totalDamage = 0;

    for (const card of team) {
      let hit = Math.floor(card.power * (0.25 + Math.random() * 0.25));
      if (Math.random() < 0.18) hit = Math.floor(hit * 1.75);
      totalDamage += hit;
      if (logs.length < 14) logs.push(`⚔️ ${card.character.name} hit ${event.bossName} for ${hit}.`);
    }

    const lead = team[0];
    if (Math.random() < 0.55 && lead) {
      const ult = Math.floor(pwr * (0.6 + Math.random() * 0.35));
      totalDamage += ult;
      if (logs.length < 16) logs.push(`🔥 ${lead.character.name} used ${getTechnique(lead.character.name)} for ${ult}.`);
    }

    bossHp -= totalDamage;
    if (logs.length < 18) logs.push(`👥 ${entry.user.username || entry.userId}'s team: ${teamNames}. Total damage: ${totalDamage}.`);
    await prisma.bossEventEntry.update({ where: { id: entry.id }, data: { damage: totalDamage } });
  }

  const won = bossHp <= 0;

  if (won) {
    const totalPlayers = event.entries.length || 1;
    for (const entry of event.entries) {
      const rewardGold = Math.floor(event.rewardGold / totalPlayers) + 50000;
      const rewardTokens = Math.floor(event.rewardTokens / totalPlayers) + 40;
      await prisma.user.update({
        where: { id: entry.userId },
        data: {
          gold: { increment: rewardGold },
          tokens: { increment: rewardTokens },
          rolls: { increment: 20 }
        }
      });
      const drop = await dropBossRewardItem(entry.userId, event.bossPower);
      if (drop && logs.length < 20) logs.push(`🎁 ${entry.user.username || entry.userId} earned ${drop.template.name} (${drop.template.rarity}).`);
    }
  }

  const statusText = `${event.bossName}: ${bar(Math.max(0, bossHp), event.bossHp)} ${Math.max(0, bossHp)}/${event.bossHp}`;
  await prisma.bossEvent.update({ where: { id: event.id }, data: { status: 'ENDED', battleEndsAt: new Date() } });

  return { waiting: false, event, won, logs, statusText };
}

async function eventStatus() {
  return getActiveEvent();
}

module.exports = { BOSSES, bossImage, createBossEvent, getActiveEvent, joinEvent, runEventBattle, eventStatus, bar };
