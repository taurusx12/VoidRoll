// VoidRoll Reborn - Phase 9 Character Evolution Tree
// No Fusion, No Stars, No Item Rolls, No character-specific shards.

const evolutionConfig = require('../config/evolution_tree_config.json');

const GEAR_TIERS = evolutionConfig.branches.gear.tiers;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalizeBranch(branch = 'core') {
  const value = String(branch || 'core').trim().toLowerCase();
  return evolutionConfig.branches[value] ? value : 'core';
}

function normalizeRarity(value = 'COMMON') {
  const v = String(value || 'COMMON').trim().toUpperCase();
  return GEAR_TIERS.includes(v) ? v : 'COMMON';
}

function getCharacter(card = {}) {
  return card.character || card.template || card;
}

function getTreeState(card = {}) {
  return {
    coreTier: Number(card.coreTier || 0),
    skillTier: Number(card.skillTier || 0),
    gearTier: normalizeRarity(card.gearTier || 'COMMON'),
    traitTier: Number(card.traitTier || 0),
    bondTier: Number(card.bondTier || card.bondLevel || 0),
    transformationTier: Number(card.transformationTier || 0),
    variantTier: Number(card.variantTier || 0)
  };
}

function getNextGearTier(currentTier = 'COMMON') {
  const current = normalizeRarity(currentTier);
  const index = GEAR_TIERS.indexOf(current);
  return GEAR_TIERS[Math.min(GEAR_TIERS.length - 1, index + 1)] || current;
}

function scaleCost(base = {}, currentTier = 0, multiplier = 1.35) {
  const factor = Math.pow(Number(multiplier || 1.35), Number(currentTier || 0));
  const out = {};
  for (const [key, value] of Object.entries(base)) {
    if (typeof value === 'number') out[key] = Math.ceil(value * factor);
    else out[key] = value;
  }
  return out;
}

function getUpgradeCost(card = {}, branch = 'core') {
  const b = normalizeBranch(branch);
  const state = getTreeState(card);
  const config = evolutionConfig.upgradeCosts[b];

  if (b === 'gear') {
    const nextGear = getNextGearTier(state.gearTier);
    if (nextGear === state.gearTier) {
      return { maxed: true, branch: b, currentTier: state.gearTier, nextTier: state.gearTier, cost: {} };
    }

    return {
      maxed: false,
      branch: b,
      currentTier: state.gearTier,
      nextTier: nextGear,
      cost: config[nextGear] || {}
    };
  }

  const tierKey = `${b}Tier`;
  const currentTier = Number(state[tierKey] || 0);
  const maxTier = evolutionConfig.branches[b].maxTier || 10;

  if (currentTier >= maxTier) {
    return { maxed: true, branch: b, currentTier, nextTier: currentTier, cost: {} };
  }

  return {
    maxed: false,
    branch: b,
    currentTier,
    nextTier: currentTier + 1,
    cost: scaleCost(config.formula || {}, currentTier, config.tierMultiplier || 1.35)
  };
}

function formatCost(cost = {}) {
  const labels = {
    gold: '🪙 Gold',
    essence: '🔮 Essence',
    soulFragments: '🧩 Soul Fragments',
    roleSigils: '🔱 Role Sigils',
    elementCores: '🌌 Element Cores',
    voidCrystals: '💎 Void Crystals',
    bondPoints: '❤️ Bond Points',
    traitDust: '🧬 Trait Dust',
    traitCrystals: '💠 Trait Crystal',
    transformationCores: '🔥 Transformation Core',
    gearMaterial: '⚒️ Gear Material',
    gearMaterialAmount: 'Amount',
    rarityMaterial: '💠 Rarity Material',
    rarityMaterialAmount: 'Amount'
  };

  const lines = [];
  const skipAmountKeys = new Set(['gearMaterialAmount', 'rarityMaterialAmount']);

  for (const [key, value] of Object.entries(cost)) {
    if (skipAmountKeys.has(key)) continue;

    if (key === 'gearMaterial') {
      lines.push(`⚒️ ${cost.gearMaterialAmount || 1}x ${value}`);
      continue;
    }

    if (key === 'rarityMaterial') {
      lines.push(`💠 ${cost.rarityMaterialAmount || 1}x ${value}`);
      continue;
    }

    const amount = typeof value === 'number' ? Number(value).toLocaleString() : value;
    lines.push(`${labels[key] || key}: **${amount}**`);
  }

  return lines.length ? lines.join('\n') : 'No cost.';
}

function canUnlockBranch(card = {}, branch = 'core') {
  const b = normalizeBranch(branch);
  const c = getCharacter(card);
  const state = getTreeState(card);
  const rules = evolutionConfig.unlockRules;

  if (b === 'trait' && state.coreTier < rules.traitUnlock.requiresCoreTier) {
    return { ok: false, reason: `Requires Core Tier ${rules.traitUnlock.requiresCoreTier}.` };
  }

  if (b === 'bond' && Number(card.level || 1) < rules.bondUnlock.requiresLevel) {
    return { ok: false, reason: `Requires Level ${rules.bondUnlock.requiresLevel}.` };
  }

  if (b === 'transformation') {
    if (state.coreTier < rules.transformationUnlock.requiresCoreTier) {
      return { ok: false, reason: `Requires Core Tier ${rules.transformationUnlock.requiresCoreTier}.` };
    }
    if (state.skillTier < rules.transformationUnlock.requiresSkillTier) {
      return { ok: false, reason: `Requires Skill Tier ${rules.transformationUnlock.requiresSkillTier}.` };
    }
  }

  if (b === 'variant') {
    const rarity = String(c.rarity || 'COMMON').toUpperCase();
    if (!rules.variantUnlock.requiresRarity.includes(rarity)) {
      return { ok: false, reason: `Variant Tree is for VOIDBORN and SECRET characters.` };
    }
  }

  return { ok: true, reason: 'Unlocked.' };
}

function getUpgradePreview(card = {}, branch = 'core') {
  const b = normalizeBranch(branch);
  const c = getCharacter(card);
  const unlock = canUnlockBranch(card, b);
  const costData = getUpgradeCost(card, b);
  const branchInfo = evolutionConfig.branches[b];

  if (!unlock.ok) {
    return {
      ok: false,
      title: `${branchInfo.emoji} ${branchInfo.displayName}`,
      message: unlock.reason,
      costData
    };
  }

  if (costData.maxed) {
    return {
      ok: false,
      title: `${branchInfo.emoji} ${branchInfo.displayName}`,
      message: `${branchInfo.displayName} is already maxed.`,
      costData
    };
  }

  return {
    ok: true,
    title: `${branchInfo.emoji} ${branchInfo.displayName}`,
    message: `${c.name || 'Character'} ${branchInfo.displayName}: ${costData.currentTier} → ${costData.nextTier}`,
    costData
  };
}

function formatCharacterTree(card = {}) {
  const c = getCharacter(card);
  const state = getTreeState(card);

  return [
    `🌳 **${c.name || 'Unknown'} Evolution Tree**`,
    `Variant: **${c.variant || 'Base'}**`,
    `Anime: **${c.anime || 'Unknown'}**`,
    `Rarity: **${c.rarity || 'COMMON'}**`,
    `Level: **${card.level || 1}**`,
    `Power: **${Number(card.power || c.basePower || 0).toLocaleString()}**`,
    '',
    `🌌 Core Tree: **${state.coreTier}/10**`,
    `⚔️ Skill Tree: **${state.skillTier}/10**`,
    `⚒️ Built-in Gear: **${state.gearTier}**`,
    `🧬 Trait Tree: **${state.traitTier}/5**`,
    `❤️ Bond Tree: **${state.bondTier}/10**`,
    `🔥 Transformation Tree: **${state.transformationTier}/5**`,
    `♾️ Variant Tree: **${state.variantTier}/5**`,
    '',
    'No Fusion • No Stars • No Character Shards'
  ].join('\n');
}

function formatUpgradePreview(card = {}, branch = 'core') {
  const preview = getUpgradePreview(card, branch);
  const cost = preview.costData?.cost || {};

  return [
    `⬆️ **Upgrade Preview**`,
    preview.title,
    preview.message,
    '',
    '**Cost**',
    formatCost(cost)
  ].join('\n');
}

function applyUpgradeToCardData(card = {}, branch = 'core') {
  const b = normalizeBranch(branch);
  const preview = getUpgradePreview(card, b);

  if (!preview.ok) {
    return { ok: false, card, reason: preview.message, preview };
  }

  const updated = { ...card };

  if (b === 'gear') {
    updated.gearTier = preview.costData.nextTier;
  } else {
    const key = `${b}Tier`;
    updated[key] = preview.costData.nextTier;
  }

  updated.power = estimatePowerAfterUpgrade(updated, b);

  return {
    ok: true,
    card: updated,
    reason: 'upgraded',
    preview
  };
}

function estimatePowerAfterUpgrade(card = {}, branch = 'core') {
  const base = Number(card.power || getCharacter(card).basePower || 100);
  const multipliers = {
    core: 1.035,
    skill: 1.028,
    gear: 1.055,
    trait: 1.032,
    bond: 1.018,
    transformation: 1.08,
    variant: 1.09
  };

  return Math.floor(base * (multipliers[normalizeBranch(branch)] || 1.02));
}

module.exports = {
  GEAR_TIERS,
  clamp,
  normalizeBranch,
  normalizeRarity,
  getCharacter,
  getTreeState,
  getNextGearTier,
  scaleCost,
  getUpgradeCost,
  formatCost,
  canUnlockBranch,
  getUpgradePreview,
  formatCharacterTree,
  formatUpgradePreview,
  applyUpgradeToCardData,
  estimatePowerAfterUpgrade
};
