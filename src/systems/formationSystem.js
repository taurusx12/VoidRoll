// VoidRoll Reborn - Phase 8 Formation System
// Player can manage up to 6 formations, each with 6 characters.
// Duplicate copies are allowed, but the same exact card instance cannot be used twice.

const formationConfig = require('../config/formation_story_config.json');

const MAX_FORMATIONS = formationConfig.formationRules.maxFormations || 6;
const SLOTS_PER_FORMATION = formationConfig.formationRules.charactersPerFormation || 6;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value || 0)));
}

function createEmptyFormations() {
  return Array.from({ length: MAX_FORMATIONS }, (_, index) => ({
    index: index + 1,
    leaderSlot: 1,
    slots: Array.from({ length: SLOTS_PER_FORMATION }, (_, slotIndex) => ({
      slot: slotIndex + 1,
      cardId: null
    }))
  }));
}

function normalizeFormations(formations) {
  if (!Array.isArray(formations) || formations.length === 0) return createEmptyFormations();

  const empty = createEmptyFormations();

  for (let i = 0; i < Math.min(formations.length, MAX_FORMATIONS); i++) {
    const src = formations[i] || {};
    empty[i].leaderSlot = clamp(src.leaderSlot || 1, 1, SLOTS_PER_FORMATION);

    const srcSlots = Array.isArray(src.slots) ? src.slots : [];
    for (let s = 0; s < Math.min(srcSlots.length, SLOTS_PER_FORMATION); s++) {
      empty[i].slots[s].cardId = srcSlots[s]?.cardId || srcSlots[s] || null;
    }
  }

  return empty;
}

function getUsedCardIds(formations = []) {
  const ids = new Set();
  const normalized = normalizeFormations(formations);

  for (const formation of normalized) {
    for (const slot of formation.slots) {
      if (slot.cardId) ids.add(String(slot.cardId));
    }
  }

  return ids;
}

function validateNoDuplicateCardInstance(formations = []) {
  const seen = new Map();
  const duplicates = [];
  const normalized = normalizeFormations(formations);

  for (const formation of normalized) {
    for (const slot of formation.slots) {
      if (!slot.cardId) continue;
      const id = String(slot.cardId);
      if (seen.has(id)) {
        duplicates.push({
          cardId: id,
          first: seen.get(id),
          second: { formation: formation.index, slot: slot.slot }
        });
      } else {
        seen.set(id, { formation: formation.index, slot: slot.slot });
      }
    }
  }

  return {
    valid: duplicates.length === 0,
    duplicates
  };
}

function setFormationSlot(formations = [], teamIndex = 1, slotIndex = 1, cardId = null) {
  const normalized = normalizeFormations(formations);
  const team = clamp(teamIndex, 1, MAX_FORMATIONS) - 1;
  const slot = clamp(slotIndex, 1, SLOTS_PER_FORMATION) - 1;

  normalized[team].slots[slot].cardId = cardId ? String(cardId) : null;

  const validation = validateNoDuplicateCardInstance(normalized);
  if (!validation.valid) {
    normalized[team].slots[slot].cardId = null;
    return {
      formations: normalized,
      ok: false,
      reason: 'same_card_instance_used_twice',
      validation
    };
  }

  return {
    formations: normalized,
    ok: true,
    reason: 'updated',
    validation
  };
}

function clearFormationSlot(formations = [], teamIndex = 1, slotIndex = 1) {
  return setFormationSlot(formations, teamIndex, slotIndex, null);
}

function setLeaderSlot(formations = [], teamIndex = 1, leaderSlot = 1) {
  const normalized = normalizeFormations(formations);
  const team = clamp(teamIndex, 1, MAX_FORMATIONS) - 1;
  normalized[team].leaderSlot = clamp(leaderSlot, 1, SLOTS_PER_FORMATION);
  return normalized;
}

function getFormation(formations = [], teamIndex = 1) {
  const normalized = normalizeFormations(formations);
  return normalized[clamp(teamIndex, 1, MAX_FORMATIONS) - 1];
}

function getActiveFormations(formations = [], requiredCount = 1) {
  const normalized = normalizeFormations(formations);
  return normalized.slice(0, clamp(requiredCount, 1, MAX_FORMATIONS));
}

function isFormationComplete(formation = {}) {
  return Array.isArray(formation.slots)
    && formation.slots.length === SLOTS_PER_FORMATION
    && formation.slots.every(slot => Boolean(slot.cardId));
}

function validateRequiredFormations(formations = [], requiredCount = 1) {
  const active = getActiveFormations(formations, requiredCount);
  const incomplete = [];

  for (const formation of active) {
    if (!isFormationComplete(formation)) {
      incomplete.push(formation.index);
    }
  }

  const duplicateValidation = validateNoDuplicateCardInstance(active);

  return {
    valid: incomplete.length === 0 && duplicateValidation.valid,
    requiredCount,
    incomplete,
    duplicateValidation
  };
}

function formatFormations(formations = [], requiredCount = MAX_FORMATIONS) {
  const normalized = normalizeFormations(formations);
  const lines = [];

  for (const formation of normalized) {
    const locked = formation.index > requiredCount;
    const title = locked ? `🔒 Formation ${formation.index}` : `⚔️ Formation ${formation.index}`;
    const slotLines = formation.slots.map(slot => {
      const leader = slot.slot === formation.leaderSlot ? ' 👑' : '';
      return `Slot ${slot.slot}${leader}: ${slot.cardId ? `Card ${slot.cardId}` : 'Empty'}`;
    });

    lines.push(`**${title}**\n${slotLines.join('\n')}`);
  }

  return lines.join('\n\n');
}

module.exports = {
  MAX_FORMATIONS,
  SLOTS_PER_FORMATION,
  clamp,
  createEmptyFormations,
  normalizeFormations,
  getUsedCardIds,
  validateNoDuplicateCardInstance,
  setFormationSlot,
  clearFormationSlot,
  setLeaderSlot,
  getFormation,
  getActiveFormations,
  isFormationComplete,
  validateRequiredFormations,
  formatFormations
};
