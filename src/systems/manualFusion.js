
function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

function getStars(card) {
  const match = String(card?.trait || '').match(/STAR:(\d+)/);
  return Number(match?.[1] || 0);
}

function setStarsTrait(trait, stars) {
  const clean = String(trait || '').replace(/STAR:\d+/g, '').trim();
  return `${clean} STAR:${stars}`.trim();
}

async function fuseByName(prisma, userId, name) {
  const q = normalize(name);
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' }
  });

  const matches = cards.filter(c => normalize(c.character.name).includes(q));
  if (!matches.length) throw new Error('Character not found.');
  const characterId = matches[0].characterId;
  const same = cards.filter(c => c.characterId === characterId);

  if (same.length < 2) throw new Error('You need at least 2 copies to fuse.');

  same.sort((a, b) => getStars(b) - getStars(a) || b.power - a.power);
  const keeper = same[0];
  const consume = same[1];

  const newStars = Math.min(10, getStars(keeper) + 1 + getStars(consume));
  const powerGain = Math.floor((keeper.character.basePower || keeper.power || 0) * 0.1) + Math.floor((consume.power || 0) * 0.08);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({ where: { userId, cardId: consume.id } }),
    prisma.marketListing.updateMany({ where: { cardId: consume.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } }),
    prisma.userCard.delete({ where: { id: consume.id } }),
    prisma.userCard.update({
      where: { id: keeper.id },
      data: { power: { increment: powerGain }, trait: setStarsTrait(keeper.trait, newStars) }
    })
  ]);

  return { name: keeper.character.name, stars: newStars, powerGain };
}

async function fuseList(prisma, userId) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true }
  });

  const map = new Map();
  for (const c of cards) {
    if (!map.has(c.characterId)) map.set(c.characterId, { name: c.character.name, rarity: c.character.rarity, count: 0, maxPower: 0 });
    const row = map.get(c.characterId);
    row.count++;
    row.maxPower = Math.max(row.maxPower, c.power || 0);
  }

  return [...map.values()].filter(x => x.count >= 2).sort((a, b) => b.count - a.count);
}

module.exports = { fuseByName, fuseList, getStars };
