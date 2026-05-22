const SECRET_POWER_MAP = {
  // Solo Leveling
  'sung jin-woo': 38000,
  'sung jin woo': 38000,

  // Dragon Ball
  'gokuu son': 36000,
  'son goku': 36000,
  'goku': 36000,
  'vegeta': 34000,

  // Jujutsu Kaisen
  'satoru gojou': 30000,
  'satoru gojo': 30000,
  'gojo': 30000,
  'sukuna': 31000,
  'ryomen sukuna': 31000,
  'toji fushiguro': 24000,
  'toji': 24000,

  // Naruto
  'madara uchiha': 32000,
  'madara': 32000,
  'itachi uchiha': 26000,
  'itachi': 26000,
  'naruto uzumaki': 30000,
  'naruto': 30000,
  'sasuke uchiha': 29500,
  'sasuke': 29500,

  // Bleach
  'sousuke aizen': 33000,
  'sosuke aizen': 33000,
  'aizen': 33000,
  'ichigo kurosaki': 31000,

  // One Punch Man / Tensura
  'saitama': 42000,
  'rimuru tempest': 40000,
  'rimuru': 40000,

  // One Piece
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

  // AOT
  'levi ackerman': 22000,
  'levi': 22000,
  'eren yeager': 25000,
  'eren jaeger': 25000,
  'eren': 25000,

  // Demon Slayer
  'yoriichi tsugikuni': 27000,
  'yoriichi': 27000,
  'muzan kibutsuji': 26000,
  'muzan': 26000,

  // HxH
  'chrollo lucilfer': 25000,
  'chrollo': 25000,
  'meruem': 29000,
  'isaac netero': 24000,
  'netero': 24000,
  'hisoka morow': 22000,
  'hisoka': 22000,

  // Other iconic
  'lelouch lamperouge': 24000,
  'lelouch': 24000,
  'escanor': 28000,
  'kenpachi zaraki': 27000,
  'kenpachi': 27000,
  'all might': 25000,
  'ken kaneki': 23000,
  'kaneki': 23000,
  'alucard': 32000,
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
  'beerus': 18000,
  'whis': 19000,
  'zeno': 19500,
  'broly': 17000,
  'frieza': 16500,
  'meliodas': 17500,
  'dracule mihawk': 16000,
  'mihawk': 16000,
  'yhwach': 18000,
  'genryusai yamamoto': 17000,
  'yamamoto': 17000,
  'pain': 15000,
  'obito uchiha': 16000,
  'obito': 16000,
  'minato namikaze': 15500,
  'minato': 15500,
  'kyoujurou rengoku': 14500,
  'kyojuro rengoku': 14500,
  'rengoku': 14500,
  'akaza': 14800,
  'tanjiro kamado': 15000,
  'tanjiro': 15000,
  'doflamingo': 15000,
  'donquixote doflamingo': 15000,
  'portgas d. ace': 14500,
  'ace': 14500,
  'kakashi hatake': 14000,
  'kakashi': 14000,
  'izuku midoriya': 14500,
  'deku': 14500,
  'trafalgar law': 15000,
  'law': 15000
};

const MYTHIC_POWER_MAP = {
  'yuji itadori': 9500,
  'yuji': 9500,
  'megumi fushiguro': 9800,
  'megumi': 9800,
  'denji': 10000,
  'power': 9000,
  'bakugo': 8500,
  'katsuki bakugo': 8500,
  'todoroki': 8500,
  'shoto todoroki': 8500,
  'zenitsu': 7500,
  'inosuke': 7600,
  'gaara': 9500,
  'jiraiya': 9800,
  'sanji': 10500,
  'killua zoldyck': 10000,
  'killua': 10000,
  'gon freecss': 10500,
  'gon': 10500,
  'giyu': 8500,
  'shinobu': 7800
};

const LEGENDARY_POWER_MAP = {
  'rock lee': 6500,
  'neji': 6500,
  'hinata': 6200,
  'shikamaru nara': 6000,
  'shikamaru': 6000,
  'piccolo': 7000,
  'trunks': 7500,
  'android 17': 7200,
  'android 18': 7000,
  'boa hancock': 7800,
  'yamato': 7800,
  'crocodile': 7200,
  'gray fullbuster': 6500,
  'gray': 6500,
  'erza scarlet': 7800,
  'erza': 7800
};

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// مهم جدًا: لا نطابق بالأنمي ولا بالمقاطع العشوائية.
// نطابق اسم الشخصية فقط عشان ما يصير كل شخصيات Saiki سيكرت.
function exactNameMatch(name, key) {
  const n = normalize(name);
  const k = normalize(key);

  if (n === k) return true;

  // يسمح فقط بحالات الاسم الكامل مع لقب بسيط، بدون مطابقة أسماء الأنمي.
  // مثال: "Satoru Gojou" يطابق "gojo" فقط إذا الاسم نفسه يحتوي كلمتين والكنية موجودة.
  const parts = n.split(' ');
  if (k.split(' ').length === 1 && parts.includes(k) && parts.length <= 3) return true;

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
