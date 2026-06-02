// VoidRoll Reborn - Phase 35 Character ID Search / Autocomplete Fix
// Global fix for wrong character results across most searches.
// Key idea:
// - Autocomplete returns Character ID, not character name.
// - /character first checks ID, then exact name, then strict search.
// - This prevents "Inosuke" returning "Eren" and similar wrong matches.
//
// Run:
//   node scripts/phase35-character-id-search.js
//   node --check src/index.js

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function findFunctionRange(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) return null;

  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return { start, end: i + 1 };
  }
  return null;
}

const backup = path.join(process.cwd(), 'src', `index.backup-phase35-character-id-search-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

// Ensure combatProfiles import exists, used for scoring tie-breaks if available.
if (!s.includes("require('./systems/characterCombatProfileSystem')")) {
  const anchor = "const { prisma } = require('./lib/db');";
  if (s.includes(anchor)) {
    s = s.replace(anchor, `${anchor}
const combatProfiles = require('./systems/characterCombatProfileSystem');`);
    console.log('✅ added combat profile import');
  }
}

// Add robust helpers.
const helpers = `
// PHASE35_CHARACTER_ID_SEARCH
function isCharacterId(value='') {
  const v = String(value || '');
  return v.startsWith('char_') || /^[a-zA-Z0-9_-]{16,}$/.test(v);
}

function searchTokens(v='') {
  return norm(v).split(' ').filter(Boolean);
}

function characterSearchScoreStrict(c, query) {
  const q = norm(query);
  if (!q) return 0;

  const qTokens = searchTokens(q);
  const rawName = norm(c.name);
  const cleanName = norm(clean(c.name));
  const anime = norm(c.anime);
  const rawTokens = searchTokens(rawName);
  const cleanTokens = searchTokens(cleanName);

  let score = 0;

  // Exact match always wins.
  if (rawName === q) score += 2000000;
  if (cleanName === q) score += 1900000;

  // First token exact. This fixes short names like Inosuke, Gojo, Aizen.
  if (rawTokens[0] === q) score += 1500000;
  if (cleanTokens[0] === q) score += 1450000;

  // Starts with query.
  if (rawName.startsWith(q + ' ')) score += 1200000;
  if (cleanName.startsWith(q + ' ')) score += 1150000;

  // Every query token must be present in name for a strong match.
  const allTokensInName = qTokens.length && qTokens.every(t => rawTokens.includes(t) || cleanTokens.includes(t));
  if (allTokensInName) score += 900000 + qTokens.length * 30000;

  // Weak partial match only after exact rules.
  let matchedNameTokens = 0;
  for (const t of qTokens) {
    if (rawTokens.includes(t)) { score += 70000; matchedNameTokens++; }
    else if (cleanTokens.includes(t)) { score += 65000; matchedNameTokens++; }
    else if (rawName.includes(t)) { score += 10000; matchedNameTokens++; }
    else if (cleanName.includes(t)) { score += 9000; matchedNameTokens++; }
    else if (anime.includes(t)) score += 500;
  }

  // If not a single name token matched, reject. Anime-only match should not return random characters.
  if (matchedNameTokens === 0 && !rawName.includes(q) && !cleanName.includes(q)) return 0;

  // Penalize weird records whose clean name is very far from query.
  if (qTokens.length === 1 && !rawTokens.includes(q) && !cleanTokens.includes(q) && !rawName.startsWith(q)) {
    score -= 400000;
  }

  // Profile source is only a tie-breaker.
  try {
    if (typeof combatProfiles !== 'undefined') {
      const profile = combatProfiles.getCombatProfile(c);
      if (profile.source === 'exact') score += 3000;
      if (profile.source === 'anime') score += 1000;
    }
  } catch {}

  if (String(c.imageUrl || '').includes('cdn.myanimelist')) score += 300;
  score += Math.min(999, Number(c.basePower || 0) / 10000);

  return score;
}
`;

if (!s.includes('PHASE35_CHARACTER_ID_SEARCH')) {
  const pos = s.indexOf("async function findCharacter(query)");
  if (pos === -1) {
    console.error('❌ Could not find findCharacter.');
    process.exit(1);
  }
  s = s.slice(0, pos) + helpers + "\n" + s.slice(pos);
  console.log('✅ added Phase 35 search helpers');
} else {
  console.log('✅ Phase 35 search helpers already exist');
}

// Replace findCharacter.
const findRange = findFunctionRange(s, "async function findCharacter(query)");
if (!findRange) {
  console.error('❌ findCharacter function not found.');
  process.exit(1);
}

const newFind = `async function findCharacter(query) {
  const raw = String(query || '').trim();
  const q = norm(raw);
  if (!q) return null;

  // If autocomplete selected a character ID, use it directly.
  if (isCharacterId(raw)) {
    const byId = await prisma.character.findFirst({ where:{ id:raw, active:true } }).catch(()=>null);
    if (byId) return byId;
  }

  const chars = await prisma.character.findMany({
    where:{ active:true },
    take:50000,
    orderBy:{ basePower:'desc' }
  }).catch(()=>[]);

  const scored = chars
    .map(c => ({ c, score: characterSearchScoreStrict(c, raw) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || Number(b.c.basePower || 0) - Number(a.c.basePower || 0));

  return scored[0]?.c || null;
}`;
s = s.slice(0, findRange.start) + newFind + s.slice(findRange.end);
console.log('✅ replaced findCharacter with ID-first strict search');

// Replace owned card search.
const ownedRange = findFunctionRange(s, "async function ownedCardByIdOrBest(userId, value)");
if (ownedRange) {
  const newOwned = `async function ownedCardByIdOrBest(userId, value) {
  if (!value) return null;

  const raw = String(value || '').trim();
  const q = norm(raw);

  // Exact owned card ID first.
  let card = await prisma.userCard.findFirst({
    where:{ id:raw, userId:String(userId) },
    include:{ character:true }
  }).catch(()=>null);
  if (card) return card;

  // If /character autocomplete passed a character ID, get user's strongest owned card for that character.
  if (isCharacterId(raw)) {
    card = await prisma.userCard.findFirst({
      where:{ userId:String(userId), characterId:raw },
      include:{ character:true },
      orderBy:{ power:'desc' }
    }).catch(()=>null);
    if (card) return card;
  }

  const cards = await prisma.userCard.findMany({
    where:{ userId:String(userId) },
    include:{ character:true },
    orderBy:{ power:'desc' },
    take:10000
  }).catch(()=>[]);

  const scored = cards
    .map(card => {
      const sid = shortId(card.id).toLowerCase();
      let score = characterSearchScoreStrict(card.character || {}, raw);
      if (sid === q) score += 3000000;
      if (q && sid.includes(q)) score += 100000;
      score += Math.min(999, Number(card.power || 0) / 10000);
      return { card, score };
    })
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || Number(b.card.power || 0) - Number(a.card.power || 0));

  return scored[0]?.card || null;
}`;
  s = s.slice(0, ownedRange.start) + newOwned + s.slice(ownedRange.end);
  console.log('✅ replaced ownedCardByIdOrBest with ID-first strict search');
} else {
  console.log('⚠️ ownedCardByIdOrBest not found');
}

// Patch autocomplete for global character search so value is c.id, not name.
// Handles common original code shape and already phase34 patched shape.
const oldAutocomplete1 = `.map(c=>choice(\`\${clean(c.name)} • \${c.anime} • \${c.rarity}\`, clean(c.name)));`;
if (s.includes(oldAutocomplete1)) {
  s = s.replace(oldAutocomplete1, `.map(c=>choice(\`\${clean(c.name)} • \${c.anime} • \${c.rarity}\`, c.id));`);
  console.log('✅ patched simple global character autocomplete value to character id');
}

const oldAutocomplete2 = `.map(x=>choice(\`\${clean(x.c.name)} • \${x.c.anime} • \${x.c.rarity}\`, clean(x.c.name)));`;
if (s.includes(oldAutocomplete2)) {
  s = s.replace(oldAutocomplete2, `.map(x=>choice(\`\${clean(x.c.name)} • \${x.c.anime} • \${x.c.rarity}\`, x.c.id));`);
  console.log('✅ patched scored global character autocomplete value to character id');
}

// Patch wishlist/autocomplete phrase if present.
s = s.replace(
  `.map(c=>choice(\`\${clean(c.name)} • \${c.anime} • \${c.rarity}\`, clean(c.name)))`,
  `.map(c=>choice(\`\${clean(c.name)} • \${c.anime} • \${c.rarity}\`, c.id))`
);

// Inventory filter should remain name text; owned card autocomplete should remain card.id.
// No change there.

if (!s.includes('PHASE35_CHARACTER_ID_SEARCH_APPLIED')) {
  s = '// PHASE35_CHARACTER_ID_SEARCH_APPLIED\n' + s;
}

fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 35 character ID search applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Verify:');
console.log('node --check src/index.js');
console.log('node scripts/phase35-test-character-search.js "Inosuke"');
console.log('node scripts/phase35-test-character-search.js "Eren"');
console.log('');
console.log('Important: re-deploy Guild commands if autocomplete behavior is stale in Discord UI.');
