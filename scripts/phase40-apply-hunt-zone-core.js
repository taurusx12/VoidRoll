const fs=require('fs'), path=require('path');
const indexPath=path.join(process.cwd(),'src','index.js');
const deployPath=path.join(process.cwd(),'scripts','phase27-fast-guild-deploy.js');
if(!fs.existsSync(indexPath)){console.error('src/index.js not found');process.exit(1);}
let s=fs.readFileSync(indexPath,'utf8');
fs.copyFileSync(indexPath,path.join(process.cwd(),'src',`index.backup-phase40-hunt-${Date.now()}.js`));
if(!s.includes("require('./systems/huntZoneSystem')")){
 const anchor="const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');";
 if(s.includes(anchor)) s=s.replace(anchor,`${anchor}\nconst huntZoneSystem = require('./systems/huntZoneSystem');`);
 else s=s.replace("const { prisma } = require('./lib/db');","const { prisma } = require('./lib/db');\nconst huntZoneSystem = require('./systems/huntZoneSystem');");
}
if(!s.includes('PHASE40_HUNT_ZONE_BUTTON_HANDLER')){
 const anchor="if (!i.isChatInputCommand()) return;";
 if(s.includes(anchor)) s=s.replace(anchor,`if (i.isButton?.() && String(i.customId || '').startsWith('hunt_')) {\n    return huntZoneSystem.handleHuntCommand(i, prisma).catch(err => { console.error('Hunt button error:', err); if (!i.replied && !i.deferred) i.reply({ content:'Hunt error.', ephemeral:true }).catch(()=>{}); });\n  }\n  // PHASE40_HUNT_ZONE_BUTTON_HANDLER\n  ${anchor}`);
}
if(!s.includes('PHASE40_HUNT_ZONE_COMMAND_HANDLER')){
 const anchor="const commandName = i.commandName;";
 if(s.includes(anchor)) s=s.replace(anchor,`${anchor}\n  if (['hunt','hunt-next','hunt-pick','hunt-extract','hunt-abandon'].includes(commandName)) return huntZoneSystem.handleHuntCommand(i, prisma);\n  // PHASE40_HUNT_ZONE_COMMAND_HANDLER`);
}
s=s.replace("Battle: /story /tower /dungeon /boss-rush /pvp","Battle: /hunt /hunt-next /hunt-pick /hunt-extract /story /tower /dungeon /boss-rush /pvp");
if(!s.includes('PHASE40_HUNT_ZONE_CORE')) s='// PHASE40_HUNT_ZONE_CORE\n'+s;
fs.writeFileSync(indexPath,s,'utf8');
console.log('✅ index.js patched for Hunt Zone');

if(fs.existsSync(deployPath)){
 let d=fs.readFileSync(deployPath,'utf8');
 fs.copyFileSync(deployPath,path.join(process.cwd(),'scripts',`phase27-fast-guild-deploy.backup-phase40-hunt-${Date.now()}.js`));
 if(!d.includes("name:'hunt'")&&!d.includes('name:"hunt"')){
  const pos=d.indexOf('const commands = [');
  if(pos!==-1){ const b=d.indexOf('[',pos)+1; d=d.slice(0,b)+"\n  ...require('../src/systems/huntZoneSystem').commandDefinitions(),\n"+d.slice(b); }
 }
 if(!d.includes('PHASE40_HUNT_ZONE_CORE')) d='// PHASE40_HUNT_ZONE_CORE\n'+d;
 fs.writeFileSync(deployPath,d,'utf8');
 console.log('✅ deploy script patched for Hunt Zone commands');
}
console.log('Next: node --check src/index.js && node --check src/systems/huntZoneSystem.js');
