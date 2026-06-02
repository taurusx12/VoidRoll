// VoidRoll Reborn - Phase 39 Variant Presentation System
// Separates base characters from special variants and powers cinematic reveals.

function normalize(v='') {
  return String(v || '')
    .toLowerCase()
    .replace(/[().\-_:/'’"]/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function cleanVariantName(name='') {
  return String(name || '')
    .replace(/\s*\([^)]*\)\s*/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

const VARIANT_PREFIXES = [
  'Corrupted','Absolute','Voidborn','Eclipse','Abyssal','True Form','Awakened',
  'Divine','Hollow','Bankai','Domain','Final Form','God Form','Prime',
  'Demon King','Shadow','Limit Break','Transcendent'
];

const PREFIX_ORDER = VARIANT_PREFIXES.map(x => normalize(x));

function hasVariantKeyword(text='') {
  const n = normalize(text);
  return PREFIX_ORDER.some(k => n.includes(k));
}

function getVariantKeyword(text='') {
  const n = normalize(text);
  return VARIANT_PREFIXES.find(v => n.includes(normalize(v))) || null;
}

function baseNameOf(name='') {
  let out = cleanVariantName(name);
  for (const p of VARIANT_PREFIXES) {
    const re = new RegExp(`^${p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s+`, 'i');
    out = out.replace(re, '');
  }
  out = out
    .replace(/\b(corrupted|absolute|voidborn|eclipse|abyssal|awakened|divine|hollow|bankai|domain|prime|transcendent)\b/ig, ' ')
    .replace(/\s+/g,' ')
    .trim();
  return out || cleanVariantName(name);
}

const EXACT_VARIANTS = [
  {
    match:['corrupted aizen','corrupted sousuke aizen'],
    base:'Aizen',
    title:'Corrupted Aizen',
    variant:'Corrupted',
    eventType:'CORRUPTED_SECRET',
    rarity:'SECRET',
    element:'VOID',
    type:'INTELLIGENCE',
    role:'SUPPORT',
    quote:"Since when were you under the impression that I wasn't using Kyoka Suigetsu?",
    passiveName:"The Illusion's Peak",
    passiveText:'All enemies are placed under Kyoka Suigetsu: heavy enemy miss, silence, and ATK reduction at battle start.',
    lore:'Having transcended beyond reason, Aizen no longer follows any path. He stands above all, in a world of his own creation.',
    color:0x7c3aed
  },
  {
    match:['absolute lelouch','absolute lelouch lamperouge'],
    base:'Lelouch',
    title:'Absolute Lelouch',
    variant:'Absolute',
    eventType:'ABSOLUTE_SECRET',
    rarity:'SECRET',
    element:'DARK',
    type:'INTELLIGENCE',
    role:'CONTROL',
    quote:'Obey me, world.',
    passiveName:'Absolute Geass',
    passiveText:'Commands the battlefield: stuns enemies, drains energy, and lowers enemy attack.',
    lore:'A king whose command pierces fate itself. This form represents the moment strategy becomes destiny.',
    color:0x8b5cf6
  },
  {
    match:['corrupted lelouch','corrupted lelouch lamperouge'],
    base:'Lelouch',
    title:'Corrupted Lelouch',
    variant:'Corrupted',
    eventType:'CORRUPTED_SECRET',
    rarity:'SECRET',
    element:'VOID',
    type:'INTELLIGENCE',
    role:'CONTROL',
    quote:'If the world rejects my command, I will rewrite the world.',
    passiveName:'Corrupted Geass',
    passiveText:'Void Geass weakens all enemies, silences skills, and boosts team damage after enemy debuffs.',
    lore:'A forbidden Geass form born from absolute control and void corruption.',
    color:0x6d28d9
  },
  {
    match:['corrupted makima'],
    base:'Makima',
    title:'Corrupted Makima',
    variant:'Corrupted',
    eventType:'CORRUPTED_SECRET',
    rarity:'SECRET',
    element:'VOID',
    type:'CONTROL',
    role:'CONTROL',
    quote:'You are mine now.',
    passiveName:'Control Devil Eclipse',
    passiveText:'Controls the strongest enemy, drains energy, and empowers allies when enemies are silenced.',
    lore:'A corrupted contract that turns obedience into an unavoidable law.',
    color:0xa855f7
  },
  {
    match:['voidborn rimuru'],
    base:'Rimuru',
    title:'Voidborn Rimuru',
    variant:'Voidborn',
    eventType:'VOIDBORN_EVENT',
    rarity:'VOIDBORN',
    element:'VOID',
    type:'SUMMONER',
    role:'SUMMONER',
    quote:'I will devour everything.',
    passiveName:'Void Predator',
    passiveText:'Consumes enemy defense, heals after attacks, and summons void support.',
    lore:'A Rimuru variant that evolved beyond magicules into void essence.',
    color:0x4f46e5
  },
  {
    match:['eclipse madara'],
    base:'Madara',
    title:'Eclipse Madara',
    variant:'Eclipse',
    eventType:'VOIDBORN_EVENT',
    rarity:'VOIDBORN',
    element:'SHADOW',
    type:'DPS',
    role:'DPS',
    quote:'Wake up to reality.',
    passiveName:'Eclipse Susanoo',
    passiveText:'Boosts AoE damage, counters attacks, and burns weakened enemies.',
    lore:'The battlefield becomes an eclipse under his Susanoo.',
    color:0x581c87
  },
  {
    match:['abyssal ichigo'],
    base:'Ichigo',
    title:'Abyssal Ichigo',
    variant:'Abyssal',
    eventType:'VOIDBORN_EVENT',
    rarity:'VOIDBORN',
    element:'SOUL',
    type:'DPS',
    role:'DPS',
    quote:'My soul will cut through the abyss.',
    passiveName:'Abyssal Bankai',
    passiveText:'High crit, lifesteal, boss damage, and bonus energy gain.',
    lore:'A form that answers the abyss with soul pressure.',
    color:0x4338ca
  },
  {
    match:['true form sukuna'],
    base:'Sukuna',
    title:'True Form Sukuna',
    variant:'True Form',
    eventType:'SECRET_FORM',
    rarity:'SECRET',
    element:'CURSED',
    type:'DPS',
    role:'DPS',
    quote:'Know your place.',
    passiveName:'Malevolent True Shrine',
    passiveText:'Bleeds enemies, executes low HP targets, and deals extreme boss damage.',
    lore:'The old king of curses restored to his true terror.',
    color:0xdc2626
  },
  {
    match:['awakened naruto'],
    base:'Naruto',
    title:'Awakened Naruto',
    variant:'Awakened',
    eventType:'VOIDBORN_EVENT',
    rarity:'VOIDBORN',
    element:'LIGHT',
    type:'DPS',
    role:'DPS',
    quote:'I never go back on my word.',
    passiveName:'Awakened Kurama Will',
    passiveText:'Team damage, healing, counters, and fast ultimate energy gain.',
    lore:'A light variant born from unbreakable will.',
    color:0xf59e0b
  }
];

const GENERIC_VARIANT_PROFILES = {
  corrupted: {
    variant:'Corrupted', eventType:'CORRUPTED_SECRET', rarity:'SECRET', element:'VOID',
    type:'CORRUPTION', role:'CONTROL', color:0x7c3aed,
    passiveName:'Corrupted Aura',
    passiveText:'Reduces enemy attack, drains energy, and boosts damage against debuffed enemies.',
    quote:'The void has rewritten this soul.',
    lore:'A corrupted event variant with a forbidden void aura.'
  },
  absolute: {
    variant:'Absolute', eventType:'ABSOLUTE_SECRET', rarity:'SECRET', element:'DARK',
    type:'INTELLIGENCE', role:'CONTROL', color:0x8b5cf6,
    passiveName:'Absolute Command',
    passiveText:'Controls enemies, lowers enemy attack, and increases team damage.',
    quote:'One command is enough.',
    lore:'An event variant that turns willpower into command.'
  },
  voidborn: {
    variant:'Voidborn', eventType:'VOIDBORN_EVENT', rarity:'VOIDBORN', element:'VOID',
    type:'VOID', role:'DPS', color:0x4f46e5,
    passiveName:'Voidborn Core',
    passiveText:'Gains bonus damage, energy gain, and void resistance.',
    quote:'A legend has awakened from the void.',
    lore:'A voidborn variant awakened by rare void essence.'
  },
  eclipse: {
    variant:'Eclipse', eventType:'VOIDBORN_EVENT', rarity:'VOIDBORN', element:'SHADOW',
    type:'SHADOW', role:'DPS', color:0x581c87,
    passiveName:'Eclipse Aura',
    passiveText:'Adds shadow damage, counter chance, and enemy accuracy reduction.',
    quote:'The light disappears.',
    lore:'A shadow event variant born during an eclipse.'
  },
  abyssal: {
    variant:'Abyssal', eventType:'VOIDBORN_EVENT', rarity:'VOIDBORN', element:'SOUL',
    type:'ABYSS', role:'DPS', color:0x4338ca,
    passiveName:'Abyssal Pressure',
    passiveText:'Adds lifesteal, crit, and boss damage.',
    quote:'The abyss answers.',
    lore:'A deep abyss variant with unstable soul pressure.'
  },
  awakened: {
    variant:'Awakened', eventType:'EVENT_FORM', rarity:'DIVINE', element:'LIGHT',
    type:'AWAKENED', role:'DPS', color:0xf59e0b,
    passiveName:'Awakened Will',
    passiveText:'Adds team damage, energy gain, and comeback healing.',
    quote:'Power awakens when resolve refuses to fall.',
    lore:'An awakened form unlocked through extreme resolve.'
  },
  divine: {
    variant:'Divine', eventType:'DIVINE_EVENT', rarity:'DIVINE', element:'LIGHT',
    type:'DIVINE', role:'SUPPORT', color:0xffffff,
    passiveName:'Divine Authority',
    passiveText:'Starts with shield, buffs team damage, and improves healing.',
    quote:'A divine presence enters the battlefield.',
    lore:'A divine event variant with rare support power.'
  }
};

function exactProfileFor(character={}) {
  const n = normalize(character.name);
  return EXACT_VARIANTS.find(v => v.match.some(m => n === normalize(m) || n.includes(normalize(m)))) || null;
}

function getVariantProfile(character={}) {
  const exact = exactProfileFor(character);
  if (exact) return { ...exact, isVariant:true, baseName:exact.base };

  const kw = getVariantKeyword(character.name);
  if (!kw) return {
    isVariant:false,
    baseName:baseNameOf(character.name),
    title:cleanVariantName(character.name),
    variant:'Base',
    eventType:'BASE',
    rarity:character.rarity,
    element:character.element,
    role:character.role,
    type:character.type || character.role,
    color:0x5865f2,
    quote:'A hero joins the archive.',
    passiveName:null,
    passiveText:null,
    lore:null
  };

  const key = normalize(kw).split(' ')[0];
  const g = GENERIC_VARIANT_PROFILES[key] || GENERIC_VARIANT_PROFILES.voidborn;
  const base = baseNameOf(character.name);
  return {
    ...g,
    isVariant:true,
    baseName:base,
    title:cleanVariantName(character.name),
    rarity:character.rarity || g.rarity
  };
}

function isSpecialVariant(character={}) {
  return !!getVariantProfile(character).isVariant;
}

function queryHasVariant(query='') {
  return hasVariantKeyword(query);
}

function searchScoreAdjustment(character={}, query='') {
  const q = normalize(query);
  const p = getVariantProfile(character);
  if (!p.isVariant) return queryHasVariant(q) ? -5000 : 2500;

  const variant = normalize(p.variant);
  const title = normalize(p.title);
  const base = normalize(p.baseName);

  let score = 0;
  if (title === q) score += 2000000;
  if (q.includes(variant) && title.includes(q)) score += 1000000;
  if (q.includes(variant) && title.includes(variant)) score += 500000;
  if (q === base && !queryHasVariant(q)) score -= 600000;
  if (!queryHasVariant(q)) score -= 350000;
  return score;
}

function variantFamilyKey(character={}) {
  return normalize(baseNameOf(character.name));
}

function revealData(character={}) {
  const p = getVariantProfile(character);
  const rarity = p.rarity || character.rarity || 'SECRET';
  const title = p.title || cleanVariantName(character.name);
  const color = p.color || (rarity === 'SECRET' ? 0x7c3aed : 0x4f46e5);
  return {
    ...p,
    title,
    rarity,
    anime:character.anime || 'Unknown',
    power:character.basePower || character.power || 0,
    imageUrl:character.imageUrl,
    color,
    steps:[
      { label:'1. DARKNESS', title:'🌑 Darkness', text:'A dark aura begins to gather...' },
      { label:'2. DISTORTION', title:'🕳️ Distortion', text:`The silhouette of **${title}** tears through reality.` },
      { label:'3. QUOTE APPEARS', title:'💬 Quote Appears', text:`“${p.quote || 'A legend has awakened from the void.'}”` },
      { label:'4. SECRET FLASH', title:`${rarity === 'SECRET' ? '🌠 SECRET FLASH' : '🌌 VOID FLASH'}`, text:`**${rarity}** energy erupts across the banner.` },
      { label:'5. CHARACTER REVEAL', title:`${rarity === 'SECRET' ? '🌠' : '🌌'} ${title}`, text:`**${title}** has been revealed.` }
    ]
  };
}

function buildRevealEmbeds(EmbedBuilder, character={}, extraText='') {
  const d = revealData(character);
  return d.steps.map((step, idx) => {
    const isFinal = idx === d.steps.length - 1;
    const e = new EmbedBuilder()
      .setTitle(step.title)
      .setDescription([
        step.text,
        '',
        isFinal ? `Rarity: **${d.rarity}**` : '',
        isFinal ? `Element: **${d.element || character.element || 'VOID'}**` : '',
        isFinal ? `Type: **${d.type || d.role || 'SPECIAL'}**` : '',
        isFinal ? `Role: **${d.role || character.role || 'DPS'}**` : '',
        isFinal && d.passiveName ? `Passive: **${d.passiveName}** — ${d.passiveText}` : '',
        isFinal && d.lore ? `Lore: ${d.lore}` : '',
        extraText && isFinal ? extraText : ''
      ].filter(Boolean).join('\n'))
      .setColor(d.color || 0x7c3aed)
      .setFooter({ text: step.label });
    if (isFinal && d.imageUrl) e.setImage(d.imageUrl);
    return e;
  });
}

function groupVariants(characters=[]) {
  const map = new Map();
  for (const c of characters) {
    const key = variantFamilyKey(c);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ character:c, profile:getVariantProfile(c) });
  }
  return map;
}

module.exports = {
  normalize,
  baseNameOf,
  getVariantProfile,
  isSpecialVariant,
  queryHasVariant,
  searchScoreAdjustment,
  variantFamilyKey,
  revealData,
  buildRevealEmbeds,
  groupVariants
};
