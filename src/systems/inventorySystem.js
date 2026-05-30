// VoidRoll Reborn - Phase 5 Inventory System
// Clean inventory formatting with Anime/Rarity/Element/Role/Variant filtering.
// No Stars, no Fusion, no character-specific shards.

const inventoryConfig = require('../config/inventory_config.json');

const RARITY_ORDER = inventoryConfig.rarityOrder;

function cleanText(value, fallback = 'Unknown') {
  const text = String(value || '').trim();
  return text.length ? text : fallback;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpper(value, fallback = '') {
  const out = String(value || fallback || '').trim().toUpperCase();
  return out || fallback;
}

function rarityRank(rarity = 'COMMON') {
  const index = RARITY_ORDER.indexOf(normalizeUpper(rarity, 'COMMON'));
  return index >= 0 ? index : 0;
}

function getRarityEmoji(rarity = 'COMMON') {
  return inventoryConfig.rarityEmoji[normalizeUpper(rarity, 'COMMON')] || '◻️';
}

function getElementEmoji(element = '') {
  return inventoryConfig.elementEmoji[normalizeUpper(element)] || '▫️';
}

function getRoleEmoji(role = '') {
  return inventoryConfig.roleEmoji[normalizeUpper(role)] || '▫️';
}

function getCharacterFromCard(card = {}) {
  return card.character || card.template || card;
}

function matchesFilter(value, query) {
  if (!query) return true;
  return normalize(value).includes(normalize(query));
}

function filterCards(cards = [], filters = {}) {
  return cards.filter(card => {
    const character = getCharacterFromCard(card);

    if (filters.name && !matchesFilter(character.name || card.name, filters.name)) return false;
    if (filters.anime && !matchesFilter(character.anime, filters.anime)) return false;
    if (filters.rarity && normalizeUpper(character.rarity) !== normalizeUpper(filters.rarity)) return false;
    if (filters.element && normalizeUpper(character.element) !== normalizeUpper(filters.element)) return false;

    const role = character.role || character.type || card.role || card.type;
    if (filters.role && normalizeUpper(role) !== normalizeUpper(filters.role)) return false;

    if (filters.variant && !matchesFilter(character.variant || card.variant || 'Base', filters.variant)) return false;

    return true;
  });
}

function sortCards(cards = [], sort = 'power') {
  const mode = normalize(sort || 'power');

  return [...cards].sort((a, b) => {
    const ca = getCharacterFromCard(a);
    const cb = getCharacterFromCard(b);

    if (mode === 'rarity') {
      return (rarityRank(cb.rarity) - rarityRank(ca.rarity)) || (Number(b.power || 0) - Number(a.power || 0));
    }

    if (mode === 'level') {
      return (Number(b.level || 1) - Number(a.level || 1)) || (Number(b.power || 0) - Number(a.power || 0));
    }

    if (mode === 'name') {
      return cleanText(ca.name || a.name).localeCompare(cleanText(cb.name || b.name));
    }

    if (mode === 'anime') {
      return cleanText(ca.anime).localeCompare(cleanText(cb.anime));
    }

    if (mode === 'gear') {
      return (rarityRank(b.gearTier || 'COMMON') - rarityRank(a.gearTier || 'COMMON')) || (Number(b.power || 0) - Number(a.power || 0));
    }

    return Number(b.power || 0) - Number(a.power || 0);
  });
}

function paginate(items = [], page = 1, pageSize = inventoryConfig.pageSize) {
  const safePageSize = Math.max(1, Math.min(Number(pageSize || inventoryConfig.pageSize), inventoryConfig.maxPageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.max(1, Math.min(Number(page || 1), totalPages));
  const start = (safePage - 1) * safePageSize;

  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    items: items.slice(start, start + safePageSize)
  };
}

function passiveSummary(character = {}) {
  const passive = character.passive || character.passiveName || character.passiveAbility || 'No passive data yet.';
  const leader = character.leaderPassive || character.leader_passive || null;
  const collection = character.collectionPassive || character.collection_passive || null;

  const lines = [`Passive: ${passive}`];
  if (leader) lines.push(`Leader: ${leader}`);
  if (collection) lines.push(`Collection: ${collection}`);
  return lines.join('\n');
}

function formatCardLine(card = {}, index = 1) {
  const character = getCharacterFromCard(card);
  const rarity = normalizeUpper(character.rarity, 'COMMON');
  const element = normalizeUpper(character.element || card.element || 'UNKNOWN');
  const role = normalizeUpper(character.role || character.type || card.role || card.type || 'UNKNOWN');
  const variant = cleanText(character.variant || card.variant || 'Base', 'Base');

  const name = cleanText(character.name || card.name);
  const anime = cleanText(character.anime);
  const level = Number(card.level || 1);
  const power = Number(card.power || character.basePower || 0);
  const gearTier = normalizeUpper(card.gearTier || 'COMMON', 'COMMON');

  return [
    `**${index}. ${getRarityEmoji(rarity)} ${name}**`,
    `Variant: **${variant}** | Anime: **${anime}**`,
    `Rarity: **${rarity}** | ${getElementEmoji(element)} Element: **${element}** | ${getRoleEmoji(role)} Role: **${role}**`,
    `Lv. **${level}** | Power: **${power.toLocaleString()}** | Gear: **${gearTier}**`
  ].join('\n');
}

function formatInventory(cards = [], filters = {}) {
  const filtered = filterCards(cards, filters);
  const sorted = sortCards(filtered, filters.sort || 'power');
  const page = paginate(sorted, filters.page || 1, filters.take || inventoryConfig.pageSize);

  const header = [
    '🎒 **VoidRoll Reborn Inventory**',
    `Showing **${page.items.length}** of **${page.total}** cards`,
    `Page **${page.page}/${page.totalPages}**`,
  ].join('\n');

  if (!page.items.length) {
    return {
      content: `${header}\n\nNo cards found for this filter.`,
      page
    };
  }

  const lines = page.items.map((card, idx) => formatCardLine(card, ((page.page - 1) * page.pageSize) + idx + 1));

  return {
    content: `${header}\n\n${lines.join('\n\n')}`,
    page
  };
}

function formatCardDetails(card = {}) {
  const character = getCharacterFromCard(card);
  const rarity = normalizeUpper(character.rarity, 'COMMON');
  const element = normalizeUpper(character.element || card.element || 'UNKNOWN');
  const role = normalizeUpper(character.role || character.type || card.role || card.type || 'UNKNOWN');
  const variant = cleanText(character.variant || card.variant || 'Base', 'Base');

  const stats = {
    hp: card.hp || character.hp || character.baseHp || 0,
    atk: card.atk || character.atk || character.baseAtk || 0,
    def: card.def || character.def || character.baseDef || 0,
    spd: card.spd || character.spd || character.speed || 0,
    critRate: card.critRate || character.critRate || 0,
    critDamage: card.critDamage || character.critDamage || 0
  };

  return [
    `${getRarityEmoji(rarity)} **${cleanText(character.name || card.name)}**`,
    `Variant: **${variant}**`,
    `Anime: **${cleanText(character.anime)}**`,
    `Rarity: **${rarity}**`,
    `${getElementEmoji(element)} Element: **${element}**`,
    `${getRoleEmoji(role)} Role: **${role}**`,
    `Level: **${Number(card.level || 1)}**`,
    `Power: **${Number(card.power || character.basePower || 0).toLocaleString()}**`,
    `Built-in Gear: **${normalizeUpper(card.gearTier || 'COMMON', 'COMMON')}**`,
    '',
    '**Stats**',
    `HP: ${Number(stats.hp).toLocaleString()}`,
    `ATK: ${Number(stats.atk).toLocaleString()}`,
    `DEF: ${Number(stats.def).toLocaleString()}`,
    `SPD: ${Number(stats.spd).toLocaleString()}`,
    `Crit Rate: ${stats.critRate}%`,
    `Crit Damage: ${stats.critDamage}%`,
    '',
    '**Passives**',
    passiveSummary(character)
  ].join('\n');
}

function animeCompletion(cards = [], animeName = '') {
  const ownedNames = new Set();
  for (const card of cards) {
    const c = getCharacterFromCard(card);
    if (matchesFilter(c.anime, animeName)) ownedNames.add(normalize(c.name));
  }

  return {
    anime: animeName,
    ownedUnique: ownedNames.size,
    note: 'Total anime database count should be supplied by Character Database when connected.'
  };
}

module.exports = {
  cleanText,
  normalize,
  normalizeUpper,
  rarityRank,
  getRarityEmoji,
  getElementEmoji,
  getRoleEmoji,
  filterCards,
  sortCards,
  paginate,
  passiveSummary,
  formatCardLine,
  formatInventory,
  formatCardDetails,
  animeCompletion
};
