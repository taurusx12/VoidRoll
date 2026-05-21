// Replace your CHARACTER_ROLL_WEIGHTS with this:
const CHARACTER_ROLL_WEIGHTS = {
  COMMON: 720000,
  RARE: 220000,
  EPIC: 56500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

// Replace your ITEM_ROLL_WEIGHTS with this:
const ITEM_ROLL_WEIGHTS = {
  COMMON: 650000,
  RARE: 260000,
  EPIC: 76500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

// Add these handlers inside src/index.js before admin commands:
if (commandName === 'search') {
  const name = i.options.getString('name', true);

  const chars = await prisma.character.findMany({
    where: {
      name: {
        contains: name,
        mode: 'insensitive'
      }
    },
    take: 10
  });

  if (!chars.length) {
    return i.reply('❌ No characters found.');
  }

  return i.reply(
    '🔎 **Search Results**\n\n' +
    chars.map(c => `${rarityEmoji(c.rarity)} **${c.name}** • ${c.anime} • ${c.rarity}`).join('\n')
  );
}

if (commandName === 'rarity') {
  return i.reply(
    `🎲 **NORMAL ROLL RATES**\n\n` +

    `🎴 **Character Roll**\n` +
    `⚪ Common: 72%\n` +
    `🔵 Rare: 22%\n` +
    `🟣 Epic: 5.65%\n` +
    `🟡 Legendary: 1%\n` +
    `🔴 Mythic: 0.75%\n` +
    `🌈 Divine: 0.5%\n` +
    `🕳️ Secret: 0.1%\n\n` +

    `⚔️ **Item Roll**\n` +
    `⚪ Common: 65%\n` +
    `🔵 Rare: 26%\n` +
    `🟣 Epic: 7.65%\n` +
    `🟡 Legendary: 1%\n` +
    `🔴 Mythic: 0.75%\n` +
    `🌈 Divine: 0.5%\n` +
    `🕳️ Secret: 0.1%`
  );
}
