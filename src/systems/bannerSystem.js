
const BANNER_MULTI_COST = 1000;
const SECRET_PITY_MULTI = 50;
const ACTIVE_BANNERS = 4;
const ROTATION_HOURS = 72;

const BANNER_ROTATIONS = [
  [
    { id: 'gojo_limit', name: 'Gojo Limit Banner', featured: 'Satoru Gojo' },
    { id: 'lelouch_requiem', name: 'Lelouch Requiem Banner', featured: 'Lelouch Lamperouge' },
    { id: 'saber_oath', name: 'Saber Oath Banner', featured: 'Saber' },
    { id: 'shadow_monarch', name: 'Shadow Monarch Banner', featured: 'Sung Jin-Woo' }
  ],
  [
    { id: 'madara_ten_tails', name: 'Madara Ten Tails Banner', featured: 'Madara Uchiha' },
    { id: 'overlord_throne', name: 'Overlord Throne Banner', featured: 'Ainz Ooal Gown' },
    { id: 'yhwach_almighty', name: 'Yhwach Almighty Banner', featured: 'Yhwach' },
    { id: 'rimuru_demon_lord', name: 'Rimuru Demon Lord Banner', featured: 'Rimuru Tempest' }
  ],
  [
    { id: 'luffy_gear5', name: 'Gear 5 Luffy Banner', featured: 'Monkey D. Luffy' },
    { id: 'ui_goku', name: 'Ultra Instinct Goku Banner', featured: 'Goku' },
    { id: 'makima_control', name: 'Makima Control Banner', featured: 'Makima' },
    { id: 'gilgamesh_treasury', name: 'Gilgamesh Treasury Banner', featured: 'Gilgamesh' }
  ],
  [
    { id: 'toji_hunt', name: 'Toji Hunt Banner', featured: 'Toji Fushiguro' },
    { id: 'kurapika_chain', name: 'Kurapika Chain Banner', featured: 'Kurapika' },
    { id: 'killua_godspeed', name: 'Killua Godspeed Banner', featured: 'Killua' },
    { id: 'gon_jajanken', name: 'Gon Jajanken Banner', featured: 'Gon' }
  ]
];

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

function getCurrentBanners() {
  const start = new Date(process.env.BANNER_ROTATION_START || '2026-01-01T00:00:00.000Z').getTime();
  const now = Date.now();
  const rotationMs = ROTATION_HOURS * 60 * 60 * 1000;
  const cycle = Math.floor(Math.max(0, now - start) / rotationMs);
  const banners = BANNER_ROTATIONS[cycle % BANNER_ROTATIONS.length].slice(0, ACTIVE_BANNERS);
  const endsAt = new Date(start + (cycle + 1) * rotationMs);
  return banners.map(b => ({ ...b, endsAt }));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function getBannerPity(prisma, userId, bannerId) {
  const key = `banner_pity_${bannerId}`;
  const row = await prisma.cooldown.findUnique({
    where: { userId_key: { userId, key } }
  }).catch(() => null);
  return Number(row?.expiresAt?.getTime?.() || 0);
}

async function setBannerPity(prisma, userId, bannerId, pulls) {
  const key = `banner_pity_${bannerId}`;
  const fakeDate = new Date(Math.max(0, pulls));
  await prisma.cooldown.upsert({
    where: { userId_key: { userId, key } },
    update: { expiresAt: fakeDate },
    create: { userId, key, expiresAt: fakeDate }
  }).catch(() => {});
}

async function rollBannerMulti({ prisma, userId, bannerId, createCardForUser }) {
  const banners = getCurrentBanners();
  const banner = banners.find(b => b.id === bannerId);
  if (!banner) throw new Error('Banner not active.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if ((user.tokens || 0) < BANNER_MULTI_COST) {
    throw new Error(`You need ${BANNER_MULTI_COST} tokens.`);
  }

  let pity = await getBannerPity(prisma, userId, banner.id);
  const secretGuaranteed = (pity + 1) >= SECRET_PITY_MULTI;

  const chars = await prisma.character.findMany({
    where: { active: true }
  });

  const byRarity = (rarity) => chars.filter(c => c.rarity === rarity);
  const nonCommon = chars.filter(c => c.rarity !== 'COMMON');

  const featured = chars.find(c => normalize(c.name).includes(normalize(banner.featured)));

  const results = [];

  if (secretGuaranteed) {
    results.push(featured || pickRandom(byRarity('SECRET')) || pickRandom(nonCommon));
    pity = 0;
  } else {
    pity += 1;
    const plan = [
      ...Array(5).fill('RARE'),
      ...Array(3).fill('EPIC'),
      'MYTHIC',
      'DIVINE'
    ];

    for (const rarity of plan) {
      const pool = byRarity(rarity);
      results.push(pickRandom(pool.length ? pool : nonCommon));
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { tokens: { decrement: BANNER_MULTI_COST } }
  });

  await setBannerPity(prisma, userId, banner.id, pity);

  const cards = [];
  for (const character of results) {
    const created = await createCardForUser(userId, character);
    cards.push(created);
  }

  return { banner, cards, pity, secretGuaranteed };
}

module.exports = {
  BANNER_MULTI_COST,
  SECRET_PITY_MULTI,
  ACTIVE_BANNERS,
  ROTATION_HOURS,
  getCurrentBanners,
  rollBannerMulti
};
