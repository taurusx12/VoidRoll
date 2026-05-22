const SECRET_POWER_MAP = {
  'gokuu son': 22000, 'goku': 22000, 'vegeta': 20500, 'beerus': 30000, 'whis': 35000, 'zeno': 50000,
  'frieza': 21000, 'broly': 23000, 'saitama': 32000, 'anos voldigoad': 40000, 'rimuru tempest': 36000,
  'madara uchiha': 20000, 'kaguya otsutsuki': 26000, 'sukuna': 24000, 'satoru gojou': 23000, 'satoru gojo': 23000,
  'sousuke aizen': 23500, 'aizen': 23500, 'yhwach': 28000, 'ichigo kurosaki': 21000, 'lelouch lamperouge': 20000,
  'chrollo lucilfer': 20000, 'chrollo': 20000, 'meruem': 23000, 'muzan kibutsuji': 21000, 'yoriichi tsugikuni': 22000,
  'kaido': 23000, 'shanks': 22000, 'gol d. roger': 25000, 'edward newgate': 24000, 'whitebeard': 24000,
  'marshall d. teach': 23000, 'blackbeard': 23000, 'mihawk': 21000, 'all for one': 20000, 'tomura shigaraki': 20500,
  'escanor': 23000, 'meliodas': 22500, 'zeref': 21000, 'acnologia': 24000, 'gilgamesh': 26000, 'alucard': 24000, 'dio brando': 21000
};

const DIVINE_POWER_MAP = {
  'naruto uzumaki': 15000, 'sasuke uchiha': 14500, 'itachi uchiha': 12000, 'pain': 13000, 'obito uchiha': 14000,
  'kenpachi zaraki': 14500, 'yamamoto': 16000, 'netero': 14000, 'hisoka morow': 11500, 'natsu dragneel': 13500,
  'ban': 13000, 'all might': 13500, 'toji fushiguro': 12000
};

const LEGENDARY_POWER_MAP = {
  'kakashi hatake': 9000, 'kyoujurou rengoku': 9000, 'rengoku': 9000, 'shikamaru nara': 7500,
  'rock lee': 8000, 'gaara': 9500, 'hinata hyuuga': 7600, 'jiraiya': 9500
};

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.]/g, '').replace(/\s+/g, ' ').trim();
}

function includesName(full, key) { return full === key || full.includes(key); }

function classifyCharacter(character) {
  const name = normalize(character.name);
  const anime = normalize(character.anime);
  const combined = `${name} ${anime}`;

  for (const [key, power] of Object.entries(SECRET_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) return { rarity: 'SECRET', power };
  }
  for (const [key, power] of Object.entries(DIVINE_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) return { rarity: 'DIVINE', power };
  }
  for (const [key, power] of Object.entries(LEGENDARY_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) return { rarity: 'LEGENDARY', power };
  }
  return null;
}

function isSecretCandidate(character) { return classifyCharacter(character)?.rarity === 'SECRET'; }

module.exports = { SECRET_POWER_MAP, DIVINE_POWER_MAP, LEGENDARY_POWER_MAP, classifyCharacter, isSecretCandidate };
