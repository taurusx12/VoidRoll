const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');

const ITEMS = [
  { name: 'Training Katana', slot: 'WEAPON', rarity: 'COMMON', basePower: 45 },
  { name: 'Iron Battle Armor', slot: 'ARMOR', rarity: 'COMMON', basePower: 55 },
  { name: 'Scout Ring', slot: 'RING', rarity: 'COMMON', basePower: 35 },
  { name: 'Nichirin Blade', slot: 'WEAPON', rarity: 'EPIC', basePower: 340 },
  { name: 'Thunder Nichirin Blade', slot: 'WEAPON', rarity: 'EPIC', basePower: 330 },
  { name: 'Playful Cloud', slot: 'WEAPON', rarity: 'LEGENDARY', basePower: 760 },
  { name: 'Inverted Spear of Heaven', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 1400 },
  { name: 'Limitless Blindfold', slot: 'ARTIFACT', rarity: 'MYTHIC', basePower: 1350 },
  { name: 'Sukuna Cursed Finger', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 2600 },
  { name: 'Enma', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 1500 },
  { name: 'Yoru', slot: 'WEAPON', rarity: 'DIVINE', basePower: 2800 },
  { name: 'Straw Hat Will', slot: 'ARTIFACT', rarity: 'LEGENDARY', basePower: 850 },
  { name: 'Samehada', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 1450 },
  { name: 'Truth-Seeking Orb', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 3000 },
  { name: 'Zangetsu', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 1550 },
  { name: 'Hogyoku', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 3100 },
  { name: 'Ultra Instinct Aura', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 3300 }
];

function itemRarityRoll() {
  const r = Math.random();

  if (r < 0.001) return 'SECRET';
  if (r < 0.006) return 'DIVINE';
  if (r < 0.0135) return 'MYTHIC';
  if (r < 0.0235) return 'LEGENDARY';
  if (r < 0.10) return 'EPIC';
  if (r < 0.36) return 'RARE';

  return 'COMMON';
}

function pickItem() {
  const rarity = itemRarityRoll();
  let pool = ITEMS.filter(x => x.rarity === rarity);

  if (!pool.length) pool = ITEMS.filter(x => x.rarity === 'COMMON');

  return pool[Math.floor(Math.random() * pool.length)];
}

async function seedItemTemplates() {
  for (const item of ITEMS) {
    const id = item.name.replace(/\s+/g, '-');

    await prisma.equipmentTemplate.upsert({
      where: { id },
      update: {
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        basePower: item.basePower,
        active: true,
        imageUrl: null
      },
      create: {
        id,
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        basePower: item.basePower,
        active: true,
        imageUrl: null
      }
    });
  }
}

async function rollItem(userId) {
  await seedItemTemplates();

  const item = pickItem();
  const templateId = item.name.replace(/\s+/g, '-');
  const power = item.basePower + Math.floor(Math.random() * Math.max(10, Math.floor(item.basePower * 0.12)));

  return prisma.userEquipment.create({
    data: {
      id: nanoid(12),
      userId,
      templateId,
      level: 1,
      power
    },
    include: { template: true }
  });
}

function itemLine(eq) {
  const t = eq.template;
  return `${eq.id} • ${t.name} • ${t.slot} • ${t.rarity} • PWR ${eq.power}`;
}

module.exports = {
  rollItem,
  itemLine,
  seedItemTemplates
};
