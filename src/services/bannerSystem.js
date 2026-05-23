const { nanoid } = require('nanoid');

const BANNER_MULTI_COST = 1000;
const BANNER_PITY_MULTIS = 50;
const ACTIVE_BANNER_COUNT = 4;
const ROTATION_HOURS = 72;

// Important rule:
// Banner featured can be SECRET, but pool must NOT be only same anime.
// No COMMON in banners.
const BANNERS = [
  { id: 'madara_war', name: 'Madara War Banner', featured: 'madara', featuredDisplay: 'Madara Uchiha',
    pool: ['madara', 'saber', 'kurapika', 'law', 'denji', 'sanji', 'rengoku', 'nobara', 'rock lee', 'franky'] },
  { id: 'lelouch_requiem', name: 'Lelouch Requiem Banner', featured: 'lelouch', featuredDisplay: 'Lelouch Lamperouge',
    pool: ['lelouch', 'ainz', 'killua', 'toji', 'ace', 'megumi', 'todoroki', 'shinobu', 'neji', 'brook'] },
  { id: 'shadow_monarch', name: 'Shadow Monarch Banner', featured: 'sung jin', featuredDisplay: 'Sung Jin-Woo',
    pool: ['sung jin', 'gon', 'kakashi', 'makima', 'zoro', 'yuji', 'bakugo', 'giyu', 'hinata', 'nami'] },
  { id: 'gojo_limit', name: 'Gojo Limit Banner', featured: 'satoru gojo', featuredDisplay: 'Satoru Gojo',
    pool: ['gojo', 'kurapika', 'ainz', 'hisoka', 'power', 'denji', 'megumi', 'zenitsu', 'piccolo', 'robin'] },

  { id: 'saber_oath', name: 'Saber Oath Banner', featured: 'saber', featuredDisplay: 'Saber (SECRET)', pool: ['saber', 'kurapika', 'ainz', 'killua', 'toji', 'denji', 'zoro', 'rengoku', 'nobara', 'rock lee'] },
  { id: 'overlord_throne', name: 'Overlord Throne Banner', featured: 'ainz', featuredDisplay: 'Ainz Ooal Gown',
    pool: ['ainz', 'saber', 'kurapika', 'kakashi', 'sanji', 'denji', 'megumi', 'inosuke', 'rock lee', 'usopp'] },
  { id: 'kurapika_chain', name: 'Kurapika Chain Banner', featured: 'kurapika', featuredDisplay: 'Kurapika',
    pool: ['kurapika', 'killua', 'gon', 'toji', 'ace', 'yuji', 'todoroki', 'giyu', 'neji', 'franky'] },
  { id: 'toji_hunt', name: 'Toji Hunt Banner', featured: 'toji', featuredDisplay: 'Toji Fushiguro',
    pool: ['toji', 'kurapika', 'saber', 'law', 'megumi', 'denji', 'rengoku', 'shinobu', 'panda', 'brook'] },

  { id: 'aizen_hogyoku', name: 'Aizen Hogyoku Banner', featured: 'aizen', featuredDisplay: 'Sosuke Aizen',
    pool: ['aizen', 'ainz', 'gon', 'toji', 'zoro', 'power', 'bakugo', 'zenitsu', 'hinata', 'nami'] },
  { id: 'luffy_gear5', name: 'Gear 5 Luffy Banner', featured: 'luffy', featuredDisplay: 'Monkey D. Luffy',
    pool: ['luffy', 'saber', 'killua', 'kakashi', 'ace', 'megumi', 'todoroki', 'inosuke', 'android 17', 'robin'] },
  { id: 'makima_control', name: 'Makima Control Banner', featured: 'makima', featuredDisplay: 'Makima',
    pool: ['makima', 'kurapika', 'ainz', 'hisoka', 'denji', 'yuji', 'nobara', 'giyu', 'piccolo', 'franky'] },
  { id: 'gilgamesh_treasury', name: 'Gilgamesh Treasury Banner', featured: 'gilgamesh', featuredDisplay: 'Gilgamesh',
    pool: ['gilgamesh', 'saber', 'gon', 'law', 'sanji', 'power', 'bakugo', 'shinobu', 'rock lee', 'chopper'] }
];

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

function rotationState(now = Date.now()) {
  const start = new Date(process.env.BANNER_ROTATION_START || '2026-01-01T00:00:00.000Z').getTime();
  const rotationMs = ROTATION_HOURS * 60 * 60 * 1000;
  const cycle = Math.floor(Math.max(0, now - start) / rotationMs);
  const endsAt = new Date(start + (cycle + 1) * rotationMs);
  return { cycle, endsAt };
}

function activeBanners(now = Date.now()) {
  const { cycle, endsAt } = rotationState(now);
  const start = (cycle * ACTIVE_BANNER_COUNT) % BANNERS.length;
  const rows = [];
  for (let x = 0; x < ACTIVE_BANNER_COUNT; x++) rows.push({ ...BANNERS[(start + x) % BANNERS.length], endsAt });
  return rows;
}

function findBanner(id) {
  return activeBanners().find(b => b.id === id) || null;
}

function matchesBanner(character, banner) {
  const text = `${normalize(character.name)} ${normalize(character.anime)}`;
  return banner.pool.some(k => text.includes(normalize(k)));
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function getPity(prisma, userId, bannerId) {
  const key = `banner:${bannerId}:multiPity`;
  const row = await prisma.cooldown.findUnique({ where: { userId_key: { userId, key } } }).catch(() => null);
  return Number(row?.expiresAt?.getTime?.() || 0);
}

async function setPity(prisma, userId, bannerId, pity) {
  const key = `banner:${bannerId}:multiPity`;
  await prisma.cooldown.upsert({
    where: { userId_key: { userId, key } },
    update: { expiresAt: new Date(Math.max(0, pity)) },
    create: { userId, key, expiresAt: new Date(Math.max(0, pity)) }
  }).catch(() => {});
}

async function createCard(prisma, userId, character) {
  const updated = await prisma.character.update({ where: { id: character.id }, data: { globalPrint: { increment: 1 } } });
  const shiny = Math.random() < 0.015;
  const traits = ['Berserker', 'Genius', 'Guardian', 'Bloodlust', 'Swift', 'Divine Body', 'Shadowborn', 'Cursed Soul'];
  const trait = Math.random() < 0.10 ? traits[Math.floor(Math.random() * traits.length)] : null;
  const power = Math.round((updated.basePower || 100) * (shiny ? 1.35 : 1) + Math.random() * 80);
  const card = await prisma.userCard.create({
    data: { id: nanoid(12), userId, characterId: updated.id, serial: updated.globalPrint, power, shiny, trait }
  });
  return { card, character: updated };
}

function chooseFromRarity(pool, rarity, fallback) {
  const rows = pool.filter(c => c.rarity === rarity);
  return pickRandom(rows.length ? rows : fallback);
}

async function rollBanner(prisma, userId, bannerId) {
  const banner = findBanner(bannerId);
  if (!banner) throw new Error('Banner is not active. Use /banner to see active banners.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if ((user.tokens || 0) < BANNER_MULTI_COST) throw new Error(`You need ${BANNER_MULTI_COST} tokens for this 10-pull.`);

  const allChars = await prisma.character.findMany({ where: { active: true } });
  const nonCommon = allChars.filter(c => c.rarity !== 'COMMON');
  let bannerPool = allChars.filter(c => c.rarity !== 'COMMON' && matchesBanner(c, banner));
  if (!bannerPool.length) bannerPool = nonCommon;

  let pity = await getPity(prisma, userId, banner.id);
  const secretGuaranteed = (pity + 1) >= BANNER_PITY_MULTIS;

  const resultsCharacters = [];

  if (secretGuaranteed) {
    const featured = bannerPool.find(c => normalize(c.name).includes(normalize(banner.featured)));
    resultsCharacters.push(featured || pickRandom(bannerPool.filter(c => c.rarity === 'SECRET')) || pickRandom(nonCommon));
    pity = 0;
    for (const rarity of ['RARE', 'RARE', 'RARE', 'RARE', 'EPIC', 'EPIC', 'EPIC', 'MYTHIC', 'DIVINE']) {
      resultsCharacters.push(chooseFromRarity(bannerPool, rarity, nonCommon));
    }
  } else {
    pity += 1;
    for (const rarity of ['RARE', 'RARE', 'RARE', 'RARE', 'RARE', 'EPIC', 'EPIC', 'EPIC', 'MYTHIC', 'DIVINE']) {
      resultsCharacters.push(chooseFromRarity(bannerPool, rarity, nonCommon));
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { tokens: { decrement: BANNER_MULTI_COST } } });
  await setPity(prisma, userId, banner.id, pity);

  const results = [];
  for (const character of resultsCharacters.slice(0, 10)) {
    const made = await createCard(prisma, userId, character);
    results.push({ ...made, guaranteed: secretGuaranteed && results.length === 0 });
  }

  return { banner, results, pity, cost: BANNER_MULTI_COST, secretGuaranteed };
}

module.exports = {
  BANNER_MULTI_COST,
  BANNER_PITY_MULTIS,
  ACTIVE_BANNER_COUNT,
  ROTATION_HOURS,
  activeBanners,
  findBanner,
  getPity,
  rollBanner
};
