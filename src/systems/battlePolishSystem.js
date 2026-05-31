// VoidRoll Reborn - Phase 24 Battle Polish System V2

const { EmbedBuilder } = require('discord.js');
const { prisma } = require('../lib/db');

const RARITY_EMOJI = { COMMON:'🟢', RARE:'🔵', EPIC:'🟣', LEGENDARY:'🟡', MYTHIC:'🔴', DIVINE:'⚪', VOIDBORN:'🌌', SECRET:'🌠' };
const RARITY_COLOR = { COMMON:0x22c55e, RARE:0x3b82f6, EPIC:0xa855f7, LEGENDARY:0xf59e0b, MYTHIC:0xef4444, DIVINE:0xf8fafc, VOIDBORN:0x4f46e5, SECRET:0x7c3aed };

function money(n) { if (typeof n === 'bigint') return n.toLocaleString('en-US'); return Number(n || 0).toLocaleString('en-US'); }
function cleanName(name='') { return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim(); }
function normalize(v='') { return String(v || '').toLowerCase().replace(/[().\-_:/'’"]/g,' ').replace(/\s+/g,' ').trim(); }
function emoji(r) { return RARITY_EMOJI[String(r||'').toUpperCase()] || '⭐'; }
function color(r) { return RARITY_COLOR[String(r||'').toUpperCase()] || 0x5865f2; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, Number(v||0))); }

async function ensureUser(discordUser) {
  const uid = String(discordUser.id || discordUser);
  const username = discordUser.username || 'Player';
  return prisma.user.upsert({
    where:{ id:uid },
    update:{ username },
    create:{ id:uid, username, gold:25000, tokens:1000, rolls:25, essence:0, voidCrystals:0, soulFragments:0, pvpRating:1000, pvpWins:0, pvpLosses:0, pvpWinStreak:0, chapter:1, stage:1 }
  });
}

function roleOf(c={}) {
  const n=normalize(c.name);
  if(['aizen','lelouch','makima','kurapika','shikamaru','light yagami','yhwach','geto'].some(x=>n.includes(x))) return 'CONTROL';
  if(['all might','kaido','whitebeard','escanor','reinhard','saber','artoria','albedo'].some(x=>n.includes(x))) return 'TANK';
  if(['rimuru','orihime','tsunade','rem','emilia','kakashi','c c'].some(x=>n.includes(x))) return 'SUPPORT';
  if(['toji','killua','levi','hisoka','zenitsu','yoriichi','zoro'].some(x=>n.includes(x))) return 'ASSASSIN';
  if(['jinwoo','jin woo','ashborn','igris','beru'].some(x=>n.includes(x))) return 'SUMMONER';
  return 'DPS';
}
function elementOf(c={}) {
  const n=normalize(c.name), a=normalize(c.anime);
  if(['aizen','ichigo','yhwach','rukia','kenpachi','byakuya'].some(x=>n.includes(x)) || a.includes('bleach')) return 'SOUL';
  if(['gojo','gojou','sukuna','yuta','toji','geto','yuji','megumi'].some(x=>n.includes(x)) || a.includes('jujutsu')) return 'CURSED';
  if(['jinwoo','jin woo','igris','beru','ashborn'].some(x=>n.includes(x))) return 'SHADOW';
  if(['rimuru','aizen','madara','makima','lelouch','yhwach'].some(x=>n.includes(x))) return 'VOID';
  if(['natsu','ace','rengoku'].some(x=>n.includes(x))) return 'FIRE';
  if(['killua','zenitsu','laxus'].some(x=>n.includes(x))) return 'LIGHTNING';
  if(['naruto','goku','luffy','saber','all might'].some(x=>n.includes(x))) return 'LIGHT';
  return String(c.element || 'NEUTRAL').toUpperCase();
}
function passiveOf(c={}) {
  const n=normalize(c.name);
  if(n.includes('corrupted makima')) return { name:'Dominion of the Void', effect:{ silence:22, enemyAtk:-12, teamDmg:15 } };
  if(n.includes('corrupted') && n.includes('aizen')) return { name:'Void Hypnosis', effect:{ miss:22, silence:15, enemyAtk:-10 } };
  if(n.includes('corrupted') && (n.includes('gojo') || n.includes('gojou'))) return { name:'Broken Infinity', effect:{ dodge:28, shield:1, dmg:18 } };
  if(n.includes('true form') && n.includes('sukuna')) return { name:'Malevolent True Form', effect:{ bleed:28, bossDmg:35, execute:15 } };
  if(n.includes('voidborn') && n.includes('rimuru')) return { name:'Void Predator', effect:{ lifesteal:18, pen:18, summon:1 } };
  if(n.includes('eclipse') && n.includes('madara')) return { name:'Eclipse Dominion', effect:{ burn:20, dmg:22, counter:12 } };
  if(n.includes('abyssal') && n.includes('ichigo')) return { name:'Abyssal Bankai', effect:{ lifesteal:12, crit:12, bossDmg:25 } };
  if(n.includes('awakened') && n.includes('naruto')) return { name:'Awakened Will', effect:{ teamDmg:12, heal:10, counter:10 } };
  if(n.includes('absolute') && n.includes('lelouch')) return { name:'Absolute Geass', effect:{ stun:25, silence:18, enemyAtk:-12 } };
  if(n.includes('voidborn') && n.includes('yhwach')) return { name:'Void Almighty', effect:{ dodge:15, silence:20, counter:20 } };
  if(n.includes('aizen')) return { name:'Kyoka Suigetsu', effect:{ miss:18, enemyAtk:-8 } };
  if(n.includes('gojo') || n.includes('gojou')) return { name:'Infinity', effect:{ dodge:18, shield:1 } };
  if(n.includes('makima')) return { name:'Control Devil', effect:{ enemyAtk:-10, teamDmg:10 } };
  if(n.includes('rimuru')) return { name:'Predator', effect:{ lifesteal:12, pen:10 } };
  if(n.includes('sukuna')) return { name:'Malevolent Shrine', effect:{ bleed:20, bossDmg:25 } };
  if(n.includes('madara')) return { name:'Wake Up To Reality', effect:{ burn:12, dmg:15 } };
  return { name:`${roleOf(c)} Mastery`, effect:{ dmg:6 } };
}

function unitFromCard(card={}) {
  const c=card.character || card;
  const rarity=String(c.rarity||'COMMON').toUpperCase();
  const power=Number(card.power || c.basePower || 1000);
  const level=Number(card.level||1);
  const role=roleOf(c), element=elementOf(c), passive=passiveOf(c), pe=passive.effect || {};
  const rb={ COMMON:1, RARE:1.08, EPIC:1.18, LEGENDARY:1.32, MYTHIC:1.52, DIVINE:1.9, VOIDBORN:2.25, SECRET:2.8 }[rarity] || 1;
  let hpM=8.5, atkM=1, defM=.55, spd=100, crit=8, dodge=4;
  if(role==='TANK'){ hpM=14; atkM=.7; defM=1.15; spd=85; crit=4; dodge=3; }
  if(role==='SUPPORT'){ hpM=10; atkM=.8; defM=.75; spd=105; crit=6; dodge=6; }
  if(role==='CONTROL'){ hpM=9; atkM=.9; defM=.7; spd=118; crit=10; dodge=8; }
  if(role==='ASSASSIN'){ hpM=7; atkM=1.45; defM=.4; spd=140; crit=28; dodge=14; }
  if(role==='SUMMONER'){ hpM=9; atkM=1.1; defM=.6; spd=108; crit=12; dodge=7; }
  const maxHp=Math.floor(power*hpM*rb*(1+level*.004));
  return { id:card.id||c.id||`${c.name}_${Math.random()}`, name:cleanName(c.name), anime:c.anime||'Unknown', rarity, role, element, imageUrl:c.imageUrl||null, passiveName:passive.name, passive:pe, power, level, maxHp, hp:maxHp, atk:Math.floor(power*atkM*rb), def:Math.floor(power*defM*rb), spd:Math.floor(spd+level*.2), crit:clamp(crit+(pe.crit||0),0,70), dodge:clamp(dodge+(pe.dodge||0),0,65), counter:clamp(pe.counter||0,0,60), lifesteal:clamp(pe.lifesteal||0,0,50), shield:Number(pe.shield||0), energy:0, status:{} };
}
function enemyUnit(name,power,role='DPS',element='DARK',rarity='EPIC'){ return unitFromCard({ id:`enemy_${name}`, power, level:1, character:{ id:`enemy_${name}`, name, anime:'Void Realm', rarity, basePower:power, role, element, active:true } }); }
function alive(team){ return team.filter(u=>u.hp>0); }
function pickTarget(team){ const a=alive(team); if(!a.length)return null; const tanks=a.filter(u=>u.role==='TANK'); const pool=tanks.length&&Math.random()<.65?tanks:a; return pool[Math.floor(Math.random()*pool.length)]; }
function statusLine(u){ const s=[]; for(const k of ['burn','bleed','freeze','silence','stun']) if(u.status[k]) s.push(k); return s.length?` [${s.join(', ')}]`:''; }
function applyStatusDamage(u,logs){ if(u.hp<=0)return; let dot=0; if(u.status.burn)dot+=Math.floor(u.maxHp*.025); if(u.status.bleed)dot+=Math.floor(u.maxHp*.02); if(dot){ u.hp=Math.max(0,u.hp-dot); logs.push(`🔥🩸 ${u.name} takes **${money(dot)}** status damage.`); } for(const k of Object.keys(u.status)){ u.status[k]-=1; if(u.status[k]<=0)delete u.status[k]; } }
function attack(attacker, defenders, logs, mode='story'){
  if(attacker.hp<=0)return; applyStatusDamage(attacker,logs); if(attacker.hp<=0)return;
  if(attacker.status.stun){ logs.push(`💫 ${attacker.name} is stunned and loses the turn.`); return; }
  if(attacker.status.freeze && Math.random()<.5){ logs.push(`❄️ ${attacker.name} is frozen and fails to move.`); return; }
  const target=pickTarget(defenders); if(!target)return;
  if(Math.random()*100<target.dodge){ logs.push(`💨 ${target.name} dodged ${attacker.name}'s attack.`); attacker.energy=clamp(attacker.energy+8,0,100); return; }
  const pe=attacker.passive||{}; let dmg=Math.max(1,attacker.atk-Math.floor(target.def*.35));
  if(mode==='raid'||mode==='boss') dmg=Math.floor(dmg*(1+(pe.bossDmg||0)/100));
  dmg=Math.floor(dmg*(1+(pe.dmg||0)/100));
  let crit=false; if(Math.random()*100<attacker.crit){ crit=true; dmg=Math.floor(dmg*1.85); }
  if(target.shield>0){ const blocked=Math.floor(dmg*.7); dmg-=blocked; target.shield-=1; logs.push(`🛡️ ${target.name}'s shield blocked **${money(blocked)}** damage.`); }
  target.hp=Math.max(0,target.hp-dmg); attacker.energy=clamp(attacker.energy+22,0,100);
  logs.push(`${crit?'💥 CRIT':'⚔️'} ${attacker.name} hits ${target.name} for **${money(dmg)}**.${target.hp<=0?' ☠️':''}`);
  if(attacker.lifesteal>0){ const heal=Math.floor(dmg*attacker.lifesteal/100); attacker.hp=Math.min(attacker.maxHp,attacker.hp+heal); logs.push(`🩸 ${attacker.name} lifesteals **${money(heal)}** HP.`); }
  for(const [status,label] of [['burn','🔥 burning'],['bleed','🩸 bleeding'],['silence','🔇 silenced'],['stun','💫 stunned']]){
    if(pe[status] && Math.random()*100<pe[status]){ target.status[status]=status==='bleed'?3:2; logs.push(`${label} applied to ${target.name}.`); }
  }
  if(target.hp>0 && Math.random()*100<target.counter){ const cd=Math.floor(target.atk*.55); attacker.hp=Math.max(0,attacker.hp-cd); logs.push(`↩️ ${target.name} counters ${attacker.name} for **${money(cd)}**.`); }
  if(attacker.energy>=100 && !attacker.status.silence){ attacker.energy=0; const targets=alive(defenders).slice(0,3); if(targets.length){ logs.push(`🌌 **${attacker.name} uses ULTIMATE: ${attacker.passiveName}!**`); for(const t of targets){ const ud=Math.floor(attacker.atk*1.65); t.hp=Math.max(0,t.hp-ud); logs.push(`✨ Ultimate hits ${t.name} for **${money(ud)}**.${t.hp<=0?' ☠️':''}`); } } }
}
function teamSummary(team){ return team.map((u,i)=>`${i+1}. ${emoji(u.rarity)} **${u.name}** • ${u.role}/${u.element} • HP ${Math.max(0,Math.floor(u.hp/Math.max(1,u.maxHp)*100))}%${statusLine(u)}`).join('\n'); }
function runBattle(playerUnits,enemyUnits,opt={}){ const logs=[]; const mode=opt.mode||'story'; const maxTurns=opt.maxTurns||8; for(const u of playerUnits){ if(u.passive.teamDmg){ for(const a of playerUnits)a.atk=Math.floor(a.atk*(1+u.passive.teamDmg/100)); logs.push(`✨ ${u.name}'s **${u.passiveName}** empowers the team.`); } if(u.passive.enemyAtk){ for(const e of enemyUnits)e.atk=Math.floor(e.atk*(1+u.passive.enemyAtk/100)); logs.push(`🕳️ ${u.name}'s **${u.passiveName}** weakens enemies.`); } } for(let t=1;t<=maxTurns;t++){ if(!alive(playerUnits).length||!alive(enemyUnits).length)break; logs.push(`\n**Turn ${t}**`); const order=[...alive(playerUnits),...alive(enemyUnits)].sort((a,b)=>b.spd-a.spd); for(const u of order){ if(!alive(playerUnits).length||!alive(enemyUnits).length)break; attack(u, playerUnits.includes(u)?enemyUnits:playerUnits, logs, mode); } } const pHp=playerUnits.reduce((s,u)=>s+Math.max(0,u.hp),0), eHp=enemyUnits.reduce((s,u)=>s+Math.max(0,u.hp),0); return { winner:pHp>=eHp?'player':'enemy', playerHp:pHp, enemyHp:eHp, logs:logs.slice(0,36), playerUnits, enemyUnits }; }
async function getBestCards(userId,take=6){ return prisma.userCard.findMany({ where:{ userId:String(userId) }, include:{ character:true }, orderBy:{ power:'desc' }, take }).catch(()=>[]); }
function buildStoryEnemies(chapter,stage){ const base=1800+((chapter-1)*30+stage)*550; return [enemyUnit('Void Scout',base,'ASSASSIN','VOID','EPIC'),enemyUnit('Abyss Guard',Math.floor(base*1.15),'TANK','SHADOW','EPIC'),enemyUnit('Cursed Mage',Math.floor(base*1.25),'CONTROL','CURSED','LEGENDARY'),enemyUnit('Void Beast',Math.floor(base*1.3),'DPS','VOID','LEGENDARY'),enemyUnit('Dark Healer',Math.floor(base*.95),'SUPPORT','DARK','EPIC'),enemyUnit('Stage Boss',Math.floor(base*1.8),'DPS','VOID','MYTHIC')]; }
function buildDungeonEnemies(type='normal'){ const mult={normal:1,elite:1.45,abyss:2,void:2.8}[type]||1; const base=Math.floor(4500*mult); return [enemyUnit(`${type} Warden`,base,'TANK','VOID','LEGENDARY'),enemyUnit(`${type} Assassin`,Math.floor(base*1.1),'ASSASSIN','SHADOW','EPIC'),enemyUnit(`${type} Caster`,Math.floor(base*1.25),'CONTROL','CURSED','LEGENDARY'),enemyUnit(`${type} Beast`,Math.floor(base*1.35),'DPS','FIRE','MYTHIC'),enemyUnit(`${type} Oracle`,Math.floor(base*.9),'SUPPORT','LIGHT','EPIC'),enemyUnit(`${type} Dungeon Boss`,Math.floor(base*2),'DPS','VOID',type==='void'?'SECRET':'MYTHIC')]; }

async function handleStoryBattle(i){ await i.deferReply(); const u=await ensureUser(i.user); const cards=await getBestCards(i.user.id,6); if(!cards.length)return i.editReply('You need characters first. Use /roll.'); const chapter=Number(u.chapter||u.storyChapter||1), stage=Number(u.stage||u.storyStage||1); const result=runBattle(cards.map(unitFromCard),buildStoryEnemies(chapter,stage),{mode:'story',maxTurns:7}); const won=result.winner==='player'; if(won){ let ns=stage+1,nc=chapter; if(ns>30){ns=1;nc++;} await prisma.user.update({where:{id:String(i.user.id)},data:{chapter:nc,stage:ns,gold:{increment:BigInt(75000+stage*3500)},essence:{increment:25},rolls:{increment:1}}}).catch(()=>{}); } return i.editReply({embeds:[new EmbedBuilder().setTitle(`📖 Story Battle — ${won?'Victory':'Defeat'}`).setDescription([`Chapter **${chapter}** • Stage **${stage}**`,'','**Your Team**',teamSummary(result.playerUnits),'','**Enemies**',teamSummary(result.enemyUnits),'','**Battle Log**',result.logs.join('\n').slice(0,1800),'',won?'Rewards: **Gold + Essence + 1 Roll**':'Tip: upgrade tree, traits, and use Tank/Support/Control.'].join('\n')).setColor(won?0x22c55e:0xef4444)]}); }
async function handlePvpBattle(i){ await i.deferReply(); const opp=i.options.getUser('opponent'); if(!opp)return i.editReply('Choose an opponent.'); await ensureUser(i.user); await ensureUser(opp); const pc=await getBestCards(i.user.id,6), oc=await getBestCards(opp.id,6); if(!pc.length)return i.editReply('You need characters first. Use /roll.'); if(!oc.length)return i.editReply('Opponent has no characters yet.'); const result=runBattle(pc.map(unitFromCard),oc.map(unitFromCard),{mode:'pvp',maxTurns:6}); const won=result.winner==='player'; await prisma.user.update({where:{id:String(i.user.id)},data:{pvpRating:{increment:won?28:-18},pvpWins:won?{increment:1}:undefined,pvpLosses:!won?{increment:1}:undefined,pvpWinStreak:won?{increment:1}:0}}).catch(()=>{}); return i.editReply({embeds:[new EmbedBuilder().setTitle(`⚔️ Ranked PvP — ${won?'Victory':'Defeat'}`).setDescription([`${i.user} vs ${opp}`,'','**Your Team**',teamSummary(result.playerUnits),'','**Opponent Team**',teamSummary(result.enemyUnits),'','**Battle Log**',result.logs.join('\n').slice(0,1800),'',`Rating: **${won?'+28':'-18'} RP**`].join('\n')).setColor(won?0x22c55e:0xef4444)]}); }
async function handleDungeonBattle(i){ await i.deferReply(); await ensureUser(i.user); const type=i.options.getString('type')||'normal'; const cards=await getBestCards(i.user.id,6); if(!cards.length)return i.editReply('You need characters first. Use /roll.'); const result=runBattle(cards.map(unitFromCard),buildDungeonEnemies(type),{mode:'dungeon',maxTurns:8}); const won=result.winner==='player'; if(won){ const r={normal:{gold:100000,essence:60,tokens:100},elite:{gold:250000,essence:140,tokens:250},abyss:{gold:600000,essence:350,tokens:600},void:{gold:1200000,essence:900,tokens:1200,voidCrystals:1}}[type]||{gold:100000,essence:60,tokens:100}; await prisma.user.update({where:{id:String(i.user.id)},data:{gold:{increment:BigInt(r.gold)},essence:{increment:r.essence},tokens:{increment:r.tokens},voidCrystals:r.voidCrystals?{increment:r.voidCrystals}:undefined}}).catch(()=>{}); } return i.editReply({embeds:[new EmbedBuilder().setTitle(`🏰 ${type.toUpperCase()} Dungeon — ${won?'Cleared':'Failed'}`).setDescription(['**Your Team**',teamSummary(result.playerUnits),'','**Dungeon Enemies**',teamSummary(result.enemyUnits),'','**Battle Log**',result.logs.join('\n').slice(0,1800),'',won?'Rewards delivered to wallet.':'Try upgrading before entering again.'].join('\n')).setColor(won?0x22c55e:0xef4444)]}); }
async function getOrCreateRaidBoss(guildId='global'){ let b=await prisma.raidBoss.findFirst({where:{serverId:String(guildId),defeated:false},orderBy:{createdAt:'desc'}}).catch(()=>null); if(b)return b; return prisma.raidBoss.create({data:{serverId:String(guildId),templateId:'void-leviathan',type:'world',name:'Void Leviathan',level:1,element:'VOID',role:'TANK',rarity:'SECRET',maxHp:BigInt(250000000),currentHp:BigInt(250000000),basePower:BigInt(1800000),phase:1,defeated:false,startsAt:new Date(),endsAt:new Date(Date.now()+86400000)}}); }
async function handleWorldBoss(i){ const b=await getOrCreateRaidBoss(i.guildId||'global'); const hp=Number(b.currentHp), max=Number(b.maxHp), pct=Math.max(0,Math.floor(hp/Math.max(max,1)*100)); return i.reply({embeds:[new EmbedBuilder().setTitle('🌍 World Boss — Void Leviathan').setDescription([`Rarity: **SECRET**`,`Element: **VOID**`,`HP: **${money(hp)} / ${money(max)}** (${pct}%)`,'','**Mechanics**','Shield Phase • Summons • Rage Mode • Void Bind • Enrage','','Use `/raid-attack` to attack.'].join('\n')).setColor(0x7c3aed)]}); }
async function handleRaidAttack(i){ await i.deferReply(); const b=await getOrCreateRaidBoss(i.guildId||'global'); const cards=await getBestCards(i.user.id,6); if(!cards.length)return i.editReply('You need characters first. Use /roll.'); const bp=Math.max(50000,Math.floor(Number(b.basePower)/70)); const result=runBattle(cards.map(unitFromCard),[enemyUnit('Void Leviathan Core',bp*2,'TANK','VOID','SECRET'),enemyUnit('Void Leviathan Claw',bp,'DPS','VOID','VOIDBORN'),enemyUnit('Void Leviathan Eye',bp,'CONTROL','VOID','VOIDBORN')],{mode:'raid',maxTurns:6}); const damage=Math.max(1,result.playerUnits.reduce((s,u)=>s+Math.max(0,u.maxHp-u.hp),0)+cards.reduce((s,c)=>s+Number(c.power||0),0)); const newHp=Math.max(0,Number(b.currentHp)-damage); const defeated=newHp<=0; await prisma.raidBoss.update({where:{id:b.id},data:{currentHp:BigInt(newHp),defeated,lastHitUserId:defeated?String(i.user.id):b.lastHitUserId}}).catch(()=>{}); await prisma.raidDamageLog.create({data:{raidBossId:b.id,userId:String(i.user.id),username:i.user.username,damage:BigInt(damage)}}).catch(()=>{}); await prisma.user.update({where:{id:String(i.user.id)},data:{gold:{increment:BigInt(Math.floor(damage*.03))},essence:{increment:75},tokens:{increment:50}}}).catch(()=>{}); return i.editReply({embeds:[new EmbedBuilder().setTitle(`🌌 Raid Attack — ${defeated?'Boss Defeated':'Damage Dealt'}`).setDescription([`Damage: **${money(damage)}**`,`Boss HP: **${money(newHp)} / ${money(b.maxHp)}**`,'','**Battle Log**',result.logs.join('\n').slice(0,2000),'','Rewards: **Gold + 75 Essence + 50 Tokens**',defeated?'🏆 Last Hit Reward unlocked.':''].filter(Boolean).join('\n')).setColor(defeated?0xf59e0b:0x7c3aed)]}); }
async function handleRaidRank(i){ const b=await getOrCreateRaidBoss(i.guildId||'global'); const rows=await prisma.raidDamageLog.findMany({where:{raidBossId:b.id},orderBy:{damage:'desc'},take:20}).catch(()=>[]); const m=new Map(); for(const r of rows){ if(!m.has(r.userId))m.set(r.userId,{username:r.username||'Player',damage:0}); m.get(r.userId).damage+=Number(r.damage||0); } const lines=[...m.entries()].sort((a,b)=>b[1].damage-a[1].damage).slice(0,20).map(([id,row],i)=>`**${i+1}. ${row.username}** — ${money(row.damage)} DMG`).join('\n'); return i.reply({embeds:[new EmbedBuilder().setTitle('🏆 Raid Damage Ranking').setDescription(lines||'No raid damage yet.').setColor(0x7c3aed)]}); }
async function handleBattlePolishCommand(i){ const n=i.commandName; if(n==='story')return handleStoryBattle(i).then(()=>true); if(n==='pvp')return handlePvpBattle(i).then(()=>true); if(n==='dungeon')return handleDungeonBattle(i).then(()=>true); if(n==='world-boss'||n==='raid')return handleWorldBoss(i).then(()=>true); if(n==='raid-attack')return handleRaidAttack(i).then(()=>true); if(n==='raid-rank')return handleRaidRank(i).then(()=>true); return false; }
module.exports={ handleBattlePolishCommand, runBattle, unitFromCard };
