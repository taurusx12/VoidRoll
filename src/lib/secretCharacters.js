const SECRET_POWER_MAP = {
  // SECRET النهائي - شخصيات واجهة اللعبة فقط
  'sung jin-woo': 38000,
  'sung jin woo': 38000,
  'gokuu son': 36000,
  'son goku': 36000,
  'goku': 36000,
  'vegeta': 34000,
  'satoru gojou': 30000,
  'satoru gojo': 30000,
  'gojo': 30000,
  'sukuna': 31000,
  'ryomen sukuna': 31000,
  'madara uchiha': 32000,
  'madara': 32000,
  'itachi uchiha': 26000,
  'itachi': 26000,
  'sousuke aizen': 33000,
  'sosuke aizen': 33000,
  'aizen': 33000,
  'lelouch lamperouge': 24000,
  'lelouch': 24000,
  'chrollo lucilfer': 25000,
  'chrollo': 25000,
  'naruto uzumaki': 30000,
  'naruto': 30000,
  'sasuke uchiha': 29500,
  'sasuke': 29500,
  'ichigo kurosaki': 31000,
  'saitama': 42000,
  'rimuru tempest': 40000,
  'rimuru': 40000,
  'shanks': 29000,
  'whitebeard': 30000,
  'edward newgate': 30000,
  'gol d. roger': 30500,
  'roger': 30500,
  'kaido': 31500,
  'monkey d. luffy': 28500,
  'luffy': 28500,
  'roronoa zoro': 26000,
  'zoro': 26000,
  'levi ackerman': 22000,
  'levi': 22000,
  'eren yeager': 25000,
  'eren jaeger': 25000,
  'eren': 25000,
  'toji fushiguro': 24000,
  'toji': 24000,
  'yoriichi tsugikuni': 27000,
  'yoriichi': 27000,
  'muzan kibutsuji': 26000,
  'muzan': 26000,
  'escanor': 28000,
  'kenpachi zaraki': 27000,
  'kenpachi': 27000,
  'isaac netero': 24000,
  'netero': 24000,
  'hisoka morow': 22000,
  'hisoka': 22000,
  'all might': 25000,
  'ken kaneki': 23000,
  'kaneki': 23000,
  'alucard': 32000,
  'meruem': 29000,
  'makima': 27000,
  'shigeo kageyama': 25000,
  'mob': 25000,
  'kusuo saiki': 34000,
  'saiki kusuo': 34000,
  'asta': 24000,
  'natsu dragneel': 23000,
  'natsu': 23000,
  'light yagami': 21000,
  'thorfinn': 20000,
  'dio brando': 26000,
  'gilgamesh': 35000,
  'reinhard van astrea': 34000,
  'kirito': 22000,
  'kiyotaka ayanokoji': 20000,
  'ayanokoji': 20000,
  'rin itoshi': 18000,
  'guts': 26000,
  'edward elric': 21000,
  'spike spiegel': 19000,
  'david martinez': 21000,
  'shinra kusakabe': 23000,
  'ainz ooal gown': 36000,
  'ainz': 36000,
  'esdeath': 24000,
  'senku ishigami': 18000,
  'senku': 18000,
  'okabe rintarou': 18000,
  'rintarou okabe': 18000,
  'mikey': 22000,
  'manjiro sano': 22000,
  'cid kagenou': 33000
};

const DIVINE_POWER_MAP = {
  // DIVINE 14000 - 19500
  'zeno': 19500,
  'whis': 19000,
  'beerus': 18000,
  'yhwach': 18000,
  'meliodas': 17500,
  'broly': 17000,
  'genryusai yamamoto': 17000,
  'yamamoto': 17000,
  'frieza': 16500,
  'obito uchiha': 16000,
  'obito': 16000,
  'dracule mihawk': 16000,
  'mihawk': 16000,
  'minato namikaze': 15500,
  'minato': 15500,
  'pain': 15000,
  'tanjiro kamado': 15000,
  'tanjiro': 15000,
  'trafalgar law': 15000,
  'law': 15000,
  'donquixote doflamingo': 15000,
  'doflamingo': 15000,
  'akaza': 14800,
  'portgas d. ace': 14500,
  'ace': 14500,
  'izuku midoriya': 14500,
  'deku': 14500,
  'kyoujurou rengoku': 14500,
  'kyojuro rengoku': 14500,
  'rengoku': 14500,
  'kakashi hatake': 14000,
  'kakashi': 14000
};

const MYTHIC_POWER_MAP = {
  // MYTHIC 7500 - 13000
  'sanji': 10500,
  'gon freecss': 10500,
  'gon': 10500,
  'killua zoldyck': 10000,
  'killua': 10000,
  'denji': 10000,
  'megumi fushiguro': 9800,
  'megumi': 9800,
  'jiraiya': 9800,
  'yuji itadori': 9500,
  'yuji': 9500,
  'gaara': 9500,
  'power': 9000,
  'katsuki bakugo': 8500,
  'bakugo': 8500,
  'shoto todoroki': 8500,
  'todoroki': 8500,
  'giyu': 8500,
  'shinobu': 7800,
  'inosuke': 7600,
  'zenitsu': 7500
};

const LEGENDARY_POWER_MAP = {
  // LEGENDARY 6000 - 9000
  'erza scarlet': 7800,
  'erza': 7800,
  'boa hancock': 7800,
  'yamato': 7800,
  'trunks': 7500,
  'crocodile': 7200,
  'android 17': 7200,
  'android 18': 7000,
  'piccolo': 7000,
  'rock lee': 6500,
  'neji': 6500,
  'gray fullbuster': 6500,
  'gray': 6500,
  'hinata': 6200,
  'shikamaru nara': 6000,
  'shikamaru': 6000
};

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ممنوع يطابق اسم الأنمي. يطابق اسم الشخصية فقط.
// عشان Kokomi/Riki/Nendou ما يصيرون سيكرت بسبب Saiki.
function exactNameMatch(name, key) {
  const n = normalize(name);
  const k = normalize(key);

  if (n === k) return true;

  const parts = n.split(' ');
  const keyParts = k.split(' ');

  // اسم مختصر مسموح فقط إذا كان جزء من اسم الشخصية نفسها، بحد أقصى 3 كلمات.
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
