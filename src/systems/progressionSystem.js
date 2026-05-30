// VoidRoll Reborn - Updated Progression System
// No Fusion, No Stars, No Item Rolls, No character-specific shards.
// Duplicates are allowed as separate cards. Passives are not nerfed or changed.

const progressionRules = require('../config/progression_rules.json');

const RARITY_ORDER = progressionRules.rarityOrder;
const GEAR_PATH = progressionRules.gearPath;

function normalizeRarity(rarity = 'COMMON') {
  const value = String(rarity || 'COMMON').toUpperCase();
  return RARITY_ORDER.includes(value) ? value : 'COMMON';
}

function normalizeRole(role = 'DPS') {
  return String(role || 'DPS').toUpperCase();
}

function normalizeElement(element = 'LIGHT') {
  return String(element || 'LIGHT').toUpperCase();
}

function rarityRank(rarity = 'COMMON') {
  return RARITY_ORDER.indexOf(normalizeRarity(rarity));
}

function getGearPath() {
  return [...GEAR_PATH];
}

function getDuplicateBonusRewards(character = {}) {
  const rarity = normalizeRarity(character.rarity);
  const role = normalizeRole(character.role || character.type || 'DPS');
  const element = normalizeElement(character.element || 'LIGHT');

  const base = progressionRules.duplicateRewards.byRarity[rarity]
    || progressionRules.duplicateRewards.byRarity.COMMON;

  const roleMaterial = progressionRules.duplicateRewards.byRole[role] || null;
  const elementMaterial = progressionRules.duplicateRewards.byElement[element] || null;

  return {
    soulFragments: Number(base.soulFragments || 0),
    essence: Number(base.essence || 0),
    gold: Number(base.gold || 0),
    voidCrystals: Number(base.voidCrystals || 0),
    roleMaterial,
    roleMaterialAmount: roleMaterial ? Math.max(1, Math.floor((base.soulFragments || 5) / 10)) : 0,
    elementMaterial,
    elementMaterialAmount: elementMaterial ? Math.max(1, Math.floor((base.soulFragments || 5) / 12)) : 0,
    rarityMaterial: base.rarityMaterial || null,
    rarityMaterialAmount: Number(base.rarityMaterialAmount || 0)
  };
}

function formatDuplicateBonusRewards(character = {}) {
  const rewards = getDuplicateBonusRewards(character);
  const name = character.name || 'Character';

  const lines = [
    `Duplicate **${name}** bonus rewards:`,
    `🧩 +${rewards.soulFragments} Soul Fragments`,
    `🔮 +${rewards.essence} Essence`,
    `🪙 +${rewards.gold.toLocaleString()} Gold`
  ];

  if (rewards.roleMaterial) lines.push(`🔱 +${rewards.roleMaterialAmount} ${rewards.roleMaterial}`);
  if (rewards.elementMaterial) lines.push(`🌌 +${rewards.elementMaterialAmount} ${rewards.elementMaterial}`);
  if (rewards.rarityMaterial) lines.push(`💠 +${rewards.rarityMaterialAmount} ${rewards.rarityMaterial}`);
  if (rewards.voidCrystals > 0) lines.push(`💎 +${rewards.voidCrystals} Void Crystals`);

  return lines.join('\n');
}

function buildEvolutionTreeView(character = {}, card = {}) {
  const rarity = normalizeRarity(character.rarity);
  const gearTier = normalizeRarity(card.gearTier || 'COMMON');

  return {
    name: character.name || 'Unknown Character',
    anime: character.anime || 'Unknown Anime',
    rarity,
    variant: character.variant || 'Base',
    duplicateAllowed: true,
    passiveUnchanged: true,
    core: {
      level: card.level || 1,
      tier: card.coreTier || 0,
      label: `Core ${card.coreTier || 0}/10`
    },
    skills: {
      tier: card.skillTier || 0,
      label: `Skills ${card.skillTier || 0}/10`
    },
    gear: {
      tier: gearTier,
      path: getGearPath(),
      next: GEAR_PATH[Math.min(GEAR_PATH.length - 1, GEAR_PATH.indexOf(gearTier) + 1)] || gearTier
    },
    traits: {
      trait: card.trait || 'None',
      tier: card.traitTier || 0
    },
    bond: {
      level: card.bondLevel || 0
    },
    transformation: {
      unlocked: Boolean(card.transformationUnlocked),
      name: card.transformationName || 'Locked'
    }
  };
}

module.exports = {
  RARITY_ORDER,
  GEAR_PATH,
  normalizeRarity,
  normalizeRole,
  normalizeElement,
  rarityRank,
  getGearPath,
  getDuplicateBonusRewards,
  formatDuplicateBonusRewards,
  buildEvolutionTreeView
};
