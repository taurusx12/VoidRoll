const { createCanvas } = require('@napi-rs/canvas');

const rarityColors = {
  COMMON: '#BFC7D5',
  RARE: '#3B82F6',
  EPIC: '#A855F7',
  LEGENDARY: '#F59E0B',
  MYTHIC: '#EF4444',
  DIVINE: '#F472B6',
  SECRET: '#22D3EE'
};

async function renderItemCard(eq) {
  const canvas = createCanvas(768, 1024);
  const ctx = canvas.getContext('2d');

  const rarity = eq.template?.rarity || 'COMMON';
  const color = rarityColors[rarity] || '#8B5CF6';

  const gradient = ctx.createLinearGradient(0, 0, 768, 1024);
  gradient.addColorStop(0, '#050816');
  gradient.addColorStop(0.5, '#111827');
  gradient.addColorStop(1, '#020617');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 768, 1024);

  ctx.strokeStyle = color;
  ctx.lineWidth = 16;
  ctx.strokeRect(40, 40, 688, 944);

  ctx.shadowColor = color;
  ctx.shadowBlur = 35;
  ctx.strokeRect(70, 70, 628, 884);
  ctx.shadowBlur = 0;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(384, 410, 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(eq.template?.name || 'Unknown Item', 384, 720);

  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(`${rarity} • ${eq.template?.slot || 'ITEM'}`, 384, 780);

  ctx.fillStyle = '#E5E7EB';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText(`PWR ${eq.power || 0}`, 384, 850);

  return canvas.encode('png');
}

module.exports = { renderItemCard };
