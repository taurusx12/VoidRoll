// VoidRoll Reborn - Phase 35 Search Test
// Run:
//   node scripts/phase35-test-character-search.js "Inosuke"

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function norm(v='') { return String(v || '').toLowerCase().replace(/[().\-_:/'’]/g,' ').replace(/\s+/g,' ').trim(); }
function clean(name='') { return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\b(true power|base|elite|prime|final arc|mythic form|awakened|battle ready|divine form|support|training|limit break|domain form|early arc|transcendent|ultimate|form|mode|arc|version)\b/ig,' ').replace(/\s+/g,' ').trim(); }
function searchTokens(v='') { return norm(v).split(' ').filter(Boolean); }

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
  if (rawName === q) score += 2000000;
  if (cleanName === q) score += 1900000;
  if (rawTokens[0] === q) score += 1500000;
  if (cleanTokens[0] === q) score += 1450000;
  if (rawName.startsWith(q + ' ')) score += 1200000;
  if (cleanName.startsWith(q + ' ')) score += 1150000;

  const allTokensInName = qTokens.length && qTokens.every(t => rawTokens.includes(t) || cleanTokens.includes(t));
  if (allTokensInName) score += 900000 + qTokens.length * 30000;

  let matchedNameTokens = 0;
  for (const t of qTokens) {
    if (rawTokens.includes(t)) { score += 70000; matchedNameTokens++; }
    else if (cleanTokens.includes(t)) { score += 65000; matchedNameTokens++; }
    else if (rawName.includes(t)) { score += 10000; matchedNameTokens++; }
    else if (cleanName.includes(t)) { score += 9000; matchedNameTokens++; }
    else if (anime.includes(t)) score += 500;
  }

  if (matchedNameTokens === 0 && !rawName.includes(q) && !cleanName.includes(q)) return 0;
  if (qTokens.length === 1 && !rawTokens.includes(q) && !cleanTokens.includes(q) && !rawName.startsWith(q)) score -= 400000;

  if (String(c.imageUrl || '').includes('cdn.myanimelist')) score += 300;
  score += Math.min(999, Number(c.basePower || 0) / 10000);

  return score;
}

async function main() {
  const q = process.argv.slice(2).join(' ') || 'Inosuke';
  const chars = await prisma.character.findMany({ where:{ active:true }, take:50000, orderBy:{ basePower:'desc' } });

  const scored = chars
    .map(c => ({ c, score: characterSearchScoreStrict(c, q) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score || Number(b.c.basePower || 0) - Number(a.c.basePower || 0))
    .slice(0,15);

  console.log(`Top results for: ${q}`);
  for (const x of scored) {
    console.log(`${Math.floor(x.score)} | ${x.c.id} | ${x.c.name} | ${x.c.anime} | ${x.c.rarity} | PWR ${x.c.basePower}`);
  }
}

main().finally(()=>prisma.$disconnect());
