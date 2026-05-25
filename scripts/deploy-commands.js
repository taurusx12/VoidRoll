require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const commands = [
  new SlashCommandBuilder()
    .setName('admin-reset-all')
    .setDescription('Admin: reset all players, cards, progress and resources')
    .addStringOption(o =>
      o.setName('confirm')
        .setDescription('Type YES to confirm')
        .setRequired(true)
        .addChoices({ name: 'YES', value: 'YES' })
    ),
  new SlashCommandBuilder().setName('rates').setDescription('Show normal roll rates'),

  new SlashCommandBuilder()
    .setName('ascend')
    .setDescription('Ascend by name using duplicate + Gold only')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stars')
    .setDescription('Show stars and next ascend Gold cost')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('pvp')
    .setDescription('Fight another player using your strongest characters')
    .addUserOption(o => o.setName('opponent').setDescription('Player to fight').setRequired(true)),
  new SlashCommandBuilder()
    .setName('admin-fix-all-for-one')
    .setDescription('Admin: set All For One to Mythic and fix his passive'),
  new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Open shop to buy normal rolls with Gold'),

  new SlashCommandBuilder()
    .setName('buy-rolls')
    .setDescription('Buy normal rolls using Gold')
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('How many normal rolls to buy')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),
  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Show your inventory strongest to weakest')
    .addIntegerOption(o => o.setName('page').setDescription('Start page').setRequired(false)),

  new SlashCommandBuilder()
    .setName('view-inventory')
    .setDescription('View another player inventory strongest to weakest')
    .addUserOption(o => o.setName('user').setDescription('Player').setRequired(true))
    .addIntegerOption(o => o.setName('page').setDescription('Start page').setRequired(false)),
  new SlashCommandBuilder()
    .setName('ready-ascend')
    .setDescription('Show characters that are ready to ascend with pages')
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false)),
  new SlashCommandBuilder()
    .setName('top-characters')
    .setDescription('Show all database characters by rarity and power')
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('Filter by rarity')
        .setRequired(false)
        .addChoices(
          { name: 'All', value: 'ALL' },
          { name: 'Secret', value: 'SECRET' },
          { name: 'Divine', value: 'DIVINE' },
          { name: 'Mythic', value: 'MYTHIC' },
          { name: 'Legendary', value: 'LEGENDARY' },
          { name: 'Epic', value: 'EPIC' },
          { name: 'Rare', value: 'RARE' },
          { name: 'Common', value: 'COMMON' }
        )
    )
    .addIntegerOption(o => o.setName('page').setDescription('Start page').setRequired(false)),
  new SlashCommandBuilder()
    .setName('train')
    .setDescription('Train a character by name one level using Gold')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('auto-train')
    .setDescription('Auto train a character until Gold runs out')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('train-info')
    .setDescription('Show train cost by character name')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),
  new SlashCommandBuilder()
    .setName('banner')
    .setDescription('Show current SECRET banner'),

  new SlashCommandBuilder()
    .setName('pack')
    .setDescription('Open 10-pull rate-up pack using Tokens')
    .addStringOption(o =>
      o.setName('banner')
        .setDescription('Choose exact featured character')
        .setRequired(true)
        .setAutocomplete(true)
    ),
  new SlashCommandBuilder()
    .setName('formation')
    .setDescription('Show synced formation power from inventory')
    .addUserOption(o => o.setName('user').setDescription('Optional player').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formation-refresh')
    .setDescription('Refresh formation power from inventory')
    .addUserOption(o => o.setName('user').setDescription('Optional player').setRequired(false)),
  new SlashCommandBuilder()
    .setName('formations')
    .setDescription('Show 6 synced formations from inventory power')
    .addUserOption(o => o.setName('user').setDescription('Optional player').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formation-list')
    .setDescription('Show synced formation list from inventory power')
    .addUserOption(o => o.setName('user').setDescription('Optional player').setRequired(false)),
  new SlashCommandBuilder()
    .setName('give-character')
    .setDescription('Give one character from your inventory to another player')
    .addUserOption(o => o.setName('user').setDescription('Player who receives the character').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Character name from your inventory').setRequired(true)),

  new SlashCommandBuilder()
    .setName('gift-character')
    .setDescription('Gift one character from your inventory to another player')
    .addUserOption(o => o.setName('user').setDescription('Player who receives the character').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Character name from your inventory').setRequired(true)),
  new SlashCommandBuilder()
    .setName('trade-offer')
    .setDescription('Offer a character to another player for Tokens')
    .addUserOption(o => o.setName('user').setDescription('Buyer').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('Character name from your inventory').setRequired(true))
    .addIntegerOption(o => o.setName('tokens').setDescription('Token price').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('trade-accept')
    .setDescription('Accept a pending trade')
    .addStringOption(o => o.setName('trade_id').setDescription('Trade ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('trade-decline')
    .setDescription('Decline a pending trade')
    .addStringOption(o => o.setName('trade_id').setDescription('Trade ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('trade-cancel')
    .setDescription('Cancel a pending trade')
    .addStringOption(o => o.setName('trade_id').setDescription('Trade ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('trades')
    .setDescription('Show your pending trades'),
  new SlashCommandBuilder().setName('characters-count').setDescription('Show active character count'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('level').setDescription('Show your level and XP'),
  new SlashCommandBuilder().setName('help').setDescription('Show help'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Normal roll rates only, Divine 0.1%, Secret 0.00001%')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

  new SlashCommandBuilder()
    .setName('r')
    .setDescription('Quick normal rates only, Divine 0.1%, Secret 0.00001%')
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
    .setDescription('Show character passive, stars and team-ups')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inv-search')
    .setDescription('Search inventory with passive, stars and team-ups')
    .addStringOption(o => o.setName('name').setDescription('Owned character name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('quick-sell')
    .setDescription('Quick sell unequipped characters by rarity')
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('Choose rarity to sell')
        .setRequired(true)
        .addChoices(
          { name: 'Common', value: 'COMMON' },
          { name: 'Rare', value: 'RARE' },
          { name: 'Epic', value: 'EPIC' },
          { name: 'Legendary', value: 'LEGENDARY' },
          { name: 'Mythic', value: 'MYTHIC' },
          { name: 'Divine', value: 'DIVINE' },
          { name: 'Secret', value: 'SECRET' }
        )
    )
    .addStringOption(o =>
      o.setName('confirm')
        .setDescription('Choose YES to confirm')
        .setRequired(false)
        .addChoices({ name: 'YES', value: 'YES' })
    ),

  new SlashCommandBuilder()
    .setName('autoteam')
    .setDescription('Automatically equip strongest formations')
    .addIntegerOption(o => o.setName('formations').setDescription('Formations 1-6').setRequired(false)),

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

  new SlashCommandBuilder().setName('equipment').setDescription('Show equipment'),

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

  new SlashCommandBuilder()
    .setName('admin-dedupe-characters')
    .setDescription('Admin: keep one MAL version per character and disable duplicate forms')
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

  const body = commands
    .filter(cmd => cmd && typeof cmd.toJSON === 'function')
    .map(cmd => cmd.toJSON())
    .filter(cmd => cmd && cmd.name && cmd.description);

  const seen = new Set();
  for (const cmd of body) {
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
