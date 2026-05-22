require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
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

  new SlashCommandBuilder()
    .setName('r')
    .setDescription('Quick character roll')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),
  new SlashCommandBuilder()
    .setName('i')
    .setDescription('Quick item roll')
    .addIntegerOption(o => o.setName('amount').setDescription('Roll amount 1-10').setRequired(false)),

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

  new SlashCommandBuilder().setName('farm-claim').setDescription('Claim passive farm rewards'),
  new SlashCommandBuilder().setName('gold-shop').setDescription('Spend gold on rolls, orbs, and training info'),

  new SlashCommandBuilder()
    .setName('gold-buy')
    .setDescription('Buy an item from the gold shop')
    .addStringOption(o =>
      o.setName('item')
        .setDescription('gold shop item')
        .setRequired(true)
        .addChoices(
          { name: '5 Rolls - 6,000 Gold', value: 'rolls_5' },
          { name: '10 Rolls - 10,000 Gold', value: 'rolls_10' },
          { name: '25 Rolls - 22,000 Gold', value: 'rolls_25' },
          { name: '1 Token - 10,000 Gold', value: 'token_1' },
          { name: 'Legendary Orb - 300,000 Gold', value: 'legendary_orb' },
          { name: 'Mythic Orb - 900,000 Gold', value: 'mythic_orb' },
          { name: 'Divine Orb - 2,500,000 Gold', value: 'divine_orb' },
          { name: 'Secret Orb - 9,000,000 Gold', value: 'secret_orb' }
        )
    ),

  new SlashCommandBuilder()
    .setName('train')
    .setDescription('Spend gold to increase a card power')
    .addStringOption(o =>
      o.setName('card_id')
        .setDescription('Card ID')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Training amount 1-100')
        .setRequired(false)
    ),

  new SlashCommandBuilder().setName('orb-shop').setDescription('Show guaranteed orb market'),

  new SlashCommandBuilder()
    .setName('orb-roll')
    .setDescription('Use tokens for guaranteed rarity character')
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('legendary/mythic/divine/secret')
        .setRequired(true)
        .addChoices(
          { name: 'Legendary - 100 tokens', value: 'legendary' },
          { name: 'Mythic - 250 tokens', value: 'mythic' },
          { name: 'Divine - 350 tokens', value: 'divine' },
          { name: 'Secret - 500 tokens', value: 'secret' }
        )
    ),

  new SlashCommandBuilder()
    .setName('ascend')
    .setDescription('Upgrade a character rarity and power using gold/tokens')
    .addStringOption(o =>
      o.setName('card_id')
        .setDescription('Card ID')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('Target rarity')
        .setRequired(true)
        .addChoices(
          { name: 'Rare', value: 'RARE' },
          { name: 'Epic', value: 'EPIC' },
          { name: 'Legendary', value: 'LEGENDARY' },
          { name: 'Mythic', value: 'MYTHIC' },
          { name: 'Divine', value: 'DIVINE' },
          { name: 'Secret', value: 'SECRET' }
        )
    ),


  new SlashCommandBuilder()
    .setName('inv-search')
    .setDescription('Search your own inventory')
    .addStringOption(o => o.setName('name').setDescription('Character/anime name or letter').setRequired(true)),


  new SlashCommandBuilder()
    .setName('pvp')
    .setDescription('Battle another player for PVP rank')
    .addUserOption(o => o.setName('user').setDescription('Player to battle').setRequired(true)),

  new SlashCommandBuilder()
    .setName('trade')
    .setDescription('Offer a card trade to another player')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Player you want to trade with')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('my_card')
        .setDescription('Your card ID')
        .setRequired(true)
    )
    .addStringOption(o =>
      o.setName('their_card')
        .setDescription('Their card ID')
        .setRequired(true)
    ),

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

  new SlashCommandBuilder().setName('quests').setDescription('Show quests'),

  new SlashCommandBuilder()
    .setName('admin-spawn-boss')
    .setDescription('Admin: spawn a boss event in a selected channel')
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to send boss event')
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
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
