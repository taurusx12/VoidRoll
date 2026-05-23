
function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

async function findUserCardByName(prisma, userId, name) {
  const q = normalize(name);
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' }
  });

  return cards.find(c => normalize(c.character.name) === q)
    || cards.find(c => normalize(c.character.name).startsWith(q))
    || cards.find(c => normalize(c.character.name).includes(q))
    || null;
}

async function sellAllByRarity(prisma, userId, rarity) {
  const target = String(rarity).toUpperCase();
  const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true } });
  const sell = cards.filter(c => c.character.rarity === target);
  const gold = sell.reduce((sum, c) => sum + ({ COMMON:250, RARE:1000, EPIC:5000, LEGENDARY:25000, MYTHIC:90000, DIVINE:250000, SECRET:1000000 }[target] || 100), 0);
  const ids = sell.map(c => c.id);

  if (!ids.length) return { sold: 0, gold: 0 };

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({ where: { userId, cardId: { in: ids } } }),
    prisma.marketListing.updateMany({ where: { cardId: { in: ids }, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }),
    prisma.userCard.deleteMany({ where: { id: { in: ids } } }),
    prisma.user.update({ where: { id: userId }, data: { gold: { increment: gold } } })
  ]);

  return { sold: ids.length, gold };
}

module.exports = { findUserCardByName, sellAllByRarity };
