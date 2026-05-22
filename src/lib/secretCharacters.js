const SECRET_POWER_MAP = {
  'sung jin-woo': 38000,
  'sung jin woo': 38000,
  'jinwoo': 38000,
  'goku': 36000,
  'son goku': 36000,
  'vegeta': 34000,
  'gojo': 30000,
  'satoru gojo': 30000,
  'sukuna': 31000,
  'ryomen sukuna': 31000,
  'madara': 32000,
  'madara uchiha': 32000,
  'itachi': 26000,
  'itachi uchiha': 26000,
  'aizen': 33000,
  'sosuke aizen': 33000,
  'lelouch': 24000,
  'lelouch lamperouge': 24000,
  'chrollo': 25000,
  'chrollo lucilfer': 25000,
  'naruto': 30000,
  'naruto uzumaki': 30000,
  'sasuke': 29500,
  'sasuke uchiha': 29500,
  'ichigo': 31000,
  'ichigo kurosaki': 31000,
  'saitama': 42000,
  'rimuru': 40000,
  'rimuru tempest': 40000,
  'shanks': 29000,
  'whitebeard': 30000,
  'edward newgate': 30000,
  'roger': 30500,
  'gol d. roger': 30500,
  'kaido': 31500,
  'luffy': 28500,
  'monkey d. luffy': 28500,
  'zoro': 26000,
  'roronoa zoro': 26000,
  'levi': 22000,
  'levi ackerman': 22000,
  'eren': 25000,
  'eren yeager': 25000,
  'eren jaeger': 25000,
  'toji': 24000,
  'toji fushiguro': 24000,
  'yoriichi': 27000,
  'yoriichi tsugikuni': 27000,
  'muzan': 26000,
  'muzan kibutsuji': 26000,
  'escanor': 28000,
  'kenpachi': 27000,
  'kenpachi zaraki': 27000,
  'netero': 24000,
  'isaac netero': 24000,
  'hisoka': 22000,
  'hisoka morow': 22000,
  'all might': 25000,
  'kaneki': 23000,
  'ken kaneki': 23000,
  'alucard': 32000,
  'meruem': 29000,
  'makima': 27000,
  'mob': 25000,
  'shigeo kageyama': 25000,
  'saiki': 34000,
  'saiki kusuo': 34000,
  'asta': 24000,
  'natsu': 23000,
  'natsu dragneel': 23000,
  'light yagami': 21000,
  'kira': 21000,
  'thorfinn': 20000,
  'dio': 26000,
  'dio brando': 26000,
  'gilgamesh': 35000,
  'reinhard': 34000,
  'reinhard van astrea': 34000,
  'kirito': 22000,
  'ayanokoji': 20000,
  'kiyotaka ayanokoji': 20000,
  'rin itoshi': 18000,
  'guts': 26000,
  'edward elric': 21000,
  'spike spiegel': 19000,
  'david martinez': 21000,
  'shinra': 23000,
  'shinra kusakabe': 23000,
  'ainz': 36000,
  'ainz ooal gown': 36000,
  'esdeath': 24000,
  'senku': 18000,
  'senku ishigami': 18000,
  'okabe': 18000,
  'okabe rintarou': 18000,
  'mikey': 22000,
  'manjiro sano': 22000,
  'cid': 33000,
  'cid kagenou': 33000
};

const DIVINE_POWER_MAP = {
  'beerus': 18000,
  'whis': 19000,
  'zeno': 19500,
  'broly': 17000,
  'frieza': 16500,
  'meliodas': 17500,
  'mihawk': 16000,
  'dracule mihawk': 16000,
  'yhwach': 18000,
  'yamamoto': 17000,
  'genryusai yamamoto': 17000,
  'pain': 15000,
  'obito': 16000,
  'obito uchiha': 16000,
  'minato': 15500,
  'minato namikaze': 15500,
  'rengoku': 14500,
  'kyojuro rengoku': 14500,
  'akaza': 14800,
  'tanjiro': 15000,
  'tanjiro kamado': 15000,
  'doflamingo': 15000,
  'ace': 14500,
  'portgas d. ace': 14500,
  'kakashi': 14000,
  'kakashi hatake': 14000,
  'deku': 14500,
  'izuku midoriya': 14500,
  'law': 15000,
  'trafalgar law': 15000
};

const MYTHIC_POWER_MAP = {
  'yuji': 9500,
  'yuji itadori': 9500,
  'megumi': 9800,
  'megumi fushiguro': 9800,
  'denji': 10000,
  'power': 9000,
  'bakugo': 8500,
  'todoroki': 8500,
  'zenitsu': 7500,
  'inosuke': 7600,
  'gaara': 9500,
  'jiraiya': 9800,
  'sanji': 10500,
  'killua': 10000,
  'gon': 10500,
  'giyu': 8500,
  'shinobu': 7800
};

const LEGENDARY_POWER_MAP = {
  'rock lee': 6500,
  'neji': 6500,
  'hinata': 6200,
  'shikamaru': 6000,
  'piccolo': 7000,
  'trunks': 7500,
  'android 17': 7200,
  'android 18': 7000,
  'boa hancock': 7800,
  'yamato': 7800,
  'crocodile': 7200,
  'gray': 6500,
  'erza': 7800
};

function normalize(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesName(full, key) {
  return full === key || full.includes(key);
}

function classifyCharacter(character) {
  const name = normalize(character.name);
  const anime = normalize(character.anime);
  const combined = `${name} ${anime}`;

  for (const [key, power] of Object.entries(SECRET_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) {
      return { rarity: 'SECRET', power };
    }
  }

  for (const [key, power] of Object.entries(DIVINE_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) {
      return { rarity: 'DIVINE', power };
    }
  }

  for (const [key, power] of Object.entries(MYTHIC_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) {
      return { rarity: 'MYTHIC', power };
    }
  }

  for (const [key, power] of Object.entries(LEGENDARY_POWER_MAP)) {
    if (includesName(name, key) || includesName(combined, key)) {
      return { rarity: 'LEGENDARY', power };
    }
  }

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
