// VoidRoll Reborn - Phase 25 Guild-Only Command Fix
// Run:
//   node scripts/phase25-patch-guild-only.js
//   GUILD_ID=1039274134296862801 node scripts/phase25-hard-command-reset.js

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'phase25-hard-command-reset.js');

if (!fs.existsSync(file)) {
  console.error('❌ scripts/phase25-hard-command-reset.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');

const oldBlock = "console.log(`3) Deploying clean GLOBAL commands only: ${cleanCommands.length}`);\n    await rest.put(Routes.applicationCommands(clientId), { body: cleanCommands });\n    console.log('✅ CLEAN GLOBAL commands deployed');";

const newBlock = "const targetGuildId = process.env.GUILD_ID || guildIds[0] || '1039274134296862801';\n    if (!targetGuildId) {\n      console.error('❌ No guild id found. Set GUILD_ID in Render Environment.');\n      process.exit(1);\n    }\n\n    console.log(`3) Deploying clean GUILD commands only: ${cleanCommands.length} to ${targetGuildId}`);\n    await rest.put(Routes.applicationGuildCommands(clientId, targetGuildId), { body: cleanCommands });\n    console.log('✅ CLEAN GUILD commands deployed');";

if (s.includes(oldBlock)) {
  s = s.replace(oldBlock, newBlock);
} else if (s.includes('Deploying clean GUILD commands only')) {
  console.log('✅ Already patched to guild-only.');
} else {
  console.error('❌ Could not find global deploy block to patch.');
  process.exit(1);
}

s = s.replace(
  "console.log('Done. Old commands removed from API.');\n    console.log('Discord UI may need a few minutes to refresh global commands.');",
  "console.log('Done. Old commands removed from API.');\n    console.log('Guild commands should appear immediately.');"
);

const backup = path.join(process.cwd(), 'scripts', `phase25-hard-command-reset.backup-guild-only-${Date.now()}.js`);
fs.copyFileSync(file, backup);
fs.writeFileSync(file, s, 'utf8');

console.log('✅ Patched phase25-hard-command-reset.js to deploy Guild commands only.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Now run:');
console.log('GUILD_ID=1039274134296862801 node scripts/phase25-hard-command-reset.js');
