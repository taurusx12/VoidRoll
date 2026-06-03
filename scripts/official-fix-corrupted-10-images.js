// VoidRoll Reborn — FULL LAUNCH — Corrupted 10 Image Fix
require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const RAW_BASE='https://raw.githubusercontent.com/taurusx12/VoidRoll/main/public/images/events/corrupted';
const charModel = Prisma.dmmf.datamodel.models.find(m=>m.name==='Character');
const fields = new Set((charModel?.fields||[]).filter(f=>f.kind==='scalar'||f.kind==='enum').map(f=>f.name));
function pick(data){const out={};for(const[k,v]of Object.entries(data))if(fields.has(k))out[k]=v;return out;}
function id(){return`char_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;}
const MAP=[
 ['Itachi',['Itachi Uchiha','Itachi'],'Corrupted Itachi Uchiha','Naruto','Corrupted_Itachi.png','DIVINE',1450000],
 ['Aizen',['Sousuke Aizen','Sosuke Aizen','Aizen'],'Corrupted Sousuke Aizen','Bleach','Corrupted_Aizen.png','DIVINE',1550000],
 ['Ainz',['Ainz Ooal Gown','Ainz'],'Corrupted Ainz Ooal Gown','Overlord','Corrupted_Ainz.png','DIVINE',1500000],
 ['Rimuru',['Rimuru Tempest','Rimuru'],'Corrupted Rimuru Tempest','That Time I Got Reincarnated as a Slime','Corrupted_Rimuru.png','DIVINE',1520000],
 ['Makima',['Makima'],'Corrupted Makima','Chainsaw Man','Corrupted_Makima.png','DIVINE',1480000],
 ['Lelouch',['Lelouch Lamperouge','Lelouch'],'Corrupted Lelouch Lamperouge','Code Geass','Corrupted_Lelouch.png','MYTHIC',1500000],
 ['Gojo',['Satoru Gojo','Satoru Gojou','Gojo','Gojou'],'Corrupted Satoru Gojo','Jujutsu Kaisen','Corrupted_Gojo.png','DIVINE',1580000],
 ['Eren',['Eren Yeager','Eren Jaeger','Eren'],'Corrupted Eren Yeager','Attack on Titan','Corrupted_Eren.png','MYTHIC',1400000],
 ['Saber',['Saber','Artoria Pendragon'],'Corrupted Saber','Fate','Corrupted_Saber.png','DIVINE',1460000],
 ['AllMight',['All Might','Toshinori Yagi'],'Corrupted All Might','My Hero Academia','Corrupted_AllMight.png','MYTHIC',1420000],
];
function ors(names){return names.map(n=>({name:{contains:n}}));}
async function main(){
 const report=[];
 for(const [key,baseNames,cName,anime,file,baseRarity,power] of MAP){
  const base=await prisma.character.findFirst({where:{OR:ors(baseNames),active:true},orderBy:{basePower:'desc'}}).catch(()=>null);
  if(base) await prisma.character.update({where:{id:base.id},data:pick({rarity:baseRarity,active:true,limited:false,banner:null})}).catch(()=>{});
  let corr=await prisma.character.findFirst({where:{OR:[{name:{contains:cName}},{name:{contains:`Corrupted ${baseNames[0]}`}},{name:{contains:`Corrupted ${key}`}}]}}).catch(()=>null);
  const data=pick({name:cName,anime:base?.anime||anime,rarity:'SECRET',basePower:Math.max(Number(corr?.basePower||0),power),baseFarm:Math.max(Number(base?.baseFarm||0),160000),baseLuck:Math.max(Number(base?.baseLuck||0),50000),imageUrl:`${RAW_BASE}/${file}`,active:true,globalPrint:Number(corr?.globalPrint||0),limited:true,banner:'CORRUPTED_EVENT',createdAt:corr?.createdAt||new Date()});
  if(corr) corr=await prisma.character.update({where:{id:corr.id},data});
  else corr=await prisma.character.create({data:pick({id:id(),...data})});
  if(fields.has('active')){
   const all=await prisma.character.findMany({where:{OR:ors(baseNames)}}).catch(()=>[]);
   const keep=new Set([base?.id,corr.id].filter(Boolean));
   const junk=all.filter(c=>!keep.has(c.id)).filter(c=>String(c.id).startsWith('gen_')||/\((Training|Legendary Variant|Early Arc|Support|Battle Ready|Limit Break|Elite|Commander|Prime|Domain Form|Transcendent|Ultimate|Raid Variant|Festival Variant|Dark Variant|Light Variant|Shadow Variant|Demon Variant|Hero Variant|Royal Variant|Awakened|Final Arc)\)/i.test(c.name||'')||/Absolute /i.test(c.name||'')).map(c=>c.id);
   if(junk.length) await prisma.character.updateMany({where:{id:{in:junk}},data:{active:false}}).catch(()=>{});
  }
  report.push({key,base:base?.name||'missing',baseRarity,corrupted:corr.name,file});
  console.log(`✅ ${cName} -> ${file}`);
 }
 console.table(report);
 console.log('✅ Corrupted 10 images fixed.');
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
