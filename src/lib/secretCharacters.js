const SECRET_CHARACTER_KEYWORDS = [
  // Universe breakers / god tier / final boss level
  'goku', 'vegeta', 'beerus', 'whis', 'zeno', 'frieza', 'broly',
  'saitama', 'blast',
  'anos', 'rimuru', 'milim',
  'madara', 'kaguya', 'hagoromo', 'naruto', 'sasuke', 'itachi', 'pain', 'obito',
  'gojo', 'satoru gojo', 'sukuna', 'yuta okkotsu', 'kenjaku', 'toji',
  'aizen', 'yhwach', 'ichigo', 'yamamoto', 'kenpachi',
  'lelouch', 'lelouch lamperouge',
  'chrollo', 'kuroro', 'meruem', 'netero', 'hisoka',
  'muzan', 'yoriichi', 'kokushibo',
  'kaido', 'shanks', 'roger', 'gol d. roger', 'whitebeard', 'blackbeard', 'mihawk',
  'all might', 'all for one', 'shigaraki', 'star and stripe',
  'escanor', 'meliodas', 'ban',
  'zeref', 'acnologia', 'natsu',
  'sinbad', 'gilgamesh', 'kirito',
  'eren yeager', 'eren jaeger', 'founding titan',
  'alucard'
];

const SECRET_ANIME_KEYWORDS = [
  'dragon ball',
  'one punch man',
  'code geass',
  'jujutsu kaisen',
  'naruto',
  'bleach',
  'one piece',
  'hunter x hunter',
  'demon slayer',
  'kimetsu',
  'my hero',
  'boku no hero',
  'attack on titan',
  'shingeki',
  'seven deadly sins',
  'nanatsu',
  'fairy tail',
  'fate'
];

function normalize(value = '') {
  return String(value || '').toLowerCase();
}

function hasAny(text, words) {
  return words.some(word => text.includes(word));
}

function isSecretCandidate(character) {
  const name = normalize(character.name);
  const anime = normalize(character.anime);
  const combined = `${name} ${anime}`;

  if (character.rarity === 'SECRET') return true;

  // Any current Divine from a major fighting anime is promoted to Secret.
  if (
    character.rarity === 'DIVINE' &&
    hasAny(anime, SECRET_ANIME_KEYWORDS)
  ) {
    return true;
  }

  // Very high power cards should become Secret even if the name list missed them.
  if ((character.basePower || 0) >= 9000) return true;

  // Keyword based promotion for famous top-tier characters.
  if (hasAny(combined, SECRET_CHARACTER_KEYWORDS)) return true;

  return false;
}

module.exports = {
  SECRET_CHARACTER_KEYWORDS,
  SECRET_ANIME_KEYWORDS,
  isSecretCandidate
};
