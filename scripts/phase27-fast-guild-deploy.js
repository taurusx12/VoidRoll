// VoidRoll Reborn - Phase 27 Fast Guild Deploy
// This avoids the hanging Phase 25 deploy.
// It deploys essential clean Guild commands only.
// Run:
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js

require('dotenv').config();

const token = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID || '1039274134296862801';

if (!token || !clientId || !guildId) {
  console.error('Missing token/clientId/guildId');
  process.exit(1);
}

const commands = [
  { name:'help', description:'Show VoidRoll Reborn help', type:1 },
  { name:'wallet', description:'Show your wallet', type:1 },
  { name:'profile', description:'Show your profile', type:1 },
  { name:'daily', description:'Claim daily rewards', type:1 },

  {
    name:'roll',
    description:'Roll characters',
    type:1,
    options:[
      { name:'amount', description:'1 to 10', type:4, required:false, min_value:1, max_value:10 }
    ]
  },

  { name:'banner', description:'Show active banner', type:1 },
  { name:'pack', description:'Open featured banner pack', type:1 },
  { name:'rates', description:'Show roll rates', type:1 },

  {
    name:'inventory',
    description:'Show inventory',
    type:1,
    options:[
      { name:'character', description:'Character filter', type:3, required:false },
      { name:'anime', description:'Anime filter', type:3, required:false },
      { name:'page', description:'Page', type:4, required:false }
    ]
  },

  {
    name:'character',
    description:'Search character',
    type:1,
    options:[
      { name:'name', description:'Character name', type:3, required:true }
    ]
  },

  {
    name:'anime',
    description:'Show anime collection',
    type:1,
    options:[
      { name:'anime', description:'Anime name', type:3, required:true }
    ]
  },

  {
    name:'who-has',
    description:'Find owners of a character',
    type:1,
    options:[
      { name:'name', description:'Character name', type:3, required:true }
    ]
  },

  { name:'story', description:'Play story battle', type:1 },

  {
    name:'dungeon',
    description:'Start dungeon battle',
    type:1,
    options:[
      {
        name:'type',
        description:'Dungeon type',
        type:3,
        required:true,
        choices:[
          { name:'normal', value:'normal' },
          { name:'elite', value:'elite' },
          { name:'abyss', value:'abyss' },
          { name:'void', value:'void' }
        ]
      }
    ]
  },

  {
    name:'pvp',
    description:'Fight another player',
    type:1,
    options:[
      { name:'opponent', description:'Opponent', type:6, required:true }
    ]
  },

  { name:'world-boss', description:'Show world boss', type:1 },
  { name:'raid', description:'Show active raid', type:1 },
  { name:'raid-attack', description:'Attack raid boss', type:1 },
  { name:'raid-rank', description:'Show raid ranking', type:1 },

  { name:'formations', description:'Show formations', type:1 },
  { name:'market', description:'Show market', type:1 }
];

async function request(method, url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}\n${text}`);
    }

    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const guildUrl = `https://discord.com/api/v10/applications/${clientId}/guilds/${guildId}/commands`;
  const globalUrl = `https://discord.com/api/v10/applications/${clientId}/commands`;

  console.log('1) Clearing guild commands only...');
  await request('PUT', guildUrl, []);
  console.log('✅ Guild commands cleared');

  console.log(`2) Deploying fast clean guild commands: ${commands.length}`);
  await request('PUT', guildUrl, commands);
  console.log('✅ Fast guild commands deployed');

  console.log('3) Clearing global commands only...');
  await request('PUT', globalUrl, []);
  console.log('✅ Global commands cleared');

  console.log('');
  console.log('Done. Open Discord and type /');
}

main().catch(err => {
  console.error('❌ Fast guild deploy failed:');
  console.error(err.message || err);
  process.exit(1);
});
