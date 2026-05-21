const PRICE_LIMITS = {
  COMMON: { min: 100, max: 5000 },
  RARE: { min: 5000, max: 25000 },
  EPIC: { min: 25000, max: 120000 },
  LEGENDARY: { min: 120000, max: 600000 },
  MYTHIC: { min: 600000, max: 2500000 },
  DIVINE: { min: 2500000, max: 15000000 },
  SECRET: { min: 10000000, max: 50000000 }
};

const RARITY_XP = {
  COMMON: 40,
  RARE: 120,
  EPIC: 350,
  LEGENDARY: 1200,
  MYTHIC: 3500,
  DIVINE: 9000,
  SECRET: 20000
};

function priceLimit(rarity) {
  return PRICE_LIMITS[rarity] || PRICE_LIMITS.COMMON;
}

function sacrificeXp(rarity) {
  return RARITY_XP[rarity] || 25;
}

function levelFromPower(power) {
  return Math.floor(Math.sqrt(Math.max(1, power)) / 3);
}

function clampPrice(rarity, price) {
  const limit = priceLimit(rarity);
  return price >= limit.min && price <= limit.max;
}

module.exports = { PRICE_LIMITS, priceLimit, clampPrice, sacrificeXp, levelFromPower };
