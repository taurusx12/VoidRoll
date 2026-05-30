// VoidRoll Reborn - Phase 13 PvP Ranked
// Ranked PvP foundation using Battle Engine + Defense Formations.
// No power-only PvP, no fusion, no stars.

const pvpConfig = require('../config/pvp_config.json');

let battleEngine = null;
let formationSystem = null;
try { battleEngine = require('./battleEngine'); } catch (_) { battleEngine = null; }
try { formationSystem = require('./formationSystem'); } catch (_) { formationSystem = null; }

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function getRankByRating(rating = pvpConfig.rating.startingRating) {
  const value = Number(rating || 0);
  return pvpConfig.ranks.find(rank => value >= rank.minRating && value <= rank.maxRating)
    || pvpConfig.ranks[0];
}

function getRequiredFormationsForRank(rankName = 'Bronze') {
  return pvpConfig.formationRequirements[String(rankName || 'Bronze')] || 1;
}

function getRequiredFormationsByRating(rating = 1000) {
  return getRequiredFormationsForRank(getRankByRating(rating).name);
}

function formatRank(rating = 1000) {
  const rank = getRankByRating(rating);
  return `${rank.emoji} ${rank.name} (${Number(rating || 0).toLocaleString()} RP)`;
}

function calculateRatingChange({ attackerRating = 1000, defenderRating = 1000, result = 'win', streak = 0 } = {}) {
  const cfg = pvpConfig.rating;
  const diff = Number(defenderRating) - Number(attackerRating);
  const underdogBonus = clamp(Math.floor(diff / cfg.ratingDifferenceDivisor), 0, cfg.underdogBonusMax);
  const streakBonus = clamp(Number(streak || 0) * 2, 0, cfg.streakBonusMax);

  if (result === 'draw') return 0;
  if (result === 'win') return cfg.winBase + underdogBonus + streakBonus;

  const favoritePenalty = clamp(Math.floor((-diff) / cfg.ratingDifferenceDivisor), 0, 10);
  return -Math.max(5, cfg.lossBase + favoritePenalty - underdogBonus);
}

function getRankUpReward(oldRating = 1000, newRating = 1000) {
  const oldRank = getRankByRating(oldRating);
  const newRank = getRankByRating(newRating);
  if (oldRank.name === newRank.name) return null;
  return pvpConfig.rewards.rankUp[newRank.name] || null;
}

function getBaseReward(result = 'win') {
  if (result === 'win') return pvpConfig.rewards.win;
  if (result === 'loss') return pvpConfig.rewards.loss;
  return {};
}

function formatReward(reward = {}) {
  const labels = { gold: '🪙 Gold', tokens: '🎟️ Tokens', essence: '🔮 Essence', voidCrystals: '💎 Void Crystals' };
  const lines = Object.entries(reward).map(([k, v]) => `${labels[k] || k}: **${Number(v).toLocaleString()}**`);
  return lines.length ? lines.join('\n') : 'No reward.';
}

function validatePvpFormations(formations = [], rating = 1000) {
  const required = getRequiredFormationsByRating(rating);
  if (!formationSystem || !formationSystem.validateRequiredFormations) {
    return { valid: false, required, reason: 'formationSystem is not connected. Phase 8 is required.' };
  }
  const validation = formationSystem.validateRequiredFormations(formations, required);
  return { ...validation, required, reason: validation.valid ? 'valid' : 'incomplete_or_duplicate_cards' };
}

function resolveCardsForFormation(formation = {}, ownedCardsById = {}) {
  return (formation.slots || []).map(slot => ownedCardsById[String(slot.cardId)]).filter(Boolean);
}

function runPvpBattle({
  attacker = {},
  defender = {},
  attackerFormations = [],
  defenderFormations = [],
  attackerCardsById = {},
  defenderCardsById = {},
  seed = Date.now()
} = {}) {
  if (!battleEngine || !battleEngine.runBasicBattle) return { ok: false, reason: 'battleEngine is not connected. Phase 7 is required.' };
  if (!formationSystem) return { ok: false, reason: 'formationSystem is not connected. Phase 8 is required.' };

  const attackerRating = Number(attacker.rating || pvpConfig.rating.startingRating);
  const defenderRating = Number(defender.rating || pvpConfig.rating.startingRating);
  const required = Math.max(getRequiredFormationsByRating(attackerRating), getRequiredFormationsByRating(defenderRating));

  const attackerValidation = formationSystem.validateRequiredFormations(attackerFormations, required);
  const defenderValidation = formationSystem.validateRequiredFormations(defenderFormations, required);
  if (!attackerValidation.valid) return { ok: false, reason: 'attacker_formations_invalid', validation: attackerValidation };
  if (!defenderValidation.valid) return { ok: false, reason: 'defender_formations_invalid', validation: defenderValidation };

  const attackerTeams = formationSystem.getActiveFormations(attackerFormations, required)
    .map(f => ({ index: f.index, units: resolveCardsForFormation(f, attackerCardsById) }));
  const defenderTeams = formationSystem.getActiveFormations(defenderFormations, required)
    .map(f => ({ index: f.index, units: resolveCardsForFormation(f, defenderCardsById) }));

  let attackerWins = 0, defenderWins = 0;
  const results = [];

  for (let i = 0; i < required; i++) {
    const result = battleEngine.runBasicBattle(attackerTeams[i].units, defenderTeams[i].units, {
      seed: `${seed}:pvp:${i}`,
      maxLogs: 24
    });
    if (result.winner === 'A') attackerWins += 1;
    else if (result.winner === 'B') defenderWins += 1;
    results.push({ formation: i + 1, winner: result.winner, logs: result.logs || [] });
  }

  const finalResult = attackerWins > defenderWins ? 'win' : defenderWins > attackerWins ? 'loss' : 'draw';
  const ratingChange = calculateRatingChange({
    attackerRating,
    defenderRating,
    result: finalResult,
    streak: attacker.winStreak || 0
  });
  const newRating = Math.max(0, attackerRating + ratingChange);

  return {
    ok: true,
    result: finalResult,
    requiredFormations: required,
    attackerWins,
    defenderWins,
    oldRating: attackerRating,
    newRating,
    ratingChange,
    oldRank: getRankByRating(attackerRating),
    newRank: getRankByRating(newRating),
    baseReward: getBaseReward(finalResult),
    rankUpReward: getRankUpReward(attackerRating, newRating),
    results
  };
}

function getMatchmakingCandidates(players = [], player = {}) {
  const rating = Number(player.rating || pvpConfig.rating.startingRating);
  const min = rating - pvpConfig.matchmaking.ratingWindow;
  const max = rating + pvpConfig.matchmaking.ratingWindow;
  return players
    .filter(p => p.id !== player.id)
    .filter(p => Number(p.rating || pvpConfig.rating.startingRating) >= min)
    .filter(p => Number(p.rating || pvpConfig.rating.startingRating) <= max)
    .sort((a, b) => Math.abs(Number(a.rating || 1000) - rating) - Math.abs(Number(b.rating || 1000) - rating))
    .slice(0, pvpConfig.matchmaking.maxResults);
}

function formatPvpProfile(player = {}) {
  const rating = Number(player.rating || pvpConfig.rating.startingRating);
  const rank = getRankByRating(rating);
  return [
    `⚔️ **PvP Profile**`,
    `Rank: **${rank.emoji} ${rank.name}**`,
    `Rating: **${rating.toLocaleString()} RP**`,
    `Wins: **${Number(player.wins || 0).toLocaleString()}**`,
    `Losses: **${Number(player.losses || 0).toLocaleString()}**`,
    `Win Streak: **${Number(player.winStreak || 0)}**`,
    `Required Formations: **${getRequiredFormationsForRank(rank.name)}**`
  ].join('\n');
}

function formatPvpResult(result = {}) {
  if (!result.ok) return `PvP could not start: ${result.reason || 'Unknown reason'}`;
  const lines = [
    `⚔️ **PvP Ranked Result**`,
    `Result: **${result.result.toUpperCase()}**`,
    `Score: **${result.attackerWins}-${result.defenderWins}**`,
    `Rating: **${result.oldRating} → ${result.newRating}** (${result.ratingChange >= 0 ? '+' : ''}${result.ratingChange})`,
    `Rank: **${result.oldRank.emoji} ${result.oldRank.name} → ${result.newRank.emoji} ${result.newRank.name}**`,
    '',
    '**Reward**',
    formatReward(result.baseReward)
  ];
  if (result.rankUpReward) lines.push('', '🎉 **Rank Up Reward**', formatReward(result.rankUpReward));
  lines.push('', '**Formation Results**');
  for (const row of result.results || []) {
    lines.push(`Formation ${row.formation}: ${row.winner === 'A' ? 'Win' : row.winner === 'B' ? 'Loss' : 'Draw'}`);
  }
  return lines.join('\n').slice(0, 3900);
}

function formatLeaderboard(players = []) {
  const sorted = [...players].sort((a, b) => Number(b.rating || 1000) - Number(a.rating || 1000)).slice(0, 20);
  const lines = sorted.map((p, i) => {
    const rank = getRankByRating(p.rating || 1000);
    return `**${i + 1}. ${p.username || p.name || 'Player'}** — ${rank.emoji} ${rank.name} • ${Number(p.rating || 1000).toLocaleString()} RP`;
  });
  return ['🏆 **PvP Leaderboard**', ...lines].join('\n');
}

function getSeasonEndReward(rating = 1000) {
  const rank = getRankByRating(rating);
  return pvpConfig.rewards.seasonEnd[rank.name] || {};
}

module.exports = {
  clamp,
  getRankByRating,
  getRequiredFormationsForRank,
  getRequiredFormationsByRating,
  formatRank,
  calculateRatingChange,
  getRankUpReward,
  getBaseReward,
  formatReward,
  validatePvpFormations,
  resolveCardsForFormation,
  runPvpBattle,
  getMatchmakingCandidates,
  formatPvpProfile,
  formatPvpResult,
  formatLeaderboard,
  getSeasonEndReward
};
