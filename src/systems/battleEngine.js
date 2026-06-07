// VoidRoll Reborn - Phase 30 Battle Engine
// Full passive + gear + skill + role combat system.

const battleConfig = require('../config/battle_config.json');

let combatProfiles = null;
try { combatProfiles = require('./characterCombatProfileSystem'); } catch (_) {}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalizeUpper(value, fallback = 'UNKNOWN') {
  return (String(value || fallback).trim().toUpperCase()) || fallback;
}

function rng(seed = Date.now()) {
  let h = 2166136261 >>> 0;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function rand() {
    h += h << 13; h ^= h >>> 7; h += h << 3; h ^= h >>> 17; h += h << 5;
    return ((h >>> 0) / 4294967296);
  };
}

function getCharacter(card = {}) {
  return card.character || card.template || card;
}

// ── Gear bonus ────────────────────────────────────────────────────────────────
function applyGearBonus(unit, gearTier = 'COMMON') {
  const tier = normalizeUpper(gearTier);
  const bonus = (battleConfig.gearBonuses || {})[tier];
  if (!bonus) return unit;
  const out = { ...unit };
  out.atk     = Math.floor(out.atk  * (1 + (bonus.atkPct  || 0)));
  out.maxHp   = Math.floor(out.maxHp * (1 + (bonus.hpPct   || 0)));
  out.hp      = Math.floor(out.maxHp);
  out.def     = Math.floor(out.def  * (1 + (bonus.defPct  || 0)));
  out.critRate = clamp(out.critRate + (bonus.critRate || 0), 0, 100);
  out.power   = Math.floor(out.power * (1 + (bonus.power   || 0)));
  return out;
}

// ── Skill tree bonus ──────────────────────────────────────────────────────────
function applySkillBonus(unit, skillTier = 0, coreTier = 0) {
  const sb = battleConfig.skillBonuses?.perTier || {};
  const cb = battleConfig.coreBonuses?.perTier  || {};
  const st = clamp(skillTier, 0, battleConfig.skillBonuses?.maxTier || 10);
  const ct = clamp(coreTier,  0, battleConfig.coreBonuses?.maxTier  || 10);
  const out = { ...unit };
  if (st > 0) {
    out.atk      = Math.floor(out.atk  * (1 + (sb.atkPct  || 0) * st));
    out.maxHp    = Math.floor(out.maxHp * (1 + (sb.hpPct   || 0) * st));
    out.hp       = Math.floor(out.maxHp);
    out.critRate = clamp(out.critRate + (sb.critRate || 0) * st, 0, 100);
    out.effectChance = clamp(out.effectChance + (sb.effectChance || 0) * st, 0, 100);
  }
  if (ct > 0) {
    out.maxHp    = Math.floor(out.maxHp * (1 + (cb.hpPct  || 0) * ct));
    out.hp       = Math.floor(out.maxHp);
    out.def      = Math.floor(out.def  * (1 + (cb.defPct  || 0) * ct));
    out.effectResistance = clamp(out.effectResistance + (cb.effectResistance || 0) * ct, 0, 80);
  }
  return out;
}

// ── Passive effects applied to unit stats ────────────────────────────────────
function applyPassiveToStats(unit, passive = {}) {
  const fx = passive.effect || {};
  const out = { ...unit };

  if (fx.dodge)            out.dodgeChance      = clamp(out.dodgeChance + fx.dodge, 0, 80);
  if (fx.crit)             out.critRate         = clamp(out.critRate    + fx.crit,  0, 95);
  if (fx.critDmg)          out.critDamage       = clamp(out.critDamage  + fx.critDmg, 0, 400);
  if (fx.counter)          out.counterChance    = clamp(out.counterChance + fx.counter, 0, 80);
  if (fx.energyGain)       out.energyGainBonus  = (out.energyGainBonus || 0) + fx.energyGain;
  if (fx.lifesteal)        out.lifesteal        = clamp((out.lifesteal || 0) + fx.lifesteal, 0, 60);
  if (fx.shield)           out.startWithShield  = true;
  if (fx.teamDmg)          out.teamDmgBonus     = (out.teamDmgBonus || 0) + fx.teamDmg;
  if (fx.dmg)              out.dmgBonus         = (out.dmgBonus || 0) + fx.dmg;
  if (fx.bossDmg)          out.bossDmgBonus     = (out.bossDmgBonus || 0) + fx.bossDmg;
  if (fx.heal)             out.healPerTurn      = (out.healPerTurn || 0) + fx.heal;
  if (fx.pen)              out.defPen           = (out.defPen || 0) + fx.pen;
  if (fx.enemyAtk)         out.enemyAtkDebuff   = (out.enemyAtkDebuff || 0) + fx.enemyAtk;
  if (fx.miss)             out.missChanceApply  = (out.missChanceApply || 0) + fx.miss;
  if (fx.execute)          out.executeThreshold = (out.executeThreshold || 0) + fx.execute;
  if (fx.energyDrain)      out.energyDrainChance = (out.energyDrainChance || 0) + fx.energyDrain;
  if (fx.summon)           out.hasSummon        = true;

  // DoT passives → stored as on-hit chance
  if (fx.bleed)   out.onHitBleedChance  = clamp((out.onHitBleedChance  || 0) + fx.bleed,  0, 80);
  if (fx.burn)    out.onHitBurnChance   = clamp((out.onHitBurnChance   || 0) + fx.burn,   0, 80);
  if (fx.poison)  out.onHitPoisonChance = clamp((out.onHitPoisonChance || 0) + fx.poison, 0, 80);
  if (fx.stun)    out.onHitStunChance   = clamp((out.onHitStunChance   || 0) + fx.stun,   0, 60);
  if (fx.silence) out.onHitSilenceChance= clamp((out.onHitSilenceChance|| 0) + fx.silence,0, 60);
  if (fx.freeze)  out.onHitFreezeChance = clamp((out.onHitFreezeChance || 0) + fx.freeze, 0, 60);

  out._passive = passive;
  return out;
}

// ── Main stat derivation ──────────────────────────────────────────────────────
function deriveStats(card = {}) {
  const c = getCharacter(card);
  const level = Number(card.level || 1);
  const power = Number(card.power || c.basePower || c.power || 100);

  const baseHp  = Number(card.hp  || c.hp  || c.baseHp  || Math.floor(power * 2.4));
  const baseAtk = Number(card.atk || c.atk || c.baseAtk || Math.floor(power * 0.42));
  const baseDef = Number(card.def || c.def || c.baseDef || Math.floor(power * 0.22));
  const baseSpd = Number(card.spd || c.spd || c.speed   || 100);

  // Read upgrade tiers - stored in card directly or in card.meta JSON
  const meta      = (card.meta && typeof card.meta === 'object') ? card.meta : {};
  const gearTier  = card.gearTier  || meta.gearTier  || 'COMMON';
  const skillTier = Number(card.skillTier || meta.skillTier || 0);
  const coreTier  = Number(card.coreTier  || meta.coreTier  || 0);

  // Get passive from combat profile
  let passive = null;
  const isCorrupted = String(c.name || '').toLowerCase().includes('corrupted');
  if (combatProfiles) {
    passive = combatProfiles.passiveOf(c);
  }

  let unit = {
    id: card.id || c.id || `${c.name || 'unit'}-${Math.random()}`,
    name: c.name || card.name || 'Unknown',
    anime: c.anime || 'Unknown',
    rarity: normalizeUpper(c.rarity || 'COMMON'),
    variant: c.variant || 'Base',
    role: normalizeUpper(c.role || c.type || card.role || card.type || 'DPS'),
    element: normalizeUpper(c.element || card.element || 'LIGHT'),
    isCorrupted,
    level,
    power,
    maxHp:            Math.max(1, Math.floor(baseHp  + level * 15)),
    hp:               Math.max(1, Math.floor(baseHp  + level * 15)),
    atk:              Math.max(1, Math.floor(baseAtk + level * 4)),
    def:              Math.max(0, Math.floor(baseDef + level * 3)),
    spd:              Math.max(1, Math.floor(baseSpd + level)),
    critRate:         clamp(card.critRate  || c.critRate  || 8,   0, 100),
    critDamage:       clamp(card.critDamage|| c.critDamage|| 50,  0, 400),
    effectChance:     clamp(card.effectChance     || c.effectChance     || 0, 0, 100),
    effectResistance: clamp(card.effectResistance || c.effectResistance || 0, 0, 100),
    dodgeChance:      clamp(card.dodgeChance  || c.dodgeChance  || 3,  0, 80),
    counterChance:    clamp(card.counterChance|| c.counterChance|| 0,  0, 80),
    healingBonus:     clamp(card.healingBonus || c.healingBonus || 0,  0, 300),
    shieldPower:      clamp(card.shieldPower  || c.shieldPower  || 0,  0, 300),
    mana:             Number(card.mana    || c.mana    || 100),
    energy:           Number(card.energy  || battleConfig.battleRules.startingEnergy || 0),
    ultimateBar:      0,
    shield:           0,
    statuses:         [],
    alive:            true,
    // Bonus fields (set by passive/role)
    lifesteal:        0,
    teamDmgBonus:     0,
    dmgBonus:         0,
    bossDmgBonus:     0,
    healPerTurn:      0,
    defPen:           0,
    enemyAtkDebuff:   0,
    missChanceApply:  0,
    executeThreshold: 0,
    energyDrainChance:0,
    energyGainBonus:  0,
    onHitBleedChance: 0,
    onHitBurnChance:  0,
    onHitPoisonChance:0,
    onHitStunChance:  0,
    onHitSilenceChance:0,
    onHitFreezeChance:0,
    hasSummon:        false,
    startWithShield:  false
  };

  // Corrupted gets +25% base stats on top of everything
  if (isCorrupted) {
    unit.maxHp = Math.floor(unit.maxHp * 1.25);
    unit.hp    = unit.maxHp;
    unit.atk   = Math.floor(unit.atk   * 1.25);
    unit.def   = Math.floor(unit.def   * 1.25);
    unit.spd   = Math.floor(unit.spd   * 1.10);
  }

  // Apply passive to stats
  if (passive) unit = applyPassiveToStats(unit, passive);

  // Apply gear
  unit = applyGearBonus(unit, gearTier);

  // Apply skill tree
  unit = applySkillBonus(unit, skillTier, coreTier);

  // Shield from passive
  if (unit.startWithShield) {
    unit.shield = Math.floor(unit.maxHp * 0.18);
  }

  return unit;
}

function applyRoleBonus(unit) {
  const roleInfo = battleConfig.roles[unit.role];
  if (!roleInfo || !roleInfo.bonus) return unit;
  const out = { ...unit };
  for (const [stat, bonus] of Object.entries(roleInfo.bonus)) {
    if (stat === 'hp') {
      out.maxHp = Math.floor(out.maxHp * (1 + bonus));
      out.hp    = out.maxHp;
    } else if (stat in out) {
      if (typeof out[stat] === 'number') {
        out[stat] = Math.floor(out[stat] * (1 + bonus));
      }
    } else {
      out[stat] = bonus;
    }
  }
  return out;
}

function buildBattleUnit(card = {}) {
  return applyRoleBonus(deriveStats(card));
}

// ── Element advantage ─────────────────────────────────────────────────────────
function isElementAdvantage(attackerElement, defenderElement) {
  const atk = normalizeUpper(attackerElement);
  const def = normalizeUpper(defenderElement);
  const advantages = (battleConfig.elementRules?.advantages || {})[atk] || [];
  return advantages.includes(def);
}

// ── Damage calculation ────────────────────────────────────────────────────────
function calculateDamage(attacker, defender, options = {}, rand = Math.random) {
  if (!attacker.alive || !defender.alive) return { damage: 0, crit: false, dodged: false, elementAdvantage: false };

  // Miss chance (from passives like Aizen's Kyoka Suigetsu)
  if (defender.missChanceApply && (rand() * 100) < defender.missChanceApply) {
    return { damage: 0, crit: false, dodged: true, elementAdvantage: false, missed: true };
  }

  // Dodge
  if ((rand() * 100) < defender.dodgeChance && !options.cannotDodge) {
    return { damage: 0, crit: false, dodged: true, elementAdvantage: false };
  }

  // DEF penetration from passives
  const defValue = Math.max(0, defender.def * (1 - (attacker.defPen || 0) / 100));
  const raw = Math.max(1, attacker.atk - Math.floor(defValue * 0.45));

  let multiplier = Number(options.multiplier || 1);

  // DMG bonus from passive
  if (attacker.dmgBonus) multiplier += attacker.dmgBonus / 100;

  // Boss DMG bonus
  if (options.isBoss && attacker.bossDmgBonus) multiplier += attacker.bossDmgBonus / 100;

  // Element advantage
  const elementAdvantage = isElementAdvantage(attacker.element, defender.element);
  if (elementAdvantage) multiplier += battleConfig.elementRules.advantageDamageBonus || 0.18;
  if (attacker.element === 'VOID') multiplier += battleConfig.elementRules.voidDamageBonus || 0.10;

  // Crit
  const crit = (rand() * 100) < attacker.critRate;
  if (crit) multiplier *= (1 + (attacker.critDamage / 100));

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
  if (out.hp <= 0) { out.alive = false; out.hp = 0; }
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
  const bonus = 1 + (out.energyGainBonus || 0) / 100;
  out.energy = clamp(Number(out.energy || 0) + Math.floor(Number(amount || 0) * bonus), 0, max);
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
  if ((rand() * 100) > finalChance) return { target, applied: false, reason: 'resisted' };

  const out = { ...target, statuses: [...(target.statuses || [])] };
  const turns = Number(options.turns || status.defaultTurns || 1);
  if (!status.stackable) out.statuses = out.statuses.filter(s => s.name !== statusKey);
  out.statuses.push({ name: statusKey, turns, power: Number(options.power || source.atk || 0), sourceId: source.id || null });
  return { target: out, applied: true, reason: 'applied' };
}

function processStatusStart(unit) {
  let out = { ...unit, statuses: [...(unit.statuses || [])] };
  const logs = [];
  for (const status of out.statuses) {
    if (status.name === 'bleed') {
      const dmg = Math.max(1, Math.floor((status.power || out.atk || 1) * 0.18));
      out = applyDamage(out, dmg);
      logs.push(`${out.name} 🩸 ${dmg} bleed.`);
    }
    if (status.name === 'burn') {
      const dmg = Math.max(1, Math.floor((status.power || out.atk || 1) * 0.14));
      out = applyDamage(out, dmg);
      logs.push(`${out.name} 🔥 ${dmg} burn.`);
    }
    if (status.name === 'poison') {
      const dmg = Math.max(1, Math.floor((status.power || out.atk || 1) * 0.12));
      out = applyDamage(out, dmg);
      logs.push(`${out.name} ☠️ ${dmg} poison.`);
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
  if (statuses.some(s => s.name === 'stun'))   return { skipped: true, reason: 'stun' };
  if (statuses.some(s => s.name === 'freeze') && rand() < 0.60) return { skipped: true, reason: 'freeze' };
  return { skipped: false, reason: null };
}

function chooseTarget(enemies = [], attacker = {}) {
  const alive = enemies.filter(e => e.alive);
  if (!alive.length) return null;
  // TANKs taunt → prioritize them
  const tanks = alive.filter(e => e.role === 'TANK');
  const roleInfo = battleConfig.roles['TANK'] || {};
  if (tanks.length && (Math.random() < (roleInfo.tauntChance || 0.55))) {
    return tanks.sort((a, b) => (b.hp / b.maxHp) - (a.hp / a.maxHp))[0];
  }
  // Assassins target lowest HP
  if (attacker.role === 'ASSASSIN') {
    return alive.sort((a, b) => a.hp - b.hp)[0];
  }
  // Default: lowest HP %
  return alive.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
}

function formationAlive(team = []) {
  return team.some(u => u.alive);
}

// ── Role-specific actions ─────────────────────────────────────────────────────
function roleAction(actor, currentTeam, enemyTeam, rand, logs) {
  const role = actor.role;
  const roleInfo = battleConfig.roles[role] || {};

  // HEALER → heal lowest HP ally every turn
  if (role === 'HEALER') {
    const aliveAllies = currentTeam.filter(u => u.alive && u.id !== actor.id);
    if (aliveAllies.length) {
      const target = aliveAllies.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      const healAmt = Math.floor(target.maxHp * (roleInfo.healPerTurn || 0.08) * (1 + (actor.healingBonus || 0) / 100));
      const idx = currentTeam.findIndex(u => u.id === target.id);
      if (idx >= 0) {
        currentTeam[idx] = healUnit(currentTeam[idx], healAmt);
        logs.push(`💚 ${actor.name} heals ${target.name} for ${healAmt}.`);
      }
    }
    // HEALER also cleanses debuffs
    if (rand() < (roleInfo.cleanseChance || 0.70)) {
      for (let i = 0; i < currentTeam.length; i++) {
        if (currentTeam[i].alive) {
          const before = currentTeam[i].statuses.length;
          currentTeam[i] = { ...currentTeam[i], statuses: currentTeam[i].statuses.filter(s => !['bleed','burn','poison','stun','freeze','silence'].includes(s.name)) };
          if (currentTeam[i].statuses.length < before) logs.push(`✨ ${actor.name} cleanses ${currentTeam[i].name}.`);
        }
      }
    }
  }

  // SUPPORT → buff ATK for team
  if (role === 'SUPPORT') {
    const buff = roleInfo.teamBuffOnTurn;
    if (buff && rand() < 0.55) {
      for (let i = 0; i < currentTeam.length; i++) {
        if (currentTeam[i].alive && currentTeam[i].id !== actor.id) {
          const boost = Math.floor(currentTeam[i].atk * (buff.atkPct || 0.08));
          currentTeam[i] = { ...currentTeam[i], atk: currentTeam[i].atk + boost };
        }
      }
      logs.push(`⚡ ${actor.name} boosts team ATK!`);
    }
    // Support cleanses occasionally
    if (rand() < (roleInfo.cleanseChance || 0.40)) {
      for (let i = 0; i < currentTeam.length; i++) {
        if (currentTeam[i].alive) {
          currentTeam[i] = { ...currentTeam[i], statuses: currentTeam[i].statuses.filter(s => !['bleed','burn','poison'].includes(s.name)) };
        }
      }
    }
  }

  // TANK → reduce enemy ATK via passive enemyAtkDebuff
  if (role === 'TANK' && actor.enemyAtkDebuff) {
    for (let i = 0; i < enemyTeam.length; i++) {
      if (enemyTeam[i].alive) {
        const reduction = Math.floor(enemyTeam[i].atk * Math.abs(actor.enemyAtkDebuff) / 100);
        enemyTeam[i] = { ...enemyTeam[i], atk: Math.max(1, enemyTeam[i].atk - reduction) };
      }
    }
  }
}

// ── On-hit passive effects ────────────────────────────────────────────────────
function applyOnHitPassives(attacker, target, rand, logs) {
  let t = { ...target };

  if (attacker.onHitBleedChance   && rand() * 100 < attacker.onHitBleedChance)   { const r = applyStatus(t, 'bleed',   attacker, {}, rand); if (r.applied) { t = r.target; logs.push(`🩸 ${target.name} bleeds!`); } }
  if (attacker.onHitBurnChance    && rand() * 100 < attacker.onHitBurnChance)    { const r = applyStatus(t, 'burn',    attacker, {}, rand); if (r.applied) { t = r.target; logs.push(`🔥 ${target.name} burns!`); } }
  if (attacker.onHitPoisonChance  && rand() * 100 < attacker.onHitPoisonChance)  { const r = applyStatus(t, 'poison',  attacker, {}, rand); if (r.applied) { t = r.target; logs.push(`☠️ ${target.name} poisoned!`); } }
  if (attacker.onHitStunChance    && rand() * 100 < attacker.onHitStunChance)    { const r = applyStatus(t, 'stun',    attacker, {}, rand); if (r.applied) { t = r.target; logs.push(`💫 ${target.name} stunned!`); } }
  if (attacker.onHitSilenceChance && rand() * 100 < attacker.onHitSilenceChance) { const r = applyStatus(t, 'silence', attacker, {}, rand); if (r.applied) { t = r.target; logs.push(`🔇 ${target.name} silenced!`); } }
  if (attacker.onHitFreezeChance  && rand() * 100 < attacker.onHitFreezeChance)  { const r = applyStatus(t, 'freeze',  attacker, {}, rand); if (r.applied) { t = r.target; logs.push(`❄️ ${target.name} frozen!`); } }

  // Energy drain
  if (attacker.energyDrainChance && rand() * 100 < attacker.energyDrainChance) {
    const drain = 15;
    t = { ...t, energy: Math.max(0, (t.energy || 0) - drain) };
    logs.push(`🌀 ${attacker.name} drains ${drain} energy from ${target.name}.`);
  }

  return t;
}

// ── Main battle loop ──────────────────────────────────────────────────────────
function runBasicBattle(teamAInput = [], teamBInput = [], options = {}) {
  const rand = rng(options.seed || Date.now());

  let teamA = teamAInput.map(buildBattleUnit);
  let teamB = teamBInput.map(buildBattleUnit);

  const logs = [];
  const maxTurns = Number(options.maxTurns || battleConfig.battleRules.maxTurns || 30);

  for (let turn = 1; turn <= maxTurns; turn++) {
    logs.push(`── Turn ${turn} ──`);

    const allUnits = [
      ...teamA.map((u, idx) => ({ ...u, side: 'A', idx })),
      ...teamB.map((u, idx) => ({ ...u, side: 'B', idx }))
    ].filter(u => u.alive).sort((a, b) => b.spd - a.spd || rand() - 0.5);

    for (const actorRef of allUnits) {
      const currentTeam = actorRef.side === 'A' ? teamA : teamB;
      const enemyTeam   = actorRef.side === 'A' ? teamB : teamA;
      let actor = currentTeam[actorRef.idx];
      if (!actor || !actor.alive) continue;

      // Heal per turn (passive)
      if (actor.healPerTurn && actor.healPerTurn > 0) {
        const hpt = Math.floor(actor.maxHp * actor.healPerTurn / 100);
        actor = healUnit(actor, hpt);
        if (hpt > 0) logs.push(`💚 ${actor.name} regens ${hpt} HP.`);
      }

      // Status damage start of turn
      const statusStart = processStatusStart(actor);
      actor = statusStart.unit;
      logs.push(...statusStart.logs);
      if (!actor.alive) { currentTeam[actorRef.idx] = actor; continue; }

      // Role actions (heal, buff, debuff)
      roleAction(actor, currentTeam, enemyTeam, rand, logs);

      // Turn skip check
      const skip = isTurnSkipped(actor, rand);
      if (skip.skipped) {
        logs.push(`${actor.name} skipped (${skip.reason}).`);
        currentTeam[actorRef.idx] = processStatusEnd(actor);
        continue;
      }

      // Pick target
      const targetIndex = enemyTeam.findIndex(e => e.alive && e.id === (chooseTarget(enemyTeam, actor) || {}).id);
      if (targetIndex < 0) continue;

      let target = enemyTeam[targetIndex];
      const hit = calculateDamage(actor, target, { isBoss: options.isBoss }, rand);

      if (hit.dodged || hit.missed) {
        logs.push(`${target.name} ${hit.missed ? 'evades illusion' : 'dodges'} ${actor.name}'s attack.`);
        actor = addEnergy(actor, battleConfig.battleRules.energyOnAttack || 18);
      } else {
        target = applyDamage(target, hit.damage);

        // Lifesteal
        if (actor.lifesteal && actor.lifesteal > 0) {
          const steal = Math.floor(hit.damage * actor.lifesteal / 100);
          actor = healUnit(actor, steal);
        }

        actor  = addEnergy(actor,  battleConfig.battleRules.energyOnAttack  || 18);
        target = addEnergy(target, battleConfig.battleRules.energyOnHitTaken || 10);
        if (hit.crit) actor = addEnergy(actor, battleConfig.battleRules.energyOnCrit || 8);

        const extras = [];
        if (hit.crit)            extras.push('CRIT');
        if (hit.elementAdvantage) extras.push('Element Advantage');
        if (actor.isCorrupted)   extras.push('⚫CORRUPTED');
        logs.push(`${actor.name} → ${target.name}: ${hit.damage}${extras.length ? ' ['+extras.join(' | ')+']' : ''}`);

        if (!target.alive) {
          actor = addEnergy(actor, battleConfig.battleRules.energyOnKill || 25);
          logs.push(`💀 ${target.name} defeated.`);
        } else {
          // On-hit passive effects
          target = applyOnHitPassives(actor, target, rand, logs);

          // Counter attack (TANK passive)
          if ((rand() * 100) < target.counterChance) {
            const counter = calculateDamage(target, actor, { multiplier: 0.55 }, rand);
            actor = applyDamage(actor, counter.damage);
            logs.push(`↩️ ${target.name} counters for ${counter.damage}.`);
          }

          // Execute low HP enemies (ASSASSIN/DPS passive)
          const execThresh = actor.executeThreshold || 0;
          if (execThresh > 0 && (target.hp / target.maxHp) * 100 < execThresh) {
            target = { ...target, hp: 0, alive: false };
            logs.push(`⚡ ${actor.name} EXECUTES ${target.name}!`);
          }
        }
      }

      currentTeam[actorRef.idx] = processStatusEnd(actor);
      enemyTeam[targetIndex]    = processStatusEnd(target);

      if (!formationAlive(teamA) || !formationAlive(teamB)) break;
    }

    if (!formationAlive(teamA) || !formationAlive(teamB)) break;

    // Enrage
    if (turn === (battleConfig.battleRules.enrageTurn || 20)) {
      logs.push('⚠️ ENRAGE — all damage increases.');
      teamA = teamA.map(u => ({ ...u, atk: Math.floor(u.atk * 1.15) }));
      teamB = teamB.map(u => ({ ...u, atk: Math.floor(u.atk * 1.15) }));
    }
  }

  const winner = formationAlive(teamA) && !formationAlive(teamB) ? 'A'
    : formationAlive(teamB) && !formationAlive(teamA) ? 'B' : 'DRAW';

  return { winner, teamA, teamB, logs: logs.slice(0, options.maxLogs || 80) };
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
  clamp, normalizeUpper, rng,
  deriveStats, applyRoleBonus, buildBattleUnit,
  isElementAdvantage, calculateDamage,
  applyDamage, healUnit, addShield, addEnergy,
  applyStatus, processStatusStart, processStatusEnd,
  isTurnSkipped, chooseTarget, formationAlive,
  runBasicBattle, formatBattleResult,
  applyGearBonus, applySkillBonus, applyPassiveToStats
};
