require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const commands = [
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a character or item')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('character/item')
        .setRequired(false)
        .addChoices(
          { name: 'Character', value: 'character' },
          { name: 'Item', value: 'item' }
        )
    ),

  new SlashCommandBuilder().setName('r').setDescription('Quick character roll'),
  new SlashCommandBuilder().setName('i').setDescription('Quick item roll'),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for a character by name, anime, or one letter')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Character/anime name or letter')
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName('secrets').setDescription('Show all SECRET characters'),
  new SlashCommandBuilder().setName('rarity').setDescription('Show normal roll rarity rates'),
  new SlashCommandBuilder().setName('autoteam').setDescription('Automatically equip strongest 5 cards'),

  new SlashCommandBuilder().setName('inventory').setDescription('Show your card inventory with images'),
  new SlashCommandBuilder().setName('equipment').setDescription('Show your item inventory'),

  new SlashCommandBuilder().setName('shop').setDescription('Show official packs and events'),

  new SlashCommandBuilder()
    .setName('pack')
    .setDescription('Open an official anime pack')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('pack type')
        .setRequired(true)
        .addChoices(
          { name: 'Jujutsu Pack', value: 'jjk' },
          { name: 'Demon Slayer Pack', value: 'demon' },
          { name: 'Naruto Pack', value: 'naruto' },
          { name: 'One Piece Pack', value: 'onepiece' },
          { name: 'Bleach Pack', value: 'bleach' },
          { name: 'My Hero Pack', value: 'mha' },
          { name: 'Hunter x Hunter Pack', value: 'hxh' },
          { name: 'Dragon Ball Pack', value: 'dbz' },
          { name: 'Attack on Titan Pack', value: 'aot' },
          { name: 'Villains Pack', value: 'villains' },
          { name: 'Secret Pack', value: 'secret' },
          { name: 'Event Pack', value: 'event' }
        )
    ),

  new SlashCommandBuilder().setName('events').setDescription('Show active events'),
  new SlashCommandBuilder().setName('transfer').setDescription('Show transfer market listings'),
  new SlashCommandBuilder().setName('market').setDescription('Show transfer market listings'),

  new SlashCommandBuilder()
    .setName('list')
    .setDescription('List a card on Transfer Market')
    .addStringOption(o =>
      o.setName('card_id')
        .setDescription('Card ID')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('price')
        .setDescription('Gold price')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell a card')
    .addStringOption(o =>
      o.setName('card_id')
        .setDescription('Card ID')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('price')
        .setDescription('Gold price')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy a transfer listing')
    .addStringOption(o =>
      o.setName('listing_id')
        .setDescription('Listing ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade equipment')
    .addStringOption(o =>
      o.setName('equipment_id')
        .setDescription('Equipment ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sacrifice')
    .setDescription('Sacrifice a card to power up another card')
    .addStringOption(o =>
      o.setName('main_card')
        .setDescription('Main card ID')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('sacrifice_card')
        .setDescription('Card to sacrifice')
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName('quests').setDescription('Show quests'),


  new SlashCommandBuilder()
    .setName('story')
    .setDescription('Story mode progress')
    .addStringOption(o =>
      o.setName('action')
        .setDescription('info/start')
        .setRequired(false)
        .addChoices(
          { name: 'Info', value: 'info' },
          { name: 'Start', value: 'start' }
        )
    ),


  new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Dungeon progress')
    .addStringOption(o =>
      o.setName('action')
        .setDescription('info/start')
        .setRequired(false)
        .addChoices(
          { name: 'Info', value: 'info' },
          { name: 'Start', value: 'start' }
        )
    ),


  new SlashCommandBuilder()
    .setName('tower')
    .setDescription('Tower progress')
    .addStringOption(o =>
      o.setName('action')
        .setDescription('info/start')
        .setRequired(false)
        .addChoices(
          { name: 'Info', value: 'info' },
          { name: 'Start', value: 'start' }
        )
    ),


  new SlashCommandBuilder()
    .setName('admin-spawn-boss')
    .setDescription('Admin: spawn a boss event in a selected channel')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to send boss event')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('admin-give-rolls')
    .setDescription('Admin: give rolls to a player')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Player')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Roll amount')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('admin-give-equipment')
    .setDescription('Admin: give test equipment')
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('COMMON/RARE/EPIC/LEGENDARY/MYTHIC/DIVINE/SECRET')
    )
].map(c => c.toJSON());

(async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);

  if (config.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
  } else {
    await rest.put(
      Routes.applicationCommands(config.clientId),
      { body: commands }
    );
  }

  console.log('Commands deployed');
})();
