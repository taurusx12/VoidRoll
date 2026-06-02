require('dotenv').config();
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const corruptedImage = 'https://raw.githubusercontent.com/taurusx12/VoidRoll/main/public/images/events/corrupted/Corrupted_Lelouch.png';
const normalImage = 'https://cdn.myanimelist.net/images/characters/8/406163.jpg';

function getFields() {
  const model = Prisma.dmmf.datamodel.models.find(m => m.name === 'Character');
  return new Set(model.fields.filter(f => f.kind === 'scalar' || f.kind === 'enum').map(f => f.name));
}

function pick(data, fields) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (fields.has(k)) out[k] = v;
  }
  return out;
}

async function main() {
  const fields = getFields();

  console.log('1) Fix normal Lelouch => MYTHIC');
  const normal = await prisma.character.findFirst({
    where: { id: 'mal_417' }
  }) || await prisma.character.findFirst({
    where: {
      name: 'Lelouch Lamperouge',
      anime: { contains: 'Code Geass' }
    }
  });

  if (normal) {
    await prisma.character.update({
      where: { id: normal.id },
      data: pick({
        name: 'Lelouch Lamperouge',
        anime: normal.anime || 'Code Geass',
        rarity: 'MYTHIC',
        basePower: Math.min(Number(normal.basePower || 620000), 620000),
        imageUrl: normal.imageUrl || normalImage,
        active: true,
        limited: false,
        banner: null
      }, fields)
    });
    console.log(`✅ Normal Lelouch fixed: ${normal.id}`);
  } else {
    console.log('⚠️ Normal Lelouch not found.');
  }

  console.log('2) Convert Absolute Lelouch into Corrupted Lelouch');
  let target = await prisma.character.findFirst({
    where: {
      OR: [
        { name: { contains: 'Absolute Lelouch' } },
        { name: { contains: 'Corrupted Lelouch' } }
      ]
    }
  });

  if (!target) {
    console.log('⚠️ No Absolute/Corrupted Lelouch found, creating Corrupted from normal.');
    const baseFarm = normal ? Number(normal.baseFarm || 180000) : 180000;
    const baseLuck = normal ? Number(normal.baseLuck || 55000) : 55000;

    target = await prisma.character.create({
      data: pick({
        id: `char_${Date.now()}_${Math.random().toString(36).slice(2,10)}`,
        name: 'Corrupted Lelouch Lamperouge',
        anime: 'Code Geass',
        rarity: 'SECRET',
        basePower: 1500000,
        baseFarm,
        baseLuck,
        imageUrl: corruptedImage,
        active: true,
        globalPrint: 0,
        limited: true,
        banner: 'CORRUPTED_EVENT',
        createdAt: new Date()
      }, fields)
    });

    console.log(`✅ Corrupted Lelouch created: ${target.id}`);
  } else {
    await prisma.character.update({
      where: { id: target.id },
      data: pick({
        name: 'Corrupted Lelouch Lamperouge',
        anime: target.anime || 'Code Geass',
        rarity: 'SECRET',
        basePower: Math.max(Number(target.basePower || 0), 1500000),
        imageUrl: corruptedImage,
        active: true,
        limited: true,
        banner: 'CORRUPTED_EVENT'
      }, fields)
    });

    console.log(`✅ Converted/updated target into Corrupted Lelouch: ${target.id}`);
  }

  console.log('3) Disable extra Absolute Lelouch records if any remained');
  if (fields.has('active')) {
    const disabledAbs = await prisma.character.updateMany({
      where: {
        name: { contains: 'Absolute Lelouch' }
      },
      data: { active: false }
    });
    console.log(`✅ Disabled remaining Absolute Lelouch records: ${disabledAbs.count}`);
  }

  console.log('4) Disable junk/generated Lelouch duplicates');
  const all = await prisma.character.findMany({
    where: {
      OR: [
        { name: { contains: 'Lelouch' } },
        { name: { contains: 'Lamperouge' } }
      ]
    }
  });

  const keepNames = new Set([
    'Lelouch Lamperouge',
    'Corrupted Lelouch Lamperouge'
  ]);

  const junkIds = all
    .filter(c => {
      if (keepNames.has(c.name)) return false;
      if (String(c.id).startsWith('gen_')) return true;
      if (/Absolute Lelouch/i.test(c.name || '')) return true;
      if (/\((Training|Legendary Variant|Early Arc|Support|Battle Ready|Limit Break|Elite|Commander|Prime|Domain Form|Transcendent|Ultimate|Raid Variant|Festival Variant|Dark Variant|Light Variant|Shadow Variant|Demon Variant|Hero Variant|Royal Variant|Awakened|Final Arc)\)/i.test(c.name || '')) return true;
      return false;
    })
    .map(c => c.id);

  if (junkIds.length && fields.has('active')) {
    const res = await prisma.character.updateMany({
      where: { id: { in: junkIds } },
      data: { active: false }
    });
    console.log(`✅ Disabled junk Lelouch duplicates: ${res.count}`);
  } else {
    console.log('No junk duplicates disabled.');
  }

  console.log('5) Final active Lelouch list');
  const rows = await prisma.character.findMany({
    where: {
      OR: [
        { name: { contains: 'Lelouch' } },
        { name: { contains: 'Lamperouge' } }
      ],
      active: true
    },
    select: {
      id: true,
      name: true,
      anime: true,
      rarity: true,
      imageUrl: true,
      active: true
    },
    orderBy: { basePower: 'desc' }
  });

  console.table(rows);
  console.log('✅ Done. Current event is CORRUPTED only. Absolute is postponed.');
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
