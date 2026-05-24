require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const commands = [
  new SlashCommandBuilder().setName('characters-count').setDescription('Show active character count'),
  new SlashCommandBuilder()
    .setName('formation-set')
    .setDescription('Manually set one formation')
    .addIntegerOption(o => o.setName('formation').setDescription('Formation number 1-6').setRequired(true))
    .addStringOption(o => o.setName('slot1').setDescription('Character 1').setRequired(true))
    .addStringOption(o => o.setName('slot2').setDescription('Character 2').setRequired(false))
    .addStringOption(o => o.setName('slot3').setDescription('Character 3').setRequired(false))
    .addStringOption(o => o.setName('slot4').setDescription('Character 4').setRequired(false))
    .addStringOption(o => o.setName('slot5').setDescription('Character 5').setRequired(false))
    .addStringOption(o => o.setName('slot6').setDescription('Character 6').setRequired(false)),
  new SlashCommandBuilder()
    .setName('train')
    .setDescription('Train a character using Gold')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),
  new SlashCommandBuilder()
    .setName('ascend')
    .setDescription('Ascend a character using a duplicate')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('level').setDescription('Show your level and XP'),
  new SlashCommandBuilder().setName('help').setDescription('Show help'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a character')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

  new SlashCommandBuilder()
    .setName('r')
    .setDescription('Quick roll')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

  new SlashCommandBuilder()
    .setName('i')
    .setDescription('Quick item roll')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search characters')
    .addStringOption(o => o.setName('name').setDescription('Character or anime name').setRequired(true)),

  new SlashCommandBuilder().setName('secrets').setDescription('Show SECRET characters'),
  new SlashCommandBuilder().setName('rarity').setDescription('Show rarity rates'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show character stats')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inv-search')
    .setDescription('Search your inventory with stats')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('autoteam')
    .setDescription('Automatically equip strongest formations')
    .addIntegerOption(o => o.setName('formations').setDescription('Formations 1-6').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formations')
    .setDescription('Show formations')
    .addIntegerOption(o => o.setName('count').setDescription('Formations 1-6').setRequired(false)),

  new SlashCommandBuilder().setName('inventory').setDescription('Show inventory'),
  new SlashCommandBuilder().setName('equipment').setDescription('Show equipment'),
  new SlashCommandBuilder().setName('shop').setDescription('Show shop'),
  new SlashCommandBuilder().setName('banner').setDescription('Show banners'),

  new SlashCommandBuilder()
    .setName('pack')
    .setDescription('10-pull character pack'),

  new SlashCommandBuilder().setName('story').setDescription('Play story battle'),
  new SlashCommandBuilder().setName('tower').setDescription('Play tower battle'),
  new SlashCommandBuilder().setName('dungeon').setDescription('Play dungeon battle'),

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

  new SlashCommandBuilder().setName('boss-rush').setDescription('Solo Boss Rush'),
  new SlashCommandBuilder().setName('coop-boss-rush').setDescription('Co-op Boss Rush'),

  new SlashCommandBuilder().setName('pvp').setDescription('PvP battle'),
  new SlashCommandBuilder().setName('quests').setDescription('Show quests'),

  new SlashCommandBuilder()
    .setName('sell-rarity')
    .setDescription('Sell cards by rarity')
    .addStringOption(o => o.setName('rarity').setDescription('COMMON/RARE/EPIC/LEGENDARY/MYTHIC/DIVINE/SECRET').setRequired(true)),

  new SlashCommandBuilder()
    .setName('fuse')
    .setDescription('Fuse duplicate characters by name')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder().setName('fuse-list').setDescription('Show duplicate characters available to fuse'),

  new SlashCommandBuilder()
    .setName('admin-reset-all')
    .setDescription('Admin: reset all players')
    .addStringOption(o => o.setName('confirm').setDescription('Type YES').setRequired(true)),

  new SlashCommandBuilder()
    .setName('admin-give-rolls')
    .setDescription('Admin: give rolls')
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('admin-give-gold')
    .setDescription('Admin: give gold')
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Gold amount').setRequired(true)),

  new SlashCommandBuilder()
    .setName('admin-give-tokens')
    .setDescription('Admin: give tokens')
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Token amount').setRequired(true))
];

async function main() {
  const token = config.discordToken || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  const clientId = config.clientId || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
  const guildId = config.guildId || process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;

  if (!token || !clientId) {
    console.error('Missing Discord token or client ID.');
    process.exit(1);
  }

  const body = commands.map(c => c.toJSON());
  const seen = new Set();

  for (const cmd of body) {
    if (!cmd.name || !cmd.description) {
      console.error('Invalid command:', cmd);
      process.exit(1);
    }
    if (seen.has(cmd.name)) {
      console.error('Duplicate command:', cmd.name);
      process.exit(1);
    }
    seen.add(cmd.name);
  }

  console.log('Deploying commands:', [...seen].join(', '));

  const rest = new REST({ version: '10' }).setToken(token);
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
