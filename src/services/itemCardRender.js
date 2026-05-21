const sharp = require('sharp');

const colors = {
  COMMON: '#BFC7D5', RARE: '#3B82F6', EPIC: '#A855F7', LEGENDARY: '#F59E0B',
  MYTHIC: '#EF4444', DIVINE: '#F472B6', SECRET: '#22D3EE'
};

function weaponIcon(slot) {
  if (slot === 'WEAPON') return '⚔';
  if (slot === 'ARMOR') return '🛡';
  if (slot === 'RING') return '◈';
  return '✦';
}

async function renderItemCard(eq) {
  const t = eq.template;
  const color = colors[t.rarity] || '#ffffff';
  const icon = weaponIcon(t.slot);
  const name = String(t.name).replace(/&/g, '&amp;');
  const bonus = `${t.bonusType || 'POWER'} +${t.bonusValue || 0}`;
  const character = t.characterHint ? `Best on: ${t.characterHint}` : 'Universal Item';

  const svg = `
  <svg width="720" height="1000" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#050816"/>
        <stop offset="55%" stop-color="#16112b"/>
        <stop offset="100%" stop-color="${color}"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="10" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="720" height="1000" rx="48" fill="url(#bg)"/>
    <rect x="35" y="35" width="650" height="930" rx="42" fill="none" stroke="${color}" stroke-width="12" filter="url(#glow)"/>
    <rect x="85" y="95" width="550" height="570" rx="32" fill="#00000088" stroke="#ffffff55" stroke-width="4"/>
    <text x="360" y="430" text-anchor="middle" font-size="220" fill="${color}" filter="url(#glow)">${icon}</text>
    <rect x="85" y="705" width="550" height="180" rx="28" fill="#050816cc"/>
    <text x="360" y="765" text-anchor="middle" font-size="38" font-weight="800" fill="#fff">${name}</text>
    <text x="360" y="815" text-anchor="middle" font-size="28" font-weight="700" fill="${color}">${t.rarity} • ${t.slot}</text>
    <text x="360" y="855" text-anchor="middle" font-size="24" fill="#e5e7eb">PWR ${eq.power} • ${bonus}</text>
    <text x="360" y="910" text-anchor="middle" font-size="22" fill="#cbd5e1">${character}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

module.exports = { renderItemCard };
