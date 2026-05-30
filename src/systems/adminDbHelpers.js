// VoidRoll Reborn - Admin DB Helpers
// Optional helpers for admin commands.

const { prisma, addResource } = require('./dbAdapter');

async function giveGold(userId, amount) {
  return prisma.user.update({
    where: { id: String(userId) },
    data: { gold: { increment: Number(amount || 0) } }
  });
}

async function giveTokens(userId, amount) {
  return prisma.user.update({
    where: { id: String(userId) },
    data: { tokens: { increment: Number(amount || 0) } }
  });
}

async function giveEssence(userId, amount) {
  return prisma.user.update({
    where: { id: String(userId) },
    data: { essence: { increment: Number(amount || 0) } }
  });
}

async function giveVoidCrystals(userId, amount) {
  return prisma.user.update({
    where: { id: String(userId) },
    data: { voidCrystals: { increment: Number(amount || 0) } }
  });
}

async function giveGenericResource(userId, resource, amount) {
  return addResource(userId, resource, amount);
}

module.exports = {
  giveGold,
  giveTokens,
  giveEssence,
  giveVoidCrystals,
  giveGenericResource
};
