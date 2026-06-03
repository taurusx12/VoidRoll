// VoidRoll Reborn — FULL LAUNCH — Corrupted Raid System
const fs=require('fs');
const path=require('path');
const { EmbedBuilder }=require('discord.js');
const DATA=path.join(process.cwd(),'data');
const FILE=path.join(DATA,'corrupted-raid.json');
function ensure(){if(!fs.existsSync(DATA))fs.mkdirSync(DATA,{recursive:true});if(!fs.existsSync(FILE))fs.writeFileSync(FILE,JSON.stringify({boss:'Corrupted Monarch',hp:100000000,maxHp:100000000,damage:{}}));}
function read(){ensure();try{return JSON.parse(fs.readFileSync(FILE,'utf8'));}catch{return{boss:'Corrupted Monarch',hp:100000000,maxHp:100000000,damage:{}};}}
function write(x){ensure();fs.writeFileSync(FILE,JSON.stringify(x,null,2));}
function money(n){return Number(n||0).toLocaleString('en-US');}
async function handleCommand(i,prisma,rollBank){
  const raid=read();
  if(i.commandName==='corrupted-raid'){
    const top=Object.entries(raid.damage||{}).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([u,d],idx)=>`${idx+1}. <@${u}> — ${money(d)} DMG`).join('\n')||'No damage yet.';
    return i.reply({embeds:[new EmbedBuilder().setTitle(`👑 ${raid.boss}`).setDescription(`HP: **${money(raid.hp)}/${money(raid.maxHp)}**\n\n**Top Damage**\n${top}\n\nUse \`/raid-attack\`.`).setColor(0x7c3aed)]});
  }
  if(i.commandName==='raid-attack'){
    const dmg=Math.floor(250000+Math.random()*1250000);
    raid.hp=Math.max(0,Number(raid.hp)-dmg);
    raid.damage[i.user.id]=Number(raid.damage[i.user.id]||0)+dmg;
    write(raid);
    await rollBank.addEvent(prisma,i.user.id,Math.random()<0.08?1:0);
    return i.reply(`You dealt **${money(dmg)}** damage to **${raid.boss}**.\nBoss HP: **${money(raid.hp)}**`);
  }
  return false;
}
function commandDefinitions(){return[
  {name:'corrupted-raid',description:'Show weekly Corrupted Raid boss',type:1},
  {name:'raid-attack',description:'Attack the weekly Corrupted Raid boss',type:1}
];}
module.exports={handleCommand,commandDefinitions};
