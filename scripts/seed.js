const { prisma } = require('../src/lib/db');

const chars = [
  ['Shanks','One Piece','COMMON','Haki',2500,'https://static.wikia.nocookie.net/onepiece/images/3/35/Shanks_Anime_Infobox.png'],
  ['Naruto Uzumaki','Naruto','MYTHIC','Chakra',1450,''],
  ['Gojo Satoru','Jujutsu Kaisen','DIVINE','Infinity',2600,''],
  ['Levi Ackerman','Attack on Titan','EPIC','Steel',900,''],
  ['Eren Yeager','Attack on Titan','MYTHIC','Titan',1700,'']
];

const eq = [
  ['Iron Blade','WEAPON','COMMON',20],
  ['Cursed Katana','WEAPON','EPIC',95],
  ['Infinity Cloak','ARMOR','MYTHIC',260],
  ['Demon King Ring','RING','DIVINE',420]
];

(async () => {
  await prisma.userCard.deleteMany();
  await prisma.character.deleteMany();

  for (const [name, anime, rarity, element, power, imageUrl] of chars) {
    await prisma.character.create({
      data: {
        id: `${anime}-${name}`.replace(/\s+/g, '-'),
        name,
        anime,
        rarity,
        element,
        imageUrl,
        basePower: power,
        baseFarm: Math.floor(power / 10),
        baseLuck: Math.floor(power / 30)
      }
    });
  }

  for (const [name, slot, rarity, basePower] of eq) {
    await prisma.equipmentTemplate.upsert({
      where: { id: name.replace(/\s+/g, '-') },
      update: {},
      create: { id: name.replace(/\s+/g, '-'), name, slot, rarity, basePower }
    });
  }

  console.log('Seed complete');
  await prisma.$disconnect();
})();
