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
  let protectedCards = 0;

  for (const card of cards) {
    const currentPower = Number(card.power || 0);
    const stars = getStars(card);
    const basePower = Number(card.character?.basePower || currentPower || 0);
    const starBonus = Math.floor(basePower * 0.10 * stars);
    const minimumPower = basePower + starBonus;

    // مهم جدًا:
    // لا ننزل قوة الكرت أبدًا، لأن اللاعب ممكن يكون مطوره بـ train/ascend.
    // فقط نرفع الكرت إذا كان أقل من القوة الأساسية الجديدة.
    const targetPower = Math.max(currentPower, minimumPower);

    if (targetPower !== currentPower) {
      await prisma.userCard.update({
        where: { id: card.id },
        data: { power: targetPower }
      });
      updated++;
    } else {
      protectedCards++;
    }
  }

  console.log(`[PowerSync Safe] Raised ${updated} cards, protected ${protectedCards} upgraded cards`);
}

module.exports = { syncAllCardPowers };
