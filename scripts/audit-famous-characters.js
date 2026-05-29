require('dotenv').config();
const { prisma } = require('../src/lib/db');

const MUST_HAVE = [
  ['Aizen', 'Bleach'], ['Ichigo', 'Bleach'], ['Gojo', 'Jujutsu Kaisen'], ['Sukuna', 'Jujutsu Kaisen'],
  ['Makima', 'Chainsaw Man'], ['Denji', 'Chainsaw Man'], ['Madara', 'Naruto'], ['Naruto', 'Naruto'], ['Sasuke', 'Naruto'],
  ['Goku', 'Dragon Ball'], ['Vegeta', 'Dragon Ball'], ['Luffy', 'One Piece'], ['Zoro', 'One Piece'], ['Sanji', 'One Piece'],
  ['Rimuru', 'Tensei shitara Slime'], ['Lelouch', 'Code Geass'], ['Saber', 'Fate'], ['Ainz', 'Overlord'],
  ['Sung Jin-Woo', 'Solo Leveling'], ['Killua', 'Hunter'], ['Gon', 'Hunter'], ['Kurapika', 'Hunter'],
  ['Natsu', 'Fairy Tail'], ['Erza', 'Fairy Tail'], ['Itachi', 'Naruto'], ['Levi', 'Attack on Titan'], ['Eren', 'Attack on Titan']
];

const norm = v => String(v || '').toLowerCase().replace(/[().\-_:/'’]/g, ' ').replace(/\s+/g, ' ').trim();
const hit = (c, name, anime) => norm(c.name).includes(norm(name)) && (!anime || norm(c.anime).includes(norm(anime).split(' ')[0]));

async function main() {
  const chars = await prisma.character.findMany({ where: { active: true }, orderBy: { basePower: 'desc' }, take: 10000 });
  const missing = [];
  const found = [];
  for (const [name, anime] of MUST_HAVE) {
    const c = chars.find(x => hit(x, name, anime));
    if (c) found.push(`${name} -> ${c.name} [${c.anime}] ${c.rarity} PWR ${c.basePower}`);
    else missing.push(`${name} (${anime})`);
  }
  console.log('FAMOUS CHARACTER AUDIT');
  console.log('Total active characters:', chars.length);
  console.log('\nFOUND');
  console.log(found.join('\n') || 'None');
  console.log('\nMISSING');
  console.log(missing.join('\n') || 'None');
  if (missing.length) process.exitCode = 2;
}
main().finally(() => prisma.$disconnect());
