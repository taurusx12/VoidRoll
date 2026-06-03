// VoidRoll Reborn — FULL LAUNCH — Traits System
const fs=require('fs');
const path=require('path');
const { EmbedBuilder }=require('discord.js');
const DATA=path.join(process.cwd(),'data');
const FILE=path.join(DATA,'traits.json');
function ensure(){ if(!fs.existsSync(DATA)) fs.mkdirSync(DATA,{recursive:true}); if(!fs.existsSync(FILE)) fs.writeFileSync(FILE,'{}'); }
function read(){ ensure(); try{return JSON.parse(fs.readFileSync(FILE,'utf8')||'{}');}catch{return{};} }
function write(x){ ensure(); fs.writeFileSync(FILE,JSON.stringify(x,null,2)); }
const TRAITS={aggressive:'+ATK',focused:'+Energy Gain',lucky:'+Resources',guardian:'+HP/DEF',executioner:'+Boss Damage',controller:'+Debuff Chance'};
async function handleCommand(i){
  const store=read(); store[i.user.id]=store[i.user.id]||{};
  if(i.commandName==='traits'){
    const lines=Object.entries(TRAITS).map(([k,v])=>`**${k}** — ${v}`).join('\n');
    const owned=Object.entries(store[i.user.id]).map(([card,t])=>`\`${card}\` → **${t}**`).join('\n')||'No traits assigned.';
    return i.reply({embeds:[new EmbedBuilder().setTitle('🧬 Traits').setDescription(`**Trait Pool**\n${lines}\n\n**Your Card Traits**\n${owned}`).setColor(0x1abc9c)]});
  }
  if(i.commandName==='trait-set'){
    const card=i.options.getString('card_id',true), trait=i.options.getString('trait',true);
    if(!TRAITS[trait]) return i.reply({content:'Trait not found.',ephemeral:true});
    store[i.user.id][card]=trait; write(store);
    return i.reply(`Set card \`${card}\` trait to **${trait}** (${TRAITS[trait]}).`);
  }
  return false;
}
function commandDefinitions(){return[
  {name:'traits',description:'Show traits',type:1},
  {name:'trait-set',description:'Set a trait on a card',type:1,options:[{name:'card_id',description:'Card ID',type:3,required:true},{name:'trait',description:'Trait',type:3,required:true,choices:Object.keys(TRAITS).map(k=>({name:k,value:k}))}]}
];}
module.exports={TRAITS,handleCommand,commandDefinitions};
