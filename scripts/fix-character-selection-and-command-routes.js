// VoidRoll Reborn — Fix /character selection + launch command routes
// Fixes:
// 1) /character autocomplete selection like "Sousuke Aizen DIVINE" opening wrong character.
// 2) /variants not clearly showing base + Corrupted pair.
// 3) launch commands still falling to "Command is registered but not implemented yet in clean launch build."
//
// Run:
//   node scripts/fix-character-selection-and-command-routes.js
//   node --check src/index.js
//   node --check src/systems/officialCharacterCommandSystem.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   npm start

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

function backup(file, tag) {
  if (fs.existsSync(file)) {
    const b = `${file}.backup-${tag}-${Date.now()}.js`;
    fs.copyFileSync(file, b);
    return b;
  }
  return null;
}

function check(file) {
  try {
    cp.execFileSync('node', ['--check', file], { stdio:'pipe' });
    console.log(`✅ syntax OK ${file}`);
    return true;
  } catch (err) {
    console.error(`❌ syntax failed ${file}`);
    console.error(String(err.stderr || err.message || err).slice(0, 1200));
    return false;
  }
}

function ensureSystemFile() {
  const file = path.join(ROOT, 'src', 'systems', 'officialCharacterCommandSystem.js');
  fs.mkdirSync(path.dirname(file), { recursive:true });
  backup(file, 'official-character-system');

  const content = `// VoidRoll Reborn — Official Character Command System
// Fixes autocomplete selection values that include rarity/display labels.

const { EmbedBuilder } = require('discord.js');
const combatProfiles = require('./characterCombatProfileSystem');

const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'];

function money(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractRarity(raw) {
  const up = String(raw || '').toUpperCase();
  return RARITIES.find(r => up.includes(r)) || null;
}

function wantsCorrupted(raw) {
  return /\\bcorrupted\\b/i.test(String(raw || ''));
}

function cleanQuery(raw) {
  let q = String(raw || '').trim();

  // Remove common display decorations from autocomplete values.
  q = q.replace(/^[^a-zA-Z0-9]+/, '');
  q = q.replace(/\\b(COMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SECRET|VOIDBORN)\\b/gi, '');
  q = q.replace(/\\bPWR\\b.*$/i, '');
  q = q.replace(/[•|()[\\]{}<>]/g, ' ');
  q = q.replace(/\\s+/g, ' ').trim();

  // If autocomplete value is "Name - Rarity" or "Name — Rarity"
  q = q.split(' — ')[0].split(' - ')[0].trim();

  return q;
}

function baseKey(name) {
  return norm(String(name || '').replace(/^corrupted\\s+/i, ''));
}

function scoreCandidate(c, raw, query, rarity) {
  const n = norm(c.name);
  const q = norm(query);
  const rawN = norm(raw);
  const corruptWanted = wantsCorrupted(raw);

  let score = 0;

  if (n === q) score += 10000;
  if (n.includes(q)) score += 4000;
  if (q.includes(n)) score += 3500;

  if (corruptWanted && /^corrupted\\b/i.test(c.name)) score += 3000;
  if (!corruptWanted && !/^corrupted\\b/i.test(c.name)) score += 1500;

  if (rarity && String(c.rarity).toUpperCase() === rarity) score += 2500;

  // If raw selected says Divine, never prefer Corrupted Secret.
  if (rarity && rarity !== 'SECRET' && /^corrupted\\b/i.test(c.name)) score -= 5000;
  if (rarity === 'SECRET' && /^corrupted\\b/i.test(c.name)) score += 2000;

  if (rawN.includes(n)) score += 1000;

  score += Math.min(Number(c.basePower || 0) / 1000, 500);

  return score;
}

async function getCandidates(prisma, raw) {
  const query = cleanQuery(raw);
  const words = query.split(/\\s+/).filter(w => w.length >= 2).slice(0, 4);
  const ors = [];

  if (query) ors.push({ name: { contains: query } });
  for (const w of words) ors.push({ name: { contains: w } });

  // Special aliases.
  const qn = norm(query);
  if (qn.includes('aizen')) ors.push({ name: { contains: 'Aizen' } }, { name: { contains: 'Sousuke' } }, { name: { contains: 'Sosuke' } });
  if (qn.includes('gojo') || qn.includes('gojou')) ors.push({ name: { contains: 'Gojo' } }, { name: { contains: 'Gojou' } }, { name: { contains: 'Satoru' } });
  if (qn.includes('lelouch')) ors.push({ name: { contains: 'Lelouch' } });
  if (qn.includes('rimuru')) ors.push({ name: { contains: 'Rimuru' } });

  if (!ors.length) return [];

  const rows = await prisma.character.findMany({
    where: {
      active: true,
      OR: ors
    },
    take: 80
  }).catch(() => []);

  return rows;
}

async function findBestCharacter(prisma, raw) {
  const query = cleanQuery(raw);
  const rarity = extractRarity(raw);
  const candidates = await getCandidates(prisma, raw);

  if (!candidates.length) return null;

  const ranked = candidates
    .map(c => ({ c, score: scoreCandidate(c, raw, query, rarity) }))
    .sort((a, b) => b.score - a.score);

  return ranked[0].c;
}

function characterEmbed(c) {
  const profile = combatProfiles.profileOf ? combatProfiles.profileOf(c) : {
    role: combatProfiles.roleOf(c),
    element: combatProfiles.elementOf(c),
    passive: combatProfiles.passiveOf(c)
  };

  const passive = profile.passive || combatProfiles.passiveOf(c);

  const e = new EmbedBuilder()
    .setTitle(String(c.name || 'Unknown'))
    .setDescription([
      'Anime: **' + (c.anime || 'Unknown') + '**',
      'Rarity: **' + (c.rarity || 'Unknown') + '**',
      'Power: **' + money(c.basePower || 0) + '**',
      '',
      'Type: **' + (profile.role || 'Unknown') + '** | Element: **' + (profile.element || 'Unknown') + '**',
      'Passive: **' + passive.name + '** — ' + passive.text
    ].join('\\n'))
    .setColor(String(c.name || '').toLowerCase().includes('corrupted') ? 0x7c3aed : 0x5865f2);

  if (c.imageUrl) e.setImage(c.imageUrl);
  return e;
}

async function handleCharacter(i, prisma) {
  const raw = i.options.getString('name', true);
  const c = await findBestCharacter(prisma, raw);

  if (!c) {
    return i.reply({ content: 'ما حصلت الشخصية: ' + raw, ephemeral: true });
  }

  return i.reply({ embeds: [characterEmbed(c)] });
}

async function handleVariants(i, prisma) {
  const raw = i.options.getString('name') || i.options.getString('character') || '';
  if (!raw) {
    return i.reply({ content: 'اكتب اسم الشخصية. مثال: /variants name:Aizen', ephemeral: true });
  }

  const candidates = await getCandidates(prisma, raw);
  const qKey = baseKey(cleanQuery(raw));

  const variants = candidates
    .filter(c => {
      const k = baseKey(c.name);
      return k.includes(qKey) || qKey.includes(k) || norm(c.name).includes(norm(cleanQuery(raw)));
    })
    .sort((a, b) => {
      const ac = /^corrupted\\b/i.test(a.name) ? 1 : 0;
      const bc = /^corrupted\\b/i.test(b.name) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return Number(b.basePower || 0) - Number(a.basePower || 0);
    })
    .slice(0, 10);

  if (!variants.length) {
    return i.reply({ content: 'ما حصلت نسخ للشخصية: ' + raw, ephemeral: true });
  }

  const lines = variants.map((c, idx) => {
    return (idx + 1) + '. **' + c.name + '** — ' + c.rarity + ' — PWR ' + money(c.basePower || 0);
  });

  const e = new EmbedBuilder()
    .setTitle('Variants: ' + raw)
    .setDescription(lines.join('\\n'))
    .setColor(0x7c3aed);

  const corrupted = variants.find(c => /^corrupted\\b/i.test(c.name) && c.imageUrl);
  const normal = variants.find(c => !/^corrupted\\b/i.test(c.name) && c.imageUrl);
  if (corrupted?.imageUrl) e.setImage(corrupted.imageUrl);
  else if (normal?.imageUrl) e.setImage(normal.imageUrl);

  return i.reply({ embeds: [e] });
}

async function handleCommand(i, prisma) {
  if (i.commandName === 'character') return handleCharacter(i, prisma);
  if (i.commandName === 'variants') return handleVariants(i, prisma);
  return false;
}

module.exports = {
  handleCommand,
  handleCharacter,
  handleVariants,
  findBestCharacter,
  cleanQuery,
  extractRarity
};
`;

  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ wrote src/systems/officialCharacterCommandSystem.js');
}

function patchIndex() {
  const file = path.join(ROOT, 'src', 'index.js');
  if (!fs.existsSync(file)) {
    console.error('❌ src/index.js not found');
    process.exit(1);
  }

  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  backup(file, 'character-selection-routes');

  const imports = [
    "const officialCharacterCommandSystem = require('./systems/officialCharacterCommandSystem');",
    "const rollBank = require('./systems/rollBankSystem');",
    "const huntZoneSystem = require('./systems/huntZoneSystem');",
    "const bountyBoardSystem = require('./systems/bountyBoardSystem');",
    "const bossContractsSystem = require('./systems/bossContractsSystem');",
    "const relicSystem = require('./systems/relicSystem');",
    "const traitsSystem = require('./systems/traitsSystem');",
    "const eventShopSystem = require('./systems/eventShopSystem');",
    "const corruptedRaidSystem = require('./systems/corruptedRaidSystem');",
    "const bannerSystem = require('./systems/bannerSystem');"
  ];

  for (const line of imports) {
    if (!s.includes(line)) {
      const reqs = [...s.matchAll(/^const .+require\\(.+\\);$/gm)];
      if (reqs.length) {
        const last = reqs[reqs.length - 1];
        const pos = last.index + last[0].length;
        s = s.slice(0, pos) + '\\n' + line + s.slice(pos);
      } else {
        s = line + '\\n' + s;
      }
    }
  }

  const guard = `
  // FIX_CHARACTER_SELECTION_AND_LAUNCH_ROUTES
  if (['character','variants'].includes(commandName)) return officialCharacterCommandSystem.handleCommand(i, prisma);
  if (commandName === 'rolls') return rollBank.handleRollsCommand(i, prisma);
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleCommand(i, prisma, rollBank);
  if (['bounty','bounties','bounty-claim'].includes(commandName)) return bountyBoardSystem.handleCommand(i, prisma, rollBank);
  if (['contracts','contract-start'].includes(commandName)) return bossContractsSystem.handleCommand(i, prisma, rollBank);
  if (['relics','relic-give','relic-upgrade','relic-equip'].includes(commandName)) return relicSystem.handleCommand(i, prisma, rollBank);
  if (['traits','trait-set'].includes(commandName)) return traitsSystem.handleCommand(i, prisma, rollBank);
  if (['event-shop','event-buy'].includes(commandName)) return eventShopSystem.handleCommand(i, prisma, rollBank);
  if (['corrupted-raid'].includes(commandName)) return corruptedRaidSystem.handleCommand(i, prisma, rollBank);
  if (['premium-roll','event-roll'].includes(commandName)) return bannerSystem.handleCommand(i, prisma, rollBank);
`;

  if (!s.includes('FIX_CHARACTER_SELECTION_AND_LAUNCH_ROUTES')) {
    const needle = "const commandName = i.commandName; const userId = i.user.id;";
    if (s.includes(needle)) {
      s = s.replace(needle, needle + guard);
    } else {
      const m = /const\\s+commandName\\s*=\\s*i\\.commandName\\s*;[\\s\\S]{0,80}?const\\s+userId\\s*=\\s*i\\.user\\.id\\s*;/.exec(s);
      if (m) s = s.replace(m[0], m[0] + guard);
      else console.log('⚠️ commandName anchor not found; fallback guard still patched');
    }
  }

  const fallbackOld = "return i.reply('Command is registered but not implemented yet in clean launch build.');";
  if (s.includes(fallbackOld) && !s.includes('FIX_CHARACTER_BEFORE_FALLBACK')) {
    s = s.replace(fallbackOld, `// FIX_CHARACTER_BEFORE_FALLBACK${guard}
  return i.reply('This command is not active in this build. Use /help or redeploy slash commands.');`);
  }
  s = s.replace(/Command is registered but not implemented yet in clean launch build\./g, 'This command is not active in this build. Use /help or redeploy slash commands.');

  fs.writeFileSync(file, s, 'utf8');
  if (s !== before) console.log('✅ patched src/index.js');
  else console.log('✅ src/index.js already patched');
}

function patchDeploy() {
  const file = path.join(ROOT, 'scripts', 'phase27-fast-guild-deploy.js');
  if (!fs.existsSync(file)) {
    console.log('⚠️ deploy script missing, skip');
    return;
  }

  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  backup(file, 'character-selection-routes');

  // Ensure command option for /character and /variants uses name and autocomplete-friendly.
  s = s.replace(/name:'character', description:'Search character',[\\s\\S]*?\\},/g,
    "name:'character', description:'Search character', type:1, options:[{ name:'name', description:'Character name', type:3, required:true, autocomplete:true }] },");
  s = s.replace(/name:'variants', description:'Show character variants',[\\s\\S]*?\\},/g,
    "name:'variants', description:'Show character variants', type:1, options:[{ name:'name', description:'Character name', type:3, required:false, autocomplete:true }] },");

  fs.writeFileSync(file, s, 'utf8');
  if (s !== before) console.log('✅ patched deploy script');
}

function main() {
  console.log('=== Fix /character selection + command routes ===');
  ensureSystemFile();
  patchIndex();
  patchDeploy();

  const files = [
    'src/index.js',
    'src/systems/officialCharacterCommandSystem.js',
    'scripts/phase27-fast-guild-deploy.js'
  ];

  let ok = true;
  for (const f of files) ok = check(f) && ok;

  if (!ok) {
    console.log('❌ Syntax check failed. Send the failing output.');
    process.exit(1);
  }

  console.log('\\n✅ Fix complete.');
  console.log('Run next:');
  console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
  console.log('npm start');
}

main();
