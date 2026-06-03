// VoidRoll Reborn — FULL LAUNCH — Roll Bank System
// Free Rolls refill to 30 every hour and do NOT stack above 30.
// Gameplay-earned Normal Rolls become Banked Normal Rolls and stack normally.
// Standard Banner spends Free first, then Banked.

const FREE_MAX = 30;
const REFILL_MS = 60 * 60 * 1000;

function nowMs(){ return Date.now(); }

function safeMeta(user){
  const m = user?.meta;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
  return { ...m };
}

function normalizeRollMeta(user){
  const meta = safeMeta(user);
  const r = meta.rollBank && typeof meta.rollBank === 'object' ? { ...meta.rollBank } : {};
  const legacyRolls = Number(user?.rolls || 0);

  if (!r.initialized) {
    r.initialized = true;
    r.free = FREE_MAX;
    r.bankedNormal = Math.max(0, legacyRolls);
    r.premium = Number(r.premium || 0);
    r.event = Number(r.event || 0);
    r.corruptedTickets = Number(r.corruptedTickets || 0);
    r.legacyRollsSeen = legacyRolls;
    r.lastRefillAt = nowMs();
  }

  const seen = Number(r.legacyRollsSeen || 0);
  if (legacyRolls > seen) {
    r.bankedNormal = Number(r.bankedNormal || 0) + (legacyRolls - seen);
    r.legacyRollsSeen = legacyRolls;
  } else if (legacyRolls < seen) {
    r.legacyRollsSeen = legacyRolls;
  }

  r.free = Math.max(0, Math.min(FREE_MAX, Number(r.free ?? FREE_MAX)));
  r.bankedNormal = Math.max(0, Number(r.bankedNormal || 0));
  r.premium = Math.max(0, Number(r.premium || 0));
  r.event = Math.max(0, Number(r.event || 0));
  r.corruptedTickets = Math.max(0, Number(r.corruptedTickets || 0));
  r.lastRefillAt = Number(r.lastRefillAt || nowMs());

  return { meta, rollBank: r };
}

function refill(rollBank){
  const now = nowMs();
  if (now - Number(rollBank.lastRefillAt || 0) >= REFILL_MS) {
    rollBank.free = FREE_MAX;
    rollBank.lastRefillAt = now;
  }
  return rollBank;
}

async function getRollState(prisma, userId){
  const user = await prisma.user.findUnique({ where:{ id:String(userId) } });
  if (!user) throw new Error('User not found');
  const { meta, rollBank } = normalizeRollMeta(user);
  refill(rollBank);
  meta.rollBank = rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta } }).catch(()=>{});
  return {
    free:Number(rollBank.free || 0),
    bankedNormal:Number(rollBank.bankedNormal || 0),
    totalNormal:Number(rollBank.free || 0) + Number(rollBank.bankedNormal || 0),
    premium:Number(rollBank.premium || 0),
    event:Number(rollBank.event || 0),
    corruptedTickets:Number(rollBank.corruptedTickets || 0),
    nextRefillAt:Number(rollBank.lastRefillAt || nowMs()) + REFILL_MS,
    meta,
    rollBank
  };
}

async function spendNormal(prisma, userId, amount){
  amount = Math.max(1, Number(amount || 1));
  const state = await getRollState(prisma, userId);
  if (state.totalNormal < amount) return { ok:false, state, need:amount };

  let remaining = amount;
  const fromFree = Math.min(state.free, remaining);
  state.rollBank.free -= fromFree;
  remaining -= fromFree;

  const fromBanked = Math.min(state.bankedNormal, remaining);
  state.rollBank.bankedNormal -= fromBanked;
  remaining -= fromBanked;

  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  const after = await getRollState(prisma, userId);
  return { ok:true, spent:amount, fromFree, fromBanked, before:state, after };
}

async function spendPremium(prisma, userId, amount){
  amount = Math.max(1, Number(amount || 1));
  const state = await getRollState(prisma, userId);
  if (state.premium < amount) return { ok:false, state, need:amount };
  state.rollBank.premium -= amount;
  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  return { ok:true, spent:amount, after:await getRollState(prisma, userId) };
}

async function spendEvent(prisma, userId, amount){
  amount = Math.max(1, Number(amount || 1));
  const state = await getRollState(prisma, userId);
  if (state.event < amount) return { ok:false, state, need:amount };
  state.rollBank.event -= amount;
  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  return { ok:true, spent:amount, after:await getRollState(prisma, userId) };
}

async function addBankedNormal(prisma, userId, amount){
  amount = Math.max(0, Number(amount || 0));
  const state = await getRollState(prisma, userId);
  state.rollBank.bankedNormal += amount;
  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  return getRollState(prisma, userId);
}

async function addPremium(prisma, userId, amount){
  amount = Math.max(0, Number(amount || 0));
  const state = await getRollState(prisma, userId);
  state.rollBank.premium += amount;
  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  return getRollState(prisma, userId);
}

async function addEvent(prisma, userId, amount){
  amount = Math.max(0, Number(amount || 0));
  const state = await getRollState(prisma, userId);
  state.rollBank.event += amount;
  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  return getRollState(prisma, userId);
}

async function addCorruptedTicket(prisma, userId, amount){
  amount = Math.max(0, Number(amount || 0));
  const state = await getRollState(prisma, userId);
  state.rollBank.corruptedTickets += amount;
  state.meta.rollBank = state.rollBank;
  await prisma.user.update({ where:{ id:String(userId) }, data:{ meta:state.meta } });
  return getRollState(prisma, userId);
}

function walletLines(state){
  return [
    `🎲 **Rolls**`,
    `Free Rolls: **${state.free}/${FREE_MAX}**`,
    `Banked Normal Rolls: **${state.bankedNormal}**`,
    `Total Normal Rolls: **${state.totalNormal}**`,
    ``,
    `💎 Premium Rolls: **${state.premium}**`,
    `🌌 Event Rolls: **${state.event}**`,
    `👑 Corrupted Tickets: **${state.corruptedTickets}**`,
    ``,
    `Next Free Roll Refill: <t:${Math.floor(state.nextRefillAt/1000)}:R>`
  ].join('\n');
}

// Standard banner: highest DIVINE, no Secret/Corrupted.
function pickStandardRarity(){
  const x = Math.random() * 100;
  if (x < 0.10) return 'DIVINE';
  if (x < 0.85) return 'MYTHIC';
  if (x < 2.25) return 'LEGENDARY';
  if (x < 8.25) return 'EPIC';
  if (x < 30.25) return 'RARE';
  return 'COMMON';
}

// Premium banner: still no event Secret. Kept safer for launch.
function pickPremiumRarity(){
  const x = Math.random() * 100;
  if (x < 0.35) return 'DIVINE';
  if (x < 2.25) return 'MYTHIC';
  if (x < 7.50) return 'LEGENDARY';
  if (x < 22.50) return 'EPIC';
  if (x < 55.00) return 'RARE';
  return 'COMMON';
}

function commandDefinitions(){
  return [
    { name:'rolls', description:'Show your Free, Banked, Premium, Event rolls and refill timer', type:1 }
  ];
}

async function handleRollsCommand(i, prisma){
  const state = await getRollState(prisma, i.user.id);
  return i.reply({ content: walletLines(state), ephemeral:false });
}

module.exports = {
  FREE_MAX,
  REFILL_MS,
  getRollState,
  spendNormal,
  spendPremium,
  spendEvent,
  addBankedNormal,
  addPremium,
  addEvent,
  addCorruptedTicket,
  walletLines,
  pickStandardRarity,
  pickPremiumRarity,
  commandDefinitions,
  handleRollsCommand
};
