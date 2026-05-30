// VoidRoll Reborn - Phase 4 Market System
// Daily Market + Black Market + Void Market + Traveling Merchant.
// No item rolls, no relic pulls, no aura pulls, no character-specific shards.

const marketConfig = require('../config/market_config.json');

const MARKET_TYPES = Object.keys(marketConfig.marketTypes);

function normalizeMarketType(type = 'daily') {
  const value = String(type || 'daily').toLowerCase();
  return MARKET_TYPES.includes(value) ? value : 'daily';
}

function getMarketInfo(type = 'daily') {
  return marketConfig.marketTypes[normalizeMarketType(type)];
}

function getMarketPool(type = 'daily') {
  return marketConfig.itemPools[normalizeMarketType(type)] || [];
}

function getRefreshKey(date = new Date(), refreshHours = marketConfig.refreshHours || 24) {
  const ms = date.getTime();
  const bucket = Math.floor(ms / (refreshHours * 60 * 60 * 1000));
  return String(bucket);
}

function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  const str = String(seed);
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

function pickRotatingItems(type = 'daily', date = new Date()) {
  const marketType = normalizeMarketType(type);
  const info = getMarketInfo(marketType);
  const pool = [...getMarketPool(marketType)];
  const refreshKey = getRefreshKey(date);
  const rand = seededRandom(`${marketType}:${refreshKey}:VoidRollReborn`);

  const slots = Math.min(info.slots || 6, pool.length);
  const result = [];

  while (result.length < slots && pool.length) {
    const index = Math.floor(rand() * pool.length);
    result.push(pool.splice(index, 1)[0]);
  }

  return result.map(item => ({
    ...item,
    marketType,
    refreshKey,
    finalPrice: applyDynamicPrice(item.price || {}, marketType, item)
  }));
}

function applyDynamicPrice(price = {}, marketType = 'daily', item = {}) {
  if (!marketConfig.dynamicPricing.enabled) return price;

  const baseMultiplierByMarket = {
    daily: 1,
    black: 1.08,
    void: 1.18,
    traveling: 0.92
  };

  let multiplier = baseMultiplierByMarket[marketType] || 1;

  if (item.type === 'cosmetic_unlock') multiplier += 0.08;
  if (item.resource === 'Secret Core') multiplier += 0.12;
  if (item.resource === 'Voidborn Shard') multiplier += 0.08;

  const min = marketConfig.dynamicPricing.minMultiplier || 0.85;
  const max = marketConfig.dynamicPricing.maxMultiplier || 1.35;
  multiplier = Math.max(min, Math.min(max, multiplier));

  const out = {};
  for (const [currency, amount] of Object.entries(price)) {
    out[currency] = Math.max(1, Math.ceil(Number(amount || 0) * multiplier));
  }
  return out;
}

function formatPrice(price = {}) {
  const labels = {
    gold: '🪙 Gold',
    tokens: '🎟️ Tokens',
    essence: '🔮 Essence',
    voidCrystals: '💎 Void Crystals'
  };

  return Object.entries(price)
    .map(([currency, amount]) => `${Number(amount).toLocaleString()} ${labels[currency] || currency}`)
    .join(' + ');
}

function formatMarket(type = 'daily', date = new Date()) {
  const marketType = normalizeMarketType(type);
  const info = getMarketInfo(marketType);
  const items = pickRotatingItems(marketType, date);

  const lines = items.map((item, idx) => {
    return `**${idx + 1}. ${item.name}**\n${item.amount}x ${item.resource}\nPrice: ${formatPrice(item.finalPrice)}\nStock: ${item.stock}`;
  });

  return {
    title: `${info.emoji} ${info.displayName}`,
    description: `${info.description}\nRefresh: every ${marketConfig.refreshHours} hours\n\n${lines.join('\n\n')}`,
    items
  };
}

function shouldTravelingMerchantAppear(date = new Date()) {
  const info = getMarketInfo('traveling');
  const refreshKey = getRefreshKey(date, info.durationHours || 6);
  const rand = seededRandom(`traveling:${refreshKey}:VoidRollReborn`)();
  return rand < (info.appearanceChance || 0.08);
}

module.exports = {
  MARKET_TYPES,
  normalizeMarketType,
  getMarketInfo,
  getMarketPool,
  getRefreshKey,
  pickRotatingItems,
  applyDynamicPrice,
  formatPrice,
  formatMarket,
  shouldTravelingMerchantAppear
};
