// VoidRoll Reborn - Phase 2 Progression System
// Decisions:
// - No Fusion
// - No Stars
// - No Item Rolls
// - Duplicates convert into resources used by Character Evolution Tree

const progressionRules = require('../config/progression_rules.json');

const RARITY_ORDER = progressionRules.rarityOrder;
const GEAR_PATH = progressionRules.gearPath;

function normalizeRarity(rarity = 'COMMON') {
  const value = String(rarity || 'COMMON').toUpperCase();
  return RARITY_ORDER.includes(value) ? value : 'COMMON';
}

function rarityRank(rarity = 'COMMON') {
  return RARITY_ORDER.indexOf(normalizeRarity(rarity));
}

function getGearPath() {
  return [...GEAR_PATH];
}

function getDuplicateRewards(rarity = 'COMMON', multiplier = 1) {
  const normalized = normalizeRarity(rarity);
  const base = progressionRules.duplicatePolicy.baseRewards[normalized]
    || progressionRules.duplicatePolicy.baseRewards.COMMON;

  return {
    shards: Math.floor((base.shards || 0) * multiplier),
    essence: Math.floor((base.essence || 0) * multiplier),
    gold: Math.floor((base.gold || 0) * multiplier),
    voidCrystals: Math.floor((base.voidCrystals || 0) * multiplier)
  };
}

function buildEvolutionTreeView(character = {}, card = {}) {
  const rarity = normalizeRarity(character.rarity);
  const gearTier = normalizeRarity(card.gearTier || 'COMMON');

  return {
    name: character.name || 'Unknown Character',
    anime: character.anime || 'Unknown Anime',
    rarity,
    variant: character.variant || 'Base',
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

function formatDuplicateRewards(characterName, rarity, rewards) {
  const parts = [
    `+${rewards.shards} ${characterName} Shards`,
    `+${rewards.essence} Essence`,
    `+${rewards.gold.toLocaleString()} Gold`
  ];
  if (rewards.voidCrystals > 0) parts.push(`+${rewards.voidCrystals} Void Crystals`);
  return parts.join('\n');
}

module.exports = {
  RARITY_ORDER,
  GEAR_PATH,
  normalizeRarity,
  rarityRank,
  getGearPath,
  getDuplicateRewards,
  buildEvolutionTreeView,
  formatDuplicateRewards
};
