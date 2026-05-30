// VoidRoll Reborn - Phase 12 Banner Rework
// Character-only gacha with VOIDBORN/SECRET reveal integration.
// No item rolls, no relic pulls, no aura pulls, no fusion, no stars.

const bannerConfig = require('../config/banner_rework_config.json');

let revealSystem = null;
try {
  revealSystem = require('./revealSystem');
} catch (_) {
  revealSystem = null;
}

const RARITY_ORDER = bannerConfig.rarityOrder;

function normalizeUpper(value, fallback = 'COMMON') {
  const out = String(value || fallback).trim().toUpperCase();
  return out || fallback;
}

function normalizeType(type = 'normal') {
  const t = String(type || 'normal').trim().toLowerCase();
  if (t === 'banner') return 'featured';
  if (bannerConfig.bannerTypes[t]) return t;
  return 'normal';
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

function getRollConfig(type = 'normal') {
  const t = normalizeType(type);
  if (t === 'limited') return bannerConfig.limitedBanner;
  if (t === 'featured') return bannerConfig.bannerRoll;
  return bannerConfig.normalRoll;
}

function pickRarityFromRates(rates = {}, rand = Math.random) {
  const entries = Object.entries(rates);
  const total = entries.reduce((sum, [, value]) => sum + Number(value || 0), 0);
  let roll = rand() * total;

  for (const [rarity, rate] of entries) {
    roll -= Number(rate || 0);
    if (roll <= 0) return rarity;
  }

  return entries[entries.length - 1]?.[0] || 'COMMON';
}

function applyPity(baseRarity, pity = {}, type = 'featured') {
  const config = getRollConfig(type);
  const pityConfig = config.pity;
  if (!pityConfig || !pityConfig.enabled) return baseRarity;

  const secretPity = Number(pity.secret || 0) + 1;
  const voidbornPity = Number(pity.voidborn || 0) + 1;

  if (secretPity >= pityConfig.secretHardPity) return 'SECRET';
  if (voidbornPity >= pityConfig.voidbornHardPity) return 'VOIDBORN';

  return baseRarity;
}

function shouldUseFeatured(rarity = 'COMMON', banner = {}, pity = {}, rand = Math.random) {
  const featuredRarity = normalizeUpper(banner.featuredRarity || 'SECRET');
  const rolled = normalizeUpper(rarity);

  if (!banner.featuredCharacter) return false;
  if (rolled !== featuredRarity) return false;

  const weights = bannerConfig.bannerRoll.featuredWeights;
  const chance = featuredRarity === 'SECRET'
    ? Number(weights.featuredSecretIfSecret || 65)
    : Number(weights.featuredVoidbornIfVoidborn || 70);

  if (pity.featuredGuaranteeNext) return true;
  return (rand() * 100) < chance;
}

function updatePityAfterRoll(pity = {}, rarity = 'COMMON', gotFeatured = false) {
  const r = normalizeUpper(rarity);
  const out = {
    secret: Number(pity.secret || 0) + 1,
    voidborn: Number(pity.voidborn || 0) + 1,
    featuredGuaranteeNext: Boolean(pity.featuredGuaranteeNext)
  };

  if (r === 'SECRET') {
    out.secret = 0;
    if (gotFeatured) out.featuredGuaranteeNext = false;
    else out.featuredGuaranteeNext = true;
  }

  if (r === 'VOIDBORN') {
    out.voidborn = 0;
  }

  return out;
}

function filterPoolByRarity(characters = [], rarity = 'COMMON') {
  const r = normalizeUpper(rarity);
  return characters.filter(c => normalizeUpper(c.rarity) === r);
}

function scoreCharacterForBanner(character = {}, banner = {}) {
  let score = 1;

  if (banner.anime && String(character.anime || '').toLowerCase() === String(banner.anime).toLowerCase()) score += 25;
  if (banner.element && normalizeUpper(character.element) === normalizeUpper(banner.element)) score += 10;
  if (banner.role && normalizeUpper(character.role || character.type) === normalizeUpper(banner.role)) score += 10;

  const tags = (banner.poolTags || []).map(x => String(x).toLowerCase());
  const hay = [
    character.name,
    character.variant,
    character.anime,
    character.rarity,
    character.element,
    character.role,
    character.type
  ].map(x => String(x || '').toLowerCase()).join(' ');

  for (const tag of tags) if (hay.includes(tag)) score += 8;

  return score;
}

function pickCharacterFromPool(characters = [], rarity = 'COMMON', banner = null, rand = Math.random) {
  const pool = filterPoolByRarity(characters, rarity);
  if (!pool.length) return null;

  if (!banner) return pool[Math.floor(rand() * pool.length)];

  const weighted = pool.map(c => ({ character: c, weight: scoreCharacterForBanner(c, banner) }));
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  let roll = rand() * total;

  for (const row of weighted) {
    roll -= row.weight;
    if (roll <= 0) return row.character;
  }

  return weighted[0].character;
}

function findFeaturedCharacter(characters = [], banner = {}) {
  const target = String(banner.featuredCharacter || '').toLowerCase();
  return characters.find(c => {
    const display = c.variant && c.variant !== 'Base' ? `${c.variant} ${c.name}` : c.name;
    return String(display || '').toLowerCase() === target
      || String(c.name || '').toLowerCase() === target;
  }) || null;
}

function rollOne({ type = 'normal', banner = null, characters = [], pity = {}, seed = Date.now() } = {}) {
  const rand = seededRandom(seed);
  const rollType = normalizeType(type);
  const config = getRollConfig(rollType);

  let rarity = pickRarityFromRates(config.rates, rand);
  rarity = applyPity(rarity, pity, rollType);

  let gotFeatured = false;
  let character = null;

  if (banner && shouldUseFeatured(rarity, banner, pity, rand)) {
    const featured = findFeaturedCharacter(characters, banner);
    if (featured) {
      character = featured;
      rarity = normalizeUpper(featured.rarity || rarity);
      gotFeatured = true;
    }
  }

  if (!character) {
    character = pickCharacterFromPool(characters, rarity, banner, rand);
  }

  const nextPity = updatePityAfterRoll(pity, rarity, gotFeatured);
  const revealPlan = revealSystem && character
    ? revealSystem.getDiscordRevealPlan(character)
    : null;

  return {
    type: rollType,
    rarity,
    character,
    gotFeatured,
    previousPity: pity,
    nextPity,
    revealPlan
  };
}

function rollMulti({ type = 'normal', banner = null, characters = [], pity = {}, amount = 10, seed = Date.now() } = {}) {
  let currentPity = { ...pity };
  const results = [];

  for (let i = 0; i < amount; i++) {
    const result = rollOne({
      type,
      banner,
      characters,
      pity: currentPity,
      seed: `${seed}:${i}`
    });

    currentPity = result.nextPity;
    results.push(result);
  }

  return {
    type: normalizeType(type),
    amount,
    results,
    nextPity: currentPity
  };
}

function getBannerCost(type = 'normal', amount = 1) {
  const config = getRollConfig(type);
  const multiAmount = config.multiAmount || 10;

  if (Number(amount) >= multiAmount && config.multiCost) return config.multiCost;
  return config.cost || {};
}

function formatCost(cost = {}) {
  const labels = {
    gold: '🪙 Gold',
    tokens: '🎟️ Tokens',
    essence: '🔮 Essence',
    voidCrystals: '💎 Void Crystals'
  };

  return Object.entries(cost).map(([key, value]) => {
    return `${Number(value).toLocaleString()} ${labels[key] || key}`;
  }).join(' + ');
}

function formatBanner(banner = {}, pity = {}) {
  const type = normalizeType(banner.type || 'featured');
  const typeInfo = bannerConfig.bannerTypes[type] || bannerConfig.bannerTypes.featured;
  const config = getRollConfig(type);

  return [
    `${typeInfo.emoji} **${banner.title || typeInfo.displayName}**`,
    `Featured: **${banner.featuredCharacter || 'None'}**`,
    `Rarity: **${banner.featuredRarity || 'Mixed'}**`,
    `Anime: **${banner.anime || 'Mixed'}**`,
    `Element: **${banner.element || 'Mixed'}** | Role: **${banner.role || 'Mixed'}**`,
    banner.quote ? `Quote: _${banner.quote}_` : '',
    '',
    `Single Pull: **${formatCost(config.cost)}**`,
    `Multi Pull x${config.multiAmount || 10}: **${formatCost(config.multiCost)}**`,
    '',
    `Pity — VOIDBORN: **${pity.voidborn || 0}/${config.pity?.voidbornHardPity || '-'}** | SECRET: **${pity.secret || 0}/${config.pity?.secretHardPity || '-'}**`
  ].filter(Boolean).join('\n');
}

function formatRollResult(result = {}) {
  const c = result.character || {};
  const display = c.variant && c.variant !== 'Base' ? `${c.variant} ${c.name}` : c.name;

  return [
    `${result.gotFeatured ? '🌟 FEATURED' : '🎴'} **${display || 'Unknown'}**`,
    `Rarity: **${result.rarity}**`,
    `Anime: **${c.anime || 'Unknown'}**`,
    `Element: **${c.element || 'Unknown'}** | Role: **${c.role || c.type || 'Unknown'}**`,
    `Power: **${Number(c.basePower || c.power || 0).toLocaleString()}**`
  ].join('\n');
}

function formatMultiRollSummary(multi = {}) {
  const lines = (multi.results || []).map((r, idx) => {
    const c = r.character || {};
    const display = c.variant && c.variant !== 'Base' ? `${c.variant} ${c.name}` : c.name;
    const featured = r.gotFeatured ? ' 🌟' : '';
    return `${idx + 1}. **${display || 'Unknown'}** • ${r.rarity}${featured}`;
  });

  return [
    `🎴 **${String(multi.type || 'normal').toUpperCase()} x${multi.amount || 10}**`,
    ...lines,
    '',
    `Next Pity — VOIDBORN: **${multi.nextPity?.voidborn || 0}** | SECRET: **${multi.nextPity?.secret || 0}**`
  ].join('\n');
}

module.exports = {
  RARITY_ORDER,
  normalizeUpper,
  normalizeType,
  seededRandom,
  getRollConfig,
  pickRarityFromRates,
  applyPity,
  shouldUseFeatured,
  updatePityAfterRoll,
  filterPoolByRarity,
  scoreCharacterForBanner,
  pickCharacterFromPool,
  findFeaturedCharacter,
  rollOne,
  rollMulti,
  getBannerCost,
  formatCost,
  formatBanner,
  formatRollResult,
  formatMultiRollSummary
};
