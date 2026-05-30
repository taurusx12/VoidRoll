// VoidRoll Reborn - Fix Deploy Command Required Option Order
// Run: node scripts/fix-deploy-command-options.js

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'scripts', 'deploy-commands-voidroll-reborn.js');

if (!fs.existsSync(filePath)) {
  console.error('❌ scripts/deploy-commands-voidroll-reborn.js not found.');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

const before = "new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade character tree branch').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)).addStringOption(o => o.setName('branch').setDescription('Branch').setRequired(true).addChoices(...branchChoices))";

const after = "new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade character tree branch').addStringOption(o => o.setName('branch').setDescription('Branch').setRequired(true).addChoices(...branchChoices)).addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false))";

if (content.includes(before)) {
  content = content.replace(before, after);
} else {
  content = content.replace(
    /new SlashCommandBuilder\(\)\.setName\('upgrade'\)\.setDescription\('Upgrade character tree branch'\)\.addStringOption\(o => o\.setName\('card'\)\.setDescription\('Owned card'\)\.setRequired\(false\)\)\.addStringOption\(o => o\.setName\('branch'\)\.setDescription\('Branch'\)\.setRequired\(true\)\.addChoices\(\.\.\.branchChoices\)\)/,
    after
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed /upgrade option order in deploy-commands-voidroll-reborn.js');
console.log('Now run: node scripts/deploy-commands-voidroll-reborn.js');
