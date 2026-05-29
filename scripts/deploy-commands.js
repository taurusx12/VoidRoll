require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../src/lib/config');

const rarityChoices = [
  { name:'All', value:'ALL' }, { name:'Common', value:'COMMON' }, { name:'Rare', value:'RARE' },
  { name:'Epic', value:'EPIC' }, { name:'Legendary', value:'LEGENDARY' }, { name:'Mythic', value:'MYTHIC' },
  { name:'Divine', value:'DIVINE' }, { name:'Voidborn', value:'VOIDBORN' }, { name:'Secret', value:'SECRET' }
];
const roleChoices = [
  { name:'All', value:'ALL' }, { name:'DPS', value:'DPS' }, { name:'Tank', value:'Tank' },
  { name:'Support', value:'Support' }, { name:'Control', value:'Control' }, { name:'Assassin', value:'Assassin' }, { name:'Mage', value:'Mage' }
];
const elementChoices = [
  { name:'All', value:'ALL' }, { name:'Neutral', value:'Neutral' }, { name:'Fire', value:'Fire' }, { name:'Ice', value:'Ice' },
  { name:'Lightning', value:'Lightning' }, { name:'Light', value:'Light' }, { name:'Dark', value:'Dark' },
  { name:'Shadow', value:'Shadow' }, { name:'Void', value:'Void' }, { name:'Soul', value:'Soul' }, { name:'Cursed', value:'Cursed' }
];

const commands = [
  new SlashCommandBuilder().setName('help').setDescription('Show VoidRoll 2.0 help'),
  new SlashCommandBuilder().setName('profile').setDescription('Show your VoidRoll profile'),
  new SlashCommandBuilder().setName('wallet').setDescription('Show your Gold, Tokens, Essence and Void Crystals'),
  new SlashCommandBuilder().setName('daily').setDescription('Claim daily rewards'),

  new SlashCommandBuilder().setName('roll').setDescription('Normal roll').addIntegerOption(o=>o.setName('amount').setDescription('1-10').setRequired(false).setMinValue(1).setMaxValue(10)),
  new SlashCommandBuilder().setName('r').setDescription('Quick normal roll').addIntegerOption(o=>o.setName('amount').setDescription('1-10').setRequired(false).setMinValue(1).setMaxValue(10)),
  new SlashCommandBuilder().setName('rates').setDescription('Show roll rates'),
  new SlashCommandBuilder().setName('rarity').setDescription('Show roll rates'),
  new SlashCommandBuilder().setName('banner').setDescription('Show active VOIDBORN / SECRET banners'),
  new SlashCommandBuilder().setName('pack').setDescription('Open 10-pull banner pack').addStringOption(o=>o.setName('banner').setDescription('Choose featured character').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('pity').setDescription('Show banner pity'),

  new SlashCommandBuilder().setName('inventory').setDescription('Advanced inventory search')
    .addStringOption(o=>o.setName('character').setDescription('Character name').setRequired(false).setAutocomplete(true))
    .addStringOption(o=>o.setName('anime').setDescription('Anime name').setRequired(false).setAutocomplete(true))
    .addStringOption(o=>o.setName('rarity').setDescription('Rarity').setRequired(false).addChoices(...rarityChoices))
    .addStringOption(o=>o.setName('type').setDescription('Role/type').setRequired(false).addChoices(...roleChoices))
    .addStringOption(o=>o.setName('element').setDescription('Element').setRequired(false).addChoices(...elementChoices))
    .addStringOption(o=>o.setName('sort').setDescription('Sort').setRequired(false).addChoices({name:'Power',value:'power'},{name:'Level',value:'level'},{name:'Rarity',value:'rarity'},{name:'Name',value:'name'}))
    .addIntegerOption(o=>o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)),
  new SlashCommandBuilder().setName('view-card').setDescription('Inspect one owned card in full detail').addStringOption(o=>o.setName('card').setDescription('Choose owned card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('character').setDescription('Inspect a character or owned card').addStringOption(o=>o.setName('name').setDescription('Character name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('characters').setDescription('Character database with filters')
    .addStringOption(o=>o.setName('anime').setDescription('Anime').setRequired(false).setAutocomplete(true))
    .addStringOption(o=>o.setName('rarity').setDescription('Rarity').setRequired(false).addChoices(...rarityChoices))
    .addStringOption(o=>o.setName('type').setDescription('Role/type').setRequired(false).addChoices(...roleChoices))
    .addIntegerOption(o=>o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)),
  new SlashCommandBuilder().setName('top-characters').setDescription('Top character database').addStringOption(o=>o.setName('anime').setDescription('Anime').setRequired(false).setAutocomplete(true)).addStringOption(o=>o.setName('rarity').setDescription('Rarity').setRequired(false).addChoices(...rarityChoices)).addIntegerOption(o=>o.setName('page').setDescription('Page').setRequired(false).setMinValue(1)),
  new SlashCommandBuilder().setName('anime').setDescription('Anime library and collection progress').addStringOption(o=>o.setName('anime').setDescription('Anime name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('collection').setDescription('Your anime collection progress').addStringOption(o=>o.setName('anime').setDescription('Anime name').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('who-has').setDescription('Find who owns a character').addStringOption(o=>o.setName('name').setDescription('Character name').setRequired(true).setAutocomplete(true)),

  new SlashCommandBuilder().setName('train').setDescription('Train one owned card one level').addStringOption(o=>o.setName('card').setDescription('Choose owned card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('auto-train').setDescription('Auto-train an owned card until Gold runs out').addStringOption(o=>o.setName('card').setDescription('Choose owned card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('formations').setDescription('Show synced formations from inventory power').addUserOption(o=>o.setName('user').setDescription('Optional player').setRequired(false)),
  new SlashCommandBuilder().setName('autoteam').setDescription('Auto team info'),

  new SlashCommandBuilder().setName('story').setDescription('Play story battle with real roles/passives'),
  new SlashCommandBuilder().setName('tower').setDescription('Play tower battle with team checks'),
  new SlashCommandBuilder().setName('dungeon').setDescription('Play dungeon battle'),
  new SlashCommandBuilder().setName('boss-rush').setDescription('Solo boss rush with damage rewards'),
  new SlashCommandBuilder().setName('pvp').setDescription('Fight another player').addUserOption(o=>o.setName('opponent').setDescription('Opponent').setRequired(true)),

  new SlashCommandBuilder().setName('market').setDescription('Show daily market'),
  new SlashCommandBuilder().setName('market-buy').setDescription('Buy from daily market').addStringOption(o=>o.setName('item_id').setDescription('Market item').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('gift-character').setDescription('Gift a selected card to another player').addUserOption(o=>o.setName('user').setDescription('Receiver').setRequired(true)).addStringOption(o=>o.setName('card').setDescription('Choose exact card').setRequired(true).setAutocomplete(true)),
  new SlashCommandBuilder().setName('trade-offer').setDescription('Offer selected card for Tokens').addUserOption(o=>o.setName('user').setDescription('Buyer').setRequired(true)).addStringOption(o=>o.setName('card').setDescription('Choose exact card').setRequired(true).setAutocomplete(true)).addIntegerOption(o=>o.setName('tokens').setDescription('Token price').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('trade-accept').setDescription('Accept pending trade').addStringOption(o=>o.setName('trade_id').setDescription('Trade ID').setRequired(true)),
  new SlashCommandBuilder().setName('trade-decline').setDescription('Decline pending trade').addStringOption(o=>o.setName('trade_id').setDescription('Trade ID').setRequired(true)),
  new SlashCommandBuilder().setName('trade-cancel').setDescription('Cancel pending trade').addStringOption(o=>o.setName('trade_id').setDescription('Trade ID').setRequired(true)),
  new SlashCommandBuilder().setName('trades').setDescription('Show your pending trades'),

  new SlashCommandBuilder().setName('admin-reset-all').setDescription('Admin: full player reset for official launch').addStringOption(o=>o.setName('confirm').setDescription('Type YES').setRequired(true).addChoices({name:'YES',value:'YES'})),
  new SlashCommandBuilder().setName('admin-give-gold').setDescription('Admin: give Gold').addUserOption(o=>o.setName('user').setDescription('Player').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-tokens').setDescription('Admin: give Tokens').addUserOption(o=>o.setName('user').setDescription('Player').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-rolls').setDescription('Admin: give Rolls').addUserOption(o=>o.setName('user').setDescription('Player').setRequired(true)).addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-give-resource').setDescription('Admin: give Essence or Void Crystals')
    .addUserOption(o=>o.setName('user').setDescription('Player').setRequired(true))
    .addStringOption(o=>o.setName('resource').setDescription('Resource').setRequired(true).addChoices({name:'Essence',value:'essence'},{name:'Void Crystals',value:'void_crystals'}))
    .addIntegerOption(o=>o.setName('amount').setDescription('Amount').setRequired(true)),
  new SlashCommandBuilder().setName('admin-dedupe-characters').setDescription('Admin: legacy dedupe placeholder').addStringOption(o=>o.setName('confirm').setDescription('Type YES').setRequired(true))
];

async function main() {
  const token = config.discordToken || process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;
  const clientId = config.clientId || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
  const guildId = config.guildId || process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
  if (!token || !clientId) { console.error('Missing Discord token or client ID.'); process.exit(1); }
  const body = commands.filter(c=>c&&typeof c.toJSON==='function').map(c=>c.toJSON());
  const seen = new Set();
  for (const cmd of body) { if (seen.has(cmd.name)) { console.error('Duplicate command:', cmd.name); process.exit(1); } seen.add(cmd.name); }
  console.log('Deploying commands:', [...seen].join(', '));
  const rest = new REST({ version:'10' }).setToken(token);
  if (guildId) await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  else await rest.put(Routes.applicationCommands(clientId), { body });
  console.log('Commands deployed');
}
main().catch(err=>{ console.error(err); process.exit(1); });
