// VoidRoll Reborn - Character Library System
// Used by /characters and /anime to always sort A-Z cleanly.

function cleanName(name = '') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[().\-_:/'’"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sortCharactersAZ(characters = []) {
  return [...characters].sort((a, b) => {
    const an = cleanName(a.name).toLowerCase();
    const bn = cleanName(b.name).toLowerCase();
    const byName = an.localeCompare(bn);
    if (byName) return byName;
    const byAnime = String(a.anime || '').localeCompare(String(b.anime || ''));
    if (byAnime) return byAnime;
    return Number(b.basePower || 0) - Number(a.basePower || 0);
  });
}

function paginate(list = [], page = 1, take = 20) {
  const pages = Math.max(1, Math.ceil(list.length / take));
  const current = Math.max(1, Math.min(Number(page || 1), pages));
  return {
    page: current,
    pages,
    total: list.length,
    items: list.slice((current - 1) * take, current * take)
  };
}

function filterCharacters(characters = [], filters = {}) {
  let list = characters.filter(c => c && c.active !== false);

  if (filters.name) {
    const q = normalize(filters.name);
    list = list.filter(c => normalize(cleanName(c.name)).includes(q) || normalize(c.name).includes(q));
  }

  if (filters.anime) {
    const q = normalize(filters.anime);
    list = list.filter(c => normalize(c.anime).includes(q));
  }

  if (filters.rarity && filters.rarity !== 'ALL') {
    list = list.filter(c => String(c.rarity || '').toUpperCase() === String(filters.rarity).toUpperCase());
  }

  if (filters.element && filters.element !== 'ALL') {
    list = list.filter(c => String(c.element || '').toUpperCase() === String(filters.element).toUpperCase());
  }

  if (filters.role && filters.role !== 'ALL') {
    list = list.filter(c => String(c.role || c.type || '').toUpperCase() === String(filters.role).toUpperCase());
  }

  if (filters.variant && filters.variant !== 'ALL') {
    list = list.filter(c => String(c.variant || 'Base').toLowerCase().includes(String(filters.variant).toLowerCase()));
  }

  return sortCharactersAZ(list);
}

function formatCharacterList(characters = [], filters = {}) {
  const pageData = paginate(filterCharacters(characters, filters), filters.page || 1, filters.take || 20);

  const lines = pageData.items.map((c, idx) => {
    return `${(pageData.page - 1) * (filters.take || 20) + idx + 1}. **${cleanName(c.name)}** • ${c.anime || 'Unknown'} • ${c.rarity || 'COMMON'} • ${c.element || 'NEUTRAL'} • ${c.role || c.type || 'DPS'}`;
  });

  return [
    `Characters: **${pageData.total}**`,
    `Page: **${pageData.page}/${pageData.pages}**`,
    '',
    lines.join('\n') || 'No characters found.'
  ].join('\n');
}

module.exports = {
  cleanName,
  normalize,
  sortCharactersAZ,
  paginate,
  filterCharacters,
  formatCharacterList
};
