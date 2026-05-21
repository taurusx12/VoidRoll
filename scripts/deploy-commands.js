require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show all VoidRoll commands'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),
  new SlashCommandBuilder().setName('roll').setDescription('Roll a random anime card'),
  new SlashCommandBuilder().setName('inventory').setDescription('Show your card inventory with images'),
  new SlashCommandBuilder().setName('team').setDescription('Manage your 5-card team')
    .addStringOption(o => o.setName('action').setDescription('show/set').setRequired(true)
      .addChoices({ name: 'show', value: 'show' }, { name: 'set', value: 'set' }))
    .addIntegerOption(o => o.setName('slot').setDescription('Team slot 1-5'))
    .addStringOption(o => o.setName('card_id').setDescription('Card ID')),
  new SlashCommandBuilder().setName('story').setDescription('Story mode progress')
    .addStringOption(o => o.setName('action').setDescription('status/start').setRequired(false)
      .addChoices({ name: 'status', value: 'status' }, { name: 'start', value: 'start' })),
  new SlashCommandBuilder().setName('dungeon').setDescription('Dungeon progress')
    .addStringOption(o => o.setName('action').setDescription('status/start').setRequired(false)
      .addChoices({ name: 'status', value: 'status' }, { name: 'start', value: 'start' })),
  new SlashCommandBuilder().setName('tower').setDescription('Tower progress')
    .addStringOption(o => o.setName('action').setDescription('status/start').setRequired(false)
      .addChoices({ name: 'status', value: 'status' }, { name: 'start', value: 'start' })),
  new SlashCommandBuilder().setName('shop').setDescription('Show official VoidRoll shop packs'),
  new SlashCommandBuilder().setName('pack').setDescription('Open a pack')
    .addStringOption(o => o.setName('type').setDescription('random/jjk/demon/naruto/onepiece/weapon/event').setRequired(true)),
  new SlashCommandBuilder().setName('events').setDescription('Show active banners and events'),
  new SlashCommandBuilder().setName('boss-event').setDescription('Show current automatic boss event'),
  new SlashCommandBuilder().setName('join-boss').setDescription('Join the current boss event'),
  new SlashCommandBuilder().setName('start-boss').setDescription('Start/resolve the current boss event after join time'),
  new SlashCommandBuilder().setName('transfer').setDescription('Show Transfer Market listings'),
  new SlashCommandBuilder().setName('list').setDescription('List a card on Transfer Market')
    .addStringOption(o => o.setName('card_id').setDescription('Card ID').setRequired(true))
    .addIntegerOption(o => o.setName('price').setDescription('Gold price').setRequired(true)),
  new SlashCommandBuilder().setName('buy').setDescription('Buy a Transfer Market listing')
    .addStringOption(o => o.setName('listing_id').setDescription('Listing ID').setRequired(true)),
  new SlashCommandBuilder().setName('market').setDescription('Alias for Transfer Market'),
  new SlashCommandBuilder().setName('equipment').setDescription('Show your equipment'),
  new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade equipment')
    .addStringOption(o => o.setName('equipment_id').setDescription('Equipment ID').setRequired(true)),
  new SlashCommandBuilder().setName('sacrifice').setDescription('Sacrifice a card to power up another card')
    .addStringOption(o => o.setName('main_card').setDescription('Main card ID').setRequired(true))
    .addStringOption(o => o.setName('sacrifice_card').setDescription('Card to sacrifice').setRequired(true)),
  new SlashCommandBuilder().setName('quests').setDescription('Show quests'),
  new SlashCommandBuilder().setName('admin-give-equipment').setDescription('Admin: give test equipment')
    .addStringOption(o => o.setName('rarity').setDescription('COMMON/RARE/EPIC/LEGENDARY/MYTHIC/DIVINE/SECRET'))
].map(c => c.toJSON());

(async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  if (config.guildId) await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  else await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log('Commands deployed');
})();
