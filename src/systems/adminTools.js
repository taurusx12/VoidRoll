
async function resetAll(prisma) {
  await prisma.$transaction([
    prisma.teamSlot.deleteMany({}),
    prisma.marketListing.deleteMany({}),
    prisma.userEquipment.deleteMany({}),
    prisma.userCard.deleteMany({}),
    prisma.storyProgress.deleteMany({}).catch(() => prisma.$executeRaw`SELECT 1`),
    prisma.user.updateMany({ data: { gold: 0, tokens: 0, rolls: 10, xp: 0, level: 1 } })
  ]);
}

async function giveGold(prisma, userId, amount) {
  return prisma.user.update({ where: { id: userId }, data: { gold: { increment: amount } } });
}

async function giveTokens(prisma, userId, amount) {
  return prisma.user.update({ where: { id: userId }, data: { tokens: { increment: amount } } });
}

module.exports = { resetAll, giveGold, giveTokens };
