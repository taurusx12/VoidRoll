const RARITY = {
  COMMON: { weight: 650000, mult: 1, emoji: '⚪' },
  RARE: { weight: 250000, mult: 1.5, emoji: '🔵' },
  EPIC: { weight: 80000, mult: 2.4, emoji: '🟣' },
  LEGENDARY: { weight: 17000, mult: 4, emoji: '🟡' },
  MYTHIC: { weight: 2500, mult: 7, emoji: '🔴' },
  DIVINE: { weight: 450, mult: 12, emoji: '🌈' },
  SECRET: { weight: 50, mult: 25, emoji: '🕳️' }
};
function rollRarity() {
  const total = Object.values(RARITY).reduce((a,b)=>a+b.weight,0);
  let r = Math.floor(Math.random()*total);
  for (const [name, data] of Object.entries(RARITY)) { if ((r -= data.weight) < 0) return name; }
  return 'COMMON';
}
function rarityEmoji(rarity) { return RARITY[rarity]?.emoji || '🎴'; }
module.exports = { RARITY, rollRarity, rarityEmoji };
