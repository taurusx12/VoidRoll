// VoidRoll Reborn — FULL LAUNCH — Bounty Board System
const { EmbedBuilder } = require('discord.js');

const DAILY = [
  { id:'hunt_rooms', text:'Clear 3 Hunt rooms', reward:{ gold:25000, bankedRolls:2, traitStones:2 } },
  { id:'roll_5', text:'Roll 5 times', reward:{ gold:15000, memoryShards:5 } },
  { id:'boss_2', text:'Defeat 2 bosses/contracts', reward:{ gold:35000, eventRolls:1 } }
];

const WEEKLY = [
  { id:'hunt_clear_5', text:'Clear 5 Hunt runs', reward:{ premiumRolls:2, corruptedPityShards:5 } },
  { id:'tower_50', text:'Reach Abyss Tower Floor 50', reward:{ premiumRolls:3, relicScraps:50 } },
  { id:'corrupted_1000', text:'Earn 1000 Corrupted Fragments', reward:{ eventRolls:3, corruptedPityShards:10 } }
];

function rewardLine(r){
  return Object.entries(r).map(([k,v])=>`+${v} ${k}`).join(', ');
}

async function addReward(prisma, rollBank, userId, reward){
  const data = {};
  if (reward.gold) data.gold = { increment: reward.gold };
  if (reward.ascension) data.ascension = { increment: reward.ascension };
  if (Object.keys(data).length) await prisma.user.update({ where:{ id:String(userId) }, data }).catch(()=>{});
  if (reward.bankedRolls) await rollBank.addBankedNormal(prisma,userId,reward.bankedRolls);
  if (reward.premiumRolls) await rollBank.addPremium(prisma,userId,reward.premiumRolls);
  if (reward.eventRolls) await rollBank.addEvent(prisma,userId,reward.eventRolls);
  const u = await prisma.user.findUnique({where:{id:String(userId)}}).catch(()=>null);
  if (u) {
    const meta = (u.meta && typeof u.meta==='object' && !Array.isArray(u.meta)) ? u.meta : {};
    meta.resources = meta.resources || {};
    for (const k of ['traitStones','memoryShards','relicScraps','corruptedPityShards']) if (reward[k]) meta.resources[k]=(Number(meta.resources[k]||0)+reward[k]);
    await prisma.user.update({where:{id:String(userId)},data:{meta}}).catch(()=>{});
  }
}

async function handleCommand(i, prisma, rollBank){
  if (i.commandName === 'bounty' || i.commandName === 'bounties') {
    const daily = DAILY.map((b,idx)=>`${idx+1}. **${b.text}** — ${rewardLine(b.reward)}`).join('\n');
    const weekly = WEEKLY.map((b,idx)=>`${idx+1}. **${b.text}** — ${rewardLine(b.reward)}`).join('\n');
    return i.reply({ embeds:[new EmbedBuilder().setTitle('📋 Bounty Board').setDescription(`**Daily Bounties**\n${daily}\n\n**Weekly Bounties**\n${weekly}\n\nUse \`/bounty-claim type:daily number:1\` for launch testing.`).setColor(0xf1c40f)] });
  }
  if (i.commandName === 'bounty-claim') {
    const type = i.options.getString('type') || 'daily';
    const number = Math.max(1, i.options.getInteger('number') || 1);
    const list = type === 'weekly' ? WEEKLY : DAILY;
    const bounty = list[number-1];
    if (!bounty) return i.reply({content:'Bounty not found.',ephemeral:true});
    await addReward(prisma, rollBank, i.user.id, bounty.reward);
    return i.reply(`Claimed **${bounty.text}**: ${rewardLine(bounty.reward)}`);
  }
  return false;
}

function commandDefinitions(){
  return [
    { name:'bounty', description:'Show daily and weekly bounties', type:1 },
    { name:'bounties', description:'Show daily and weekly bounties', type:1 },
    { name:'bounty-claim', description:'Claim a bounty reward', type:1, options:[{name:'type',description:'daily or weekly',type:3,required:false,choices:[{name:'Daily',value:'daily'},{name:'Weekly',value:'weekly'}]},{name:'number',description:'Bounty number',type:4,required:false}] }
  ];
}

module.exports = { handleCommand, commandDefinitions };
