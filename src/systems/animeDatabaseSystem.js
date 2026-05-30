// VoidRoll Reborn - Phase 6 Anime Database System
// Search by anime, collection completion, character database, who-has foundation.
// No Stars, no Fusion, no character-specific shards.

const animeDbConfig = require('../config/anime_database_config.json');

function cleanText(value, fallback = 'Unknown') {
  const text = String(value || '').trim();
  return text.length ? text : fallback;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeKey(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, '');
}

function matches(value, query) {
  if (!query) return true;
  return normalize(value).includes(normalize(query));
}

function characterKey(character = {}) {
  const name = character.name || '';
  const variant = character.variant || 'Base';
  const anime = character.anime || '';
  return `${normalizeKey(anime)}:${normalizeKey(name)}:${normalizeKey(variant)}`;
}

function filterCharactersByAnime(characters = [], animeName = '') {
  return characters.filter(c => matches(c.anime, animeName));
}

function findCharacters(characters = [], query = '') {
  const q = normalize(query);
  return characters.filter(c => {
    return normalize(c.name).includes(q)
      || normalize(c.anime).includes(q)
      || normalize(c.variant || 'Base').includes(q)
      || normalize(c.rarity).includes(q);
  });
}

function groupCharactersByAnime(characters = []) {
  const map = new Map();

  for (const c of characters) {
    const anime = cleanText(c.anime, 'Unknown Anime');
    if (!map.has(anime)) {
      map.set(anime, {
        anime,
        total: 0,
        rarities: {},
        variants: 0,
        characters: []
      });
    }

    const row = map.get(anime);
    row.total += 1;
    row.rarities[c.rarity || 'COMMON'] = (row.rarities[c.rarity || 'COMMON'] || 0) + 1;
    if ((c.variant || 'Base') !== 'Base') row.variants += 1;
    row.characters.push(c);
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

function getAnimeSummary(characters = [], animeName = '') {
  const filtered = filterCharactersByAnime(characters, animeName);
  const rarities = {};
  const roles = {};
  const elements = {};

  for (const c of filtered) {
    rarities[c.rarity || 'COMMON'] = (rarities[c.rarity || 'COMMON'] || 0) + 1;
    const role = c.role || c.type || 'UNKNOWN';
    roles[role] = (roles[role] || 0) + 1;
    const element = c.element || 'UNKNOWN';
    elements[element] = (elements[element] || 0) + 1;
  }

  return {
    anime: animeName,
    totalCharacters: filtered.length,
    rarities,
    roles,
    elements,
    characters: filtered
  };
}

function getOwnedUniqueByAnime(ownedCards = [], animeName = '') {
  const owned = new Map();

  for (const card of ownedCards) {
    const character = card.character || card.template || card;
    if (!matches(character.anime, animeName)) continue;
    owned.set(characterKey(character), character);
  }

  return [...owned.values()];
}

function getAnimeCompletion(allCharacters = [], ownedCards = [], animeName = '') {
  const total = filterCharactersByAnime(allCharacters, animeName);
  const ownedUnique = getOwnedUniqueByAnime(ownedCards, animeName);

  const totalKeys = new Set(total.map(characterKey));
  const ownedKeys = new Set(ownedUnique.map(characterKey));

  let ownedCount = 0;
  for (const key of ownedKeys) {
    if (totalKeys.has(key)) ownedCount += 1;
  }

  const totalCount = totalKeys.size || total.length;
  const percent = totalCount ? Math.floor((ownedCount / totalCount) * 100) : 0;

  return {
    anime: animeName,
    owned: ownedCount,
    total: totalCount,
    percent,
    nextMilestone: getNextMilestone(percent),
    ownedCharacters: ownedUnique
  };
}

function getNextMilestone(percent = 0) {
  return animeDbConfig.completionMilestones.find(m => Number(m.percent) > Number(percent)) || null;
}

function formatAnimeSummary(summary = {}) {
  const rarityLines = Object.entries(summary.rarities || {})
    .map(([rarity, count]) => `- ${rarity}: ${count}`)
    .join('\n') || '- No rarity data';

  const roleLines = Object.entries(summary.roles || {})
    .map(([role, count]) => `- ${role}: ${count}`)
    .join('\n') || '- No role data';

  const elementLines = Object.entries(summary.elements || {})
    .map(([element, count]) => `- ${element}: ${count}`)
    .join('\n') || '- No element data';

  return [
    `📚 **${cleanText(summary.anime)} Database**`,
    `Characters: **${summary.totalCharacters || 0}**`,
    '',
    '**Rarities**',
    rarityLines,
    '',
    '**Roles**',
    roleLines,
    '',
    '**Elements**',
    elementLines
  ].join('\n');
}

function formatAnimeCompletion(completion = {}) {
  const next = completion.nextMilestone
    ? `Next: **${completion.nextMilestone.percent}%** — ${completion.nextMilestone.reward}`
    : 'All milestones completed.';

  return [
    `🏆 **${cleanText(completion.anime)} Collection**`,
    `Completion: **${completion.percent || 0}%**`,
    `Owned: **${completion.owned || 0}/${completion.total || 0}**`,
    next
  ].join('\n');
}

function formatCharacterDatabaseEntry(character = {}) {
  const variant = cleanText(character.variant || 'Base', 'Base');
  const role = cleanText(character.role || character.type || 'Unknown');
  const element = cleanText(character.element || 'Unknown');
  const passive = cleanText(character.passive || character.passiveName || character.passiveAbility, 'No passive data yet.');
  const leader = character.leaderPassive ? `\nLeader Passive: ${character.leaderPassive}` : '';
  const collection = character.collectionPassive ? `\nCollection Passive: ${character.collectionPassive}` : '';
  const lore = character.lore ? `\n\n**Lore**\n${character.lore}` : '';

  return [
    `📖 **${cleanText(character.name)}**`,
    `Variant: **${variant}**`,
    `Anime: **${cleanText(character.anime)}**`,
    `Rarity: **${cleanText(character.rarity)}**`,
    `Element: **${element}**`,
    `Role: **${role}**`,
    `Base Power: **${Number(character.basePower || character.power || 0).toLocaleString()}**`,
    '',
    '**Passive**',
    passive + leader + collection,
    lore
  ].join('\n');
}

function buildWhoHasResults(cards = [], characterName = '', maxResults = animeDbConfig.whoHasRules.maxResults) {
  const rows = [];

  for (const card of cards) {
    const character = card.character || card.template || card;
    if (!matches(character.name, characterName)) continue;

    rows.push({
      userId: card.userId || card.ownerId || card.user?.id || null,
      username: card.username || card.user?.username || 'Unknown Player',
      characterName: character.name,
      variant: character.variant || 'Base',
      rarity: character.rarity || 'UNKNOWN',
      level: card.level || 1,
      power: card.power || character.basePower || 0
    });
  }

  return rows
    .sort((a, b) => Number(b.power || 0) - Number(a.power || 0))
    .slice(0, maxResults);
}

function formatWhoHasResults(results = [], characterName = '') {
  if (!results.length) {
    return `🔍 No owners found for **${cleanText(characterName)}** in this scope.`;
  }

  const lines = results.map((r, index) => {
    return `**${index + 1}. ${r.username}** — ${r.characterName} (${r.variant}) • ${r.rarity} • Lv.${r.level} • PWR ${Number(r.power || 0).toLocaleString()}`;
  });

  return [
    `🔍 **Who Has: ${cleanText(characterName)}**`,
    ...lines
  ].join('\n');
}

module.exports = {
  cleanText,
  normalize,
  normalizeKey,
  matches,
  characterKey,
  filterCharactersByAnime,
  findCharacters,
  groupCharactersByAnime,
  getAnimeSummary,
  getOwnedUniqueByAnime,
  getAnimeCompletion,
  getNextMilestone,
  formatAnimeSummary,
  formatAnimeCompletion,
  formatCharacterDatabaseEntry,
  buildWhoHasResults,
  formatWhoHasResults
};
