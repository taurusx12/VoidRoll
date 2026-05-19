const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const config = require('../lib/config');
const zones = {
  leaf: { name: 'Hidden Leaf', minPower: 0, goldPerHour: 130, resource: 'Chakra Ore' },
  cursed: { name: 'Cursed Tokyo', minPower: 250, goldPerHour: 260, resource: 'Cursed Energy' },
  soul: { name: 'Soul Society', minPower: 600, goldPerHour: 520, resource: 'Spirit Dust' },
  abyss: { name: 'Abyss Gate', minPower: 1300, goldPerHour: 1200, resource: 'Void Essence' }
};
async function deploy(userId, cardId, zoneKey, hours) {
  const zone = zones[zoneKey];
  if (!zone) throw new Error('Unknown zone');
  hours = Math.min(Math.max(1, Number(hours || 1)), config.maxDeployHours);
  const card = await prisma.userCard.findFirst({ where: { id: cardId, userId }, include: { character: true } });
  if (!card) throw new Error('Card not found');
  if (card.power < zone.minPower) throw new Error(`Card power too low. Need ${zone.minPower}`);
  return prisma.deployment.create({ data: { id: nanoid(12), userId, cardId, zone: zoneKey, endsAt: new Date(Date.now()+hours*3600*1000) } });
}
async function claim(userId) {
  const deployments = await prisma.deployment.findMany({ where: { userId, claimed: false, endsAt: { lte: new Date() } }, include: { card: true } });
  let total = 0;
  for (const dep of deployments) {
    const zone = zones[dep.zone];
    const hours = Math.max(0.1, (dep.endsAt - dep.startedAt) / 3600000);
    total += Math.floor(zone.goldPerHour * hours * (1 + dep.card.power / 1000));
  }
  if (deployments.length) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { gold: { increment: total } } }),
      prisma.deployment.updateMany({ where: { id: { in: deployments.map(d=>d.id) } }, data: { claimed: true } })
    ]);
  }
  return { count: deployments.length, total };
}
module.exports = { zones, deploy, claim };
