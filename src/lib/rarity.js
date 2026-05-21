const RARITY = {
  COMMON: { weight: 720000, mult: 1, emoji: '⚪' },
  RARE: { weight: 220000, mult: 1.5, emoji: '🔵' },
  EPIC: { weight: 56500, mult: 2.4, emoji: '🟣' },
  LEGENDARY: { weight: 10000, mult: 4, emoji: '🟡' },
  MYTHIC: { weight: 7500, mult: 7, emoji: '🔴' },
  DIVINE: { weight: 5000, mult: 12, emoji: '🌈' },
  SECRET: { weight: 1000, mult: 25, emoji: '🕳️' }
};

function rollRarity() {
  const total = Object.values(RARITY).reduce((a, b) => a + b.weight, 0);
  let r = Math.floor(Math.random() * total);

  for (const [name, data] of Object.entries(RARITY)) {
    if ((r -= data.weight) < 0) return name;
  }

  return 'COMMON';
}

function rarityEmoji(rarity) {
  return RARITY[rarity]?.emoji || '';
}

module.exports = { RARITY, rollRarity, rarityEmoji };
