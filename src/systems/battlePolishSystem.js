// VoidRoll Reborn - Phase 24 Battle Polish System
// Adds real-feeling combat logs for story, pvp, dungeons, and raids.

const { EmbedBuilder } = require('discord.js');
const { prisma } = require('../lib/db');

const RARITY_EMOJI = {
  COMMON:'🟢',
  RARE:'🔵',
  EPIC:'🟣',
  LEGENDARY:'🟡',
  MYTHIC:'🔴',
  DIVINE:'⚪',
  VOIDBORN:'🌌',
  SECRET:'🌠'
};

const RARITY_COLOR = {
  COMMON:0x22c55e,
  RARE:0x3b82f6,
  EPIC:0xa855f7,
  LEGENDARY:0xf59e0b,
  MYTHIC:0xef4444,
  DIVINE:0xf8fafc,
  VOIDBORN:0x4f46e5,
  SECRET:0x7c3aed
};

function money(n) {
  if (typeof n === 'bigint') return n.toLocaleString('en-US');
  return Number(n || 0).toLocaleString('en-US');
}

function cleanName(name='') {
  return String(name || '').replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s+/g,' ').trim();
}

function normalize(v='') {
  return String(v || '').toLowerCase().replace(/[().\-_:/'’"]/g,' ').replace(/\s+/g,' ').trim();
}

function emoji(r) {
  return RARITY_EMOJI[String(r||'').toUpperCase()] || '⭐';
}

function color(r) {
  return RARITY_COLOR[String(r||'').toUpperCase()] || 0x5865f2;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, Number(v || 0)));
}

async function ensureUser(discordUser) {
  const uid = String(discordUser.id || discordUser);
  const username = discordUser.username || 'Player';

  return prisma.user.upsert({
    where:{ id:uid },
    update:{ username },
    create:{
      id:uid,
      username,
      gold:25000,
      tokens:1000,
      rolls:25,
      essence:0,
      voidCrystals:0,
      soulFragments:0,
      pvpRating:1000,
      pvpWins:0,
      pvpLosses:0,
      pvpWinStreak:0,
      chapter:1,
      stage:1
    }
  });
}

function roleOf(character = {}) {
  const n = normalize(character.name);
  if (['aizen','lelouch','makima','kurapika','shikamaru','light yagami','yhwach','geto'].some(x=>n.includes(x))) return 'CONTROL';
  if (['all might','kaido','whitebeard','escanor','reinhard','saber','artoria','albedo'].some(x=>n.includes(x))) return 'TANK';
  if (['rimuru','orihime','tsunade','rem','emilia','kakashi','c c'].some(x=>n.includes(x))) return 'SUPPORT';
  if (['toji','killua','levi','hisoka','zenitsu','yoriichi','zoro'].some(x=>n.includes(x))) return 'ASSASSIN';
  if (['gojo','sukuna','madara','gilgamesh','ainz','megumin','goku','naruto','ichigo'].some(x=>n.includes(x))) return 'DPS';
  return String(character.role || character.type || 'DPS').toUpperCase();
}

function elementOf(character = {}) {
  const n = normalize(character.name);
  const a = normalize(character.anime);

  if (['aizen','ichigo','yhwach','rukia','kenpachi','byakuya'].some(x=>n.includes(x)) || a.includes('bleach')) return 'SOUL';
  if (['gojo','sukuna','yuta','toji','geto','yuji','megumi'].some(x=>n.includes(x)) || a.includes('jujutsu')) return 'CURSED';
  if (['jinwoo','jin woo','igris','beru','ashborn'].some(x=>n.includes(x))) return 'SHADOW';
  if (['rimuru','aizen','madara','makima','lelouch','yhwach'].some(x=>n.includes(x))) return 'VOID';
  if (['natsu','ace','rengoku'].some(x=>n.includes(x))) return 'FIRE';
  if (['killua','zenitsu','laxus'].some(x=>n.includes(x))) return 'LIGHTNING';
  if (['naruto','goku','luffy','saber','all might'].some(x=>n.includes(x))) return 'LIGHT';
  if (['rukia'].some(x=>n.includes(x))) return 'ICE';

  return String(character.element || 'NEUTRAL').toUpperCase();
}

function passiveOf(character = {}) {
  const n = normalize(character.name);

  if (n.includes('corrupted makima')) return { name:'Dominion of the Void', effect:{ silence:22, enemyAtk:-12, teamDmg:15 } };
  if (n.includes('corrupted') && n.includes('aizen')) return { name:'Void Hypnosis', effect:{ miss:22, silence:15, enemyAtk:-10 } };
  if (n.includes('corrupted') && (n.includes('gojo') || n.includes('gojou'))) return { name:'Broken Infinity', effect:{ dodge:28, shield:1, dmg:18 } };
  if (n.includes('true form') && n.includes('sukuna')) return { name:'Malevolent True Form', effect:{ bleed:28, bossDmg:35, execute:15 } };
  if (n.includes('voidborn') && n.includes('rimuru')) return { name:'Void Predator', effect:{ lifesteal:18, pen:18, summon:1 } };
  if (n.includes('eclipse') && n.includes('madara')) return { name:'Eclipse Dominion', effect:{ burn:20, dmg:22, counter:12 } };
  if (n.includes('abyssal') && n.includes('ichigo')) return { name:'Abyssal Bankai', effect:{ lifesteal:12, crit:12, bossDmg:25 } };
  if (n.includes('awakened') && n.includes('naruto')) return { name:'Awakened Will', effect:{ teamDmg:12, heal:10, counter:10 } };
  if (n.includes('absolute') && n.includes('lelouch')) return { name:'Absolute Geass', effect:{ stun:25, silence:18, enemyAtk:-12 } };
  if (n.includes('voidborn') && n.includes('yhwach')) return { name:'Void Almighty', effect:{ dodge:15, silence:20, counter:20 } };

  if (n.includes('aizen')) return { name:'Kyoka Suigetsu', effect:{ miss:18, enemyAtk:-8 } };
  if (n.includes('gojo') || n.includes('gojou')) return { name:'Infinity', effect:{ dodge:18, shield:1 } };
  if (n.includes('makima')) return { name:'Control Devil', effect:{ enemyAtk:-10, teamDmg:10 } };
  if (n.includes('rimuru')) return { name:'Predator', effect:{ lifesteal:12, pen:10 } };
  if (n.includes('sukuna')) return { name:'Malevolent Shrine', effect:{ bleed:20, bossDmg:25 } };
  if (n.includes('madara')) return { name:'Wake Up To Reality', effect:{ burn:12, dmg:15 } };
  if (n.includes('ichigo')) return { name:'Bankai Pressure', effect:{ crit:8, lifesteal:8 } };
  if (n.includes('naruto')) return { name:'Never Give Up', effect:{ heal:8, teamDmg:8 } };

  return { name:`${roleOf(character)} Mastery`, effect:{ dmg:6 } };
}

function unitFromCard(card = {}) {
  const c = card.character || card;
  const rarity = String(c.rarity || 'COMMON').toUpperCase();
  const power = Number(card.power || c.basePower || 1000);
  const level = Number(card.level || 1);
  const role = roleOf(c);
  const element = elementOf(c);
  const passive = passiveOf(c);
  const pe = passive.effect || {};
  const rarityBoost = { COMMON:1, RARE:1.08, EPIC:1.18, LEGENDARY:1.32, MYTHIC:1.52, DIVINE:1.9, VOIDBORN:2.25, SECRET:2.8 }[rarity] || 1;

  let hpMult = 8.5, atkMult = 1.0, defMult = 0.55, spd = 100, crit = 8, dodge = 4;
  if (role === 'TANK') { hpMult=14; atkMult=.7; defMult=1.15; spd=85; crit=4; dodge=3; }
  if (role === 'SUPPORT') { hpMult=10; atkMult=.8; defMult=.75; spd=105; crit=6; dodge=6; }
  if (role === 'CONTROL') { hpMult=9; atkMult=.9; defMult=.7; spd=118; crit=10; dodge=8; }
  if (role === 'ASSASSIN') { hpMult=7; atkMult=1.45; defMult=.4; spd=140; crit=28; dodge=14; }
  if (role === 'DPS') { hpMult=8; atkMult=1.3; defMult=.5; spd=112; crit=16; dodge=5; }
  if (role === 'SUMMONER') { hpMult=9; atkMult=1.1; defMult=.6; spd=108; crit=12; dodge=7; }

  return {
    id: card.id || c.id || `${c.name}_${Math.random()}`,
    name: cleanName(c.name),
    anime: c.anime || 'Unknown',
    rarity,
    role,
    element,
    imageUrl: c.imageUrl || null,
    passiveName: passive.name,
    passive: pe,
    power,
    level,
    maxHp: Math.floor(power * hpMult * rarityBoost * (1 + level * .004)),
    hp: Math.floor(power * hpMult * rarityBoost * (1 + level * .004)),
    atk: Math.floor(power * atkMult * rarityBoost),
    def: Math.floor(power * defMult * rarityBoost),
    spd: Math.floor(spd + level * .2),
    crit: clamp(crit + (pe.crit || 0), 0, 70),
    dodge: clamp(dodge + (pe.dodge || 0), 0, 65),
    counter: clamp(pe.counter || 0, 0, 60),
    lifesteal: clamp(pe.lifesteal || 0, 0, 50),
    shield: Number(pe.shield || 0),
    energy: 0,
    status: {}
  };
}

function enemyUnit(name, power, role='DPS', element='DARK', rarity='EPIC') {
  return unitFromCard({
    id:`enemy_${name}_${Math.random()}`,
    power,
    level:1,
    character:{
      id:`enemy_${name}`,
      name,
      anime:'Void Realm',
      rarity,
      basePower:power,
      role,
      element,
      active:true
    }
  });
}

function alive(team) {
  return team.filter(u => u.hp > 0);
}

function pickTarget(team) {
  const a = alive(team);
  if (!a.length) return null;
  const tanks = a.filter(u => u.role === 'TANK');
  const pool = tanks.length && Math.random() < .65 ? tanks : a;
  return pool[Math.floor(Math.random()*pool.length)];
}

function statusLine(unit) {
  const s = [];
  if (unit.status.burn) s.push('Burn');
  if (unit.status.bleed) s.push('Bleed');
  if (unit.status.freeze) s.push('Freeze');
  if (unit.status.silence) s.push('Silence');
  if (unit.status.stun) s.push('Stun');
  return s.length ? ` [${s.join(', ')}]` : '';
}

function applyStatusDamage(unit, logs) {
  if (unit.hp <= 0) return;
  let dot = 0;
  if (unit.status.burn) dot += Math.floor(unit.maxHp * .025);
  if (unit.status.bleed) dot += Math.floor(unit.maxHp * .02);

  if (dot > 0) {
    unit.hp = Math.max(0, unit.hp - dot);
    logs.push(`🔥🩸 ${unit.name} takes **${money(dot)}** status damage.`);
  }

  for (const key of Object.keys(unit.status)) {
    unit.status[key] -= 1;
    if (unit.status[key] <= 0) delete unit.status[key];
  }
}

function attack(attacker, defenders, logs, mode='story') {
  if (attacker.hp <= 0) return;
  applyStatusDamage(attacker, logs);
  if (attacker.hp <= 0) return;

  if (attacker.status.stun) {
    logs.push(`💫 ${attacker.name} is stunned and loses the turn.`);
    return;
  }

  if (attacker.status.freeze && Math.random() < .5) {
    logs.push(`❄️ ${attacker.name} is frozen and fails to move.`);
    return;
  }

  const target = pickTarget(defenders);
  if (!target) return;

  if (Math.random()*100 < target.dodge) {
    logs.push(`💨 ${target.name} dodged ${attacker.name}'s attack.`);
    attacker.energy = clamp(attacker.energy + 8, 0, 100);
    return;
  }

  let dmg = Math.max(1, attacker.atk - Math.floor(target.def * .35));
  const pe = attacker.passive || {};

  if (mode === 'raid' || mode === 'boss') dmg = Math.floor(dmg * (1 + (pe.bossDmg || 0)/100));
  dmg = Math.floor(dmg * (1 + (pe.dmg || 0)/100));

  let crit = false;
  if (Math.random()*100 < attacker.crit) {
    crit = true;
    dmg = Math.floor(dmg * 1.85);
  }

  if (target.shield > 0) {
    const blocked = Math.floor(dmg * .7);
    dmg -= blocked;
    target.shield -= 1;
    logs.push(`🛡️ ${target.name}'s shield blocked **${money(blocked)}** damage.`);
  }

  target.hp = Math.max(0, target.hp - dmg);
  attacker.energy = clamp(attacker.energy + 22, 0, 100);

  logs.push(`${crit ? '💥 CRIT' : '⚔️'} ${attacker.name} hits ${target.name} for **${money(dmg)}**.${target.hp<=0?' ☠️':''}`);

  if (attacker.lifesteal > 0) {
    const heal = Math.floor(dmg * attacker.lifesteal / 100);
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
    logs.push(`🩸 ${attacker.name} lifesteals **${money(heal)}** HP.`);
  }

  if (pe.burn && Math.random()*100 < pe.burn) {
    target.status.burn = 2;
    logs.push(`🔥 ${target.name} is burning.`);
  }
  if (pe.bleed && Math.random()*100 < pe.bleed) {
    target.status.bleed = 3;
    logs.push(`🩸 ${target.name} is bleeding.`);
  }
  if (pe.silence && Math.random()*100 < pe.silence) {
    target.status.silence = 2;
    logs.push(`🔇 ${target.name} is silenced.`);
  }
  if (pe.stun && Math.random()*100 < pe.stun) {
    target.status.stun = 1;
    logs.push(`💫 ${target.name} is stunned.`);
  }

  if (target.hp > 0 && Math.random()*100 < target.counter) {
    const counterDmg = Math.floor(target.atk * .55);
    attacker.hp = Math.max(0, attacker.hp - counterDmg);
    logs.push(`↩️ ${target.name} counters ${attacker.name} for **${money(counterDmg)}**.`);
  }

  if (attacker.energy >= 100 && !attacker.status.silence) {
    attacker.energy = 0;
    const targets = alive(defenders).slice(0, 3);
    if (targets.length) {
      logs.push(`🌌 **${attacker.name} uses ULTIMATE: ${attacker.passiveName}!**`);
      for (const t of targets) {
        const ultDmg = Math.floor(attacker.atk * 1.65);
        t.hp = Math.max(0, t.hp - ultDmg);
        logs.push(`✨ Ultimate hits ${t.name} for **${money(ultDmg)}**.${t.hp<=0?' ☠️':''}`);
      }
    }
  }
}

function teamSummary(team) {
  return team.map((u,idx) => {
    const hp = Math.max(0, u.hp);
    const pct = Math.floor(hp / Math.max(1,u.maxHp) * 100);
    return `${idx+1}. ${emoji(u.rarity)} **${u.name}** • ${u.role}/${u.element} • HP ${pct}%${statusLine(u)}`;
  }).join('\n');
}

function runBattle(playerUnits, enemyUnits, options={}) {
  const logs = [];
  const mode = options.mode || 'story';
  const maxTurns = options.maxTurns || 8;

  // Opening passives
  for (const u of playerUnits) {
    if (u.passive.teamDmg) {
      for (const ally of playerUnits) ally.atk = Math.floor(ally.atk * (1 + u.passive.teamDmg/100));
      logs.push(`✨ ${u.name}'s **${u.passiveName}** empowers the team.`);
    }
    if (u.passive.enemyAtk) {
      for (const enemy of enemyUnits) enemy.atk = Math.floor(enemy.atk * (1 + u.passive.enemyAtk/100));
      logs.push(`🕳️ ${u.name}'s **${u.passiveName}** weakens enemies.`);
    }
  }

  for (let turn=1; turn<=maxTurns; turn++) {
    if (!alive(playerUnits).length || !alive(enemyUnits).length) break;

    logs.push(`\n**Turn ${turn}**`);

    const order = [...alive(playerUnits), ...alive(enemyUnits)].sort((a,b)=>b.spd-a.spd);

    for (const unit of order) {
      if (!alive(playerUnits).length || !alive(enemyUnits).length) break;
      const isPlayer = playerUnits.includes(unit);
      attack(unit, isPlayer ? enemyUnits : playerUnits, logs, mode);
    }
  }

  const playerAlive = alive(playerUnits);
  const enemyAlive = alive(enemyUnits);
  const playerHp = playerUnits.reduce((s,u)=>s+Math.max(0,u.hp),0);
  const enemyHp = enemyUnits.reduce((s,u)=>s+Math.max(0,u.hp),0);

  let winner = 'draw';
  if (playerAlive.length && !enemyAlive.length) winner = 'player';
  else if (!playerAlive.length && enemyAlive.length) winner = 'enemy';
  else winner = playerHp >= enemyHp ? 'player' : 'enemy';

  return {
    winner,
    playerHp,
    enemyHp,
    logs: logs.slice(0, 36),
    playerUnits,
    enemyUnits
  };
}

async function getBestCards(userId, take=6) {
  return prisma.userCard.findMany({
    where:{ userId:String(userId) },
    include:{ character:true },
    orderBy:{ power:'desc' },
    take
  }).catch(()=>[]);
}

function buildStoryEnemies(user, chapter, stage) {
  const base = 1800 + ((chapter-1)*30 + stage) * 550;
  return [
    enemyUnit('Void Scout', base, 'ASSASSIN', 'VOID', 'EPIC'),
    enemyUnit('Abyss Guard', Math.floor(base*1.15), 'TANK', 'SHADOW', 'EPIC'),
    enemyUnit('Cursed Mage', Math.floor(base*1.25), 'CONTROL', 'CURSED', 'LEGENDARY'),
    enemyUnit('Void Beast', Math.floor(base*1.3), 'DPS', 'VOID', 'LEGENDARY'),
    enemyUnit('Dark Healer', Math.floor(base*.95), 'SUPPORT', 'DARK', 'EPIC'),
    enemyUnit('Stage Boss', Math.floor(base*1.8), 'DPS', 'VOID', 'MYTHIC')
  ];
}

function buildDungeonEnemies(type='normal') {
  const mult = { normal:1, elite:1.45, abyss:2, void:2.8 }[type] || 1;
  const base = Math.floor(4500 * mult);

  return [
    enemyUnit(`${type} Warden`, base, 'TANK', 'VOID', 'LEGENDARY'),
    enemyUnit(`${type} Assassin`, Math.floor(base*1.1), 'ASSASSIN', 'SHADOW', 'EPIC'),
    enemyUnit(`${type} Caster`, Math.floor(base*1.25), 'CONTROL', 'CURSED', 'LEGENDARY'),
    enemyUnit(`${type} Beast`, Math.floor(base*1.35), 'DPS', 'FIRE', 'MYTHIC'),
    enemyUnit(`${type} Oracle`, Math.floor(base*.9), 'SUPPORT', 'LIGHT', 'EPIC'),
    enemyUnit(`${type} Dungeon Boss`, Math.floor(base*2), 'DPS', 'VOID', type==='void'?'SECRET':'MYTHIC')
  ];
}

async function handleStoryBattle(i) {
  await i.deferReply();
  const user = await ensureUser(i.user);
  const cards = await getBestCards(i.user.id, 6);

  if (!cards.length) return i.editReply('You need characters first. Use /roll.');

  const chapter = Number(user.chapter || user.storyChapter || 1);
  const stage = Number(user.stage || user.storyStage || 1);
  const playerUnits = cards.map(unitFromCard);
  const enemies = buildStoryEnemies(user, chapter, stage);
  const result = runBattle(playerUnits, enemies, { mode:'story', maxTurns:7 });
  const won = result.winner === 'player';

  if (won) {
    let nextStage = stage + 1;
    let nextChapter = chapter;
    if (nextStage > 30) { nextStage = 1; nextChapter++; }

    await prisma.user.update({
      where:{ id:String(i.user.id) },
      data:{
        chapter:nextChapter,
        stage:nextStage,
        gold:{ increment:BigInt(75000 + stage*3500) },
        essence:{ increment:25 },
        rolls:{ increment:1 }
      }
    }).catch(()=>{});
  }

  const embed = new EmbedBuilder()
    .setTitle(`📖 Story Battle — ${won ? 'Victory' : 'Defeat'}`)
    .setDescription([
      `Chapter **${chapter}** • Stage **${stage}**`,
      '',
      '**Your Team**',
      teamSummary(result.playerUnits),
      '',
      '**Enemies**',
      teamSummary(result.enemyUnits),
      '',
      '**Battle Log**',
      result.logs.join('\n').slice(0, 1800),
      '',
      won ? 'Rewards: **Gold + Essence + 1 Roll**' : 'Tip: upgrade tree, traits, and use Tank/Support/Control.'
    ].join('\n'))
    .setColor(won ? 0x22c55e : 0xef4444);

  return i.editReply({ embeds:[embed] });
}

async function handlePvpBattle(i) {
  await i.deferReply();
  const opponent = i.options.getUser('opponent');

  if (!opponent) return i.editReply('Choose an opponent.');

  await ensureUser(i.user);
  await ensureUser(opponent);

  const playerCards = await getBestCards(i.user.id, 6);
  const oppCards = await getBestCards(opponent.id, 6);

  if (!playerCards.length) return i.editReply('You need characters first. Use /roll.');
  if (!oppCards.length) return i.editReply('Opponent has no characters yet.');

  const result = runBattle(playerCards.map(unitFromCard), oppCards.map(unitFromCard), { mode:'pvp', maxTurns:6 });
  const won = result.winner === 'player';

  await prisma.user.update({
    where:{ id:String(i.user.id) },
    data:{
      pvpRating:{ increment: won ? 28 : -18 },
      pvpWins: won ? { increment:1 } : undefined,
      pvpLosses: !won ? { increment:1 } : undefined,
      pvpWinStreak: won ? { increment:1 } : 0
    }
  }).catch(()=>{});

  const embed = new EmbedBuilder()
    .setTitle(`⚔️ Ranked PvP — ${won ? 'Victory' : 'Defeat'}`)
    .setDescription([
      `${i.user} vs ${opponent}`,
      '',
      '**Your Team**',
      teamSummary(result.playerUnits),
      '',
      '**Opponent Team**',
      teamSummary(result.enemyUnits),
      '',
      '**Battle Log**',
      result.logs.join('\n').slice(0, 1800),
      '',
      `Rating: **${won ? '+28' : '-18'} RP**`
    ].join('\n'))
    .setColor(won ? 0x22c55e : 0xef4444);

  return i.editReply({ embeds:[embed] });
}

async function handleDungeonBattle(i) {
  await i.deferReply();
  await ensureUser(i.user);

  const type = i.options.getString('type') || 'normal';
  const cards = await getBestCards(i.user.id, 6);
  if (!cards.length) return i.editReply('You need characters first. Use /roll.');

  const result = runBattle(cards.map(unitFromCard), buildDungeonEnemies(type), { mode:'dungeon', maxTurns:8 });
  const won = result.winner === 'player';

  if (won) {
    const rewards = {
      normal:{ gold:100000, essence:60, tokens:100 },
      elite:{ gold:250000, essence:140, tokens:250 },
      abyss:{ gold:600000, essence:350, tokens:600 },
      void:{ gold:1200000, essence:900, tokens:1200, voidCrystals:1 }
    }[type] || { gold:100000, essence:60, tokens:100 };

    await prisma.user.update({
      where:{ id:String(i.user.id) },
      data:{
        gold:{ increment:BigInt(rewards.gold) },
        essence:{ increment:rewards.essence },
        tokens:{ increment:rewards.tokens },
        voidCrystals: rewards.voidCrystals ? { increment:rewards.voidCrystals } : undefined
      }
    }).catch(()=>{});
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏰 ${type.toUpperCase()} Dungeon — ${won ? 'Cleared' : 'Failed'}`)
    .setDescription([
      '**Your Team**',
      teamSummary(result.playerUnits),
      '',
      '**Dungeon Enemies**',
      teamSummary(result.enemyUnits),
      '',
      '**Battle Log**',
      result.logs.join('\n').slice(0, 1800),
      '',
      won ? 'Rewards delivered to wallet.' : 'Try upgrading before entering again.'
    ].join('\n'))
    .setColor(won ? 0x22c55e : 0xef4444);

  return i.editReply({ embeds:[embed] });
}

async function getOrCreateRaidBoss(guildId='global') {
  let boss = await prisma.raidBoss.findFirst({
    where:{ serverId:String(guildId), defeated:false },
    orderBy:{ createdAt:'desc' }
  }).catch(()=>null);

  if (boss) return boss;

  const now = new Date();
  const end = new Date(Date.now()+24*60*60*1000);

  boss = await prisma.raidBoss.create({
    data:{
      serverId:String(guildId),
      templateId:'void-leviathan',
      type:'world',
      name:'Void Leviathan',
      level:1,
      element:'VOID',
      role:'TANK',
      rarity:'SECRET',
      maxHp:BigInt(250000000),
      currentHp:BigInt(250000000),
      basePower:BigInt(1800000),
      phase:1,
      defeated:false,
      startsAt:now,
      endsAt:end
    }
  });

  return boss;
}

async function handleWorldBoss(i) {
  const boss = await getOrCreateRaidBoss(i.guildId || 'global');
  const hp = Number(boss.currentHp);
  const max = Number(boss.maxHp);
  const pct = Math.max(0, Math.floor(hp / Math.max(max,1) * 100));

  const embed = new EmbedBuilder()
    .setTitle('🌍 World Boss — Void Leviathan')
    .setDescription([
      `Rarity: **SECRET**`,
      `Element: **VOID**`,
      `HP: **${money(hp)} / ${money(max)}** (${pct}%)`,
      '',
      '**Mechanics**',
      'Shield Phase • Summons • Rage Mode • Void Bind • Enrage',
      '',
      'Use `/raid-attack` to attack.'
    ].join('\n'))
    .setColor(0x7c3aed);

  return i.reply({ embeds:[embed] });
}

async function handleRaidAttack(i) {
  await i.deferReply();
  const boss = await getOrCreateRaidBoss(i.guildId || 'global');
  const cards = await getBestCards(i.user.id, 6);
  if (!cards.length) return i.editReply('You need characters first. Use /roll.');

  const bossPower = Math.max(50000, Math.floor(Number(boss.basePower) / 70));
  const enemies = [
    enemyUnit('Void Leviathan Core', bossPower*2, 'TANK', 'VOID', 'SECRET'),
    enemyUnit('Void Leviathan Claw', bossPower, 'DPS', 'VOID', 'VOIDBORN'),
    enemyUnit('Void Leviathan Eye', bossPower, 'CONTROL', 'VOID', 'VOIDBORN')
  ];

  const result = runBattle(cards.map(unitFromCard), enemies, { mode:'raid', maxTurns:6 });
  const damage = Math.max(1, result.playerUnits.reduce((s,u)=>s+Math.max(0,u.maxHp-u.hp),0) + cards.reduce((s,c)=>s+Number(c.power||0),0));
  const newHp = Math.max(0, Number(boss.currentHp) - damage);
  const defeated = newHp <= 0;

  await prisma.raidBoss.update({
    where:{ id:boss.id },
    data:{ currentHp:BigInt(newHp), defeated, lastHitUserId:defeated ? String(i.user.id) : boss.lastHitUserId }
  }).catch(()=>{});

  await prisma.raidDamageLog.create({
    data:{
      raidBossId:boss.id,
      userId:String(i.user.id),
      username:i.user.username,
      damage:BigInt(damage)
    }
  }).catch(()=>{});

  await prisma.user.update({
    where:{ id:String(i.user.id) },
    data:{ gold:{ increment:BigInt(Math.floor(damage*.03)) }, essence:{ increment:75 }, tokens:{ increment:50 } }
  }).catch(()=>{});

  const embed = new EmbedBuilder()
    .setTitle(`🌌 Raid Attack — ${defeated ? 'Boss Defeated' : 'Damage Dealt'}`)
    .setDescription([
      `Damage: **${money(damage)}**`,
      `Boss HP: **${money(newHp)} / ${money(boss.maxHp)}**`,
      '',
      '**Battle Log**',
      result.logs.join('\n').slice(0, 2000),
      '',
      'Rewards: **Gold + 75 Essence + 50 Tokens**',
      defeated ? '🏆 Last Hit Reward unlocked.' : ''
    ].filter(Boolean).join('\n'))
    .setColor(defeated ? 0xf59e0b : 0x7c3aed);

  return i.editReply({ embeds:[embed] });
}

async function handleRaidRank(i) {
  const boss = await getOrCreateRaidBoss(i.guildId || 'global');
  const rows = await prisma.raidDamageLog.findMany({
    where:{ raidBossId:boss.id },
    orderBy:{ damage:'desc' },
    take:20
  }).catch(()=>[]);

  const merged = new Map();
  for (const r of rows) {
    const key = r.userId;
    if (!merged.has(key)) merged.set(key, { username:r.username || 'Player', damage:0 });
    merged.get(key).damage += Number(r.damage || 0);
  }

  const ranking = [...merged.entries()].sort((a,b)=>b[1].damage-a[1].damage).slice(0,20);
  const lines = ranking.map(([userId,row],idx)=>`**${idx+1}. ${row.username}** — ${money(row.damage)} DMG`).join('\n');

  return i.reply({
    embeds:[new EmbedBuilder()
      .setTitle('🏆 Raid Damage Ranking')
      .setDescription(lines || 'No raid damage yet.')
      .setColor(0x7c3aed)]
  });
}

async function handleBattlePolishCommand(i) {
  const name = i.commandName;

  if (name === 'story') {
    await handleStoryBattle(i);
    return true;
  }

  if (name === 'pvp') {
    await handlePvpBattle(i);
    return true;
  }

  if (name === 'dungeon') {
    await handleDungeonBattle(i);
    return true;
  }

  if (name === 'world-boss' || name === 'raid') {
    await handleWorldBoss(i);
    return true;
  }

  if (name === 'raid-attack') {
    await handleRaidAttack(i);
    return true;
  }

  if (name === 'raid-rank') {
    await handleRaidRank(i);
    return true;
  }

  return false;
}

module.exports = {
  handleBattlePolishCommand,
  runBattle,
  unitFromCard
};
