// VoidRoll Reborn - Phase 19 DB Adapter
// Connects Prisma data to commandRouter.
// IMPORTANT: If your owned card model is not "card", edit CARD_MODEL_NAME below.
// Common names: card, userCard, ownedCard

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CARD_MODEL_NAME = process.env.VOIDROLL_CARD_MODEL || 'card';

function getModel(name) {
  return prisma[name] || null;
}

function getCardModel() {
  return getModel(CARD_MODEL_NAME) || prisma.card || prisma.userCard || prisma.ownedCard || null;
}

async function ensureUser(discordUser) {
  const discordId = String(discordUser?.id || discordUser || '');
  if (!discordId) throw new Error('ensureUser requires discord user id');

  const username = discordUser?.username || discordUser?.globalName || 'Player';

  // Assumes User has discordId or id. Tries discordId first, then id.
  try {
    return await prisma.user.upsert({
      where: { discordId },
      update: { username },
      create: {
        discordId,
        username,
        gold: 0,
        tokens: 0,
        essence: 0,
        voidCrystals: 0,
        soulFragments: 0,
        pvpRating: 1000,
        chapter: 1,
        stage: 1
      }
    });
  } catch (err) {
    // Fallback for schemas where User.id is Discord ID
    return await prisma.user.upsert({
      where: { id: discordId },
      update: {},
      create: {
        id: discordId,
        username,
        gold: 0,
        tokens: 0,
        essence: 0,
        voidCrystals: 0,
        soulFragments: 0,
        pvpRating: 1000,
        chapter: 1,
        stage: 1
      }
    });
  }
}

async function getAllCharacters() {
  if (!prisma.character) return [];
  return prisma.character.findMany();
}

async function getUserCards(userId) {
  const cardModel = getCardModel();
  if (!cardModel) return [];

  const includeCharacter = { character: true };

  try {
    return await cardModel.findMany({
      where: { userId: String(userId) },
      include: includeCharacter,
      orderBy: [{ power: 'desc' }]
    });
  } catch (_) {
    try {
      return await cardModel.findMany({
        where: { ownerId: String(userId) },
        include: includeCharacter,
        orderBy: [{ power: 'desc' }]
      });
    } catch (err) {
      return await cardModel.findMany({
        where: { userId: String(userId) }
      });
    }
  }
}

function cardsToMap(cards = []) {
  const map = {};
  for (const card of cards) map[String(card.id)] = card;
  return map;
}

async function getServerCards(guildId = null) {
  const cardModel = getCardModel();
  if (!cardModel) return [];
  try {
    return await cardModel.findMany({
      take: 500,
      include: { character: true },
      orderBy: [{ power: 'desc' }]
    });
  } catch (_) {
    return [];
  }
}

async function getOrCreateFormations(userId, type = 'story') {
  const existing = await prisma.formation.findMany({
    where: { userId: String(userId), type },
    include: { slots: true },
    orderBy: { index: 'asc' }
  });

  if (existing.length >= 6) return normalizePrismaFormations(existing);

  for (let i = existing.length + 1; i <= 6; i++) {
    await prisma.formation.create({
      data: {
        userId: String(userId),
        type,
        index: i,
        leaderSlot: 1,
        slots: {
          create: Array.from({ length: 6 }, (_, slotIndex) => ({
            slot: slotIndex + 1,
            cardId: null
          }))
        }
      }
    });
  }

  const rows = await prisma.formation.findMany({
    where: { userId: String(userId), type },
    include: { slots: true },
    orderBy: { index: 'asc' }
  });

  return normalizePrismaFormations(rows);
}

function normalizePrismaFormations(rows = []) {
  return rows.map(row => ({
    id: row.id,
    index: row.index,
    leaderSlot: row.leaderSlot || 1,
    slots: [...(row.slots || [])]
      .sort((a, b) => a.slot - b.slot)
      .map(slot => ({
        id: slot.id,
        slot: slot.slot,
        cardId: slot.cardId
      }))
  }));
}

async function saveFormationSlot(userId, type = 'story', teamIndex = 1, slotIndex = 1, cardId = null) {
  const formations = await prisma.formation.findMany({
    where: { userId: String(userId), type, index: Number(teamIndex) },
    include: { slots: true }
  });

  let formation = formations[0];

  if (!formation) {
    formation = await prisma.formation.create({
      data: {
        userId: String(userId),
        type,
        index: Number(teamIndex),
        leaderSlot: 1,
        slots: {
          create: Array.from({ length: 6 }, (_, i) => ({
            slot: i + 1,
            cardId: null
          }))
        }
      },
      include: { slots: true }
    });
  }

  return prisma.formationSlot.upsert({
    where: {
      formationId_slot: {
        formationId: formation.id,
        slot: Number(slotIndex)
      }
    },
    update: { cardId: cardId ? String(cardId) : null },
    create: {
      formationId: formation.id,
      slot: Number(slotIndex),
      cardId: cardId ? String(cardId) : null
    }
  });
}

async function setFormationLeader(userId, type = 'story', teamIndex = 1, leaderSlot = 1) {
  const formation = await prisma.formation.findFirst({
    where: { userId: String(userId), type, index: Number(teamIndex) }
  });
  if (!formation) return null;
  return prisma.formation.update({
    where: { id: formation.id },
    data: { leaderSlot: Number(leaderSlot) }
  });
}

async function getPity(userId, bannerId = 'normal') {
  return prisma.pity.upsert({
    where: {
      userId_bannerId: {
        userId: String(userId),
        bannerId: String(bannerId)
      }
    },
    update: {},
    create: {
      userId: String(userId),
      bannerId: String(bannerId),
      secret: 0,
      voidborn: 0,
      featuredGuaranteeNext: false
    }
  });
}

async function savePity(userId, bannerId = 'normal', pity = {}) {
  return prisma.pity.upsert({
    where: {
      userId_bannerId: {
        userId: String(userId),
        bannerId: String(bannerId)
      }
    },
    update: {
      secret: Number(pity.secret || 0),
      voidborn: Number(pity.voidborn || 0),
      featuredGuaranteeNext: Boolean(pity.featuredGuaranteeNext)
    },
    create: {
      userId: String(userId),
      bannerId: String(bannerId),
      secret: Number(pity.secret || 0),
      voidborn: Number(pity.voidborn || 0),
      featuredGuaranteeNext: Boolean(pity.featuredGuaranteeNext)
    }
  });
}

async function getActiveDungeon(userId) {
  const row = await prisma.dungeonRun.findFirst({
    where: { userId: String(userId), completed: false, abandoned: false },
    orderBy: { createdAt: 'desc' }
  });

  if (!row) return null;

  return {
    ...row,
    rooms: safeJson(row.roomsJson, []),
    rewardMultiplier: Number(row.rewardMultiplier || 1)
  };
}

async function saveDungeonRun(run = {}) {
  const data = {
    userId: String(run.userId),
    type: String(run.type || 'normal'),
    currentRoom: Number(run.currentRoom || 1),
    requiredFormations: Number(run.requiredFormations || 1),
    rewardMultiplier: Number(run.rewardMultiplier || 1),
    roomsJson: JSON.stringify(run.rooms || []),
    completed: Boolean(run.completed),
    abandoned: Boolean(run.abandoned)
  };

  if (run.id && String(run.id).startsWith('cl')) {
    return prisma.dungeonRun.update({ where: { id: run.id }, data });
  }

  return prisma.dungeonRun.create({ data });
}

async function getActiveRaidBoss(serverId) {
  const row = await prisma.raidBoss.findFirst({
    where: { serverId: String(serverId), defeated: false },
    include: { damageLogs: true },
    orderBy: { createdAt: 'desc' }
  });

  if (!row) return null;

  return {
    ...row,
    maxHp: Number(row.maxHp),
    currentHp: Number(row.currentHp),
    basePower: Number(row.basePower),
    damageLog: (row.damageLogs || []).map(x => ({
      userId: x.userId,
      username: x.username,
      damage: Number(x.damage),
      at: x.createdAt
    }))
  };
}

async function saveRaidBoss(boss = {}) {
  const data = {
    serverId: String(boss.serverId),
    templateId: String(boss.templateId),
    type: String(boss.type),
    name: String(boss.name),
    level: Number(boss.level || 1),
    element: String(boss.element || 'VOID'),
    role: String(boss.role || 'TANK'),
    rarity: String(boss.rarity || 'SECRET'),
    maxHp: BigInt(Math.floor(Number(boss.maxHp || 0))),
    currentHp: BigInt(Math.floor(Number(boss.currentHp || 0))),
    basePower: BigInt(Math.floor(Number(boss.basePower || 0))),
    phase: Number(boss.phase || 1),
    defeated: Boolean(boss.defeated),
    lastHitUserId: boss.lastHitUserId || null,
    startsAt: boss.startsAt ? new Date(boss.startsAt) : new Date(),
    endsAt: boss.endsAt ? new Date(boss.endsAt) : new Date(Date.now() + 24 * 60 * 60 * 1000)
  };

  if (boss.id && String(boss.id).startsWith('cl')) {
    return prisma.raidBoss.update({ where: { id: boss.id }, data });
  }

  return prisma.raidBoss.create({ data });
}

async function addRaidDamage(raidBossId, userId, username, damage) {
  return prisma.raidDamageLog.create({
    data: {
      raidBossId: String(raidBossId),
      userId: String(userId),
      username: username || 'Player',
      damage: BigInt(Math.floor(Number(damage || 0)))
    }
  });
}

async function addResource(userId, name, amount) {
  return prisma.userResource.upsert({
    where: {
      userId_name: {
        userId: String(userId),
        name: String(name)
      }
    },
    update: {
      amount: { increment: BigInt(Math.floor(Number(amount || 0))) }
    },
    create: {
      userId: String(userId),
      name: String(name),
      amount: BigInt(Math.floor(Number(amount || 0)))
    }
  });
}

async function getResources(userId) {
  const rows = await prisma.userResource.findMany({
    where: { userId: String(userId) }
  });
  const out = {};
  for (const row of rows) out[row.name] = Number(row.amount);
  return out;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

async function buildCommandContext(interaction) {
  const user = await ensureUser(interaction.user);
  const cards = await getUserCards(user.id || user.discordId || interaction.user.id);
  const allCharacters = await getAllCharacters();
  const storyFormations = await getOrCreateFormations(user.id || interaction.user.id, 'story');
  const pvpDefenseFormations = await getOrCreateFormations(user.id || interaction.user.id, 'pvp_defense');
  const pity = await getPity(user.id || interaction.user.id, 'active');
  const activeDungeon = await getActiveDungeon(user.id || interaction.user.id);
  const activeRaidBoss = await getActiveRaidBoss(interaction.guildId || 'global');
  const serverCards = await getServerCards(interaction.guildId);
  const resources = await getResources(user.id || interaction.user.id);

  return {
    user: { ...user, ...resources },
    cards,
    allCharacters,
    formations: storyFormations,
    pvpDefenseFormations,
    cardsById: cardsToMap(cards),
    pity,
    activeDungeon,
    activeRaidBoss,
    serverCards,
    players: [],
    activeBanner: {
      id: 'corrupted-control',
      type: 'featured',
      title: 'Chains of the Void',
      featuredCharacter: 'Corrupted Makima',
      featuredRarity: 'SECRET',
      anime: 'Chainsaw Man',
      element: 'VOID',
      role: 'CONTROL',
      quote: 'You are mine now.'
    }
  };
}

module.exports = {
  prisma,
  CARD_MODEL_NAME,
  getModel,
  getCardModel,
  ensureUser,
  getAllCharacters,
  getUserCards,
  cardsToMap,
  getServerCards,
  getOrCreateFormations,
  normalizePrismaFormations,
  saveFormationSlot,
  setFormationLeader,
  getPity,
  savePity,
  getActiveDungeon,
  saveDungeonRun,
  getActiveRaidBoss,
  saveRaidBoss,
  addRaidDamage,
  addResource,
  getResources,
  safeJson,
  buildCommandContext
};
