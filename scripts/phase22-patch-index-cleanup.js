// VoidRoll Reborn - Phase 22 Index Cleanup Patch
// Run:
//   node scripts/phase22-patch-index-cleanup.js
//
// This patches src/index.js safely:
// - disables old commands
// - routes new commands to commandRouter/dbAdapter
// - removes "registered but not implemented" for new commands
// - cleans /help text
// - improves multi-roll images up to 10 embeds

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function replaceOnce(find, replace, label) {
  if (!s.includes(find)) {
    console.log(`⚠️ skipped ${label}: pattern not found`);
    return false;
  }
  s = s.replace(find, replace);
  console.log(`✅ patched ${label}`);
  return true;
}

// 1) Add imports after prisma import
replaceOnce(
  "const { prisma } = require('./lib/db');",
  `const { prisma } = require('./lib/db');

// Phase 22: route new VoidRoll Reborn systems before legacy fallback.
let handleVoidRollCommand = null;
let buildCommandContext = null;
try {
  ({ handleVoidRollCommand } = require('./systems/commandRouter'));
  ({ buildCommandContext } = require('./systems/dbAdapter'));
} catch (err) {
  console.warn('Phase22 router not available yet:', err.message);
}`,
  'phase22 imports'
);

// 2) Add helpers after shortId function
replaceOnce(
  "function shortId(cardId='') { return String(cardId).slice(-6).toUpperCase(); }",
  `function shortId(cardId='') { return String(cardId).slice(-6).toUpperCase(); }

// Phase 22 cleanup
const OLD_DISABLED_COMMANDS = new Set([
  'auto-train',
  'tower',
  'boss-rush',
  'fuse',
  'fusion',
  'star-upgrade',
  'item-roll',
  'relic-pull',
  'aura-pull',
  'character-shards',
  'shards'
]);

const NEW_ROUTER_COMMANDS = new Set([
  'pvp-rank',
  'pvp-defense',
  'pvp-defense-set',
  'pvp-leaderboard',
  'pvp-rewards',
  'world-boss',
  'raid',
  'raid-attack',
  'raid-rank',
  'raid-rewards',
  'character-tree',
  'upgrade',
  'traits',
  'trait',
  'trait-unlock',
  'trait-upgrade',
  'dungeon-status',
  'dungeon-choose',
  'dungeon-abandon',
  'dungeon'
]);

function disabledOldCommandMessage(commandName) {
  return [
    \`❌ **/\${commandName}** is disabled in VoidRoll Reborn.\`,
    '',
    'تم حذف الأنظمة القديمة:',
    '- Fusion / Stars',
    '- Item Rolls / Relic Pulls / Aura Pulls',
    '- Character Shards',
    '- Power-only progression',
    '',
    'استخدم الأنظمة الجديدة: /upgrade /traits /dungeon /pvp-rank /world-boss'
  ].join('\\n');
}

async function tryPhase22Router(i) {
  if (!handleVoidRollCommand || !buildCommandContext) return false;
  try {
    const context = await buildCommandContext(i);
    const handled = await handleVoidRollCommand(i, context);
    return Boolean(handled);
  } catch (err) {
    console.error('Phase22 router error:', err);
    const msg = \`Router Error: \${String(err.message || err).slice(0, 1500)}\`;
    if (i.deferred || i.replied) await i.editReply(msg).catch(()=>{});
    else await i.reply({ content: msg, ephemeral:true }).catch(()=>{});
    return true;
  }
}`,
  'phase22 helpers'
);

// 3) Patch command start
replaceOnce(
  "async function command(i) {\n  const commandName = i.commandName; const userId = i.user.id; await ensureUser(i.user);",
  `async function command(i) {
  const commandName = i.commandName; const userId = i.user.id; await ensureUser(i.user);

  // Phase 22: disable old removed commands even if Discord still shows them.
  if (OLD_DISABLED_COMMANDS.has(commandName)) {
    return i.reply({ content: disabledOldCommandMessage(commandName), ephemeral: true });
  }

  // Phase 22: route newly registered commands to the new systems.
  if (NEW_ROUTER_COMMANDS.has(commandName)) {
    const handled = await tryPhase22Router(i);
    if (handled) return;
  }`,
  'command router hook'
);

// 4) Clean help text
replaceOnce(
  "if (commandName === 'help') return i.reply('**🌌 VoidRoll Reborn**\\nEconomy: /profile /wallet /daily /market /market-buy\\nCollection: /inventory /view-card /characters /character /anime /collection /who-has\\nGacha: /roll /banner /pack /pity /rates\\nProgress: /train /auto-train /formations /autoteam /story /tower /dungeon /boss-rush /pvp\\nTrading: /gift-character /trade-offer /trade-accept /trade-decline /trade-cancel /trades\\nAdmin: /admin-reset-all /admin-give-gold /admin-give-tokens /admin-give-rolls /admin-give-resource');",
  `if (commandName === 'help') return i.reply({
    embeds: [new EmbedBuilder()
      .setTitle('🌌 VoidRoll Reborn')
      .setDescription([
        '**Core**: /profile /wallet /daily',
        '**Collection**: /inventory /view-card /characters /character /anime /collection /who-has',
        '**Gacha**: /roll /banner /pack /pity /rates',
        '**Progression**: /character-tree /upgrade /traits /trait',
        '**Teams**: /formations /story',
        '**Market**: /market /market-buy',
        '**PvP**: /pvp /pvp-rank /pvp-leaderboard',
        '**Dungeons/Raids**: /dungeon /dungeon-status /world-boss /raid /raid-rank',
        '**Trading**: /gift-character /trade-offer /trade-accept /trade-decline /trade-cancel /trades',
        '',
        'Old systems like /auto-train, /tower, /boss-rush, fusion, stars, and item rolls are disabled.'
      ].join('\\n'))
      .setColor(0x7c3aed)]
  });`,
  'help cleanup'
);

// 5) Improve multi-roll embeds from <=3 to <=10
let countRollPatch = 0;
s = s.replace(/if\(amount<=3\)\{/g, () => {
  countRollPatch++;
  return "if(amount<=10){";
});
console.log(`✅ patched multi-roll embed limit occurrences: ${countRollPatch}`);

// 6) Better fallback message
replaceOnce(
  "return i.reply('Command is registered but not implemented yet in clean launch build.');",
  `return i.reply({
    content: [
      '⚠️ هذا الأمر موجود في Discord لكنه غير مربوط داخل index.js الحالي.',
      'إذا هذا أمر جديد، نحتاج نضيفه في Phase 22 router list أو ننظف deploy commands.',
      \`Command: **/\${commandName}**\`
    ].join('\\n'),
    ephemeral: true
  });`,
  'fallback message'
);

// 7) ready -> clientReady to remove warning
replaceOnce(
  "client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));",
  "client.once('clientReady', () => console.log(`Logged in as ${client.user.tag}`));",
  'clientReady warning'
);

// Save backup + patched file
const backupPath = path.join(process.cwd(), 'src', `index.backup-phase22-${Date.now()}.js`);
fs.copyFileSync(indexPath, backupPath);
fs.writeFileSync(indexPath, s, 'utf8');

console.log('');
console.log('✅ Phase 22 index cleanup patch applied.');
console.log(`Backup created: ${path.relative(process.cwd(), backupPath)}`);
console.log('');
console.log('Next run:');
console.log('node scripts/deploy-commands-voidroll-reborn.js');
console.log('npm start');
