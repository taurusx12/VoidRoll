const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const { getTeam, teamPower, getTechnique } = require('./gameplay');

const BOSSES = [
  { name: 'Sukuna', power: 50000 },
  { name: 'Madara Uchiha', power: 65000 },
  { name: 'Aizen Sosuke', power: 70000 },
  { name: 'Kaido', power: 80000 },
  { name: 'Muzan Kibutsuji', power: 60000 },
  { name: 'Yhwach', power: 90000 }
];

function bar(current, max, size = 18) {
  const pct = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(pct * size);
  return '█'.repeat(filled) + '░'.repeat(size - filled);
}

async function getActiveEvent() {
  const now = new Date();
  let event = await prisma.bossEvent.findFirst({ where: { status: { in: ['JOINING', 'ACTIVE'] } }, orderBy: { createdAt: 'desc' }, include: { entries: { include: { user: true } } } });
  if (event) return event;

  const boss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
  const joinEndsAt = new Date(now.getTime() + 3 * 60 * 1000);
  event = await prisma.bossEvent.create({
    data: {
      id: nanoid(),
      bossName: boss.name,
      bossPower: boss.power,
      bossHp: boss.power * 8,
      status: 'JOINING',
      joinEndsAt,
      rewardGold: 100000,
      rewardTokens: 120
    },
    include: { entries: { include: { user: true } } }
  });
  return event;
}

async function joinEvent(userId) {
  const event = await getActiveEvent();
  if (event.status !== 'JOINING') throw new Error('This boss event already started.');
  if (new Date() > event.joinEndsAt) throw new Error('Join time is over.');
  await prisma.bossEventEntry.upsert({
    where: { eventId_userId: { eventId: event.id, userId } },
    update: {},
    create: { id: nanoid(), eventId: event.id, userId }
  });
  return event;
}

async function runEventBattle() {
  const event = await prisma.bossEvent.findFirst({ where: { status: 'JOINING' }, include: { entries: { include: { user: true } } }, orderBy: { createdAt: 'desc' } });
  if (!event) return null;
  if (new Date() < event.joinEndsAt) return { waiting: true, event };

  await prisma.bossEvent.update({ where: { id: event.id }, data: { status: 'ACTIVE' } });

  let bossHp = event.bossHp;
  const logs = [];
  for (const entry of event.entries) {
    const team = await getTeam(entry.userId);
    if (!team.length) continue;
    const pwr = teamPower(team);
    let damage = Math.floor(pwr * (0.55 + Math.random() * 0.35));
    const names = team.map(c => c.character.name).join(', ');
    const lead = team[0];
    if (Math.random() < 0.35 && lead) {
      damage = Math.floor(damage * 1.8);
      logs.push(`🔥 ${lead.character.name} used ${getTechnique(lead.character.name)}. Team: ${names}. Damage: ${damage}`);
    } else {
      logs.push(`⚔️ Team ${entry.user.username || entry.userId}: ${names}. Damage: ${damage}`);
    }
    bossHp -= damage;
    await prisma.bossEventEntry.update({ where: { id: entry.id }, data: { damage } });
  }

  const won = bossHp <= 0;
  if (won) {
    const total = event.entries.length || 1;
    for (const entry of event.entries) {
      const rewardGold = Math.floor(event.rewardGold / total) + 25000;
      const rewardTokens = Math.floor(event.rewardTokens / total) + 25;
      await prisma.user.update({ where: { id: entry.userId }, data: { gold: { increment: rewardGold }, tokens: { increment: rewardTokens }, rolls: { increment: 10 } } });
    }
  }

  const statusText = `${event.bossName}: ${bar(Math.max(0, bossHp), event.bossHp)} ${Math.max(0, bossHp)}/${event.bossHp}`;
  await prisma.bossEvent.update({ where: { id: event.id }, data: { status: 'ENDED', battleEndsAt: new Date() } });
  return { waiting: false, event, won, logs, statusText };
}

async function eventStatus() {
  const event = await getActiveEvent();
  return event;
}

module.exports = { getActiveEvent, joinEvent, runEventBattle, eventStatus };
