// Checks if famous characters exist in the current database.
// Run after the bot database is connected:
// node scripts/audit-famous-characters.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const famousCharacters = [
  'Gojo', 'Sukuna', 'Makima', 'Aizen', 'Madara', 'Itachi', 'Naruto', 'Sasuke',
  'Luffy', 'Zoro', 'Sanji', 'Ichigo', 'Rukia', 'Kenpachi', 'Goku', 'Vegeta',
  'Gohan', 'Killua', 'Gon', 'Kurapika', 'Hisoka', 'Levi', 'Eren', 'Mikasa',
  'Tanjiro', 'Nezuko', 'Zenitsu', 'Rimuru', 'Ainz', 'Saber', 'Natsu', 'Erza',
  'Yami', 'Deku', 'Bakugo', 'All Might', 'Denji', 'Power', 'Lelouch',
  'Sung Jin-Woo', 'Beru', 'Igris'
];

function norm(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const all = await prisma.character.findMany({
    select: { id: true, name: true, anime: true, rarity: true }
  });

  const found = [];
  const missing = [];

  for (const wanted of famousCharacters) {
    const wantedNorm = norm(wanted);
    const matches = all.filter(c => norm(c.name).includes(wantedNorm) || wantedNorm.includes(norm(c.name)));
    if (matches.length) found.push({ wanted, matches: matches.slice(0, 5) });
    else missing.push(wanted);
  }

  console.log('=== Famous Character Audit ===');
  console.log(`Total characters in database: ${all.length}`);
  console.log(`Found: ${found.length}`);
  console.log(`Missing: ${missing.length}`);

  console.log('\n--- Missing ---');
  for (const name of missing) console.log(`- ${name}`);

  console.log('\n--- Found sample ---');
  for (const row of found.slice(0, 20)) {
    console.log(`- ${row.wanted}: ${row.matches.map(m => `${m.name} (${m.anime || 'Unknown'} / ${m.rarity})`).join(', ')}`);
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
