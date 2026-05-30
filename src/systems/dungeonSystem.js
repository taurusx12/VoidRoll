// VoidRoll Reborn - Phase 14 Dungeon System
// Multi-room dungeon foundation using Battle Engine + Formations.
// No item rolls, no relic pulls, no aura pulls, no fusion, no stars.

const dungeonConfig = require('../config/dungeon_config.json');

let battleEngine = null;
let formationSystem = null;
try { battleEngine = require('./battleEngine'); } catch (_) { battleEngine = null; }
try { formationSystem = require('./formationSystem'); } catch (_) { formationSystem = null; }

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function seededRandom(seed) {
  let h = 2166136261 >>> 0;
  const str = String(seed || Date.now());
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function rand() {
    h += h << 13; h ^= h >>> 7;
    h += h << 3; h ^= h >>> 17;
    h += h << 5;
    return ((h >>> 0) / 4294967296);
  };
}

function normalizeDungeonType(type = 'normal') {
  const t = String(type || 'normal').toLowerCase();
  return dungeonConfig.dungeonTypes[t] ? t : 'normal';
}

function getDungeonInfo(type = 'normal') {
  return dungeonConfig.dungeonTypes[normalizeDungeonType(type)];
}

function pickWeightedRoom(rand = Math.random, allowSecret = true) {
  const entries = Object.entries(dungeonConfig.roomTypes)
    .filter(([key]) => key !== 'boss')
    .filter(([key]) => allowSecret || key !== 'secret');

  const total = entries.reduce((sum, [, data]) => sum + Number(data.weight || 0), 0);
  let roll = rand() * total;

  for (const [key, data] of entries) {
    roll -= Number(data.weight || 0);
    if (roll <= 0) return key;
  }
  return 'wave';
}

function generateDungeonRun({ type = 'normal', userId = 'user', seed = Date.now() } = {}) {
  const dungeonType = normalizeDungeonType(type);
  const info = getDungeonInfo(dungeonType);
  const rand = seededRandom(`${seed}:${userId}:${dungeonType}`);
  const rooms = [];

  for (let i = 1; i <= info.rooms; i++) {
    const isFinal = i === info.rooms;
    const roomType = isFinal ? 'boss' : pickWeightedRoom(rand, dungeonType === 'void' || dungeonType === 'abyss');
    rooms.push({
      index: i,
      type: roomType,
      cleared: false,
      pathModifier: 'balanced',
      rewardClaimed: false
    });
  }

  return {
    id: `dungeon-${userId}-${Date.now()}`,
    userId,
    type: dungeonType,
    currentRoom: 1,
    requiredFormations: info.requiredFormations,
    rooms,
    rewardMultiplier: 1,
    completed: false,
    abandoned: false,
    createdAt: new Date().toISOString()
  };
}

function getCurrentRoom(run = {}) {
  return (run.rooms || []).find(r => Number(r.index) === Number(run.currentRoom)) || null;
}

function choosePath(run = {}, path = 'balanced') {
  const selected = dungeonConfig.pathChoices[path] ? path : 'balanced';
  const modifier = dungeonConfig.pathChoices[selected];
  return {
    ...run,
    rewardMultiplier: Number(((run.rewardMultiplier || 1) * modifier.rewardMultiplier).toFixed(2)),
    currentPath: selected
  };
}

function randomRange(range = [0, 0], rand = Math.random) {
  const min = Number(range[0] || 0);
  const max = Number(range[1] || min);
  return Math.floor(min + rand() * (max - min + 1));
}

function generateReward(roomType = 'wave', multiplier = 1, seed = Date.now()) {
  const rand = seededRandom(`reward:${roomType}:${seed}`);
  const table = dungeonConfig.rewards[roomType] || dungeonConfig.rewards.wave;
  const reward = {};

  for (const [key, range] of Object.entries(table)) {
    if (Array.isArray(range)) {
      const value = Math.floor(randomRange(range, rand) * Number(multiplier || 1));
      if (value > 0) reward[key] = value;
    }
  }

  if (['elite', 'treasure', 'secret', 'boss'].includes(roomType)) {
    const materialPool = dungeonConfig.rewards.materials || [];
    if (materialPool.length) {
      const material = materialPool[Math.floor(rand() * materialPool.length)];
      reward.material = material;
      reward.materialAmount = roomType === 'boss' ? 3 : roomType === 'secret' ? 2 : 1;
    }
  }

  return reward;
}

function formatReward(reward = {}) {
  const labels = {
    gold: '🪙 Gold',
    tokens: '🎟️ Tokens',
    essence: '🔮 Essence',
    soulFragments: '🧩 Soul Fragments',
    voidCrystals: '💎 Void Crystals'
  };
  const lines = [];
  for (const [key, value] of Object.entries(reward)) {
    if (key === 'material') continue;
    if (key === 'materialAmount') continue;
    lines.push(`${labels[key] || key}: **${Number(value).toLocaleString()}**`);
  }
  if (reward.material) lines.push(`⚒️ ${reward.materialAmount || 1}x ${reward.material}`);
  return lines.length ? lines.join('\n') : 'No reward.';
}

function validateDungeonFormations(formations = [], required = 1) {
  if (!formationSystem || !formationSystem.validateRequiredFormations) {
    return { valid: false, reason: 'formationSystem is not connected. Phase 8 is required.' };
  }
  return formationSystem.validateRequiredFormations(formations, required);
}

function buildDungeonEnemyUnit(type = 'normal', room = {}, slot = 1, scaling = 1) {
  const difficulty = { normal: 1, elite: 1.35, abyss: 1.8, void: 2.4 }[type] || 1;
  const roomBonus = room.type === 'boss' ? 2.2 : room.type === 'elite' ? 1.45 : 1;
  const basePower = Math.floor((900 + room.index * 180 + slot * 80) * difficulty * roomBonus * scaling);
  const roles = ['TANK', 'DPS', 'SUPPORT', 'ASSASSIN', 'CONTROL', 'HEALER'];
  const elements = ['FIRE', 'ICE', 'WATER', 'WIND', 'LIGHTNING', 'SHADOW', 'LIGHT', 'VOID'];

  return {
    id: `dungeon-${type}-${room.index}-${slot}`,
    name: room.type === 'boss' && slot === 1 ? `${type.toUpperCase()} Dungeon Boss` : `${type} Enemy ${room.index}-${slot}`,
    anime: 'Void Dungeon',
    rarity: room.type === 'boss' ? 'MYTHIC' : room.type === 'elite' ? 'LEGENDARY' : 'EPIC',
    variant: 'Enemy',
    role: roles[(room.index + slot) % roles.length],
    element: elements[(room.index + slot + type.length) % elements.length],
    level: room.index * 3,
    power: basePower,
    basePower,
    hp: Math.floor(basePower * 2.6),
    atk: Math.floor(basePower * 0.4),
    def: Math.floor(basePower * 0.2),
    spd: 95 + room.index + slot,
    critRate: room.type === 'boss' ? 15 : 8,
    critDamage: room.type === 'boss' ? 80 : 50,
    effectChance: room.type === 'boss' ? 20 : 8,
    effectResistance: room.type === 'boss' ? 20 : 8
  };
}

function generateDungeonEnemyTeam(type = 'normal', room = {}, formationIndex = 1) {
  const scaling = 1 + (formationIndex - 1) * 0.12;
  return Array.from({ length: 6 }, (_, idx) => buildDungeonEnemyUnit(type, room, idx + 1, scaling));
}

function resolveCardsForFormation(formation = {}, ownedCardsById = {}) {
  return (formation.slots || []).map(slot => ownedCardsById[String(slot.cardId)]).filter(Boolean);
}

function runDungeonRoomBattle({ run = {}, formations = [], ownedCardsById = {}, seed = Date.now() } = {}) {
  if (!battleEngine || !battleEngine.runBasicBattle) return { ok: false, reason: 'battleEngine is not connected. Phase 7 is required.' };
  if (!formationSystem) return { ok: false, reason: 'formationSystem is not connected. Phase 8 is required.' };

  const room = getCurrentRoom(run);
  if (!room) return { ok: false, reason: 'No current room.' };

  const validation = validateDungeonFormations(formations, run.requiredFormations || 1);
  if (!validation.valid) return { ok: false, reason: 'formations_invalid', validation };

  if (['treasure', 'heal', 'choice', 'secret'].includes(room.type) && room.type !== 'secret') {
    return { ok: true, nonCombat: true, room, reward: generateReward(room.type, run.rewardMultiplier, seed) };
  }

  const active = formationSystem.getActiveFormations(formations, run.requiredFormations || 1);
  const results = [];
  let wins = 0;
  let losses = 0;

  for (let i = 0; i < active.length; i++) {
    const playerTeam = resolveCardsForFormation(active[i], ownedCardsById);
    const enemyTeam = generateDungeonEnemyTeam(run.type, room, i + 1);
    const result = battleEngine.runBasicBattle(playerTeam, enemyTeam, { seed: `${seed}:dungeon:${i}`, maxLogs: 24 });
    if (result.winner === 'A') wins += 1;
    else if (result.winner === 'B') losses += 1;
    results.push({ formation: i + 1, winner: result.winner, logs: result.logs || [] });
  }

  const requiredWins = room.type === 'boss' ? active.length : Math.floor(active.length / 2) + 1;
  const cleared = wins >= requiredWins;
  const reward = cleared ? generateReward(room.type === 'boss' ? 'boss' : room.type, run.rewardMultiplier, seed) : {};

  return { ok: true, nonCombat: false, cleared, room, wins, losses, requiredWins, reward, results };
}

function advanceDungeonRun(run = {}, cleared = false) {
  if (!cleared) return run;
  const updated = { ...run, rooms: [...(run.rooms || [])] };
  const idx = updated.rooms.findIndex(r => Number(r.index) === Number(run.currentRoom));
  if (idx >= 0) updated.rooms[idx] = { ...updated.rooms[idx], cleared: true, rewardClaimed: true };
  if (Number(run.currentRoom) >= updated.rooms.length) {
    updated.completed = true;
  } else {
    updated.currentRoom = Number(run.currentRoom) + 1;
  }
  return updated;
}

function formatDungeonRun(run = {}) {
  const info = getDungeonInfo(run.type);
  const room = getCurrentRoom(run);
  const roomInfo = room ? dungeonConfig.roomTypes[room.type] : null;
  const rooms = (run.rooms || []).map(r => {
    const ri = dungeonConfig.roomTypes[r.type] || {};
    const marker = r.cleared ? '✅' : Number(r.index) === Number(run.currentRoom) ? '➡️' : '⬛';
    return `${marker} ${r.index}. ${ri.emoji || ''} ${r.type}`;
  }).join('\n');

  return [
    `${info.emoji} **${info.displayName}**`,
    `Required Formations: **${run.requiredFormations}**`,
    `Room: **${run.currentRoom}/${(run.rooms || []).length}**`,
    roomInfo ? `Current: **${roomInfo.emoji} ${room.type}** — ${roomInfo.description}` : '',
    `Reward Multiplier: **x${run.rewardMultiplier || 1}**`,
    '',
    rooms
  ].filter(Boolean).join('\n');
}

function formatDungeonRoomResult(result = {}) {
  if (!result.ok) return `Dungeon room failed: ${result.reason || 'Unknown reason'}`;

  const lines = [
    `🏰 **Dungeon Room Result**`,
    `Room: **${result.room?.index} — ${result.room?.type}**`,
  ];

  if (result.nonCombat) {
    lines.push('', '**Reward**', formatReward(result.reward));
    return lines.join('\n');
  }

  lines.push(
    `Cleared: **${result.cleared ? 'YES' : 'NO'}**`,
    `Score: **${result.wins}-${result.losses}**`,
    `Required Wins: **${result.requiredWins}**`,
    '',
    '**Reward**',
    formatReward(result.reward),
    '',
    '**Formation Results**'
  );

  for (const row of result.results || []) {
    lines.push(`Formation ${row.formation}: ${row.winner === 'A' ? 'Win' : row.winner === 'B' ? 'Loss' : 'Draw'}`);
  }

  return lines.join('\n').slice(0, 3900);
}

module.exports = {
  clamp,
  seededRandom,
  normalizeDungeonType,
  getDungeonInfo,
  pickWeightedRoom,
  generateDungeonRun,
  getCurrentRoom,
  choosePath,
  randomRange,
  generateReward,
  formatReward,
  validateDungeonFormations,
  buildDungeonEnemyUnit,
  generateDungeonEnemyTeam,
  resolveCardsForFormation,
  runDungeonRoomBattle,
  advanceDungeonRun,
  formatDungeonRun,
  formatDungeonRoomResult
};
