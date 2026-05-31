// VoidRoll Reborn - Phase 26 Render Start Fix
// Fixes Render running old deploy-commands.js on every boot.
// Run:
//   node scripts/phase26-render-start-fix.js

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const deployOldPath = path.join(root, 'scripts', 'deploy-commands.js');
const indexPath = path.join(root, 'src', 'index.js');

if (!fs.existsSync(packagePath)) {
  console.error('❌ package.json not found.');
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts = pkg.scripts || {};

// Important:
// Render currently runs: npm run commands:deploy && node src/index.js
// So commands:deploy MUST NOT run the old deploy script anymore.
pkg.scripts['commands:deploy'] = "node scripts/phase25-hard-command-reset.js";
pkg.scripts['start'] = "node src/index.js";

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2), 'utf8');
console.log('✅ package.json scripts fixed:');
console.log('   commands:deploy -> node scripts/phase25-hard-command-reset.js');
console.log('   start -> node src/index.js');

// Replace old deploy-commands.js with a safe proxy so it can never deploy old commands again.
if (fs.existsSync(deployOldPath)) {
  const backup = path.join(root, 'scripts', `deploy-commands.backup-old-${Date.now()}.js`);
  fs.copyFileSync(deployOldPath, backup);

  fs.writeFileSync(deployOldPath, `// VoidRoll Reborn - old deploy script disabled by Phase 26.
// This file used to deploy legacy commands like auto-train/tower/boss-rush.
// It now delegates to the clean hard reset script.

require('./phase25-hard-command-reset');
`, 'utf8');

  console.log(`✅ scripts/deploy-commands.js disabled and redirected.`);
  console.log(`   Backup: ${path.relative(root, backup)}`);
} else {
  console.log('⚠️ scripts/deploy-commands.js not found, skipped.');
}

// Add hard safety in index.js so if legacy progressBattle is still called,
// it does not crash on Unknown Interaction.
if (fs.existsSync(indexPath)) {
  let s = fs.readFileSync(indexPath, 'utf8');

  if (!s.includes('PHASE26_UNKNOWN_INTERACTION_GUARD')) {
    const anchor = "const client = new Client({ intents: [GatewayIntentBits.Guilds] });";
    if (s.includes(anchor)) {
      s = s.replace(anchor, `${anchor}

// PHASE26_UNKNOWN_INTERACTION_GUARD
client.on('error', err => {
  if (err?.code === 10062) {
    console.warn('Ignored expired Discord interaction.');
    return;
  }
  console.error('Discord client error:', err);
});

process.on('unhandledRejection', err => {
  if (err?.code === 10062) {
    console.warn('Ignored expired Discord interaction.');
    return;
  }
  console.error('Unhandled rejection:', err);
});`);
      console.log('✅ Added Unknown Interaction crash guard.');
    } else {
      console.log('⚠️ Could not find Client anchor for guard.');
    }
  } else {
    console.log('✅ Unknown Interaction guard already exists.');
  }

  s = s.replace("client.once('ready'", "client.once('clientReady'");

  fs.writeFileSync(indexPath, s, 'utf8');
  console.log('✅ index.js ready warning patched if present.');
}

console.log('');
console.log('Next commands:');
console.log('GUILD_ID=1039274134296862801 npm run commands:deploy');
console.log('npm start');
console.log('');
console.log('Render dashboard Start Command should be changed to:');
console.log('npm start');
console.log('or leave it as npm run commands:deploy && node src/index.js now that commands:deploy is clean.');
