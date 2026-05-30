// VoidRoll Reborn - Phase 7 Battle Engine Foundation
// Stats-based battle engine foundation.
// No power-only combat, no stars, no fusion.

const battleConfig = require('../config/battle_config.json');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalizeUpper(value, fallback = 'UNKNOWN') {
  const out = String(value || fallback).trim().toUpperCase();
  return out || fallback;
}

function rng(seed = Date.now()) {
  let h = 2166136261 >>> 0;
  const str = String(seed);
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

function getCharacter(card = {}) {
  return card.character || card.template || card;
}

function deriveStats(card = {}) {
  const c = getCharacter(card);
  const level = Number(card.level || 1);
  const power = Number(card.power || c.basePower || c.power || 100);

  const baseHp = Number(card.hp || c.hp || c.baseHp || Math.floor(power * 2.4));
  const baseAtk = Number(card.atk || c.atk || c.baseAtk || Math.floor(power * 0.42));
  const baseDef = Number(card.def || c.def || c.baseDef || Math.floor(power * 0.22));
  const baseSpd = Number(card.spd || c.spd || c.speed || 100);

  return {
    id: card.id || c.id || `${c.name || 'unit'}-${Math.random()}`,
    name: c.name || card.name || 'Unknown',
    anime: c.anime || 'Unknown',
    rarity: c.rarity || 'COMMON',
    variant: c.variant || 'Base',
    role: normalizeUpper(c.role || c.type || card.role || card.type || 'DPS'),
    element: normalizeUpper(c.element || card.element || 'LIGHT'),
    level,
    power,
    maxHp: Math.max(1, Math.floor(baseHp + level * 15)),
    hp: Math.max(1, Math.floor(baseHp + level * 15)),
    atk: Math.max(1, Math.floor(baseAtk + level * 4)),
    def: Math.max(0, Math.floor(baseDef + level * 3)),
    spd: Math.max(1, Math.floor(baseSpd + level)),
    critRate: clamp(card.critRate || c.critRate || 8, 0, 100),
    critDamage: clamp(card.critDamage || c.critDamage || 50, 0, 400),
    effectChance: clamp(card.effectChance || c.effectChance || 0, 0, 100),
    effectResistance: clamp(card.effectResistance || c.effectResistance || 0, 0, 100),
    dodgeChance: clamp(card.dodgeChance || c.dodgeChance || 3, 0, 80),
    counterChance: clamp(card.counterChance || c.counterChance || 0, 0, 80),
    healingBonus: clamp(card.healingBonus || c.healingBonus || 0, 0, 300),
    shieldPower: clamp(card.shieldPower || c.shieldPower || 0, 0, 300),
    mana: Number(card.mana || c.mana || 100),
    energy: Number(card.energy || battleConfig.battleRules.startingEnergy || 0),
    ultimateBar: Number(card.ultimateBar || 0),
    shield: Number(card.shield || 0),
    statuses: [],
    alive: true
  };
}

function applyRoleBonus(unit) {
  const roleInfo = battleConfig.roles[unit.role];
  if (!roleInfo || !roleInfo.bonus) return unit;

  const out = { ...unit };
  for (const [stat, bonus] of Object.entries(roleInfo.bonus)) {
    if (stat === 'hp') {
      out.maxHp = Math.floor(out.maxHp * (1 + bonus));
      out.hp = out.maxHp;
    } else if (stat in out) {
      out[stat] = Math.floor(out[stat] * (1 + bonus));
    } else {
      out[stat] = bonus;
    }
  }
  return out;
}

function buildBattleUnit(card = {}) {
  return applyRoleBonus(deriveStats(card));
}

function isElementAdvantage(attackerElement, defenderElement) {
  const atk = normalizeUpper(attackerElement);
  const def = normalizeUpper(defenderElement);
  const advantages = battleConfig.elementRules.advantages[atk] || [];
  return advantages.includes(def);
}

function calculateDamage(attacker, defender, options = {}, rand = Math.random) {
  if (!attacker.alive || !defender.alive) return { damage: 0, crit: false, dodged: false, elementAdvantage: false };

  const dodgeRoll = rand() * 100;
  if (dodgeRoll < defender.dodgeChance && !options.cannotDodge) {
    return { damage: 0, crit: false, dodged: true, elementAdvantage: false };
  }

  const raw = Math.max(1, attacker.atk - Math.floor(defender.def * 0.45));
  let multiplier = Number(options.multiplier || 1);

  const elementAdvantage = isElementAdvantage(attacker.element, defender.element);
  if (elementAdvantage) {
    multiplier += battleConfig.elementRules.advantageDamageBonus || 0.12;
  }

  if (attacker.element === 'VOID') {
    multiplier += battleConfig.elementRules.voidDamageBonus || 0.08;
  }

  const crit = (rand() * 100) < attacker.critRate;
  if (crit) {
    multiplier *= (1 + (attacker.critDamage / 100));
  }

  const variance = 0.92 + (rand() * 0.16);
  const damage = Math.max(1, Math.floor(raw * multiplier * variance));

  return { damage, crit, dodged: false, elementAdvantage };
}

function applyDamage(target, amount) {
  const out = { ...target };
  let remaining = Math.max(0, Number(amount || 0));

  if (out.shield > 0) {
    const absorbed = Math.min(out.shield, remaining);
    out.shield -= absorbed;
    remaining -= absorbed;
  }

  out.hp = Math.max(0, out.hp - remaining);
  if (out.hp <= 0) {
    out.alive = false;
    out.hp = 0;
  }

  return out;
}

function healUnit(unit, amount) {
  const out = { ...unit };
  const finalHeal = Math.floor(Number(amount || 0) * (1 + (out.healingBonus || 0) / 100));
  out.hp = Math.min(out.maxHp, out.hp + finalHeal);
  return out;
}

function addShield(unit, amount) {
  const out = { ...unit };
  const finalShield = Math.floor(Number(amount || 0) * (1 + (out.shieldPower || 0) / 100));
  out.shield = Number(out.shield || 0) + finalShield;
  return out;
}

function addEnergy(unit, amount) {
  const out = { ...unit };
  const max = battleConfig.battleRules.ultimateBarMax || 100;
  out.energy = clamp(Number(out.energy || 0) + Number(amount || 0), 0, max);
  out.ultimateBar = out.energy;
  return out;
}

function applyStatus(target, statusName, source = {}, options = {}, rand = Math.random) {
  const statusKey = String(statusName || '').trim();
  const status = battleConfig.statusEffects[statusKey];
  if (!status) return { target, applied: false, reason: 'unknown_status' };

  const chance = clamp(options.chance ?? source.effectChance ?? 100, 0, 100);
  const resistance = clamp(target.effectResistance || 0, 0, 95);
  const finalChance = clamp(chance - resistance, 5, 95);

  if ((rand() * 100) > finalChance) {
    return { target, applied: false, reason: 'resisted' };
  }

  const out = { ...target, statuses: [...(target.statuses || [])] };
  const turns = Number(options.turns || status.defaultTurns || 1);

  if (!status.stackable) {
    out.statuses = out.statuses.filter(s => s.name !== statusKey);
  }

  out.statuses.push({
    name: statusKey,
    turns,
    power: Number(options.power || source.atk || 0),
    sourceId: source.id || null
  });

  return { target: out, applied: true, reason: 'applied' };
}

function processStatusStart(unit) {
  let out = { ...unit, statuses: [...(unit.statuses || [])] };
  const logs = [];

  for (const status of out.statuses) {
    if (status.name === 'bleed') {
      const dmg = Math.max(1, Math.floor((status.power || out.atk || 1) * 0.18));
      out = applyDamage(out, dmg);
      logs.push(`${out.name} takes ${dmg} bleed damage.`);
    }

    if (status.name === 'burn') {
      const dmg = Math.max(1, Math.floor((status.power || out.atk || 1) * 0.14));
      out = applyDamage(out, dmg);
      logs.push(`${out.name} takes ${dmg} burn damage.`);
    }
  }

  return { unit: out, logs };
}

function processStatusEnd(unit) {
  const out = { ...unit };
  out.statuses = (out.statuses || [])
    .map(s => ({ ...s, turns: Number(s.turns || 0) - 1 }))
    .filter(s => s.turns > 0);
  return out;
}

function isTurnSkipped(unit, rand = Math.random) {
  const statuses = unit.statuses || [];

  if (statuses.some(s => s.name === 'stun')) return { skipped: true, reason: 'stun' };

  if (statuses.some(s => s.name === 'freeze')) {
    if (rand() < 0.60) return { skipped: true, reason: 'freeze' };
  }

  return { skipped: false, reason: null };
}

function chooseTarget(enemies = []) {
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return null;
  return alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}

function formationAlive(team = []) {
  return team.some(u => u.alive);
}

function runBasicBattle(teamAInput = [], teamBInput = [], options = {}) {
  const rand = rng(options.seed || Date.now());

  let teamA = teamAInput.map(buildBattleUnit);
  let teamB = teamBInput.map(buildBattleUnit);

  const logs = [];
  const maxTurns = Number(options.maxTurns || battleConfig.battleRules.maxTurns || 30);

  for (let turn = 1; turn <= maxTurns; turn++) {
    logs.push(`-- Turn ${turn} --`);

    const allUnits = [
      ...teamA.map((u, idx) => ({ ...u, side: 'A', idx })),
      ...teamB.map((u, idx) => ({ ...u, side: 'B', idx }))
    ].filter(u => u.alive).sort((a, b) => b.spd - a.spd || rand() - 0.5);

    for (const actorRef of allUnits) {
      const currentTeam = actorRef.side === 'A' ? teamA : teamB;
      const enemyTeam = actorRef.side === 'A' ? teamB : teamA;
      let actor = currentTeam[actorRef.idx];

      if (!actor || !actor.alive) continue;

      const statusStart = processStatusStart(actor);
      actor = statusStart.unit;
      logs.push(...statusStart.logs);

      if (!actor.alive) {
        currentTeam[actorRef.idx] = actor;
        continue;
      }

      const skip = isTurnSkipped(actor, rand);
      if (skip.skipped) {
        logs.push(`${actor.name} skipped turn due to ${skip.reason}.`);
        currentTeam[actorRef.idx] = processStatusEnd(actor);
        continue;
      }

      const targetIndex = enemyTeam.findIndex(e => e.id === (chooseTarget(enemyTeam) || {}).id);
      if (targetIndex < 0) continue;

      let target = enemyTeam[targetIndex];
      const hit = calculateDamage(actor, target, {}, rand);

      if (hit.dodged) {
        logs.push(`${target.name} dodged ${actor.name}'s attack.`);
        actor = addEnergy(actor, battleConfig.battleRules.energyOnAttack || 18);
      } else {
        target = applyDamage(target, hit.damage);
        actor = addEnergy(actor, battleConfig.battleRules.energyOnAttack || 18);
        target = addEnergy(target, battleConfig.battleRules.energyOnHitTaken || 10);
        if (hit.crit) actor = addEnergy(actor, battleConfig.battleRules.energyOnCrit || 8);

        logs.push(`${actor.name} hits ${target.name} for ${hit.damage}${hit.crit ? ' CRIT' : ''}${hit.elementAdvantage ? ' [Element Advantage]' : ''}.`);

        if (!target.alive) {
          actor = addEnergy(actor, battleConfig.battleRules.energyOnKill || 25);
          logs.push(`${target.name} is defeated.`);
        } else {
          const counterRoll = rand() * 100;
          if (counterRoll < target.counterChance) {
            const counter = calculateDamage(target, actor, { multiplier: 0.55 }, rand);
            actor = applyDamage(actor, counter.damage);
            logs.push(`${target.name} counters ${actor.name} for ${counter.damage}.`);
          }
        }
      }

      currentTeam[actorRef.idx] = processStatusEnd(actor);
      enemyTeam[targetIndex] = processStatusEnd(target);

      if (!formationAlive(teamA) || !formationAlive(teamB)) break;
    }

    if (!formationAlive(teamA) || !formationAlive(teamB)) break;

    if (turn === (battleConfig.battleRules.enrageTurn || 20)) {
      logs.push('⚠️ Enrage begins. Damage increases as the fight drags on.');
      teamA = teamA.map(u => ({ ...u, atk: Math.floor(u.atk * 1.12) }));
      teamB = teamB.map(u => ({ ...u, atk: Math.floor(u.atk * 1.12) }));
    }
  }

  const winner = formationAlive(teamA) && !formationAlive(teamB)
    ? 'A'
    : formationAlive(teamB) && !formationAlive(teamA)
      ? 'B'
      : 'DRAW';

  return {
    winner,
    teamA,
    teamB,
    logs: logs.slice(0, options.maxLogs || 80)
  };
}

function formatBattleResult(result = {}) {
  return [
    `⚔️ **Battle Result**`,
    `Winner: **${result.winner || 'DRAW'}**`,
    '',
    '**Battle Log**',
    ...(result.logs || [])
  ].join('\n').slice(0, 3900);
}

module.exports = {
  clamp,
  normalizeUpper,
  rng,
  deriveStats,
  applyRoleBonus,
  buildBattleUnit,
  isElementAdvantage,
  calculateDamage,
  applyDamage,
  healUnit,
  addShield,
  addEnergy,
  applyStatus,
  processStatusStart,
  processStatusEnd,
  isTurnSkipped,
  chooseTarget,
  formationAlive,
  runBasicBattle,
  formatBattleResult
};
