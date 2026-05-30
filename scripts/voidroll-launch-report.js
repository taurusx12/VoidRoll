// VoidRoll Reborn - Launch Report Generator
// Run: node scripts/voidroll-launch-report.js

const fs = require('fs');
const path = require('path');

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), 'utf8'));
  } catch (_) {
    return null;
  }
}

const launch = readJson('src/config/launch_cleanup_config.json') || {};
const finalCommands = readJson('src/config/final_commands.json') || {};
const finalTest = readJson('src/config/final_test_config.json') || {};

const report = [
  '# VoidRoll Reborn — Launch Report',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Identity',
  `Name: ${launch.launchIdentity?.name || 'VoidRoll Reborn'}`,
  `Genre: ${launch.launchIdentity?.genre || 'Anime MMO RPG + Gacha + Economy + PvP'}`,
  '',
  '## Completed Systems',
  ...(launch.finalPhasesCompleted || []).map(x => `- ${x}`),
  '',
  '## Allowed Command Groups',
  ...Object.entries(finalCommands.commandGroups || {}).flatMap(([group, commands]) => [
    `### ${group}`,
    commands.map(c => `/${c}`).join(', '),
    ''
  ]),
  '',
  '## Blocked Commands',
  ...(finalCommands.blockedCommands || []).map(c => `- /${c}`),
  '',
  '## Manual Discord Tests',
  ...(finalTest.manualDiscordTests || []).map(c => `- ${c}`),
  '',
  '## Launch Commands',
  '```bash',
  ...(finalTest.launchCommands || []),
  '```',
  '',
  '## Ready When',
  ...(finalTest.readyWhen || []).map(x => `- ${x}`),
  ''
].join('\n');

fs.writeFileSync(path.join(process.cwd(), 'VOIDROLL_LAUNCH_REPORT.md'), report, 'utf8');
console.log('✅ Created VOIDROLL_LAUNCH_REPORT.md');
