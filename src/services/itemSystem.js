const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');

const RARITY_ORDER = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'];
const RARITY_COLORS = {
  COMMON: '#BFC7D5', RARE: '#3B82F6', EPIC: '#A855F7', LEGENDARY: '#F59E0B',
  MYTHIC: '#EF4444', DIVINE: '#F472B6', SECRET: '#22D3EE'
};

const ITEMS = [
  { name:'Training Katana', slot:'WEAPON', rarity:'COMMON', basePower:45, bonusType:'POWER', bonusValue:3, characterHint:null },
  { name:'Iron Battle Armor', slot:'ARMOR', rarity:'COMMON', basePower:55, bonusType:'HP', bonusValue:4, characterHint:null },
  { name:'Scout Ring', slot:'RING', rarity:'COMMON', basePower:35, bonusType:'MANA', bonusValue:3, characterHint:null },
  { name:'Nichirin Blade', slot:'WEAPON', rarity:'EPIC', basePower:340, bonusType:'CRIT', bonusValue:9, characterHint:'Tanjiro' },
  { name:'Thunder Nichirin Blade', slot:'WEAPON', rarity:'EPIC', basePower:330, bonusType:'MANA', bonusValue:8, characterHint:'Zenitsu' },
  { name:'Inosuke Dual Blades', slot:'WEAPON', rarity:'EPIC', basePower:360, bonusType:'POWER', bonusValue:8, characterHint:'Inosuke' },
  { name:'Playful Cloud', slot:'WEAPON', rarity:'LEGENDARY', basePower:760, bonusType:'POWER', bonusValue:15, characterHint:'Toji' },
  { name:'Inverted Spear of Heaven', slot:'WEAPON', rarity:'MYTHIC', basePower:1400, bonusType:'ULTIMATE', bonusValue:22, characterHint:'Toji' },
  { name:'Limitless Blindfold', slot:'ARTIFACT', rarity:'MYTHIC', basePower:1350, bonusType:'MANA', bonusValue:25, characterHint:'Gojo' },
  { name:'Sukuna Cursed Finger', slot:'ARTIFACT', rarity:'DIVINE', basePower:2600, bonusType:'ULTIMATE', bonusValue:35, characterHint:'Sukuna' },
  { name:'Enma', slot:'WEAPON', rarity:'MYTHIC', basePower:1500, bonusType:'CRIT', bonusValue:24, characterHint:'Zoro' },
  { name:'Yoru', slot:'WEAPON', rarity:'DIVINE', basePower:2800, bonusType:'POWER', bonusValue:32, characterHint:'Mihawk' },
  { name:'Straw Hat Will', slot:'ARTIFACT', rarity:'LEGENDARY', basePower:850, bonusType:'MANA', bonusValue:14, characterHint:'Luffy' },
  { name:'Samehada', slot:'WEAPON', rarity:'MYTHIC', basePower:1450, bonusType:'HP', bonusValue:24, characterHint:'Kisame' },
  { name:'Flying Thunder God Kunai', slot:'WEAPON', rarity:'LEGENDARY', basePower:900, bonusType:'MANA', bonusValue:16, characterHint:'Minato' },
  { name:'Truth-Seeking Orb', slot:'ARTIFACT', rarity:'DIVINE', basePower:3000, bonusType:'ULTIMATE', bonusValue:38, characterHint:'Naruto' },
  { name:'Zangetsu', slot:'WEAPON', rarity:'MYTHIC', basePower:1550, bonusType:'POWER', bonusValue:24, characterHint:'Ichigo' },
  { name:'Hogyoku', slot:'ARTIFACT', rarity:'DIVINE', basePower:3100, bonusType:'ULTIMATE', bonusValue:40, characterHint:'Aizen' },
  { name:'Dragon Radar', slot:'ARTIFACT', rarity:'LEGENDARY', basePower:780, bonusType:'MANA', bonusValue:15, characterHint:'Goku' },
  { name:'Ultra Instinct Aura', slot:'ARTIFACT', rarity:'DIVINE', basePower:3300, bonusType:'CRIT', bonusValue:42, characterHint:'Goku' }
];

function itemRarityRoll() {
  const r = Math.random();
  if (r < 0.0003) return 'SECRET';
  if (r < 0.004) return 'DIVINE';
  if (r < 0.025) return 'MYTHIC';
  if (r < 0.08) return 'LEGENDARY';
  if (r < 0.22) return 'EPIC';
  if (r < 0.50) return 'RARE';
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
    await prisma.equipmentTemplate.upsert({
      where: { id: item.name.replace(/\s+/g, '-') },
      update: {
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        basePower: item.basePower,
        active: true,
        imageUrl: null,
        bonusType: item.bonusType,
        bonusValue: item.bonusValue,
        characterHint: item.characterHint
      },
      create: {
        id: item.name.replace(/\s+/g, '-'),
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        basePower: item.basePower,
        active: true,
        imageUrl: null,
        bonusType: item.bonusType,
        bonusValue: item.bonusValue,
        characterHint: item.characterHint
      }
    });
  }
}

async function rollItem(userId) {
  await seedItemTemplates();
  const item = pickItem();
  const templateId = item.name.replace(/\s+/g, '-');
  const power = item.basePower + Math.floor(Math.random() * Math.max(10, Math.floor(item.basePower * 0.12)));

  const eq = await prisma.userEquipment.create({
    data: {
      id: nanoid(12),
      userId,
      templateId,
      level: 1,
      power
    },
    include: { template: true }
  });

  return eq;
}

async function equipItem(userId, itemId, cardId) {
  const eq = await prisma.userEquipment.findFirst({
    where: { id: itemId, userId },
    include: { template: true }
  });
  if (!eq) throw new Error('Item not found in your inventory.');

  const card = await prisma.userCard.findFirst({
    where: { id: cardId, userId },
    include: { character: true }
  });
  if (!card) throw new Error('Card not found in your inventory.');

  const sameSlot = await prisma.userEquipment.findMany({
    where: {
      userId,
      cardId,
      template: { slot: eq.template.slot }
    },
    include: { template: true }
  });
  for (const old of sameSlot) {
    await prisma.userEquipment.update({ where: { id: old.id }, data: { cardId: null, equippedAt: null } });
  }

  const updated = await prisma.userEquipment.update({
    where: { id: itemId },
    data: { cardId, equippedAt: new Date() },
    include: { template: true, card: { include: { character: true } } }
  });

  return { item: updated, card };
}

function getItemBonus(template, characterName = '') {
  const hint = (template.characterHint || '').toLowerCase();
  const name = characterName.toLowerCase();
  const setBonus = hint && name.includes(hint.toLowerCase()) ? 2 : 1;
  return {
    type: template.bonusType || 'POWER',
    value: (template.bonusValue || 0) * setBonus,
    setBonus: setBonus > 1
  };
}

function itemLine(eq) {
  const t = eq.template;
  const bonus = getItemBonus(t, eq.card?.character?.name || '');
  return `${eq.id} • ${t.name} • ${t.slot} • ${t.rarity} • PWR ${eq.power} • ${bonus.type}+${bonus.value}${bonus.setBonus ? ' • SET BONUS' : ''}`;
}

module.exports = { rollItem, equipItem, getItemBonus, itemLine, RARITY_COLORS, seedItemTemplates };
