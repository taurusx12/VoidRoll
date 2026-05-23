require('dotenv').config();

const { nanoid } = require('nanoid');
const { prisma } = require('../src/lib/db');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalize(value = '') {
  return cleanText(value).toLowerCase();
}

function pickRarity(rank) {
  if (rank <= 100) return 'SECRET';
  if (rank <= 350) return 'DIVINE';
  if (rank <= 900) return 'MYTHIC';
  if (rank <= 1800) return 'LEGENDARY';
  if (rank <= 3500) return 'EPIC';
  if (rank <= 7000) return 'RARE';
  return 'COMMON';
}

function basePowerFor(rarity, seed) {
  const ranges = {
    COMMON: [50, 150],
    RARE: [150, 400],
    EPIC: [400, 900],
    LEGENDARY: [900, 1800],
    MYTHIC: [1800, 3500],
    DIVINE: [3500, 6000],
    SECRET: [6000, 10000]
  };

  const [min, max] = ranges[rarity] || ranges.COMMON;
  return min + ((seed * 97) % Math.max(1, max - min));
}

function elementFor(name = '', anime = '') {
  const text = normalize(`${name} ${anime}`);

  if (/(sukuna|makima|lelouch|toji|ainz|demon|devil|curse|akuma)/.test(text)) return 'Dark';
  if (/(sung jin|shadow|kage|igris|beru)/.test(text)) return 'Shadow';
  if (/(gojo|rimuru|gilgamesh|void|space|time)/.test(text)) return 'Void';
  if (/(saber|goku|naruto|luffy|hero|saint|angel|light)/.test(text)) return 'Light';
  if (/(ace|rengoku|natsu|fire|flame|inferno)/.test(text)) return 'Fire';
  if (/(killua|zenitsu|lightning|thunder|electric)/.test(text)) return 'Lightning';
  if (/(ichigo|rukia|bleach|soul|spirit)/.test(text)) return 'Soul';
  if (/(ice|frost|snow)/.test(text)) return 'Ice';

  return 'Neutral';
}

async function fetchJson(url, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'VoidRoll MAL Importer/1.0'
      }
    });

    if (res.status === 429) {
      const wait = 2500 * attempt;
      console.log(`Rate limited. Waiting ${wait}ms...`);
      await sleep(wait);
      continue;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    return res.json();
  }

  throw new Error(`Failed after ${retries} retries: ${url}`);
}

async function getAnimeName(characterMalId) {
  try {
    const data = await fetchJson(`https://api.jikan.moe/v4/characters/${characterMalId}/anime`);
    const anime = data?.data?.[0]?.anime;
    return cleanText(anime?.title_english || anime?.title || 'MyAnimeList');
  } catch {
    return 'MyAnimeList';
  }
}

async function importCharacters({ maxPages = 0, delayMs = 900 } = {}) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let page = 1;

  while (true) {
    if (maxPages > 0 && page > maxPages) break;

    console.log(`Fetching MAL characters page ${page}...`);
    const url = `https://api.jikan.moe/v4/top/characters?page=${page}`;
    const data = await fetchJson(url);
    const rows = data?.data || [];

    if (!rows.length) break;

    for (const row of rows) {
      const malId = row.mal_id;
      const name = cleanText(row.name);
      if (!malId || !name) {
        skipped++;
        continue;
      }

      const anime = await getAnimeName(malId);
      await sleep(delayMs);

      const rank = Number(row.favorites || 0);
      const rarity = pickRarity(imported + updated + skipped + 1);
      const power = basePowerFor(rarity, malId);
      const imageUrl = row?.images?.jpg?.image_url || row?.images?.webp?.image_url || null;
      const id = `mal_${malId}`;

      const existing = await prisma.character.findUnique({
        where: { id }
      }).catch(() => null);

      const payload = {
        name,
        anime,
        rarity,
        element: elementFor(name, anime),
        imageUrl,
        auraName: `${rarity} Aura`,
        auraColor: rarity === 'SECRET' ? '#111827'
          : rarity === 'DIVINE' ? '#f472b6'
          : rarity === 'MYTHIC' ? '#ef4444'
          : rarity === 'LEGENDARY' ? '#f59e0b'
          : rarity === 'EPIC' ? '#a855f7'
          : rarity === 'RARE' ? '#3b82f6'
          : '#9ca3af',
        auraSecondary: '#ffffff',
        auraIntensity: rarity === 'SECRET' ? 1.8 : rarity === 'DIVINE' ? 1.5 : 1.0,
        basePower: power,
        baseFarm: Math.max(1, Math.floor(power / 8)),
        baseLuck: Math.max(1, Math.floor(power / 20)),
        limited: rarity === 'SECRET',
        banner: null,
        active: true
      };

      if (existing) {
        await prisma.character.update({
          where: { id },
          data: payload
        });
        updated++;
      } else {
        await prisma.character.create({
          data: {
            id,
            ...payload
          }
        });
        imported++;
      }

      console.log(`${existing ? 'Updated' : 'Imported'} ${name} • ${anime} • ${rarity} • ${power}`);
    }

    const hasNext = data?.pagination?.has_next_page;
    if (!hasNext) break;

    page++;
    await sleep(delayMs);
  }

  const total = await prisma.character.count({ where: { active: true } });

  console.log('\nMAL import finished.');
  console.log(`Imported: ${imported}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Active characters now: ${total}`);
}

const maxPagesArg = Number(process.argv.find(x => x.startsWith('--pages='))?.split('=')[1] || 0);
const delayArg = Number(process.argv.find(x => x.startsWith('--delay='))?.split('=')[1] || 900);

importCharacters({
  maxPages: maxPagesArg,
  delayMs: delayArg
})
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
