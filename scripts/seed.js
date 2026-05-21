const { prisma } = require('../src/lib/db');

const ANILIST_URL = 'https://graphql.anilist.co';
const TARGET_COUNT = 1000;

const query = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    characters(sort: FAVOURITES_DESC) {
      id
      name { full }
      image { large }
      favourites
      media(sort: POPULARITY_DESC, perPage: 1) {
        nodes { title { romaji english } }
      }
    }
  }
}
`;

const divineNames = [
  'sukuna', 'satoru gojo', 'gojo', 'yoriichi', 'goku', 'vegeta',
  'madara', 'aizen', 'rimuru', 'anos', 'all might', 'all for one',
  'shigaraki', 'star and stripe', 'whitebeard', 'gol d. roger',
  'roger', 'shanks', 'kaido', 'muzan', 'meruem', 'netero',
  'saitama', 'zeref', 'acnologia', 'escanor', 'meliodas'
];

const mythicNames = [
  'naruto', 'sasuke', 'itachi', 'luffy', 'zoro', 'ichigo',
  'tanjiro', 'rengoku', 'akaza', 'yoruichi', 'levi', 'eren',
  'bakugou', 'bakugo', 'todoroki', 'deku', 'izuku', 'killua',
  'gon', 'hisoka', 'kurapika', 'chrollo', 'pain', 'obito',
  'minato', 'kakashi', 'ace', 'sabo', 'law', 'sanji'
];

const legendaryNames = [
  'nezuko', 'inosuke', 'zenitsu', 'giyu', 'tengen', 'uzui',
  'mitsuri', 'tokito', 'muichiro', 'shinobu', 'obanai', 'gyomei',
  'mikasa', 'armin', 'endeavor', 'hawks', 'dabi', 'toga',
  'megumi', 'yuji', 'itadori', 'nobara', 'toji', 'geto',
  'yor', 'loid', 'anya'
];

function normalize(text = '') {
  return text.toLowerCase();
}

function hasAny(text, list) {
  return list.some(x => text.includes(x));
}

function rarityFromCharacter(character, index) {
  const name = normalize(character.name);
  const anime = normalize(character.anime);
  const favs = character.favourites || 0;

  if (
    name.includes('gear 5') ||
    name.includes('ultra instinct') ||
    name.includes('baryon') ||
    name.includes('six paths') ||
    name.includes('founding titan') ||
    name.includes('final getsuga') ||
    name.includes('true bankai') ||
    name.includes('demon king') ||
    name.includes('god')
  ) {
    return 'DIVINE';
  }

  if (hasAny(name, divineNames)) return 'DIVINE';
  if (hasAny(name, mythicNames)) return 'MYTHIC';
  if (hasAny(name, legendaryNames)) return 'LEGENDARY';

  if (favs >= 30000) return 'MYTHIC';
  if (favs >= 15000) return 'LEGENDARY';
  if (favs >= 6000) return 'EPIC';
  if (favs >= 2000) return 'RARE';

  if (index < 80) return 'LEGENDARY';
  if (index < 250) return 'EPIC';
  if (index < 600) return 'RARE';
  return 'COMMON';
}

function powerFromRarity(rarity, favs = 0) {
  const base = {
    COMMON: 150,
    RARE: 350,
    EPIC: 800,
    LEGENDARY: 1600,
    MYTHIC: 3200,
    DIVINE: 6000,
    SECRET: 10000
  }[rarity] || 100;

  const favBonus = Math.min(1200, Math.floor((favs || 0) / 1200));
  const randomBonus = Math.floor(Math.random() * 150);

  return base + favBonus + randomBonus;
}

async function fetchPage(page) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      query,
      variables: { page, perPage: 50 }
    })
  });

  if (!res.ok) {
    throw new Error(`AniList error ${res.status}`);
  }

  const json = await res.json();
  return json.data.Page.characters;
}

const eq = [
  ['Iron Blade','WEAPON','COMMON',20],
  ['Hunter Dagger','WEAPON','RARE',45],
  ['Cursed Katana','WEAPON','EPIC',95],
  ['Titan Guard Armor','ARMOR','LEGENDARY',160],
  ['Infinity Cloak','ARMOR','MYTHIC',260],
  ['Demon King Ring','RING','DIVINE',420],
  ['Void Artifact','ARTIFACT','MYTHIC',300]
];

(async () => {
  console.log('Fetching anime characters from AniList...');

  const characters = [];
  const seen = new Set();

  for (let page = 1; characters.length < TARGET_COUNT; page++) {
    const batch = await fetchPage(page);

    for (const c of batch) {
      if (!c?.name?.full || !c?.image?.large) continue;

      const anime =
        c.media?.nodes?.[0]?.title?.english ||
        c.media?.nodes?.[0]?.title?.romaji ||
        'Unknown Anime';

      const id = `anilist-${c.id}`;

      if (seen.has(id)) continue;
      seen.add(id);

      characters.push({
        id,
        name: c.name.full,
        anime,
        imageUrl: c.image.large,
        favourites: c.favourites || 0
      });

      if (characters.length >= TARGET_COUNT) break;
    }

    await new Promise(resolve => setTimeout(resolve, 800));
  }

  await prisma.userCard.deleteMany();
  await prisma.character.deleteMany();

  for (let i = 0; i < characters.length; i++) {
    const c = characters[i];
    const rarity = rarityFromCharacter(c, i);
    const power = powerFromRarity(rarity, c.favourites);

    await prisma.character.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        anime: c.anime,
        rarity,
        element: 'Anime',
        imageUrl: c.imageUrl,
        basePower: power,
        baseFarm: Math.floor(power / 10),
        baseLuck: Math.floor(power / 30),
        active: true
      },
      create: {
        id: c.id,
        name: c.name,
        anime: c.anime,
        rarity,
        element: 'Anime',
        imageUrl: c.imageUrl,
        basePower: power,
        baseFarm: Math.floor(power / 10),
        baseLuck: Math.floor(power / 30),
        active: true
      }
    });
  }

  for (const [name, slot, rarity, basePower] of eq) {
    await prisma.equipmentTemplate.upsert({
      where: { id: name.replace(/\s+/g, '-') },
      update: {},
      create: {
        id: name.replace(/\s+/g, '-'),
        name,
        slot,
        rarity,
        basePower
      }
    });
  }

  console.log(`Seed complete: ${characters.length} characters imported.`);
  await prisma.$disconnect();
})();
