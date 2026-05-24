require('dotenv').config();

const { REST, Routes, SlashCommandBuilder, ChannelType } = require('discord.js');
const config = require('../src/lib/config');

const commands = [

  new SlashCommandBuilder().setName('bot-check').setDescription('Check if VoidRoll is responding'),
  new SlashCommandBuilder().setName('characters-count').setDescription('Show active character count'),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search characters')
    .addStringOption(o => o.setName('name').setDescription('Character or anime name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('inv-search')
    .setDescription('Search your inventory with full stats')
    .addStringOption(o => o.setName('name').setDescription('Character or anime name').setRequired(true)),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show character stats, passive and team-up buffs')
    .addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder().setName('team-buffs').setDescription('Show active Formation 1 team-up buffs'),

  new SlashCommandBuilder()
    .setName('autoteam')
    .setDescription('Auto equip strongest characters into formations')
    .addIntegerOption(o => o.setName('formations').setDescription('Formations 1-6').setRequired(false)),

  new SlashCommandBuilder()
    .setName('formations')
    .setDescription('Show formations')
    .addIntegerOption(o => o.setName('count').setDescription('How many formations to show 1-6').setRequired(false)),

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

  new SlashCommandBuilder().setName('story').setDescription('Play story battle'),
  new SlashCommandBuilder().setName('tower').setDescription('Play tower battle'),
  new SlashCommandBuilder().setName('dungeon').setDescription('Play dungeon battle'),

  new SlashCommandBuilder()
    .setName('auto-story')
    .setDescription('Auto play story')
    .addIntegerOption(o => o.setName('runs').setDescription('Max runs 1-30').setRequired(false)),

  new SlashCommandBuilder()
    .setName('auto-tower')
    .setDescription('Auto play tower')
    .addIntegerOption(o => o.setName('runs').setDescription('Max runs 1-30').setRequired(false)),

  new SlashCommandBuilder()
    .setName('auto-dungeon')
    .setDescription('Auto play dungeon')
    .addIntegerOption(o => o.setName('runs').setDescription('Max runs 1-30').setRequired(false)),

  new SlashCommandBuilder().setName('boss-rush').setDescription('Solo Boss Rush'),
  new SlashCommandBuilder().setName('coop-boss-rush').setDescription('Co-op Boss Rush style'),
  new SlashCommandBuilder().setName('admin-mal-stability').setDescription('Admin: keep MAL only, rebalance rarity, stats and images'),

  new SlashCommandBuilder().setName('story-start').setDescription('Start story battle'),
  new SlashCommandBuilder().setName('tower-start').setDescription('Start tower battle'),
  new SlashCommandBuilder().setName('dungeon-start').setDescription('Start dungeon battle'),
  new SlashCommandBuilder().setName('admin-final-balance').setDescription('Admin: rebalance all character powers and owned cards').addStringOption(o => o.setName('confirm').setDescription('Type YES').setRequired(true)),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('level').setDescription('Show your level, XP, and next reward'),
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

  new SlashCommandBuilder().setName('secrets').setDescription('Show all SECRET characters'),
  new SlashCommandBuilder().setName('admin-fix-variants').setDescription('Admin: fix important duplicated variants'),
  new SlashCommandBuilder().setName('admin-fix-elements').setDescription('Admin: clean wrong character elements'),
  new SlashCommandBuilder().setName('admin-fix-saber-image').setDescription('Admin: force correct female Saber image'),
  new SlashCommandBuilder().setName('admin-collapse-variants').setDescription('Admin: keep one best version per important character and restore images'),

  new SlashCommandBuilder().setName('rarity').setDescription('Show normal roll rarity rates'),

  new SlashCommandBuilder().setName('inventory').setDescription('Show your card inventory with images'),
  new SlashCommandBuilder().setName('equipment').setDescription('Show your item inventory'),

  new SlashCommandBuilder().setName('shop').setDescription('Show active limited banners'),
  new SlashCommandBuilder().setName('banner').setDescription('Show active limited banners'),

  new SlashCommandBuilder()
    .setName('pack')
    .setDescription('10-pull from selected active limited banner (1000 tokens)')
    .addStringOption(o =>
      o.setName('banner')
        .setDescription('Banner id from /banner')
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName('events').setDescription('Show active events'),

  new SlashCommandBuilder().setName('farm-claim').setDescription('Claim passive farm rewards'),
  new SlashCommandBuilder().setName('gold-shop').setDescription('Spend gold on rolls, cores, and training info'),

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
          { name: 'Legendary cores - 300,000 Gold', value: 'legendary_orb' },
          { name: 'Mythic cores - 900,000 Gold', value: 'mythic_orb' },
          { name: 'Divine cores - 2,500,000 Gold', value: 'divine_orb' },
          { name: 'Secret cores - 9,000,000 Gold', value: 'secret_orb' }
        )
    ),

  new SlashCommandBuilder()
    .setName('train')
    .setDescription('Spend gold to increase a card power')
    .addStringOption(o =>
      o.setName('card_id')
        .setDescription('Card ID')
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName('cores-shop').setDescription('Show guaranteed cores market'),

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
    .setName('admin-repair-rewards')
    .setDescription('Admin: send repair compensation to all users')
    .addIntegerOption(o =>
      o.setName('gold')
        .setDescription('Gold amount per user')
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('tokens')
        .setDescription('Tokens amount per user')
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('rolls')
        .setDescription('Rolls amount per user')
        .setRequired(false)
    ),



  new SlashCommandBuilder()
    .setName('lvl')
    .setDescription('Level up a character by name to max 99')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Character name')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Levels to add')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('t')
    .setDescription('Train a character by name using gold')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Character name')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Training amount 1-100')
        .setRequired(false)
    ),


  new SlashCommandBuilder()
    .setName('a')
    .setDescription('Ascend a character by name')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Character name')
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
    .setName('sell-rarity')
    .setDescription('Sell all cards of a rarity')
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('Rarity to sell')
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
    ),


  new SlashCommandBuilder()
    .setName('admin-give-gold')
    .setDescription('Admin: give gold to a player')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Player')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Gold amount')
        .setRequired(true)
    ),


  new SlashCommandBuilder()
    .setName('admin-give-tokens')
    .setDescription('Admin: give tokens to a player')
    .addUserOption(o =>
      o.setName('user')
        .setDescription('Player')
        .setRequired(true)
    )
    .addIntegerOption(o =>
      o.setName('amount')
        .setDescription('Token amount')
        .setRequired(true)
    ),


  new SlashCommandBuilder()
    .setName('fuse-list')
    .setDescription('Show duplicate characters ready to fuse'),

  new SlashCommandBuilder()
    .setName('fuse')
    .setDescription('Fuse duplicate characters by name')
    .addStringOption(o =>
      o.setName('name')
        .setDescription('Character name')
        .setRequired(true)
    ),


  new SlashCommandBuilder()
    .setName('admin-reset-all')
    .setDescription('Admin: reset all players')
    .addStringOption(o =>
      o.setName('confirm')
        .setDescription('Type YES')
        .setRequired(true)
    ),


  new SlashCommandBuilder()
    .setName('class-tower')
    .setDescription('Play an element/class tower')
    .addStringOption(o =>
      o.setName('element')
        .setDescription('Element tower')
        .setRequired(true)
        .addChoices(
          { name: 'Dark', value: 'Dark' },
          { name: 'Light', value: 'Light' },
          { name: 'Fire', value: 'Fire' },
          { name: 'Ice', value: 'Ice' },
          { name: 'Shadow', value: 'Shadow' },
          { name: 'Curse', value: 'Curse' },
          { name: 'Void', value: 'Void' },
          { name: 'Lightning', value: 'Lightning' }
        )
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
