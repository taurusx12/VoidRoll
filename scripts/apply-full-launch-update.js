// VoidRoll Reborn — FULL LAUNCH — Apply Everything
// Wires all new systems into src/index.js and deploy script.
// Run:
//   node scripts/apply-full-launch-update.js
//   node --check src/index.js
//   node --check src/systems/rollBankSystem.js
//   node --check src/systems/huntZoneSystem.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   node scripts/official-fix-corrupted-10-images.js
//   npm start

const fs=require('fs');
const path=require('path');

const indexPath=path.join(process.cwd(),'src','index.js');
const deployPath=path.join(process.cwd(),'scripts','phase27-fast-guild-deploy.js');

if(!fs.existsSync(indexPath)){console.error('❌ src/index.js not found');process.exit(1);}
let s=fs.readFileSync(indexPath,'utf8');
const backup=path.join(process.cwd(),'src',`index.backup-full-launch-${Date.now()}.js`);
fs.copyFileSync(indexPath,backup);

const imports=[
 "const rollBank = require('./systems/rollBankSystem');",
 "const huntZoneSystem = require('./systems/huntZoneSystem');",
 "const bountyBoardSystem = require('./systems/bountyBoardSystem');",
 "const bossContractsSystem = require('./systems/bossContractsSystem');",
 "const relicSystem = require('./systems/relicSystem');",
 "const traitsSystem = require('./systems/traitsSystem');",
 "const eventShopSystem = require('./systems/eventShopSystem');",
 "const corruptedRaidSystem = require('./systems/corruptedRaidSystem');",
 "const bannerSystem = require('./systems/bannerSystem');"
];

for(const line of imports){
 if(!s.includes(line)){
  const reqs=[...s.matchAll(/^const .+require\(.+\);$/gm)];
  if(reqs.length){const last=reqs[reqs.length-1];const pos=last.index+last[0].length;s=s.slice(0,pos)+'\n'+line+s.slice(pos);}
  else s=line+'\n'+s;
 }
}
console.log('✅ Imports ensured');

function findBlock(src,startText){const st=src.indexOf(startText);if(st<0)return null;const brace=src.indexOf('{',st);if(brace<0)return null;let depth=0,quote=null,esc=false;for(let i=brace;i<src.length;i++){const ch=src[i];if(quote){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===quote)quote=null;continue;} if(ch==='"'||ch==="'"||ch==='`')quote=ch;else if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return[st,i+1];}}return null;}
function replaceBlock(src,start,repl){const r=findBlock(src,start);if(!r){console.log('⚠️ missing block '+start);return src;}return src.slice(0,r[0])+repl+src.slice(r[1]);}

// Official route after commandName.
if(!s.includes('// FULL_LAUNCH_COMMAND_ROUTE')){
 const needle="const commandName = i.commandName; const userId = i.user.id;";
 const route=`const commandName = i.commandName; const userId = i.user.id;
  // FULL_LAUNCH_COMMAND_ROUTE
  if (commandName === 'rolls') return rollBank.handleRollsCommand(i, prisma);
  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleCommand(i, prisma, rollBank);
  if (['bounty','bounties','bounty-claim'].includes(commandName)) return bountyBoardSystem.handleCommand(i, prisma, rollBank);
  if (['contracts','contract-start'].includes(commandName)) return bossContractsSystem.handleCommand(i, prisma, rollBank);
  if (['relics','relic-give','relic-upgrade','relic-equip'].includes(commandName)) return relicSystem.handleCommand(i, prisma, rollBank);
  if (['traits','trait-set'].includes(commandName)) return traitsSystem.handleCommand(i, prisma, rollBank);
  if (['event-shop','event-buy'].includes(commandName)) return eventShopSystem.handleCommand(i, prisma, rollBank);
  if (['corrupted-raid','raid-attack'].includes(commandName)) return corruptedRaidSystem.handleCommand(i, prisma, rollBank);
  if (['premium-roll','event-roll'].includes(commandName)) return bannerSystem.handleCommand(i, prisma, rollBank);`;
 if(s.includes(needle))s=s.replace(needle,route); else console.log('⚠️ commandName route anchor not found');
}

// Patch wallet/profile.
const walletBlock=`if (commandName === 'profile' || commandName === 'wallet') {
    const u = await ensureUser(i.user);
    const count = await prisma.userCard.count({ where:{ userId } });
    const rs = await rollBank.getRollState(prisma, userId);
    const rollText = rollBank.walletLines(rs);
    return i.reply({
      embeds:[new EmbedBuilder().setTitle(\`🌌 \${i.user.username} — VoidRoll Reborn\`).setDescription(
        \`Gold: **\${money(u.gold)}**\\n\` +
        \`Tokens: **\${money(u.tokens)}**\\n\` +
        \`Essence: **\${money(u.essence || 0)}**\\n\` +
        \`Void Crystals: **\${money(u.voidCrystals || 0)}**\\n\` +
        \`Cards: **\${count}**\\n\` +
        \`Story: **\${u.storyChapter}-\${u.storyStage}**\\n\\n\` +
        rollText
      ).setColor(0x7c3aed)]
    });
  }`;
s=replaceBlock(s,"if (commandName === 'profile' || commandName === 'wallet')",walletBlock);

// Patch roll.
const rollBlock=`if (commandName === 'roll' || commandName === 'r') {
    await i.deferReply();
    const amount = clamp(i.options.getInteger('amount') || 1, 1, 10);
    const spend = await rollBank.spendNormal(prisma, userId, amount);

    if (!spend.ok) {
      return i.editReply(
        \`Not enough Normal Rolls.\\n\` +
        \`Free Rolls: **\${spend.state.free}/30**\\n\` +
        \`Banked Normal Rolls: **\${spend.state.bankedNormal}**\\n\` +
        \`Total Normal Rolls: **\${spend.state.totalNormal}**\\n\` +
        \`Need: **\${amount}**\`
      );
    }

    const lines = [];
    const embeds = [];
    for (let x=0; x<amount; x++) {
      const r = rollBank.pickStandardRarity();
      const c = await randomCharacterByRarity(r);
      if (!c) continue;
      const card = await createCard(userId,c);
      lines.push(\`\${x+1}. \${emoji(c.rarity)} **\${clean(c.name)}** • \${c.anime} • \${c.rarity} • PWR **\${money(card.power)}**\`);
      if (amount <= 3) {
        const e = new EmbedBuilder().setTitle(\`\${emoji(c.rarity)} \${clean(c.name)}\`).setDescription(\`\${c.anime}\\n\${statBlock(card,c)}\`).setColor(c.rarity==='DIVINE'?0xf1c40f:0x5865f2);
        if (c.imageUrl) e.setImage(c.imageUrl);
        embeds.push(e);
      }
    }

    const after = await rollBank.getRollState(prisma, userId);
    return i.editReply({
      content:(\`**STANDARD ROLL x\${amount}**\\nSpent: **\${spend.fromFree} Free** + **\${spend.fromBanked} Banked**\\nRemaining Normal Rolls: **\${after.totalNormal}** (Free **\${after.free}/30**, Banked **\${after.bankedNormal}**)\\nHighest possible rarity: **DIVINE**\\n\\n\` + lines.join('\\n')).slice(0,1900),
      embeds
    });
  }`;
s=replaceBlock(s,"if (commandName === 'roll' || commandName === 'r')",rollBlock);

// Patch rates.
s=s.replace(/if \(commandName === 'rates' \|\| commandName === 'rarity'\) return i\.reply\([^;]+;/,
"if (commandName === 'rates' || commandName === 'rarity') return i.reply('**Standard / Normal Roll Rates**\\nCommon 69.75%\\nRare 22%\\nEpic 6%\\nLegendary 1.4%\\nMythic 0.75%\\nDivine 0.10%\\n\\nStandard Banner highest rarity: **DIVINE**\\nNo Secret / No Corrupted from Normal Rolls.');");

// Patch daily to banked rolls too.
if(!s.includes('FULL_LAUNCH_DAILY_BANKED_ROLLS')){
 s=s.replace("rolls:{increment:5}}}); return i.reply('Daily claimed: **50,000 Gold**, **100 Tokens**, **25 Essence**, **5 Rolls**.');",
 "rolls:{increment:5}}}); await rollBank.addBankedNormal(prisma, userId, 5); // FULL_LAUNCH_DAILY_BANKED_ROLLS\n    return i.reply('Daily claimed: **50,000 Gold**, **100 Tokens**, **25 Essence**, **5 Banked Normal Rolls**.');");
}

// Replace interactionCreate block to route hunt buttons before trade buttons.
const interactionRegex=/client\.on\('interactionCreate', async i => \{\n[\s\S]*?\n\}\);\n\nclient\.once\(/;
const block=`client.on('interactionCreate', async i => {
  try {
    if (i.isAutocomplete()) return autocomplete(i);

    if (i.isButton()) {
      const customId = String(i.customId || '');
      if (customId.startsWith('hunt_')) return huntZoneSystem.handleCommand(i, prisma, rollBank);

      const [action, tradeId] = customId.split('_');
      if (action === 'accept' || action === 'decline') {
        await i.deferReply({ ephemeral:false }).catch(()=>{});
        if (action === 'accept') return completeTrade(i, tradeId);
        pendingTrades.delete(tradeId);
        return i.editReply('Trade declined.');
      }
      return;
    }

    if (!i.isChatInputCommand()) return;
    return command(i);
  } catch (err) {
    console.error(err);
    const msg = \`Error: \${String(err.message || err).slice(0,1500)}\`;
    if (i.deferred || i.replied) return i.editReply(msg).catch(()=>{});
    return i.reply({ content: msg, ephemeral:true }).catch(()=>{});
  }
});

// FULL_LAUNCH_BUTTON_ROUTE

client.once(`;
if(interactionRegex.test(s)) s=s.replace(interactionRegex,block); else console.log('⚠️ interactionCreate block not replaced');

if(!s.includes('// FULL_LAUNCH_READY')) s='// FULL_LAUNCH_READY\n'+s;
fs.writeFileSync(indexPath,s);
console.log('✅ index.js patched. Backup:', path.relative(process.cwd(),backup));

// Patch deploy script
if(fs.existsSync(deployPath)){
 let d=fs.readFileSync(deployPath,'utf8');
 const backupDeploy=path.join(process.cwd(),'scripts',`phase27-fast-guild-deploy.backup-full-launch-${Date.now()}.js`);
 fs.copyFileSync(deployPath,backupDeploy);
 if(!d.includes('FULL_LAUNCH_COMMAND_DEFINITIONS')){
  const req=`
// FULL_LAUNCH_COMMAND_DEFINITIONS
const fullLaunchCommands = [
  ...require('../src/systems/rollBankSystem').commandDefinitions(),
  ...require('../src/systems/huntZoneSystem').commandDefinitions(),
  ...require('../src/systems/bountyBoardSystem').commandDefinitions(),
  ...require('../src/systems/bossContractsSystem').commandDefinitions(),
  ...require('../src/systems/relicSystem').commandDefinitions(),
  ...require('../src/systems/traitsSystem').commandDefinitions(),
  ...require('../src/systems/eventShopSystem').commandDefinitions(),
  ...require('../src/systems/corruptedRaidSystem').commandDefinitions(),
  ...require('../src/systems/bannerSystem').commandDefinitions(),
];
`;
  d=req+'\n'+d;
  const pos=d.indexOf('const commands = [');
  if(pos!==-1){const b=d.indexOf('[',pos)+1;d=d.slice(0,b)+'\n  ...fullLaunchCommands,\n'+d.slice(b);}
 }
 fs.writeFileSync(deployPath,d);
 console.log('✅ deploy script patched. Backup:', path.relative(process.cwd(),backupDeploy));
}

console.log('\n✅ FULL LAUNCH UPDATE APPLIED');
console.log('Next:');
console.log('node --check src/index.js');
console.log('node --check src/systems/rollBankSystem.js');
console.log('node --check src/systems/huntZoneSystem.js');
console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
console.log('node scripts/official-fix-corrupted-10-images.js');
console.log('npm start');
