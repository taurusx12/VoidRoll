// VoidRoll Reborn — FULL LAUNCH — Banner System
// Adds Premium/Event banner commands without breaking existing /roll.

const { EmbedBuilder } = require('discord.js');

function money(n){ return Number(n||0).toLocaleString('en-US'); }
function emoji(r){ return ({COMMON:'🟢',RARE:'🔵',EPIC:'🟣',LEGENDARY:'🟡',MYTHIC:'🔴',DIVINE:'💠',VOIDBORN:'🌌',SECRET:'👑'}[r] || '🎴'); }
function clean(n){ return String(n||'Unknown').replace(/^Corrupted\s+/i,'Corrupted '); }

async function randomCharacterByRarity(prisma, rarity, corruptedOnly=false){
  const where = corruptedOnly
    ? { active:true, rarity:'SECRET', name:{ contains:'Corrupted' } }
    : { active:true, rarity };
  const count = await prisma.character.count({where}).catch(()=>0);
  if(!count) return null;
  const skip = Math.floor(Math.random()*count);
  return prisma.character.findFirst({where,skip}).catch(()=>null);
}

function pickEventRarity(){
  const x = Math.random()*100;
  if(x < 1.0) return 'SECRET';
  if(x < 3.0) return 'VOIDBORN';
  if(x < 8.0) return 'DIVINE';
  if(x < 23.0) return 'MYTHIC';
  if(x < 50.0) return 'LEGENDARY';
  return 'EPIC';
}

async function createCard(prisma,userId,c){
  const power=Math.floor(Number(c.basePower||1000)*(0.9+Math.random()*0.25));
  return prisma.userCard.create({data:{userId,characterId:c.id,level:1,power}}).catch(async()=>null);
}

async function handleCommand(i, prisma, rollBank){
  if(i.commandName==='premium-roll'){
    await i.deferReply();
    const amount=Math.max(1,Math.min(10,i.options.getInteger('amount')||1));
    const spend=await rollBank.spendPremium(prisma,i.user.id,amount);
    if(!spend.ok) return i.editReply(`Not enough Premium Rolls. You have **${spend.state.premium}**.`);
    const lines=[];
    for(let k=0;k<amount;k++){
      const rarity=rollBank.pickPremiumRarity();
      const c=await randomCharacterByRarity(prisma,rarity,false);
      if(!c) continue;
      const card=await createCard(prisma,i.user.id,c);
      lines.push(`${k+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.rarity} • PWR **${money(card?.power||0)}**`);
    }
    return i.editReply(`**PREMIUM ROLL x${amount}**\nHighest launch rarity: **DIVINE**\n\n${lines.join('\n')}`);
  }

  if(i.commandName==='event-roll'){
    await i.deferReply();
    const amount=Math.max(1,Math.min(10,i.options.getInteger('amount')||1));
    const spend=await rollBank.spendEvent(prisma,i.user.id,amount);
    if(!spend.ok) return i.editReply(`Not enough Event Rolls. You have **${spend.state.event}**.`);
    const lines=[];
    const embeds=[];
    for(let k=0;k<amount;k++){
      let rarity=pickEventRarity();
      const c=await randomCharacterByRarity(prisma,rarity,rarity==='SECRET');
      if(!c) continue;
      const card=await createCard(prisma,i.user.id,c);
      lines.push(`${k+1}. ${emoji(c.rarity)} **${clean(c.name)}** • ${c.rarity} • PWR **${money(card?.power||0)}**`);
      if(c.rarity==='SECRET'){
        const e=new EmbedBuilder().setTitle(`👑 CORRUPTED SECRET REVEAL`).setDescription(`**${clean(c.name)}** has emerged from the void.`).setColor(0x7c3aed);
        if(c.imageUrl)e.setImage(c.imageUrl);
        embeds.push(e);
      }
    }
    return i.editReply({content:`**CORRUPTED EVENT ROLL x${amount}**\n\n${lines.join('\n')}`.slice(0,1900),embeds});
  }
  return false;
}

function commandDefinitions(){
  return [
    {name:'premium-roll',description:'Roll on Premium Banner using Premium Rolls',type:1,options:[{name:'amount',description:'Amount 1-10',type:4,required:false}]},
    {name:'event-roll',description:'Roll on Corrupted Event Banner using Event Rolls',type:1,options:[{name:'amount',description:'Amount 1-10',type:4,required:false}]}
  ];
}
module.exports={handleCommand,commandDefinitions};
