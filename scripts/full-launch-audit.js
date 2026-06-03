// VoidRoll Reborn — FULL LAUNCH — Audit
require('dotenv').config();
const { PrismaClient }=require('@prisma/client');
const prisma=new PrismaClient();
async function main(){
 const corrupted=await prisma.character.findMany({where:{name:{contains:'Corrupted'}},select:{name:true,rarity:true,imageUrl:true,active:true},orderBy:{name:'asc'}}).catch(()=>[]);
 console.log('Corrupted characters:',corrupted.length);
 console.table(corrupted.slice(0,30));
 const users=await prisma.user.count().catch(()=>0);
 const chars=await prisma.character.count().catch(()=>0);
 console.log({users,characters:chars});
}
main().finally(()=>prisma.$disconnect());
