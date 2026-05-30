// VoidRoll Reborn - Phase 25 HARD Command Reset
// This script clears GLOBAL + all GUILD commands, then deploys ONLY clean VoidRoll commands.
// Run:
//   node scripts/phase25-hard-command-reset.js

require('dotenv').config();

const {
  REST,
  Routes,
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error('❌ Missing BOT_TOKEN/DISCORD_TOKEN or CLIENT_ID/APPLICATION_ID/DISCORD_CLIENT_ID');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

const rarityChoices = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE','VOIDBORN','SECRET'].map(x => ({ name:x, value:x }));
const elementChoices = ['FIRE','ICE','WATER','WIND','LIGHTNING','SHADOW','LIGHT','VOID','SOUL','CURSED','NEUTRAL'].map(x => ({ name:x, value:x }));
const roleChoices = ['TANK','DPS','SUPPORT','ASSASSIN','SUMMONER','CONTROL','HEALER'].map(x => ({ name:x, value:x }));
const branchChoices = ['core','skill','gear','trait','bond','transformation','variant'].map(x => ({ name:x, value:x }));
const marketChoices = ['daily','black','void','traveling'].map(x => ({ name:x, value:x }));
const dungeonChoices = ['normal','elite','abyss','void'].map(x => ({ name:x, value:x }));
const pathChoices = ['safe','balanced','danger','void'].map(x => ({ name:x, value:x }));

const cleanCommands = [
  new SlashCommandBuilder().setName('help').setDescription('Show VoidRoll Reborn help'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),
  new SlashCommandBuilder().setName('wallet').setDescription('Show your wallet'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),

  new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('Show your inventory')
    .addStringOption(o => o.setName('character').setDescription('Filter by character').setRequired(false).setAutocomplete(true))
    .addStringOption(o => o.setName('anime').setDescription('Filter by anime').setRequired(false).setAutocomplete(true))
    .addStringOption(o => o.setName('rarity').setDescription('Filter by rarity').setRequired(false).addChoices(...rarityChoices))
    .addStringOption(o => o.setName('element').setDescription('Filter by element').setRequired(false).addChoices(...elementChoices))
    .addStringOption(o => o.setName('type').setDescription('Filter by role/type').setRequired(false).addChoices(...roleChoices))
    .addStringOption(o => o.setName('sort').setDescription('Sort mode').setRequired(false).addChoices(
      { name:'power', value:'power' },
      { name:'level', value:'level' },
      { name:'rarity', value:'rarity' },
      { name:'name', value:'name' }
    ))
    .addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false)),

  new SlashCommandBuilder().setName('view-card').setDescription('View an owned card').addStringOption(o => o.setName('card').setDescription('Card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('character').setDescription('Search character database').addStringOption(o => o.setName('name').setDescription('Character name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('characters').setDescription('Browse character database').addStringOption(o => o.setName('anime').setDescription('Anime').setRequired(false).setAutocomplete(true)).addStringOption(o => o.setName('rarity').setDescription('Rarity').setRequired(false).addChoices(...rarityChoices)).addIntegerOption(o => o.setName('page').setDescription('Page').setRequired(false)),
  new SlashCommandBuilder().setName('anime').setDescription('Show anime collection info').addStringOption(o => o.setName('anime').setDescription('Anime name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('collection').setDescription('Show collection completion').addStringOption(o => o.setName('anime').setDescription('Anime name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('who-has').setDescription('Find who owns a character').addStringOption(o => o.setName('name').setDescription('Character').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('roll').setDescription('Roll characters').addIntegerOption(o => o.setName('amount').setDescription('1 to 10').setRequired(false)),
  new SlashCommandBuilder().setName('banner').setDescription('Show active banner'),
  new SlashCommandBuilder().setName('pack').setDescription('Open featured banner pack'),
  new SlashCommandBuilder().setName('pity').setDescription('Show pity'),
  new SlashCommandBuilder().setName('rates').setDescription('Show roll rates'),

  new SlashCommandBuilder().setName('character-tree').setDescription('Show character upgrade tree').addStringOption(o => o.setName('card').setDescription('Card').setRequired(false).setAutocomplete(true)),
  new SlashCommandBuilder().setName('upgrade').setDescription('Upgrade character tree branch')
    .addStringOption(o => o.setName('branch').setDescription('Branch').setRequired(true).addChoices(...branchChoices))
    .addStringOption(o => o.setName('card').setDescription('Card').setRequired(false).setAutocomplete(true)),
  new SlashCommandBuilder().setName('traits').setDescription('Show traits').addStringOption(o => o.setName('role').setDescription('Role').setRequired(false).addChoices(...roleChoices)),
  new SlashCommandBuilder().setName('trait').setDescription('Show trait details').addStringOption(o => o.setName('name').setDescription('Trait name').setRequired(true)),
  new SlashCommandBuilder().setName('trait-unlock').setDescription('Unlock trait').addStringOption(o => o.setName('card').setDescription('Card').setRequired(false).setAutocomplete(true)),
  new SlashCommandBuilder().setName('trait-upgrade').setDescription('Upgrade trait').addStringOption(o => o.setName('card').setDescription('Card').setRequired(false).setAutocomplete(true)),

  new SlashCommandBuilder().setName('formations').setDescription('Show formations'),
  new SlashCommandBuilder().setName('formation-set').setDescription('Set formation slot')
    .addIntegerOption(o => o.setName('team').setDescription('Team 1-6').setRequired(true))
    .addIntegerOption(o => o.setName('slot').setDescription('Slot 1-6').setRequired(true))
    .addStringOption(o => o.setName('card').setDescription('Card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('formation-clear').setDescription('Clear formation slot')
    .addIntegerOption(o => o.setName('team').setDescription('Team 1-6').setRequired(true))
    .addIntegerOption(o => o.setName('slot').setDescription('Slot 1-6').setRequired(true)),
  new SlashCommandBuilder().setName('formation-leader').setDescription('Set formation leader')
    .addIntegerOption(o => o.setName('team').setDescription('Team 1-6').setRequired(true))
    .addIntegerOption(o => o.setName('slot').setDescription('Leader slot 1-6').setRequired(true)),

  new SlashCommandBuilder().setName('story').setDescription('Play story battle'),
  new SlashCommandBuilder().setName('market').setDescription('Show market').addStringOption(o => o.setName('type').setDescription('Market type').setRequired(false).addChoices(...marketChoices)),
  new SlashCommandBuilder().setName('market-buy').setDescription('Buy from market')
    .addStringOption(o => o.setName('type').setDescription('Market type').setRequired(true).addChoices(...marketChoices))
    .addIntegerOption(o => o.setName('slot').setDescription('Slot').setRequired(true)),

  new SlashCommandBuilder().setName('dungeon').setDescription('Start dungeon battle').addStringOption(o => o.setName('type').setDescription('Dungeon type').setRequired(true).addChoices(...dungeonChoices)),
  new SlashCommandBuilder().setName('dungeon-status').setDescription('Show dungeon status'),
  new SlashCommandBuilder().setName('dungeon-choose').setDescription('Choose dungeon path').addStringOption(o => o.setName('path').setDescription('Path').setRequired(true).addChoices(...pathChoices)),
  new SlashCommandBuilder().setName('dungeon-abandon').setDescription('Abandon dungeon'),

  new SlashCommandBuilder().setName('pvp').setDescription('Fight another player').addUserOption(o => o.setName('opponent').setDescription('Opponent').setRequired(true)),
  new SlashCommandBuilder().setName('pvp-rank').setDescription('Show PvP rank'),
  new SlashCommandBuilder().setName('pvp-defense').setDescription('Show PvP defense'),
  new SlashCommandBuilder().setName('pvp-leaderboard').setDescription('Show PvP leaderboard'),
  new SlashCommandBuilder().setName('pvp-rewards').setDescription('Show PvP rewards'),

  new SlashCommandBuilder().setName('world-boss').setDescription('Show world boss'),
  new SlashCommandBuilder().setName('raid').setDescription('Show active raid'),
  new SlashCommandBuilder().setName('raid-attack').setDescription('Attack raid boss'),
  new SlashCommandBuilder().setName('raid-rank').setDescription('Show raid damage ranking'),
  new SlashCommandBuilder().setName('raid-rewards').setDescription('Show raid rewards'),

  new SlashCommandBuilder().setName('gift-character').setDescription('Gift a character').addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('card').setDescription('Card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('trade-offer').setDescription('Offer a card trade').addUserOption(o => o.setName('user').setDescription('Buyer').setRequired(true)).addStringOption(o => o.setName('card').setDescription('Card').setRequired(true).setAutocomplete(true)).addIntegerOption(o => o.setName('tokens').setDescription('Token price').setRequired(true)),
  new SlashCommandBuilder().setName('trade-accept').setDescription('Accept trade').addStringOption(o => o.setName('trade_id').setDescription('Trade ID').setRequired(true)),
  new SlashCommandBuilder().setName('trade-decline').setDescription('Decline trade').addStringOption(o => o.setName('trade_id').setDescription('Trade ID').setRequired(true)),
  new SlashCommandBuilder().setName('trade-cancel').setDescription('Cancel trade').addStringOption(o => o.setName('trade_id').setDescription('Trade ID').setRequired(true)),
  new SlashCommandBuilder().setName('trades').setDescription('Show pending trades'),

  new SlashCommandBuilder().setName('admin-reset-all').setDescription('Admin reset all').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addStringOption(o => o.setName('confirm').setDescription('Type YES').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-gold').setDescription('Admin give gold').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-tokens').setDescription('Admin give tokens').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-rolls').setDescription('Admin give rolls').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-resource').setDescription('Admin give resource').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addUserOption(o => o.setName('user').setDescription('User').setRequired(true)).addStringOption(o => o.setName('resource').setDescription('Resource').setRequired(true)).addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true))
].map(c => c.toJSON());

async function getGuildIds() {
  const client = new Client({ intents:[GatewayIntentBits.Guilds] });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { client.destroy(); } catch (_) {}
      resolve([]);
    }, 12000);

    client.once('clientReady', () => {
      clearTimeout(timeout);
      const ids = [...client.guilds.cache.keys()];
      client.destroy();
      resolve(ids);
    });

    client.login(token).catch(reject);
  });
}

(async () => {
  try {
    console.log('1) Clearing GLOBAL commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log('✅ GLOBAL cleared');

    const guildIds = await getGuildIds();

    if (guildIds.length) {
      console.log(`2) Clearing ${guildIds.length} GUILD command sets...`);
      for (const guildId of guildIds) {
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log(`✅ GUILD cleared: ${guildId}`);
      }
    } else {
      console.log('⚠️ No guilds found automatically. If old commands remain in one server, set GUILD_ID and run again.');
      if (process.env.GUILD_ID) {
        await rest.put(Routes.applicationGuildCommands(clientId, process.env.GUILD_ID), { body: [] });
        console.log(`✅ GUILD_ID cleared: ${process.env.GUILD_ID}`);
      }
    }

    console.log(`3) Deploying clean GLOBAL commands only: ${cleanCommands.length}`);
    await rest.put(Routes.applicationCommands(clientId), { body: cleanCommands });
    console.log('✅ CLEAN GLOBAL commands deployed');

    console.log('');
    console.log('Done. Old commands removed from API.');
    console.log('Discord UI may need a few minutes to refresh global commands.');
    console.log('');
    console.log('Clean command count:', cleanCommands.length);
  } catch (err) {
    console.error('❌ HARD command reset failed:', err);
    process.exit(1);
  }
})();
