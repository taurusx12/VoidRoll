const SECRET_POWER_MAP = {
  'satoru gojo': 30000,
  'satoru gojou': 30000,
  'gojo': 30000,
  'sung jin-woo': 38000,
  'sung jin woo': 38000,
  'jinwoo': 38000,
  'lelouch lamperouge': 28000,
  'lelouch': 28000,
  'saitama': 42000,
  'rimuru tempest': 40000,
  'rimuru': 40000,
  'madara uchiha': 32000,
  'madara': 32000,
  'sosuke aizen': 33000,
  'sousuke aizen': 33000,
  'aizen': 33000,
  'sukuna': 31000,
  'ryomen sukuna': 31000,
  'goku': 36000,
  'son goku': 36000,
  'gokuu son': 36000,
  'vegeta': 34000,
  'gilgamesh': 35000,
  'makima': 27000,
  'luffy': 28500,
  'monkey d. luffy': 28500,
  'yhwach': 31000,
  'ichigo kurosaki': 31000,
  'ichigo': 31000,
  'naruto uzumaki': 30000,
  'naruto': 30000,
  'sasuke uchiha': 29500,
  'sasuke': 29500,
  'shanks': 29000,
  'kaido': 31500,
  'whitebeard': 30000,
  'edward newgate': 30000,
  'gol d. roger': 30500,
  'roger': 30500,
  'alucard': 32000,
  'cid kagenou': 33000,
  'ainz ooal gown': 30000,
  'ainz': 30000
};

const DIVINE_POWER_MAP = {
  'saber': 17000,
  'gon freecss': 16000,
  'gon': 16000,
  'killua zoldyck': 16000,
  'killua': 16000,
  'kurapika': 16000,
  'kakashi hatake': 14000,
  'kakashi': 14000,
  'toji fushiguro': 16000,
  'toji': 16000,
  'law': 15000,
  'trafalgar law': 15000,
  'itachi uchiha': 15500,
  'itachi': 15500,
  'pain': 15000,
  'obito': 16000,
  'obito uchiha': 16000,
  'minato': 15500,
  'minato namikaze': 15500,
  'beerus': 18000,
  'whis': 19000,
  'frieza': 16500,
  'broly': 17000,
  'meliodas': 17500,
  'escanor': 17500,
  'yami': 15500,
  'benimaru': 15500,
  'meruem': 16500,
  'chrollo': 15000,
  'chrollo lucilfer': 15000,
  'hisoka': 14500,
  'mihawk': 16000,
  'dracule mihawk': 16000,
  'yamamoto': 17000,
  'genryusai yamamoto': 17000,
  'tanjiro': 15000,
  'tanjiro kamado': 15000,
  'akaza': 14800,
  'rengoku': 14500,
  'kyoujurou rengoku': 14500
};

const MYTHIC_POWER_MAP = {
  'zoro': 10500,
  'roronoa zoro': 10500,
  'sanji': 10500,
  'ace': 10000,
  'portgas d. ace': 10000,
  'denji': 10000,
  'power': 9000,
  'yuji': 9500,
  'yuji itadori': 9500,
  'megumi': 9800,
  'megumi fushiguro': 9800,
  'nobara': 8500,
  'nobara kugisaki': 8500,
  'bakugo': 8500,
  'katsuki bakugo': 8500,
  'todoroki': 8500,
  'shoto todoroki': 8500,
  'giyu': 8500,
  'giyuu': 8500,
  'shinobu': 7800,
  'inosuke': 7600,
  'zenitsu': 7500,
  'android 17': 7200,
  'android 18': 7000,
  'piccolo': 7000
};

const LEGENDARY_POWER_MAP = {
  'rock lee': 6500,
  'neji': 6500,
  'hinata': 6200,
  'shikamaru': 6000,
  'shikamaru nara': 6000,
  'franky': 6500,
  'brook': 6300,
  'robin': 6200,
  'nami': 5500,
  'usopp': 5200,
  'chopper': 5200,
  'panda': 5200,
  'inumaki': 5600,
  'mai': 5000
};

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

function exactNameMatch(name, key) {
  const n = normalize(name);
  const k = normalize(key);
  if (n === k) return true;
  const parts = n.split(' ');
  const keyParts = k.split(' ');
  if (keyParts.length === 1 && parts.length <= 3 && parts.includes(k)) return true;
  return false;
}

function findMatch(character, map) {
  const name = normalize(character.name);
  for (const [key, power] of Object.entries(map)) {
    if (exactNameMatch(name, key)) return { power, key };
  }
  return null;
}

function classifyCharacter(character) {
  const secret = findMatch(character, SECRET_POWER_MAP);
  if (secret) return { rarity: 'SECRET', power: secret.power };

  const divine = findMatch(character, DIVINE_POWER_MAP);
  if (divine) return { rarity: 'DIVINE', power: divine.power };

  const mythic = findMatch(character, MYTHIC_POWER_MAP);
  if (mythic) return { rarity: 'MYTHIC', power: mythic.power };

  const legendary = findMatch(character, LEGENDARY_POWER_MAP);
  if (legendary) return { rarity: 'LEGENDARY', power: legendary.power };

  return null;
}

function isSecretCandidate(character) {
  return classifyCharacter(character)?.rarity === 'SECRET';
}

module.exports = {
  SECRET_POWER_MAP,
  DIVINE_POWER_MAP,
  MYTHIC_POWER_MAP,
  LEGENDARY_POWER_MAP,
  classifyCharacter,
  isSecretCandidate
};
