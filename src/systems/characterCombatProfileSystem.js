// VoidRoll Reborn - Phase 29 Character Combat Profile System
// Anime-linked passives, combat role/type, and element mapping.
// Passives here are not flavor text; battlePolishSystem reads effect values.

function normalize(v='') {
  return String(v || '')
    .toLowerCase()
    .replace(/[().\-_:/'’"]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function hasAny(text, keys) {
  return keys.some(k => text.includes(normalize(k)));
}

function rarityValue(r='COMMON') {
  return { COMMON:1, RARE:2, EPIC:3, LEGENDARY:4, MYTHIC:5, DIVINE:6, VOIDBORN:7, SECRET:8 }[String(r || 'COMMON').toUpperCase()] || 1;
}

const EXACT_PROFILES = [
  {
    keys:['corrupted makima','makima'],
    anime:['chainsaw man'],
    role:'CONTROL',
    element:'VOID',
    passive:{ name:'Control Devil Contract', effect:{ silence:24, enemyAtk:-14, teamDmg:12, energyDrain:12 } }
  },
  {
    keys:['gojo','gojou','satoru gojo','satoru gojou'],
    anime:['jujutsu'],
    role:'CONTROL',
    element:'CURSED',
    passive:{ name:'Infinity Limitless', effect:{ dodge:28, shield:1, crit:8, energyGain:8 } }
  },
  {
    keys:['sukuna','ryoumen'],
    anime:['jujutsu'],
    role:'DPS',
    element:'CURSED',
    passive:{ name:'Malevolent Shrine', effect:{ bleed:26, bossDmg:32, execute:18, dmg:10 } }
  },
  {
    keys:['aizen','sousuke aizen'],
    anime:['bleach'],
    role:'CONTROL',
    element:'SOUL',
    passive:{ name:'Kyoka Suigetsu', effect:{ miss:24, silence:16, enemyAtk:-12, energyDrain:10 } }
  },
  {
    keys:['ichigo'],
    anime:['bleach'],
    role:'DPS',
    element:'SOUL',
    passive:{ name:'Bankai Soul Pressure', effect:{ crit:14, lifesteal:10, bossDmg:18, energyGain:8 } }
  },
  {
    keys:['yhwach'],
    anime:['bleach'],
    role:'CONTROL',
    element:'VOID',
    passive:{ name:'The Almighty', effect:{ dodge:18, silence:22, counter:18, energyDrain:15 } }
  },
  {
    keys:['madara'],
    anime:['naruto'],
    role:'DPS',
    element:'SHADOW',
    passive:{ name:'Eternal Mangekyo Dominion', effect:{ burn:18, dmg:22, counter:14, enemyAtk:-8 } }
  },
  {
    keys:['naruto'],
    anime:['naruto'],
    role:'DPS',
    element:'LIGHT',
    passive:{ name:'Unbreakable Will of Kurama', effect:{ heal:12, teamDmg:10, counter:10, energyGain:10 } }
  },
  {
    keys:['sasuke'],
    anime:['naruto'],
    role:'ASSASSIN',
    element:'LIGHTNING',
    passive:{ name:'Rinnegan Chidori', effect:{ crit:18, dodge:12, silence:12, dmg:12 } }
  },
  {
    keys:['itachi'],
    anime:['naruto'],
    role:'CONTROL',
    element:'SHADOW',
    passive:{ name:'Tsukuyomi', effect:{ miss:18, stun:18, silence:12, enemyAtk:-10 } }
  },
  {
    keys:['rimuru'],
    anime:['slime','tensei shitara slime'],
    role:'SUMMONER',
    element:'VOID',
    passive:{ name:'Predator Great Sage', effect:{ lifesteal:18, pen:18, teamDmg:8, summon:1 } }
  },
  {
    keys:['luffy'],
    anime:['one piece'],
    role:'DPS',
    element:'LIGHT',
    passive:{ name:'Gear Willpower', effect:{ counter:12, dodge:10, dmg:14, heal:8 } }
  },
  {
    keys:['zoro'],
    anime:['one piece'],
    role:'ASSASSIN',
    element:'WIND',
    passive:{ name:'Three Sword Style', effect:{ crit:22, bleed:16, dmg:12 } }
  },
  {
    keys:['sanji'],
    anime:['one piece'],
    role:'ASSASSIN',
    element:'FIRE',
    passive:{ name:'Diable Jambe', effect:{ burn:18, dodge:12, crit:12 } }
  },
  {
    keys:['goku'],
    anime:['dragon ball'],
    role:'DPS',
    element:'LIGHT',
    passive:{ name:'Saiyan Limit Break', effect:{ dmg:18, energyGain:18, crit:10, heal:6 } }
  },
  {
    keys:['vegeta'],
    anime:['dragon ball'],
    role:'DPS',
    element:'LIGHTNING',
    passive:{ name:'Prince Pride', effect:{ crit:16, counter:14, dmg:16 } }
  },
  {
    keys:['eren'],
    anime:['shingeki','attack on titan'],
    role:'TANK',
    element:'BLOOD',
    passive:{ name:'Founding Rage', effect:{ counter:16, heal:10, teamDmg:8, enemyAtk:-8 } }
  },
  {
    keys:['levi'],
    anime:['shingeki','attack on titan'],
    role:'ASSASSIN',
    element:'WIND',
    passive:{ name:'Ackerman Instinct', effect:{ crit:24, dodge:18, bleed:14 } }
  },
  {
    keys:['tanjiro'],
    anime:['kimetsu','demon slayer'],
    role:'DPS',
    element:'WATER',
    passive:{ name:'Hinokami Kagura', effect:{ burn:16, crit:10, bossDmg:16 } }
  },
  {
    keys:['nezuko'],
    anime:['kimetsu','demon slayer'],
    role:'SUPPORT',
    element:'BLOOD',
    passive:{ name:'Demon Blood Recovery', effect:{ heal:16, teamDmg:8, burn:10 } }
  },
  {
    keys:['yoriichi'],
    anime:['kimetsu','demon slayer'],
    role:'ASSASSIN',
    element:'FIRE',
    passive:{ name:'Sun Breathing Origin', effect:{ crit:30, burn:22, bossDmg:26 } }
  },
  {
    keys:['asta'],
    anime:['black clover'],
    role:'DPS',
    element:'DARK',
    passive:{ name:'Anti-Magic Breaker', effect:{ silence:18, pen:22, bossDmg:18 } }
  },
  {
    keys:['yuno'],
    anime:['black clover'],
    role:'DPS',
    element:'WIND',
    passive:{ name:'Spirit Wind', effect:{ dodge:16, crit:14, energyGain:10 } }
  },
  {
    keys:['deku','midoriya'],
    anime:['hero academia','boku no hero'],
    role:'DPS',
    element:'LIGHTNING',
    passive:{ name:'One For All Surge', effect:{ dmg:18, crit:12, selfDamage:4, energyGain:10 } }
  },
  {
    keys:['all might'],
    anime:['hero academia','boku no hero'],
    role:'TANK',
    element:'LIGHT',
    passive:{ name:'Symbol of Peace', effect:{ teamDmg:12, shield:1, enemyAtk:-10 } }
  },
  {
    keys:['killua'],
    anime:['hunter'],
    role:'ASSASSIN',
    element:'LIGHTNING',
    passive:{ name:'Godspeed', effect:{ dodge:24, crit:18, stun:12 } }
  },
  {
    keys:['gon'],
    anime:['hunter'],
    role:'DPS',
    element:'WIND',
    passive:{ name:'Jajanken Resolve', effect:{ crit:16, dmg:18, bossDmg:14 } }
  },
  {
    keys:['hisoka'],
    anime:['hunter'],
    role:'CONTROL',
    element:'DARK',
    passive:{ name:'Bungee Gum Trap', effect:{ stun:16, miss:12, crit:12 } }
  },
  {
    keys:['light yagami','yagami light'],
    anime:['death note'],
    role:'CONTROL',
    element:'DARK',
    passive:{ name:'Death Note Judgment', effect:{ execute:20, silence:20, enemyAtk:-12 } }
  },
  {
    keys:['lelouch'],
    anime:['code geass'],
    role:'CONTROL',
    element:'DARK',
    passive:{ name:'Absolute Geass', effect:{ stun:24, silence:18, enemyAtk:-12, energyDrain:12 } }
  }
];

const ANIME_RULES = [
  { anime:['bleach'], role:'DPS', element:'SOUL', passive:{ name:'Soul Pressure', effect:{ crit:8, lifesteal:6, bossDmg:10 } } },
  { anime:['jujutsu'], role:'DPS', element:'CURSED', passive:{ name:'Cursed Technique', effect:{ bleed:10, silence:8, bossDmg:10 } } },
  { anime:['naruto','boruto'], role:'DPS', element:'SHADOW', passive:{ name:'Shinobi Tactics', effect:{ dodge:8, counter:8, energyGain:6 } } },
  { anime:['one piece'], role:'DPS', element:'WIND', passive:{ name:'Pirate Ambition', effect:{ counter:8, crit:8, dmg:8 } } },
  { anime:['dragon ball'], role:'DPS', element:'LIGHT', passive:{ name:'Ki Burst', effect:{ dmg:12, energyGain:10, crit:6 } } },
  { anime:['chainsaw man'], role:'CONTROL', element:'DARK', passive:{ name:'Devil Contract', effect:{ bleed:10, enemyAtk:-8, silence:8 } } },
  { anime:['demon slayer','kimetsu'], role:'DPS', element:'FIRE', passive:{ name:'Breathing Form', effect:{ crit:8, burn:8, bossDmg:8 } } },
  { anime:['attack on titan','shingeki'], role:'TANK', element:'BLOOD', passive:{ name:'Titan Resolve', effect:{ counter:8, heal:6, enemyAtk:-6 } } },
  { anime:['black clover'], role:'DPS', element:'DARK', passive:{ name:'Grimoire Surge', effect:{ silence:8, dmg:10, energyGain:6 } } },
  { anime:['hero academia','boku no hero'], role:'DPS', element:'LIGHTNING', passive:{ name:'Quirk Awakening', effect:{ dmg:10, crit:6, teamDmg:4 } } },
  { anime:['hunter'], role:'ASSASSIN', element:'LIGHTNING', passive:{ name:'Nen Flow', effect:{ dodge:10, crit:10, stun:6 } } },
  { anime:['fate'], role:'TANK', element:'LIGHT', passive:{ name:'Noble Phantasm', effect:{ shield:1, bossDmg:10, teamDmg:5 } } },
  { anime:['sword art online'], role:'ASSASSIN', element:'LIGHT', passive:{ name:'Dual Blade Burst', effect:{ crit:12, dodge:10, dmg:8 } } },
  { anime:['tokyo ghoul'], role:'DPS', element:'BLOOD', passive:{ name:'Kagune Hunger', effect:{ lifesteal:12, bleed:8, crit:6 } } },
  { anime:['fairy tail'], role:'DPS', element:'FIRE', passive:{ name:'Guild Magic', effect:{ burn:10, teamDmg:6, energyGain:6 } } },
  { anime:['slime'], role:'SUMMONER', element:'VOID', passive:{ name:'Great Sage', effect:{ lifesteal:8, pen:8, teamDmg:6 } } },
  { anime:['solo leveling'], role:'SUMMONER', element:'SHADOW', passive:{ name:'Shadow Monarch Call', effect:{ summon:1, teamDmg:10, lifesteal:8 } } }
];

function fallbackRoleByName(nameText) {
  if (hasAny(nameText, ['healer','doctor','priest','cleric','orihime','sakura','tsunade'])) return 'HEALER';
  if (hasAny(nameText, ['king','queen','emperor','lord','captain','commander'])) return 'CONTROL';
  if (hasAny(nameText, ['assassin','blade','killer','shadow','ninja','thief'])) return 'ASSASSIN';
  if (hasAny(nameText, ['tank','armor','shield','giant','titan'])) return 'TANK';
  if (hasAny(nameText, ['sage','summoner','beast','spirit','necromancer'])) return 'SUMMONER';
  return 'DPS';
}

function fallbackElementByText(text) {
  if (hasAny(text, ['dark','demon','devil','ghoul','death','night'])) return 'DARK';
  if (hasAny(text, ['light','holy','angel','sun','star'])) return 'LIGHT';
  if (hasAny(text, ['fire','flame','burn','dragon'])) return 'FIRE';
  if (hasAny(text, ['ice','snow','frost'])) return 'ICE';
  if (hasAny(text, ['thunder','lightning','electric'])) return 'LIGHTNING';
  if (hasAny(text, ['shadow','void','abyss'])) return 'SHADOW';
  if (hasAny(text, ['soul','spirit','shinigami'])) return 'SOUL';
  if (hasAny(text, ['curse','cursed'])) return 'CURSED';
  if (hasAny(text, ['blood','vampire'])) return 'BLOOD';
  if (hasAny(text, ['wind','air'])) return 'WIND';
  if (hasAny(text, ['water','sea','aqua'])) return 'WATER';
  return 'NEUTRAL';
}

function scalePassiveByRarity(passive, rarity) {
  const rv = rarityValue(rarity);
  const mult = 1 + Math.max(0, rv - 3) * 0.08;
  const out = { ...passive, effect:{ ...(passive.effect || {}) } };
  for (const [k,v] of Object.entries(out.effect)) {
    if (typeof v === 'number' && !['shield','summon'].includes(k)) {
      out.effect[k] = Math.round(v * mult);
    }
  }
  return out;
}

function getCombatProfile(character={}) {
  const name = normalize(character.name);
  const anime = normalize(character.anime);
  const combined = `${name} ${anime}`;
  const rarity = String(character.rarity || 'COMMON').toUpperCase();

  const exact = EXACT_PROFILES.find(r => hasAny(name, r.keys) && (!r.anime || hasAny(anime, r.anime)));
  if (exact) {
    return {
      role: exact.role,
      type: exact.role,
      element: exact.element,
      passive: scalePassiveByRarity(exact.passive, rarity),
      source:'exact'
    };
  }

  const animeRule = ANIME_RULES.find(r => hasAny(anime, r.anime));
  if (animeRule) {
    return {
      role: animeRule.role,
      type: animeRule.role,
      element: animeRule.element,
      passive: scalePassiveByRarity(animeRule.passive, rarity),
      source:'anime'
    };
  }

  const role = fallbackRoleByName(combined);
  const element = fallbackElementByText(combined);
  return {
    role,
    type: role,
    element,
    passive: scalePassiveByRarity({
      name:`${element} ${role} Instinct`,
      effect:{ dmg:8, energyGain:5 }
    }, rarity),
    source:'fallback'
  };
}

function roleOf(character={}) {
  return getCombatProfile(character).role;
}

function elementOf(character={}) {
  return getCombatProfile(character).element;
}

function passiveOf(character={}) {
  return getCombatProfile(character).passive;
}

module.exports = {
  getCombatProfile,
  roleOf,
  elementOf,
  passiveOf,
  rarityValue
};
