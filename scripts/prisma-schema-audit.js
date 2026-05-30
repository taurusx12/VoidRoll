// VoidRoll Reborn - Prisma Schema Audit
// Run: node scripts/prisma-schema-audit.js
// This checks whether your prisma/schema.prisma contains the new required models/fields.

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  console.error('❌ prisma/schema.prisma not found.');
  process.exit(1);
}

const schema = fs.readFileSync(schemaPath, 'utf8');

const requiredModels = [
  'UserResource',
  'Formation',
  'FormationSlot',
  'Pity',
  'MarketPurchase',
  'DungeonRun',
  'RaidBoss',
  'RaidDamageLog',
  'PvpBattleLog'
];

const userFields = [
  'essence',
  'voidCrystals',
  'soulFragments',
  'pvpRating',
  'pvpWins',
  'pvpLosses',
  'pvpWinStreak',
  'chapter',
  'stage'
];

const cardFields = [
  'gearTier',
  'coreTier',
  'skillTier',
  'traitName',
  'traitTier',
  'bondTier',
  'transformationTier',
  'variantTier'
];

function hasModel(name) {
  return new RegExp(`model\\s+${name}\\s+\\{`).test(schema);
}

function hasField(name) {
  return new RegExp(`\\s${name}\\s+`).test(schema);
}

console.log('=== VoidRoll Reborn Prisma Schema Audit ===\n');

console.log('Models:');
for (const model of requiredModels) {
  console.log(`${hasModel(model) ? '✅' : '❌'} ${model}`);
}

console.log('\nUser fields:');
for (const field of userFields) {
  console.log(`${hasField(field) ? '✅' : '❌'} ${field}`);
}

console.log('\nOwned card fields:');
for (const field of cardFields) {
  console.log(`${hasField(field) ? '✅' : '❌'} ${field}`);
}

console.log('\nIf anything is missing, merge prisma/VOIDROLL_REBORN_SCHEMA_PATCH.prisma into prisma/schema.prisma, then run:');
console.log('npx prisma format');
console.log('npx prisma generate');
console.log('npx prisma db push');
