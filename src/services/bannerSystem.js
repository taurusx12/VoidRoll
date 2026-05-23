const { nanoid } = require('nanoid');

const BANNER_MULTI_COST = 1000;
const BANNER_PITY_MULTIS = 50;
const ACTIVE_BANNER_COUNT = 4;
const ROTATION_HOURS = 72;

const BANNERS = [
  { id: 'gojo_limit', name: 'Gojo Limit', featured: 'satoru gojo', featuredDisplay: 'Satoru Gojo', pool: ['gojo', 'yuji', 'megumi', 'nobara', 'nanami', 'maki', 'inumaki', 'panda'] },
  { id: 'lelouch_requiem', name: 'Lelouch Requiem', featured: 'lelouch', featuredDisplay: 'Lelouch Lamperouge', pool: ['lelouch', 'suzaku', 'cc', 'kallen', 'nunnally', 'schneizel'] },
  { id: 'saber_oath', name: 'Saber Oath', featured: 'saber', featuredDisplay: 'Saber', pool: ['saber', 'archer', 'emiya', 'rin', 'lancer', 'rider'] },
  { id: 'shadow_monarch', name: 'Shadow Monarch', featured: 'sung jin', featuredDisplay: 'Sung Jin-Woo', pool: ['sung jin', 'igris', 'beru', 'cha hae', 'thomas andre'] },

  { id: 'toji_hunt', name: 'Toji Hunt', featured: 'toji', featuredDisplay: 'Toji Fushiguro', pool: ['toji', 'maki', 'megumi', 'nanami', 'naobito', 'panda', 'inumaki', 'mai'] },
  { id: 'overlord_throne', name: 'Overlord Throne', featured: 'ainz', featuredDisplay: 'Ainz Ooal Gown', pool: ['ainz', 'albedo', 'demiurge', 'shalltear', 'cocytus'] },
  { id: 'hunter_oath', name: 'Hunter Oath', featured: 'kurapika', featuredDisplay: 'Kurapika', pool: ['kurapika', 'gon', 'killua', 'leorio', 'hisoka'] },
  { id: 'curse_king', name: 'King of Curses', featured: 'sukuna', featuredDisplay: 'Ryomen Sukuna', pool: ['sukuna', 'uraume', 'kenjaku', 'mahito', 'jogo', 'hanami', 'dagon'] },

  { id: 'uchiha_legend', name: 'Uchiha Legend', featured: 'itachi', featuredDisplay: 'Itachi Uchiha', pool: ['itachi', 'sasuke', 'madara', 'obito', 'shisui'] },
  { id: 'strawhat_core', name: 'Straw Hat Core', featured: 'luffy', featuredDisplay: 'Monkey D. Luffy', pool: ['luffy', 'zoro', 'sanji', 'nami', 'usopp', 'robin', 'franky', 'brook', 'jinbe'] },
  { id: 'aizen_hogyoku', name: 'Aizen Hogyoku', featured: 'aizen', featuredDisplay: 'Sosuke Aizen', pool: ['aizen', 'gin', 'tosen', 'ulquiorra', 'grimmjow'] },
  { id: 'makima_control', name: 'Makima Control', featured: 'makima', featuredDisplay: 'Makima', pool: ['makima', 'denji', 'power', 'aki', 'kobeni'] },

  { id: 'madara_tentails', name: 'Madara Ten Tails', featured: 'madara', featuredDisplay: 'Madara Uchiha', pool: ['madara', 'obito', 'pain', 'itachi', 'kisame'] },
  { id: 'goku_ultra', name: 'Ultra Instinct', featured: 'goku', featuredDisplay: 'Goku', pool: ['goku', 'vegeta', 'gohan', 'piccolo', 'frieza', 'broly'] },
  { id: 'gilgamesh_treasury', name: 'Gilgamesh Treasury', featured: 'gilgamesh', featuredDisplay: 'Gilgamesh', pool: ['gilgamesh', 'saber', 'archer', 'enkidu'] },
  { id: 'rimuru_demonlord', name: 'Rimuru Demon Lord', featured: 'rimuru', featuredDisplay: 'Rimuru Tempest', pool: ['rimuru', 'benimaru', 'shion', 'diablo', 'veldora'] }
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
  for (let x = 0; x < ACTIVE_BANNER_COUNT; x++) {
    rows.push({ ...BANNERS[(start + x) % BANNERS.length], endsAt });
  }
  return rows;
}

function findBanner(id) {
  const banners = activeBanners();
  return banners.find(b => b.id === id) || null;
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
  const row = await prisma.cooldown.findUnique({
    where: { userId_key: { userId, key } }
  }).catch(() => null);

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
  const updated = await prisma.character.update({
    where: { id: character.id },
    data: { globalPrint: { increment: 1 } }
  });

  const shiny = Math.random() < 0.015;
  const traits = ['Berserker', 'Genius', 'Guardian', 'Bloodlust', 'Swift', 'Divine Body', 'Shadowborn', 'Cursed Soul'];
  const trait = Math.random() < 0.10 ? traits[Math.floor(Math.random() * traits.length)] : null;
  const power = Math.round((updated.basePower || 100) * (shiny ? 1.35 : 1) + Math.random() * 80);

  const card = await prisma.userCard.create({
    data: {
      id: nanoid(12),
      userId,
      characterId: updated.id,
      serial: updated.globalPrint,
      power,
      shiny,
      trait
    }
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
  if ((user.tokens || 0) < BANNER_MULTI_COST) {
    throw new Error(`You need ${BANNER_MULTI_COST} tokens for this 10-pull.`);
  }

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

    const plan = ['RARE', 'RARE', 'RARE', 'RARE', 'EPIC', 'EPIC', 'EPIC', 'MYTHIC', 'DIVINE'];
    for (const rarity of plan) resultsCharacters.push(chooseFromRarity(bannerPool, rarity, nonCommon));
  } else {
    pity += 1;
    const plan = ['RARE', 'RARE', 'RARE', 'RARE', 'RARE', 'EPIC', 'EPIC', 'EPIC', 'MYTHIC', 'DIVINE'];
    for (const rarity of plan) resultsCharacters.push(chooseFromRarity(bannerPool, rarity, nonCommon));
  }

  await prisma.user.update({
    where: { id: userId },
    data: { tokens: { decrement: BANNER_MULTI_COST } }
  });

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
