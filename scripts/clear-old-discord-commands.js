// VoidRoll Reborn - Clear Old Discord Commands
// Run only if old commands still appear in Discord after global deploy.
// Requires BOT_TOKEN/DISCORD_TOKEN and CLIENT_ID/APPLICATION_ID.
// Optional GUILD_ID clears guild commands too.

require('dotenv').config();
const { REST, Routes } = require('discord.js');

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID || null;

if (!token || !clientId) {
  console.error('Missing token or client id.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  console.log('Clearing GLOBAL commands...');
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log('✅ Global commands cleared.');

  if (guildId) {
    console.log('Clearing GUILD commands...');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    console.log('✅ Guild commands cleared.');
  } else {
    console.log('No GUILD_ID set. Skipped guild commands.');
  }

  console.log('');
  console.log('Now redeploy clean commands:');
  console.log('node scripts/deploy-commands-voidroll-reborn.js');
})();
