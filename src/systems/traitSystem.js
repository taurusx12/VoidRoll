// VoidRoll Reborn - Phase 10 Trait System
// Traits are unlocked/upgraded through Character Evolution Tree.
// No Fusion, No Stars, No Character-specific shards.

const traitConfig = require('../config/trait_config.json');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpper(value, fallback = 'COMMON') {
  const out = String(value || fallback).trim().toUpperCase();
  return out || fallback;
}

function getTrait(name) {
  const key = Object.keys(traitConfig.traits).find(t => normalize(t) === normalize(name));
  return key ? { name: key, ...traitConfig.traits[key] } : null;
}

function getAllTraits() {
  return Object.entries(traitConfig.traits).map(([name, data]) => ({ name, ...data }));
}

function getTraitsForRole(role = 'DPS') {
  const r = normalizeUpper(role, 'DPS');
  return getAllTraits().filter(t => (t.roles || []).map(x => normalizeUpper(x)).includes(r));
}

function getTraitRarityInfo(rarity = 'COMMON') {
  return traitConfig.traitRarities[normalizeUpper(rarity)] || traitConfig.traitRarities.COMMON;
}

function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  const str = String(seed || Date.now());
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function rand() {
    h += h << 13; h ^= h >>> 7;
    h += h << 3; h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) / 4294967296);
  };
}

function pickWeightedTrait({ role = null, seed = Date.now() } = {}) {
  const rand = seededRandom(seed);
  let pool = role ? getTraitsForRole(role) : getAllTraits();
  if (!pool.length) pool = getAllTraits();

  const total = pool.reduce((sum, trait) => {
    const rarity = getTraitRarityInfo(trait.rarity);
    return sum + Number(rarity.weight || 1);
  }, 0);

  let roll = rand() * total;
  for (const trait of pool) {
    const rarity = getTraitRarityInfo(trait.rarity);
    roll -= Number(rarity.weight || 1);
    if (roll <= 0) return trait;
  }

  return pool[0];
}

function getCardTrait(card = {}) {
  if (card.traitName) return getTrait(card.traitName);
  if (card.trait) return getTrait(card.trait);
  return null;
}

function getCardTraitTier(card = {}) {
  return clamp(card.traitTier || 0, 0, traitConfig.rules.maxTraitTier || 5);
}

function getTraitMaxTier(trait) {
  if (!trait) return 0;
  const rarityInfo = getTraitRarityInfo(trait.rarity);
  return Math.min(Number(rarityInfo.maxTier || 5), traitConfig.rules.maxTraitTier || 5);
}

function scaleCost(base = {}, tier = 0, rarity = 'COMMON') {
  const rarityMult = traitConfig.upgradeCosts.rarityMultiplier[normalizeUpper(rarity)] || 1;
  const tierMult = Math.pow(traitConfig.upgradeCosts.tierMultiplier || 1.65, Number(tier || 0));
  const out = {};

  for (const [key, value] of Object.entries(base)) {
    if (typeof value === 'number') out[key] = Math.ceil(value * rarityMult * tierMult);
    else out[key] = value;
  }

  const extra = traitConfig.upgradeCosts.extraCosts[normalizeUpper(rarity)] || {};
  for (const [key, value] of Object.entries(extra)) {
    out[key] = Math.ceil(Number(value || 0) * Math.max(1, Number(tier || 0) + 1));
  }

  return out;
}

function getTraitUnlockCost(card = {}) {
  return { ...traitConfig.unlockCosts };
}

function getTraitUpgradeCost(card = {}) {
  const trait = getCardTrait(card);
  if (!trait) return { ok: false, reason: 'No trait unlocked.', cost: getTraitUnlockCost(card) };

  const tier = getCardTraitTier(card);
  const maxTier = getTraitMaxTier(trait);
  if (tier >= maxTier) return { ok: false, reason: 'Trait is maxed.', cost: {} };

  return {
    ok: true,
    trait,
    currentTier: tier,
    nextTier: tier + 1,
    maxTier,
    cost: scaleCost(traitConfig.upgradeCosts.base, tier, trait.rarity)
  };
}

function formatCost(cost = {}) {
  const labels = {
    gold: '🪙 Gold',
    essence: '🔮 Essence',
    traitDust: '🧬 Trait Dust',
    traitCrystals: '💠 Trait Crystals',
    voidCrystals: '💎 Void Crystals',
    voidSigils: '🌌 Void Sigils',
    secretCores: '🌠 Secret Cores'
  };

  const lines = Object.entries(cost).map(([key, value]) => {
    return `${labels[key] || key}: **${Number(value).toLocaleString()}**`;
  });

  return lines.length ? lines.join('\n') : 'No cost.';
}

function formatTrait(trait, tier = 1) {
  if (!trait) return 'No trait unlocked.';

  const maxTier = getTraitMaxTier(trait);
  const effectLines = Object.entries(trait.effects || {}).map(([key, value]) => {
    return `- ${key}: ${value}`;
  });

  return [
    `${trait.emoji || '🧬'} **${trait.name}**`,
    `Rarity: **${trait.rarity}**`,
    `Tier: **${tier}/${maxTier}**`,
    `Roles: **${(trait.roles || []).join(', ')}**`,
    trait.description || '',
    '',
    '**Effects**',
    effectLines.join('\n') || '- No effect data'
  ].join('\n');
}

function formatTraitList(role = null) {
  const traits = role ? getTraitsForRole(role) : getAllTraits();

  return traits.map(t => {
    return `${t.emoji || '🧬'} **${t.name}** • ${t.rarity} • ${t.description}`;
  }).join('\n');
}

function formatTraitUpgradePreview(card = {}) {
  const data = getTraitUpgradeCost(card);
  if (!data.ok) {
    return [
      '🧬 **Trait Upgrade**',
      data.reason,
      '',
      '**Cost / Unlock Cost**',
      formatCost(data.cost)
    ].join('\n');
  }

  return [
    '🧬 **Trait Upgrade Preview**',
    `${data.trait.emoji || '🧬'} **${data.trait.name}**: ${data.currentTier} → ${data.nextTier}`,
    '',
    '**Cost**',
    formatCost(data.cost)
  ].join('\n');
}

function applyTraitUnlock(card = {}, options = {}) {
  if (getCardTrait(card)) {
    return { ok: false, card, reason: 'Trait already unlocked.' };
  }

  const character = card.character || card.template || card;
  const role = character.role || character.type || card.role || 'DPS';
  const trait = options.traitName ? getTrait(options.traitName) : pickWeightedTrait({ role, seed: options.seed || `${card.id}:${Date.now()}` });

  if (!trait) return { ok: false, card, reason: 'No trait found.' };

  return {
    ok: true,
    card: {
      ...card,
      traitName: trait.name,
      traitTier: 1
    },
    trait,
    reason: 'trait_unlocked'
  };
}

function applyTraitUpgrade(card = {}) {
  const data = getTraitUpgradeCost(card);
  if (!data.ok) return { ok: false, card, reason: data.reason };

  return {
    ok: true,
    card: {
      ...card,
      traitTier: data.nextTier
    },
    trait: data.trait,
    reason: 'trait_upgraded'
  };
}

function applyTraitStatBonuses(unit = {}, traitName = null, tier = 1) {
  const trait = traitName ? getTrait(traitName) : null;
  if (!trait) return unit;

  const out = { ...unit };
  const t = clamp(tier, 1, getTraitMaxTier(trait));
  const e = trait.effects || {};

  function incPercent(stat, percent) {
    if (stat in out) out[stat] = Math.floor(Number(out[stat] || 0) * (1 + (percent * t) / 100));
  }

  if (e.atkPercentPerTier) incPercent('atk', e.atkPercentPerTier);
  if (e.hpPercentPerTier) {
    incPercent('maxHp', e.hpPercentPerTier);
    out.hp = Math.min(out.maxHp, Math.floor(Number(out.hp || out.maxHp) * (1 + (e.hpPercentPerTier * t) / 100)));
  }
  if (e.defPercentPerTier) incPercent('def', e.defPercentPerTier);
  if (e.spdPercentPerTier) incPercent('spd', e.spdPercentPerTier);

  if (e.critRatePercentPerTier) out.critRate = Math.min(100, Number(out.critRate || 0) + e.critRatePercentPerTier * t);
  if (e.critDamagePercentPerTier) out.critDamage = Number(out.critDamage || 0) + e.critDamagePercentPerTier * t;
  if (e.dodgePercentPerTier) out.dodgeChance = Math.min(80, Number(out.dodgeChance || 0) + e.dodgePercentPerTier * t);
  if (e.counterChancePercentPerTier) out.counterChance = Math.min(80, Number(out.counterChance || 0) + e.counterChancePercentPerTier * t);
  if (e.effectChancePercentPerTier) out.effectChance = Math.min(100, Number(out.effectChance || 0) + e.effectChancePercentPerTier * t);
  if (e.effectResistancePercentPerTier) out.effectResistance = Math.min(95, Number(out.effectResistance || 0) + e.effectResistancePercentPerTier * t);
  if (e.healingBonusPercentPerTier) out.healingBonus = Number(out.healingBonus || 0) + e.healingBonusPercentPerTier * t;
  if (e.shieldPowerPercentPerTier) out.shieldPower = Number(out.shieldPower || 0) + e.shieldPowerPercentPerTier * t;

  out.traitName = trait.name;
  out.traitTier = t;
  return out;
}

module.exports = {
  clamp,
  normalize,
  normalizeUpper,
  getTrait,
  getAllTraits,
  getTraitsForRole,
  getTraitRarityInfo,
  pickWeightedTrait,
  getCardTrait,
  getCardTraitTier,
  getTraitMaxTier,
  getTraitUnlockCost,
  getTraitUpgradeCost,
  formatCost,
  formatTrait,
  formatTraitList,
  formatTraitUpgradePreview,
  applyTraitUnlock,
  applyTraitUpgrade,
  applyTraitStatBonuses
};
