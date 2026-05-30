// VoidRoll Reborn - Phase 8 Multi-Team Story Foundation
// Story requests more formations as the player progresses.
// Enemy mirrors the same formation count.

const formationConfig = require('../config/formation_story_config.json');
const {
  validateRequiredFormations,
  getActiveFormations
} = require('./formationSystem');

let battleEngine = null;
try {
  battleEngine = require('./battleEngine');
} catch (_) {
  battleEngine = null;
}

function getStoryFormationRequirement(chapter = 1) {
  const ch = Number(chapter || 1);
  return formationConfig.storyFormationUnlocks.find(row => {
    return ch >= row.fromChapter && ch <= row.toChapter;
  }) || formationConfig.storyFormationUnlocks[0];
}

function isBossStage(stage = 1) {
  const st = Number(stage || 1);
  return st % 5 === 0;
}

function getEnemyScaling(chapter = 1, stage = 1, requiredFormations = 1, options = {}) {
  const scaling = formationConfig.storyRules.enemyScaling;
  let multiplier = 1;

  multiplier *= Math.pow(scaling.baseChapterMultiplier || 1.08, Math.max(0, Number(chapter || 1) - 1));
  multiplier *= Math.pow(scaling.formationCountMultiplier || 1.12, Math.max(0, Number(requiredFormations || 1) - 1));

  if (isBossStage(stage)) multiplier *= scaling.bossMultiplier || 1.35;
  if (options.voidRealm) multiplier *= scaling.voidRealmMultiplier || 1.55;

  return Number(multiplier.toFixed(3));
}

function getStoryWinCondition(chapter = 1, stage = 1) {
  return isBossStage(stage)
    ? formationConfig.storyRules.bossStageWinCondition
    : formationConfig.storyRules.defaultWinCondition;
}

function requiredWins(requiredFormations = 1, winCondition = 'majority') {
  if (winCondition === 'all') return requiredFormations;
  return Math.floor(requiredFormations / 2) + 1;
}

function buildEnemyUnit(chapter = 1, stage = 1, formationIndex = 1, slotIndex = 1, scaling = 1) {
  const basePower = Math.floor((800 + chapter * 180 + stage * 55 + formationIndex * 120) * scaling);
  const roles = ['TANK', 'DPS', 'SUPPORT', 'ASSASSIN', 'CONTROL', 'HEALER'];
  const elements = ['FIRE', 'ICE', 'WATER', 'WIND', 'LIGHTNING', 'SHADOW', 'LIGHT', 'VOID'];
  const role = roles[(slotIndex + formationIndex + chapter) % roles.length];
  const element = elements[(slotIndex + stage + chapter) % elements.length];

  return {
    id: `enemy-c${chapter}-s${stage}-f${formationIndex}-${slotIndex}`,
    name: isBossStage(stage) && slotIndex === 1
      ? `Chapter ${chapter} Boss`
      : `Void Enemy ${chapter}-${stage}-${formationIndex}-${slotIndex}`,
    anime: 'Void Realm',
    rarity: isBossStage(stage) ? 'MYTHIC' : 'EPIC',
    variant: 'Enemy',
    role,
    element,
    level: Math.max(1, chapter * 3 + stage),
    power: basePower,
    basePower,
    hp: Math.floor(basePower * 2.5),
    atk: Math.floor(basePower * 0.38),
    def: Math.floor(basePower * 0.2),
    spd: 90 + chapter + slotIndex,
    critRate: isBossStage(stage) ? 12 : 6,
    critDamage: isBossStage(stage) ? 70 : 45,
    effectChance: role === 'CONTROL' ? 20 : 5,
    effectResistance: isBossStage(stage) ? 15 : 5
  };
}

function generateEnemyFormation(chapter = 1, stage = 1, formationIndex = 1, scaling = 1) {
  return Array.from({ length: formationConfig.formationRules.charactersPerFormation || 6 }, (_, idx) => {
    return buildEnemyUnit(chapter, stage, formationIndex, idx + 1, scaling);
  });
}

function generateEnemyFormations(chapter = 1, stage = 1, requiredFormations = 1, options = {}) {
  const scaling = getEnemyScaling(chapter, stage, requiredFormations, options);
  return Array.from({ length: requiredFormations }, (_, idx) => {
    return {
      index: idx + 1,
      units: generateEnemyFormation(chapter, stage, idx + 1, scaling)
    };
  });
}

function resolveCardsForFormation(formation = {}, ownedCardsById = {}) {
  return (formation.slots || [])
    .map(slot => ownedCardsById[String(slot.cardId)])
    .filter(Boolean);
}

function prepareStoryBattle({ chapter = 1, stage = 1, playerFormations = [], ownedCardsById = {}, options = {} }) {
  const req = getStoryFormationRequirement(chapter);
  const validation = validateRequiredFormations(playerFormations, req.requiredFormations);

  if (!validation.valid) {
    return {
      ok: false,
      requirement: req,
      validation,
      message: `Story Chapter ${chapter} Stage ${stage} requires ${req.requiredFormations} complete formation(s).`
    };
  }

  const activePlayerFormations = getActiveFormations(playerFormations, req.requiredFormations).map(f => ({
    index: f.index,
    units: resolveCardsForFormation(f, ownedCardsById)
  }));

  const enemyFormations = generateEnemyFormations(chapter, stage, req.enemyFormations, options);

  return {
    ok: true,
    requirement: req,
    winCondition: getStoryWinCondition(chapter, stage),
    winsRequired: requiredWins(req.requiredFormations, getStoryWinCondition(chapter, stage)),
    playerFormations: activePlayerFormations,
    enemyFormations
  };
}

function runStoryMultiBattle({ chapter = 1, stage = 1, playerFormations = [], ownedCardsById = {}, options = {} }) {
  const prepared = prepareStoryBattle({ chapter, stage, playerFormations, ownedCardsById, options });

  if (!prepared.ok) return prepared;

  if (!battleEngine || !battleEngine.runBasicBattle) {
    return {
      ...prepared,
      ok: false,
      message: 'battleEngine is not connected yet. Phase 7 battleEngine.js is required.'
    };
  }

  const results = [];
  let playerWins = 0;
  let enemyWins = 0;

  for (let i = 0; i < prepared.requirement.requiredFormations; i++) {
    const playerTeam = prepared.playerFormations[i]?.units || [];
    const enemyTeam = prepared.enemyFormations[i]?.units || [];
    const result = battleEngine.runBasicBattle(playerTeam, enemyTeam, {
      seed: `${chapter}:${stage}:${i}:${Date.now()}`,
      maxLogs: 30
    });

    if (result.winner === 'A') playerWins += 1;
    else if (result.winner === 'B') enemyWins += 1;

    results.push({
      formation: i + 1,
      winner: result.winner,
      logs: result.logs
    });
  }

  const victory = playerWins >= prepared.winsRequired;

  return {
    ...prepared,
    ok: true,
    victory,
    playerWins,
    enemyWins,
    results
  };
}

function formatStoryRequirement(chapter = 1, stage = 1) {
  const req = getStoryFormationRequirement(chapter);
  const condition = getStoryWinCondition(chapter, stage);
  const wins = requiredWins(req.requiredFormations, condition);

  return [
    `📖 **Story Chapter ${chapter} - Stage ${stage}**`,
    `Required Formations: **${req.requiredFormations}**`,
    `Enemy Formations: **${req.enemyFormations}**`,
    `Win Condition: **${condition.toUpperCase()}**`,
    `Wins Needed: **${wins}/${req.requiredFormations}**`
  ].join('\n');
}

function formatStoryBattleResult(result = {}) {
  if (!result.ok) return result.message || 'Story battle could not start.';

  const lines = [
    `📖 **Story Battle Result**`,
    `Victory: **${result.victory ? 'YES' : 'NO'}**`,
    `Score: **${result.playerWins}-${result.enemyWins}**`,
    `Required Wins: **${result.winsRequired}**`,
    ''
  ];

  for (const row of result.results || []) {
    lines.push(`**Formation ${row.formation}** Winner: ${row.winner === 'A' ? 'Player' : row.winner === 'B' ? 'Enemy' : 'Draw'}`);
    lines.push(...(row.logs || []).slice(0, 8));
    lines.push('');
  }

  return lines.join('\n').slice(0, 3900);
}

module.exports = {
  getStoryFormationRequirement,
  isBossStage,
  getEnemyScaling,
  getStoryWinCondition,
  requiredWins,
  buildEnemyUnit,
  generateEnemyFormation,
  generateEnemyFormations,
  resolveCardsForFormation,
  prepareStoryBattle,
  runStoryMultiBattle,
  formatStoryRequirement,
  formatStoryBattleResult
};
