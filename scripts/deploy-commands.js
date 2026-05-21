require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

const config = require('../src/lib/config');

const commands = [

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Show your profile'),

  new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim daily rewards'),

  new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a random anime card'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Show your latest cards'),

  new SlashCommandBuilder()
    .setName('market')
    .setDescription('Show market listings'),

  new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell a card')
    .addStringOption(o =>
      o.setName('card_id')
        .setDescription('Card ID')
        .setRequired(true))
    .addIntegerOption(o =>
      o.setName('price')
        .setDescription('Gold price')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy market listing')
    .addStringOption(o =>
      o.setName('listing_id')
        .setDescription('Listing ID')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('equipment')
    .setDescription('Show your equipment'),

  new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Upgrade equipment')
    .addStringOption(o =>
      o.setName('equipment_id')
        .setDescription('Equipment ID')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('quests')
    .setDescription('Show your active quests'),

  new SlashCommandBuilder()
    .setName('bosses')
    .setDescription('Show active bosses'),

  new SlashCommandBuilder()
    .setName('limited-boss')
    .setDescription('Fight the limited boss'),

  new SlashCommandBuilder()
    .setName('dungeon')
    .setDescription('Enter a dungeon')
    .addStringOption(o =>
      o.setName('type')
        .setDescription('fire/shadow/ice/void')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('tower')
    .setDescription('Climb the tower'),

  new SlashCommandBuilder()
    .setName('story')
    .setDescription('Start story mode')
    .addIntegerOption(o =>
      o.setName('chapter')
        .setDescription('Story chapter')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('sacrifice')
    .setDescription('Sacrifice cards to power up')
    .addStringOption(o =>
      o.setName('main_card')
        .setDescription('Main card ID')
        .setRequired(true))
    .addStringOption(o =>
      o.setName('sacrifice_card')
        .setDescription('Card to sacrifice')
        .setRequired(true)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all bot commands'),

  new SlashCommandBuilder()
    .setName('admin-give-equipment')
    .setDescription('Admin: give test equipment')
    .addStringOption(o =>
      o.setName('rarity')
        .setDescription('COMMON/RARE/EPIC/LEGENDARY/MYTHIC/DIVINE/SECRET'))

].map(c => c.toJSON());

(async () => {

  const rest = new REST({ version: '10' })
    .setToken(config.token);

  if (config.guildId) {

    await rest.put(
      Routes.applicationGuildCommands(
        config.clientId,
        config.guildId
      ),
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
