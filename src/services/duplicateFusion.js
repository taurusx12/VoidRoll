function getStars(card) {
  const trait = String(card?.trait || '');
  const match = trait.match(/STAR:(\d+)/);
  return Math.max(0, Number(match?.[1] || 0));
}

function setStarsTrait(oldTrait, stars) {
  const clean = String(oldTrait || '').replace(/STAR:\d+/g, '').trim();
  return `${clean} STAR:${Math.max(0, stars)}`.trim();
}

function starLabel(card) {
  const stars = getStars(card);
  if (!stars) return '';
  return ` ⭐${stars}`;
}

async function autoFuseDuplicates(prisma, userId) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: [
      { characterId: 'asc' },
      { power: 'desc' },
      { obtainedAt: 'asc' }
    ]
  });

  const groups = new Map();

  for (const card of cards) {
    if (!groups.has(card.characterId)) groups.set(card.characterId, []);
    groups.get(card.characterId).push(card);
  }

  const results = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    group.sort((a, b) => {
      const starDiff = getStars(b) - getStars(a);
      if (starDiff !== 0) return starDiff;
      return (b.power || 0) - (a.power || 0);
    });

    const keeper = group[0];
    const duplicates = group.slice(1);

    const currentStars = getStars(keeper);
    const gainedStars = duplicates.reduce((sum, c) => sum + 1 + getStars(c), 0);
    const newStars = Math.min(10, currentStars + gainedStars);

    const duplicatePower = duplicates.reduce((sum, c) => sum + Number(c.power || 0), 0);
    const baseBonus = Math.floor(Number(keeper.character?.basePower || 0) * 0.10 * gainedStars);
    const absorbBonus = Math.floor(duplicatePower * 0.18);
    const powerGain = Math.max(1, baseBonus + absorbBonus);

    await prisma.$transaction([
      prisma.teamSlot.deleteMany({
        where: {
          userId,
          cardId: { in: duplicates.map(c => c.id) }
        }
      }),
      prisma.marketListing.updateMany({
        where: {
          cardId: { in: duplicates.map(c => c.id) },
          status: 'ACTIVE'
        },
        data: { status: 'CANCELLED' }
      }),
      prisma.userCard.deleteMany({
        where: {
          id: { in: duplicates.map(c => c.id) }
        }
      }),
      prisma.userCard.update({
        where: { id: keeper.id },
        data: {
          power: { increment: powerGain },
          trait: setStarsTrait(keeper.trait, newStars)
        }
      })
    ]);

    results.push({
      characterName: keeper.character?.name || 'Unknown',
      stars: newStars,
      powerGain,
      removed: duplicates.length
    });
  }

  return results;
}

function fusionText(results) {
  if (!results || !results.length) return '';
  const lines = results.slice(0, 10).map(r =>
    `⭐ **${r.characterName}** fused duplicates → **${r.stars} Star** (+${r.powerGain} Power)`
  );

  return `\n\n**Auto Fusion**\n${lines.join('\n')}`;
}

module.exports = {
  getStars,
  starLabel,
  autoFuseDuplicates,
  fusionText
};
