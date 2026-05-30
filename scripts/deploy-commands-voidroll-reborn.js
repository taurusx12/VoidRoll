// VoidRoll Reborn - Phase 17 Deploy Commands
// Run: node scripts/deploy-commands-voidroll-reborn.js
// Requires .env with BOT_TOKEN and CLIENT_ID. Optional GUILD_ID for guild deploy.

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;
const guildId = process.env.GUILD_ID || null;

if (!token || !clientId) {
  console.error('Missing BOT_TOKEN/DISCORD_TOKEN or CLIENT_ID/APPLICATION_ID in .env');
  process.exit(1);
}

const rarityChoices = [
  'COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','VOIDBORN','SECRET'
].map(x => ({ name: x, value: x }));

const elementChoices = [
  'FIRE','ICE','WATER','WIND','LIGHTNING','SHADOW','LIGHT','VOID'
].map(x => ({ name: x, value: x }));

const roleChoices = [
  'TANK','DPS','SUPPORT','ASSASSIN','SUMMONER','CONTROL','HEALER'
].map(x => ({ name: x, value: x }));

const branchChoices = [
  'core','skill','gear','trait','bond','transformation','variant'
].map(x => ({ name: x, value: x }));

const marketChoices = ['daily','black','void','traveling'].map(x => ({ name: x, value: x }));
const dungeonChoices = ['normal','elite','abyss','void'].map(x => ({ name: x, value: x }));
const pathChoices = ['safe','balanced','danger','void'].map(x => ({ name: x, value: x }));

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show VoidRoll Reborn commands'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('wallet').setDescription('Show your currencies'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Show your inventory')
    .addStringOption(o => o.setName('name').setDescription('Search by character name').setRequired(false))
    .addStringOption(o => o.setName('anime').setDescription('Filter by anime').setRequired(false))
    .addStringOption(o => o.setName('rarity').setDescription('Filter by rarity').setRequired(false).addChoices(...rarityChoices))
    .addStringOption(o => o.setName('element').setDescription('Filter by element').setRequired(false).addChoices(...elementChoices))
    .addStringOption(o => o.setName('role').setDescription('Filter by role').setRequired(false).addChoices(...roleChoices))
    .addStringOption(o => o.setName('variant').setDescription('Filter by variant').setRequired(false))
    .addStringOption(o => o.setName('sort').setDescription('Sort mode').setRequired(false).addChoices(
      { name: 'power', value: 'power' }, { name: 'rarity', value: 'rarity' },
      { name: 'level', value: 'level' }, { name: 'name', value: 'name' },
      { name: 'anime', value: 'anime' }, { name: 'gear', value: 'gear' }
    ))
    .addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false)),

  new SlashCommandBuilder().setName('view-card').setDescription('View an owned card').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)),
  new SlashCommandBuilder().setName('character').setDescription('Search character database').addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),
  new SlashCommandBuilder().setName('characters').setDescription('Browse character database'),
  new SlashCommandBuilder().setName('anime').setDescription('Show anime database').addStringOption(o => o.setName('name').setDescription('Anime name').setRequired(true)),
  new SlashCommandBuilder().setName('collection').setDescription('Show anime collection completion').addStringOption(o => o.setName('anime').setDescription('Anime name').setRequired(true)),
  new SlashCommandBuilder().setName('who-has').setDescription('Find who owns a character').addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true)),

  new SlashCommandBuilder().setName('roll').setDescription('Normal character roll').addIntegerOption(o => o.setName('amount').setDescription('1 or 10').setRequired(false)),
  new SlashCommandBuilder().setName('banner').setDescription('Show active banners'),
  new SlashCommandBuilder().setName('pack').setDescription('Pull from a banner').addStringOption(o => o.setName('banner').setDescription('Banner id').setRequired(false)).addIntegerOption(o => o.setName('amount').setDescription('1 or 10').setRequired(false)),
  new SlashCommandBuilder().setName('pity').setDescription('Show pity'),
  new SlashCommandBuilder().setName('rates').setDescription('Show roll rates'),

  new SlashCommandBuilder().setName('character-tree').setDescription('Show character evolution tree').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)),
  new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade character tree branch').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)).addStringOption(o => o.setName('branch').setDescription('Branch').setRequired(true).addChoices(...branchChoices)),
  new SlashCommandBuilder().setName('traits').setDescription('Show traits').addStringOption(o => o.setName('role').setDescription('Role').setRequired(false).addChoices(...roleChoices)),
  new SlashCommandBuilder().setName('trait').setDescription('Show trait details').addStringOption(o => o.setName('name').setDescription('Trait name').setRequired(true)),
  new SlashCommandBuilder().setName('trait-unlock').setDescription('Unlock trait for a card').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)),
  new SlashCommandBuilder().setName('trait-upgrade').setDescription('Upgrade current trait').addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(false)),

  new SlashCommandBuilder().setName('formations').setDescription('Show formations'),
  new SlashCommandBuilder().setName('formation-set').setDescription('Set formation slot').addIntegerOption(o => o.setName('team').setDescription('1-6').setRequired(true)).addIntegerOption(o => o.setName('slot').setDescription('1-6').setRequired(true)).addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(true)),
  new SlashCommandBuilder().setName('formation-clear').setDescription('Clear formation slot').addIntegerOption(o => o.setName('team').setDescription('1-6').setRequired(true)).addIntegerOption(o => o.setName('slot').setDescription('1-6').setRequired(true)),
  new SlashCommandBuilder().setName('formation-leader').setDescription('Set formation leader').addIntegerOption(o => o.setName('team').setDescription('1-6').setRequired(true)).addIntegerOption(o => o.setName('slot').setDescription('1-6').setRequired(true)),

  new SlashCommandBuilder().setName('story').setDescription('Play story').addIntegerOption(o => o.setName('chapter').setDescription('Chapter').setRequired(false)).addIntegerOption(o => o.setName('stage').setDescription('Stage').setRequired(false)),

  new SlashCommandBuilder().setName('market').setDescription('Show market').addStringOption(o => o.setName('type').setDescription('Market type').setRequired(false).addChoices(...marketChoices)),
  new SlashCommandBuilder().setName('market-buy').setDescription('Buy from market').addStringOption(o => o.setName('type').setDescription('Market type').setRequired(true).addChoices(...marketChoices)).addIntegerOption(o => o.setName('slot').setDescription('Slot').setRequired(true)),

  new SlashCommandBuilder().setName('dungeon').setDescription('Start dungeon').addStringOption(o => o.setName('type').setDescription('Dungeon type').setRequired(true).addChoices(...dungeonChoices)),
  new SlashCommandBuilder().setName('dungeon-status').setDescription('Show current dungeon'),
  new SlashCommandBuilder().setName('dungeon-choose').setDescription('Choose dungeon path').addStringOption(o => o.setName('path').setDescription('Path').setRequired(true).addChoices(...pathChoices)),
  new SlashCommandBuilder().setName('dungeon-abandon').setDescription('Abandon dungeon'),

  new SlashCommandBuilder().setName('pvp').setDescription('Attack a player in PvP').addUserOption(o => o.setName('opponent').setDescription('Opponent').setRequired(true)),
  new SlashCommandBuilder().setName('pvp-rank').setDescription('Show PvP rank'),
  new SlashCommandBuilder().setName('pvp-defense').setDescription('Show PvP defense'),
  new SlashCommandBuilder().setName('pvp-defense-set').setDescription('Set PvP defense slot').addIntegerOption(o => o.setName('team').setDescription('1-6').setRequired(true)).addIntegerOption(o => o.setName('slot').setDescription('1-6').setRequired(true)).addStringOption(o => o.setName('card').setDescription('Owned card').setRequired(true)),
  new SlashCommandBuilder().setName('pvp-leaderboard').setDescription('Show PvP leaderboard'),
  new SlashCommandBuilder().setName('pvp-rewards').setDescription('Show PvP rewards'),

  new SlashCommandBuilder().setName('world-boss').setDescription('Show world boss'),
  new SlashCommandBuilder().setName('raid').setDescription('Show raids'),
  new SlashCommandBuilder().setName('raid-attack').setDescription('Attack raid boss').addStringOption(o => o.setName('boss').setDescription('Boss id').setRequired(false)),
  new SlashCommandBuilder().setName('raid-rank').setDescription('Show raid damage ranking'),
  new SlashCommandBuilder().setName('raid-rewards').setDescription('Show raid rewards'),

  new SlashCommandBuilder().setName('admin-reset-all').setDescription('Admin reset all').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('confirm').setDescription('Type YES').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-gold').setDescription('Admin give gold').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-tokens').setDescription('Admin give tokens').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-rolls').setDescription('Admin give rolls').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-essence').setDescription('Admin give essence').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-void-crystals').setDescription('Admin give void crystals').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-resource').setDescription('Admin give resource').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('resource').setDescription('Resource').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-spawn-boss').setDescription('Admin spawn boss').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('boss').setDescription('Boss id').setRequired(true)),
  new SlashCommandBuilder().setName('admin-refresh-market').setDescription('Admin refresh market').setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`Deploying ${commands.length} VoidRoll Reborn commands...`);
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log('Guild commands deployed.');
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('Global commands deployed.');
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
