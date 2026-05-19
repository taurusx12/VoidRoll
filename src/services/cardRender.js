const sharp = require('sharp');
const { getAura } = require('../lib/aura');

function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }

async function imageLayer(imageUrl) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { headers: { 'user-agent': 'AnimeCardBot/1.0' } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await sharp(buf).resize(760, 900, { fit: 'cover', position: 'top' }).png().toBuffer();
  } catch (_) { return null; }
}

async function renderCard({ card, character }) {
  const aura = getAura(character);
  const rarity = character.rarity;
  const w = 900, h = 1260;
  const glow = Math.round(90 * aura.intensity);
  const bg = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="aura" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stop-color="${aura.secondary}" stop-opacity="0.95"/>
        <stop offset="35%" stop-color="${aura.color}" stop-opacity="0.78"/>
        <stop offset="75%" stop-color="#050816" stop-opacity="1"/>
      </radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="${glow}" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="frame" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${aura.secondary}"/><stop offset="0.5" stop-color="${aura.color}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
    </defs>
    <rect width="100%" height="100%" rx="48" fill="#050816"/>
    <rect x="34" y="34" width="832" height="1192" rx="42" fill="url(#aura)"/>
    <circle cx="450" cy="410" r="330" fill="${aura.color}" opacity="0.52" filter="url(#glow)"/>
    <circle cx="450" cy="410" r="230" fill="${aura.secondary}" opacity="0.42" filter="url(#glow)"/>
    <path d="M110 990 C270 930 630 930 790 990 L820 1140 L80 1140 Z" fill="#020617" opacity="0.72"/>
    <rect x="44" y="44" width="812" height="1172" rx="38" fill="none" stroke="url(#frame)" stroke-width="16"/>
    <rect x="70" y="935" width="760" height="230" rx="28" fill="#020617" opacity="0.83"/>
    <text x="450" y="1007" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#ffffff">${esc(character.name)}</text>
    <text x="450" y="1062" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="${aura.secondary}">${esc(aura.name)}</text>
    <text x="450" y="1112" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="${aura.color}">${esc(rarity)} • #${card.serial} • PWR ${card.power}</text>
    ${card.shiny ? '<text x="450" y="160" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="900" fill="#fff">✨ SHINY ✨</text>' : ''}
  </svg>`;

  const layers = [{ input: Buffer.from(bg), top: 0, left: 0 }];
  const img = await imageLayer(character.imageUrl);
  if (img) layers.splice(1, 0, { input: img, top: 115, left: 70 });
  const overlay = `
  <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="fog"><feGaussianBlur stdDeviation="34"/></filter></defs>
    <ellipse cx="450" cy="650" rx="390" ry="260" fill="${aura.color}" opacity="0.22" filter="url(#fog)"/>
    <rect x="44" y="44" width="812" height="1172" rx="38" fill="none" stroke="${aura.secondary}" stroke-opacity="0.45" stroke-width="4"/>
  </svg>`;
  layers.push({ input: Buffer.from(overlay), top: 0, left: 0 });
  return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
}

module.exports = { renderCard };
