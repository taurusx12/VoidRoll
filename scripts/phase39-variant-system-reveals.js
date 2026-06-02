// VoidRoll Reborn - Phase 39 Variant System + Cinematic Reveals
// Adds:
// - Variant/base separation
// - /variants command
// - cinematic 5-step reveal for Secret/Voidborn/Event variants
// - search penalty so base name does not return Corrupted/Absolute by mistake
//
// Run:
//   node scripts/phase39-variant-system-reveals.js
//   node --check src/index.js
//   GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
//   npm start

const fs = require('fs');
const path = require('path');

const indexPath = path.join(process.cwd(), 'src', 'index.js');
const deployPath = path.join(process.cwd(), 'scripts', 'phase27-fast-guild-deploy.js');

if (!fs.existsSync(indexPath)) {
  console.error('❌ src/index.js not found.');
  process.exit(1);
}

let s = fs.readFileSync(indexPath, 'utf8');

function findFunctionRange(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i=braceStart;i<source.length;i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return { start, end:i+1 };
  }
  return null;
}

function findIfBlock(source, conditionText) {
  const start = source.indexOf(conditionText);
  if (start === -1) return null;
  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i=braceStart;i<source.length;i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') depth--;
    if (depth === 0) return { start, end:i+1 };
  }
  return null;
}

const backup = path.join(process.cwd(), 'src', `index.backup-phase39-variants-${Date.now()}.js`);
fs.copyFileSync(indexPath, backup);

// imports
if (!s.includes("require('./systems/variantPresentationSystem')")) {
  const anchor = "const { handleBattlePolishCommand } = require('./systems/battlePolishSystem');";
  if (s.includes(anchor)) {
    s = s.replace(anchor, `${anchor}\nconst variantPresentation = require('./systems/variantPresentationSystem');`);
  } else {
    s = s.replace("const { prisma } = require('./lib/db');", "const { prisma } = require('./lib/db');\nconst variantPresentation = require('./systems/variantPresentationSystem');");
  }
  console.log('✅ added variantPresentationSystem import');
} else {
  console.log('✅ variant import exists');
}

// add cinematic reveal helper near revealQuote
if (!s.includes('PHASE39_CINEMATIC_REVEAL_HELPER')) {
  const helper = `
async function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// PHASE39_CINEMATIC_REVEAL_HELPER
async function sendCinematicReveal(channel, character, card=null) {
  if (!channel || !character) return;
  const extra = card ? \`Card ID: **\${shortId(card.id)}** • Power: **\${money(card.power)}**\` : '';
  const embeds = variantPresentation.buildRevealEmbeds(EmbedBuilder, character, extra);
  for (const embed of embeds) {
    await channel.send({ embeds:[embed] }).catch(()=>{});
    await sleep(800);
  }
}
`;
  const pos = s.indexOf("async function battleScore");
  if (pos !== -1) {
    s = s.slice(0,pos) + helper + "\n" + s.slice(pos);
    console.log('✅ added cinematic reveal helper');
  } else {
    console.log('⚠️ battleScore anchor not found for helper');
  }
}

// Patch search score if characterSearchScoreStrict exists.
if (s.includes('function characterSearchScoreStrict') && !s.includes('variantPresentation.searchScoreAdjustment')) {
  const r = findFunctionRange(s, "function characterSearchScoreStrict");
  if (r) {
    let fn = s.slice(r.start, r.end);
    fn = fn.replace(/return score;\s*}$/, "score += variantPresentation.searchScoreAdjustment(c, query);\n  return score;\n}");
    s = s.slice(0,r.start) + fn + s.slice(r.end);
    console.log('✅ patched characterSearchScoreStrict with variant adjustment');
  }
}

// Patch simple findCharacter if no strict helper.
if (!s.includes('characterSearchScoreStrict')) {
  const r = findFunctionRange(s, "async function findCharacter(query)");
  if (r) {
    const newFind = `async function findCharacter(query) {
  const raw = String(query || '').trim();
  const q = norm(raw);
  if (!q) return null;
  if (raw.startsWith('char_')) {
    const byId = await prisma.character.findFirst({ where:{ id:raw, active:true } }).catch(()=>null);
    if (byId) return byId;
  }
  const chars = await prisma.character.findMany({ where:{ active:true }, take:50000, orderBy:{ basePower:'desc' } }).catch(()=>[]);
  return chars.map(c=>{
    const txt = \`\${norm(clean(c.name))} \${norm(c.name)} \${norm(c.anime)}\`;
    let score = 0;
    for (const t of q.split(' ').filter(Boolean)) if (txt.includes(t)) score += 100;
    if (norm(clean(c.name)) === q) score += 500000;
    if (norm(c.name) === q) score += 550000;
    score += variantPresentation.searchScoreAdjustment(c, raw);
    return { c, score };
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || Number(b.c.basePower||0)-Number(a.c.basePower||0))[0]?.c || null;
}`;
    s = s.slice(0,r.start) + newFind + s.slice(r.end);
    console.log('✅ patched simple findCharacter with variant-aware search');
  }
}

// Patch old reveal blocks. First specific exact old compact snippets.
s = s.replace(
  "if(['SECRET','VOIDBORN'].includes(c.rarity)){ await i.channel?.send({ embeds:[new EmbedBuilder().setTitle(`${emoji(c.rarity)} ${c.rarity} REVEAL`).setDescription(`**${revealStepTitle(c.rarity)}**\\n“${revealQuote(c.name)}”\\nThe reveal rises from the bottom until the full card appears.`).setColor(c.rarity==='SECRET'?0xe74c3c:0x5865f2)] }).catch(()=>{}); }",
  "if(['SECRET','VOIDBORN'].includes(c.rarity) || variantPresentation.isSpecialVariant(c)){ await sendCinematicReveal(i.channel, c, card).catch(()=>{}); }"
);

s = s.replace(
  "if(rarities[j]==='SECRET'){ c=selected; pity=0; await i.channel?.send({ embeds:[new EmbedBuilder().setTitle('🌠 SECRET REVEAL').setDescription(`**Void Spark → Bottom Distortion → Quote Ascends → Secret Flash → Character Reveal**\\n“${revealQuote(c.name)}”`).setColor(0x6d28d9)] }).catch(()=>{}); } else c=await randomCharacterByRarity(rarities[j]);",
  "if(rarities[j]==='SECRET'){ c=selected; pity=0; await sendCinematicReveal(i.channel, c).catch(()=>{}); } else c=await randomCharacterByRarity(rarities[j]);"
);

// Add /variants command before character index.
if (!s.includes("commandName === 'variants'")) {
  const anchor = "if (commandName === 'characters' || commandName==='top-characters')";
  const variantsBlock = `if (commandName === 'variants') {
    const val = i.options.getString('name');
    const chars = await prisma.character.findMany({ where:{ active:true }, orderBy:{ basePower:'desc' }, take:50000 }).catch(()=>[]);
    const q = norm(val || '');
    let list = chars.map(c => ({ c, profile: variantPresentation.getVariantProfile(c) }))
      .filter(x => x.profile.isVariant || (q && (norm(x.c.name).includes(q) || norm(clean(x.c.name)).includes(q))))
      .filter(x => !q || norm(x.profile.baseName).includes(q) || norm(x.c.name).includes(q) || norm(clean(x.c.name)).includes(q))
      .slice(0,25);

    const lines = list.map(x => {
      const c = x.c, p = x.profile;
      return \`\${emoji(c.rarity)} **\${clean(c.name)}** • Base: **\${p.baseName}** • \${p.eventType} • \${p.role || roleOf(c)}/\${p.element || elementOf(c)}\`;
    });

    return i.reply({
      embeds:[
        new EmbedBuilder()
          .setTitle(val ? \`Variants for \${val}\` : 'Special Variants')
          .setDescription(lines.join('\\n') || 'No variants found.')
          .setColor(0x7c3aed)
      ]
    });
  }
  `;
  const pos = s.indexOf(anchor);
  if (pos !== -1) {
    s = s.slice(0,pos) + variantsBlock + s.slice(pos);
    console.log('✅ added /variants command handler');
  }
}

// Help text
s = s.replace("Collection: /inventory /my-card /character /who-has /characters /anime /collection",
              "Collection: /inventory /my-card /character /variants /who-has /characters /anime /collection");
s = s.replace("Collection: /inventory /view-card /characters /character /anime /collection /who-has",
              "Collection: /inventory /my-card /character /variants /who-has /characters /anime /collection");

// Autocomplete include variants in global character commands.
s = s.replace("['character','who-has','characters','wishlist-add'].includes(cmd)",
              "['character','who-has','variants','characters','wishlist-add'].includes(cmd)");

// Mark
if (!s.includes('PHASE39_VARIANT_SYSTEM_REVEALS')) s = '// PHASE39_VARIANT_SYSTEM_REVEALS\n' + s;
fs.writeFileSync(indexPath, s, 'utf8');

console.log('✅ index.js patched.');
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);

// Patch deploy script.
if (fs.existsSync(deployPath)) {
  let d = fs.readFileSync(deployPath, 'utf8');
  const backupDeploy = path.join(process.cwd(), 'scripts', `phase27-fast-guild-deploy.backup-phase39-${Date.now()}.js`);
  fs.copyFileSync(deployPath, backupDeploy);

  // Ensure character autocomplete true.
  d = d.replace("{ name:'name', description:'Character name', type:3, required:true }",
                "{ name:'name', description:'Character name', type:3, required:true, autocomplete:true }");

  const variantsCommand = `

  {
    name:'variants',
    description:'Show special variants for a character',
    type:1,
    options:[
      { name:'name', description:'Base character or variant name', type:3, required:false, autocomplete:true }
    ]
  },`;

  if (!d.includes("name:'variants'")) {
    const anchor = `  {
    name:'character',
    description:'Search character',
    type:1,
    options:[
      { name:'name', description:'Character name', type:3, required:true, autocomplete:true }
    ]
  },`;
    if (d.includes(anchor)) {
      d = d.replace(anchor, anchor + variantsCommand);
      console.log('✅ added /variants to deploy script');
    } else {
      console.log('⚠️ character deploy anchor not found');
    }
  }

  // Ensure /my-card exists
  if (!d.includes("name:'my-card'")) {
    const anchor2 = "  { name:'story', description:'Play story battle', type:1 },";
    const myCardCommand = `

  {
    name:'my-card',
    description:'Search and view one of your owned cards',
    type:1,
    options:[
      { name:'card', description:'Owned card name or ID', type:3, required:true, autocomplete:true }
    ]
  },

  {
    name:'view-card',
    description:'View one of your owned cards',
    type:1,
    options:[
      { name:'card', description:'Owned card name or ID', type:3, required:true, autocomplete:true }
    ]
  },
`;
    if (d.includes(anchor2)) d = d.replace(anchor2, myCardCommand + "\n  " + anchor2);
  }

  if (!d.includes('PHASE39_VARIANT_SYSTEM_REVEALS')) {
    d = d.replace('// VoidRoll Reborn - Phase 27 Fast Guild Deploy', '// VoidRoll Reborn - Phase 27 Fast Guild Deploy\\n// PHASE39_VARIANT_SYSTEM_REVEALS');
  }
  fs.writeFileSync(deployPath, d, 'utf8');
  console.log('✅ deploy script patched.');
  console.log(`Deploy backup: ${path.relative(process.cwd(), backupDeploy)}`);
}

console.log('');
console.log('✅ Phase 39 complete.');
console.log('');
console.log('Run:');
console.log('node --check src/index.js');
console.log('GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js');
console.log('npm start');
