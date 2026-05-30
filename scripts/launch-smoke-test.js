// VoidRoll Reborn - Launch Smoke Test
// Run: node scripts/launch-smoke-test.js

const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'src/config/launch_cleanup_config.json',
  'src/systems/launchGuard.js',
  'src/config/banner_rework_config.json',
  'src/systems/bannerSystem.js',
  'src/config/reveal_config.json',
  'src/systems/revealSystem.js',
  'src/config/battle_config.json',
  'src/systems/battleEngine.js',
  'src/config/formation_story_config.json',
  'src/systems/formationSystem.js',
  'src/systems/storyFormationSystem.js',
  'src/config/evolution_tree_config.json',
  'src/systems/evolutionTreeSystem.js',
  'src/config/trait_config.json',
  'src/systems/traitSystem.js',
  'src/config/pvp_config.json',
  'src/systems/pvpSystem.js',
  'src/config/dungeon_config.json',
  'src/systems/dungeonSystem.js',
  'src/config/world_boss_config.json',
  'src/systems/worldBossSystem.js'
];

function exists(rel) {
  return fs.existsSync(path.join(process.cwd(), rel));
}

let ok = true;
console.log('=== VoidRoll Reborn Launch Smoke Test ===');

for (const file of requiredFiles) {
  const pass = exists(file);
  if (!pass) ok = false;
  console.log(`${pass ? '✅' : '❌'} ${file}`);
}

console.log('');
if (ok) {
  console.log('✅ Smoke test passed: required Phase files exist.');
} else {
  console.log('❌ Smoke test failed: missing files above.');
  process.exitCode = 1;
}
