// DROP THIS FILE INTO src/powerSyncPatch.js

async function syncAllCardPowers(prisma) {
  const cards = await prisma.userCard.findMany({
    include: {
      character: true
    }
  });

  let updated = 0;

  for (const card of cards) {
    const targetPower = Math.max(
      Number(card.power || 0),
      Number(card.character?.basePower || 0)
    );

    if (targetPower !== Number(card.power || 0)) {
      await prisma.userCard.update({
        where: { id: card.id },
        data: {
          power: targetPower
        }
      });

      updated++;
    }
  }

  console.log(`[PowerSync] Updated ${updated} cards`);
}

module.exports = { syncAllCardPowers };
