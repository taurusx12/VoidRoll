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
    .addStringOption(o => o.setName('type').setDescription('character/item').setRequired(false)
      .addChoices({ name:'Character', value:'character' }, { name:'Item', value:'item' })),
  new SlashCommandBuilder().setName('inventory').setDescription('Show your card inventory'),
  new SlashCommandBuilder().setName('equipment').setDescription('Show your item inventory'),
  new SlashCommandBuilder()
    .setName('equip')
    .setDescription('Equip an item to a character card')
    .addStringOption(o => o.setName('item_id').setDescription('Item ID').setRequired(true))
    .addStringOption(o => o.setName('card_id').setDescription('Card ID').setRequired(true)),
  new SlashCommandBuilder().setName('shop').setDescription('Show official packs and events'),
  new SlashCommandBuilder().setName('events').setDescription('Show active events'),
  new SlashCommandBuilder().setName('transfer').setDescription('Show transfer market listings'),
  new SlashCommandBuilder().setName('market').setDescription('Show transfer market listings'),
  new SlashCommandBuilder().setName('list').setDescription('List a card on Transfer Market')
    .addStringOption(o=>o.setName('card_id').setDescription('Card ID').setRequired(true))
    .addIntegerOption(o=>o.setName('price').setDescription('Gold price').setRequired(true)),
  new SlashCommandBuilder().setName('sell').setDescription('Sell a card')
    .addStringOption(o=>o.setName('card_id').setDescription('Card ID').setRequired(true))
    .addIntegerOption(o=>o.setName('price').setDescription('Gold price').setRequired(true)),
  new SlashCommandBuilder().setName('buy').setDescription('Buy a transfer listing')
    .addStringOption(o=>o.setName('listing_id').setDescription('Listing ID').setRequired(true)),
  new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade equipment')
    .addStringOption(o=>o.setName('equipment_id').setDescription('Equipment ID').setRequired(true)),
  new SlashCommandBuilder().setName('sacrifice').setDescription('Sacrifice a card to power up another card')
    .addStringOption(o=>o.setName('main_card').setDescription('Main card ID').setRequired(true))
    .addStringOption(o=>o.setName('sacrifice_card').setDescription('Card to sacrifice').setRequired(true)),
  new SlashCommandBuilder().setName('quests').setDescription('Show quests'),
  new SlashCommandBuilder().setName('bosses').setDescription('Show active bosses'),
  new SlashCommandBuilder().setName('limited-boss').setDescription('Fight the limited boss'),
  new SlashCommandBuilder().setName('dungeon').setDescription('Show or start your dungeon progress')
    .addStringOption(o => o.setName('action').setDescription('info/start').setRequired(false)
      .addChoices({ name:'Info', value:'info' }, { name:'Start', value:'start' })),
  new SlashCommandBuilder().setName('tower').setDescription('Show or start your tower progress')
    .addStringOption(o => o.setName('action').setDescription('info/start').setRequired(false)
      .addChoices({ name:'Info', value:'info' }, { name:'Start', value:'start' })),
  new SlashCommandBuilder().setName('story').setDescription('Show or start your story progress')
    .addStringOption(o => o.setName('action').setDescription('info/start').setRequired(false)
      .addChoices({ name:'Info', value:'info' }, { name:'Start', value:'start' })),
  new SlashCommandBuilder().setName('admin-give-equipment').setDescription('Admin: give test equipment')
    .addStringOption(o=>o.setName('rarity').setDescription('COMMON/RARE/EPIC/LEGENDARY/MYTHIC/DIVINE/SECRET'))
].map(c => c.toJSON());

(async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  if (config.guildId) await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  else await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log('Commands deployed');
})();
