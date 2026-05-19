const { prisma } = require('../lib/db');
async function ensureUser(discordUser) {
  return prisma.user.upsert({
    where: { id: discordUser.id },
    update: { username: discordUser.username },
    create: { id: discordUser.id, username: discordUser.username }
  });
}
module.exports = { ensureUser };
