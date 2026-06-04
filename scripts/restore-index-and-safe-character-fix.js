// VoidRoll Reborn — RESTORE INDEX + SAFE CHARACTER FIX
// Fixes current SyntaxError caused by broken string literals in src/index.js:
//   ].join('
//          ^
// It restores the newest syntactically valid src/index backup, then applies a SAFE /character route.
// It does NOT replace all "\n" globally anymore.
//
// Run:
//   node scripts/restore-index-and-safe-character-fix.js
//   node --check src/index.js
//   node --check src/systems/officialCharacterCommandSystem.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   npm start

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = process.cwd();

function syntaxOK(file) {
  try {
    cp.execFileSync('node', ['--check', file], { stdio:'pipe' });
    return true;
  } catch {
    return false;
  }
}

function backup(file, tag) {
  if (!fs.existsSync(file)) return null;
  const b = `${file}.backup-${tag}-${Date.now()}.js`;
  fs.copyFileSync(file, b);
  return b;
}

function restoreValidIndexBackup() {
  const indexPath = path.join(ROOT, 'src', 'index.js');

  if (syntaxOK(indexPath)) {
    console.log('✅ current src/index.js syntax already OK');
    return;
  }

  console.log('⚠️ current src/index.js is broken. Searching valid backups...');

  const srcDir = path.join(ROOT, 'src');
  const backups = fs.readdirSync(srcDir)
    .filter(n => /^index.*backup.*\.js$|^index\.backup.*\.js$/.test(n))
    .map(n => path.join(srcDir, n))
    .filter(p => fs.statSync(p).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const b of backups) {
    if (syntaxOK(b)) {
      const brokenBackup = backup(indexPath, 'broken-before-restore');
      fs.copyFileSync(b, indexPath);
      console.log(`✅ restored valid backup: ${path.relative(ROOT, b)}`);
      console.log(`Backup of broken index: ${path.relative(ROOT, brokenBackup)}`);
      return;
    }
  }

  // Last-resort targeted repair if no valid backup was found.
  console.log('⚠️ No valid backup found. Trying targeted repair.');

  let s = fs.readFileSync(indexPath, 'utf8');
  backup(indexPath, 'targeted-repair');

  // Fix the most common broken pattern produced by global \\n replacement inside string literals.
  s = s.replace(/\.join\('\s*'\)/g, ".join('\\n')");
  s = s.replace(/\.join\("\s*"\)/g, '.join("\\n")');

  // Fix literal \n only in the first import block if it appears as text.
  const firstLines = s.slice(0, 2500);
  if (firstLines.includes('\\nconst ') || firstLines.includes('\\n//')) {
    const headEnd = s.indexOf('\n\n');
    const cut = headEnd > 0 ? headEnd : Math.min(2500, s.length);
    const fixedHead = s.slice(0, cut).replace(/\\n/g, '\n');
    s = fixedHead + s.slice(cut);
  }

  fs.writeFileSync(indexPath, s, 'utf8');

  if (!syntaxOK(indexPath)) {
    console.error('❌ Could not repair src/index.js automatically.');
    console.error('Run and send:');
    console.error("ls -lt src/index*backup*.js | head -20");
    console.error("sed -n '420,450p' src/index.js");
    process.exit(1);
  }

  console.log('✅ targeted repair fixed src/index.js syntax');
}

function writeOfficialCharacterSystem() {
  const file = path.join(ROOT, 'src', 'systems', 'officialCharacterCommandSystem.js');
  fs.mkdirSync(path.dirname(file), { recursive:true });
  backup(file, 'official-character-safe');

  const content = `// VoidRoll Reborn — Official Character Command System
// Safe resolver for all base/Corrupted pairs.

const { EmbedBuilder } = require('discord.js');
const combatProfiles = require('./characterCombatProfileSystem');

const RARITIES = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','SECRET'];

const ALIASES = [
  { key:'aizen', base:'Sousuke Aizen', corrupted:'Corrupted Sousuke Aizen', aliases:['aizen','sousuke aizen','sosuke aizen'] },
  { key:'itachi', base:'Itachi Uchiha', corrupted:'Corrupted Itachi Uchiha', aliases:['itachi','itachi uchiha'] },
  { key:'ainz', base:'Ainz Ooal Gown', corrupted:'Corrupted Ainz Ooal Gown', aliases:['ainz','ainz ooal gown'] },
  { key:'rimuru', base:'Rimuru Tempest', corrupted:'Corrupted Rimuru Tempest', aliases:['rimuru','rimuru tempest'] },
  { key:'makima', base:'Makima', corrupted:'Corrupted Makima', aliases:['makima'] },
  { key:'lelouch', base:'Lelouch Lamperouge', corrupted:'Corrupted Lelouch Lamperouge', aliases:['lelouch','lelouch lamperouge'] },
  { key:'gojo', base:'Satoru Gojo', corrupted:'Corrupted Satoru Gojo', aliases:['gojo','gojou','satoru gojo','satoru gojou'] },
  { key:'eren', base:'Eren Yeager', corrupted:'Corrupted Eren Yeager', aliases:['eren','eren yeager','eren jaeger'] },
  { key:'saber', base:'Saber', corrupted:'Corrupted Saber', aliases:['saber','artoria','artoria pendragon'] },
  { key:'allmight', base:'All Might', corrupted:'Corrupted All Might', aliases:['all might','allmight','toshinori','toshinori yagi'] }
];

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
  q = q.replace(/^[^a-zA-Z0-9]+/, '');
  q = q.replace(/\\b(COMMON|RARE|EPIC|LEGENDARY|MYTHIC|DIVINE|SECRET|VOIDBORN)\\b/gi, '');
  q = q.replace(/\\bPWR\\b.*$/i, '');
  q = q.replace(/[•|()[\\]{}<>]/g, ' ');
  q = q.replace(/\\s+/g, ' ').trim();
  q = q.split(' — ')[0].split(' - ')[0].trim();
  return q;
}

function aliasMatch(raw) {
  const q = norm(cleanQuery(raw));
  for (const a of ALIASES) {
    if (a.aliases.some(x => q === norm(x) || q.includes(norm(x)) || norm(x).includes(q))) return a;
  }
  return null;
}

async function getExactByName(prisma, name) {
  return prisma.character.findFirst({ where:{ name, active:true } }).catch(() => null);
}

async function resolveEventPair(prisma, raw) {
  const alias = aliasMatch(raw);
  if (!alias) return null;

  const rarity = extractRarity(raw);
  const corrupted = wantsCorrupted(raw);

  if (rarity && rarity !== 'SECRET') return getExactByName(prisma, alias.base);
  if (rarity === 'SECRET' || corrupted) return getExactByName(prisma, alias.corrupted);

  return null;
}

async function getCandidates(prisma, raw) {
  const alias = aliasMatch(raw);
  const query = cleanQuery(raw);
  const ors = [];

  if (alias) {
    ors.push({ name: alias.base });
    ors.push({ name: alias.corrupted });
    for (const a of alias.aliases) ors.push({ name:{ contains:a } });
  }

  if (query) {
    ors.push({ name:{ contains:query } });
    for (const w of query.split(/\\s+/).filter(x => x.length >= 2).slice(0,4)) {
      ors.push({ name:{ contains:w } });
    }
  }

  if (!ors.length) return [];
  return prisma.character.findMany({ where:{ active:true, OR:ors }, take:80 }).catch(() => []);
}

function scoreCandidate(c, raw) {
  const alias = aliasMatch(raw);
  const rarity = extractRarity(raw);
  const corrupted = wantsCorrupted(raw);
  const query = cleanQuery(raw);
  const n = norm(c.name);
  const q = norm(query);

  let score = 0;

  if (alias) {
    if (c.name === alias.base) score += 5000;
    if (c.name === alias.corrupted) score += 5000;
    if (rarity && rarity !== 'SECRET' && c.name === alias.base) score += 10000;
    if (rarity === 'SECRET' && c.name === alias.corrupted) score += 10000;
    if (corrupted && c.name === alias.corrupted) score += 10000;
    if (!corrupted && !rarity && c.name === alias.base) score += 3000;
  }

  if (n === q) score += 7000;
  if (n.includes(q)) score += 2500;
  if (q.includes(n)) score += 2000;

  if (rarity && String(c.rarity).toUpperCase() === rarity) score += 2500;
  if (rarity && rarity !== 'SECRET' && /^corrupted\\b/i.test(c.name)) score -= 10000;
  if (rarity === 'SECRET' && !/^corrupted\\b/i.test(c.name)) score -= 5000;

  score += Math.min(Number(c.basePower || 0) / 1000, 400);
  return score;
}

async function findBestCharacter(prisma, raw) {
  const forced = await resolveEventPair(prisma, raw);
  if (forced) return forced;

  const candidates = await getCandidates(prisma, raw);
  if (!candidates.length) return null;

  return candidates.map(c => ({ c, score: scoreCandidate(c, raw) })).sort((a,b) => b.score - a.score)[0].c;
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
    .setColor(/^corrupted\\b/i.test(String(c.name || '')) ? 0x7c3aed : 0x5865f2);

  if (c.imageUrl) e.setImage(c.imageUrl);
  return e;
}

async function handleCharacter(i, prisma) {
  const raw = i.options.getString('name', true);
  const c = await findBestCharacter(prisma, raw);
  if (!c) return i.reply({ content:'ما حصلت الشخصية: ' + raw, ephemeral:true });
  return i.reply({ embeds:[characterEmbed(c)] });
}

async function handleVariants(i, prisma) {
  const raw = i.options.getString('name') || i.options.getString('character') || '';
  if (!raw) return i.reply({ content:'اكتب اسم الشخصية. مثال: /variants name:Aizen', ephemeral:true });

  const alias = aliasMatch(raw);
  let variants = [];

  if (alias) {
    const base = await getExactByName(prisma, alias.base);
    const corrupted = await getExactByName(prisma, alias.corrupted);
    variants = [base, corrupted].filter(Boolean);
  } else {
    variants = await getCandidates(prisma, raw);
  }

  if (!variants.length) return i.reply({ content:'ما حصلت نسخ للشخصية: ' + raw, ephemeral:true });

  const lines = variants.map((c, idx) => (idx + 1) + '. **' + c.name + '** — ' + c.rarity + ' — PWR ' + money(c.basePower || 0));

  const e = new EmbedBuilder()
    .setTitle('Variants: ' + raw)
    .setDescription(lines.join('\\n'))
    .setColor(0x7c3aed);

  const img = variants.find(c => /^corrupted\\b/i.test(c.name) && c.imageUrl)?.imageUrl || variants.find(c => c.imageUrl)?.imageUrl;
  if (img) e.setImage(img);

  return i.reply({ embeds:[e] });
}

async function handleCommand(i, prisma) {
  if (i.commandName === 'character') return handleCharacter(i, prisma);
  if (i.commandName === 'variants') return handleVariants(i, prisma);
  return false;
}

module.exports = { handleCommand, handleCharacter, handleVariants, findBestCharacter, cleanQuery, extractRarity };
`;

  fs.writeFileSync(file, content, 'utf8');
  console.log('✅ wrote officialCharacterCommandSystem');
}

function patchIndexSafely() {
  const indexPath = path.join(ROOT, 'src', 'index.js');
  let s = fs.readFileSync(indexPath, 'utf8');
  backup(indexPath, 'safe-character-patch');

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
      const reqs = [...s.matchAll(/^const .+require\(.+\);$/gm)];
      if (reqs.length) {
        const last = reqs[reqs.length - 1];
        const pos = last.index + last[0].length;
        s = s.slice(0, pos) + '\n' + line + s.slice(pos);
      } else {
        s = line + '\n' + s;
      }
    }
  }

  const guard = `
  // RESTORED_SAFE_CHARACTER_SELECTION_ROUTE
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

  if (!s.includes('RESTORED_SAFE_CHARACTER_SELECTION_ROUTE')) {
    const needle = "const commandName = i.commandName; const userId = i.user.id;";
    if (s.includes(needle)) {
      s = s.replace(needle, needle + guard);
    } else {
      const m = /const\s+commandName\s*=\s*i\.commandName\s*;[\s\S]{0,120}?const\s+userId\s*=\s*i\.user\.id\s*;/.exec(s);
      if (m) s = s.replace(m[0], m[0] + guard);
      else console.log('⚠️ commandName anchor not found');
    }
  }

  const fallbackOld = "return i.reply('Command is registered but not implemented yet in clean launch build.');";
  if (s.includes(fallbackOld) && !s.includes('RESTORED_SAFE_BEFORE_FALLBACK')) {
    s = s.replace(fallbackOld, `// RESTORED_SAFE_BEFORE_FALLBACK${guard}
  return i.reply('This command is not active in this build. Use /help or redeploy slash commands.');`);
  }

  s = s.replace(/Command is registered but not implemented yet in clean launch build\./g, 'This command is not active in this build. Use /help or redeploy slash commands.');

  fs.writeFileSync(indexPath, s, 'utf8');
  console.log('✅ patched index safely');
}

function main() {
  console.log('=== Restore index + safe character fix ===');
  restoreValidIndexBackup();
  writeOfficialCharacterSystem();
  patchIndexSafely();

  let ok = true;
  ok = syntaxOK(path.join(ROOT, 'src', 'index.js')) && ok;
  ok = syntaxOK(path.join(ROOT, 'src', 'systems', 'officialCharacterCommandSystem.js')) && ok;

  if (!ok) {
    console.error('❌ syntax check failed after safe fix');
    console.error('Run and send:');
    console.error("node --check src/index.js");
    process.exit(1);
  }

  console.log('✅ syntax OK src/index.js');
  console.log('✅ syntax OK officialCharacterCommandSystem');
  console.log('\nNext:');
  console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
  console.log('npm start');
}

main();
