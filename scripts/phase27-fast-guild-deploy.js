// VoidRoll Reborn — OFFICIAL V5 SAFE DEPLOY
// IMPORTANT: This script does NOT clear commands first.
// It directly upserts/replaces the guild command set to avoid wipe-then-429 disasters.

require('dotenv').config();

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || process.env.APPLICATION_ID;
const guildId = process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || '1039274134296862801';
if(!token || !clientId || !guildId){
  console.error('Missing BOT_TOKEN/DISCORD_TOKEN, CLIENT_ID/DISCORD_CLIENT_ID, or GUILD_ID.');
  process.exit(1);
}
const STR=3, INT=4, USER=6;
const charOpt = { name:'name', description:'Character name', type:STR, required:true, autocomplete:true };
const cardOpt = { name:'card', description:'Owned card name or ID', type:STR, required:true, autocomplete:true };

const commands = [
  { name:'help', description:'Open VoidRoll help', type:1 },
  { name:'profile', description:'Show profile and resources', type:1 },
  { name:'wallet', description:'Show wallet and resources', type:1 },
  { name:'daily', description:'Claim daily rewards', type:1 },
  { name:'rates', description:'Show roll rates', type:1 },
  { name:'rarity', description:'Show rarity drop rates', type:1 },
  { name:'characters-count', description:'Show total characters and rarity counts', type:1 },
  { name:'banner', description:'Show active event banner', type:1 },
  { name:'roll', description:'Normal roll. Max rarity Divine.', type:1, options:[{ name:'amount', description:'1-30', type:INT, required:false, min_value:1, max_value:30 }] },
  { name:'premium-roll', description:'Premium roll with better high-rarity rates.', type:1, options:[{ name:'amount', description:'1-10', type:INT, required:false, min_value:1, max_value:10 }] },
  { name:'event-roll', description:'Corrupted Event roll using Event Rolls first, then Fragments.', type:1, options:[{ name:'amount', description:'1-10', type:INT, required:false, min_value:1, max_value:10 }] },
  { name:'fragment-roll', description:'Corrupted Event roll using Corrupted Fragments only.', type:1, options:[{ name:'amount', description:'1-10', type:INT, required:false, min_value:1, max_value:10 }] },
  { name:'fragments', description:'Show Corrupted Fragments, Event Rolls, and Event pity.', type:1 },
  { name:'sacrifice-rolls', description:'Convert Normal Rolls into Premium Rolls.', type:1, options:[{ name:'amount', description:'Normal Rolls to sacrifice', type:INT, required:true, choices:[
    { name:'25 Normal Rolls = 1 Premium Roll', value:25 },
    { name:'100 Normal Rolls = 5 Premium Rolls', value:100 },
    { name:'250 Normal Rolls = 15 Premium Rolls', value:250 }
  ]}] },

  { name:'character', description:'Inspect any character', type:1, options:[charOpt] },
  { name:'anime', description:'Search an anime and list its characters', type:1, options:[
    { name:'anime', description:'Anime title, e.g. Naruto, One Piece, Jujutsu Kaisen', type:STR, required:true, autocomplete:true },
    { name:'page', description:'Page number', type:INT, required:false, min_value:1, max_value:999 }
  ]},
  { name:'variants', description:'Show character variants', type:1, options:[charOpt] },
  { name:'inventory', description:'Show your strongest owned cards', type:1 },
  { name:'my-card', description:'Inspect your owned card', type:1, options:[cardOpt] },
  { name:'view-card', description:'Inspect your owned card', type:1, options:[cardOpt] },

  { name:'train', description:'Level up an owned card', type:1, options:[cardOpt, { name:'levels', description:'Levels to add', type:INT, required:false, min_value:1, max_value:25 }] },
  { name:'gear', description:'Show a card gear set', type:1, options:[cardOpt] },
  { name:'gear-upgrade', description:'Upgrade a gear slot', type:1, options:[
    cardOpt,
    { name:'slot', description:'Gear slot', type:STR, required:true, choices:[
      { name:'weapon', value:'WEAPON' },
      { name:'armor', value:'ARMOR' },
      { name:'accessory', value:'ACCESSORY' },
      { name:'boots', value:'BOOTS' }
    ]}
  ]},
  { name:'skill-tree', description:'View a card skill tree', type:1, options:[cardOpt] },
  { name:'skill-upgrade', description:'Upgrade a card skill node', type:1, options:[
    cardOpt,
    { name:'node', description:'Skill node', type:STR, required:true, choices:[
      { name:'Core', value:'core' },
      { name:'Skill', value:'skill' },
      { name:'Trait', value:'trait' },
      { name:'Gear Sync', value:'gear' },
      { name:'Ultimate', value:'ultimate' }
    ]}
  ]},

  { name:'auto-formation', description:'Automatically build your 3 strongest formations', type:1 },
  { name:'formation', description:'Show your formations', type:1 },
  { name:'formation-set', description:'Place a card into a formation slot', type:1, options:[
    { name:'formation', description:'Formation 1-3', type:INT, required:true, min_value:1, max_value:3 },
    { name:'slot', description:'Slot 1-5', type:INT, required:true, min_value:1, max_value:5 },
    cardOpt
  ]},

  { name:'hunt', description:'Enter Hunt Zone', type:1, options:[
    { name:'zone', description:'Optional zone', type:STR, required:false, choices:[
      { name:'Training Fields', value:'training_fields' },
      { name:'Neon Ruins', value:'neon_ruins' },
      { name:'Cursed Forest', value:'cursed_forest' },
      { name:'Frozen Keep', value:'frozen_keep' },
      { name:'Abyss Gate', value:'abyss_gate' },
      { name:'Demon Market', value:'demon_market' },
      { name:'Celestial Peak', value:'celestial_peak' },
      { name:'Void Sanctum', value:'void_sanctum' },
      { name:'Corrupted Throne', value:'corrupted_throne' },
      { name:'Eternal Void', value:'eternal_void' }
    ]},
    { name:'formation', description:'Formation 1-3', type:INT, required:false, min_value:1, max_value:3 }
  ]},
  { name:'hunt-next', description:'Continue your active Hunt run', type:1 },
  { name:'survival', description:'Fight waves until your team is defeated', type:1 },
  { name:'token-shop', description:'Open Token Shop', type:1 },
  { name:'token-buy', description:'Buy from Token Shop', type:1, options:[
    { name:'item', description:'Token shop item', type:STR, required:true, choices:[
      { name:'Normal Rolls', value:'rolls' },
      { name:'Premium Roll', value:'premium' },
      { name:'Dungeon Key', value:'dungeon-key' },
      { name:'Gate Key', value:'gate-key' },
      { name:'Essence', value:'essence' },
      { name:'Relic Stones', value:'relics' }
    ]},
    { name:'amount', description:'Quantity', type:INT, required:false, min_value:1, max_value:50 }
  ]},
  { name:'hunt-shop', description:'Browse the Hunt Coin shop', type:1 },
  { name:'hunt-buy', description:'Buy from the Hunt Coin shop', type:1, options:[
    { name:'item', description:'Item to buy', type:STR, required:true, choices:[
      { name:'Field Potion (3 coins)', value:'heal' },
      { name:'Lucky Compass (5 coins)', value:'compass' },
      { name:'Iron Guard (4 coins)', value:'guard' },
      { name:'Energy Flask (4 coins)', value:'flask' },
      { name:'Revive Charm (8 coins)', value:'revive' },
      { name:'Normal Rolls x3 (15 coins)', value:'rolls' },
      { name:'Relic Stones x3 (12 coins)', value:'relics' }
    ]}
  ]},
  { name:'survival-shop', description:'Open Survival Shop', type:1 },
  { name:'survival-buy', description:'Buy from Survival Shop', type:1, options:[{ name:'item', description:'Shop item', type:STR, required:true, choices:[
    { name:'Normal Roll Pack', value:'rolls' },
    { name:'Relic Cache', value:'relics' },
    { name:'Essence Cache', value:'essence' }
  ]}] },
  { name:'dungeon', description:'Enter a dungeon using Dungeon Keys', type:1 },
  { name:'gate', description:'Enter a rare gate using Gate Keys', type:1 },
  { name:'corrupted-raid', description:'Show active Corrupted Raid', type:1 },
  { name:'raid-attack', description:'Attack the active Corrupted Raid boss', type:1 },
  { name:'raid-rank', description:'Show Corrupted Raid ranking', type:1 },
  { name:'relics', description:'Show relic and gear upgrade info', type:1 },
  { name:'traits', description:'Show trait system info', type:1 },
  { name:'event-shop', description:'Open Corrupted Event Shop info', type:1 },

  { name:'gift', description:'Gift one owned card to another user', type:1, options:[{ name:'user', description:'Target user', type:USER, required:true }, cardOpt] },
  { name:'trade', description:'Send a trade request notice', type:1, options:[{ name:'user', description:'Target user', type:USER, required:true }] },
  { name:'quick-sell', description:'Sell all owned cards of one rarity for Gold', type:1, options:[{ name:'rarity', description:'Rarity to sell', type:STR, required:true, choices:[
    { name:'COMMON', value:'COMMON' }, { name:'RARE', value:'RARE' }, { name:'EPIC', value:'EPIC' }, { name:'LEGENDARY', value:'LEGENDARY' }, { name:'MYTHIC', value:'MYTHIC' }, { name:'DIVINE', value:'DIVINE' }
  ]}] },

  { name:'shards', description:'Show your Card Shards and duplicate conversion values', type:1 },
  { name:'shard-shop', description:'Open Shard Shop', type:1 },
  { name:'shard-buy', description:'Buy items using Card Shards', type:1, options:[
    { name:'item', description:'Shard shop item', type:STR, required:true, choices:[
      { name:'Premium Roll', value:'premium-roll' },
      { name:'Event Fragments', value:'event-fragments' },
      { name:'Relic Stones', value:'relics' },
      { name:'Trait Stones', value:'traits' },
      { name:'Essence', value:'essence' },
      { name:'Normal Rolls', value:'rolls' }
    ]},
    { name:'amount', description:'Quantity', type:INT, required:false, min_value:1, max_value:50 }
  ]},
  { name:'auto-shard', description:'Convert old duplicate cards into Card Shards', type:1, options:[
    { name:'keep_rarity', description:'Keep duplicate cards at or above this rarity', type:STR, required:false, choices:[
      { name:'SECRET only', value:'SECRET' },
      { name:'DIVINE and SECRET', value:'DIVINE' },
      { name:'MYTHIC and above', value:'MYTHIC' },
      { name:'LEGENDARY and above', value:'LEGENDARY' }
    ]}
  ]},

  { name:'admin-give', description:'Admin: give resources', type:1, options:[
    { name:'user', description:'Target user', type:USER, required:true },
    { name:'resource', description:'Resource key', type:STR, required:true, choices:[
      'gold','tokens','gems','essence','voidCrystals','rolls','premiumRolls','eventRolls','huntCoins','corruptedFragments','relicStones','traitStones','survivalCoins','cardShards','dungeonKeys','gateKeys'
    ].map(x=>({ name:x, value:x })) },
    { name:'amount', description:'Amount', type:INT, required:true, min_value:1 }
  ]},
  { name:'admin-give-card', description:'Admin: give a card to a user', type:1, options:[{ name:'user', description:'Target user', type:USER, required:true }, charOpt] },
  // ── NEW GAME MODES ──
  { name:'events', description:'View active and upcoming VoidRoll events', type:1 },
  { name:'achievements', description:'View your achievements and progress', type:1 },
  { name:'claim-achievement', description:'Claim a completed achievement reward', type:1, options:[
    { name:'achievement', description:'Achievement ID', type:STR, required:true }
  ]},
  { name:'rival', description:'Challenge a random rival player', type:1 },
  { name:'zone-mastery', description:'View your Hunt Zone mastery levels', type:1 },
  { name:'hunt-achievements', description:'View Hunt achievements and progress', type:1 },
  { name:'hunt-claim', description:'Claim a completed Hunt achievement', type:1, options:[
    { name:'achievement', description:'Achievement ID', type:STR, required:true }
  ]},
  { name:'arena', description:'Challenge another player to PvP', type:1, options:[{ name:'opponent', description:'Player to challenge', type:USER, required:true }]},
  { name:'abyss-tower', description:'Climb the 100-floor Abyss Tower', type:1 },
  { name:'missions', description:'View your daily missions', type:1 },
  { name:'void-rift', description:'Void Rift event (open Sunday and Monday only)', type:1 },
  { name:'blitz', description:'Endless wave mode — survive as long as you can', type:1 },
  { name:'gacha-dungeon', description:'3-floor dungeon with random ally characters (costs Dungeon Key)', type:1 },
  { name:'gacha-dungeon-next', description:'Advance to next Gacha Dungeon floor', type:1 },
  { name:'nightmare', description:'8-room Nightmare Hunt for rare rewards (costs Gate Key)', type:1 },
  { name:'weekly-challenge', description:'View this week special challenge', type:1 },
  { name:'void-trial', description:'Daily trial against a powerful character', type:1 },
  { name:'ascend', description:'Ascend a Level 100 card for permanent power boost', type:1, options:[cardOpt] },

  { name:'admin-reset-user', description:'Admin: reset one user', type:1, options:[{ name:'user', description:'Target user', type:USER, required:true }] },
  { name:'admin-reset-game', description:'Admin: reset all player data but keep character database', type:1 }
];

async function request(method, url, body){
  const res = await fetch(url, {
    method,
    headers:{ Authorization:'Bot '+token, 'Content-Type':'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  if(!res.ok) throw new Error(res.status+' '+res.statusText+'\n'+text);
  return text ? JSON.parse(text) : null;
}

async function main(){
  const seen = new Set();
  const unique = commands.filter(c => {
    if(seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
  const guildUrl = `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`;
  console.log('Using clientId:', clientId);
  console.log('Using guildId:', guildId);
  console.log('Command count:', unique.length);
  console.log('Deploying guild commands safely without pre-clear...');
  await request('PUT', guildUrl, unique);
  console.log('✅ Guild commands deployed safely.');
}
main().catch(e=>{ console.error('❌ Deploy failed:'); console.error(e.message || e); process.exit(1); });
