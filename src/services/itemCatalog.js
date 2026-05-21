const path = require('path');
const fs = require('fs');

const ITEM_CATALOG = [
  { id: 'void-fang-katana', name: 'Void Fang Katana', slot: 'WEAPON', rarity: 'SECRET', basePower: 6200, imageUrl: 'assets/items/weapon_card_1.png' },
  { id: 'hollow-crown-blade', name: 'Hollow Crown Blade', slot: 'WEAPON', rarity: 'DIVINE', basePower: 5400, imageUrl: 'assets/items/weapon_card_2.png' },
  { id: 'demon-king-relic', name: 'Demon King Relic', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 5100, imageUrl: 'assets/items/weapon_card_3.png' },
  { id: 'infinity-core', name: 'Infinity Core', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 5000, imageUrl: 'assets/items/weapon_card_4.png' },
  { id: 'celestial-aegis', name: 'Celestial Aegis', slot: 'ARMOR', rarity: 'DIVINE', basePower: 4900, imageUrl: 'assets/items/weapon_card_5.png' },
  { id: 'crimson-moon-scythe', name: 'Crimson Moon Scythe', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3800, imageUrl: 'assets/items/weapon_card_6.png' },
  { id: 'king-of-hell-blade', name: 'King of Hell Blade', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3600, imageUrl: 'assets/items/weapon_card_7.png' },
  { id: 'sun-breathing-blade', name: 'Sun Breathing Blade', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3450, imageUrl: 'assets/items/weapon_card_8.png' },
  { id: 'abyssal-mask', name: 'Abyssal Mask', slot: 'ARTIFACT', rarity: 'MYTHIC', basePower: 3300, imageUrl: 'assets/items/weapon_card_9.png' },
  { id: 'storm-emperor-gauntlets', name: 'Storm Emperor Gauntlets', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3200, imageUrl: 'assets/items/weapon_card_10.png' },
  { id: 'dragon-slayer-greatsword', name: 'Dragon Slayer Greatsword', slot: 'WEAPON', rarity: 'LEGENDARY', basePower: 2400, imageUrl: 'assets/items/weapon_card_11.png' },
  { id: 'titan-guard-armor', name: 'Titan Guard Armor', slot: 'ARMOR', rarity: 'LEGENDARY', basePower: 2350, imageUrl: 'assets/items/weapon_card_12.png' },
  { id: 'quincy-spirit-bow', name: 'Quincy Spirit Bow', slot: 'WEAPON', rarity: 'LEGENDARY', basePower: 2250, imageUrl: 'assets/items/weapon_card_13.png' },
  { id: 'blood-moon-spear', name: 'Blood Moon Spear', slot: 'WEAPON', rarity: 'LEGENDARY', basePower: 2180, imageUrl: 'assets/items/weapon_card_14.png' },
  { id: 'shadow-cloak', name: 'Shadow Cloak', slot: 'ARMOR', rarity: 'LEGENDARY', basePower: 2050, imageUrl: 'assets/items/weapon_card_15.png' },
  { id: 'cursed-katana', name: 'Cursed Katana', slot: 'WEAPON', rarity: 'EPIC', basePower: 1350, imageUrl: 'assets/items/weapon_card_16.png' },
  { id: 'flame-nichirin', name: 'Flame Nichirin', slot: 'WEAPON', rarity: 'EPIC', basePower: 1300, imageUrl: 'assets/items/weapon_card_17.png' },
  { id: 'thunder-fang-dagger', name: 'Thunder Fang Dagger', slot: 'WEAPON', rarity: 'EPIC', basePower: 1220, imageUrl: 'assets/items/weapon_card_18.png' },
  { id: 'spirit-hunter-bow', name: 'Spirit Hunter Bow', slot: 'WEAPON', rarity: 'EPIC', basePower: 1180, imageUrl: 'assets/items/weapon_card_19.png' },
  { id: 'soul-guard-armor', name: 'Soul Guard Armor', slot: 'ARMOR', rarity: 'EPIC', basePower: 1150, imageUrl: 'assets/items/weapon_card_20.png' },
  { id: 'hunter-dagger', name: 'Hunter Dagger', slot: 'WEAPON', rarity: 'RARE', basePower: 620, imageUrl: 'assets/items/weapon_card_21.png' },
  { id: 'blue-steel-blade', name: 'Blue Steel Blade', slot: 'WEAPON', rarity: 'RARE', basePower: 600, imageUrl: 'assets/items/weapon_card_22.png' },
  { id: 'wind-cloak', name: 'Wind Cloak', slot: 'ARMOR', rarity: 'RARE', basePower: 560, imageUrl: 'assets/items/weapon_card_23.png' },
  { id: 'silver-ring', name: 'Silver Ring', slot: 'RING', rarity: 'RARE', basePower: 540, imageUrl: 'assets/items/weapon_card_24.png' },
  { id: 'arcane-charm', name: 'Arcane Charm', slot: 'ARTIFACT', rarity: 'RARE', basePower: 520, imageUrl: 'assets/items/weapon_card_25.png' },
  { id: 'iron-blade', name: 'Iron Blade', slot: 'WEAPON', rarity: 'COMMON', basePower: 220, imageUrl: 'assets/items/weapon_card_26.png' },
  { id: 'leather-guard', name: 'Leather Guard', slot: 'ARMOR', rarity: 'COMMON', basePower: 200, imageUrl: 'assets/items/weapon_card_27.png' },
  { id: 'training-spear', name: 'Training Spear', slot: 'WEAPON', rarity: 'COMMON', basePower: 190, imageUrl: 'assets/items/weapon_card_28.png' },
  { id: 'old-ring', name: 'Old Ring', slot: 'RING', rarity: 'COMMON', basePower: 160, imageUrl: 'assets/items/weapon_card_29.png' },
  { id: 'wooden-charm', name: 'Wooden Charm', slot: 'ARTIFACT', rarity: 'COMMON', basePower: 140, imageUrl: 'assets/items/weapon_card_30.png' },
  { id: 'void-relic-31', name: 'Void Relic 31', slot: 'ARTIFACT', rarity: 'RARE', basePower: 737, imageUrl: 'assets/items/weapon_card_31.png' },
  { id: 'void-weapon-32', name: 'Void Weapon 32', slot: 'WEAPON', rarity: 'EPIC', basePower: 1374, imageUrl: 'assets/items/weapon_card_32.png' },
  { id: 'void-armor-33', name: 'Void Armor 33', slot: 'ARMOR', rarity: 'LEGENDARY', basePower: 2431, imageUrl: 'assets/items/weapon_card_33.png' },
  { id: 'void-ring-34', name: 'Void Ring 34', slot: 'RING', rarity: 'MYTHIC', basePower: 3638, imageUrl: 'assets/items/weapon_card_34.png' },
  { id: 'void-relic-35', name: 'Void Relic 35', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 5245, imageUrl: 'assets/items/weapon_card_35.png' },
  { id: 'void-weapon-36', name: 'Void Weapon 36', slot: 'WEAPON', rarity: 'COMMON', basePower: 432, imageUrl: 'assets/items/weapon_card_36.png' },
  { id: 'void-armor-37', name: 'Void Armor 37', slot: 'ARMOR', rarity: 'RARE', basePower: 779, imageUrl: 'assets/items/weapon_card_37.png' },
  { id: 'void-ring-38', name: 'Void Ring 38', slot: 'RING', rarity: 'EPIC', basePower: 1416, imageUrl: 'assets/items/weapon_card_38.png' },
  { id: 'void-relic-39', name: 'Void Relic 39', slot: 'ARTIFACT', rarity: 'LEGENDARY', basePower: 2473, imageUrl: 'assets/items/weapon_card_39.png' },
  { id: 'void-weapon-40', name: 'Void Weapon 40', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3680, imageUrl: 'assets/items/weapon_card_40.png' },
  { id: 'void-armor-41', name: 'Void Armor 41', slot: 'ARMOR', rarity: 'DIVINE', basePower: 5287, imageUrl: 'assets/items/weapon_card_41.png' },
  { id: 'void-ring-42', name: 'Void Ring 42', slot: 'RING', rarity: 'COMMON', basePower: 474, imageUrl: 'assets/items/weapon_card_42.png' },
  { id: 'void-relic-43', name: 'Void Relic 43', slot: 'ARTIFACT', rarity: 'RARE', basePower: 821, imageUrl: 'assets/items/weapon_card_43.png' },
  { id: 'void-weapon-44', name: 'Void Weapon 44', slot: 'WEAPON', rarity: 'EPIC', basePower: 1458, imageUrl: 'assets/items/weapon_card_44.png' },
  { id: 'void-armor-45', name: 'Void Armor 45', slot: 'ARMOR', rarity: 'LEGENDARY', basePower: 2515, imageUrl: 'assets/items/weapon_card_45.png' },
  { id: 'void-ring-46', name: 'Void Ring 46', slot: 'RING', rarity: 'MYTHIC', basePower: 3722, imageUrl: 'assets/items/weapon_card_46.png' },
  { id: 'void-relic-47', name: 'Void Relic 47', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 5329, imageUrl: 'assets/items/weapon_card_47.png' },
  { id: 'void-weapon-48', name: 'Void Weapon 48', slot: 'WEAPON', rarity: 'COMMON', basePower: 516, imageUrl: 'assets/items/weapon_card_48.png' },
  { id: 'void-armor-49', name: 'Void Armor 49', slot: 'ARMOR', rarity: 'RARE', basePower: 863, imageUrl: 'assets/items/weapon_card_49.png' },
  { id: 'void-ring-50', name: 'Void Ring 50', slot: 'RING', rarity: 'EPIC', basePower: 1500, imageUrl: 'assets/items/weapon_card_50.png' },
  { id: 'void-relic-51', name: 'Void Relic 51', slot: 'ARTIFACT', rarity: 'LEGENDARY', basePower: 2557, imageUrl: 'assets/items/weapon_card_51.png' },
  { id: 'void-weapon-52', name: 'Void Weapon 52', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3764, imageUrl: 'assets/items/weapon_card_52.png' },
  { id: 'void-armor-53', name: 'Void Armor 53', slot: 'ARMOR', rarity: 'DIVINE', basePower: 5371, imageUrl: 'assets/items/weapon_card_53.png' },
  { id: 'void-ring-54', name: 'Void Ring 54', slot: 'RING', rarity: 'COMMON', basePower: 558, imageUrl: 'assets/items/weapon_card_54.png' },
  { id: 'void-relic-55', name: 'Void Relic 55', slot: 'ARTIFACT', rarity: 'RARE', basePower: 905, imageUrl: 'assets/items/weapon_card_55.png' },
  { id: 'void-weapon-56', name: 'Void Weapon 56', slot: 'WEAPON', rarity: 'EPIC', basePower: 1542, imageUrl: 'assets/items/weapon_card_56.png' },
  { id: 'void-armor-57', name: 'Void Armor 57', slot: 'ARMOR', rarity: 'LEGENDARY', basePower: 2599, imageUrl: 'assets/items/weapon_card_57.png' },
  { id: 'void-ring-58', name: 'Void Ring 58', slot: 'RING', rarity: 'MYTHIC', basePower: 3806, imageUrl: 'assets/items/weapon_card_58.png' },
  { id: 'void-relic-59', name: 'Void Relic 59', slot: 'ARTIFACT', rarity: 'DIVINE', basePower: 5413, imageUrl: 'assets/items/weapon_card_59.png' },
  { id: 'void-weapon-60', name: 'Void Weapon 60', slot: 'WEAPON', rarity: 'COMMON', basePower: 600, imageUrl: 'assets/items/weapon_card_60.png' },
  { id: 'void-armor-61', name: 'Void Armor 61', slot: 'ARMOR', rarity: 'RARE', basePower: 947, imageUrl: 'assets/items/weapon_card_61.png' },
  { id: 'void-ring-62', name: 'Void Ring 62', slot: 'RING', rarity: 'EPIC', basePower: 1584, imageUrl: 'assets/items/weapon_card_62.png' },
  { id: 'void-relic-63', name: 'Void Relic 63', slot: 'ARTIFACT', rarity: 'LEGENDARY', basePower: 2641, imageUrl: 'assets/items/weapon_card_63.png' },
  { id: 'void-weapon-64', name: 'Void Weapon 64', slot: 'WEAPON', rarity: 'MYTHIC', basePower: 3848, imageUrl: 'assets/items/weapon_card_64.png' },
  { id: 'void-armor-65', name: 'Void Armor 65', slot: 'ARMOR', rarity: 'DIVINE', basePower: 5455, imageUrl: 'assets/items/weapon_card_65.png' },
  { id: 'void-ring-66', name: 'Void Ring 66', slot: 'RING', rarity: 'COMMON', basePower: 642, imageUrl: 'assets/items/weapon_card_66.png' },
  { id: 'void-relic-67', name: 'Void Relic 67', slot: 'ARTIFACT', rarity: 'RARE', basePower: 989, imageUrl: 'assets/items/weapon_card_67.png' },
  { id: 'void-weapon-68', name: 'Void Weapon 68', slot: 'WEAPON', rarity: 'EPIC', basePower: 1626, imageUrl: 'assets/items/weapon_card_68.png' },
  { id: 'void-armor-69', name: 'Void Armor 69', slot: 'ARMOR', rarity: 'LEGENDARY', basePower: 2683, imageUrl: 'assets/items/weapon_card_69.png' },
  { id: 'void-ring-70', name: 'Void Ring 70', slot: 'RING', rarity: 'MYTHIC', basePower: 3890, imageUrl: 'assets/items/weapon_card_70.png' }
];

async function ensureItemTemplates(prisma) {
  for (const item of ITEM_CATALOG) {
    await prisma.equipmentTemplate.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        basePower: item.basePower,
        imageUrl: item.imageUrl,
        active: true
      },
      create: {
        id: item.id,
        name: item.name,
        slot: item.slot,
        rarity: item.rarity,
        basePower: item.basePower,
        imageUrl: item.imageUrl,
        active: true
      }
    });
  }
}

function getItemImagePath(template) {
  if (!template || !template.imageUrl) return null;
  const p = path.join(process.cwd(), template.imageUrl);
  return fs.existsSync(p) ? p : null;
}

module.exports = { ITEM_CATALOG, ensureItemTemplates, getItemImagePath };
