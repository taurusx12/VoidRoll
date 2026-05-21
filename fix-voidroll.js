const fs = require('fs');
const path = require('path');

const root = process.cwd();
function read(p){ return fs.readFileSync(path.join(root,p),'utf8'); }
function write(p,s){ fs.writeFileSync(path.join(root,p),s); console.log('patched',p); }
function esc(s){ return s.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&'); }

// 1) Prisma compatibility: supports older seed/itemSystem fields and keeps existing data safe.
{
  const p = 'prisma/schema.prisma';
  let s = read(p);
  if (!/model EquipmentTemplate[\s\S]*bonusType/.test(s)) {
    s = s.replace(/model EquipmentTemplate \{([^}]*)\}/, (m, body) => {
      return `model EquipmentTemplate {${body}  bonusType String?\n  bonusValue Int?\n  characterHint String?\n}`;
    });
  }
  // UserCard does NOT have equipment relation; broken include:{ equipment } must not be used in code.
  write(p,s);
}

// 2) Strict rarity logic: Secret stays highest, Divine below Secret. No random auto-secret from anime name/power.
{
  const p = 'src/lib/secretCharacters.js';
  const strict = `const SECRET_CHARACTER_KEYWORDS = [
  // SECRET = highest rarity. Keep this list short and intentional.
  'goku', 'satoru gojo', 'gojo', 'sukuna', 'ryomen sukuna',
  'eren yeager', 'eren jaeger', 'levi ackerman', 'levi',
  'all might', 'madara uchiha', 'madara', 'aizen', 'sosuke aizen',
  'ichigo kurosaki', 'ichigo', 'luffy', 'monkey d. luffy', 'shanks',
  'roger', 'gol d. roger', 'whitebeard', 'saitama'
];

const DIVINE_CHARACTER_KEYWORDS = [
  // Divine = very high, but below Secret.
  'vegeta', 'naruto uzumaki', 'naruto', 'sasuke uchiha', 'sasuke',
  'itachi uchiha', 'itachi', 'mikasa ackerman', 'mikasa',
  'izuku midoriya', 'deku', 'katsuki bakugo', 'bakugo',
  'tomura shigaraki', 'shigaraki', 'all for one',
  'yuta okkotsu', 'yuta', 'toji fushiguro', 'toji',
  'yhwach', 'kenpachi', 'meruem', 'netero', 'muzan', 'yoriichi',
  'kaido', 'mihawk', 'escanor', 'meliodas', 'gilgamesh', 'alucard', 'dio'
];

const SECRET_ANIME_KEYWORDS = [];

function normalize(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function hasAny(text, words) {
  const clean = normalize(text);
  return words.some(word => clean.includes(normalize(word)));
}
function isSecretCandidate(character) {
  if (!character) return false;
  if (character.rarity === 'SECRET') return true;
  const combined = \`${'${character.name || ""} ${character.anime || ""}'}\`;
  return hasAny(combined, SECRET_CHARACTER_KEYWORDS);
}
function divineCandidate(character) {
  if (!character) return false;
  if (character.rarity === 'DIVINE') return true;
  const combined = \`${'${character.name || ""} ${character.anime || ""}'}\`;
  return hasAny(combined, DIVINE_CHARACTER_KEYWORDS);
}
module.exports = { SECRET_CHARACTER_KEYWORDS, DIVINE_CHARACTER_KEYWORDS, SECRET_ANIME_KEYWORDS, isSecretCandidate, divineCandidate };
`;
  write(p, strict);
}

// 3) Fix main runtime crashes in src/index.js.
{
  const p = 'src/index.js';
  let s = read(p);

  s = s.replace(/function rarityEmoji\(r\) \{[\s\S]*?\}\s*async function createCardForUser/, `function rarityEmoji(r) { return ({ COMMON:'⚪', RARE:'🔵', EPIC:'🟣', LEGENDARY:'🟠', MYTHIC:'🔴', DIVINE:'✨', SECRET:'🕳️' })[r] || ''; }
function safeText(text, max = 1900) { const value = String(text || ''); return value.length > max ? value.slice(0, max - 20) + '\\n...and more' : value; }
async function safeReply(i, payload) {
  if (typeof payload === 'string') payload = { content: payload };
  if (payload && payload.content) payload.content = safeText(payload.content, 1900);
  return (i.deferred || i.replied) ? i.editReply(payload) : i.reply(payload);
}
async function createCardForUser`);

  // Remove the bad UserCard include if it exists in any previous broken version.
  s = s.replace(/include:\s*\{\s*character:\s*true,\s*equipment:\s*\{\s*include:\s*\{\s*template:\s*true\s*\}\s*\}\s*\}/g, 'include: { character: true }');
  s = s.replace(/take:\s*50/g, 'take: 200');

  // Replace broken rollRandomItem block. It was using pack/cost inside item roll.
  s = s.replace(/async function rollRandomItem\(userId, slotFilter = null\) \{[\s\S]*?\}\s*async function inventoryEmbed/, `async function rollRandomItem(userId, slotFilter = null) {
  await ensureItemTemplates(prisma);
  const where = { active: true };
  if (slotFilter) where.slot = slotFilter;
  const templates = await prisma.equipmentTemplate.findMany({ where, take: 1000 });
  if (!templates.length) throw new Error('No item templates are available. Run npm run db:push then restart.');
  const template = weightedPick(templates, t => ITEM_ROLL_WEIGHTS[t.rarity] || 1000);
  const item = await prisma.userEquipment.create({
    data: {
      id: nanoid(),
      userId,
      templateId: template.id,
      power: template.basePower + Math.floor(Math.random() * 120)
    }
  });
  return { item, template };
}

async function openPack(userId, pack) {
  const PACK_COSTS = {
    jjk: 10, demon: 10, naruto: 10, onepiece: 10, bleach: 10, mha: 10,
    hxh: 10, dbz: 10, aot: 10, villains: 18, secret: 50, event: 25,
    weapon: 15, armor: 15, ring: 12
  };
  const cost = { tokens: PACK_COSTS[pack] || 10 };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.tokens < cost.tokens) throw new Error(`Not enough tokens. Need ${cost.tokens}.`);

  if (['weapon','armor','ring'].includes(pack)) {
    const slot = pack === 'weapon' ? 'WEAPON' : pack === 'armor' ? 'ARMOR' : 'RING';
    await prisma.user.update({ where: { id: userId }, data: { tokens: { decrement: cost.tokens } } });
    return { ...(await rollRandomItem(userId, slot)), cost, item: true };
  }

  const allChars = await prisma.character.findMany({ where: { active: true }, take: 2000 });
  const containsAny = (value, words) => {
    const text = String(value || '').toLowerCase();
    return words.some(w => text.includes(w));
  };
  let chars = allChars;
  if (pack === 'jjk') chars = allChars.filter(c => containsAny(c.anime, ['jujutsu', 'kaisen']));
  if (pack === 'demon') chars = allChars.filter(c => containsAny(c.anime, ['demon slayer', 'kimetsu']));
  if (pack === 'naruto') chars = allChars.filter(c => containsAny(c.anime, ['naruto']));
  if (pack === 'onepiece') chars = allChars.filter(c => containsAny(c.anime, ['one piece']));
  if (pack === 'bleach') chars = allChars.filter(c => containsAny(c.anime, ['bleach']));
  if (pack === 'mha') chars = allChars.filter(c => containsAny(c.anime, ['my hero', 'boku no hero']));
  if (pack === 'hxh') chars = allChars.filter(c => containsAny(c.anime, ['hunter x hunter', 'hunter×hunter']));
  if (pack === 'dbz') chars = allChars.filter(c => containsAny(c.anime, ['dragon ball']));
  if (pack === 'aot') chars = allChars.filter(c => containsAny(c.anime, ['attack on titan', 'shingeki']));
  if (pack === 'villains') chars = allChars.filter(c => {
    const text = `${'${c.name} ${c.anime}'}`.toLowerCase();
    return ['sukuna','muzan','madara','aizen','yhwach','kaido','doflamingo','shigaraki','all for one','meruem','chrollo','hisoka','frieza','zeref','acnologia'].some(k => text.includes(k));
  });
  if (pack === 'secret') chars = allChars.filter(c => c.rarity === 'SECRET' || isSecretCandidate(c));
  if (pack === 'event') chars = allChars.filter(c => ['EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'].includes(c.rarity));
  if (!chars.length) chars = allChars;
  const character = weightedPick(chars, c => {
    if (pack === 'event') return ({ EPIC: 850000, LEGENDARY: 95000, MYTHIC: 22000, DIVINE: 7000, SECRET: 1200 })[c.rarity] || 100;
    if (pack === 'secret') return ({ SECRET: 700000, DIVINE: 200000, MYTHIC: 85000, LEGENDARY: 15000 })[c.rarity] || 100;
    return CHARACTER_ROLL_WEIGHTS[c.rarity] || 1000;
  });
  await prisma.user.update({ where: { id: userId }, data: { tokens: { decrement: cost.tokens } } });
  const card = await createCardForUser(userId, character);
  return { card, character, cost };
}

async function inventoryEmbed`);

  // Do not auto-promote dozens of characters to SECRET. Only strict list gets upgraded.
  s = s.replace(/async function applySecretCharacterBoosts\(\) \{[\s\S]*?\}\s*client\.once\('ready'/, `async function applySecretCharacterBoosts() {
  const chars = await prisma.character.findMany({ where: { active: true }, select: { id: true, name: true, anime: true, rarity: true, basePower: true, baseFarm: true, baseLuck: true } });
  let updated = 0;
  for (const c of chars) {
    if (!isSecretCandidate(c)) continue;
    const newPower = Math.max(c.basePower || 0, 10000);
    await prisma.character.update({ where: { id: c.id }, data: { rarity: 'SECRET', basePower: newPower, baseFarm: Math.max(c.baseFarm || 0, Math.floor(newPower / 8)), baseLuck: Math.max(c.baseLuck || 0, Math.floor(newPower / 20)) } });
    updated++;
  }
  console.log(`Secret characters updated: ${'${updated}'}`);
}
client.once('ready'`);

  // Make search case-insensitive and useful even for one letter.
  s = s.replace(/where:\s*\{\s*OR:\s*\[\s*\{ name:\s*\{ contains:\s*name \}\s*\},\s*\{ anime:\s*\{ contains:\s*name \}\s*\}\s*\],\s*active:\s*true\s*\}/, `where: { OR: [ { name: { contains: name, mode: 'insensitive' } }, { anime: { contains: name, mode: 'insensitive' } } ], active: true }`);

  // Keep /secrets under Discord 2000-character limit.
  s = s.replace(/if \(commandName === 'secrets'\) \{[\s\S]*?\}\s*if \(commandName === 'rarity'\)/, `if (commandName === 'secrets') {
      const page = Math.max(1, i.options.getInteger('page') || 1);
      const pageSize = 15;
      const total = await prisma.character.count({ where: { rarity: 'SECRET', active: true } });
      const chars = await prisma.character.findMany({ where: { rarity: 'SECRET', active: true }, orderBy: { basePower: 'desc' }, skip: (page - 1) * pageSize, take: pageSize });
      if (!chars.length) return i.reply('No SECRET characters found yet. Restart once after db:push.');
      const lines = chars.map(c => `${'${rarityEmoji(c.rarity)}'} ${'${c.name}'} • ${'${c.anime}'} • PWR ${'${c.basePower}'}`);
      return i.reply(safeText(`🕳️ **SECRET CHARACTERS** Page ${'${page}'}/${'${Math.max(1, Math.ceil(total / pageSize))}'}\n\n${'${lines.join("\\n")}'}`));
    }
    if (commandName === 'rarity')`);

  // Final catch must never crash from a long error message.
  s = s.replace(/return i\.editReply\(\{ content: `Error: \$\{err\.message\}` \}\)\.catch\(\(\) => \{\}\);/, "return i.editReply({ content: safeText(`Error: ${err.message}`, 1900) }).catch(() => {});");
  s = s.replace(/return i\.reply\(\{ content: `Error: \$\{err\.message\}`, ephemeral: true \}\)\.catch\(\(\) => \{\}\);/, "return i.reply({ content: safeText(`Error: ${err.message}`, 1900), ephemeral: true }).catch(() => {});");

  write(p,s);
}

// 4) Add /secrets page option and admin-give-rolls if missing.
{
  const p = 'scripts/deploy-commands.js';
  let s = read(p);
  s = s.replace(/new SlashCommandBuilder\(\)\.setName\('secrets'\)\.setDescription\('Show all SECRET characters'\)/,
    "new SlashCommandBuilder().setName('secrets').setDescription('Show SECRET characters').addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false))");
  if (!s.includes("setName('admin-give-rolls')")) {
    s = s.replace(/new SlashCommandBuilder\(\)\.setName\('admin-give-equipment'\)/,
      "new SlashCommandBuilder().setName('admin-give-rolls').setDescription('Admin: give rolls').addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Roll amount').setRequired(true)), new SlashCommandBuilder().setName('admin-give-equipment')");
  }
  write(p,s);
}

console.log('\nDONE. Now run: npm install && npx prisma db push && npx prisma generate && npm run commands:deploy && npm start');
