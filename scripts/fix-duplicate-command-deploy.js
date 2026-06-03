// VoidRoll Reborn — Fix duplicate slash command names in phase27 deploy
// Fixes: APPLICATION_COMMANDS_DUPLICATE_NAME
// Run:
//   node scripts/fix-duplicate-command-deploy.js
//   node --check scripts/phase27-fast-guild-deploy.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   npm start

const fs = require('fs');
const path = require('path');

const deployPath = path.join(process.cwd(), 'scripts', 'phase27-fast-guild-deploy.js');

if (!fs.existsSync(deployPath)) {
  console.error('❌ scripts/phase27-fast-guild-deploy.js not found');
  process.exit(1);
}

let s = fs.readFileSync(deployPath, 'utf8');
const backup = path.join(process.cwd(), 'scripts', `phase27-fast-guild-deploy.backup-dedupe-${Date.now()}.js`);
fs.copyFileSync(deployPath, backup);

// Make commands re-assignable if needed.
s = s.replace(/const\s+commands\s*=\s*\[/, 'let commands = [');

if (!s.includes('FULL_LAUNCH_DEDUPE_COMMAND_NAMES')) {
  const start = s.indexOf('let commands = [');
  if (start === -1) {
    console.error('❌ Could not find commands array.');
    console.log('Backup:', path.relative(process.cwd(), backup));
    process.exit(1);
  }

  const bracketStart = s.indexOf('[', start);
  let depth = 0;
  let quote = null;
  let esc = false;
  let end = -1;

  for (let i = bracketStart; i < s.length; i++) {
    const ch = s[i];

    if (quote) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    console.error('❌ Could not find end of commands array.');
    console.log('Backup:', path.relative(process.cwd(), backup));
    process.exit(1);
  }

  // Include semicolon if present.
  let insertAt = end + 1;
  if (s[insertAt] === ';') insertAt++;

  const dedupe = `

// FULL_LAUNCH_DEDUPE_COMMAND_NAMES
{
  const seen = new Set();
  const before = commands.length;
  const duplicates = [];

  commands = commands.filter((cmd) => {
    if (!cmd || !cmd.name) return false;
    if (seen.has(cmd.name)) {
      duplicates.push(cmd.name);
      return false;
    }
    seen.add(cmd.name);
    return true;
  });

  if (duplicates.length) {
    console.log('⚠️ Removed duplicate command names:', [...new Set(duplicates)].join(', '));
  }

  console.log(\`✅ Commands deduped: \${before} → \${commands.length}\`);
}
`;

  s = s.slice(0, insertAt) + dedupe + s.slice(insertAt);
  console.log('✅ Added command-name dedupe after commands array');
} else {
  console.log('✅ Command-name dedupe already exists');
}

fs.writeFileSync(deployPath, s, 'utf8');

console.log('');
console.log('✅ Duplicate command deploy fix applied.');
console.log('Backup:', path.relative(process.cwd(), backup));
console.log('');
console.log('Next:');
console.log('node --check scripts/phase27-fast-guild-deploy.js');
console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
console.log('npm start');
