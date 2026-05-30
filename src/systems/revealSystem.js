// VoidRoll Reborn - Phase 11 Secret / Voidborn Reveal System
// Bottom-up reveal foundation for SECRET and VOIDBORN cards.
// Audio is intentionally disabled for now.

const revealConfig = require('../config/reveal_config.json');

function normalizeUpper(value, fallback = 'COMMON') {
  const out = String(value || fallback).trim().toUpperCase();
  return out || fallback;
}

function cleanText(value, fallback = 'Unknown') {
  const out = String(value || '').trim();
  return out || fallback;
}

function getCharacter(cardOrCharacter = {}) {
  return cardOrCharacter.character || cardOrCharacter.template || cardOrCharacter;
}

function getRevealType(character = {}) {
  const rarity = normalizeUpper(character.rarity || 'COMMON');
  return revealConfig.rarityRevealTypes[rarity] || 'NORMAL';
}

function isCinematicReveal(character = {}) {
  const type = getRevealType(character);
  return ['SECRET_BOTTOM_UP', 'VOIDBORN_BOTTOM_UP', 'DIVINE_REVEAL'].includes(type);
}

function isBottomUpReveal(character = {}) {
  const type = getRevealType(character);
  return type === 'SECRET_BOTTOM_UP' || type === 'VOIDBORN_BOTTOM_UP';
}

function getRevealSteps(character = {}) {
  const type = getRevealType(character);
  return revealConfig.revealSteps[type] || [];
}

function getVariantTheme(character = {}) {
  const variant = cleanText(character.variant || 'Base', 'Base');
  return revealConfig.variants[variant] || revealConfig.variants.Base;
}

function getRevealQuote(character = {}) {
  const name = cleanText(character.name, 'Unknown');
  const variant = cleanText(character.variant || 'Base', 'Base');
  const variantName = variant === 'Base' ? name : `${variant} ${name}`;

  return character.revealQuote
    || character.quote
    || revealConfig.defaultQuotes[variantName]
    || revealConfig.defaultQuotes[name]
    || revealConfig.defaultQuotes[normalizeUpper(character.rarity)]
    || revealConfig.defaultQuotes.Secret;
}

function getFrame(character = {}) {
  const rarity = normalizeUpper(character.rarity || 'COMMON');
  return revealConfig.frames[rarity] || {
    name: `${rarity} Frame`,
    color: '#5865F2',
    accent: '#FFFFFF',
    emoji: '◻️'
  };
}

function getAura(character = {}) {
  const element = normalizeUpper(character.element || 'LIGHT');
  return revealConfig.auraThemes[element] || revealConfig.auraThemes.LIGHT;
}

function buildRevealPayload(cardOrCharacter = {}) {
  const character = getCharacter(cardOrCharacter);
  const rarity = normalizeUpper(character.rarity || 'COMMON');
  const variant = cleanText(character.variant || 'Base', 'Base');
  const revealType = getRevealType(character);
  const frame = getFrame(character);
  const aura = getAura(character);
  const quote = getRevealQuote(character);
  const steps = getRevealSteps(character);
  const variantTheme = getVariantTheme(character);

  return {
    revealType,
    isCinematic: isCinematicReveal(character),
    isBottomUp: isBottomUpReveal(character),
    quote,
    steps,
    frame,
    aura,
    variantTheme,
    character: {
      id: character.id || cardOrCharacter.characterId || null,
      name: cleanText(character.name),
      variant,
      displayName: variant === 'Base' ? cleanText(character.name) : `${variant} ${cleanText(character.name)}`,
      anime: cleanText(character.anime, 'Unknown Anime'),
      rarity,
      element: normalizeUpper(character.element || 'LIGHT'),
      role: normalizeUpper(character.role || character.type || 'DPS'),
      power: Number(cardOrCharacter.power || character.basePower || character.power || 0),
      imageUrl: character.imageUrl || cardOrCharacter.imageUrl || null,
      lore: character.lore || null,
      passive: character.passive || character.passiveName || character.passiveAbility || null
    }
  };
}

function formatQuoteReveal(payload = {}) {
  const c = payload.character || {};
  const frame = payload.frame || {};

  return [
    `${frame.emoji || '🌠'} **${payload.revealType || 'REVEAL'}**`,
    '',
    `_${payload.quote || 'A presence awakens.'}_`,
    '',
    `**${c.displayName || c.name || 'Unknown'}** is emerging...`
  ].join('\n');
}

function formatFinalReveal(payload = {}) {
  const c = payload.character || {};
  const frame = payload.frame || {};
  const aura = payload.aura || {};
  const steps = (payload.steps || []).map(s => `${s.step}. ${s.title}`).join(' → ');

  return [
    `${frame.emoji || '🌠'} **${c.rarity || 'SECRET'} REVEAL**`,
    `**${c.displayName || c.name || 'Unknown'}**`,
    `Anime: **${c.anime || 'Unknown'}**`,
    `Element: **${c.element || 'UNKNOWN'}** | Role: **${c.role || 'UNKNOWN'}**`,
    `Power: **${Number(c.power || 0).toLocaleString()}**`,
    `Frame: **${frame.name || 'Frame'}**`,
    `Aura: **${aura.name || 'Aura'}**`,
    '',
    `Quote: _${payload.quote || ''}_`,
    '',
    steps ? `Reveal Flow: ${steps}` : ''
  ].filter(Boolean).join('\n');
}

function getDiscordRevealPlan(cardOrCharacter = {}) {
  const payload = buildRevealPayload(cardOrCharacter);

  if (!payload.isCinematic) {
    return {
      cinematic: false,
      payload,
      messages: [
        {
          type: 'final',
          content: formatFinalReveal(payload)
        }
      ]
    };
  }

  const messages = [];

  if (revealConfig.discordBehavior.sendQuoteEmbedFirst) {
    messages.push({
      type: 'quote',
      delayMs: 0,
      content: formatQuoteReveal(payload)
    });
  }

  messages.push({
    type: 'final',
    delayMs: revealConfig.discordBehavior.delayMsBetweenQuoteAndCard || 1200,
    content: formatFinalReveal(payload),
    imageUrl: payload.character.imageUrl || null
  });

  return {
    cinematic: true,
    payload,
    messages
  };
}

function formatRevealStoryboard(character = {}) {
  const payload = buildRevealPayload(character);
  const steps = payload.steps || [];

  if (!steps.length) return `${payload.character.displayName} uses normal reveal.`;

  return [
    `🎬 **${payload.character.displayName} Reveal Storyboard**`,
    `Type: **${payload.revealType}**`,
    `Quote: _${payload.quote}_`,
    '',
    ...steps.map(step => `**${step.step}. ${step.title}** — ${step.description}`)
  ].join('\n');
}

function shouldUseSecretPoster(character = {}) {
  const rarity = normalizeUpper(character.rarity || 'COMMON');
  return rarity === 'SECRET' || rarity === 'VOIDBORN';
}

module.exports = {
  normalizeUpper,
  cleanText,
  getCharacter,
  getRevealType,
  isCinematicReveal,
  isBottomUpReveal,
  getRevealSteps,
  getVariantTheme,
  getRevealQuote,
  getFrame,
  getAura,
  buildRevealPayload,
  formatQuoteReveal,
  formatFinalReveal,
  getDiscordRevealPlan,
  formatRevealStoryboard,
  shouldUseSecretPoster
};
