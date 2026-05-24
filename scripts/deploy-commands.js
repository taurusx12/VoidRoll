require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const commands = [
  new SlashCommandBuilder().setName('bot-check').setDescription('Check if VoidRoll is responding'),
  new SlashCommandBuilder().setName('characters-count').setDescription('Show active character count'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll characters')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

  new SlashCommandBuilder()
    .setName('r')
    .setDescription('Quick roll')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

  new SlashCommandBuilder().setName('inventory').setDescription('Show your top inventory'),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search characters')
    .addStringOption(o => o.setName('name').setDescription('Character or anime name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inv-search')
    .setDescription('Search your inventory with full stats')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show character stats')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder().setName('story-start').setDescription('Start story battle'),
  new SlashCommandBuilder().setName('story').setDescription('Start story battle'),
  new SlashCommandBuilder().setName('tower-start').setDescription('Start tower battle'),
  new SlashCommandBuilder().setName('tower').setDescription('Start tower battle'),
  new SlashCommandBuilder().setName('dungeon-start').setDescription('Start dungeon battle'),
  new SlashCommandBuilder().setName('dungeon').setDescription('Start dungeon battle'),

  new SlashCommandBuilder()
    .setName('auto-story')
    .setDescription('Auto play story')
    .addIntegerOption(o => o.setName('runs').setDescription('Max 30').setRequired(false)),

  new SlashCommandBuilder()
    .setName('auto-tower')
    .setDescription('Auto play tower')
    .addIntegerOption(o => o.setName('runs').setDescription('Max 30').setRequired(false)),

  new SlashCommandBuilder()
    .setName('auto-dungeon')
    .setDescription('Auto play dungeon')
    .addIntegerOption(o => o.setName('runs').setDescription('Max 30').setRequired(false)),

  new SlashCommandBuilder()
    .setName('autoteam')
    .setDescription('Auto equip strongest formations')
    .addIntegerOption(o => o.setName('formations').setDescription('1-6').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formations')
    .setDescription('Show formations')
    .addIntegerOption(o => o.setName('count').setDescription('1-6').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formation-set')
    .setDescription('Manually set a formation')
    .addIntegerOption(o => o.setName('formation').setDescription('Formation number 1-6').setRequired(true))
    .addStringOption(o => o.setName('slot1').setDescription('Character 1').setRequired(true))
    .addStringOption(o => o.setName('slot2').setDescription('Character 2').setRequired(false))
    .addStringOption(o => o.setName('slot3').setDescription('Character 3').setRequired(false))
    .addStringOption(o => o.setName('slot4').setDescription('Character 4').setRequired(false))
    .addStringOption(o => o.setName('slot5').setDescription('Character 5').setRequired(false))
    .addStringOption(o => o.setName('slot6').setDescription('Character 6').setRequired(false)),

  new SlashCommandBuilder().setName('boss-rush').setDescription('Solo Boss Rush'),
  new SlashCommandBuilder().setName('coop-boss-rush').setDescription('Co-op Boss Rush'),

  new SlashCommandBuilder()
    .setName('admin-final-balance')
    .setDescription('Admin: rebalance all active characters and owned cards')
    .addStringOption(o => o.setName('confirm').setDescription('Type YES').setRequired(true))
];

async function main() {
  const token = config.discordToken || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  const clientId = config.clientId || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
  const guildId = config.guildId || process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error('Missing Discord token/clientId. Check env vars.');
    process.exit(1);
  }

  const body = commands
    .filter(Boolean)
    .map(c => c.toJSON())
    .filter(c => c && c.name && c.description);

  const names = body.map(c => c.name);
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) {
    console.error('Duplicate command:', duplicate);
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  console.log('Deploying commands:', names.join(', '));

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
  }

  console.log('Commands deployed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
