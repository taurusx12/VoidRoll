require('dotenv').config();
const fs=require('fs'), path=require('path');
const { PrismaClient }=require('@prisma/client');
const variantPresentation=require('../src/systems/variantPresentationSystem');
const prisma=new PrismaClient();
async function main(){
 const dir=path.join(process.cwd(),'reports'); if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});
 const chars=await prisma.character.findMany({where:{active:true},orderBy:{basePower:'desc'},take:50000});
 const groups=variantPresentation.groupVariants(chars), rows=[], warns=[];
 for(const [key,items] of groups.entries()){
  const vars=items.filter(x=>x.profile.isVariant), bases=items.filter(x=>!x.profile.isVariant);
  for(const v of vars){
   const same=bases.find(b=>b.character.imageUrl&&b.character.imageUrl===v.character.imageUrl);
   if(same) warns.push({variant:v.character.name,base:same.character.name,imageUrl:v.character.imageUrl});
   rows.push({baseKey:key,baseCharacters:bases.map(x=>x.character.name),variant:v.character.name,anime:v.character.anime,rarity:v.character.rarity,eventType:v.profile.eventType,role:v.profile.role,element:v.profile.element,passive:v.profile.passiveName,imageUrl:v.character.imageUrl});
  }
 }
 fs.writeFileSync(path.join(dir,'FINAL_VARIANTS.json'),JSON.stringify(rows,null,2));
 fs.writeFileSync(path.join(dir,'FINAL_VARIANT_IMAGE_WARNINGS.json'),JSON.stringify(warns,null,2));
 fs.writeFileSync(path.join(dir,'FINAL_VARIANT_AUDIT.md'),['# Final Variant Audit','',`Variants: **${rows.length}**`,`Image warnings: **${warns.length}**`,'','## Preview',...rows.slice(0,80).map(x=>`- **${x.variant}** (${x.anime}) • Base: ${x.baseCharacters.join(', ')||x.baseKey} • ${x.eventType} • ${x.role}/${x.element}`),'','## Image warnings',...(warns.length?warns.slice(0,80).map(x=>`- ${x.variant} shares image with ${x.base}`):['None'])].join('\n'));
 console.log('✅ Variant audit complete.'); console.log(`Variants: ${rows.length}`); console.log(`Image warnings: ${warns.length}`); console.log('cat reports/FINAL_VARIANT_AUDIT.md');
}
main().finally(()=>prisma.$disconnect());
