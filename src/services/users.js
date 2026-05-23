const { prisma } = require('../lib/db');

async function ensureUser(discordUser) {

  let user = await prisma.user.findUnique({
    where: { id: discordUser.id }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: discordUser.id,
        username: discordUser.username,
        rolls: 15,
        tokens: 0
      }
    });

    return user;
  }

  const now = new Date();

  const lastRefill = user.lastRollRefillAt || now;

  const diffMs = now - lastRefill;

  const hoursPassed = Math.floor(diffMs / (1000 * 60 * 60));

  let newRolls = user.rolls;

  if (hoursPassed > 0) {

    newRolls += hoursPassed * 15;

    if (newRolls > 999999) {
      newRolls = 999999;
    }

    user = await prisma.user.update({
      where: { id: discordUser.id },
      data: {
        username: discordUser.username,
        rolls: newRolls,
        lastRollRefillAt: now
      }
    });

  } else {

    user = await prisma.user.update({
      where: { id: discordUser.id },
      data: {
        username: discordUser.username
      }
    });

  }

  return user;
}

module.exports = { ensureUser };
