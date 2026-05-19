const AURA_BY_CHARACTER = {
  'Satoru Gojo': { name: 'Hollow Purple', color: '#7C3AED', secondary: '#38BDF8', intensity: 1.45 },
  'Ryomen Sukuna': { name: 'Malevolent Shrine', color: '#DC2626', secondary: '#111827', intensity: 1.55 },
  'Gon Freecss': { name: 'Jajanken Emerald', color: '#22C55E', secondary: '#FACC15', intensity: 1.35 },
  'Killua Zoldyck': { name: 'Godspeed Lightning', color: '#60A5FA', secondary: '#E0F2FE', intensity: 1.35 },
  'Naruto Uzumaki': { name: 'Nine-Tails Chakra', color: '#F97316', secondary: '#FDE047', intensity: 1.35 },
  'Sasuke Uchiha': { name: 'Chidori Storm', color: '#2563EB', secondary: '#7C3AED', intensity: 1.3 },
  'Madara Uchiha': { name: 'Susanoo Wrath', color: '#7E22CE', secondary: '#EF4444', intensity: 1.5 },
  'Monkey D. Luffy': { name: 'Sun God Drums', color: '#FACC15', secondary: '#FFFFFF', intensity: 1.45 },
  'Roronoa Zoro': { name: 'Ashura Jade', color: '#16A34A', secondary: '#111827', intensity: 1.25 },
  'Shanks': { name: 'Conqueror Haki', color: '#B91C1C', secondary: '#FCD34D', intensity: 1.45 },
  'Levi Ackerman': { name: 'Steel Cyclone', color: '#94A3B8', secondary: '#22D3EE', intensity: 1.15 },
  'Eren Yeager': { name: 'Titan Rage', color: '#DC2626', secondary: '#F59E0B', intensity: 1.35 },
  'Ichigo Kurosaki': { name: 'Getsuga Eclipse', color: '#F97316', secondary: '#111827', intensity: 1.35 },
  'Aizen Sosuke': { name: 'Kyoka Suigetsu', color: '#A855F7', secondary: '#EC4899', intensity: 1.5 },
  'Goku': { name: 'Ultra Instinct', color: '#E5E7EB', secondary: '#60A5FA', intensity: 1.6 },
  'Vegeta': { name: 'Royal Blue Evolution', color: '#1D4ED8', secondary: '#FACC15', intensity: 1.35 },
  'Tanjiro Kamado': { name: 'Water Breathing', color: '#0EA5E9', secondary: '#22C55E', intensity: 1.15 },
  'Nezuko Kamado': { name: 'Blood Demon Bloom', color: '#EC4899', secondary: '#FCA5A5', intensity: 1.2 }
};

const AURA_BY_RARITY = {
  COMMON: { name: 'Soft Glow', color: '#A3A3A3', secondary: '#FFFFFF', intensity: 0.65 },
  RARE: { name: 'Azure Aura', color: '#2563EB', secondary: '#93C5FD', intensity: 0.85 },
  EPIC: { name: 'Violet Aura', color: '#9333EA', secondary: '#F0ABFC', intensity: 1.0 },
  LEGENDARY: { name: 'Golden Aura', color: '#F59E0B', secondary: '#FEF08A', intensity: 1.2 },
  MYTHIC: { name: 'Crimson Myth', color: '#DC2626', secondary: '#FCA5A5', intensity: 1.35 },
  DIVINE: { name: 'Divine Prism', color: '#FDE047', secondary: '#A78BFA', intensity: 1.55 },
  SECRET: { name: 'Abyss Secret', color: '#020617', secondary: '#7C3AED', intensity: 1.8 }
};

function getAura(character) {
  return AURA_BY_CHARACTER[character.name] || AURA_BY_RARITY[character.rarity] || AURA_BY_RARITY.COMMON;
}

function embedColor(hex) {
  return parseInt(hex.replace('#',''), 16);
}

module.exports = { getAura, embedColor, AURA_BY_CHARACTER, AURA_BY_RARITY };
