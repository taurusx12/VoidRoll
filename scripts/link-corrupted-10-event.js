require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const base = 'https://raw.githubusercontent.com/taurusx12/VoidRoll/main/public/images/events/corrupted';

function fieldsForCharacter() {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
  return new Set(model.fields.filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));
}
function pick(data, fields) {
  const out = {};
  for (const [k,v] of Object.entries(data)) if (fields.has(k)) out[k]=v;
  return out;
}
function makeId(name) {
  return 'char_corrupted_' + name.toLowerCase().replace(/[^a-z0-9]+/g,'_') + '_' + Date.now();
}

const units = [
  { base:['Itachi Uchiha','Itachi'], corrupted:'Corrupted Itachi Uchiha', anime:'Naruto', file:'Corrupted_Itachi.png', baseRarity:'MYTHIC', power:1480000, role:'CONTROL', element:'VOID' },
  { base:['Sousuke Aizen','Sosuke Aizen','Aizen'], corrupted:'Corrupted Aizen', anime:'Bleach', file:'Corrupted_Aizen.png', baseRarity:'DIVINE', power:1550000, role:'SUPPORT', element:'VOID' },
  { base:['Ainz Ooal Gown','Ainz'], corrupted:'Corrupted Ainz Ooal Gown', anime:'Overlord', file:'Corrupted_Ainz.png', baseRarity:'DIVINE', power:1570000, role:'SUMMONER', element:'VOID' },
  { base:['Rimuru Tempest','Rimuru'], corrupted:'Corrupted Rimuru Tempest', anime:'That Time I Got Reincarnated as a Slime', file:'Corrupted_Rimuru.png', baseRarity:'MYTHIC', power:1500000, role:'SUMMONER', element:'VOID' },
  { base:['Makima'], corrupted:'Corrupted Makima', anime:'Chainsaw Man', file:'Corrupted_Makima.png', baseRarity:'MYTHIC', power:1490000, role:'CONTROL', element:'VOID' },
  { base:['Lelouch Lamperouge','Lelouch'], corrupted:'Corrupted Lelouch Lamperouge', anime:'Code Geass', file:'Corrupted_Lelouch.png', baseRarity:'MYTHIC', power:1500000, role:'CONTROL', element:'VOID' },
  { base:['Satoru Gojo','Satoru Gojou','Gojo','Gojou'], corrupted:'Corrupted Satoru Gojo', anime:'Jujutsu Kaisen', file:'Corrupted_Gojo.png', baseRarity:'DIVINE', power:1560000, role:'DPS', element:'VOID' },
  { base:['Eren Yeager','Eren Jaeger','Eren'], corrupted:'Corrupted Eren Yeager', anime:'Attack on Titan', file:'Corrupted_Eren.png', baseRarity:'MYTHIC', power:1470000, role:'DPS', element:'VOID' },
  { base:['Saber','Artoria Pendragon','Altria Pendragon'], corrupted:'Corrupted Saber', anime:'Fate', file:'Corrupted_Saber.png', baseRarity:'DIVINE', power:1510000, role:'TANK', element:'VOID' },
  { base:['All Might','Toshinori Yagi'], corrupted:'Corrupted All Might', anime:'My Hero Academia', file:'Corrupted_AllMight.png', baseRarity:'MYTHIC', power:1460000, role:'TANK', element:'VOID' },
];

async function findFirstByNames(names) {
  for (const n of names) {
    const c = await prisma.character.findFirst({ where:{ name:{ contains:n }, active:true }, orderBy:{ basePower:'desc' } }).catch(()=>null);
    if (c) return c;
  }
  return null;
}

async function main(){
  const fields = fieldsForCharacter();
  console.log('VoidRoll Corrupted Event: linking 10 corrupted units...');

  for (const u of units) {
    const baseChar = await findFirstByNames(u.base);
    if (baseChar) {
      await prisma.character.update({
        where:{ id:baseChar.id },
        data:pick({ rarity:u.baseRarity, active:true, limited:false, banner:null }, fields)
      }).catch(()=>{});
      console.log(`Base ${u.base[0]} => ${u.baseRarity}`);
    } else {
      console.log(`Base not found for ${u.base[0]} (will still create/update corrupted).`);
    }

    let corrupted = await prisma.character.findFirst({ where:{ name:{ contains:u.corrupted } } }).catch(()=>null);
    const data = pick({
      name:u.corrupted,
      anime:(baseChar && baseChar.anime) || u.anime,
      rarity:'SECRET',
      basePower:u.power,
      baseFarm:Math.max(Number(baseChar?.baseFarm || 0), 180000),
      baseLuck:Math.max(Number(baseChar?.baseLuck || 0), 55000),
      imageUrl:`${base}/${u.file}`,
      active:true,
      limited:true,
      banner:'CORRUPTED_EVENT',
      globalPrint:0,
      createdAt:new Date()
    }, fields);

    if (corrupted) {
      await prisma.character.update({ where:{ id:corrupted.id }, data });
      console.log(`Updated ${u.corrupted}`);
    } else {
      await prisma.character.create({ data:pick({ id:makeId(u.corrupted), ...data }, fields) });
      console.log(`Created ${u.corrupted}`);
    }
  }

  console.log('Final corrupted list:');
  const rows = await prisma.character.findMany({
    where:{ name:{ startsWith:'Corrupted ' }, active:true },
    select:{ id:true, name:true, anime:true, rarity:true, imageUrl:true },
    orderBy:{ basePower:'desc' }
  });
  console.table(rows);
  console.log('✅ Done. Push images to GitHub first, then run this script on Render.');
}
main().catch(e=>{ console.error(e); process.exit(1); }).finally(()=>prisma.$disconnect());
