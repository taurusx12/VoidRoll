require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const { nanoid } = require('nanoid');

const config = require('./lib/config');
const { prisma } = require('./lib/db');
const { ensureUser } = require('./services/users');
const { rollCard } = require('./services/gacha');
const { checkCooldown, setCooldown } = require('./services/cooldowns');
const market = require('./services/market');
const equipment = require('./services/equipment');
const { getAura, embedColor } = require('./lib/aura');
const { renderCard } = require('./services/cardRender');
const { rollItem, itemLine, seedItemTemplates } = require('./services/itemSystem');
const bannerSystem = require('./services/bannerSystem');
const { fusionText, starLabel } = require('./services/duplicateFusion');
const { isSecretCandidate, classifyCharacter } = require('./lib/secretCharacters');
const { syncAllCardPowers } = require('./powerSyncPatch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const activeBosses = new Map();
const pendingTrades = new Map();



function characterRole(character) {
  const n = phase2Normalize(character?.name || '');
  if (['lelouch','aizen','makima','kurapika'].some(x => n.includes(x))) return 'Control';
  if (['rimuru','megumi','saber','kakashi'].some(x => n.includes(x))) return 'Support';
  if (['whitebeard','kaido','all might','escanor','ainz'].some(x => n.includes(x))) return 'Tank';
  if (['killua','toji','levi','hisoka'].some(x => n.includes(x))) return 'Assassin';
  if (['gojo','madara','gilgamesh','sukuna'].some(x => n.includes(x))) return 'Mage';
  return 'DPS';
}

function characterElement(character) {
  const n = phase2Normalize(character?.name || '');
  if (['sukuna','toji','lelouch','makima','ainz'].some(x => n.includes(x))) return 'Dark';
  if (['sung jin','igris','beru'].some(x => n.includes(x))) return 'Shadow';
  if (['gojo','rimuru','gilgamesh'].some(x => n.includes(x))) return 'Void';
  if (['saber','goku','naruto','luffy'].some(x => n.includes(x))) return 'Light';
  if (['ace','rengoku','natsu'].some(x => n.includes(x))) return 'Fire';
  if (['killua','zenitsu'].some(x => n.includes(x))) return 'Lightning';
  if (['aizen','ichigo'].some(x => n.includes(x))) return 'Soul';
  return cleanElement(character?.element || 'Neutral');
}

function characterPassive(character) {
  const n = phase2Normalize(character?.name || '');
  if (n.includes('lelouch')) return 'Geass: chance to disable enemy ultimate and boost team ult charge.';
  if (n.includes('gojo')) return 'Infinity: chance to ignore incoming damage.';
  if (n.includes('sung jin')) return 'Shadow Monarch: gains power for every defeated enemy.';
  if (n.includes('saber')) return 'Avalon: grants team shield when HP is low.';
  if (n.includes('ainz')) return 'Overlord: boosts dark allies and weakens enemies.';
  if (n.includes('gon') || n.includes('killua')) return 'Hunter Bond: bonus speed when paired with Hunter allies.';
  if (n.includes('kurapika')) return 'Chain Judgment: bonus damage against villain teams.';
  if (n.includes('madara')) return 'Uchiha Dominion: boosts AoE ultimate damage.';
  if (n.includes('aizen')) return 'Kyoka Suigetsu: reduces enemy accuracy.';
  return 'Battle Instinct: small bonus to ATK and Ultimate charge.';
}

function characterStatsText(card, character) {
  const p = Number(card?.power || character?.basePower || 100);
  const role = characterRole(character);
  const atk = Math.floor(p * (role === 'Tank' ? 0.38 : role === 'Support' ? 0.42 : 0.55));
  const def = Math.floor(p * (role === 'Tank' ? 0.45 : role === 'Assassin' ? 0.20 : 0.30));
  const hp = Math.floor(p * (role === 'Tank' ? 9.5 : role === 'Support' ? 7.2 : 6.0));
  const spd = Math.floor(100 + p / 250 + (role === 'Assassin' ? 45 : role === 'Support' ? 25 : 0));
  const crit = role === 'Assassin' ? 35 : role === 'DPS' ? 25 : 15;
  return (
    `Class: **${role}** | Element: **${characterElement(character)}**\n` +
    `ATK **${money(atk)}** • DEF **${money(def)}** • HP **${money(hp)}** • SPD **${spd}**\n` +
    `CRIT **${crit}%**\n` +
    `Passive: ${characterPassive(character)}`
  );
}

function levelCapForCard() {
  return 99;
}

async function addCardLevel(cardId, amount) {
  const card = await prisma.userCard.findUnique({ where: { id: cardId }, include: { character: true } });
  if (!card) throw new Error('Card not found.');
  const add = Math.max(1, Math.min(98, Number(amount || 1)));
  const newLevel = Math.min(99, (card.level || 1) + add);
  const gained = newLevel - (card.level || 1);
  const rarityMult = { COMMON: 25, RARE: 55, EPIC: 110, LEGENDARY: 240, MYTHIC: 520, DIVINE: 1100, SECRET: 2500 }[card.character.rarity] || 50;
  const powerGain = gained * rarityMult;
  return prisma.userCard.update({
    where: { id: card.id },
    data: { level: newLevel, power: { increment: powerGain } },
    include: { character: true }
  });
}




const VALID_ELEMENTS = ['Dark','Light','Fire','Ice','Shadow','Curse','Void','Lightning','Soul','Neutral'];

function cleanElement(value) {
  const raw = String(value || '').trim();
  const found = VALID_ELEMENTS.find(e => phase2Normalize(e) === phase2Normalize(raw));
  return found || 'Neutral';
}

const CANONICAL_ROSTER_FIXES = [
  { key: 'sung jin', name: 'Sung Jin-Woo', anime: 'Solo Leveling', rarity: 'SECRET', power: 9664, element: 'Shadow', q: 'Sung Jin-Woo' },
  { key: 'gojo', name: 'Satoru Gojo', anime: 'Jujutsu Kaisen', rarity: 'SECRET', power: 9400, element: 'Void', q: 'Satoru Gojo' },
  { key: 'saber', name: 'Saber', anime: 'Fate Series', rarity: 'SECRET', power: 9000, element: 'Light', q: 'Artoria Pendragon', imageUrl: null },
  { key: 'artoria', name: 'Saber', anime: 'Fate Series', rarity: 'SECRET', power: 9000, element: 'Light', q: 'Artoria Pendragon', imageUrl: null },
  { key: 'makima', name: 'Makima', anime: 'Chainsaw Man', rarity: 'SECRET', power: 7600, element: 'Dark', q: 'Makima' },
  { key: 'lelouch', name: 'Lelouch Lamperouge', anime: 'Code Geass', rarity: 'SECRET', power: 8800, element: 'Dark', q: 'Lelouch Lamperouge' },
  { key: 'madara', name: 'Madara Uchiha', anime: 'Naruto: Shippuden', rarity: 'SECRET', power: 9000, element: 'Dark', q: 'Madara Uchiha' },
  { key: 'aizen', name: 'Sosuke Aizen', anime: 'Bleach', rarity: 'SECRET', power: 9200, element: 'Void', q: 'Sosuke Aizen' },
  { key: 'sukuna', name: 'Ryomen Sukuna', anime: 'Jujutsu Kaisen', rarity: 'SECRET', power: 8900, element: 'Dark', q: 'Ryomen Sukuna' },
  { key: 'rimuru', name: 'Rimuru Tempest', anime: 'That Time I Got Reincarnated as a Slime', rarity: 'SECRET', power: 9700, element: 'Void', q: 'Rimuru Tempest' },
  { key: 'luffy', name: 'Monkey D. Luffy', anime: 'One Piece', rarity: 'SECRET', power: 8200, element: 'Light', q: 'Monkey D Luffy' },
  { key: 'ichigo', name: 'Ichigo Kurosaki', anime: 'Bleach', rarity: 'SECRET', power: 8800, element: 'Soul', q: 'Ichigo Kurosaki' },
  { key: 'naruto', name: 'Naruto Uzumaki', anime: 'Naruto: Shippuden', rarity: 'SECRET', power: 8500, element: 'Light', q: 'Naruto Uzumaki' },
  { key: 'sasuke', name: 'Sasuke Uchiha', anime: 'Naruto: Shippuden', rarity: 'SECRET', power: 8400, element: 'Dark', q: 'Sasuke Uchiha' },
  { key: 'gon', name: 'Gon Freecss', anime: 'Hunter x Hunter', rarity: 'DIVINE', power: 5200, element: 'Light', q: 'Gon Freecss' },
  { key: 'killua', name: 'Killua Zoldyck', anime: 'Hunter x Hunter', rarity: 'DIVINE', power: 5200, element: 'Lightning', q: 'Killua Zoldyck' },
  { key: 'kurapika', name: 'Kurapika', anime: 'Hunter x Hunter', rarity: 'DIVINE', power: 5200, element: 'Light', q: 'Kurapika' },
  { key: 'toji', name: 'Toji Fushiguro', anime: 'Jujutsu Kaisen', rarity: 'DIVINE', power: 5200, element: 'Dark', q: 'Toji Fushiguro' },
  { key: 'kakashi', name: 'Kakashi Hatake', anime: 'Naruto: Shippuden', rarity: 'DIVINE', power: 4800, element: 'Lightning', q: 'Kakashi Hatake' }
];

function canonicalBaseName(name = '') {
  return phase2Normalize(
    String(name)
      .replace(/\s+\((.*?)\)$/g, '')
      .replace(/\b(base|secret form|true power|final form|divine form|mythic form|royal variant|raid variant|festival variant|battle ready|domain form|early arc|light variant|dark variant|shadow variant|hero variant|demon variant|legendary variant)\b/ig, '')
      .trim()
  );
}

function rosterFixForName(name = '') {
  const clean = canonicalBaseName(name);
  return CANONICAL_ROSTER_FIXES.find(r => clean.includes(phase2Normalize(r.key)));
}


async function findMyAnimeListImage(query) {
  // Disabled: images now use MyAnimeList/Jikan only.
  return null;
}

async function findAnimeImage(query) {
  try {
    const url = `https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=10`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'VoidRollBot/1.0'
      }
    });

    if (!res.ok) return null;

    const data = await res.json();
    const rows = data?.data || [];
    if (!rows.length) return null;

    const q = phase2Normalize(query);

    const picked = rows.find(r => {
      const name = phase2Normalize(r.name || '');
      const nicknames = (r.nicknames || []).map(x => phase2Normalize(x)).join(' ');
      const full = `${name} ${nicknames}`;

      if (q.includes('artoria')) {
        return full.includes('artoria') || full.includes('saber');
      }

      if (q.includes('saber')) {
        return full.includes('artoria') || full.includes('saber');
      }

      return q.split(' ').some(part => part.length > 2 && full.includes(part));
    }) || rows[0];

    return picked?.images?.jpg?.image_url
      || picked?.images?.webp?.image_url
      || null;
  } catch (e) {
    console.error('[MAL/JikanImage] lookup failed:', e.message);
    return null;
  }
}

async function ensureCanonicalCharacter(fix) {
  let existing = await prisma.character.findFirst({
    where: {
      OR: [
        { name: { equals: fix.name, mode: 'insensitive' } },
        { name: { contains: fix.key, mode: 'insensitive' } }
      ]
    },
    orderBy: { basePower: 'desc' }
  }).catch(() => null);

  const imageUrl = fix.imageUrl || existing?.imageUrl || await findAnimeImage(fix.q || fix.name);

  if (!existing) {
    existing = await prisma.character.create({
      data: {
        id: `canon_${phase2Normalize(fix.name).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`,
        name: fix.name,
        anime: fix.anime,
        rarity: fix.rarity,
        element: fix.element,
        imageUrl,
        auraName: `${fix.name} Aura`,
        auraColor: fix.rarity === 'SECRET' ? '#111827' : fix.rarity === 'DIVINE' ? '#f472b6' : '#3b82f6',
        auraSecondary: '#ffffff',
        auraIntensity: fix.rarity === 'SECRET' ? 1.8 : 1.4,
        basePower: fix.power,
        baseFarm: Math.floor(fix.power / 8),
        baseLuck: Math.floor(fix.power / 20),
        limited: fix.rarity === 'SECRET',
        banner: null,
        active: true
      }
    });
  } else {
    existing = await prisma.character.update({
      where: { id: existing.id },
      data: {
        name: fix.name,
        anime: fix.anime,
        rarity: fix.rarity,
        element: fix.element,
        imageUrl: fix.imageUrl || imageUrl || existing.imageUrl,
        basePower: fix.power,
        baseFarm: Math.floor(fix.power / 8),
        baseLuck: Math.floor(fix.power / 20),
        active: true
      }
    });
  }

  return existing;
}



async function getCorrectSaberImage() {
  return await findAnimeImage('Artoria Pendragon')
    || await findAnimeImage('Saber Fate stay night')
    || await findAnimeImage('Saber Fate Zero')
    || null;
}

async function hardFixSaberOneCopy() {
  const saberImage = await getCorrectSaberImage();
  const saberRows = await prisma.character.findMany({
    where: {
      OR: [
        { name: { contains: 'Saber', mode: 'insensitive' } },
        { name: { contains: 'Artoria', mode: 'insensitive' } },
        { anime: { contains: 'Fate', mode: 'insensitive' } }
      ]
    },
    orderBy: { basePower: 'desc' }
  }).catch(() => []);

  let canonical = saberRows.find(c => phase2Normalize(c.name) === 'saber')
    || saberRows.find(c => phase2Normalize(c.name).includes('artoria'))
    || saberRows[0];

  if (!canonical) {
    canonical = await prisma.character.create({
      data: {
        id: 'canon_saber_artoria_only',
        name: 'Saber',
        anime: 'Fate Series',
        rarity: 'SECRET',
        element: 'Light',
        imageUrl: null,
        auraName: 'Avalon Oath',
        auraColor: '#f8fafc',
        auraSecondary: '#fbbf24',
        auraIntensity: 1.8,
        basePower: 9000,
        baseFarm: 1125,
        baseLuck: 450,
        limited: true,
        banner: 'saber_oath',
        active: true
      }
    });
  } else {
    canonical = await prisma.character.update({
      where: { id: canonical.id },
      data: {
        name: 'Saber',
        anime: 'Fate Series',
        rarity: 'SECRET',
        element: 'Light',
        imageUrl: null,
        auraName: 'Avalon Oath',
        auraColor: '#f8fafc',
        auraSecondary: '#fbbf24',
        auraIntensity: 1.8,
        basePower: 9000,
        baseFarm: 1125,
        baseLuck: 450,
        limited: true,
        banner: 'saber_oath',
        active: true
      }
    });
  }

  let moved = 0;
  let hidden = 0;

  for (const row of saberRows) {
    if (row.id === canonical.id) continue;

    const cards = await prisma.userCard.updateMany({
      where: { characterId: row.id },
      data: { characterId: canonical.id }
    }).catch(() => ({ count: 0 }));

    moved += cards.count || 0;

    await prisma.character.update({
      where: { id: row.id },
      data: {
        active: false,
        name: `Hidden Duplicate Saber ${row.id.slice(0, 6)}`,
        imageUrl: null
      }
    }).catch(() => {});

    hidden++;
  }

  return { canonical, moved, hidden };
}

async function collapseRosterVariants() {
  let movedCards = 0;
  let inactiveCharacters = 0;
  let fixedCanon = 0;

  for (const fix of CANONICAL_ROSTER_FIXES) {
    const canonical = await ensureCanonicalCharacter(fix);
    fixedCanon++;

    const duplicates = await prisma.character.findMany({
      where: {
        active: true,
        id: { not: canonical.id },
        name: { contains: fix.key, mode: 'insensitive' }
      }
    }).catch(() => []);

    for (const dupe of duplicates) {
      const move = await prisma.userCard.updateMany({
        where: { characterId: dupe.id },
        data: { characterId: canonical.id }
      }).catch(() => ({ count: 0 }));

      movedCards += move.count || 0;

      await prisma.character.update({
        where: { id: dupe.id },
        data: { active: false }
      }).catch(() => {});

      inactiveCharacters++;
    }
  }

  // Hide ugly generated variant names from active search results.
  const ugly = await prisma.character.findMany({
    where: {
      active: true,
      OR: [
        { id: { startsWith: 'gen_' } },
        { id: { startsWith: 'real_' } }
      ]
    },
    take: 5000
  }).catch(() => []);

  for (const c of ugly) {
    const fix = rosterFixForName(c.name);
    if (fix) continue;
    await prisma.character.update({ where: { id: c.id }, data: { active: false } }).catch(() => {});
    inactiveCharacters++;
  }

  console.log(`[RosterClean] Canon ${fixedCanon}, moved cards ${movedCards}, inactive ${inactiveCharacters}`);
  return { fixedCanon, movedCards, inactiveCharacters };
}

const IMPORTANT_RARITY_FIXES = [
  { keys: ['sung jin-woo', 'sung jin woo', 'jin-woo', 'jin woo'], rarity: 'SECRET', power: 9664, element: 'Shadow' },
  { keys: ['satoru gojo', 'satoru gojou', 'gojo'], rarity: 'SECRET', power: 9400, element: 'Void' },
  { keys: ['lelouch'], rarity: 'SECRET', power: 8800, element: 'Dark' },
  { keys: ['saber', 'artoria'], rarity: 'SECRET', power: 9000, element: 'Light' },
  { keys: ['madara'], rarity: 'SECRET', power: 9000, element: 'Dark' },
  { keys: ['aizen'], rarity: 'SECRET', power: 9200, element: 'Void' },
  { keys: ['sukuna'], rarity: 'SECRET', power: 8900, element: 'Dark' },
  { keys: ['rimuru'], rarity: 'SECRET', power: 9700, element: 'Void' },
  { keys: ['saitama'], rarity: 'SECRET', power: 10000, element: 'Light' },
  { keys: ['gilgamesh'], rarity: 'SECRET', power: 9100, element: 'Light' },
  { keys: ['makima'], rarity: 'SECRET', power: 7600, element: 'Dark' },
  { keys: ['cid kagenou'], rarity: 'SECRET', power: 8800, element: 'Shadow' },
  { keys: ['ainz'], rarity: 'SECRET', power: 8900, element: 'Dark' },

  { keys: ['gon'], rarity: 'DIVINE', power: 5200, element: 'Light' },
  { keys: ['killua'], rarity: 'DIVINE', power: 5200, element: 'Lightning' },
  { keys: ['kurapika'], rarity: 'DIVINE', power: 5200, element: 'Light' },
  { keys: ['kakashi'], rarity: 'DIVINE', power: 4800, element: 'Lightning' },
  { keys: ['toji'], rarity: 'DIVINE', power: 5200, element: 'Dark' }
];

function cleanVariantName(name = '') {
  return phase2Normalize(String(name).replace(/\((base|secret form|true power|final form|divine form|mythic form|royal variant|raid variant|festival variant|battle ready|domain form|early arc|light variant|dark variant|shadow variant|hero variant|demon variant|legendary variant)\)/ig, '').trim());
}

function importantFixFor(character) {
  const clean = cleanVariantName(character?.name || '');
  return IMPORTANT_RARITY_FIXES.find(f => f.keys.some(k => clean.includes(phase2Normalize(k))));
}

function vrRole(character) {
  const n = cleanVariantName(character?.name || '');
  if (['lelouch','aizen','makima','kurapika','shikamaru'].some(x => n.includes(x))) return 'Control';
  if (['rimuru','megumi','kakashi','sakura','orihime'].some(x => n.includes(x))) return 'Support';
  if (['saber','ainz','whitebeard','kaido','all might','escanor'].some(x => n.includes(x))) return 'Tank';
  if (['killua','toji','levi','hisoka','zenitsu'].some(x => n.includes(x))) return 'Assassin';
  if (['gojo','madara','gilgamesh','sukuna'].some(x => n.includes(x))) return 'Mage';
  return 'DPS';
}

function vrElement(character) {
  const fix = importantFixFor(character);
  if (fix?.element) return fix.element;
  return cleanElement(character?.element || 'Neutral');
}

function vrPassive(character) {
  const n = cleanVariantName(character?.name || '');
  if (n.includes('sung jin')) return 'Shadow Monarch: gains power after every defeated enemy.';
  if (n.includes('gojo')) return 'Infinity: chance to ignore incoming damage.';
  if (n.includes('lelouch')) return 'Geass: control enemy actions and boost team ultimate charge.';
  if (n.includes('saber')) return 'Avalon: shield and damage reduction for the team.';
  if (n.includes('aizen')) return 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.';
  if (n.includes('madara')) return 'Uchiha Dominion: boosts AoE ultimate damage.';
  if (n.includes('sukuna')) return 'King of Curses: executes low HP enemies.';
  if (n.includes('rimuru')) return 'Predator: absorbs buffs and scales during battle.';
  if (n.includes('killua')) return 'Godspeed: high speed and crit burst.';
  if (n.includes('gon')) return 'Jajanken: heavy single target ultimate.';
  return 'Battle Instinct: small ATK and ultimate charge bonus.';
}

function vrStatsLine(card, character) {
  const p = Number(card?.power || character?.basePower || 100);
  const role = vrRole(character);
  let atk = Math.floor(p * 0.9), def = Math.floor(p * 0.5), hp = Math.floor(p * 8), spd = 100, crit = 12;

  if (role === 'Tank') { atk = Math.floor(p * 0.65); def = Math.floor(p * 1.2); hp = Math.floor(p * 14); crit = 8; }
  if (role === 'Support') { atk = Math.floor(p * 0.7); def = Math.floor(p * 0.8); hp = Math.floor(p * 10); spd = 115; crit = 10; }
  if (role === 'Control') { atk = Math.floor(p * 0.8); def = Math.floor(p * 0.7); hp = Math.floor(p * 9); spd = 120; crit = 12; }
  if (role === 'Assassin') { atk = Math.floor(p * 1.25); def = Math.floor(p * 0.35); hp = Math.floor(p * 6); spd = 145; crit = 30; }
  if (role === 'Mage') { atk = Math.floor(p * 1.35); def = Math.floor(p * 0.45); hp = Math.floor(p * 7); spd = 110; crit = 18; }
  if (role === 'DPS') { atk = Math.floor(p * 1.1); def = Math.floor(p * 0.55); hp = Math.floor(p * 8); spd = 105; crit = 18; }

  return (
    `Class: **${role}** | Element: **${vrElement(character)}**\n` +
    `ATK **${money(atk)}** • DEF **${money(def)}** • HP **${money(hp)}** • SPD **${spd}**\n` +
    `CRIT **${crit}%**\n` +
    `Passive: ${typeof vrUniquePassive === 'function' ? vrUniquePassive(character) : vrPassive(character)}`
  );
}


function vrStatsCompact(card, character) {
  if (typeof vrStatsLine === 'function') return vrStatsLine(card, character);
  const p = Number(card?.power || character?.basePower || 100);
  const role = 'DPS';
  const atk = Math.floor(p * 1.1);
  const def = Math.floor(p * 0.55);
  const hp = Math.floor(p * 8);
  const spd = 105;
  return `Class: **${role}** | Element: **${character?.element || 'Neutral'}**\nATK **${money(atk)}** • DEF **${money(def)}** • HP **${money(hp)}** • SPD **${spd}**`;
}



function vrQueryTokens(q = '') {
  const aliases = {
    'grand': 'grand',
    'order': 'order',
    'fgo': 'grand order',
    'fategrandorder': 'grand order',
    'fatestaynight': 'stay night',
    'staynight': 'stay night',
    'jujutsu': 'jujutsu',
    'kaisen': 'kaisen'
  };

  const clean = phase2Normalize(q).replace(/[\/:_\-]+/g, ' ');
  const words = clean.split(/\s+/).filter(Boolean);
  const expanded = [];

  for (const w of words) {
    expanded.push(w);
    if (aliases[w]) expanded.push(...aliases[w].split(/\s+/));
  }

  return [...new Set(expanded.filter(x => x.length > 1))];
}

function vrSearchScore(character, tokens) {
  const name = phase2Normalize(character.name || '').replace(/[\/:_\-]+/g, ' ');
  const anime = phase2Normalize(character.anime || '').replace(/[\/:_\-]+/g, ' ');
  const full = `${name} ${anime}`;
  let score = 0;

  for (const t of tokens) {
    if (name === t) score += 80;
    if (name.includes(t)) score += 35;
    if (anime.includes(t)) score += 45;
    if (full.includes(t)) score += 20;
  }

  if (tokens.length && tokens.every(t => full.includes(t))) score += 150;

  const rarityScore = { SECRET: 70, DIVINE: 55, MYTHIC: 40, LEGENDARY: 28, EPIC: 16, RARE: 8, COMMON: 0 }[character.rarity] || 0;
  return score + rarityScore + Math.floor(Number(character.basePower || 0) / 1000);
}

function vrUniquePassive(character) {
  const n = phase2Normalize(character?.name || '');
  const anime = phase2Normalize(character?.anime || '');

  if (n.includes('saber')) return 'Avalon: grants team shield and reduces incoming burst damage.';
  if (n.includes('gojo')) return 'Infinity: dodges part of incoming damage and boosts Void allies.';
  if (n.includes('geto')) return 'Cursed Spirit Control: increases summon/curse damage for the team.';
  if (n.includes('sung jin')) return 'Shadow Monarch: gains damage and summon pressure after every kill.';
  if (n.includes('makima')) return 'Control Devil: lowers enemy ATK and increases control chance.';
  if (n.includes('reze')) return 'Bomb Devil: burst damage increases after ultimate.';
  if (n.includes('luffy')) return 'Gear Spirit: ramps ATK and speed each round.';
  if (n.includes('zoro')) return 'Three Sword Style: bonus crit damage against bosses.';
  if (n.includes('sanji')) return 'Diable Jambe: fire bonus and dodge chance.';
  if (n.includes('naruto')) return 'Nine-Tails Chakra: heals slightly and boosts Light allies.';
  if (n.includes('sasuke')) return 'Sharingan: crit and counter chance.';
  if (n.includes('madara')) return 'Uchiha Dominion: AoE ultimate damage increased.';
  if (n.includes('itachi')) return 'Tsukuyomi: chance to silence enemy ultimate.';
  if (n.includes('ichigo')) return 'Bankai Pressure: Soul damage and speed boost.';
  if (n.includes('aizen')) return 'Kyoka Suigetsu: enemy accuracy and control resist reduced.';
  if (n.includes('killua')) return 'Godspeed: very high speed and crit burst.';
  if (n.includes('gon')) return 'Jajanken: heavy single target burst.';
  if (n.includes('kurapika')) return 'Chain Judgment: bonus damage against villain teams.';
  if (n.includes('toji')) return 'Heavenly Restriction: ignores part of enemy DEF.';
  if (n.includes('sukuna')) return 'King of Curses: executes weakened enemies.';
  if (n.includes('rimuru')) return 'Predator: copies a small part of enemy buffs.';
  if (n.includes('ainz')) return 'Overlord: boosts Dark allies and reduces enemy resistance.';
  if (n.includes('gilgamesh')) return 'Gate of Babylon: high PEN and ultimate burst.';
  if (anime.includes('chainsaw')) return 'Devil Contract: bonus damage when HP is low.';
  if (anime.includes('fate')) return 'Heroic Spirit: balanced stats and ultimate charge.';
  if (anime.includes('jujutsu')) return 'Cursed Energy: PEN and control resistance.';
  return vrPassive(character);
}

const VR_SYNERGY_RULES = [
  { name: 'Strongest Past', keys: ['gojo','geto'], buff: '+18% Void damage, +10% ultimate charge' },
  { name: 'Hunter Bond', keys: ['gon','killua'], buff: '+15% speed, +12% crit' },
  { name: 'Monster Trio', keys: ['luffy','zoro','sanji'], buff: '+18% ATK, +10% speed' },
  { name: 'Uchiha Bloodline', keys: ['itachi','sasuke'], buff: '+15% crit, +10% control resist' },
  { name: 'Rival Chakra', keys: ['naruto','sasuke'], buff: '+20% ultimate damage' },
  { name: 'Fate Clash', keys: ['saber','gilgamesh'], buff: '+15% PEN, +12% shield' },
  { name: 'Control Devils', keys: ['makima','reze'], buff: '+12% burst damage, enemy ATK down' },
  { name: 'Bleach Pressure', keys: ['ichigo','aizen'], buff: '+15% Soul damage' },
  { name: 'Jujutsu Core', keys: ['yuji','megumi','nobara'], buff: '+12% ATK, +15% ult charge' }
];

function vrSynergyForCards(cards) {
  const text = cards.map(c => phase2Normalize(c.character?.name || c.name || '')).join(' | ');
  const active = [];
  for (const s of VR_SYNERGY_RULES) {
    if (s.keys.every(k => text.includes(k))) active.push(s);
  }

  const elements = {};
  for (const c of cards) {
    const e = vrElement(c.character || c);
    elements[e] = (elements[e] || 0) + 1;
  }
  for (const [e, count] of Object.entries(elements)) {
    if (count >= 3) active.push({ name: `${e} Aura`, buff: count >= 5 ? '+22% team damage and HP' : '+10% team damage and HP' });
  }

  return active;
}

const VR_VALID_ELEMENTS = ['Dark','Light','Fire','Ice','Shadow','Curse','Void','Lightning','Soul','Neutral'];

function vrCleanElement(value) {
  const raw = String(value || '').trim();
  const found = VR_VALID_ELEMENTS.find(e => phase2Normalize(e) === phase2Normalize(raw));
  return found || 'Neutral';
}

function vrRole(character) {
  const n = phase2Normalize(character?.name || '');
  if (['lelouch','aizen','makima','kurapika','shikamaru','light yagami'].some(x => n.includes(x))) return 'Control';
  if (['rimuru','megumi','kakashi','sakura','orihime','shoko','reigen'].some(x => n.includes(x))) return 'Support';
  if (['saber','artoria','ainz','whitebeard','kaido','all might','escanor','albedo'].some(x => n.includes(x))) return 'Tank';
  if (['killua','toji','levi','hisoka','zenitsu','yoroichi'].some(x => n.includes(x))) return 'Assassin';
  if (['gojo','madara','gilgamesh','sukuna','yhwach','dio','meruem'].some(x => n.includes(x))) return 'Mage';
  return 'DPS';
}

function vrElement(character) {
  const n = phase2Normalize(character?.name || '');
  const anime = phase2Normalize(character?.anime || '');
  if (['sukuna','toji','lelouch','makima','ainz','dio','alucard'].some(x => n.includes(x))) return 'Dark';
  if (['sung jin','shadow','igris','beru','cid kagenou'].some(x => n.includes(x) || anime.includes(x))) return 'Shadow';
  if (['gojo','rimuru','gilgamesh','aizen','yhwach'].some(x => n.includes(x))) return 'Void';
  if (['saber','artoria','goku','naruto','luffy','all might','saitama'].some(x => n.includes(x))) return 'Light';
  if (['ace','rengoku','natsu','shinra','yamamoto'].some(x => n.includes(x))) return 'Fire';
  if (['killua','zenitsu','kakashi'].some(x => n.includes(x))) return 'Lightning';
  if (['ichigo','rukia','bleach'].some(x => n.includes(x) || anime.includes(x))) return 'Soul';
  return vrCleanElement(character?.element || 'Neutral');
}

function vrPassive(character) {
  const n = phase2Normalize(character?.name || '');
  if (n.includes('sung jin')) return 'Shadow Monarch: scales after defeating enemies.';
  if (n.includes('gojo')) return 'Infinity: chance to ignore incoming damage.';
  if (n.includes('saber') || n.includes('artoria')) return 'Avalon: shield and damage reduction.';
  if (n.includes('lelouch')) return 'Geass: control and ultimate charge.';
  if (n.includes('makima')) return 'Control Devil: weakens enemy damage.';
  if (n.includes('aizen')) return 'Kyoka Suigetsu: lowers enemy accuracy.';
  if (n.includes('madara')) return 'Uchiha Dominion: boosts AoE ultimate damage.';
  if (n.includes('sukuna')) return 'King of Curses: executes low HP enemies.';
  if (n.includes('killua')) return 'Godspeed: high speed and crit burst.';
  if (n.includes('gon')) return 'Jajanken: heavy single-target ultimate.';
  if (n.includes('kurapika')) return 'Chain Judgment: bonus vs villains.';
  return 'Battle Instinct: small ATK and ultimate charge bonus.';
}

function vrStatsLine(card, character) {
  const p = Math.max(1, Number(card?.power || character?.basePower || 100));
  const role = vrRole(character);
  const rarity = character?.rarity || 'COMMON';
  const rarityMult = { COMMON: 0.8, RARE: 1.0, EPIC: 1.25, LEGENDARY: 1.55, MYTHIC: 2.05, DIVINE: 2.8, SECRET: 3.6 }[rarity] || 1;
  const level = Number(card?.level || 1);
  const levelMult = 1 + ((level - 1) * 0.04);

  let atkScale = 1.05, hpScale = 7.2, defScale = 0.58, spd = 105, crit = 14, energy = 100, shield = 0, pen = 0;
  if (role === 'Tank') { atkScale = 0.72; hpScale = 13.5; defScale = 1.22; spd = 92; shield = 20; crit = 8; }
  if (role === 'Support') { atkScale = 0.78; hpScale = 9.0; defScale = 0.82; spd = 112; energy = 140; shield = 12; crit = 10; }
  if (role === 'Control') { atkScale = 0.88; hpScale = 8.5; defScale = 0.76; spd = 120; energy = 128; crit = 12; }
  if (role === 'Assassin') { atkScale = 1.35; hpScale = 5.8; defScale = 0.42; spd = 145; crit = 30; pen = 15; }
  if (role === 'Mage') { atkScale = 1.42; hpScale = 6.2; defScale = 0.48; spd = 110; crit = 18; energy = 122; pen = 25; }
  if (role === 'DPS') { atkScale = 1.18; hpScale = 7.2; defScale = 0.58; spd = 108; crit = 18; }

  const atk = Math.floor(p * atkScale * rarityMult * levelMult);
  const hp = Math.floor(p * hpScale * rarityMult * levelMult);
  const def = Math.floor(p * defScale * rarityMult * levelMult);

  return `Class: **${role}** | Element: **${vrElement(character)}**\nATK **${money(atk)}** • HP **${money(hp)}** • DEF **${money(def)}** • SPD **${spd}**\nCRIT **${crit}%** • PEN **${pen}%** • Energy **${energy}%** • Shield **${shield}%**\nPassive: ${typeof vrUniquePassive === 'function' ? vrUniquePassive(character) : vrPassive(character)}`;
}

function vrTargetPower(rarity, seed = 1) {
  const ranges = { COMMON: [50,150], RARE: [150,400], EPIC: [400,900], LEGENDARY: [900,1800], MYTHIC: [1800,3500], DIVINE: [3500,6000], SECRET: [6000,10000] };
  const [min, max] = ranges[rarity] || ranges.COMMON;
  return min + ((Math.abs(seed) * 97) % Math.max(1, max - min));
}

async function keepOnlyMalCharactersAndBalance() {
  const disabled = await prisma.character.updateMany({
    where: { NOT: { id: { startsWith: 'mal_' } } },
    data: { active: false }
  });

  const chars = await prisma.character.findMany({
    where: { id: { startsWith: 'mal_' } },
    orderBy: [{ basePower: 'desc' }, { name: 'asc' }]
  });

  let balanced = 0;
  let fixedImages = 0;
  const protectedNames = ['sung jin','gojo','saber','artoria','saitama','rimuru','madara','aizen','sukuna','goku','vegeta','gilgamesh','makima','lelouch','yhwach','ichigo','naruto','sasuke','luffy','kaido','shanks','ainz'];

  for (let idx = 0; idx < chars.length; idx++) {
    const c = chars[idx];
    const n = phase2Normalize(c.name || '');
    const rank = idx + 1;
    let rarity =
      rank <= Math.max(25, Math.floor(chars.length * 0.005)) ? 'SECRET' :
      rank <= Math.max(100, Math.floor(chars.length * 0.02)) ? 'DIVINE' :
      rank <= Math.max(250, Math.floor(chars.length * 0.06)) ? 'MYTHIC' :
      rank <= Math.max(650, Math.floor(chars.length * 0.13)) ? 'LEGENDARY' :
      rank <= Math.max(1500, Math.floor(chars.length * 0.28)) ? 'EPIC' :
      rank <= Math.max(3200, Math.floor(chars.length * 0.58)) ? 'RARE' :
      'COMMON';

    if (protectedNames.some(x => n.includes(x))) rarity = 'SECRET';

    const power = vrTargetPower(rarity, c.id.length + idx + c.name.length);
    const data = {
      rarity,
      element: vrElement({ ...c, rarity }),
      basePower: power,
      baseFarm: Math.max(1, Math.floor(power / 8)),
      baseLuck: Math.max(1, Math.floor(power / 20)),
      active: true
    };

    if (!c.imageUrl && typeof findAnimeImage === 'function') {
      const img = await findAnimeImage(c.name).catch(() => null);
      if (img) { data.imageUrl = img; fixedImages++; }
    }

    await prisma.character.update({ where: { id: c.id }, data }).catch(() => {});
    balanced++;
  }

  const activeMal = await prisma.character.count({ where: { active: true, id: { startsWith: 'mal_' } } });
  return { disabled: disabled.count || 0, activeMal, balanced, fixedImages };
}

async function fixImportantVariants() {
  const chars = await prisma.character.findMany({
    where: { active: true },
    select: { id: true, name: true, anime: true, rarity: true, basePower: true, element: true }
  });

  let fixed = 0;
  const seen = new Set();

  for (const c of chars) {
    const fix = importantFixFor(c);
    if (!fix) continue;

    let newName = c.name
      .replace(/\s+\((Base|Secret Form|True Power|Final Form|Divine Form|Mythic Form)\)$/i, '')
      .trim();

    // keep one clean named version, variants become readable but same rarity
    if (!newName) newName = c.name;

    await prisma.character.update({
      where: { id: c.id },
      data: {
        name: newName,
        rarity: fix.rarity,
        basePower: Math.max(Number(c.basePower || 0), fix.power),
        baseFarm: Math.floor(fix.power / 8),
        baseLuck: Math.floor(fix.power / 20),
        element: fix.element || c.element || 'Neutral',
        active: true
      }
    }).catch(() => {});

    fixed++;
  }

  console.log(`[ImportantFix] Fixed variants: ${fixed}`);
}

function phase2Normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
}

async function phase2FindUserCardByName(userId, name) {
  const q = phase2Normalize(name);
  if (!q) throw new Error('Write a character name.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' }
  });

  const exact = cards.find(c => phase2Normalize(c.character.name) === q);
  if (exact) return exact;

  const start = cards.find(c => phase2Normalize(c.character.name).startsWith(q));
  if (start) return start;

  const inc = cards.find(c => phase2Normalize(c.character.name).includes(q));
  if (inc) return inc;

  throw new Error(`No card found in your inventory for: ${name}`);
}

function phase2RaritySellValue(rarity, power = 0) {
  const base = {
    COMMON: 250,
    RARE: 1000,
    EPIC: 5000,
    LEGENDARY: 25000,
    MYTHIC: 90000,
    DIVINE: 250000,
    SECRET: 1000000
  }[rarity] || 100;

  return base + Math.floor(Number(power || 0) * 0.08);
}

function phase2GetStars(card) {
  const trait = String(card?.trait || '');
  const match = trait.match(/STAR:(\d+)/);
  return Math.max(0, Number(match?.[1] || 0));
}

function phase2SetStarsTrait(oldTrait, stars) {
  const clean = String(oldTrait || '').replace(/STAR:\d+/g, '').trim();
  return `${clean} STAR:${Math.max(0, stars)}`.trim();
}

function phase2StarLabel(card) {
  const stars = phase2GetStars(card);
  return stars ? ` ⭐${stars}` : '';
}

async function phase2FuseByName(userId, name) {
  const q = phase2Normalize(name);

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' }
  });

  const matches = cards.filter(c => phase2Normalize(c.character.name).includes(q));

  if (!matches.length) throw new Error(`No cards found for ${name}.`);

  const characterId = matches[0].characterId;
  const same = cards.filter(c => c.characterId === characterId)
    .sort((a, b) => {
      const starDiff = phase2GetStars(b) - phase2GetStars(a);
      if (starDiff !== 0) return starDiff;
      return Number(b.power || 0) - Number(a.power || 0);
    });

  if (same.length < 2) {
    return {
      fused: false,
      message: `You need at least 2 copies of **${same[0].character.name}** to fuse.`
    };
  }

  const keeper = same[0];
  const consume = same[1];
  const oldStars = phase2GetStars(keeper);
  const gainedStars = 1 + phase2GetStars(consume);
  const newStars = Math.min(10, oldStars + gainedStars);

  const basePower = Number(keeper.character.basePower || keeper.power || 0);
  const powerGain = Math.floor(basePower * 0.10 * gainedStars) + Math.floor(Number(consume.power || 0) * 0.08);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({
      where: { userId, cardId: consume.id }
    }),
    prisma.marketListing.updateMany({
      where: { cardId: consume.id, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    }),
    prisma.userCard.delete({
      where: { id: consume.id }
    }),
    prisma.userCard.update({
      where: { id: keeper.id },
      data: {
        power: { increment: powerGain },
        trait: phase2SetStarsTrait(keeper.trait, newStars)
      }
    })
  ]);

  return {
    fused: true,
    name: keeper.character.name,
    oldStars,
    newStars,
    powerGain
  };
}

async function phase2FuseList(userId) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { obtainedAt: 'desc' }
  });

  const map = new Map();

  for (const c of cards) {
    if (!map.has(c.characterId)) {
      map.set(c.characterId, {
        name: c.character.name,
        rarity: c.character.rarity,
        count: 0,
        maxPower: 0
      });
    }

    const row = map.get(c.characterId);
    row.count++;
    row.maxPower = Math.max(row.maxPower, Number(c.power || 0));
  }

  return Array.from(map.values())
    .filter(x => x.count >= 2)
    .sort((a, b) => b.count - a.count || b.maxPower - a.maxPower);
}

async function phase2SellAllByRarity(userId, rarity) {
  const target = String(rarity || '').toUpperCase();
  const allowed = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'];

  if (!allowed.includes(target)) throw new Error('Invalid rarity.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true }
  });

  const sellCards = cards.filter(c => c.character.rarity === target);

  if (!sellCards.length) return { sold: 0, gold: 0, rarity: target };

  const totalGold = sellCards.reduce((sum, c) => sum + phase2RaritySellValue(c.character.rarity, c.power), 0);
  const ids = sellCards.map(c => c.id);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({ where: { userId, cardId: { in: ids } } }),
    prisma.marketListing.updateMany({
      where: { cardId: { in: ids }, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    }),
    prisma.userCard.deleteMany({ where: { id: { in: ids } } }),
    prisma.user.update({
      where: { id: userId },
      data: { gold: { increment: totalGold } }
    })
  ]);

  return { sold: sellCards.length, gold: totalGold, rarity: target };
}

async function phase2ApplyRarityFixes() {
  const fixes = [
    { names: ['lelouch', 'lelouch lamperouge'], rarity: 'SECRET', power: 28000 },
    { names: ['saber'], rarity: 'DIVINE', power: 17000 },
    { names: ['ainz', 'ainz ooal gown'], rarity: 'DIVINE', power: 18000 },
    { names: ['gon', 'gon freecss'], rarity: 'DIVINE', power: 16000 },
    { names: ['killua', 'killua zoldyck'], rarity: 'DIVINE', power: 16000 },
    { names: ['kurapika'], rarity: 'DIVINE', power: 16000 },
    { names: ['kakashi', 'kakashi hatake'], rarity: 'DIVINE', power: 14000 },
    { names: ['gojo', 'satoru gojo', 'satoru gojou'], rarity: 'SECRET', power: 30000 }
  ];

  const chars = await prisma.character.findMany({
    where: { active: true }
  });

  let updated = 0;

  for (const c of chars) {
    const n = phase2Normalize(c.name);
    const fix = fixes.find(f => f.names.some(name => n === phase2Normalize(name) || n.includes(phase2Normalize(name))));

    if (!fix) continue;

    await prisma.character.update({
      where: { id: c.id },
      data: {
        rarity: fix.rarity,
        basePower: Math.max(Number(c.basePower || 0), fix.power),
        baseFarm: Math.floor(fix.power / 8),
        baseLuck: Math.floor(fix.power / 20)
      }
    });

    updated++;
  }

  console.log(`[Phase2] Rarity fixes updated ${updated} characters`);
}

function money(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function xpForLevel(level) {
  return 100 + ((level - 1) * 75);
}

function levelReward(level) {
  return {
    gold: 2500 * level,
    tokens: Math.floor(level / 2) + 1,
    rolls: Math.floor(level / 3) + 2
  };
}

async function addUserXp(userId, amount, reason = 'activity') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { leveled: false, level: 1, rewards: [] };

  let xp = (user.xp || 0) + amount;
  let level = user.level || 1;
  const rewards = [];

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    rewards.push({ level, ...levelReward(level) });
  }

  const rewardGold = rewards.reduce((sum, r) => sum + r.gold, 0);
  const rewardTokens = rewards.reduce((sum, r) => sum + r.tokens, 0);
  const rewardRolls = rewards.reduce((sum, r) => sum + r.rolls, 0);

  await prisma.user.update({
    where: { id: userId },
    data: {
      xp,
      level,
      gold: { increment: rewardGold },
      tokens: { increment: rewardTokens },
      rolls: { increment: rewardRolls }
    }
  });

  return {
    leveled: rewards.length > 0,
    level,
    xp,
    gained: amount,
    reason,
    rewards
  };
}

function levelUpText(result) {
  if (!result || !result.leveled) return '';

  return '\n\n🎉 **LEVEL UP!**\n' + result.rewards.map(r =>
    `Level **${r.level}** Rewards: **${money(r.gold)} Gold**, **${r.tokens} Tokens**, **${r.rolls} Rolls**`
  ).join('\n');
}



async function findUserCardByName(userId, name) {
  const query = String(name || '').trim().toLowerCase();
  if (!query) throw new Error('Write a character name.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 10000
  });

  const exact = cards.find(c => c.character.name.toLowerCase() === query);
  if (exact) return exact;

  const starts = cards.find(c => c.character.name.toLowerCase().startsWith(query));
  if (starts) return starts;

  const includes = cards.find(c => c.character.name.toLowerCase().includes(query));
  if (includes) return includes;

  throw new Error(`No card found in your inventory for: ${name}`);
}

function raritySellValue(rarity, power = 0) {
  const base = {
    COMMON: 250,
    RARE: 1000,
    EPIC: 5000,
    LEGENDARY: 25000,
    MYTHIC: 90000,
    DIVINE: 250000,
    SECRET: 1000000
  }[rarity] || 100;

  return base + Math.floor(Number(power || 0) * 0.08);
}

async function sellAllByRarity(userId, rarity) {
  const target = String(rarity || '').toUpperCase();

  const allowed = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'];
  if (!allowed.includes(target)) throw new Error('Invalid rarity.');

  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    take: 10000
  });

  const sellCards = cards.filter(c => c.character.rarity === target);

  if (!sellCards.length) {
    return { sold: 0, gold: 0, rarity: target };
  }

  const totalGold = sellCards.reduce((sum, c) => sum + raritySellValue(c.character.rarity, c.power), 0);
  const ids = sellCards.map(c => c.id);

  await prisma.$transaction([
    prisma.teamSlot.deleteMany({
      where: { userId, cardId: { in: ids } }
    }),
    prisma.marketListing.updateMany({
      where: { cardId: { in: ids }, status: 'ACTIVE' },
      data: { status: 'CANCELLED' }
    }),
    prisma.userCard.deleteMany({
      where: { id: { in: ids } }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { gold: { increment: totalGold } }
    })
  ]);

  return { sold: sellCards.length, gold: totalGold, rarity: target };
}

function rarityEmoji(rarity) {
  return {
    COMMON: '⚪',
    RARE: '🔵',
    EPIC: '🟣',
    LEGENDARY: '🟡',
    MYTHIC: '🔴',
    DIVINE: '🌈',
    SECRET: '🕳️'
  }[rarity] || '🎴';
}

function priceRange(rarity) {
  const ranges = {
    COMMON: [100, 5000],
    RARE: [5000, 25000],
    EPIC: [25000, 120000],
    LEGENDARY: [120000, 600000],
    MYTHIC: [600000, 2500000],
    DIVINE: [2500000, 15000000],
    SECRET: [10000000, 50000000]
  };

  return ranges[rarity] || [100, 5000];
}

const PACK_WEIGHTS = {
  COMMON: 720000,
  RARE: 220000,
  EPIC: 56500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

const GOLD_SHOP_ITEMS = {
  rolls_5: { name: '5 Rolls', gold: 6000, rolls: 5 },
  rolls_10: { name: '10 Rolls', gold: 10000, rolls: 10 },
  rolls_25: { name: '25 Rolls', gold: 22000, rolls: 25 },
  token_1: { name: '1 Token', gold: 10000, tokens: 1 },
  legendary_orb: { name: 'Legendary Orb Roll', gold: 300000, rarity: 'LEGENDARY' },
  mythic_orb: { name: 'Mythic Orb Roll', gold: 900000, rarity: 'MYTHIC' },
  divine_orb: { name: 'Divine Orb Roll', gold: 2500000, rarity: 'DIVINE' },
  secret_orb: { name: 'Secret Orb Roll', gold: 9000000, rarity: 'SECRET' }
};

const ORB_ROLL_COSTS = {
  legendary: { tokens: 100, rarity: 'LEGENDARY' },
  mythic: { tokens: 250, rarity: 'MYTHIC' },
  divine: { tokens: 350, rarity: 'DIVINE' },
  secret: { tokens: 500, rarity: 'SECRET' }
};

const TRAIN_POWER_CAPS = {
  COMMON: 1500,
  RARE: 3000,
  EPIC: 5500,
  LEGENDARY: 9000,
  MYTHIC: 13000,
  DIVINE: 19000,
  SECRET: 35000
};

const PVP_RANKS = [
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 100 },
  { name: 'Gold', min: 250 },
  { name: 'Platinum', min: 500 },
  { name: 'Diamond', min: 850 },
  { name: 'Master', min: 1300 },
  { name: 'Void King', min: 2000 }
];

function pvpRank(points = 0) {
  let rank = PVP_RANKS[0].name;
  for (const r of PVP_RANKS) if (points >= r.min) rank = r.name;
  return rank;
}

const RARITY_UPGRADE_COSTS = {
  RARE: { gold: 25000, tokens: 5, power: 900 },
  EPIC: { gold: 90000, tokens: 15, power: 1800 },
  LEGENDARY: { gold: 300000, tokens: 40, power: 3500 },
  MYTHIC: { gold: 900000, tokens: 100, power: 6500 },
  DIVINE: { gold: 2500000, tokens: 250, power: 10000 },
  SECRET: { gold: 8000000, tokens: 500, power: 15000 }
};

function trainingCost(amount) {
  const safeAmount = Math.max(1, Math.min(100, Number(amount || 1)));
  return {
    amount: safeAmount,
    gold: safeAmount * 15000,
    powerGain: safeAmount * 120
  };
}

function weightedPick(items, weightFn) {
  let total = 0;
  const rows = items.map(item => {
    const weight = Math.max(1, Math.floor(weightFn(item)));
    total += weight;
    return { item, weight };
  });

  let roll = Math.floor(Math.random() * total);

  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) return row.item;
  }

  return rows[rows.length - 1]?.item;
}

async function applySecretCharacterBoosts() {
  const chars = await prisma.character.findMany({
    where: { active: true },
    select: { id: true, name: true, anime: true, rarity: true, basePower: true, baseFarm: true, baseLuck: true }
  });

  let updated = 0;

  for (const c of chars) {
    const cls = classifyCharacter(c);
    if (!cls) continue;

    const newPower = cls.power;

    await prisma.character.update({
      where: { id: c.id },
      data: {
        rarity: cls.rarity,
        basePower: newPower,
        baseFarm: Math.floor(newPower / 8),
        baseLuck: Math.floor(newPower / 20),
        element: characterElement({ name: c.name, element: 'Neutral' })
      }
    });

    updated++;
  }

  console.log(`Rarity/class/power balance updated: ${updated}`);
}

async function createCardForUser(userId, character) {
  const updated = await prisma.character.update({
    where: { id: character.id },
    data: { globalPrint: { increment: 1 } }
  });

  const shiny = Math.random() < 0.015;
  const power = Math.round((updated.basePower || 100) * (shiny ? 1.35 : 1) + Math.random() * 80);

  const card = await prisma.userCard.create({
    data: {
      id: nanoid(12),
      userId,
      characterId: updated.id,
      serial: updated.globalPrint,
      power,
      shiny
    }
  });

  return { card, character: updated };
}

async function guaranteedCharacterRoll(userId, rarity) {
  let pool = await prisma.character.findMany({
    where: { active: true, rarity },
    take: 100000
  });

  if (!pool.length) {
    pool = await prisma.character.findMany({ where: { active: true }, take: 100000 });
  }

  if (!pool.length) throw new Error('No characters are available.');

  const character = pool[Math.floor(Math.random() * pool.length)];
  return createCardForUser(userId, character);
}

async function openPack(userId, type) {
  const pack = String(type || '').toLowerCase();

  const costs = {
    jjk: 10,
    demon: 10,
    naruto: 10,
    onepiece: 10,
    bleach: 10,
    mha: 10,
    hxh: 10,
    dbz: 10,
    aot: 10,
    villains: 18,
    secret: 500,
    event: 25
  };

  const cost = costs[pack];

  if (!cost) throw new Error('Invalid pack. Use /shop to see available packs.');

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if ((user.tokens || 0) < cost) {
    throw new Error(`Not enough tokens. This pack costs ${cost} tokens.`);
  }

  const allChars = await prisma.character.findMany({
    where: { active: true },
    take: 1000
  });

  if (!allChars.length) throw new Error('No characters are available.');

  const containsAny = (value, words) => {
    const text = String(value || '').toLowerCase();
    return words.some(w => text.includes(w));
  };

  let pool = allChars;

  if (pack === 'jjk') pool = allChars.filter(c => containsAny(c.anime, ['jujutsu', 'kaisen']));
  if (pack === 'demon') pool = allChars.filter(c => containsAny(c.anime, ['demon slayer', 'kimetsu']));
  if (pack === 'naruto') pool = allChars.filter(c => containsAny(c.anime, ['naruto']));
  if (pack === 'onepiece') pool = allChars.filter(c => containsAny(c.anime, ['one piece']));
  if (pack === 'bleach') pool = allChars.filter(c => containsAny(c.anime, ['bleach']));
  if (pack === 'mha') pool = allChars.filter(c => containsAny(c.anime, ['my hero', 'boku no hero']));
  if (pack === 'hxh') pool = allChars.filter(c => containsAny(c.anime, ['hunter x hunter', 'hunter×hunter']));
  if (pack === 'dbz') pool = allChars.filter(c => containsAny(c.anime, ['dragon ball']));
  if (pack === 'aot') pool = allChars.filter(c => containsAny(c.anime, ['attack on titan', 'shingeki']));
  if (pack === 'villains') {
    const villains = [
      'sukuna', 'muzan', 'madara', 'aizen', 'yhwach', 'kaido', 'doflamingo',
      'shigaraki', 'all for one', 'meruem', 'chrollo', 'hisoka', 'frieza',
      'zeref', 'acnologia', 'dio'
    ];

    pool = allChars.filter(c => containsAny(`${c.name} ${c.anime}`, villains));
  }
  if (pack === 'secret') pool = allChars.filter(c => c.rarity === 'SECRET' || isSecretCandidate(c));
  if (pack === 'event') pool = allChars.filter(c => ['EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'].includes(c.rarity));

  if (!pool.length) pool = allChars;

  const character = weightedPick(pool, c => {
    if (pack === 'event') {
      return {
        EPIC: 850000,
        LEGENDARY: 95000,
        MYTHIC: 22000,
        DIVINE: 7000,
        SECRET: 1200
      }[c.rarity] || 100;
    }

    if (pack === 'secret') {
      return c.rarity === 'SECRET' || isSecretCandidate(c) ? 1000000 : 1;
    }

    return PACK_WEIGHTS[c.rarity] || 1000;
  });

  await prisma.user.update({
    where: { id: userId },
    data: { tokens: { decrement: cost } }
  });

  return createCardForUser(userId, character);
}

async function inventoryEmbed(userId, index = 0) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { obtainedAt: 'desc' },
    take: 10000
  });

  if (!cards.length) return { empty: true };

  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const c = cards[safeIndex];
  const aura = getAura(c.character);

  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.character.rarity)} ${c.character.name}${starLabel(c)}`)
    .setDescription(
      `Anime: **${c.character.anime}**\n` +
      `Rarity: **${c.character.rarity}**\n` +
      `Power: **${c.power}**\n` +
      `Technique: **${aura.name}**\n` +
      `Stars: **${starLabel(c) || 'No Star'}**\n` +
      `Card ID: \`${c.id}\``
    )
    .setColor(embedColor(aura.color))
    .setFooter({ text: `Card ${safeIndex + 1}/${cards.length}` });

  if (c.character.imageUrl) embed.setImage(c.character.imageUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_prev_${safeIndex}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`inv_next_${safeIndex}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}



// ===== FULL STARTER UPDATE HELPERS =====
const VR_NO_NEUTRAL_ELEMENTS = ['Dark','Light','Fire','Ice','Shadow','Curse','Void','Lightning','Soul'];

function vrHashNumber(text = '') {
  let h = 0;
  for (const ch of String(text)) h = ((h << 5) - h) + ch.charCodeAt(0);
  return Math.abs(h);
}

function vrSafeElement(character) {
  const existing = String(character?.element || '').trim();
  if (existing && existing !== 'Neutral' && existing !== 'Anime') return existing;

  const n = phase2Normalize(character?.name || '');
  const anime = phase2Normalize(character?.anime || '');

  if (/(sukuna|makima|toji|ainz|dio|alucard|devil|demon|curse)/.test(`${n} ${anime}`)) return 'Dark';
  if (/(sung jin|shadow|kage|igris|beru|cid)/.test(`${n} ${anime}`)) return 'Shadow';
  if (/(gojo|rimuru|gilgamesh|aizen|void|space|time)/.test(`${n} ${anime}`)) return 'Void';
  if (/(saber|artoria|goku|naruto|luffy|saitama|hero|saint)/.test(`${n} ${anime}`)) return 'Light';
  if (/(ace|rengoku|natsu|shinra|flame|fire|yamamoto)/.test(`${n} ${anime}`)) return 'Fire';
  if (/(killua|zenitsu|kakashi|thunder|lightning)/.test(`${n} ${anime}`)) return 'Lightning';
  if (/(ichigo|rukia|bleach|soul|spirit)/.test(`${n} ${anime}`)) return 'Soul';
  if (/(ice|frost|snow)/.test(`${n} ${anime}`)) return 'Ice';

  return VR_NO_NEUTRAL_ELEMENTS[vrHashNumber(`${n}${anime}`) % VR_NO_NEUTRAL_ELEMENTS.length];
}

function vrCharacterRole(character) {
  const n = phase2Normalize(character?.name || '');
  if (/(lelouch|aizen|makima|kurapika|shikamaru|light yagami|near|l lawliet)/.test(n)) return 'Control';
  if (/(rimuru|megumi|kakashi|sakura|orihime|shoko|reigen|chopper|tsunade)/.test(n)) return 'Support';
  if (/(saber|artoria|ainz|whitebeard|kaido|all might|escanor|albedo|reinhard)/.test(n)) return 'Tank';
  if (/(killua|toji|levi|hisoka|zenitsu|yoroichi|akame|kirito)/.test(n)) return 'Assassin';
  if (/(gojo|madara|gilgamesh|sukuna|yhwach|dio|meruem|frieren|sinbad)/.test(n)) return 'Mage';
  return 'DPS';
}

function vrCharacterPassive(character) {
  const n = phase2Normalize(character?.name || '');
  const anime = phase2Normalize(character?.anime || '');

  if (n.includes('sung jin')) return 'Shadow Monarch: gains stacking ATK after every defeated enemy and boosts Shadow allies.';
  if (n.includes('gojo')) return 'Infinity: reduces incoming damage and charges ultimate when attacked.';
  if (n.includes('geto')) return 'Cursed Spirit Control: increases Curse/Summon damage and weakens enemy DEF.';
  if (n.includes('saber') || n.includes('artoria')) return 'Avalon: grants shield at battle start and reduces burst damage.';
  if (n.includes('makima')) return 'Control Devil: lowers enemy ATK and increases control chance.';
  if (n.includes('reze')) return 'Bomb Devil: ultimate applies explosive burst damage over time.';
  if (n.includes('denji')) return 'Chainsaw Heart: lifesteal increases when HP is low.';
  if (n.includes('luffy')) return 'Liberation Rhythm: gains ATK and speed every round.';
  if (n.includes('zoro')) return 'Three Sword Style: high crit damage against bosses.';
  if (n.includes('sanji')) return 'Diable Jambe: fire damage and dodge chance.';
  if (n.includes('naruto')) return 'Nine-Tails Chakra: heals slightly and boosts Light allies.';
  if (n.includes('sasuke')) return 'Sharingan: crit and counter chance.';
  if (n.includes('itachi')) return 'Tsukuyomi: chance to delay enemy ultimate.';
  if (n.includes('madara')) return 'Uchiha Dominion: AoE ultimate damage increased.';
  if (n.includes('ichigo')) return 'Bankai Pressure: Soul damage and speed increase.';
  if (n.includes('aizen')) return 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.';
  if (n.includes('killua')) return 'Godspeed: high speed and crit burst.';
  if (n.includes('gon')) return 'Jajanken: huge single target ultimate damage.';
  if (n.includes('kurapika')) return 'Chain Judgment: bonus damage against villain teams.';
  if (n.includes('toji')) return 'Heavenly Restriction: ignores part of enemy DEF.';
  if (n.includes('sukuna')) return 'King of Curses: executes weakened enemies and boosts Dark damage.';
  if (n.includes('rimuru')) return 'Predator: copies a small part of enemy buffs.';
  if (n.includes('ainz')) return 'Overlord: boosts Dark allies and reduces enemy resistance.';
  if (n.includes('gilgamesh')) return 'Gate of Babylon: high PEN and ultimate burst.';
  if (n.includes('vegeta')) return 'Saiyan Pride: gains ATK after taking damage.';
  if (n.includes('goku')) return 'Limit Breaker: ultimate damage scales with battle rounds.';
  if (anime.includes('chainsaw')) return 'Devil Contract: bonus damage when HP is low.';
  if (anime.includes('fate')) return 'Heroic Spirit: balanced stats and ultimate charge.';
  if (anime.includes('jujutsu')) return 'Cursed Energy: PEN and control resistance.';
  if (anime.includes('one piece')) return 'Grand Line Spirit: speed and crit chance.';
  if (anime.includes('naruto')) return 'Shinobi Tactics: dodge and burst damage.';
  if (anime.includes('bleach')) return 'Spiritual Pressure: Soul damage and resistance.';
  return 'Battle Instinct: small ATK and ultimate charge bonus.';
}

const VR_TEAM_UP_RULES = [
  { name: 'Strongest Past', keys: ['gojo','geto'], buff: '+18% Void damage, +10% ultimate charge' },
  { name: 'Hunter Bond', keys: ['gon','killua'], buff: '+15% speed, +12% crit' },
  { name: 'Monster Trio', keys: ['luffy','zoro','sanji'], buff: '+18% ATK, +10% speed' },
  { name: 'Uchiha Bloodline', keys: ['itachi','sasuke'], buff: '+15% crit, +10% control resist' },
  { name: 'Rival Chakra', keys: ['naruto','sasuke'], buff: '+20% ultimate damage' },
  { name: 'Fate Clash', keys: ['saber','gilgamesh'], buff: '+15% PEN, +12% shield' },
  { name: 'Control Devils', keys: ['makima','reze'], buff: '+12% burst damage, enemy ATK down' },
  { name: 'Bleach Pressure', keys: ['ichigo','aizen'], buff: '+15% Soul damage' },
  { name: 'Saiyan Rivalry', keys: ['goku','vegeta'], buff: '+18% ATK after round 3' },
  { name: 'Jujutsu Core', keys: ['yuji','megumi','nobara'], buff: '+12% ATK, +15% ult charge' },
  { name: 'Demon Slayer Trio', keys: ['tanjiro','zenitsu','inosuke'], buff: '+12% speed, +12% crit' },
  { name: 'Shadow Army', keys: ['sung jin','igris'], buff: '+15% Shadow damage' }
];

function vrTeamUpsForCharacter(character) {
  const n = phase2Normalize(character?.name || '');
  return VR_TEAM_UP_RULES
    .filter(rule => rule.keys.some(k => n.includes(k)))
    .map(rule => `• **${rule.name}** with ${rule.keys.map(k => `\`${k}\``).join(' + ')}: ${rule.buff}`);
}

function vrTeamUpsForCards(cards) {
  const text = cards.map(c => phase2Normalize(c.character?.name || c.name || '')).join(' | ');
  const active = [];
  for (const rule of VR_TEAM_UP_RULES) {
    if (rule.keys.every(k => text.includes(k))) active.push(rule);
  }

  const counts = {};
  for (const c of cards) {
    const e = vrSafeElement(c.character || c);
    counts[e] = (counts[e] || 0) + 1;
  }

  for (const [element, count] of Object.entries(counts)) {
    if (count >= 3) active.push({ name: `${element} Aura`, buff: count >= 6 ? '+24% team damage and HP' : '+12% team damage and HP' });
  }

  return active;
}

function vrStatsLine(card, character) {
  const p = Math.max(1, Number(card?.power || character?.basePower || 100));
  const role = vrCharacterRole(character);
  const rarity = character?.rarity || 'COMMON';
  const rarityMult = { COMMON: 0.8, RARE: 1.0, EPIC: 1.25, LEGENDARY: 1.55, MYTHIC: 2.05, DIVINE: 2.8, SECRET: 3.6 }[rarity] || 1;
  const level = Number(card?.level || 1);
  const levelMult = 1 + ((level - 1) * 0.04);

  let atkScale = 1.05, hpScale = 7.2, defScale = 0.58, spd = 105, crit = 14, energy = 100, shield = 0, pen = 0;
  if (role === 'Tank') { atkScale = 0.72; hpScale = 13.5; defScale = 1.22; spd = 92; shield = 20; crit = 8; }
  if (role === 'Support') { atkScale = 0.78; hpScale = 9.0; defScale = 0.82; spd = 112; energy = 140; shield = 12; crit = 10; }
  if (role === 'Control') { atkScale = 0.88; hpScale = 8.5; defScale = 0.76; spd = 120; energy = 128; crit = 12; }
  if (role === 'Assassin') { atkScale = 1.35; hpScale = 5.8; defScale = 0.42; spd = 145; crit = 30; pen = 15; }
  if (role === 'Mage') { atkScale = 1.42; hpScale = 6.2; defScale = 0.48; spd = 110; crit = 18; energy = 122; pen = 25; }
  if (role === 'DPS') { atkScale = 1.18; hpScale = 7.2; defScale = 0.58; spd = 108; crit = 18; }

  const atk = Math.floor(p * atkScale * rarityMult * levelMult);
  const hp = Math.floor(p * hpScale * rarityMult * levelMult);
  const def = Math.floor(p * defScale * rarityMult * levelMult);

  return (
    `Class: **${role}** | Element: **${vrSafeElement(character)}**\n` +
    `Level **${level}/99** • ATK **${money(atk)}** • HP **${money(hp)}** • DEF **${money(def)}** • SPD **${spd}**\n` +
    `CRIT **${crit}%** • PEN **${pen}%** • Energy **${energy}%** • Shield **${shield}%**\n` +
    `Character Passive: ${vrCharacterPassive(character)}`
  );
}

function vrFullStatsBlock(card, character, includeTeamUps = true) {
  const teamUps = includeTeamUps ? vrTeamUpsForCharacter(character) : [];
  return vrStatsLine(card, character) + (teamUps.length ? `\n\nTeam Up Buffs:\n${teamUps.join('\n')}` : '\n\nTeam Up Buffs:\nNone');
}

function vrFormationRequirement(mode, progress) {
  const value = mode === 'story' ? progress.chapter : mode === 'tower' ? progress.towerFloor : progress.dungeonFloor;
  if (value >= 72) return 9;
  if (value >= 64) return 8;
  if (value >= 56) return 7;
  if (value >= 48) return 6;
  if (value >= 40) return 5;
  if (value >= 32) return 4;
  if (value >= 20) return 3;
  if (value >= 10) return 2;
  return 1;
}

async function vrGetFormations(userId, formationCount = 1) {
  const take = Math.max(1, Math.min(9, formationCount)) * 6;
  const slots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  const allFallback = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take
  });

  const teams = [];
  for (let f = 1; f <= formationCount; f++) {
    const start = (f - 1) * 6 + 1;
    const end = start + 5;
    let cards = slots.filter(s => s.slot >= start && s.slot <= end).map(s => s.card).filter(Boolean);
    if (!cards.length) cards = allFallback.slice((f - 1) * 6, f * 6);
    teams.push(cards.slice(0, 6));
  }
  return teams;
}

async function vrFormationPower(userId, formationCount = 1) {
  const teams = await vrGetFormations(userId, formationCount);
  let power = 0;
  const buffs = [];
  for (const team of teams) {
    const base = team.reduce((sum, c) => sum + Number(c.power || 0), 0);
    const syn = vrTeamUpsForCards(team);
    power += Math.floor(base * (1 + (syn.length * 0.08)));
    buffs.push(...syn.map(s => `${s.name}: ${s.buff}`));
  }
  return { teams, power, buffs: [...new Set(buffs)] };
}

function vrRewardsFor(mode, required, progress) {
  const progressNumber = mode === 'story'
    ? (((progress.chapter - 1) * 30) + progress.stage)
    : mode === 'tower'
      ? progress.towerFloor
      : progress.dungeonFloor;

  const gold = Math.floor(required * (mode === 'story' ? 0.8 : mode === 'tower' ? 0.75 : 0.7));
  const tokens = Math.max(1, Math.floor(progressNumber / 5) + (mode === 'story' ? 2 : 1));
  const rolls = mode === 'story' ? 3 : 2;
  const xp = mode === 'story' ? 65 : mode === 'tower' ? 75 : 55;
  return { gold, tokens, rolls, xp };
}
// ===== END FULL STARTER UPDATE HELPERS =====

function teamRequirementFor(mode, progress) {
  return vrFormationRequirement(mode, progress);
}

const SYNERGY_RULES = [
  { name: 'Hunter Bond', keys: ['gon', 'killua'], atk: 0.10, speed: 0.15, ult: 0.10 },
  { name: 'Kurta Revenge', keys: ['kurapika', 'leorio'], atk: 0.12, defBreak: 0.15 },
  { name: 'Rival Bond', keys: ['naruto', 'sasuke'], atk: 0.20, ult: 0.10 },
  { name: 'Monster Trio', keys: ['luffy', 'zoro', 'sanji'], atk: 0.20, hp: 0.15 },
  { name: 'Jujutsu Core', keys: ['yuji', 'megumi', 'nobara'], atk: 0.12, ult: 0.20 },
  { name: 'Strongest Duo', keys: ['gojo', 'geto'], ult: 0.25, control: 0.15 },
  { name: 'Saiyan Rivalry', keys: ['goku', 'vegeta'], atk: 0.25 },
  { name: 'Master Student', keys: ['gohan', 'piccolo'], def: 0.20, ult: 0.15 },
  { name: 'Uchiha Bloodline', keys: ['itachi', 'sasuke'], atk: 0.15, crit: 0.10 },
  { name: 'Akatsuki Pressure', keys: ['pain', 'obito', 'itachi'], atk: 0.18, control: 0.12 },
  { name: 'Shadow Army', keys: ['sung jin', 'igris'], atk: 0.18, ult: 0.12 },
  { name: 'Overlord Guardians', keys: ['ainz', 'albedo'], def: 0.20, ult: 0.10 },
  { name: 'Fate Oath', keys: ['saber', 'gilgamesh'], atk: 0.16, crit: 0.08 },
  { name: 'Control Kings', keys: ['lelouch', 'makima'], control: 0.25, ult: 0.15 }
];

function cardNameList(cards) {
  return cards.map(c => phase2Normalize(c.character?.name || '')).join(' | ');
}

function calculateSynergies(cards) {
  const text = cardNameList(cards);
  const active = [];

  for (const rule of SYNERGY_RULES) {
    if (rule.keys.every(k => text.includes(phase2Normalize(k)))) {
      active.push(rule);
    }
  }

  const bonus = active.reduce((sum, r) =>
    sum + (r.atk || 0) + (r.def || 0) + (r.hp || 0) + (r.ult || 0) + (r.control || 0) + (r.crit || 0) + (r.speed || 0) + (r.defBreak || 0),
  0);

  return { active, bonus };
}

async function getUserTeams(userId, teamCount = 1) {
  const slots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  const teams = [];

  for (let t = 1; t <= teamCount; t++) {
    const start = (t - 1) * 5 + 1;
    const end = start + 4;
    let team = slots.filter(s => s.slot >= start && s.slot <= end).map(s => s.card).filter(Boolean);

    if (!team.length) {
      const skip = (t - 1) * 5;
      team = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { power: 'desc' },
        skip,
        take: 5
      });
    }

    teams.push(team.slice(0, 5));
  }

  return teams;
}

function enemyTeamMultiplier(teamCount) {
  return 1 + (teamCount - 1) * 0.85;
}

async function getMultiTeamPower(userId, teamCount = 1) {
  const data = await vrFormationPower(userId, teamCount);
  return {
    power: data.power,
    teams: data.teams,
    synergies: data.buffs
  };
}

async function autoBuildTeams(userId, teamCount = 1) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: teamCount * 5
  });

  await prisma.teamSlot.deleteMany({
    where: { userId, slot: { lte: teamCount * 5 } }
  });

  for (let x = 0; x < cards.length; x++) {
    await prisma.teamSlot.create({
      data: {
        id: `${userId}_${x + 1}`,
        userId,
        slot: x + 1,
        cardId: cards[x].id
      }
    });
  }

  return cards;
}

async function getOrCreateProgress(userId) {
  return prisma.storyProgress.upsert({
    where: { userId },
    update: {},
    create: {
      id: nanoid(12),
      userId,
      chapter: 1,
      stage: 1,
      dungeonFloor: 1,
      towerFloor: 1
    }
  });
}

function getProgressTitle(mode, progress) {
  if (mode === 'story') return `Chapter ${progress.chapter}, Stage ${progress.stage}/30`;
  if (mode === 'tower') return `Tower Floor ${progress.towerFloor}`;
  return `Dungeon Floor ${progress.dungeonFloor}`;
}

async function updateProgressAfterWin(userId, mode, progress) {
  if (mode === 'story') {
    let nextStage = progress.stage + 1;
    let nextChapter = progress.chapter;

    if (nextStage > 30) {
      nextStage = 1;
      nextChapter += 1;
    }

    if (nextChapter > 80) {
      nextChapter = 80;
      nextStage = 30;
    }

    return prisma.storyProgress.update({
      where: { userId },
      data: { chapter: nextChapter, stage: nextStage }
    });
  }

  if (mode === 'tower') {
    return prisma.storyProgress.update({
      where: { userId },
      data: { towerFloor: progress.towerFloor + 1 }
    });
  }

  return prisma.storyProgress.update({
    where: { userId },
    data: { dungeonFloor: progress.dungeonFloor + 1 }
  });
}

async function getUserBattleTeam(userId) {
  const teamSlots = await prisma.teamSlot.findMany({
    where: { userId },
    include: { card: { include: { character: true } } },
    orderBy: { slot: 'asc' }
  }).catch(() => []);

  const fromTeam = teamSlots.map(s => s.card).filter(Boolean).slice(0, 6);
  if (fromTeam.length) return fromTeam;

  return prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 6
  });
}

async function getTeamPower(userId) {
  const cards = await getUserBattleTeam(userId);
  return cards.reduce((sum, c) => sum + (c.power || 0), 0);
}

async function getAnimeEnemies(count = 5, minPower = 0) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    orderBy: { basePower: 'desc' },
    take: 350
  });

  const pool = chars.filter(c => (c.basePower || 0) >= minPower);
  const source = pool.length ? pool : chars;
  const shuffled = source.sort(() => Math.random() - 0.5);

  return shuffled.slice(0, count).map(c => c.name);
}

async function runProgressBattle(interaction, mode) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const progress = await getOrCreateProgress(userId);
  const requiredTeams = vrFormationRequirement(mode, progress);
  const teamData = await vrFormationPower(userId, requiredTeams);
  const teamPower = teamData.power;

  const storyIndex = ((progress.chapter - 1) * 30) + progress.stage;
  const baseRequired = mode === 'story'
    ? 650 + storyIndex * 240
    : mode === 'tower'
      ? 1050 + progress.towerFloor * 390
      : 850 + progress.dungeonFloor * 320;

  const required = Math.floor(baseRequired * (1 + (requiredTeams - 1) * 0.78));
  const enemies = await getAnimeEnemies(requiredTeams * 6, Math.max(0, required / 10));

  let allyMana = 0;
  let enemyMana = 0;

  let text =
    `**${mode.toUpperCase()} BATTLE STARTED**\n` +
    `${getProgressTitle(mode, progress)}\n` +
    `Formations Required: **${requiredTeams}** | 6 characters each\n` +
    `Team Power: **${money(teamPower)}**\n` +
    `Enemy Formations: **${requiredTeams}**\n` +
    `Required Power: **${money(required)}**\n` +
    (teamData.buffs.length ? `Team Buffs: **${teamData.buffs.slice(0, 6).join(' | ')}**\n` : '') +
    `Enemies: **${enemies.slice(0, 12).join(', ')}**\n\n`;

  await interaction.editReply(text + 'Battle is starting...');

  for (let r = 1; r <= 6; r++) {
    const enemy = enemies[(r - 1) % Math.max(1, enemies.length)];
    const hit = Math.max(50, Math.floor(teamPower / (6 + r) + Math.random() * 350));
    const enemyHit = Math.max(30, Math.floor(required / (10 + r) + Math.random() * 220));

    allyMana += 24 + Math.floor(Math.random() * 20) + (teamData.buffs.length * 2);
    enemyMana += 17 + Math.floor(Math.random() * 18);

    text += `\n__Round ${r}__\n`;
    text += `🩸 Your team hit **${enemy}** for **${money(hit)}**. Energy: ${Math.min(100, allyMana)}/100\n`;

    if (allyMana >= 100) {
      const ult = Math.floor(hit * (2.4 + Math.min(0.6, teamData.buffs.length * 0.08)));
      text += `**TEAM ULTIMATE COMBO!** dealt **${money(ult)}** damage!\n`;
      allyMana = 0;
    }

    text += `🩸 **${enemy}** hit back for **${money(enemyHit)}**. Enemy Energy: ${Math.min(100, enemyMana)}/100\n`;

    if (enemyMana >= 100) {
      const enemyUlt = Math.floor(enemyHit * 2.0);
      text += `**ENEMY ULTIMATE!** ${enemy} dealt **${money(enemyUlt)}** damage!\n`;
      enemyMana = 0;
    }

    await new Promise(resolve => setTimeout(resolve, 450));
    await interaction.editReply(text.slice(-1900)).catch(() => {});
  }

  const won = teamPower >= required || Math.random() < Math.min(0.35, teamPower / Math.max(1, required) / 3);

  if (!won) {
    text += `\nDefeat. Upgrade your team, level characters, or use stronger formations.`;
    return interaction.editReply(text.slice(-1900));
  }

  const rewards = vrRewardsFor(mode, required, progress);

  await prisma.user.update({
    where: { id: userId },
    data: {
      gold: { increment: rewards.gold },
      tokens: { increment: rewards.tokens },
      rolls: { increment: rewards.rolls }
    }
  });

  await updateProgressAfterWin(userId, mode, progress);
  const xpResult = await addUserXp(userId, rewards.xp, mode);

  text +=
    `\n**Victory!**\n` +
    `Rewards: **${money(rewards.gold)} Gold**, **${rewards.tokens} Tokens**, **${rewards.rolls} Rolls**, **${rewards.xp} XP**.\n` +
    `Progress saved.` + levelUpText(xpResult);

  return interaction.editReply(text.slice(-1900));
}

async function sendBossAnnouncement(channel) {
  const bossNames = [
    'Sukuna, King of Curses',
    'Madara Uchiha',
    'Aizen, Lord of Illusions',
    'Kaido, Beast Emperor',
    'Muzan, Demon King',
    'Meruem, Chimera King',
    'Dio Brando',
    'Frieza, Emperor of Evil'
  ];

  const bossName = bossNames[Math.floor(Math.random() * bossNames.length)];
  const eventId = `${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  const boss = {
    id: eventId,
    bossName,
    hp: 750000 + Math.floor(Math.random() * 500000),
    power: 250000 + Math.floor(Math.random() * 200000),
    rewardGold: 250000,
    rewardTokens: 50,
    entries: new Set(),
    channelId: channel.id
  };

  activeBosses.set(eventId, boss);

  const embed = new EmbedBuilder()
    .setTitle(`WORLD BOSS SPAWNED: ${bossName}`)
    .setDescription(
      `Boss Power: **${money(boss.power)}**\n` +
      `Boss HP: **${money(boss.hp)}**\n` +
      `Rewards: **${money(boss.rewardGold)} gold**, **${boss.rewardTokens} tokens**, rare drops.\n\n` +
      `اضغط الزر عشان تدخل البوس.\n` +
      `القتال يبدأ تلقائيًا بعد دقيقتين، وبتشوف لوق لايف للضربات والالتات.`
    )
    .setColor(0x8b0000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`boss_join_${eventId}`)
      .setLabel('Join Boss')
      .setStyle(ButtonStyle.Danger)
  );

  const msg = await channel.send({ embeds: [embed], components: [row] });

  setTimeout(async () => {
    const latest = activeBosses.get(eventId);
    if (!latest) return;

    await msg.edit({ components: [] }).catch(() => {});

    const players = Array.from(latest.entries);
    if (!players.length) {
      activeBosses.delete(eventId);
      return channel.send(`**${bossName}** disappeared. No one joined.`);
    }

    const battleMsg = await channel.send(
      `**BOSS FIGHT STARTED: ${bossName}**\n` +
      `Players joined: **${players.length}**\n` +
      `Boss HP: **${money(latest.hp)}**\n\n` +
      `Loading teams...`
    );

    const playerTeams = [];
    let totalPower = 0;

    for (const joinedUserId of players) {
      const cards = await getUserBattleTeam(joinedUserId);
      const power = cards.reduce((sum, c) => sum + (c.power || 0), 0);
      totalPower += power;
      playerTeams.push({ userId: joinedUserId, cards, power, mana: 0 });
    }

    let bossHp = latest.hp;
    let bossMana = 0;
    let log =
      `**BOSS FIGHT: ${bossName}**\n` +
      `Boss HP: **${money(bossHp)}**\n` +
      `Players: **${players.length}**\n\n`;

    log += `**Teams**\n`;
    for (const p of playerTeams) {
      const names = p.cards.map(c => c.character?.name || 'Unknown').join(', ');
      log += `<@${p.userId}>: ${names || 'No cards'} • PWR **${money(p.power)}**\n`;
    }

    await battleMsg.edit(log.slice(-1900)).catch(() => {});

    for (let round = 1; round <= 7; round++) {
      log += `\n__**Round ${round}**__\n`;

      for (const p of playerTeams) {
        const cards = p.cards.length ? p.cards : [{ power: 100, character: { name: 'Unknown Fighter' } }];

        for (const card of cards) {
          const name = card.character?.name || 'Unknown Fighter';
          const dmg = Math.max(50, Math.floor((card.power || 100) * (0.12 + Math.random() * 0.10)));
          bossHp -= dmg;
          p.mana += 22 + Math.floor(Math.random() * 18);

          log += `**${name}** hit ${bossName} for **${money(dmg)}**. Mana: ${Math.min(100, p.mana)}/100\n`;

          if (p.mana >= 100) {
            const ultDmg = Math.max(150, Math.floor((card.power || 100) * (0.42 + Math.random() * 0.22)));
            bossHp -= ultDmg;
            p.mana = 0;
            log += `**${name} ULTIMATE!** dealt **${money(ultDmg)}** damage!\n`;
          }

          if (bossHp <= 0) break;
        }

        if (bossHp <= 0) break;
      }

      bossMana += 28 + Math.floor(Math.random() * 22);

      if (bossHp > 0) {
        if (bossMana >= 100) {
          bossMana = 0;
          const target = playerTeams[Math.floor(Math.random() * playerTeams.length)];
          const targetCard = target.cards[Math.floor(Math.random() * Math.max(1, target.cards.length))];
          const targetName = targetCard?.character?.name || 'the team';
          const bossUlt = Math.floor(latest.power * (0.08 + Math.random() * 0.05));
          log += `**${bossName} ULTIMATE!** crushed **${targetName}** for **${money(bossUlt)}** damage!\n`;
        } else {
          const target = playerTeams[Math.floor(Math.random() * playerTeams.length)];
          const bossHit = Math.floor(latest.power * (0.025 + Math.random() * 0.025));
          log += `**${bossName}** attacks <@${target.userId}> team for **${money(bossHit)}**. Boss Mana: ${bossMana}/100\n`;
        }
      }

      log += `Boss HP left: **${money(Math.max(0, bossHp))}**\n`;

      await new Promise(resolve => setTimeout(resolve, 1200));
      await battleMsg.edit(log.slice(-1900)).catch(() => {});

      if (bossHp <= 0) break;
    }

    const won = bossHp <= 0 || totalPower >= latest.power;

    log += `\n__**Final Result**__\n`;
    log += `Total Team Power: **${money(totalPower)}** / Boss Power: **${money(latest.power)}**\n`;

    if (won) {
      const goldEach = Math.floor(latest.rewardGold / players.length);
      const tokensEach = Math.max(1, Math.floor(latest.rewardTokens / players.length));

      for (const joinedUserId of players) {
        await prisma.user.update({
          where: { id: joinedUserId },
          data: {
            gold: { increment: goldEach },
            tokens: { increment: tokensEach },
            rolls: { increment: 5 }
          }
        }).catch(() => {});
      }

      log += `Boss defeated! Each player got **${money(goldEach)} gold**, **${tokensEach} tokens**, **5 rolls**.`;
    } else {
      log += `Boss survived. Upgrade your team.`;
    }

    activeBosses.delete(eventId);
    return battleMsg.edit(log.slice(-1900)).catch(() => channel.send(log.slice(-1900)));
  }, 2 * 60 * 1000);

  return boss;
}

async function autoBossLoop() {
  const channelId = process.env.BOSS_EVENT_CHANNEL_ID;
  if (!channelId) return;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    console.log('Auto boss skipped: invalid BOSS_EVENT_CHANNEL_ID');
    return;
  }

  await sendBossAnnouncement(channel);
}

async function passiveFarmClaim(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { power: 'desc' },
    take: 5
  });

  if (!cards.length) throw new Error('You need at least one character to farm.');

  const now = Date.now();
  const last = new Date(user.lastPassiveClaimAt || now - 60 * 60 * 1000).getTime();
  const hours = Math.max(1, Math.min(12, Math.floor((now - last) / (60 * 60 * 1000)) || 1));
  const teamPower = cards.reduce((sum, c) => sum + (c.power || 0), 0);
  const gold = Math.floor((teamPower / 7) * hours);
  const tokens = Math.max(1, Math.floor(hours / 2));
  const rolls = Math.max(1, Math.floor(hours / 3));

  await prisma.user.update({
    where: { id: userId },
    data: {
      gold: { increment: gold },
      tokens: { increment: tokens },
      rolls: { increment: rolls },
      lastPassiveClaimAt: new Date()
    }
  });

  return { gold, tokens, rolls, hours, teamPower };
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  await seedItemTemplates().catch(e => console.error('Item seed failed:', e));
  await applySecretCharacterBoosts().catch(e => console.error('Secret boost failed:', e));
  await phase2ApplyRarityFixes().catch(e => console.error('Phase2 rarity fix failed:', e));
  await fixImportantVariants().catch(e => console.error('Important variants fix failed:', e));
  await syncAllCardPowers(prisma).catch(e => console.error('Power sync failed:', e));

  const firstBossDelay = Number(process.env.BOSS_EVENT_FIRST_DELAY_SECONDS || 90) * 1000;
  const bossInterval = Number(process.env.BOSS_EVENT_INTERVAL_MINUTES || 60) * 60 * 1000;
  setTimeout(autoBossLoop, firstBossDelay);
  setInterval(autoBossLoop, bossInterval);
});


async function vrPrepareInteraction(i) {
  if (!i.isChatInputCommand()) return;

  const originalReply = i.reply.bind(i);
  const originalEditReply = i.editReply.bind(i);
  const originalDeferReply = i.deferReply.bind(i);

  i.deferReply = async function patchedDeferReply(options = {}) {
    if (i.deferred || i.replied) return null;
    return originalDeferReply(options).catch(() => null);
  };

  i.reply = async function patchedReply(payload) {
    if (i.deferred || i.replied) {
      return originalEditReply(payload).catch(async () => {
        try { return await i.followUp(payload); } catch { return null; }
      });
    }
    return originalReply(payload).catch(async () => {
      try { return await originalDeferReply(); } catch {}
      return originalEditReply(payload).catch(() => null);
    });
  };

  if (!i.deferred && !i.replied) {
    await originalDeferReply().catch(() => null);
  }
}


// ===== FINAL COMMANDS + PASSIVES + TEAM UPS PATCH =====
async function vrPrepareInteraction(i) {
  if (!i.isChatInputCommand()) return;

  const originalReply = i.reply.bind(i);
  const originalEditReply = i.editReply.bind(i);
  const originalDeferReply = i.deferReply.bind(i);

  i.deferReply = async function patchedDeferReply(options = {}) {
    if (i.deferred || i.replied) return null;
    return originalDeferReply(options).catch(() => null);
  };

  i.reply = async function patchedReply(payload) {
    if (i.deferred || i.replied) {
      return originalEditReply(payload).catch(async () => {
        try { return await i.followUp(payload); } catch { return null; }
      });
    }

    return originalReply(payload).catch(async () => {
      try { await originalDeferReply(); } catch {}
      return originalEditReply(payload).catch(() => null);
    });
  };

  if (!i.deferred && !i.replied) {
    await originalDeferReply().catch(() => null);
  }
}

function vrText(character) {
  return `${phase2Normalize(character?.name || '')} ${phase2Normalize(character?.anime || '')}`.replace(/[.\-_:\/]+/g, ' ');
}

function vrHas(character, keys = []) {
  const text = vrText(character);
  return keys.some(k => text.includes(phase2Normalize(k).replace(/[.\-_:\/]+/g, ' ')));
}

const VR_ELEMENTS_FINAL = ['Dark','Light','Fire','Ice','Shadow','Curse','Void','Lightning','Soul'];

function vrHashFinal(text = '') {
  let h = 0;
  for (const ch of String(text)) h = ((h << 5) - h) + ch.charCodeAt(0);
  return Math.abs(h);
}

function vrSafeElement(character) {
  const old = String(character?.element || '').trim();
  if (old && !['Neutral','Anime','undefined','null'].includes(old)) return old;

  if (vrHas(character, ['sukuna','makima','toji','ainz','dio','alucard','devil','demon','curse'])) return 'Dark';
  if (vrHas(character, ['sung jin','jinwoo','jin woo','shadow','igris','beru','cid kagenou'])) return 'Shadow';
  if (vrHas(character, ['gojo','rimuru','gilgamesh','aizen','yhwach','void','space','time'])) return 'Void';
  if (vrHas(character, ['saber','artoria','goku','naruto','luffy','saitama','hero','saint'])) return 'Light';
  if (vrHas(character, ['ace','rengoku','natsu','shinra','flame','fire','yamamoto'])) return 'Fire';
  if (vrHas(character, ['killua','zenitsu','kakashi','thunder','lightning'])) return 'Lightning';
  if (vrHas(character, ['ichigo','rukia','bleach','soul','spirit'])) return 'Soul';
  if (vrHas(character, ['ice','frost','snow','rukia'])) return 'Ice';
  return VR_ELEMENTS_FINAL[vrHashFinal(vrText(character)) % VR_ELEMENTS_FINAL.length];
}

function vrCharacterRole(character) {
  if (vrHas(character, ['lelouch','aizen','makima','kurapika','shikamaru','light yagami','near','l lawliet'])) return 'Control';
  if (vrHas(character, ['rimuru','megumi','kakashi','sakura','orihime','shoko','reigen','chopper','tsunade','cc','c c'])) return 'Support';
  if (vrHas(character, ['saber','artoria','ainz','whitebeard','kaido','all might','escanor','albedo','reinhard'])) return 'Tank';
  if (vrHas(character, ['killua','toji','levi','hisoka','zenitsu','yoroichi','akame','kirito'])) return 'Assassin';
  if (vrHas(character, ['gojo','madara','gilgamesh','sukuna','yhwach','dio','meruem','frieren','sinbad'])) return 'Mage';
  return 'DPS';
}

function vrCharacterPassive(character) {
  const t = vrText(character);

  const exact = [
    [['lelouch'], 'Geass Command: boosts team ultimate charge and reduces enemy control resistance.'],
    [['c c','cc'], 'Immortal Witch: grants regeneration and extra energy to the highest ATK ally.'],
    [['sung jin','jinwoo','jin woo'], 'Shadow Monarch: gains stacking ATK after every defeated enemy and boosts Shadow allies.'],
    [['gojo'], 'Infinity: reduces incoming damage and charges ultimate when attacked.'],
    [['geto'], 'Cursed Spirit Control: increases Curse/Summon damage and weakens enemy DEF.'],
    [['saber','artoria'], 'Avalon: grants shield at battle start and reduces burst damage.'],
    [['makima'], 'Control Devil: lowers enemy ATK and increases control chance.'],
    [['reze'], 'Bomb Devil: ultimate applies explosive burst damage over time.'],
    [['denji'], 'Chainsaw Heart: lifesteal increases when HP is low.'],
    [['power'], 'Blood Fiend: crit chance increases after taking damage.'],
    [['luffy'], 'Liberation Rhythm: gains ATK and speed every round.'],
    [['zoro'], 'Three Sword Style: high crit damage against bosses.'],
    [['sanji'], 'Diable Jambe: fire damage and dodge chance.'],
    [['nami'], 'Weather Tempo: increases team speed and Lightning damage.'],
    [['naruto'], 'Nine-Tails Chakra: heals slightly and boosts Light allies.'],
    [['sasuke'], 'Sharingan: crit and counter chance.'],
    [['itachi'], 'Tsukuyomi: chance to delay enemy ultimate.'],
    [['madara'], 'Uchiha Dominion: AoE ultimate damage increased.'],
    [['obito'], 'Kamui: dodge chance and enemy accuracy reduction.'],
    [['ichigo'], 'Bankai Pressure: Soul damage and speed increase.'],
    [['aizen'], 'Kyoka Suigetsu: lowers enemy accuracy and control resistance.'],
    [['rukia'], 'Sode no Shirayuki: Ice damage and enemy speed reduction.'],
    [['killua'], 'Godspeed: high speed and crit burst.'],
    [['gon'], 'Jajanken: huge single target ultimate damage.'],
    [['kurapika'], 'Chain Judgment: bonus damage against villain teams.'],
    [['hisoka'], 'Bungee Gum: crit damage and dodge chance.'],
    [['toji'], 'Heavenly Restriction: ignores part of enemy DEF.'],
    [['sukuna'], 'King of Curses: executes weakened enemies and boosts Dark damage.'],
    [['yuji'], 'Black Flash Chain: crit chance increases after every attack.'],
    [['megumi'], 'Ten Shadows: summons add bonus Shadow damage.'],
    [['nobara'], 'Resonance: marks enemy and increases team burst damage.'],
    [['rimuru'], 'Predator: copies a small part of enemy buffs.'],
    [['ainz'], 'Overlord: boosts Dark allies and reduces enemy resistance.'],
    [['albedo'], 'Guardian Overseer: shields the frontline and boosts Tank DEF.'],
    [['gilgamesh'], 'Gate of Babylon: high PEN and ultimate burst.'],
    [['vegeta'], 'Saiyan Pride: gains ATK after taking damage.'],
    [['goku'], 'Limit Breaker: ultimate damage scales with battle rounds.'],
    [['saitama'], 'One Punch Pressure: massive single-hit scaling against bosses.'],
    [['tanjiro'], 'Hinokami Kagura: Fire burst and small team heal.'],
    [['nezuko'], 'Demon Blood Art: team regen and Dark resistance.'],
    [['zenitsu'], 'Thunder Breathing: first ultimate charges faster.'],
    [['inosuke'], 'Beast Instinct: bonus crit and lifesteal.'],
    [['rengoku'], 'Flame Hashira: boosts Fire allies and frontline damage.']
  ];

  for (const [keys, passive] of exact) {
    if (keys.some(k => t.includes(phase2Normalize(k).replace(/[.\-_:\/]+/g, ' ')))) return passive;
  }

  const anime = t;
  if (anime.includes('code geass')) return 'Tactical Order: increases Control chance and ultimate charge.';
  if (anime.includes('chainsaw')) return 'Devil Contract: bonus damage when HP is low.';
  if (anime.includes('fate')) return 'Heroic Spirit: balanced stats and ultimate charge.';
  if (anime.includes('jujutsu')) return 'Cursed Energy: PEN and control resistance.';
  if (anime.includes('one piece')) return 'Grand Line Spirit: speed and crit chance.';
  if (anime.includes('naruto')) return 'Shinobi Tactics: dodge and burst damage.';
  if (anime.includes('bleach')) return 'Spiritual Pressure: Soul damage and resistance.';
  if (anime.includes('hunter')) return 'Nen Flow: crit and energy regen.';
  if (anime.includes('demon slayer')) return 'Breathing Style: speed and burst damage.';
  if (anime.includes('dragon ball')) return 'Ki Surge: ATK increases each round.';

  const role = vrCharacterRole(character);
  const element = vrSafeElement(character);
  const variants = {
    Tank: [
      `Iron Guard: +DEF scaling and ${element} resistance.`,
      `Frontline Wall: absorbs part of ally damage.`,
      `Last Stand: gains shield when HP is low.`
    ],
    Support: [
      `Battle Support: increases team energy regen.`,
      `Guardian Aid: grants small shield to weakest ally.`,
      `Tactical Heal: improves sustain during long fights.`
    ],
    Control: [
      `Mind Game: reduces enemy ultimate charge.`,
      `Pressure Field: lowers enemy accuracy.`,
      `Command Aura: increases control chance.`
    ],
    Assassin: [
      `Killer Tempo: high crit after first attack.`,
      `Silent Step: bonus speed and dodge chance.`,
      `Weak Point: ignores part of DEF.`
    ],
    Mage: [
      `${element} Burst: ultimate damage scales with PEN.`,
      `Arcane Pressure: weakens enemy resistance.`,
      `Mana Surge: faster ultimate charge.`
    ],
    DPS: [
      `Battle Instinct: ATK rises every round.`,
      `Power Strike: bonus damage to bosses.`,
      `${element} Edge: basic attacks gain elemental damage.`
    ]
  };
  const list = variants[role] || variants.DPS;
  return list[vrHashFinal(t) % list.length];
}

const VR_TEAM_UP_RULES_FINAL = [
  { name: 'Zero Requiem', keys: ['lelouch','c c'], buff: '+20% control chance, +15% ultimate charge' },
  { name: 'Strongest Past', keys: ['gojo','geto'], buff: '+18% Void damage, +10% ultimate charge' },
  { name: 'Hunter Bond', keys: ['gon','killua'], buff: '+15% speed, +12% crit' },
  { name: 'Monster Trio', keys: ['luffy','zoro','sanji'], buff: '+18% ATK, +10% speed' },
  { name: 'Uchiha Bloodline', keys: ['itachi','sasuke'], buff: '+15% crit, +10% control resist' },
  { name: 'Rival Chakra', keys: ['naruto','sasuke'], buff: '+20% ultimate damage' },
  { name: 'Fate Clash', keys: ['saber','gilgamesh'], buff: '+15% PEN, +12% shield' },
  { name: 'Control Devils', keys: ['makima','reze'], buff: '+12% burst damage, enemy ATK down' },
  { name: 'Bleach Pressure', keys: ['ichigo','aizen'], buff: '+15% Soul damage' },
  { name: 'Saiyan Rivalry', keys: ['goku','vegeta'], buff: '+18% ATK after round 3' },
  { name: 'Jujutsu Core', keys: ['yuji','megumi','nobara'], buff: '+12% ATK, +15% ult charge' },
  { name: 'Demon Slayer Trio', keys: ['tanjiro','zenitsu','inosuke'], buff: '+12% speed, +12% crit' },
  { name: 'Shadow Army', keys: ['sung jin','igris'], buff: '+15% Shadow damage' },
  { name: 'Akatsuki Pressure', keys: ['pain','obito','itachi'], buff: '+15% Dark damage, enemy DEF down' }
];

function vrTeamUpsForCharacter(character) {
  const text = vrText(character);
  return VR_TEAM_UP_RULES_FINAL
    .filter(rule => rule.keys.some(k => text.includes(phase2Normalize(k).replace(/[.\-_:\/]+/g, ' '))))
    .map(rule => `• **${rule.name}** with ${rule.keys.map(k => `\`${k}\``).join(' + ')}: ${rule.buff}`);
}

function vrTeamUpsForCards(cards) {
  const text = cards.map(c => vrText(c.character || c)).join(' | ');
  const active = [];

  for (const rule of VR_TEAM_UP_RULES_FINAL) {
    if (rule.keys.every(k => text.includes(phase2Normalize(k).replace(/[.\-_:\/]+/g, ' ')))) active.push(rule);
  }

  const counts = {};
  for (const c of cards) {
    const e = vrSafeElement(c.character || c);
    counts[e] = (counts[e] || 0) + 1;
  }

  for (const [element, count] of Object.entries(counts)) {
    if (count >= 3) active.push({ name: `${element} Aura`, buff: count >= 6 ? '+24% team damage and HP' : '+12% team damage and HP' });
  }

  return active;
}

function vrStatsLine(card, character) {
  const p = Math.max(1, Number(card?.power || character?.basePower || 100));
  const role = vrCharacterRole(character);
  const rarity = character?.rarity || 'COMMON';
  const rarityMult = { COMMON: 0.8, RARE: 1.0, EPIC: 1.25, LEGENDARY: 1.55, MYTHIC: 2.05, DIVINE: 2.8, SECRET: 3.6 }[rarity] || 1;
  const level = Number(card?.level || 1);
  const levelMult = 1 + ((level - 1) * 0.04);

  let atkScale = 1.05, hpScale = 7.2, defScale = 0.58, spd = 105, crit = 14, energy = 100, shield = 0, pen = 0;
  if (role === 'Tank') { atkScale = 0.72; hpScale = 13.5; defScale = 1.22; spd = 92; shield = 20; crit = 8; }
  if (role === 'Support') { atkScale = 0.78; hpScale = 9.0; defScale = 0.82; spd = 112; energy = 140; shield = 12; crit = 10; }
  if (role === 'Control') { atkScale = 0.88; hpScale = 8.5; defScale = 0.76; spd = 120; energy = 128; crit = 12; }
  if (role === 'Assassin') { atkScale = 1.35; hpScale = 5.8; defScale = 0.42; spd = 145; crit = 30; pen = 15; }
  if (role === 'Mage') { atkScale = 1.42; hpScale = 6.2; defScale = 0.48; spd = 110; crit = 18; energy = 122; pen = 25; }
  if (role === 'DPS') { atkScale = 1.18; hpScale = 7.2; defScale = 0.58; spd = 108; crit = 18; }

  const atk = Math.floor(p * atkScale * rarityMult * levelMult);
  const hp = Math.floor(p * hpScale * rarityMult * levelMult);
  const def = Math.floor(p * defScale * rarityMult * levelMult);

  return (
    `Class: **${role}** | Element: **${vrSafeElement(character)}**\n` +
    `Level **${level}/99** • ATK **${money(atk)}** • HP **${money(hp)}** • DEF **${money(def)}** • SPD **${spd}**\n` +
    `CRIT **${crit}%** • PEN **${pen}%** • Energy **${energy}%** • Shield **${shield}%**\n` +
    `Character Passive: ${vrCharacterPassive(character)}`
  );
}

function vrFullStatsBlock(card, character, includeTeamUps = true) {
  const teamUps = includeTeamUps ? vrTeamUpsForCharacter(character) : [];
  return vrStatsLine(card, character) + (teamUps.length ? `\n\nTeam Up Buffs:\n${teamUps.join('\n')}` : '\n\nTeam Up Buffs:\nNone');
}
// ===== END FINAL PATCH =====

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      await ensureUser(i.user);
      if (i.customId.startsWith('inv_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await inventoryEmbed(i.user.id, next);

        if (data.empty) {
          return i.reply({ content: 'You do not have any cards yet.', ephemeral: true });
        }

        return i.update({ embeds: [data.embed], components: [data.row] });
      }

      if (i.customId.startsWith('boss_join_')) {
        const eventId = i.customId.replace('boss_join_', '');
        const boss = activeBosses.get(eventId);

        if (!boss) {
          return i.reply({ content: 'This boss event is no longer active.', ephemeral: true });
        }

        boss.entries.add(i.user.id);

        return i.reply({
          content: `دخلت البوس **${boss.bossName}**. عدد اللاعبين: **${boss.entries.size}**`,
          ephemeral: true
        });
      }

      if (i.customId.startsWith('trade_accept_') || i.customId.startsWith('trade_decline_')) {
        const isAccept = i.customId.startsWith('trade_accept_');
        const tradeId = i.customId.replace('trade_accept_', '').replace('trade_decline_', '');
        const trade = pendingTrades.get(tradeId);

        if (!trade) {
          return i.reply({ content: 'This trade offer is expired or already completed.', ephemeral: true });
        }

        if (i.user.id !== trade.targetId) {
          return i.reply({ content: 'Only the trade receiver can accept or decline this trade.', ephemeral: true });
        }

        if (!isAccept) {
          pendingTrades.delete(tradeId);
          return i.update({ content: `Trade declined by <@${trade.targetId}>.`, embeds: [], components: [] });
        }

        const offerCard = await prisma.userCard.findFirst({
          where: { id: trade.offerCardId, userId: trade.offerUserId },
          include: { character: true }
        });

        const requestCard = await prisma.userCard.findFirst({
          where: { id: trade.requestCardId, userId: trade.targetId },
          include: { character: true }
        });

        if (!offerCard || !requestCard) {
          pendingTrades.delete(tradeId);
          return i.update({
            content: 'Trade failed. One of the cards is no longer owned by the correct player.',
            embeds: [],
            components: []
          });
        }

        await prisma.$transaction([
          prisma.teamSlot.deleteMany({
            where: {
              OR: [
                { cardId: offerCard.id },
                { cardId: requestCard.id }
              ]
            }
          }),
          prisma.marketListing.updateMany({
            where: {
              OR: [
                { cardId: offerCard.id },
                { cardId: requestCard.id }
              ],
              status: 'ACTIVE'
            },
            data: { status: 'CANCELLED' }
          }),
          prisma.userCard.update({
            where: { id: offerCard.id },
            data: { userId: trade.targetId }
          }),
          prisma.userCard.update({
            where: { id: requestCard.id },
            data: { userId: trade.offerUserId }
          })
        ]);

        pendingTrades.delete(tradeId);

        return i.update({
          content:
            `**TRADE COMPLETE**\n` +
            `<@${trade.offerUserId}> gave **${offerCard.character.name}** to <@${trade.targetId}>.\n` +
            `<@${trade.targetId}> gave **${requestCard.character.name}** to <@${trade.offerUserId}>.`,
          embeds: [],
          components: []
        });
      }

      return;
    }

    if (!i.isChatInputCommand()) return;

    await vrPrepareInteraction(i);

    await ensureUser(i.user);

    const userId = i.user.id;
    const commandName = i.commandName;
    const fusionResults = [];

    if (commandName === 'bot-check') {
      return i.reply('✅ VoidRoll is responding.');
    }


    if (commandName === 'characters-count') {
      const total = await prisma.character.count({ where: { active: true } });
      return i.reply(`📚 **${total}**`);
    }


    if (commandName === 'team-buffs') {
      const slots = await prisma.teamSlot.findMany({
        where: { userId },
        include: { card: { include: { character: true } } },
        orderBy: { slot: 'asc' }
      }).catch(() => []);

      const cards = slots.map(s => s.card).filter(Boolean).slice(0, 6);
      if (!cards.length) return i.reply('No team equipped. Use /autoteam first.');

      const buffs = vrTeamUpsForCards(cards);
      if (!buffs.length) return i.reply('No active team-up buffs in current formation.');

      return i.reply(`**Current Team Up Buffs**\n` + buffs.map(b => `• **${b.name}**: ${b.buff}`).join('\n'));
    }

    if (commandName === 'stats') {
      const name = i.options.getString('name', true);
      const card = await phase2FindUserCardByName(userId, name);

      const slots = await prisma.teamSlot.findMany({
        where: { userId },
        include: { card: { include: { character: true } } },
        orderBy: { slot: 'asc' }
      }).catch(() => []);

      const teamCards = slots.map(s => s.card).filter(Boolean).slice(0, 6);
      const activeBuffs = vrTeamUpsForCards(teamCards);

      return i.reply(
        `${rarityEmoji(card.character.rarity)} **${card.character.name}** • ${card.character.anime} • PWR **${money(card.power)}**\n` +
        vrFullStatsBlock(card, card.character, true) +
        (activeBuffs.length ? `\n\nCurrent Formation Buffs:\n${activeBuffs.map(s => `• **${s.name}**: ${s.buff}`).join('\n')}` : '')
      );
    }

    if (commandName === 'admin-mal-stability') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      await i.deferReply({ ephemeral: true });
      const result = await keepOnlyMalCharactersAndBalance();

      return i.editReply(
        `✅ MAL Global Release Stability applied.\n` +
        `Disabled old/non-MAL: **${result.disabled}**\n` +
        `Active MAL characters: **${result.activeMal}**\n` +
        `Balanced: **${result.balanced}**\n` +
        `Images fixed: **${result.fixedImages}**`
      );
    }

    if (commandName === 'help') {
      await i.deferReply({ ephemeral: true });
      return i.editReply(
        `**VOIDROLL COMMANDS**\n` +
        `/r - Quick character roll\n` +
        `/i - Quick item roll\n` +
        `/roll - Roll a character or item\n` +
        `/search - Search characters\n` +
        `/inventory - Card inventory with arrows\n` +
        `/trade - Trade cards with another player\n` +
        `/secrets - Show SECRET characters\n` +
        `/rarity - Show roll rates\n` +
        `/autoteam - Equip strongest 5 cards\n` +
        `/profile - Show your profile\n` +
        `/story /dungeon /tower - Progress battles\n` +
        `/farm-claim - Claim passive farm\n` +
        `/gold-shop /gold-buy /train - Spend gold\n` +
        `/orb-shop /orb-roll /ascend - Upgrade and guaranteed rolls\n` +
        `/shop /banner /pack - Multiple rotating banners\n` +
        `/transfer /list /buy - Market\n` +
        `/admin-spawn-boss - Admin boss event`
      );
    }


    if (commandName === 'level') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      return i.reply(
        `⭐ **LEVEL PROFILE**\n` +
        `Level: **${u.level || 1}**\n` +
        `XP: **${u.xp || 0}/${xpForLevel(u.level || 1)}**\n\n` +
        `Next level reward:\n` +
        `Gold: **${money(levelReward((u.level || 1) + 1).gold)}**\n` +
        `Tokens: **${levelReward((u.level || 1) + 1).tokens}**\n` +
        `Rolls: **${levelReward((u.level || 1) + 1).rolls}**`
      );
    }

    if (commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const last = new Date(u.lastRollRefillAt || Date.now());
      const next = new Date(last.getTime() + (60 * 60 * 1000));

      return i.reply(
        `**${i.user.username}**\n` +
        `Gold: ${money(u.gold)}\n` +
        `Tokens: ${u.tokens ?? 0}\n` +
        `Rolls: ${u.rolls ?? 0}\n` +
        `Next Refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
        `Level: ${u.level}
XP: ${u.xp || 0}/${xpForLevel(u.level || 1)}`
      );
    }

    if (commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');

      if (cd) {
        return i.reply({ content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`, ephemeral: true });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: 1500 },
          tokens: { increment: 3 },
          dailyStreak: { increment: 1 }
        }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);

      const xpResult = await addUserXp(userId, 25, 'daily');
      return i.reply('Daily claimed: 1,500 gold + 3 tokens.' + levelUpText(xpResult));
    }

    if (commandName === 'roll' || commandName === 'r' || commandName === 'i') {
      await i.deferReply();

      let type = 'character';
      if (commandName === 'i') type = 'item';
      else if (commandName === 'r') type = 'character';
      else type = i.options.getString('type') || 'character';

      const amount = Math.max(1, Math.min(10, i.options.getInteger('amount') || 1));
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.rolls ?? 0) < amount) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));
        return i.editReply(`You need **${amount} rolls** but you only have **${user.rolls ?? 0}**.\nNext refill: <t:${Math.floor(next.getTime() / 1000)}:R>`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { rolls: { decrement: amount } }
      });

      if (type === 'item') {
        const lines = [];
        for (let x = 0; x < amount; x++) {
          const eq = await rollItem(userId);
          lines.push(`${x + 1}. ${eq.id} • ${eq.template.name} • ${eq.template.rarity} • PWR ${eq.power}`);
        }

        const xpResult = typeof addUserXp === 'function'
          ? await addUserXp(userId, amount * 5, 'item roll')
          : null;

        return i.editReply((`**ITEM ROLL x${amount}**\n` + lines.join('\n') + `\n\nRolls left: **${(user.rolls ?? 0) - amount}**` + (typeof levelUpText === 'function' ? levelUpText(xpResult) : '')).slice(0, 1900));
      }

      if (amount === 1) {
        const result = await rollCard(userId);
        const xpResult = typeof addUserXp === 'function'
          ? await addUserXp(userId, 8, 'character roll')
          : null;

        if (xpResult && xpResult.leveled && typeof levelUpText === 'function') {
          result.text += levelUpText(xpResult);
        }
          result.text += fusionText(fusionResults);

        const aura = getAura(result.character);

        const embed = new EmbedBuilder()
          .setTitle('New Character Roll!')
          .setDescription(
            `${result.text}\n\n` +
            `Anime: **${result.character.anime}**\n` +
            `Technique: **${aura.name}**\n` +
            characterStatsText(result.card, result.character) + `\n` +
            `Rolls left: **${(user.rolls ?? 1) - 1}**`
          )
          .setColor(embedColor(aura.color))
          .setFooter({ text: `Card ID: ${result.card.id}` });

        try {
          const png = await renderCard({ card: result.card, character: result.character });
          const file = new AttachmentBuilder(png, { name: 'card.png' });
          embed.setImage('attachment://card.png');
          return i.editReply({ embeds: [embed], files: [file] });
        } catch (err) {
          console.error(err);
          if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
          return i.editReply({ embeds: [embed] });
        }
      }

      const embeds = [];
      const files = [];
      const lines = [];

      for (let x = 0; x < amount; x++) {
        const result = await rollCard(userId);
        const aura = getAura(result.character);

        lines.push(`${x + 1}. ${rarityEmoji(result.character.rarity)} **${result.character.name}** • ${result.character.rarity} • PWR ${result.card.power}`);

        const embed = new EmbedBuilder()
          .setTitle(`${x + 1}. ${rarityEmoji(result.character.rarity)} ${result.character.name}`)
          .setDescription(
            `Anime: **${result.character.anime}**\n` +
            `Rarity: **${result.character.rarity}**\n` +
            `Power: **${result.card.power}**\n` +
            vrFullStatsBlock(result.card, result.character, true) + `\n` +
            `Card ID: \`${result.card.id}\`` + fusionText(fusionResults) + fusionText(fusionResults)
          )
          .setColor(embedColor(aura.color));

        try {
          const png = await renderCard({ card: result.card, character: result.character });
          const fileName = `roll-${x + 1}.png`;
          const file = new AttachmentBuilder(png, { name: fileName });
          embed.setImage(`attachment://${fileName}`);
          files.push(file);
        } catch (_) {
          if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        }

        embeds.push(embed);
      }

      const xpResult = typeof addUserXp === 'function'
        ? await addUserXp(userId, amount * 8, 'character roll')
        : null;

      return i.editReply({
        content: (`**CHARACTER ROLL x${amount}**\n` + lines.join('\n') + `\n\nRolls left: **${(user.rolls ?? 0) - amount}**` + (typeof levelUpText === 'function' ? levelUpText(xpResult) : '') + fusionText(fusionResults)).slice(0, 1800),
        embeds: embeds.slice(0, 10),
        files: files.slice(0, 10)
      });
    }

    if (commandName === 'search') {
      const q = i.options.getString('name', true);
      const tokens = phase2Normalize(q).replace(/[\/:_\-]+/g, ' ').split(/\s+/).filter(Boolean);

      const candidates = await prisma.character.findMany({
        where: {
          active: true,
          OR: tokens.length ? tokens.map(t => ({
            OR: [
              { name: { contains: t, mode: 'insensitive' } },
              { anime: { contains: t, mode: 'insensitive' } }
            ]
          })) : [
            { name: { contains: q, mode: 'insensitive' } },
            { anime: { contains: q, mode: 'insensitive' } }
          ]
        },
        take: 80
      });

      const chars = candidates
        .map(c => {
          const full = `${phase2Normalize(c.name)} ${phase2Normalize(c.anime)}`.replace(/[\/:_\-]+/g, ' ');
          let score = 0;
          for (const t of tokens) {
            if (full.includes(t)) score += 40;
            if (phase2Normalize(c.name).includes(t)) score += 60;
            if (phase2Normalize(c.anime).includes(t)) score += 35;
          }
          if (tokens.length && tokens.every(t => full.includes(t))) score += 140;
          score += { SECRET: 70, DIVINE: 55, MYTHIC: 40, LEGENDARY: 28, EPIC: 16, RARE: 8, COMMON: 0 }[c.rarity] || 0;
          return { c, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || Number(b.c.basePower || 0) - Number(a.c.basePower || 0))
        .slice(0, 10)
        .map(x => x.c);

      if (!chars.length) return i.reply(`No characters found for **${q}**.`);

      const first = chars[0];
      const embed = new EmbedBuilder()
        .setTitle(`Search: ${q}`)
        .setDescription(
          `**Best Match**\n` +
          `${rarityEmoji(first.rarity)} **${first.name}** • ${first.anime} • PWR **${money(first.basePower)}**\n` +
          vrFullStatsBlock({ power: first.basePower, level: 1 }, first, true) +
          `\n\n**Results**\n` +
          chars.map((c, idx) =>
            `${idx + 1}. ${rarityEmoji(c.rarity)} **${c.name}** • ${c.anime} • PWR ${money(c.basePower)} • ${vrCharacterRole(c)} • ${vrSafeElement(c)}`
          ).join('\n')
        )
        .setColor(embedColor(getAura(first).color));

      if (first.imageUrl) embed.setThumbnail(first.imageUrl);
      return i.reply({ embeds: [embed] });
    }

    if (commandName === 'secrets') {
      const chars = await prisma.character.findMany({
        where: { rarity: 'SECRET', active: true },
        orderBy: { basePower: 'desc' },
        take: 50
      });

      if (!chars.length) return i.reply('No SECRET characters found.');

      return i.reply(
        ('**SECRET Characters**\n' +
        chars.map((c, idx) => `${idx + 1}. ${rarityEmoji(c.rarity)} **${c.name}** • ${c.anime} • PWR ${money(c.basePower)}\n${vrStatsLine({ power: c.basePower, level: 1 }, c)}`).join('\n\n')).slice(0, 1900)
      );
    }

    if (commandName === 'rarity') {
      return i.reply(
        `**NORMAL ROLL RATES**\n\n` +
        `Character Roll\n` +
        `Common: 72%\nRare: 22%\nEpic: 5.65%\nLegendary: 1%\nMythic: 0.75%\nDivine: 0.5%\nSecret: 0.1%\n\n` +
        `Item Roll\n` +
        `Common: 65%\nRare: 26%\nEpic: 7.65%\nLegendary: 1%\nMythic: 0.75%\nDivine: 0.5%\nSecret: 0.1%`
      );
    }


    if (commandName === 'inv-search') {
      const q = i.options.getString('name', true);
      const tokens = phase2Normalize(q).replace(/[\/:_\-]+/g, ' ').split(/\s+/).filter(Boolean);

      const owned = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { power: 'desc' },
        take: 400
      });

      const matches = owned
        .map(card => {
          const full = `${phase2Normalize(card.character.name)} ${phase2Normalize(card.character.anime)}`.replace(/[\/:_\-]+/g, ' ');
          let score = 0;
          for (const t of tokens) {
            if (full.includes(t)) score += 50;
            if (phase2Normalize(card.character.name).includes(t)) score += 70;
            if (phase2Normalize(card.character.anime).includes(t)) score += 35;
          }
          if (tokens.length && tokens.every(t => full.includes(t))) score += 150;
          return { card, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || Number(b.card.power || 0) - Number(a.card.power || 0))
        .slice(0, 10)
        .map(x => x.card);

      if (!matches.length) return i.reply(`No owned characters found for **${q}**.`);

      const first = matches[0];
      const embed = new EmbedBuilder()
        .setTitle(`Inventory Search: ${q}`)
        .setDescription(
          `**Best Owned Match**\n` +
          `${rarityEmoji(first.character.rarity)} **${first.character.name}** • ${first.character.anime} • PWR **${money(first.power)}**\n` +
          vrFullStatsBlock(first, first.character, true) +
          `\n\n**Owned Results**\n` +
          matches.map((c, idx) =>
            `${idx + 1}. ${rarityEmoji(c.character.rarity)} **${c.character.name}** • ${c.character.anime} • PWR ${money(c.power)} • ${vrCharacterRole(c.character)} • ${vrSafeElement(c.character)}`
          ).join('\n')
        )
        .setColor(embedColor(getAura(first.character).color));

      if (first.character.imageUrl) embed.setThumbnail(first.character.imageUrl);
      return i.reply({ embeds: [embed] });
    }

    if (commandName === 'pvp') {
      const target = i.options.getUser('user', true);
      if (target.bot) return i.reply({ content: 'You cannot PVP bots.', ephemeral: true });
      if (target.id === userId) return i.reply({ content: 'You cannot PVP yourself.', ephemeral: true });

      await ensureUser(target);
      const myPower = await getTeamPower(userId);
      const theirPower = await getTeamPower(target.id);
      if (myPower <= 0) return i.reply('You need cards to PVP.');

      let text = `**PVP BATTLE**\n<@${userId}> vs <@${target.id}>\nYour Power: **${money(myPower)}**\n${target.username} Power: **${money(theirPower)}**\n\n`;
      await i.reply(text + 'Battle starting...');
      const msg = await i.fetchReply();

      let myMana = 0;
      let theirMana = 0;
      for (let r = 1; r <= 5; r++) {
        const myHit = Math.floor(myPower / (8 + r) + Math.random() * 250);
        const theirHit = Math.floor(theirPower / (8 + r) + Math.random() * 250);
        myMana += 25 + Math.floor(Math.random() * 20);
        theirMana += 25 + Math.floor(Math.random() * 20);
        text += `\n__Round ${r}__\n<@${userId}> hits for **${money(myHit)}**. Mana ${Math.min(100, myMana)}/100\n`;
        if (myMana >= 100) { text += `<@${userId}> **ULTIMATE** for **${money(myHit * 2)}**!\n`; myMana = 0; }
        text += `<@${target.id}> hits for **${money(theirHit)}**. Mana ${Math.min(100, theirMana)}/100\n`;
        if (theirMana >= 100) { text += `<@${target.id}> **ULTIMATE** for **${money(theirHit * 2)}**!\n`; theirMana = 0; }
        await new Promise(resolve => setTimeout(resolve, 1000));
        await msg.edit(text.slice(-1900)).catch(() => {});
      }

      const myScore = myPower * (0.85 + Math.random() * 0.35);
      const theirScore = theirPower * (0.85 + Math.random() * 0.35);
      const winnerId = myScore >= theirScore ? userId : target.id;
      const loserId = winnerId === userId ? target.id : userId;

      await prisma.user.update({ where: { id: winnerId }, data: { xp: { increment: 25 }, gold: { increment: 5000 } } }).catch(() => {});
      await prisma.user.update({ where: { id: loserId }, data: { xp: { decrement: 10 } } }).catch(() => {});

      const winner = await prisma.user.findUnique({ where: { id: winnerId } });
      text += `\n**PVP RESULT**\nWinner: <@${winnerId}>\nRank: **${pvpRank(winner?.xp || 0)}**\nRewards: **5,000 Gold + 25 Rank Points**`;
      return msg.edit(text.slice(-1900)).catch(() => {});
    }

    if (commandName === 'trade') {
      const target = i.options.getUser('user', true);
      const offerCardId = i.options.getString('my_card', true);
      const requestCardId = i.options.getString('their_card', true);

      if (target.bot) return i.reply({ content: 'You cannot trade with bots.', ephemeral: true });
      if (target.id === userId) return i.reply({ content: 'You cannot trade with yourself.', ephemeral: true });

      const offerCard = await prisma.userCard.findFirst({
        where: { id: offerCardId, userId },
        include: { character: true }
      });

      if (!offerCard) return i.reply({ content: 'Your offered card was not found in your inventory.', ephemeral: true });

      const requestCard = await prisma.userCard.findFirst({
        where: { id: requestCardId, userId: target.id },
        include: { character: true }
      });

      if (!requestCard) return i.reply({ content: 'The requested card was not found in that player inventory.', ephemeral: true });

      const tradeId = nanoid(10);

      pendingTrades.set(tradeId, {
        id: tradeId,
        offerUserId: userId,
        targetId: target.id,
        offerCardId,
        requestCardId,
        createdAt: Date.now()
      });

      setTimeout(() => pendingTrades.delete(tradeId), 5 * 60 * 1000);

      const embed = new EmbedBuilder()
        .setTitle('Trade Offer')
        .setDescription(
          `<@${userId}> wants to trade with <@${target.id}>.\n\n` +
          `**${i.user.username} gives:**\n` +
          `${rarityEmoji(offerCard.character.rarity)} **${offerCard.character.name}** • ${offerCard.character.rarity} • PWR ${offerCard.power}\n\n` +
          `**${target.username} gives:**\n` +
          `${rarityEmoji(requestCard.character.rarity)} **${requestCard.character.name}** • ${requestCard.character.rarity} • PWR ${requestCard.power}\n\n` +
          `Only <@${target.id}> can accept or decline.\n` +
          `Expires in 5 minutes.`
        )
        .setColor(0x22c55e);

      if (offerCard.character.imageUrl) embed.setThumbnail(offerCard.character.imageUrl);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade_accept_${tradeId}`)
          .setLabel('Accept Trade')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade_decline_${tradeId}`)
          .setLabel('Decline')
          .setStyle(ButtonStyle.Danger)
      );

      return i.reply({
        content: `<@${target.id}> عندك عرض مقايضة.`,
        embeds: [embed],
        components: [row]
      });
    }

    if (commandName === 'transfer' || commandName === 'market') {
      const items = await market.latest(10);
      if (!items.length) return i.reply('The Transfer Market is currently empty.');
      return i.reply(('**TRANSFER MARKET**\n\n' + items.map(x => `${x.id} • ${x.card.character.name} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n')).slice(0, 1900));
    }

    if (commandName === 'sell' || commandName === 'list') {
      const cardId = i.options.getString('card_id', true);
      const price = i.options.getInteger('price', true);

      const card = await prisma.userCard.findFirst({
        where: { id: cardId, userId },
        include: { character: true }
      });

      if (!card) return i.reply({ content: 'Card not found in your inventory.', ephemeral: true });

      const [min, max] = priceRange(card.character.rarity);

      if (price < min || price > max) {
        return i.reply({ content: `Price range for ${card.character.rarity}: ${money(min)} - ${money(max)} gold.`, ephemeral: true });
      }

      const l = await market.sell(userId, cardId, price);
      return i.reply(`Listed on Transfer Market.\nListing ID: ${l.id}\nPrice: ${money(price)} gold`);
    }

    if (commandName === 'buy') {
      const listingId = i.options.getString('listing_id', true);
      const r = await market.buy(userId, listingId);
      return i.reply(`Purchase complete.\nMarket tax: ${money(r.tax)} gold.`);
    }

    if (commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);

      return i.reply(
        r.success
          ? `Upgrade successful. Equipment is now +${r.nextLevel}.`
          : `Upgrade failed. You lost ${money(r.cost)} gold.`
      );
    }

    if (commandName === 'admin-spawn-boss') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const channel = i.options.getChannel('channel', true);

      if (!channel || !channel.isTextBased()) {
        return i.reply({ content: 'Choose a text channel.', ephemeral: true });
      }

      const boss = await sendBossAnnouncement(channel);
      return i.reply({ content: `Boss spawned in ${channel}: **${boss.bossName}**`, ephemeral: true });
    }


    if (commandName === 'admin-repair-rewards') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const users = await prisma.user.findMany({ select: { id: true } });
      const gold = i.options.getInteger('gold') || 500000;
      const tokens = i.options.getInteger('tokens') || 50;
      const rolls = i.options.getInteger('rolls') || 50;

      for (const u of users) {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            gold: { increment: gold },
            tokens: { increment: tokens },
            rolls: { increment: rolls }
          }
        }).catch(() => {});
      }

      return i.reply(`Repair rewards sent to **${users.length}** users: ${money(gold)} gold, ${tokens} tokens, ${rolls} rolls.`);
    }



    if (commandName === 'lvl') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const card = await phase2FindUserCardByName(userId, name);
      const cost = Math.max(1, amount) * 2500;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost) {
        return i.reply(`You need **${money(cost)} Gold** to level up **${card.character.name}**.`);
      }

      await prisma.user.update({ where: { id: userId }, data: { gold: { decrement: cost } } });
      const updated = await addCardLevel(card.id, amount);

      return i.reply(
        `📈 **LEVEL UP**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** is now Level **${updated.level}/99**.\n` +
        `Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 't') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const cost = trainingCost(amount);

      const card = await findUserCardByName(userId, name);
      const cap = typeof TRAIN_POWER_CAPS !== 'undefined'
        ? (TRAIN_POWER_CAPS[card.character.rarity] || 1500)
        : 999999999;

      if (card.power >= cap) {
        return i.reply(
          `**${card.character.name}** reached the power cap for **${card.character.rarity}**.\n` +
          `Cap: **${cap} Power**\n` +
          `Use **/a name:${card.character.name} rarity:<next rarity>** to continue.`
        );
      }

      const allowedGain = Math.max(0, cap - card.power);
      const finalGain = Math.min(cost.powerGain, allowedGain);
      const finalGold = Math.ceil(cost.gold * (finalGain / Math.max(1, cost.powerGain)));

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < finalGold) {
        return i.reply(`You need **${money(finalGold)} Gold** for this training.\nPower Gain: **+${finalGain}**`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { decrement: finalGold } }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: { increment: finalGain } },
        include: { character: true }
      });

      return i.reply(
        `🏋️ **TRAINING COMPLETE**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** gained **+${finalGain} Power**.\n` +
        `Cost: **${money(finalGold)} Gold**\n` +
        `New Power: **${updated.power}/${cap}**`
      );
    }

    if (commandName === 'a') {
      const name = i.options.getString('name', true);
      const target = i.options.getString('rarity', true);
      const cfg = RARITY_UPGRADE_COSTS[target];

      if (!cfg) return i.reply({ content: 'Invalid rarity.', ephemeral: true });

      const card = await findUserCardByName(userId, name);
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cfg.gold || (user.tokens || 0) < cfg.tokens) {
        return i.reply(`You need **${money(cfg.gold)} gold** and **${cfg.tokens} tokens** to ascend **${card.character.name}** to **${target}**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { decrement: cfg.gold },
          tokens: { decrement: cfg.tokens }
        }
      });

      await prisma.character.update({
        where: { id: card.characterId },
        data: {
          rarity: target,
          basePower: Math.max(card.character.basePower || 0, cfg.power)
        }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: {
          power: Math.max(card.power || 0, cfg.power + Math.floor(Math.random() * 500))
        },
        include: { character: true }
      });

      return i.reply(
        `✨ **ASCENSION COMPLETE**\n` +
        `**${updated.character.name}** is now **${target}**.\n` +
        `New Power: **${updated.power}**`
      );
    }

    if (commandName === 'sell-rarity') {
      const rarity = i.options.getString('rarity', true);
      const result = await sellAllByRarity(userId, rarity);

      if (!result.sold) {
        return i.reply(`You do not have any **${result.rarity}** cards to sell.`);
      }

      return i.reply(
        `💰 **SOLD ${result.rarity} CARDS**\n` +
        `Sold: **${result.sold}** cards\n` +
        `Gold earned: **${money(result.gold)}**`
      );
    }

    if (commandName === 'admin-give-gold') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { gold: { increment: amount } }
      });

      return i.reply(`Added **${money(amount)} gold** to **${target.username}**.\nNew gold: **${money(updated.gold)}**`);
    }

    if (commandName === 'admin-give-tokens') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { tokens: { increment: amount } }
      });

      return i.reply(`Added **${amount} tokens** to **${target.username}**.\nNew tokens: **${updated.tokens}**`);
    }


    if (commandName === 'fuse-list') {
      const list = await phase2FuseList(userId);

      if (!list.length) {
        return i.reply('You do not have duplicate characters ready to fuse.');
      }

      return i.reply(
        (`**FUSION READY**\n\n` +
        list.slice(0, 30).map(x =>
          `${rarityEmoji(x.rarity)} **${x.name}** x${x.count} • Max PWR ${money(x.maxPower)}`
        ).join('\n')).slice(0, 1900)
      );
    }

    if (commandName === 'fuse') {
      const name = i.options.getString('name', true);
      const result = await phase2FuseByName(userId, name);

      if (!result.fused) return i.reply(result.message);

      return i.reply(
        `⭐ **FUSION COMPLETE**\n` +
        `**${result.name}**: ⭐${result.oldStars} → ⭐${result.newStars}\n` +
        `Power gained: **+${money(result.powerGain)}**`
      );
    }


    if (commandName === 'lvl') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const card = await phase2FindUserCardByName(userId, name);
      const cost = Math.max(1, amount) * 2500;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost) {
        return i.reply(`You need **${money(cost)} Gold** to level up **${card.character.name}**.`);
      }

      await prisma.user.update({ where: { id: userId }, data: { gold: { decrement: cost } } });
      const updated = await addCardLevel(card.id, amount);

      return i.reply(
        `📈 **LEVEL UP**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}** is now Level **${updated.level}/99**.\n` +
        `Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 't') {
      const name = i.options.getString('name', true);
      const amount = i.options.getInteger('amount') || 1;
      const cost = trainingCost(amount);
      const card = await phase2FindUserCardByName(userId, name);

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cost.gold) {
        return i.reply(`You need **${money(cost.gold)} Gold** for this training.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { decrement: cost.gold } }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: { power: { increment: cost.powerGain } },
        include: { character: true }
      });

      return i.reply(
        `🏋️ **TRAINING COMPLETE**\n` +
        `${rarityEmoji(updated.character.rarity)} **${updated.character.name}${phase2StarLabel(updated)}** gained **+${money(cost.powerGain)} Power**.\n` +
        `New Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 'a') {
      const name = i.options.getString('name', true);
      const target = i.options.getString('rarity', true);
      const cfg = RARITY_UPGRADE_COSTS[target];

      if (!cfg) return i.reply({ content: 'Invalid rarity.', ephemeral: true });

      const card = await phase2FindUserCardByName(userId, name);
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.gold || 0) < cfg.gold || (user.tokens || 0) < cfg.tokens) {
        return i.reply(`You need **${money(cfg.gold)} gold** and **${cfg.tokens} tokens**.`);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { decrement: cfg.gold },
          tokens: { decrement: cfg.tokens }
        }
      });

      await prisma.character.update({
        where: { id: card.characterId },
        data: {
          rarity: target,
          basePower: Math.max(card.character.basePower || 0, cfg.power)
        }
      });

      const updated = await prisma.userCard.update({
        where: { id: card.id },
        data: {
          power: Math.max(card.power || 0, cfg.power + Math.floor(Math.random() * 500))
        },
        include: { character: true }
      });

      return i.reply(
        `✨ **ASCENSION COMPLETE**\n` +
        `**${updated.character.name}** is now **${target}**.\n` +
        `New Power: **${money(updated.power)}**`
      );
    }

    if (commandName === 'sell-rarity') {
      const rarity = i.options.getString('rarity', true);
      const result = await phase2SellAllByRarity(userId, rarity);

      if (!result.sold) return i.reply(`You do not have any **${result.rarity}** cards.`);

      return i.reply(
        `💰 **SOLD ${result.rarity} CARDS**\n` +
        `Sold: **${result.sold}**\n` +
        `Gold earned: **${money(result.gold)}**`
      );
    }

    if (commandName === 'admin-give-gold') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);
      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { gold: { increment: amount } }
      });

      return i.reply(`Added **${money(amount)} gold** to **${target.username}**. New gold: **${money(updated.gold)}**`);
    }

    if (commandName === 'admin-give-tokens') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);
      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { tokens: { increment: amount } }
      });

      return i.reply(`Added **${amount} tokens** to **${target.username}**. New tokens: **${updated.tokens}**`);
    }





    if (commandName === 'admin-fix-elements') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const chars = await prisma.character.findMany({
        where: { active: true },
        select: { id: true, element: true, name: true }
      });

      let fixed = 0;

      for (const c of chars) {
        const clean = cleanElement(c.element);
        if (clean !== c.element) {
          await prisma.character.update({
            where: { id: c.id },
            data: { element: clean }
          }).catch(() => {});
          fixed++;
        }
      }

      return i.reply({ content: `✅ Elements cleaned: ${fixed}`, ephemeral: true });
    }

    if (commandName === 'admin-fix-saber-image') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      await i.deferReply({ ephemeral: true });
      const result = await hardFixSaberOneCopy();

      return i.editReply(
        `✅ Saber fixed to ONE copy.\n` +
        `Kept: **${result.canonical.name}** • ${result.canonical.rarity} • PWR ${result.canonical.basePower}\n` +
        `Moved player cards: **${result.moved}**\n` +
        `Hidden duplicate Saber rows: **${result.hidden}**`
      );
    }

    if (commandName === 'admin-collapse-variants') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      await i.deferReply({ ephemeral: true });
      const result = await collapseRosterVariants();

      return i.editReply(
        `✅ Roster cleaned.\n` +
        `Canonical fixed: **${result.fixedCanon}**\n` +
        `Cards moved: **${result.movedCards}**\n` +
        `Duplicate/ugly characters hidden: **${result.inactiveCharacters}**`
      );
    }

    if (commandName === 'admin-fix-variants') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      await fixImportantVariants();
      return i.reply({ content: '✅ Important duplicate variants fixed.', ephemeral: true });
    }

    if (commandName === 'admin-reset-all') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const confirm = i.options.getString('confirm', true);

      if (confirm !== 'YES') {
        return i.reply({ content: 'Type confirm:YES to reset all players.', ephemeral: true });
      }

      await prisma.$transaction([
        prisma.teamSlot.deleteMany({}),
        prisma.marketListing.deleteMany({}),
        prisma.userEquipment.deleteMany({}),
        prisma.userCard.deleteMany({}),
        prisma.storyProgress.deleteMany({}),
        prisma.user.updateMany({
          data: {
            gold: 0,
            tokens: 0,
            rolls: 10,
            xp: 0,
            level: 1
          }
        })
      ]);

      return i.reply('⚠️ **RESET ALL COMPLETE**');
    }

    if (commandName === 'admin-give-rolls') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      if (amount <= 0) return i.reply({ content: 'Amount must be greater than 0.', ephemeral: true });

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: { rolls: { increment: amount } }
      });

      return i.reply(`Added **${amount} rolls** to **${target.username}**.\nNew rolls balance: **${updated.rolls}**`);
    }

    if (commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
      }

      const eq = await equipment.dropEquipment(userId, i.options.getString('rarity') || 'COMMON');
      return i.reply(eq ? `Equipment granted: ${eq.id}` : 'No equipment template exists for this rarity.');
    }

    if (commandName === 'events') {
      return i.reply(
        `**ACTIVE EVENTS**\n` +
        `Boss events can spawn automatically in the configured channel.\n` +
        `Use /admin-spawn-boss to force spawn one.`
      );
    }

    if (commandName === 'quests') {
      return i.reply(
        `**QUESTS**\n` +
        `Roll 10 cards → 5 Tokens\n` +
        `Clear dungeon → 10 Tokens\n` +
        `Defeat boss → 25 Tokens\n` +
        `Train characters with gold to grow stronger.`
      );
    }
  } catch (err) {
    console.error(err);

    if (i.deferred || i.replied) {
      return i.editReply({ content: `Error: ${err.message}` }).catch(() => {});
    }

    return i.reply({ content: `Error: ${err.message}`, ephemeral: true }).catch(() => {});
  }
});

const app = express();

app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));

app.listen(config.port, () => console.log(`Health server on ${config.port}`));

if (!config.token) throw new Error('DISCORD_TOKEN missing');

client.login(config.token);
