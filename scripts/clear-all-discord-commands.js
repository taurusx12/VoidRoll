// VoidRoll Reborn - Clear ALL Discord Commands
// Clears global commands and guild commands for every guild the bot is in.
// Run:
//   node scripts/clear-all-discord-commands.js

require('dotenv').config();
const { REST, Routes, Client, GatewayIntentBits } = require('discord.js');

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('Missing BOT_TOKEN/DISCORD_TOKEN or CLIENT_ID/APPLICATION_ID/DISCORD_CLIENT_ID');
  process.exit(1);
}

const rest = new REST({ version:'10' }).setToken(token);

async function clearGlobal() {
  console.log('Clearing GLOBAL commands...');
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log('✅ Global commands cleared.');
}

async function clearGuilds() {
  const client = new Client({ intents:[GatewayIntentBits.Guilds] });

  await new Promise((resolve, reject) => {
    client.once('clientReady', async () => {
      try {
        console.log(`Logged in for guild cleanup as ${client.user.tag}`);
        const guilds = [...client.guilds.cache.values()];
        if (!guilds.length) console.log('No guilds found in cache.');

        for (const guild of guilds) {
          console.log(`Clearing guild commands: ${guild.name} (${guild.id})`);
          await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
          console.log(`✅ Cleared ${guild.name}`);
        }

        client.destroy();
        resolve();
      } catch (err) {
        client.destroy();
        reject(err);
      }
    });

    client.login(token).catch(reject);
  });
}

(async () => {
  try {
    await clearGlobal();
    await clearGuilds();
    console.log('');
    console.log('✅ All Discord commands cleared.');
    console.log('Now redeploy clean commands: node scripts/deploy-commands-voidroll-reborn.js');
  } catch (err) {
    console.error('❌ Clear commands failed:', err);
    process.exit(1);
  }
})();
