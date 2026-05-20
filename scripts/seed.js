const { prisma } = require('../src/lib/db');

const chars = [
  ['Naruto Uzumaki','Naruto','MYTHIC','Chakra',1450,'https://i.imgur.com/6L89jvD.png'],
  ['Sasuke Uchiha','Naruto','MYTHIC','Lightning',1500,'https://i.imgur.com/2WZtOD6.png'],
  ['Madara Uchiha','Naruto','DIVINE','Shadow',2200,'https://i.imgur.com/4Q1bJ4V.png'],
  ['Monkey D. Luffy','One Piece','MYTHIC','Rubber',1600,'https://i.imgur.com/4AiXzf8.jpeg'],
  ['Roronoa Zoro','One Piece','LEGENDARY','Steel',1200,'https://i.imgur.com/eQp8WYM.jpeg'],
  ['Shanks','One Piece','DIVINE','Haki',2500,'https://i.imgur.com/fDUFP7K.jpeg'],
  ['Levi Ackerman','Attack on Titan','EPIC','Steel',900,'https://i.imgur.com/0y0y0y0.jpeg'],
  ['Eren Yeager','Attack on Titan','MYTHIC','Titan',1700,'https://i.imgur.com/1x1x1x1.jpeg'],
  ['Gojo Satoru','Jujutsu Kaisen','DIVINE','Infinity',2600,'https://i.imgur.com/2x2x2x2.jpeg'],
  ['Killua Zoldyck','Hunter x Hunter','LEGENDARY','Lightning',1100,'https://i.imgur.com/3x3x3x3.jpeg']
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
      create: {
        id: name.replace(/\s+/g, '-'),
        name,
        slot,
        rarity,
        basePower
      }
    });

  }

  console.log('Seed complete');
  await prisma.$disconnect();

})();
