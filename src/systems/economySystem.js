// VoidRoll Reborn - Updated Economy System
// Core currencies + universal/type progression resources.
// Character-specific shards are intentionally removed.

const economyConfig = require('../config/economy_resources.json');
const { getDuplicateBonusRewards, formatDuplicateBonusRewards } = require('./progressionSystem');

const CORE_CURRENCIES = Object.keys(economyConfig.coreCurrencies);

function getCurrencyInfo(currency) {
  const key = String(currency || '').trim();
  return economyConfig.coreCurrencies[key] || null;
}

function getAllCurrencies() {
  return economyConfig.coreCurrencies;
}

function formatWallet(user = {}) {
  const gold = Number(user.gold || 0);
  const tokens = Number(user.tokens || 0);
  const essence = Number(user.essence || 0);
  const voidCrystals = Number(user.voidCrystals || user.void_crystals || 0);

  return [
    `🪙 Gold: **${gold.toLocaleString()}**`,
    `🎟️ Tokens: **${tokens.toLocaleString()}**`,
    `🔮 Essence: **${essence.toLocaleString()}**`,
    `💎 Void Crystals: **${voidCrystals.toLocaleString()}**`
  ].join('\n');
}

function getGearUpgradeCost(fromTier = 'COMMON', toTier = 'RARE') {
  const tier = String(toTier || 'RARE').toUpperCase();

  const costs = {
    RARE: { gold: 5000, essence: 10, soulFragments: 5, material: 'Iron Core', materialAmount: 1 },
    EPIC: { gold: 15000, essence: 35, soulFragments: 15, material: 'Spirit Alloy', materialAmount: 2 },
    LEGENDARY: { gold: 50000, essence: 90, soulFragments: 35, roleSigils: 10, material: 'Cursed Metal', materialAmount: 4 },
    MYTHIC: { gold: 125000, essence: 180, soulFragments: 70, roleSigils: 20, material: 'Cursed Metal', materialAmount: 8 },
    DIVINE: { gold: 300000, essence: 350, soulFragments: 120, roleSigils: 35, rarityMaterial: 'Divine Fragment', rarityMaterialAmount: 2 },
    VOIDBORN: { gold: 750000, essence: 700, soulFragments: 200, roleSigils: 60, elementCores: 45, voidCrystals: 3, material: 'Void Alloy', materialAmount: 5 },
    SECRET: { gold: 1500000, essence: 1200, soulFragments: 350, roleSigils: 100, elementCores: 80, voidCrystals: 8, material: 'Secret Core', materialAmount: 3 }
  };

  return costs[tier] || costs.RARE;
}

function formatUpgradeCost(cost = {}) {
  const lines = [];
  if (cost.gold) lines.push(`🪙 ${Number(cost.gold).toLocaleString()} Gold`);
  if (cost.essence) lines.push(`🔮 ${Number(cost.essence).toLocaleString()} Essence`);
  if (cost.soulFragments) lines.push(`🧩 ${Number(cost.soulFragments).toLocaleString()} Soul Fragments`);
  if (cost.roleSigils) lines.push(`🔱 ${Number(cost.roleSigils).toLocaleString()} Role Sigils`);
  if (cost.elementCores) lines.push(`🌌 ${Number(cost.elementCores).toLocaleString()} Element Cores`);
  if (cost.voidCrystals) lines.push(`💎 ${Number(cost.voidCrystals).toLocaleString()} Void Crystals`);
  if (cost.rarityMaterial) lines.push(`💠 ${cost.rarityMaterialAmount || 1}x ${cost.rarityMaterial}`);
  if (cost.material) lines.push(`⚒️ ${cost.materialAmount || 1}x ${cost.material}`);
  return lines.join('\n');
}

module.exports = {
  CORE_CURRENCIES,
  getCurrencyInfo,
  getAllCurrencies,
  formatWallet,
  getDuplicateBonusRewards,
  formatDuplicateBonusRewards,
  getGearUpgradeCost,
  formatUpgradeCost
};
