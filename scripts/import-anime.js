// Optional importer. Pulls popular characters from Jikan (MyAnimeList unofficial API) if internet is available.
const axios = require('axios');
const { prisma } = require('../src/lib/db');
const rarities = ['COMMON','RARE','EPIC','LEGENDARY','MYTHIC','DIVINE'];
function rarityByFavorites(f=0){ if(f>50000)return 'DIVINE'; if(f>25000)return 'MYTHIC'; if(f>10000)return 'LEGENDARY'; if(f>4000)return 'EPIC'; if(f>1000)return 'RARE'; return 'COMMON'; }
(async()=>{
  for (let page=1; page<=20; page++) {
    const { data } = await axios.get(`https://api.jikan.moe/v4/top/characters?page=${page}`);
    for (const c of data.data || []) {
      const id = `jikan_${c.mal_id}`;
      await prisma.character.upsert({ where:{id}, update:{ name:c.name, imageUrl:c.images?.jpg?.image_url }, create:{ id, name:c.name, anime:'Imported', rarity:rarityByFavorites(c.favorites), element:'Neutral', imageUrl:c.images?.jpg?.image_url, basePower:200+Math.floor(Math.sqrt(c.favorites||1)*8), baseFarm:50, baseLuck:10 } });
    }
    await new Promise(r=>setTimeout(r, 1100));
  }
  console.log('Import complete'); await prisma.$disconnect();
})();
