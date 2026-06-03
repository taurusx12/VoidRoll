// VoidRoll Reborn — FULL LAUNCH — Hunt Zone System
// Main loop: rooms, temporary buffs, free wizard, merchant, random events, risk/reward, extract.
// Buffs are run-only and never leave Hunt.

const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DATA_DIR = path.join(process.cwd(), 'data');
const RUNS_FILE = path.join(DATA_DIR, 'hunt-runs.json');

function ensureData(){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true}); if(!fs.existsSync(RUNS_FILE)) fs.writeFileSync(RUNS_FILE,'{}','utf8'); }
function readRuns(){ ensureData(); try{return JSON.parse(fs.readFileSync(RUNS_FILE,'utf8')||'{}');}catch{return{};} }
function writeRuns(runs){ ensureData(); fs.writeFileSync(RUNS_FILE, JSON.stringify(runs,null,2)); }
function money(n){ return Number(n||0).toLocaleString('en-US'); }
function rand(a,b){ return Math.floor(a+Math.random()*(b-a+1)); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function chance(p){ return Math.random()<p; }

const ZONES = {
  void_forest:{ id:'void_forest', name:'Void Forest', emoji:'🌲', resource:'Void Crystals', color:0x5865f2 },
  cursed_city:{ id:'cursed_city', name:'Cursed City', emoji:'🏙️', resource:'Trait Stones', color:0x8b5cf6 },
  soul_palace:{ id:'soul_palace', name:'Soul Palace', emoji:'🏯', resource:'Soul Dust', color:0x60a5fa },
  titan_ruins:{ id:'titan_ruins', name:'Titan Ruins', emoji:'🗿', resource:'Ascension Stones', color:0xf59e0b },
  corrupted_throne:{ id:'corrupted_throne', name:'Corrupted Throne', emoji:'👑', resource:'Corrupted Fragments', color:0x7c3aed },
  hero_arena:{ id:'hero_arena', name:'Hero Arena', emoji:'🛡️', resource:'Hero Medals', color:0x2ecc71 }
};

const DIFFICULTIES = {
  normal:{ name:'Normal', rooms:6, enemy:1, reward:1, rare:1 },
  hard:{ name:'Hard', rooms:8, enemy:1.35, reward:1.35, rare:1.25 },
  nightmare:{ name:'Nightmare', rooms:10, enemy:1.85, reward:1.85, rare:1.6 },
  abyss:{ name:'Abyss', rooms:12, enemy:2.5, reward:2.5, rare:2.1 },
  corrupted:{ name:'Corrupted', rooms:15, enemy:3.2, reward:3.25, rare:3 }
};

const BUFFS = [
  { id:'blood_rush', name:'Blood Rush', rarity:'COMMON', buff:'+12% ATK', debuff:'No debuff', stats:{atk:12} },
  { id:'iron_skin', name:'Iron Skin', rarity:'COMMON', buff:'+16% HP', debuff:'No debuff', stats:{hp:16} },
  { id:'void_flow', name:'Void Flow', rarity:'RARE', buff:'+14 Energy Gain', debuff:'No debuff', stats:{energy:14} },
  { id:'hunter_luck', name:'Hunter Luck', rarity:'RARE', buff:'+12% Resources', debuff:'No debuff', stats:{resources:12} },
  { id:'boss_mark', name:'Boss Mark', rarity:'EPIC', buff:'+18% Boss Damage', debuff:'No debuff', stats:{bossDmg:18} },
  { id:'guardian_sigil', name:'Guardian Sigil', rarity:'EPIC', buff:'Start battle with Shield', debuff:'No debuff', stats:{shield:1} }
];

const WIZARD = [
  { id:'ultimate_surge', name:'Ultimate Surge', rarity:'RARE', buff:'+22 Energy Gain', debuff:'-6% DEF', stats:{energy:22,def:-6} },
  { id:'blood_pact', name:'Blood Pact', rarity:'EPIC', buff:'+24% ATK', debuff:'-8% Max HP', stats:{atk:24,hp:-8} },
  { id:'glass_focus', name:'Glass Focus', rarity:'RARE', buff:'+18% Crit', debuff:'-5% Dodge', stats:{crit:18,dodge:-5} },
  { id:'void_hunger', name:'Void Hunger', rarity:'EPIC', buff:'+14% Lifesteal', debuff:'Lose 3 HP after each room', stats:{lifesteal:14,roomHpLoss:3} },
  { id:'dark_contract', name:'Dark Contract', rarity:'LEGENDARY', buff:'+28% Rewards', debuff:'Enemies +10% stronger', stats:{resources:28,enemyPower:10} },
  { id:'broken_limit', name:'Broken Limit', rarity:'LEGENDARY', buff:'+30 Energy Gain', debuff:'-8% DEF', stats:{energy:30,def:-8} }
];

const MERCHANT = [
  { id:'heal', name:'Small Heal Potion', price:70, desc:'Restore 18 HP.', effect:{heal:18} },
  { id:'energy', name:'Energy Potion', price:90, desc:'+25 Energy this run.', effect:{energy:25} },
  { id:'shield', name:'Shield Charm', price:110, desc:'Start next battle with shield.', effect:{shield:1} },
  { id:'pouch', name:'Resource Pouch', price:150, desc:'Instant random reward pouch.', effect:{pouch:1} },
  { id:'revive', name:'Revive Charm', price:220, desc:'Survive one death at 1 HP.', effect:{revive:1} }
];

async function respond(i, payload){
  const data = typeof payload === 'string' ? { content:payload, embeds:[], components:[] } : payload;
  if (i.isButton?.()) {
    if (data?.ephemeral) return i.reply(data).catch(()=>{});
    return i.update({ content:data.content ?? undefined, embeds:data.embeds ?? [], components:data.components ?? [] })
      .catch(async()=> {
        if (!i.replied && !i.deferred) return i.reply(data).catch(()=>{});
      });
  }
  return i.reply(data);
}

function choices(pool){ return [...pool].sort(()=>Math.random()-.5).slice(0,3).map((x,k)=>({ key:String(k+1), ...x })); }
function stats(run){ const s={atk:0,hp:0,def:0,energy:0,crit:0,dodge:0,resources:0,bossDmg:0,enemyPower:0,roomHpLoss:0,revive:0}; for(const b of run.buffs||[]) for(const [k,v] of Object.entries(b.stats||{})) s[k]=(s[k]||0)+Number(v||0); return s; }
function rewardText(r){ const names={gold:'Gold',ascension:'Ascension',bankedRolls:'Banked Normal Rolls',eventRolls:'Event Rolls',premiumRolls:'Premium Rolls',voidCrystals:'Void Crystals',corruptedFragments:'Corrupted Fragments',corruptedPityShards:'Corrupted Pity Shards',memoryShards:'Memory Shards',relicScraps:'Relic Scraps',traitStones:'Trait Stones',corruptedKeys:'Corrupted Keys'}; const lines=Object.entries(names).filter(([k])=>Number(r[k]||0)>0).map(([k,n])=>`+${money(r[k])} ${n}`); return lines.join('\n')||'No rewards yet.'; }
function buffText(run){ return run.buffs?.length ? run.buffs.slice(-8).map(b=>`• **${b.name}** (${b.rarity}) — ${b.buff}${b.debuff&&b.debuff!=='No debuff'?` / ${b.debuff}`:''}`).join('\n') : 'None yet.'; }

function embed(run, title='Hunt Run'){
  const z = ZONES[run.zoneId] || ZONES.void_forest;
  const st = stats(run);
  return new EmbedBuilder()
    .setTitle(`${z.emoji} ${title}`)
    .setDescription([
      `Zone: **${run.zoneName}**`,
      `Difficulty: **${run.difficultyName}**`,
      `Room: **${run.room}/${run.maxRooms}**`,
      `HP: **${run.hp}/${run.maxHp}**`,
      `Hunt Coins: **${money(run.huntCoins)}**`,
      ``,
      `Run Stats: ATK **${st.atk}%** • HP **${st.hp}%** • DEF **${st.def}%** • Energy **${st.energy}** • Resources **${st.resources}%**`,
      ``,
      `Temporary Buffs:\n${buffText(run)}`,
      ``,
      `Banked Rewards:\n${rewardText(run.rewards)}`
    ].join('\n'))
    .setColor(z.color);
}

function row(run){
  if (!run.pending) {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('hunt_next').setLabel('Next Room').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('hunt_extract').setLabel('Extract').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('hunt_abandon').setLabel('Abandon').setStyle(ButtonStyle.Danger)
    );
  }
  const r = new ActionRowBuilder();
  for (const o of (run.pending.options||[]).slice(0,3)) r.addComponents(new ButtonBuilder().setCustomId(`hunt_pick_${o.key}`).setLabel(String(o.label||o.name).slice(0,80)).setStyle(ButtonStyle.Secondary));
  r.addComponents(new ButtonBuilder().setCustomId('hunt_pick_ignore').setLabel('Ignore').setStyle(ButtonStyle.Danger));
  return r;
}

function pendingEmbed(run){
  const e = embed(run, run.pending?.title || 'Choose');
  if (run.pending) {
    e.setDescription(e.data.description + '\n\n' + [
      `**${run.pending.title}**`,
      run.pending.desc,
      ``,
      ...(run.pending.options||[]).map(o => o.buff ? `\`${o.key}\` **${o.buff.name}** (${o.buff.rarity}) — ${o.buff.buff} / ${o.buff.debuff}` : o.item ? `\`${o.key}\` **${o.item.name}** — ${o.item.desc} Cost: **${o.item.price} Hunt Coins**` : `\`${o.key}\` ${o.label||o.name}`),
      '`ignore` Ignore and continue.'
    ].join('\n'));
  }
  return e;
}

function baseRun(userId, zoneId='void_forest', diffId='normal'){
  const z=ZONES[zoneId]||ZONES.void_forest, d=DIFFICULTIES[diffId]||DIFFICULTIES.normal;
  return { userId, runId:`hunt_${Date.now()}`, zoneId:z.id, zoneName:z.name, difficultyId:diffId, difficultyName:d.name, room:0, maxRooms:d.rooms, hp:100, maxHp:100, huntCoins:0, score:0, buffs:[], pending:null, active:true, rewards:{gold:0,ascension:0,bankedRolls:0,eventRolls:0,premiumRolls:0,voidCrystals:0,corruptedFragments:0,corruptedPityShards:0,memoryShards:0,relicScraps:0,traitStones:0,corruptedKeys:0} };
}

function add(run,k,a){ run.rewards[k]=Math.max(0,Number(run.rewards[k]||0)+Number(a||0)); }

function rewards(run, elite=false, final=false){
  const d=DIFFICULTIES[run.difficultyId]||DIFFICULTIES.normal, st=stats(run);
  const m=d.reward*(1+(st.resources||0)/100)*(elite?1.35:1)*(final?2.25:1);
  add(run,'gold',Math.floor(rand(80,160)*m));
  add(run,'ascension',Math.floor(rand(5,13)*m));
  add(run,'memoryShards',Math.floor(rand(1,4)*m));
  add(run,'bankedRolls', final ? 2 : chance(.25) ? 1 : 0);
  if (run.zoneId==='void_forest') add(run,'voidCrystals',Math.floor(rand(6,16)*m));
  if (run.zoneId==='cursed_city') add(run,'traitStones',Math.floor(rand(3,9)*m));
  if (run.zoneId==='soul_palace') add(run,'relicScraps',Math.floor(rand(2,8)*m));
  if (run.zoneId==='titan_ruins') add(run,'ascension',Math.floor(rand(8,22)*m));
  if (run.zoneId==='corrupted_throne') {
    add(run,'corruptedFragments',Math.floor(rand(12,32)*m));
    if (elite || final) add(run,'corruptedPityShards', final ? rand(2,5) : rand(1,2));
    if (chance(final ? 0.01*d.rare : 0.0015*d.rare)) add(run,'corruptedKeys',1);
  }
  if (run.zoneId==='hero_arena') add(run,'traitStones',Math.floor(rand(5,13)*m));
  if (final && chance(.08*d.rare)) add(run,'eventRolls',1);
  if (final && chance(.05*d.rare)) add(run,'premiumRolls',1);
}

function battle(run, elite=false, final=false){
  const d=DIFFICULTIES[run.difficultyId]||DIFFICULTIES.normal, st=stats(run);
  const enemy=d.enemy*(1+(st.enemyPower||0)/100)*(final?1.45:elite?1.22:1);
  const power=1+((st.atk||0)+(st.hp||0)+(st.def||0)+(st.energy||0)/2+(st.bossDmg||0)*(final?1:.3))/100;
  const win=chance(Math.max(.25,Math.min(.92,.62+(power-enemy)*.16+(st.dodge||0)/350)));
  const dmg=win?rand(7,18)*enemy*(1-Math.max(-30,st.def||0)/180):rand(24,42)*enemy;
  run.hp=Math.max(0,Math.floor(run.hp-dmg-(st.roomHpLoss||0)));
  let log=win?`${final?'Final boss':elite?'Elite enemies':'Enemies'} defeated.`:`${final?'Final boss':elite?'Elite enemies':'Enemies'} overwhelmed your team.`;
  if (win) { rewards(run, elite, final); run.huntCoins += Math.floor(rand(22,42)*(elite?1.4:1)*(final?2.5:1)); run.score += Math.floor(100*enemy*(elite?1.4:1)*(final?2:1)); }
  else { const rev=(run.buffs||[]).find(b=>b.stats?.revive); if(rev){ rev.stats.revive=0; run.hp=1; log += '\nRevive Charm saved the run at 1 HP.'; } else { run.active=false; log += '\nRun failed. Temporary buffs are lost.'; } }
  return { win, log };
}

function roomType(run){
  if (run.room >= run.maxRooms) return 'final';
  if (run.room>0 && run.room%4===0) return 'elite';
  if (run.room>0 && run.room%3===0 && chance(.55)) return 'wizard';
  if (run.room>0 && run.room%3===0 && chance(.35)) return 'merchant';
  if (chance(.24)) return 'event';
  if (chance(.28)) return 'buff';
  return 'battle';
}

function eventOptions(name){
  return [
    { key:'1', label:name==='Hidden Chest'?'Open safely':name==='Void Portal'?'Enter portal':name==='Rival Hunter'?'Duel rival':name==='Corrupted Shrine'?'Accept minor curse':'Rest', result:'risk' },
    { key:'2', label:name==='Hidden Chest'?'Force open':name==='Void Portal'?'Close portal':name==='Rival Hunter'?'Trade info':name==='Corrupted Shrine'?'Cleanse shrine':'Search camp', result:'safe' },
    { key:'3', label:'Leave', result:'ignore' }
  ];
}

async function applyRewards(prisma, rollBank, run, keep=1){
  const r=run.rewards||{};
  function v(x){ return Math.floor(Number(x||0)*keep); }
  const data={};
  if(v(r.gold)>0) data.gold={increment:v(r.gold)};
  if(v(r.ascension)>0) data.ascension={increment:v(r.ascension)};
  await prisma.user.update({where:{id:String(run.userId)},data}).catch(()=>{});
  if (rollBank) {
    if (v(r.bankedRolls)>0) await rollBank.addBankedNormal(prisma, run.userId, v(r.bankedRolls));
    if (v(r.premiumRolls)>0) await rollBank.addPremium(prisma, run.userId, v(r.premiumRolls));
    if (v(r.eventRolls)>0) await rollBank.addEvent(prisma, run.userId, v(r.eventRolls));
    if (v(r.corruptedKeys)>0) await rollBank.addCorruptedTicket(prisma, run.userId, v(r.corruptedKeys));
  }
  const user = await prisma.user.findUnique({where:{id:String(run.userId)}}).catch(()=>null);
  if (user) {
    const meta = (user.meta && typeof user.meta === 'object' && !Array.isArray(user.meta)) ? user.meta : {};
    meta.resources = meta.resources || {};
    for (const k of ['voidCrystals','corruptedFragments','corruptedPityShards','memoryShards','relicScraps','traitStones']) meta.resources[k]=(Number(meta.resources[k]||0)+v(r[k]||0));
    await prisma.user.update({where:{id:String(run.userId)},data:{meta}}).catch(()=>{});
  }
}

async function next(i, prisma, rollBank, runs, run, userId){
  if(!run?.active) return respond(i,{content:'No active Hunt run. Start with `/hunt`.',ephemeral:true});
  if(run.pending) return respond(i,{content:'Choose or ignore the current event first.',ephemeral:true});
  run.room++;
  const t=roomType(run);
  if(t==='buff'){ run.pending={type:'buff',title:'Choose a Hunt Blessing',desc:'Pick one temporary buff. It disappears when the run ends.',options:choices(BUFFS).map(o=>({key:o.key,label:o.name,buff:o}))}; writeRuns(runs); return respond(i,{embeds:[pendingEmbed(run)],components:[row(run)]}); }
  if(t==='wizard'){ run.pending={type:'wizard',title:'🧙 Void Wizard Appeared',desc:'Free choice. Every option has a buff + light debuff. Ignore is safe.',options:choices(WIZARD).map(o=>({key:o.key,label:o.name,buff:o}))}; writeRuns(runs); return respond(i,{embeds:[pendingEmbed(run)],components:[row(run)]}); }
  if(t==='merchant'){ run.pending={type:'merchant',title:'🧳 Wandering Merchant Appeared',desc:'Spend Hunt Coins for run-only help. Ignore is safe.',options:choices(MERCHANT).map(o=>({key:o.key,label:`${o.name} (${o.price})`,item:o}))}; writeRuns(runs); return respond(i,{embeds:[pendingEmbed(run)],components:[row(run)]}); }
  if(t==='event'){ const ev=pick(['Hidden Chest','Void Portal','Rival Hunter','Corrupted Shrine','Safe Camp']); run.pending={type:'event',title:`❓ ${ev}`,desc:`Random event: ${ev}`,options:eventOptions(ev)}; writeRuns(runs); return respond(i,{embeds:[pendingEmbed(run)],components:[row(run)]}); }
  const final=t==='final', elite=t==='elite', res=battle(run,elite,final);
  if(!run.active){ await applyRewards(prisma,rollBank,run,.4); delete runs[userId]; writeRuns(runs); return respond(i,{embeds:[embed(run,'Hunt Failed').setDescription(embed(run).data.description+`\n\n${res.log}\n\nYou kept **40%** of rewards. Buffs removed.`).setColor(0xe74c3c)],components:[]}); }
  if(final){ await applyRewards(prisma,rollBank,run,1); delete runs[userId]; writeRuns(runs); return respond(i,{embeds:[embed(run,'Hunt Cleared').setDescription(embed(run).data.description+`\n\n${res.log}\n\nFinal chest earned. Buffs removed.`).setColor(0x2ecc71)],components:[]}); }
  writeRuns(runs); return respond(i,{embeds:[embed(run,`Room ${run.room}/${run.maxRooms}`).setDescription(embed(run).data.description+`\n\n${res.log}`)],components:[row(run)]});
}

async function choose(i, prisma, rollBank, runs, run, userId, keyRaw){
  if(!run?.active) return respond(i,{content:'No active Hunt run.',ephemeral:true});
  if(!run.pending) return respond(i,{content:'No pending choice. Use `/hunt-next`.',ephemeral:true});
  const key=String(keyRaw||'').toLowerCase();
  if(key==='ignore'){ const title=run.pending.title; run.pending=null; writeRuns(runs); return respond(i,{embeds:[embed(run,`${title} Ignored`)],components:[row(run)]}); }
  const opt=(run.pending.options||[]).find(o=>o.key===key);
  if(!opt) return respond(i,{content:'Invalid choice. Pick 1, 2, 3, or ignore.',ephemeral:true});
  let msg='';
  if(opt.buff){ run.buffs.push(opt.buff); msg=`Added **${opt.buff.name}** — ${opt.buff.buff}${opt.buff.debuff&&opt.buff.debuff!=='No debuff'?` / ${opt.buff.debuff}`:''}`; }
  if(opt.item){
    if(run.huntCoins<opt.item.price) return respond(i,{content:`Not enough Hunt Coins. You have ${run.huntCoins}, need ${opt.item.price}.`,ephemeral:true});
    run.huntCoins-=opt.item.price; const e=opt.item.effect||{};
    if(e.heal) run.hp=Math.min(run.maxHp,run.hp+e.heal);
    if(e.energy) run.buffs.push({id:'energy_potion',name:'Energy Potion',rarity:'ITEM',buff:`+${e.energy} Energy`,debuff:'No debuff',stats:{energy:e.energy}});
    if(e.shield) run.buffs.push({id:'shield_charm',name:'Shield Charm',rarity:'ITEM',buff:'Start next battle with shield',debuff:'No debuff',stats:{shield:1}});
    if(e.revive) run.buffs.push({id:'revive_charm',name:'Revive Charm',rarity:'ITEM',buff:'Survive one death at 1 HP',debuff:'Consumed on use',stats:{revive:1}});
    if(e.pouch) rewards(run,true,false);
    msg=`Bought **${opt.item.name}**.`;
  }
  if(opt.result){
    if(opt.result==='risk'){ const res=battle(run,true,false); msg=`Risk event result: ${res.log}`; }
    else if(opt.result==='safe'){ rewards(run,false,false); run.hp=Math.min(run.maxHp,run.hp+8); msg='Safe choice: gained small rewards and recovered a little HP.'; }
    else msg='You left the event.';
  }
  run.pending=null; writeRuns(runs);
  return respond(i,{embeds:[embed(run,'Choice Applied').setDescription(embed(run).data.description+`\n\n${msg}`)],components:[row(run)]});
}

async function extract(i, prisma, rollBank, runs, run, userId){
  if(!run?.active) return respond(i,{content:'No active Hunt run.',ephemeral:true});
  await applyRewards(prisma,rollBank,run,1);
  delete runs[userId]; writeRuns(runs);
  return respond(i,{embeds:[embed(run,'Extracted Safely').setDescription(embed(run).data.description+'\n\nYou kept **100%** of rewards. Buffs removed.').setColor(0x2ecc71)],components:[]});
}

async function abandon(i, runs, run, userId){
  if(!run?.active) return respond(i,{content:'No active Hunt run.',ephemeral:true});
  delete runs[userId]; writeRuns(runs);
  return respond(i,{content:'Hunt abandoned. Temporary buffs removed. Rewards not claimed.',components:[]});
}

async function handleCommand(i, prisma, rollBank){
  const isBtn=i.isButton?.(), cmd=isBtn?null:i.commandName, userId=String(i.user.id), runs=readRuns(); let run=runs[userId];
  if(isBtn){
    if(i.customId==='hunt_next') return next(i,prisma,rollBank,runs,run,userId);
    if(i.customId==='hunt_extract') return extract(i,prisma,rollBank,runs,run,userId);
    if(i.customId==='hunt_abandon') return abandon(i,runs,run,userId);
    if(i.customId.startsWith('hunt_pick_')) return choose(i,prisma,rollBank,runs,run,userId,i.customId.replace('hunt_pick_',''));
  }
  if(cmd==='hunt'){ const zone=i.options.getString('zone')||'void_forest', diff=i.options.getString('difficulty')||'normal'; if(run?.active) return respond(i,{embeds:[embed(run,'Active Hunt Run')],components:[row(run)]}); run=baseRun(userId,zone,diff); runs[userId]=run; writeRuns(runs); return respond(i,{embeds:[embed(run,'Hunt Started')],components:[row(run)]}); }
  if(cmd==='hunt-next') return next(i,prisma,rollBank,runs,run,userId);
  if(cmd==='hunt-pick') return choose(i,prisma,rollBank,runs,run,userId,i.options.getString('choice',true));
  if(cmd==='hunt-extract') return extract(i,prisma,rollBank,runs,run,userId);
  if(cmd==='hunt-abandon') return abandon(i,runs,run,userId);
  return false;
}

function commandDefinitions(){
  return [
    {name:'hunt',description:'Start or view a Hunt Zone run',type:1,options:[{name:'zone',description:'Hunt Zone',type:3,required:false,choices:Object.values(ZONES).map(z=>({name:z.name,value:z.id}))},{name:'difficulty',description:'Difficulty',type:3,required:false,choices:Object.entries(DIFFICULTIES).map(([id,d])=>({name:d.name,value:id}))}]},
    {name:'hunt-next',description:'Continue to the next Hunt room',type:1},
    {name:'hunt-pick',description:'Pick Hunt option 1/2/3 or ignore',type:1,options:[{name:'choice',description:'1, 2, 3, or ignore',type:3,required:true}]},
    {name:'hunt-extract',description:'Extract safely and claim rewards',type:1},
    {name:'hunt-abandon',description:'Abandon current Hunt run',type:1}
  ];
}

module.exports = { ZONES, DIFFICULTIES, handleCommand, commandDefinitions };
