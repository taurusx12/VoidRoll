const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
async function upgradeEquipment(userId, equipmentId) {
  return prisma.$transaction(async tx => {
    const eq = await tx.userEquipment.findFirst({ where: { id: equipmentId, userId }, include: { template: true } });
    if (!eq) throw new Error('Equipment not found');
    const cost = BigInt(200 * eq.level * eq.level);
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (user.gold < cost) throw new Error(`Need ${cost} gold`);
    const successRate = Math.max(0.35, 0.95 - eq.level * 0.035);
    const success = Math.random() < successRate;
    await tx.user.update({ where: { id: userId }, data: { gold: { decrement: cost } } });
    if (success) {
      await tx.userEquipment.update({ where: { id: equipmentId }, data: { level: { increment: 1 }, power: { increment: 8 + eq.level * 3 } } });
    }
    return { success, cost, nextLevel: success ? eq.level + 1 : eq.level };
  });
}
async function dropEquipment(userId, rarity='COMMON') {
  const templates = await prisma.equipmentTemplate.findMany({ where: { rarity, active: true } });
  if (!templates.length) return null;
  const t = templates[Math.floor(Math.random()*templates.length)];
  return prisma.userEquipment.create({ data: { id: nanoid(12), userId, templateId: t.id, power: t.basePower } });
}
module.exports = { upgradeEquipment, dropEquipment };
