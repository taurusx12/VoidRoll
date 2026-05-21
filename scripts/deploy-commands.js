require('dotenv').config();

const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const commands = [
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),
  new SlashCommandBuilder().setName('roll').setDescription('Roll anime cards').addIntegerOption(o => o.setName('amount').setDescription('1-10 rolls').setMinValue(1).setMaxValue(10)),
  new SlashCommandBuilder().setName('inventory').setDescription('Show your latest cards'),
  new SlashCommandBuilder().setName('team').setDescription('Set or show your 5-card team').addStringOption(o => o.setName('action').setDescription('set/show').setRequired(true).addChoices({ name: 'set', value: 'set' }, { name: 'show', value: 'show' })).addIntegerOption(o => o.setName('slot').setDescription('Team slot 1-5').setMinValue(1).setMaxValue(5)).addStringOption(o => o.setName('card_id').setDescription('Card ID')),
  new SlashCommandBuilder().setName('claim').setDescription('Claim passive farming rewards'),
  new SlashCommandBuilder().setName('story').setDescription('Play story mode').addIntegerOption(o => o.setName('chapter').setDescription('1-60').setMinValue(1).setMaxValue(60)).addIntegerOption(o => o.setName('stage').setDescription('1-30').setMinValue(1).setMaxValue(30)),
  new SlashCommandBuilder().setName('dungeon').setDescription('Enter a dungeon').addStringOption(o => o.setName('type').setDescription('fire/shadow/ice/void').setRequired(true).addChoices({ name: 'fire', value: 'fire' }, { name: 'shadow', value: 'shadow' }, { name: 'ice', value: 'ice' }, { name: 'void', value: 'void' })),
  new SlashCommandBuilder().setName('bosses').setDescription('Fight the active boss'),
  new SlashCommandBuilder().setName('limited-boss').setDescription('Fight the limited boss'),
  new SlashCommandBuilder().setName('tower').setDescription('Climb the tower'),
  new SlashCommandBuilder().setName('quests').setDescription('Show active quests'),
  new SlashCommandBuilder().setName('sacrifice').setDescription('Sacrifice a card to power up another').addStringOption(o => o.setName('main_card').setDescription('Main card ID').setRequired(true)).addStringOption(o => o.setName('sacrifice_card').setDescription('Card to sacrifice').setRequired(true)),
  new SlashCommandBuilder().setName('market').setDescription('Show market listings'),
  new SlashCommandBuilder().setName('sell').setDescription('Sell a card').addStringOption(o => o.setName('card_id').setDescription('Card ID').setRequired(true)).addIntegerOption(o => o.setName('price').setDescription('Gold price').setRequired(true)),
  new SlashCommandBuilder().setName('buy').setDescription('Buy market listing').addStringOption(o => o.setName('listing_id').setDescription('Listing ID').setRequired(true)),
  new SlashCommandBuilder().setName('equipment').setDescription('Show your equipment'),
  new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade equipment').addStringOption(o => o.setName('equipment_id').setDescription('Equipment ID').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('Show all bot commands'),
  new SlashCommandBuilder().setName('admin-give-equipment').setDescription('Admin: give test equipment').addStringOption(o => o.setName('rarity').setDescription('COMMON/RARE/EPIC/LEGENDARY/MYTHIC/DIVINE/SECRET'))
].map(c => c.toJSON());

(async () => {
  const rest = new REST({ version: '10' }).setToken(config.token);
  if (config.guildId) await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  else await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log('Commands deployed');
})();
