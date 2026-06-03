// VoidRoll Reborn — FULL LAUNCH — Relic System
const fs=require('fs');
const path=require('path');
const { EmbedBuilder } = require('discord.js');

const DATA=path.join(process.cwd(),'data');
const FILE=path.join(DATA,'relics.json');
function ensure(){ if(!fs.existsSync(DATA)) fs.mkdirSync(DATA,{recursive:true}); if(!fs.existsSync(FILE)) fs.writeFileSync(FILE,'{}'); }
function read(){ ensure(); try{return JSON.parse(fs.readFileSync(FILE,'utf8')||'{}');}catch{return{};} }
function write(x){ ensure(); fs.writeFileSync(FILE,JSON.stringify(x,null,2)); }

const RELICS = {
  titan_core:{name:'Titan Core',type:'Core',desc:'+HP, +DEF, Boss Resistance'},
  void_crown:{name:'Void Crown',type:'Aura',desc:'+Energy Gain, +Skill Damage, Silence Chance'},
  soul_blade:{name:'Soul Blade',type:'Weapon',desc:'+ATK, +Crit, +Boss Damage'},
  cursed_eye:{name:'Cursed Eye',type:'Aura',desc:'+Debuff Chance, Enemy ATK Down'},
  hero_emblem:{name:'Hero Emblem',type:'Support',desc:'+Team Damage, Shield at battle start'},
  demon_heart:{name:'Demon Heart',type:'Core',desc:'+Lifesteal, +ATK, small -DEF'},
  phantom_cloak:{name:'Phantom Cloak',type:'Defense',desc:'+Dodge, +Crit, first hit reduction'},
  time_fragment:{name:'Time Fragment',type:'Aura',desc:'+Energy Gain, small chance to reuse skill'},
  blood_rune:{name:'Blood Rune',type:'Weapon',desc:'+ATK, Bleed Chance, execute bonus'},
  monarch_seal:{name:'Monarch Seal',type:'Control',desc:'+Control Chance, Team ATK, enemy debuff resistance down'},
  necro_orb:{name:'Necro Orb',type:'Soul',desc:'+Soul Damage, Summon Assist, Lifesteal'},
  corrupted_halo:{name:'Corrupted Halo',type:'Event',desc:'+Void Damage, Energy Gain, Corrupted Skill Chance'}
};

function userRelics(store,userId){ store[userId]=store[userId]||{inventory:[],equipped:{}}; return store[userId]; }
function makeRelic(key){ const r=RELICS[key]||RELICS.titan_core; return {id:`relic_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,key,name:r.name,type:r.type,level:0,rarity:key==='corrupted_halo'?'CORRUPTED':'EPIC'}; }

async function handleCommand(i, prisma){
  const store=read(), u=userRelics(store,i.user.id);
  if(i.commandName==='relics'){
    const inv=u.inventory.map((r,idx)=>`${idx+1}. **${r.name}** +${r.level} [${r.rarity}] ID \`${r.id}\``).join('\n')||'No relics yet.';
    const defs=Object.entries(RELICS).map(([k,r])=>`**${r.name}** \`${k}\` — ${r.desc}`).join('\n');
    return i.reply({embeds:[new EmbedBuilder().setTitle('🧿 Relics').setDescription(`**Your Relics**\n${inv}\n\n**Launch Relic Pool**\n${defs}`).setColor(0x9b59b6)]});
  }
  if(i.commandName==='relic-give'){
    const key=i.options.getString('relic')||'titan_core';
    const r=makeRelic(key);
    u.inventory.push(r); write(store);
    return i.reply(`Added relic: **${r.name}** ID \`${r.id}\``);
  }
  if(i.commandName==='relic-upgrade'){
    const rid=i.options.getString('relic_id',true);
    const r=u.inventory.find(x=>x.id===rid);
    if(!r) return i.reply({content:'Relic not found.',ephemeral:true});
    if(r.level>=5) return i.reply('Relic already +5.');
    r.level++; write(store);
    return i.reply(`Upgraded **${r.name}** to +${r.level}.`);
  }
  if(i.commandName==='relic-equip'){
    const card=i.options.getString('card_id',true);
    const rid=i.options.getString('relic_id',true);
    const r=u.inventory.find(x=>x.id===rid);
    if(!r) return i.reply({content:'Relic not found.',ephemeral:true});
    u.equipped[card]=rid; write(store);
    return i.reply(`Equipped **${r.name}** to card \`${card}\`.`);
  }
  return false;
}

function commandDefinitions(){
  return [
    {name:'relics',description:'Show your relics and relic pool',type:1},
    {name:'relic-give',description:'Admin/test: give a relic',type:1,options:[{name:'relic',description:'Relic key',type:3,required:false,choices:Object.keys(RELICS).map(k=>({name:RELICS[k].name,value:k}))}]},
    {name:'relic-upgrade',description:'Upgrade a relic to +5',type:1,options:[{name:'relic_id',description:'Relic ID',type:3,required:true}]},
    {name:'relic-equip',description:'Equip one relic to a card',type:1,options:[{name:'card_id',description:'Card ID',type:3,required:true},{name:'relic_id',description:'Relic ID',type:3,required:true}]}
  ];
}
module.exports={RELICS,handleCommand,commandDefinitions};
