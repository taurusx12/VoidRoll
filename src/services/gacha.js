const { nanoid } = require('nanoid');
const { prisma } = require('../lib/db');
const { rollRarity, rarityEmoji } = require('../lib/rarity');
async function rollCard(userId) {
  let rarity = rollRarity();
  let pool = await prisma.character.findMany({ where: { rarity, active: true } });
  if (!pool.length) pool = await prisma.character.findMany({ where: { active: true } });
  if (!pool.length) throw new Error('No characters seeded. Run npm run seed or npm run import:anime');
  const character = pool[Math.floor(Math.random() * pool.length)];
  const updated = await prisma.character.update({ where: { id: character.id }, data: { globalPrint: { increment: 1 } } });
  const shiny = Math.random() < 0.004;
  const traits = ['Berserker','Genius','Cursed','Royal','Monarch','Lucky','Swift','Shadow'];
  const trait = Math.random() < 0.08 ? traits[Math.floor(Math.random()*traits.length)] : null;
  const power = Math.round(character.basePower * (shiny ? 1.35 : 1) + Math.random() * 20);
  const card = await prisma.userCard.create({
    data: { id: nanoid(12), userId, characterId: character.id, serial: updated.globalPrint, power, shiny, trait }
  });
  return { card, character: updated, text: `${rarityEmoji(updated.rarity)} ${shiny ? '✨ SHINY ' : ''}${updated.name} #${updated.globalPrint} (${updated.rarity})` };
}
module.exports = { rollCard };
