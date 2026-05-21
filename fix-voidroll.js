const fs = require('fs');

console.log('Applying VoidRoll hotfixes...');

const target = './src/index.js';

if (!fs.existsSync(target)) {
  console.log('src/index.js not found');
  process.exit(1);
}

let s = fs.readFileSync(target, 'utf8');

// Fix long secret messages
s = s.replace(
/interaction\.reply\(\s*\{\s*content:\s*secretText,/g,
`interaction.reply({
  content: secretText.slice(0, 1900),`
);

// Fix inventory include crash
s = s.replace(
/equipment:\s*\{\s*include:\s*\{\s*template:\s*true\s*\}\s*\},?/g,
''
);

// Add safe search
s = s.replace(
/name:\s*\{\s*contains:\s*query\s*\}/g,
`name: {
  contains: query,
  mode: 'insensitive'
}`
);

fs.writeFileSync(target, s);

console.log('Hotfix applied successfully!');
