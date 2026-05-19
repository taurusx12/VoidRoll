const { prisma } = require('../lib/db');
async function checkCooldown(userId, key) {
  const cd = await prisma.cooldown.findUnique({ where: { userId_key: { userId, key } } });
  if (!cd || cd.expiresAt <= new Date()) return null;
  return cd.expiresAt;
}
async function setCooldown(userId, key, seconds) {
  const expiresAt = new Date(Date.now() + seconds * 1000);
  await prisma.cooldown.upsert({ where: { userId_key: { userId, key } }, update: { expiresAt }, create: { userId, key, expiresAt } });
}
module.exports = { checkCooldown, setCooldown };
