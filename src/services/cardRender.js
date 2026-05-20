const sharp = require('sharp');

async function renderCard({ card, character }) {
  const width = 720;
  const height = 1000;

  const rarityColors = {
    COMMON: '#9CA3AF',
    RARE: '#3B82F6',
    EPIC: '#A855F7',
    LEGENDARY: '#F59E0B',
    MYTHIC: '#EF4444',
    DIVINE: '#F472B6',
    SECRET: '#111827'
  };

  const color = rarityColors[character.rarity] || '#8B5CF6';
  const img = character.imageUrl || `https://api.dicebear.com/9.x/bottts-neutral/png?seed=${encodeURIComponent(character.name)}`;

  const svg = `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b1020"/>
        <stop offset="55%" stop-color="#17112b"/>
        <stop offset="100%" stop-color="${color}"/>
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="10" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <rect width="720" height="1000" rx="46" fill="url(#bg)"/>
    <rect x="28" y="28" width="664" height="944" rx="38" fill="none" stroke="${color}" stroke-width="10" filter="url(#glow)"/>
    <rect x="58" y="70" width="604" height="680" rx="32" fill="#050814" stroke="#ffffff33" stroke-width="3"/>
    <rect x="80" y="790" width="560" height="130" rx="24" fill="#00000066"/>

    <text x="360" y="830" text-anchor="middle" font-size="44" font-weight="800" fill="#fff">${character.name}</text>
    <text x="360" y="875" text-anchor="middle" font-size="28" font-weight="700" fill="${color}">${character.rarity} • #${card.serial}</text>
    <text x="360" y="915" text-anchor="middle" font-size="24" fill="#e5e7eb">PWR ${card.power}</text>
  </svg>`;

  const base = sharp(Buffer.from(svg)).png();

  if (!img) return await base.toBuffer();

  try {
    const response = await fetch(img);
const arrayBuffer = await response.arrayBuffer();
const buffer = Buffer.from(arrayBuffer);

const image = await sharp(buffer)
      .resize(560, 640, { fit: 'cover' })
      .png()
      .toBuffer();

    return await base
      .composite([{ input: image, left: 80, top: 90 }])
      .png()
      .toBuffer();
  } catch {
    return await base.toBuffer();
  }
}

module.exports = { renderCard };
