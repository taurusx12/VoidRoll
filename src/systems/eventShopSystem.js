// VoidRoll Reborn — FULL LAUNCH — Event Shop System
const { EmbedBuilder } = require('discord.js');

const SHOP = [
  { id:'event_roll', name:'Event Roll', cost:100, reward:{ eventRolls:1 } },
  { id:'pity_shards', name:'Corrupted Pity Shards x5', cost:250, reward:{ corruptedPityShards:5 } },
  { id:'void_pack', name:'Void Crystal Pack', cost:150, reward:{ voidCrystals:50 } },
  { id:'secret_soul', name:'Secret Soul', cost:1000, reward:{ secretSoul:1 } }
];

function line(item){ return `\`${item.id}\` **${item.name}** — Cost **${item.cost} Corrupted Fragments**`; }

async function handleCommand(i, prisma, rollBank){
  if(i.commandName==='event-shop'){
    return i.reply({embeds:[new EmbedBuilder().setTitle('👑 Corrupted Event Shop').setDescription(SHOP.map(line).join('\n')).setColor(0x7c3aed)]});
  }
  if(i.commandName==='event-buy'){
    const id=i.options.getString('item_id',true);
    const item=SHOP.find(x=>x.id===id);
    if(!item) return i.reply({content:'Item not found.',ephemeral:true});
    const u=await prisma.user.findUnique({where:{id:i.user.id}});
    const meta=(u.meta&&typeof u.meta==='object'&&!Array.isArray(u.meta))?u.meta:{};
    meta.resources=meta.resources||{};
    const have=Number(meta.resources.corruptedFragments||0);
    if(have<item.cost) return i.reply(`Need **${item.cost} Corrupted Fragments**, you have **${have}**.`);
    meta.resources.corruptedFragments=have-item.cost;
    for(const [k,v] of Object.entries(item.reward)){
      if(k==='eventRolls') await rollBank.addEvent(prisma,i.user.id,v);
      else meta.resources[k]=(Number(meta.resources[k]||0)+v);
    }
    await prisma.user.update({where:{id:i.user.id},data:{meta}});
    return i.reply(`Bought **${item.name}**.`);
  }
  return false;
}
function commandDefinitions(){return[
  {name:'event-shop',description:'Open the Corrupted Event Shop',type:1},
  {name:'event-buy',description:'Buy from event shop',type:1,options:[{name:'item_id',description:'Item ID',type:3,required:true}]}
];}
module.exports={handleCommand,commandDefinitions};
