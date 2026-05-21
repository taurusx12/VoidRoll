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

function rarityFromRank(index) {
  if (index < 10) return 'DIVINE';
  if (index < 40) return 'MYTHIC';
  if (index < 120) return 'LEGENDARY';
  if (index < 300) return 'EPIC';
  if (index < 600) return 'RARE';
  return 'COMMON';
}

function powerFromRarity(rarity, favs = 0) {
  const base = {
    COMMON: 120,
    RARE: 260,
    EPIC: 520,
    LEGENDARY: 950,
    MYTHIC: 1500,
    DIVINE: 2400
  }[rarity] || 100;

  return base + Math.min(500, Math.floor((favs || 0) / 2000));
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

  for (let page = 1; characters.length < TARGET_COUNT; page++) {
    const batch = await fetchPage(page);

    for (const c of batch) {
      if (!c?.name?.full || !c?.image?.large) continue;

      const anime =
        c.media?.nodes?.[0]?.title?.english ||
        c.media?.nodes?.[0]?.title?.romaji ||
        'Unknown Anime';

      characters.push({
        id: `anilist-${c.id}`,
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
    const rarity = rarityFromRank(i);
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
