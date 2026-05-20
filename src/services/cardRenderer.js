const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const W = 720;
const H = 1000;

const rarityColor = {
  COMMON: '#9CA3AF',
  RARE: '#3B82F6',
  EPIC: '#A855F7',
  LEGENDARY: '#F59E0B',
  MYTHIC: '#EF4444',
  DIVINE: '#F472B6',
  SECRET: '#111827'
};

function esc(s='') {
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'
  }[m]));
}

function asset(type, rarity) {
  const key = String(rarity || 'COMMON').toLowerCase();
  return path.join(process.cwd(), 'assets', type, `${key}.png`);
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function renderCard({ card, character }) {
  const rarity = character.rarity || 'COMMON';
  const color = rarityColor[rarity] || '#8B5CF6';

  const bgPath = asset('backgrounds', rarity);
  const framePath = asset('frames', rarity);
  const overlayPath = path.join(process.cwd(), 'assets', 'overlays', 'shine.png');

  const bg = fs.existsSync(bgPath)
    ? sharp(bgPath).resize(W, H).png()
    : sharp({ create: { width: W, height: H, channels: 4, background: '#090b16' } }).png();

  const textSvg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.85"/>
      </filter>
    </defs>
    <rect x="90" y="750" width="540" height="150" rx="24" fill="#00000099"/>
    <text x="360" y="805" text-anchor="middle" font-size="42" font-weight="900" fill="#ffffff" filter="url(#shadow)">${esc(character.name)}</text>
    <text x="360" y="852" text-anchor="middle" font-size="27" font-weight="800" fill="${color}" filter="url(#shadow)">${esc(rarity)} • #${card.serial}</text>
    <text x="360" y="895" text-anchor="middle" font-size="24" font-weight="700" fill="#e5e7eb" filter="url(#shadow)">PWR ${card.power}</text>
  </svg>`;

  const composites = [];

  // Character image
  let charBuffer = await fetchImage(character.imageUrl);
  if (charBuffer) {
    try {
      const art = await sharp(charBuffer)
        .resize(570, 650, { fit: 'cover', position: 'top' })
        .png()
        .toBuffer();
      composites.push({ input: art, left: 75, top: 80 });
    } catch {}
  }

  if (fs.existsSync(framePath)) composites.push({ input: framePath, left: 0, top: 0 });
  composites.push({ input: Buffer.from(textSvg), left: 0, top: 0 });
  if (fs.existsSync(overlayPath)) composites.push({ input: overlayPath, left: 0, top: 0 });

  return await bg.composite(composites).png().toBuffer();
}

module.exports = { renderCard };
