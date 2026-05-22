async function syncAllCardPowers(prisma) {
  const cards = await prisma.userCard.findMany({
    include: { character: true }
  });

  let updated = 0;

  for (const card of cards) {
    // يخلي البطاقة الموجودة عند اللاعب تتبع قوة الشخصية الجديدة
    // سواء ارتفعت أو نزلت بعد تصحيح الريرتي.
    const targetPower = Number(card.character?.basePower || card.power || 0);

    if (targetPower !== Number(card.power || 0)) {
      await prisma.userCard.update({
        where: { id: card.id },
        data: { power: targetPower }
      });

      updated++;
    }
  }

  console.log(`[PowerSync] Updated ${updated} old cards`);
}

module.exports = { syncAllCardPowers };
