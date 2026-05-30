// VoidRoll Reborn - Phase 15 World Boss / Raid System
// Server-wide bosses, damage ranking, last-hit rewards.
// No power-only raid, no item rolls, no relic pulls, no aura pulls, no fusion, no stars.

const raidConfig = require('../config/world_boss_config.json');

let battleEngine = null;
let formationSystem = null;
try { battleEngine = require('./battleEngine'); } catch (_) { battleEngine = null; }
try { formationSystem = require('./formationSystem'); } catch (_) { formationSystem = null; }

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalizeRaidType(type = 'world') {
  const t = String(type || 'world').toLowerCase();
  return raidConfig.raidTypes[t] ? t : 'world';
}

function getRaidInfo(type = 'world') {
  return raidConfig.raidTypes[normalizeRaidType(type)];
}

function getBossTemplate(idOrType = 'world') {
  return raidConfig.bossTemplates.find(b => b.id === idOrType)
    || raidConfig.bossTemplates.find(b => b.type === idOrType)
    || raidConfig.bossTemplates[0];
}

function createRaidBoss({ templateId = 'void-leviathan', serverId = 'server', level = 1, startsAt = new Date() } = {}) {
  const template = getBossTemplate(templateId);
  const raidInfo = getRaidInfo(template.type);
  const levelMultiplier = 1 + (Number(level || 1) - 1) * 0.18;
  const maxHp = Math.floor(template.baseHp * levelMultiplier);

  const end = new Date(startsAt);
  end.setHours(end.getHours() + raidInfo.durationHours);

  return {
    id: `raid-${serverId}-${template.id}-${Date.now()}`,
    serverId,
    templateId: template.id,
    type: template.type,
    name: template.name,
    level,
    element: template.element,
    role: template.role,
    rarity: template.rarity,
    maxHp,
    currentHp: maxHp,
    basePower: Math.floor(template.basePower * levelMultiplier),
    mechanics: template.mechanics || [],
    quote: template.quote,
    phase: 1,
    defeated: false,
    lastHitUserId: null,
    startsAt: startsAt.toISOString(),
    endsAt: end.toISOString(),
    damageLog: []
  };
}

function getBossPhase(boss = {}) {
  const hpPercent = boss.maxHp ? (Number(boss.currentHp) / Number(boss.maxHp)) * 100 : 100;
  return raidConfig.bossPhases.find(p => hpPercent <= p.hpPercentFrom && hpPercent > p.hpPercentTo)
    || raidConfig.bossPhases[raidConfig.bossPhases.length - 1];
}

function buildRaidBossUnit(boss = {}) {
  const phase = getBossPhase(boss);
  const phaseMultiplier = 1 + (Number(phase.phase || 1) - 1) * 0.25;
  const power = Math.floor(Number(boss.basePower || 1000000) * phaseMultiplier);

  return {
    id: boss.id,
    name: `${boss.name} Phase ${phase.phase}`,
    anime: 'Void Realm',
    rarity: boss.rarity || 'SECRET',
    variant: 'Raid Boss',
    role: boss.role || 'TANK',
    element: boss.element || 'VOID',
    level: Number(boss.level || 1) * 10,
    power,
    basePower: power,
    hp: Math.floor(power * 8),
    atk: Math.floor(power * 0.45),
    def: Math.floor(power * 0.28),
    spd: 120 + Number(phase.phase || 1) * 10,
    critRate: 12 + Number(phase.phase || 1) * 3,
    critDamage: 70 + Number(phase.phase || 1) * 10,
    effectChance: 15 + Number(phase.phase || 1) * 5,
    effectResistance: 20 + Number(phase.phase || 1) * 8
  };
}

function resolveCardsForFormation(formation = {}, ownedCardsById = {}) {
  return (formation.slots || []).map(slot => ownedCardsById[String(slot.cardId)]).filter(Boolean);
}

function estimateDamageFromBattle(result = {}) {
  const logs = result.logs || [];
  let total = 0;

  for (const line of logs) {
    const match = String(line).match(/for (\d+)/);
    if (match) total += Number(match[1] || 0);
  }

  if (total <= 0 && result.winner === 'A') total = 50000;
  return total;
}

function runRaidAttack({ boss = {}, user = {}, formations = [], ownedCardsById = {}, seed = Date.now() } = {}) {
  if (!battleEngine || !battleEngine.runBasicBattle) {
    return { ok: false, reason: 'battleEngine is not connected. Phase 7 is required.' };
  }

  if (!formationSystem || !formationSystem.validateRequiredFormations) {
    return { ok: false, reason: 'formationSystem is not connected. Phase 8 is required.' };
  }

  if (boss.defeated || Number(boss.currentHp || 0) <= 0) {
    return { ok: false, reason: 'boss_already_defeated' };
  }

  const raidInfo = getRaidInfo(boss.type);
  const required = raidInfo.requiredFormations || 3;
  const validation = formationSystem.validateRequiredFormations(formations, required);
  if (!validation.valid) return { ok: false, reason: 'formations_invalid', validation };

  const active = formationSystem.getActiveFormations(formations, required);
  const phaseBefore = getBossPhase(boss);
  const bossTeam = Array.from({ length: 6 }, (_, idx) => {
    const unit = buildRaidBossUnit(boss);
    return { ...unit, id: `${unit.id}-${idx}`, name: idx === 0 ? unit.name : `${boss.name} Echo ${idx}` };
  });

  let totalDamage = 0;
  const results = [];

  for (let i = 0; i < active.length; i++) {
    const playerTeam = resolveCardsForFormation(active[i], ownedCardsById);
    const result = battleEngine.runBasicBattle(playerTeam, bossTeam, {
      seed: `${seed}:raid:${i}`,
      maxLogs: 18,
      maxTurns: 12
    });

    const dmg = estimateDamageFromBattle(result);
    totalDamage += dmg;
    results.push({ formation: i + 1, damage: dmg, winner: result.winner, logs: result.logs || [] });
  }

  const updatedBoss = { ...boss };
  updatedBoss.currentHp = Math.max(0, Number(boss.currentHp) - totalDamage);
  updatedBoss.defeated = updatedBoss.currentHp <= 0;
  if (updatedBoss.defeated) updatedBoss.lastHitUserId = user.id || user.userId || null;

  const phaseAfter = getBossPhase(updatedBoss);
  const phaseBreak = Number(phaseAfter.phase) > Number(phaseBefore.phase);

  updatedBoss.damageLog = [
    ...(boss.damageLog || []),
    {
      userId: user.id || user.userId,
      username: user.username || user.name || 'Player',
      damage: totalDamage,
      at: new Date().toISOString()
    }
  ];

  return {
    ok: true,
    boss: updatedBoss,
    damage: totalDamage,
    phaseBefore,
    phaseAfter,
    phaseBreak,
    defeated: updatedBoss.defeated,
    results
  };
}

function getDamageRanking(boss = {}) {
  const totals = new Map();

  for (const row of boss.damageLog || []) {
    const key = row.userId || row.username;
    if (!totals.has(key)) {
      totals.set(key, { userId: row.userId, username: row.username || 'Player', damage: 0 });
    }
    totals.get(key).damage += Number(row.damage || 0);
  }

  return [...totals.values()].sort((a, b) => b.damage - a.damage);
}

function getRankingReward(rank = 999) {
  if (rank === 1) return raidConfig.rankingRewards.top1;
  if (rank <= 3) return raidConfig.rankingRewards.top3;
  if (rank <= 10) return raidConfig.rankingRewards.top10;
  if (rank <= 25) return raidConfig.rankingRewards.top25;
  return raidConfig.rankingRewards.participation;
}

function formatReward(reward = {}) {
  const labels = {
    gold: '🪙 Gold',
    tokens: '🎟️ Tokens',
    essence: '🔮 Essence',
    voidCrystals: '💎 Void Crystals'
  };
  const lines = Object.entries(reward).map(([k, v]) => `${labels[k] || k}: **${Number(v).toLocaleString()}**`);
  return lines.length ? lines.join('\n') : 'No reward.';
}

function formatRaidBoss(boss = {}) {
  const phase = getBossPhase(boss);
  const hpPercent = boss.maxHp ? ((Number(boss.currentHp) / Number(boss.maxHp)) * 100).toFixed(2) : '0.00';

  return [
    `👹 **${boss.name || 'World Boss'}**`,
    `Type: **${boss.type || 'world'}**`,
    `Rarity: **${boss.rarity || 'SECRET'}**`,
    `Element: **${boss.element || 'VOID'}** | Role: **${boss.role || 'TANK'}**`,
    `HP: **${Number(boss.currentHp || 0).toLocaleString()} / ${Number(boss.maxHp || 0).toLocaleString()}** (${hpPercent}%)`,
    `Phase: **${phase.phase}**`,
    `Mechanics: **${(phase.mechanics || []).join(', ')}**`,
    boss.quote ? `Quote: _${boss.quote}_` : '',
    `Defeated: **${boss.defeated ? 'YES' : 'NO'}**`
  ].filter(Boolean).join('\n');
}

function formatRaidAttackResult(result = {}) {
  if (!result.ok) return `Raid attack failed: ${result.reason || 'Unknown reason'}`;

  const lines = [
    `⚔️ **Raid Attack Result**`,
    `Damage: **${Number(result.damage || 0).toLocaleString()}**`,
    `Boss HP: **${Number(result.boss.currentHp || 0).toLocaleString()} / ${Number(result.boss.maxHp || 0).toLocaleString()}**`,
    `Phase: **${result.phaseBefore.phase} → ${result.phaseAfter.phase}**`,
    result.phaseBreak ? '🔥 **Phase Break Reward Unlocked!**' : '',
    result.defeated ? '🏆 **Boss Defeated! Last Hit Reward Unlocked!**' : '',
    '',
    '**Formation Damage**'
  ].filter(Boolean);

  for (const row of result.results || []) {
    lines.push(`Formation ${row.formation}: **${Number(row.damage || 0).toLocaleString()}** damage`);
  }

  return lines.join('\n').slice(0, 3900);
}

function formatDamageRanking(boss = {}) {
  const ranking = getDamageRanking(boss);
  if (!ranking.length) return 'No damage ranking yet.';

  const lines = ranking.slice(0, 25).map((row, index) => {
    return `**${index + 1}. ${row.username}** — ${Number(row.damage || 0).toLocaleString()} DMG`;
  });

  return [`🏆 **${boss.name} Damage Ranking**`, ...lines].join('\n');
}

module.exports = {
  clamp,
  normalizeRaidType,
  getRaidInfo,
  getBossTemplate,
  createRaidBoss,
  getBossPhase,
  buildRaidBossUnit,
  resolveCardsForFormation,
  estimateDamageFromBattle,
  runRaidAttack,
  getDamageRanking,
  getRankingReward,
  formatReward,
  formatRaidBoss,
  formatRaidAttackResult,
  formatDamageRanking
};
