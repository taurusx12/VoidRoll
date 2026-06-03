// VoidRoll Reborn — FULL LAUNCH — Boss Contracts System
const { EmbedBuilder } = require('discord.js');

const CONTRACTS = [
  { id:'void_beast', name:'Void Beast', difficulty:'Normal', reward:{ gold:40000, ascension:20, bankedRolls:2 } },
  { id:'soul_warden', name:'Soul Warden', difficulty:'Hard', reward:{ gold:70000, eventRolls:1, relicScraps:10 } },
  { id:'corrupted_echo', name:'Corrupted Echo', difficulty:'Event', reward:{ gold:90000, corruptedFragments:120, corruptedPityShards:2 } }
];

function rewardLine(r){ return Object.entries(r).map(([k,v])=>`+${v} ${k}`).join(', '); }

async function give(prisma, rollBank, userId, reward){
  const data={};
  if(reward.gold) data.gold={increment:reward.gold};
  if(reward.ascension) data.ascension={increment:reward.ascension};
  if(Object.keys(data).length) await prisma.user.update({where:{id:String(userId)},data}).catch(()=>{});
  if(reward.bankedRolls) await rollBank.addBankedNormal(prisma,userId,reward.bankedRolls);
  if(reward.eventRolls) await rollBank.addEvent(prisma,userId,reward.eventRolls);
  const u=await prisma.user.findUnique({where:{id:String(userId)}}).catch(()=>null);
  if(u){ const meta=(u.meta&&typeof u.meta==='object'&&!Array.isArray(u.meta))?u.meta:{}; meta.resources=meta.resources||{}; for(const k of ['relicScraps','corruptedFragments','corruptedPityShards']) if(reward[k]) meta.resources[k]=(Number(meta.resources[k]||0)+reward[k]); await prisma.user.update({where:{id:String(userId)},data:{meta}}).catch(()=>{}); }
}

async function handleCommand(i, prisma, rollBank){
  if(i.commandName==='contracts'){
    const lines=CONTRACTS.map((c,idx)=>`${idx+1}. **${c.name}** [${c.difficulty}] — ${rewardLine(c.reward)}`).join('\n');
    return i.reply({embeds:[new EmbedBuilder().setTitle('📜 Boss Contracts').setDescription(`${lines}\n\nUse \`/contract-start number:1\`.`).setColor(0xe67e22)]});
  }
  if(i.commandName==='contract-start'){
    const n=Math.max(1,i.options.getInteger('number')||1);
    const c=CONTRACTS[n-1];
    if(!c) return i.reply({content:'Contract not found.',ephemeral:true});
    const win=Math.random()<0.78;
    if(!win) return i.reply(`Contract failed against **${c.name}**. Upgrade your team and try again.`);
    await give(prisma,rollBank,i.user.id,c.reward);
    return i.reply(`Contract cleared: **${c.name}**\nRewards: ${rewardLine(c.reward)}`);
  }
  return false;
}

function commandDefinitions(){
  return [
    {name:'contracts',description:'Show daily Boss Contracts',type:1},
    {name:'contract-start',description:'Start a Boss Contract',type:1,options:[{name:'number',description:'Contract number',type:4,required:true}]}
  ];
}

module.exports={handleCommand,commandDefinitions};
