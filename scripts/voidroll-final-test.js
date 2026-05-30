// VoidRoll Reborn - Phase 20 Final Test
// Run: node scripts/voidroll-final-test.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const checks = [];

function exists(rel) {
  return fs.existsSync(path.join(process.cwd(), rel));
}

function addCheck(name, pass, note = '') {
  checks.push({ name, pass, note });
  console.log(`${pass ? '✅' : '❌'} ${name}${note ? ` — ${note}` : ''}`);
}

console.log('=== VoidRoll Reborn Final Test ===\n');

addCheck('Environment: BOT_TOKEN or DISCORD_TOKEN', Boolean(process.env.BOT_TOKEN || process.env.DISCORD_TOKEN));
addCheck('Environment: CLIENT_ID or APPLICATION_ID', Boolean(process.env.CLIENT_ID || process.env.APPLICATION_ID));
addCheck('Prisma schema exists', exists('prisma/schema.prisma'));

const requiredFiles = [
  'src/config/launch_cleanup_config.json',
  'src/config/final_commands.json',
  'src/config/db_wiring_config.json',
  'src/config/final_test_config.json',
  'src/systems/launchGuard.js',
  'src/systems/commandRouter.js',
  'src/systems/dbAdapter.js',
  'src/systems/economySystem.js',
  'src/systems/inventorySystem.js',
  'src/systems/animeDatabaseSystem.js',
  'src/systems/marketSystem.js',
  'src/systems/revealSystem.js',
  'src/systems/bannerSystem.js',
  'src/systems/battleEngine.js',
  'src/systems/formationSystem.js',
  'src/systems/storyFormationSystem.js',
  'src/systems/evolutionTreeSystem.js',
  'src/systems/traitSystem.js',
  'src/systems/pvpSystem.js',
  'src/systems/dungeonSystem.js',
  'src/systems/worldBossSystem.js',
  'scripts/deploy-commands-voidroll-reborn.js',
  'scripts/prisma-schema-audit.js'
];

console.log('\nRequired files:');
for (const file of requiredFiles) {
  addCheck(file, exists(file));
}

console.log('\nModule load test:');
const modules = [
  'launchGuard',
  'commandRouter',
  'dbAdapter',
  'economySystem',
  'inventorySystem',
  'animeDatabaseSystem',
  'marketSystem',
  'revealSystem',
  'bannerSystem',
  'battleEngine',
  'formationSystem',
  'storyFormationSystem',
  'evolutionTreeSystem',
  'traitSystem',
  'pvpSystem',
  'dungeonSystem',
  'worldBossSystem'
];

for (const mod of modules) {
  try {
    require(path.join(process.cwd(), 'src', 'systems', `${mod}.js`));
    addCheck(`require ${mod}`, true);
  } catch (err) {
    addCheck(`require ${mod}`, false, err.message);
  }
}

console.log('\nBlocked command test:');
try {
  const launchGuard = require(path.join(process.cwd(), 'src', 'systems', 'launchGuard.js'));
  const blocked = ['/fuse', '/star-upgrade', '/item-roll', '/relic-pull', '/aura-pull', '/character-shards'];
  for (const cmd of blocked) {
    addCheck(`blocked ${cmd}`, launchGuard.isBlockedCommand(cmd));
  }
} catch (err) {
  addCheck('blocked command test', false, err.message);
}

console.log('\nConfig sanity test:');
try {
  const banner = require(path.join(process.cwd(), 'src', 'config', 'banner_rework_config.json'));
  addCheck('VOIDBORN exists in rarity order', banner.rarityOrder.includes('VOIDBORN'));
  addCheck('SECRET exists in rarity order', banner.rarityOrder.includes('SECRET'));
  addCheck('No item rolls rule', banner.rules.noItemRolls === true);
} catch (err) {
  addCheck('banner config sanity', false, err.message);
}

const failed = checks.filter(c => !c.pass);
console.log('\n=== Summary ===');
console.log(`Passed: ${checks.length - failed.length}/${checks.length}`);
console.log(`Failed: ${failed.length}`);

if (failed.length) {
  console.log('\nFailed checks:');
  for (const f of failed) console.log(`- ${f.name}${f.note ? `: ${f.note}` : ''}`);
  process.exitCode = 1;
} else {
  console.log('\n🚀 VoidRoll Reborn final test passed.');
}
