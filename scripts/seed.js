const { nanoid } = require('nanoid');
const { prisma } = require('../src/lib/db');
const chars = [
  ['Naruto Uzumaki','Naruto','LEGENDARY','Chakra',900],['Sasuke Uchiha','Naruto','LEGENDARY','Lightning',920],['Madara Uchiha','Naruto','MYTHIC','Shadow',1450],
  ['Monkey D. Luffy','One Piece','LEGENDARY','Rubber',980],['Roronoa Zoro','One Piece','LEGENDARY','Steel',950],['Shanks','One Piece','MYTHIC','Haki',1500],
  ['Satoru Gojo','Jujutsu Kaisen','MYTHIC','Infinity',1600],['Ryomen Sukuna','Jujutsu Kaisen','DIVINE','Cursed',2200],
  ['Levi Ackerman','Attack on Titan','EPIC','Steel',720],['Eren Yeager','Attack on Titan','MYTHIC','Titan',1450],
  ['Ichigo Kurosaki','Bleach','MYTHIC','Soul',1500],['Aizen Sosuke','Bleach','DIVINE','Illusion',2100],
  ['Goku','Dragon Ball','DIVINE','Ki',2400],['Vegeta','Dragon Ball','MYTHIC','Ki',1700],
  ['Tanjiro Kamado','Demon Slayer','EPIC','Water',700],['Nezuko Kamado','Demon Slayer','EPIC','Demon',740],
  ['Gon Freecss','Hunter x Hunter','LEGENDARY','Nature',980],['Killua Zoldyck','Hunter x Hunter','LEGENDARY','Lightning',1000]
];
const eq = [
  ['Iron Blade','WEAPON','COMMON',20],['Cursed Katana','WEAPON','EPIC',95],['Infinity Cloak','ARMOR','MYTHIC',260],['Demon King Ring','RING','DIVINE',420],['Spirit Pendant','ARTIFACT','LEGENDARY',180]
];
(async()=>{
  for (const [name, anime, rarity, element, power] of chars) {
    await prisma.character.upsert({ where:{ id: `${anime}:${name}`.replace(/\s+/g,'_') }, update:{}, create:{ id: `${anime}:${name}`.replace(/\s+/g,'_'), name, anime, rarity, element, basePower: power, baseFarm: Math.floor(power/10), baseLuck: Math.floor(power/30) } });
  }
  for (const [name, slot, rarity, basePower] of eq) {
    await prisma.equipmentTemplate.upsert({ where:{ id: name.replace(/\s+/g,'_') }, update:{}, create:{ id: name.replace(/\s+/g,'_'), name, slot, rarity, basePower } });
  }
  console.log('Seed complete'); await prisma.$disconnect();
})();
