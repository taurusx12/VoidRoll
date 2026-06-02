// VoidRoll Reborn - Phase 30 Role/Element Rebalance System
// Goal: reduce NEUTRAL/DPS overload and make Support/Tank/Control/Healer meaningful.

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

const EXACT_PROFILES = [
  // Jujutsu Kaisen
  { keys:['gojo','gojou','satoru'], anime:['jujutsu'], role:'CONTROL', element:'CURSED', passive:{ name:'Infinity Limitless', effect:{ dodge:28, shield:1, crit:8, energyGain:8 } } },
  { keys:['sukuna','ryoumen'], anime:['jujutsu'], role:'DPS', element:'CURSED', passive:{ name:'Malevolent Shrine', effect:{ bleed:26, bossDmg:32, execute:18, dmg:10 } } },
  { keys:['itadori','yuji'], anime:['jujutsu'], role:'DPS', element:'CURSED', passive:{ name:'Black Flash Chain', effect:{ crit:18, stun:10, energyGain:10 } } },
  { keys:['megumi','fushiguro'], anime:['jujutsu'], role:'SUMMONER', element:'SHADOW', passive:{ name:'Ten Shadows Technique', effect:{ summon:1, dodge:10, enemyAtk:-8 } } },
  { keys:['nobara'], anime:['jujutsu'], role:'CONTROL', element:'CURSED', passive:{ name:'Resonance Nail', effect:{ bleed:18, stun:12, bossDmg:12 } } },
  { keys:['yuta','okkotsu'], anime:['jujutsu'], role:'SUPPORT', element:'CURSED', passive:{ name:'Rika Bond', effect:{ shield:1, teamDmg:10, heal:10, summon:1 } } },

  // Bleach
  { keys:['aizen'], anime:['bleach'], role:'CONTROL', element:'SOUL', passive:{ name:'Kyoka Suigetsu', effect:{ miss:24, silence:16, enemyAtk:-12, energyDrain:10 } } },
  { keys:['ichigo'], anime:['bleach'], role:'DPS', element:'SOUL', passive:{ name:'Bankai Soul Pressure', effect:{ crit:14, lifesteal:10, bossDmg:18, energyGain:8 } } },
  { keys:['orihime'], anime:['bleach'], role:'HEALER', element:'LIGHT', passive:{ name:'Santen Kesshun', effect:{ heal:22, shield:1, enemyAtk:-6 } } },
  { keys:['rukia'], anime:['bleach'], role:'CONTROL', element:'ICE', passive:{ name:'Sode no Shirayuki', effect:{ freeze:22, silence:10, dodge:8 } } },
  { keys:['kenpachi'], anime:['bleach'], role:'TANK', element:'SOUL', passive:{ name:'Nozarashi Bloodlust', effect:{ counter:20, dmg:18, heal:6 } } },
  { keys:['byakuya'], anime:['bleach'], role:'CONTROL', element:'SOUL', passive:{ name:'Senbonzakura', effect:{ bleed:14, dodge:10, silence:10 } } },
  { keys:['yhwach'], anime:['bleach'], role:'CONTROL', element:'VOID', passive:{ name:'The Almighty', effect:{ dodge:18, silence:22, counter:18, energyDrain:15 } } },

  // Naruto
  { keys:['naruto'], anime:['naruto','boruto'], role:'DPS', element:'LIGHT', passive:{ name:'Unbreakable Will of Kurama', effect:{ heal:12, teamDmg:10, counter:10, energyGain:10 } } },
  { keys:['sasuke'], anime:['naruto','boruto'], role:'ASSASSIN', element:'LIGHTNING', passive:{ name:'Rinnegan Chidori', effect:{ crit:18, dodge:12, silence:12, dmg:12 } } },
  { keys:['sakura','tsunade'], anime:['naruto','boruto'], role:'HEALER', element:'LIGHT', passive:{ name:'Hundred Healings', effect:{ heal:24, teamDmg:6, shield:1 } } },
  { keys:['kakashi'], anime:['naruto','boruto'], role:'CONTROL', element:'LIGHTNING', passive:{ name:'Copy Ninja', effect:{ dodge:14, silence:12, crit:10 } } },
  { keys:['gaara'], anime:['naruto','boruto'], role:'TANK', element:'EARTH', passive:{ name:'Sand Shield', effect:{ shield:1, enemyAtk:-10, counter:8 } } },
  { keys:['hinata'], anime:['naruto','boruto'], role:'SUPPORT', element:'LIGHT', passive:{ name:'Byakugan Guard', effect:{ teamDmg:8, dodge:10, heal:8 } } },
  { keys:['shikamaru'], anime:['naruto','boruto'], role:'CONTROL', element:'SHADOW', passive:{ name:'Shadow Possession', effect:{ stun:18, enemyAtk:-10, energyDrain:8 } } },
  { keys:['itachi'], anime:['naruto','boruto'], role:'CONTROL', element:'SHADOW', passive:{ name:'Tsukuyomi', effect:{ miss:18, stun:18, silence:12, enemyAtk:-10 } } },
  { keys:['madara'], anime:['naruto','boruto'], role:'DPS', element:'SHADOW', passive:{ name:'Eternal Mangekyo Dominion', effect:{ burn:18, dmg:22, counter:14, enemyAtk:-8 } } },

  // One Piece
  { keys:['luffy'], anime:['one piece'], role:'TANK', element:'LIGHT', passive:{ name:'Gear Willpower', effect:{ counter:14, dodge:10, dmg:14, heal:8 } } },
  { keys:['zoro'], anime:['one piece'], role:'ASSASSIN', element:'WIND', passive:{ name:'Three Sword Style', effect:{ crit:22, bleed:16, dmg:12 } } },
  { keys:['sanji'], anime:['one piece'], role:'ASSASSIN', element:'FIRE', passive:{ name:'Diable Jambe', effect:{ burn:18, dodge:12, crit:12 } } },
  { keys:['nami'], anime:['one piece'], role:'SUPPORT', element:'LIGHTNING', passive:{ name:'Weather Tempo', effect:{ teamDmg:8, stun:10, dodge:8 } } },
  { keys:['chopper'], anime:['one piece'], role:'HEALER', element:'NATURE', passive:{ name:'Doctor Rumble', effect:{ heal:20, shield:1, teamDmg:5 } } },
  { keys:['robin'], anime:['one piece'], role:'CONTROL', element:'DARK', passive:{ name:'Demonio Fleur', effect:{ stun:16, silence:10, enemyAtk:-8 } } },

  // Dragon Ball
  { keys:['goku'], anime:['dragon ball'], role:'DPS', element:'LIGHT', passive:{ name:'Saiyan Limit Break', effect:{ dmg:18, energyGain:18, crit:10, heal:6 } } },
  { keys:['vegeta'], anime:['dragon ball'], role:'DPS', element:'LIGHTNING', passive:{ name:'Prince Pride', effect:{ crit:16, counter:14, dmg:16 } } },
  { keys:['piccolo'], anime:['dragon ball'], role:'SUPPORT', element:'NATURE', passive:{ name:'Namekian Mentor', effect:{ heal:12, teamDmg:8, shield:1 } } },
  { keys:['gohan'], anime:['dragon ball'], role:'DPS', element:'LIGHT', passive:{ name:'Beast Potential', effect:{ crit:18, bossDmg:18, energyGain:10 } } },
  { keys:['trunks'], anime:['dragon ball'], role:'ASSASSIN', element:'LIGHTNING', passive:{ name:'Future Slash', effect:{ crit:20, bleed:12, dodge:10 } } },

  // Chainsaw Man
  { keys:['makima'], anime:['chainsaw man'], role:'CONTROL', element:'VOID', passive:{ name:'Control Devil Contract', effect:{ silence:24, enemyAtk:-14, teamDmg:12, energyDrain:12 } } },
  { keys:['denji'], anime:['chainsaw man'], role:'DPS', element:'BLOOD', passive:{ name:'Chainsaw Devil', effect:{ bleed:22, lifesteal:12, dmg:12 } } },
  { keys:['power'], anime:['chainsaw man'], role:'DPS', element:'BLOOD', passive:{ name:'Blood Fiend', effect:{ bleed:20, crit:10, heal:8 } } },
  { keys:['aki'], anime:['chainsaw man'], role:'CONTROL', element:'DARK', passive:{ name:'Fox Devil Contract', effect:{ silence:12, bleed:10, bossDmg:12 } } },
  { keys:['kobeni'], anime:['chainsaw man'], role:'ASSASSIN', element:'DARK', passive:{ name:'Panic Reflex', effect:{ dodge:22, crit:12, counter:8 } } },

  // Demon Slayer
  { keys:['tanjiro'], anime:['kimetsu','demon slayer'], role:'DPS', element:'WATER', passive:{ name:'Hinokami Kagura', effect:{ burn:16, crit:10, bossDmg:16 } } },
  { keys:['nezuko'], anime:['kimetsu','demon slayer'], role:'SUPPORT', element:'BLOOD', passive:{ name:'Demon Blood Recovery', effect:{ heal:16, teamDmg:8, burn:10 } } },
  { keys:['zenitsu'], anime:['kimetsu','demon slayer'], role:'ASSASSIN', element:'LIGHTNING', passive:{ name:'Thunder Breathing', effect:{ crit:24, dodge:12, stun:10 } } },
  { keys:['inosuke'], anime:['kimetsu','demon slayer'], role:'TANK', element:'BEAST', passive:{ name:'Beast Breathing', effect:{ counter:16, dmg:12, heal:6 } } },
  { keys:['shinobu'], anime:['kimetsu','demon slayer'], role:'CONTROL', element:'POISON', passive:{ name:'Insect Poison', effect:{ poison:22, silence:10, dodge:10 } } },
  { keys:['rengoku'], anime:['kimetsu','demon slayer'], role:'DPS', element:'FIRE', passive:{ name:'Flame Hashira', effect:{ burn:20, teamDmg:8, bossDmg:12 } } },
  { keys:['yoriichi'], anime:['kimetsu','demon slayer'], role:'ASSASSIN', element:'FIRE', passive:{ name:'Sun Breathing Origin', effect:{ crit:30, burn:22, bossDmg:26 } } },

  // Attack on Titan
  { keys:['eren'], anime:['shingeki','attack on titan'], role:'TANK', element:'BLOOD', passive:{ name:'Founding Rage', effect:{ counter:16, heal:10, teamDmg:8, enemyAtk:-8 } } },
  { keys:['mikasa'], anime:['shingeki','attack on titan'], role:'ASSASSIN', element:'WIND', passive:{ name:'Ackerman Blade', effect:{ crit:22, dodge:16, bleed:10 } } },
  { keys:['levi'], anime:['shingeki','attack on titan'], role:'ASSASSIN', element:'WIND', passive:{ name:'Ackerman Instinct', effect:{ crit:24, dodge:18, bleed:14 } } },
  { keys:['armin'], anime:['shingeki','attack on titan'], role:'CONTROL', element:'FIRE', passive:{ name:'Colossal Strategy', effect:{ burn:14, enemyAtk:-10, teamDmg:8 } } },

  // Common icons
  { keys:['rem'], anime:['re zero'], role:'SUPPORT', element:'ICE', passive:{ name:'Oni Devotion', effect:{ heal:12, teamDmg:10, counter:8 } } },
  { keys:['emilia'], anime:['re zero'], role:'CONTROL', element:'ICE', passive:{ name:'Spirit Ice', effect:{ freeze:18, shield:1, dodge:8 } } },
  { keys:['subaru'], anime:['re zero'], role:'TANK', element:'DARK', passive:{ name:'Return by Death', effect:{ heal:18, counter:10, enemyAtk:-6 } } },
  { keys:['kirito'], anime:['sword art'], role:'ASSASSIN', element:'LIGHT', passive:{ name:'Dual Blades', effect:{ crit:20, dodge:14, dmg:10 } } },
  { keys:['asuna'], anime:['sword art'], role:'SUPPORT', element:'LIGHT', passive:{ name:'Flash Support', effect:{ teamDmg:10, heal:10, dodge:10 } } },
  { keys:['kaneki'], anime:['tokyo ghoul'], role:'DPS', element:'BLOOD', passive:{ name:'Kagune Hunger', effect:{ lifesteal:16, bleed:12, crit:8 } } },
  { keys:['natsu'], anime:['fairy tail'], role:'DPS', element:'FIRE', passive:{ name:'Dragon Slayer Flame', effect:{ burn:20, dmg:14, energyGain:8 } } },
  { keys:['lucy'], anime:['fairy tail'], role:'SUMMONER', element:'LIGHT', passive:{ name:'Celestial Keys', effect:{ summon:1, teamDmg:8, heal:6 } } },
  { keys:['gray'], anime:['fairy tail'], role:'CONTROL', element:'ICE', passive:{ name:'Ice Make', effect:{ freeze:18, shield:1, bossDmg:8 } } },
  { keys:['rimuru'], anime:['slime','tensei shitara slime'], role:'SUMMONER', element:'VOID', passive:{ name:'Predator Great Sage', effect:{ lifesteal:18, pen:18, teamDmg:8, summon:1 } } },
  { keys:['ainz'], anime:['overlord'], role:'CONTROL', element:'DARK', passive:{ name:'Overlord Magic', effect:{ silence:18, enemyAtk:-12, summon:1 } } },
  { keys:['albedo'], anime:['overlord'], role:'TANK', element:'DARK', passive:{ name:'Guardian Armor', effect:{ shield:1, counter:12, enemyAtk:-8 } } },
  { keys:['jin woo','jinwoo','sung jin'], anime:['solo leveling'], role:'SUMMONER', element:'SHADOW', passive:{ name:'Shadow Monarch', effect:{ summon:1, teamDmg:14, lifesteal:10 } } },
  { keys:['lelouch'], anime:['code geass'], role:'CONTROL', element:'DARK', passive:{ name:'Absolute Geass', effect:{ stun:24, silence:18, enemyAtk:-12, energyDrain:12 } } },
  { keys:['light yagami','yagami light'], anime:['death note'], role:'CONTROL', element:'DARK', passive:{ name:'Death Note Judgment', effect:{ execute:20, silence:20, enemyAtk:-12 } } }
];

const ANIME_RULES = [
  { anime:['bleach'], role:'DPS', element:'SOUL', passive:{ name:'Soul Pressure', effect:{ crit:8, lifesteal:6, bossDmg:10 } } },
  { anime:['jujutsu'], role:'CONTROL', element:'CURSED', passive:{ name:'Cursed Technique', effect:{ bleed:10, silence:8, bossDmg:10 } } },
  { anime:['naruto','boruto'], role:'ASSASSIN', element:'SHADOW', passive:{ name:'Shinobi Tactics', effect:{ dodge:8, counter:8, energyGain:6 } } },
  { anime:['one piece'], role:'DPS', element:'WIND', passive:{ name:'Pirate Ambition', effect:{ counter:8, crit:8, dmg:8 } } },
  { anime:['dragon ball'], role:'DPS', element:'LIGHT', passive:{ name:'Ki Burst', effect:{ dmg:12, energyGain:10, crit:6 } } },
  { anime:['chainsaw man'], role:'CONTROL', element:'DARK', passive:{ name:'Devil Contract', effect:{ bleed:10, enemyAtk:-8, silence:8 } } },
  { anime:['kimetsu','demon slayer'], role:'ASSASSIN', element:'FIRE', passive:{ name:'Breathing Form', effect:{ crit:8, burn:8, bossDmg:8 } } },
  { anime:['attack on titan','shingeki'], role:'TANK', element:'BLOOD', passive:{ name:'Titan Resolve', effect:{ counter:8, heal:6, enemyAtk:-6 } } },
  { anime:['black clover'], role:'DPS', element:'DARK', passive:{ name:'Grimoire Surge', effect:{ silence:8, dmg:10, energyGain:6 } } },
  { anime:['hero academia','boku no hero'], role:'SUPPORT', element:'LIGHTNING', passive:{ name:'Quirk Teamwork', effect:{ dmg:8, teamDmg:8, shield:1 } } },
  { anime:['hunter'], role:'ASSASSIN', element:'LIGHTNING', passive:{ name:'Nen Flow', effect:{ dodge:10, crit:10, stun:6 } } },
  { anime:['fate'], role:'TANK', element:'LIGHT', passive:{ name:'Noble Phantasm', effect:{ shield:1, bossDmg:10, teamDmg:5 } } },
  { anime:['sword art online','sword art'], role:'ASSASSIN', element:'LIGHT', passive:{ name:'Dual Blade Burst', effect:{ crit:12, dodge:10, dmg:8 } } },
  { anime:['tokyo ghoul'], role:'DPS', element:'BLOOD', passive:{ name:'Kagune Hunger', effect:{ lifesteal:12, bleed:8, crit:6 } } },
  { anime:['fairy tail'], role:'SUMMONER', element:'FIRE', passive:{ name:'Guild Magic', effect:{ burn:10, teamDmg:6, energyGain:6 } } },
  { anime:['slime'], role:'SUMMONER', element:'VOID', passive:{ name:'Great Sage', effect:{ lifesteal:8, pen:8, teamDmg:6 } } },
  { anime:['solo leveling'], role:'SUMMONER', element:'SHADOW', passive:{ name:'Shadow Monarch Call', effect:{ summon:1, teamDmg:10, lifesteal:8 } } },
  { anime:['overlord'], role:'CONTROL', element:'DARK', passive:{ name:'Floor Guardian Aura', effect:{ silence:10, enemyAtk:-8, summon:1 } } },
  { anime:['re zero'], role:'SUPPORT', element:'ICE', passive:{ name:'Return Support', effect:{ heal:10, shield:1, teamDmg:6 } } },
  { anime:['konosuba'], role:'SUPPORT', element:'LIGHT', passive:{ name:'Party Chaos Buff', effect:{ teamDmg:8, heal:8, crit:6 } } },
  { anime:['death note'], role:'CONTROL', element:'DARK', passive:{ name:'Judgment Strategy', effect:{ silence:14, execute:10, enemyAtk:-8 } } },
  { anime:['code geass'], role:'CONTROL', element:'DARK', passive:{ name:'Geass Command', effect:{ stun:14, silence:10, enemyAtk:-8 } } },
  { anime:['blue lock'], role:'DPS', element:'WIND', passive:{ name:'Egoist Strike', effect:{ crit:12, dmg:10, energyGain:6 } } },
  { anime:['haikyuu'], role:'SUPPORT', element:'WIND', passive:{ name:'Team Rally', effect:{ teamDmg:10, dodge:6, heal:6 } } },
  { anime:['kuroko'], role:'SUPPORT', element:'LIGHT', passive:{ name:'Misdirection Assist', effect:{ teamDmg:10, dodge:8, miss:8 } } },
  { anime:['spy x family'], role:'CONTROL', element:'DARK', passive:{ name:'Secret Family Tactics', effect:{ silence:10, dodge:8, teamDmg:6 } } },
  { anime:['frieren'], role:'CONTROL', element:'LIGHT', passive:{ name:'Ancient Magic', effect:{ silence:10, bossDmg:12, shield:1 } } },
  { anime:['oshi no ko'], role:'SUPPORT', element:'LIGHT', passive:{ name:'Star Aura', effect:{ teamDmg:10, enemyAtk:-6, energyGain:6 } } }
];

const ROLE_NAME_RULES = [
  { keys:['orihime','sakura','tsunade','chopper','recovery','healer','doctor','nurse','priest','cleric','medic'], role:'HEALER', element:'LIGHT', passive:{ name:'Healing Arts', effect:{ heal:18, shield:1, teamDmg:4 } } },
  { keys:['teacher','mentor','manager','coach','idol','princess','queen','saint','support','assistant'], role:'SUPPORT', element:'LIGHT', passive:{ name:'Team Support Aura', effect:{ teamDmg:10, heal:8, energyGain:6 } } },
  { keys:['king','emperor','commander','captain','leader','strategist','detective','genius','lord'], role:'CONTROL', element:'DARK', passive:{ name:'Command Authority', effect:{ enemyAtk:-10, silence:10, energyDrain:6 } } },
  { keys:['shield','armor','giant','titan','wall','guardian','knight','paladin','golem'], role:'TANK', element:'EARTH', passive:{ name:'Guardian Stance', effect:{ shield:1, counter:10, enemyAtk:-6 } } },
  { keys:['assassin','blade','killer','ninja','thief','rogue','sniper','archer'], role:'ASSASSIN', element:'WIND', passive:{ name:'Killer Instinct', effect:{ crit:14, dodge:12, bleed:8 } } },
  { keys:['summoner','necromancer','beast','spirit','familiar','puppet','shadow monarch'], role:'SUMMONER', element:'SHADOW', passive:{ name:'Summon Pact', effect:{ summon:1, teamDmg:8, lifesteal:6 } } }
];

const ELEMENT_NAME_RULES = [
  { keys:['dark','demon','devil','ghoul','death','night','curse','cursed'], element:'DARK' },
  { keys:['light','holy','angel','sun','star','saint'], element:'LIGHT' },
  { keys:['fire','flame','burn','dragon','magma'], element:'FIRE' },
  { keys:['ice','snow','frost','winter'], element:'ICE' },
  { keys:['thunder','lightning','electric','bolt'], element:'LIGHTNING' },
  { keys:['shadow','abyss','void','black'], element:'SHADOW' },
  { keys:['soul','spirit','ghost','shinigami'], element:'SOUL' },
  { keys:['blood','vampire'], element:'BLOOD' },
  { keys:['wind','air','storm'], element:'WIND' },
  { keys:['water','sea','aqua','ocean'], element:'WATER' },
  { keys:['earth','sand','stone','rock'], element:'EARTH' },
  { keys:['poison','venom','insect'], element:'POISON' },
  { keys:['nature','forest','plant','flower'], element:'NATURE' }
];

function seededIndex(text, modulo) {
  let h = 0;
  for (let i=0;i<text.length;i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h % modulo;
}

const FALLBACK_ROLES = ['DPS','ASSASSIN','CONTROL','TANK','SUPPORT','HEALER','SUMMONER'];
const FALLBACK_ELEMENTS = ['DARK','LIGHT','FIRE','ICE','LIGHTNING','SHADOW','SOUL','CURSED','BLOOD','WIND','WATER','EARTH','POISON','NATURE'];

function fallbackRoleAndPassive(text) {
  for (const rule of ROLE_NAME_RULES) {
    if (hasAny(text, rule.keys)) return { role:rule.role, passive:rule.passive, source:'name' };
  }

  const idx = seededIndex(text || 'unknown', 100);
  if (idx < 38) return { role:'DPS', passive:{ name:'Battle Instinct', effect:{ dmg:9, crit:6, energyGain:5 } }, source:'balanced' };
  if (idx < 54) return { role:'ASSASSIN', passive:{ name:'Swift Execution', effect:{ crit:12, dodge:10, bleed:6 } }, source:'balanced' };
  if (idx < 68) return { role:'CONTROL', passive:{ name:'Pressure Control', effect:{ silence:8, enemyAtk:-8, energyDrain:5 } }, source:'balanced' };
  if (idx < 80) return { role:'TANK', passive:{ name:'Iron Guard', effect:{ shield:1, counter:8, enemyAtk:-5 } }, source:'balanced' };
  if (idx < 90) return { role:'SUPPORT', passive:{ name:'Team Rally', effect:{ teamDmg:8, heal:6, energyGain:5 } }, source:'balanced' };
  if (idx < 96) return { role:'HEALER', passive:{ name:'Recovery Aura', effect:{ heal:14, shield:1, teamDmg:4 } }, source:'balanced' };
  return { role:'SUMMONER', passive:{ name:'Spirit Call', effect:{ summon:1, teamDmg:6, lifesteal:5 } }, source:'balanced' };
}

function fallbackElement(text) {
  for (const rule of ELEMENT_NAME_RULES) {
    if (hasAny(text, rule.keys)) return rule.element;
  }
  return FALLBACK_ELEMENTS[seededIndex(text || 'unknown', FALLBACK_ELEMENTS.length)];
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

  const nameBased = ROLE_NAME_RULES.find(r => hasAny(combined, r.keys));
  const animeRule = ANIME_RULES.find(r => hasAny(anime, r.anime));

  if (nameBased) {
    return {
      role: nameBased.role,
      type: nameBased.role,
      element: fallbackElement(combined),
      passive: scalePassiveByRarity(nameBased.passive, rarity),
      source:'name'
    };
  }

  if (animeRule) {
    return {
      role: animeRule.role,
      type: animeRule.role,
      element: animeRule.element,
      passive: scalePassiveByRarity(animeRule.passive, rarity),
      source:'anime'
    };
  }

  const fb = fallbackRoleAndPassive(combined);
  const element = fallbackElement(combined);

  return {
    role: fb.role,
    type: fb.role,
    element,
    passive: scalePassiveByRarity(fb.passive, rarity),
    source:fb.source
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
