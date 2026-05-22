function getStars(card) {
  const trait = String(card?.trait || '');
  const match = trait.match(/STAR:(\d+)/);
  return Math.max(0, Number(match?.[1] || 0));
}

async function syncAllCardPowers(prisma) {
  const cards = await prisma.userCard.findMany({
    include: { character: true }
  });

  let updated = 0;

  for (const card of cards) {
    const stars = getStars(card);
    const basePower = Number(card.character?.basePower || card.power || 0);
    const starBonus = Math.floor(basePower * 0.10 * stars);
    const targetPower = basePower + starBonus;

    // مهم: يحدث القوة حتى لو لازم تنقص، عشان يصلح كاكاشي/قوجو وكل البطاقات القديمة.
    if (targetPower !== Number(card.power || 0)) {
      await prisma.userCard.update({
        where: { id: card.id },
        data: { power: targetPower }
      });
      updated++;
    }
  }

  console.log(`[PowerSync] Updated ${updated} old card powers`);
}

module.exports = { syncAllCardPowers };
