// VoidRoll Reborn - Phase 40C Fix Hunt Buttons Stuck Thinking
// Fix: Hunt buttons use update() instead of reply(), so Discord stops "thinking".
// Run:
//   node scripts/phase40c-fix-hunt-buttons.js
//   node --check src/systems/huntZoneSystem.js
//   npm start

const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'systems', 'huntZoneSystem.js');

if (!fs.existsSync(file)) {
  console.error('❌ src/systems/huntZoneSystem.js not found');
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');
const backup = path.join(process.cwd(), 'src', 'systems', `huntZoneSystem.backup-phase40c-buttons-${Date.now()}.js`);
fs.copyFileSync(file, backup);

if (!s.includes('PHASE40C_RESPOND_HELPER')) {
  const helper = `
async function respond(interaction, payload) {
  const data = typeof payload === 'string'
    ? { content: payload, embeds: [], components: [] }
    : payload;

  if (interaction.isButton?.()) {
    if (data?.ephemeral) {
      return interaction.reply(data).catch(async () => {
        return interaction.followUp?.(data).catch(() => {});
      });
    }

    const updatePayload = {
      content: data.content ?? undefined,
      embeds: data.embeds ?? [],
      components: data.components ?? []
    };

    return interaction.update(updatePayload).catch(async (err) => {
      console.error('Hunt button update failed:', err?.message || err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply(data).catch(() => {});
      }
    });
  }

  return interaction.reply(data);
}
// PHASE40C_RESPOND_HELPER
`;

  const anchor = "function listEmbed(){";
  if (s.includes(anchor)) {
    s = s.replace(anchor, helper + "\n" + anchor);
  } else {
    const anchor2 = "async function handleHuntCommand";
    s = s.replace(anchor2, helper + "\n" + anchor2);
  }
  console.log('✅ Added respond() helper');
} else {
  console.log('✅ respond() helper already exists');
}

if (!s.includes('PHASE40C_REPLIES_PATCHED')) {
  s = s.replace(/\bi\.reply\(/g, 'respond(i,');
  s = s.replace('// PHASE40C_RESPOND_HELPER', '// PHASE40C_RESPOND_HELPER\n// PHASE40C_REPLIES_PATCHED');
  console.log('✅ Replaced i.reply(...) with respond(i, ...) in Hunt system');
} else {
  console.log('✅ Replies already patched');
}

if (!s.includes('PHASE40C_BUTTON_FINAL_CLEAR')) {
  s = '// PHASE40C_BUTTON_FINAL_CLEAR\n' + s;
}

fs.writeFileSync(file, s, 'utf8');

console.log('');
console.log('✅ Phase 40C applied.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);
console.log('');
console.log('Run now:');
console.log('node --check src/systems/huntZoneSystem.js');
console.log('npm start');
