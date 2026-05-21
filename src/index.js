require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require('discord.js');
const { nanoid } = require('nanoid');

const config = require('./lib/config');
const { prisma } = require('./lib/db');
const { ensureUser } = require('./services/users');
const { rollCard } = require('./services/gacha');
const { checkCooldown, setCooldown } = require('./services/cooldowns');
const equipment = require('./services/equipment');
const { getAura, embedColor } = require('./lib/aura');
const { renderCard } = require('./services/cardRender');
const transfer = require('./services/transferMarket');
const { battle, sacrifice, setTeamSlot, showTeam, previewProgress } = require('./services/gameplay');
const bossEvents = require('./services/events');
const { ensureItemTemplates, getItemImagePath } = require('./services/itemCatalog');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function money(n) { return Number(n).toLocaleString('en-US'); }
function rarityEmoji(r) {
  return ({ COMMON:'⚪', RARE:'🔵', EPIC:'🟣', LEGENDARY:'🟡', MYTHIC:'🔴', DIVINE:'🌈', SECRET:'🕳️' })[r] || '🎴';
}

async function createCardForUser(userId, character) {
  const updated = await prisma.character.update({
    where: { id: character.id },
    data: { globalPrint: { increment: 1 } }
  });

  const shiny = Math.random() < 0.015;
  const power = character.basePower + Math.floor(Math.random() * 180) + (shiny ? 400 : 0);

  return prisma.userCard.create({
    data: {
      id: nanoid(),
      userId,
      characterId: character.id,
      serial: updated.globalPrint,
      power,
      shiny
    }
  });
}

const CHARACTER_ROLL_WEIGHTS = {
  COMMON: 720000,
  RARE: 220000,
  EPIC: 56500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

const ITEM_ROLL_WEIGHTS = {
  COMMON: 650000,
  RARE: 260000,
  EPIC: 76500,
  LEGENDARY: 10000,
  MYTHIC: 7500,
  DIVINE: 5000,
  SECRET: 1000
};

function weightedPick(items, weightFn) {
  let total = 0;
  const rows = items.map(item => {
    const weight = Math.max(1, Math.floor(weightFn(item)));
    total += weight;
    return { item, weight };
  });

  let roll = Math.floor(Math.random() * total);
  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) return row.item;
  }

  return rows[rows.length - 1]?.item;
}

async function rollRandomCharacter(userId) {
  const chars = await prisma.character.findMany({
    where: { active: true },
    take: 1000
  });

  if (!chars.length) throw new Error('No characters are available. Run seed first.');

  const character = weightedPick(chars, c => CHARACTER_ROLL_WEIGHTS[c.rarity] || 1000);
  const card = await createCardForUser(userId, character);

  return { card, character };
}

async function rollRandomItem(userId, slotFilter = null) {
  await ensureItemTemplates(prisma);

  const allChars = await prisma.character.findMany({
    where: { active: true },
    take: 1000
  });

  const containsAny = (value, words) => {
    const text = String(value || '').toLowerCase();
    return words.some(w => text.includes(w));
  };

  let chars = allChars;

  if (pack === 'jjk') chars = allChars.filter(c => containsAny(c.anime, ['jujutsu', 'kaisen']));
  if (pack === 'demon') chars = allChars.filter(c => containsAny(c.anime, ['demon slayer', 'kimetsu']));
  if (pack === 'naruto') chars = allChars.filter(c => containsAny(c.anime, ['naruto']));
  if (pack === 'onepiece') chars = allChars.filter(c => containsAny(c.anime, ['one piece']));
  if (pack === 'bleach') chars = allChars.filter(c => containsAny(c.anime, ['bleach']));
  if (pack === 'mha') chars = allChars.filter(c => containsAny(c.anime, ['my hero', 'boku no hero']));
  if (pack === 'hxh') chars = allChars.filter(c => containsAny(c.anime, ['hunter x hunter', 'hunter×hunter']));
  if (pack === 'dbz') chars = allChars.filter(c => containsAny(c.anime, ['dragon ball']));
  if (pack === 'aot') chars = allChars.filter(c => containsAny(c.anime, ['attack on titan', 'shingeki']));
  if (pack === 'villains') {
    const villainKeys = ['sukuna', 'muzan', 'madara', 'aizen', 'yhwach', 'kaido', 'doflamingo', 'shigaraki', 'all for one', 'meruem', 'chrollo', 'hisoka'];
    chars = allChars.filter(c => containsAny(c.name, villainKeys));
  }
  if (pack === 'secret') chars = allChars.filter(c => c.rarity === 'SECRET');
  if (pack === 'event') chars = allChars.filter(c => ['EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE', 'SECRET'].includes(c.rarity));

  if (!chars.length) chars = allChars;

  const character = weightedPick(chars, c => {
    if (pack === 'event') {
      return ({
        EPIC: 850000,
        LEGENDARY: 95000,
        MYTHIC: 22000,
        DIVINE: 7000,
        SECRET: 1200
      })[c.rarity] || 100;
    }

    if (pack === 'secret') {
      return ({
        SECRET: 700000,
        DIVINE: 200000,
        MYTHIC: 85000,
        LEGENDARY: 15000
      })[c.rarity] || 100;
    }

    return CHARACTER_ROLL_WEIGHTS[c.rarity] || 1000;
  });

  await prisma.user.update({
    where: { id: userId },
    data: { tokens: { decrement: cost.tokens } }
  });

  const card = await createCardForUser(userId, character);

  return { card, character, cost };
}

async function inventoryEmbed(userId, index = 0) {
  const cards = await prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { obtainedAt: 'desc' },
    take: 50
  });

  if (!cards.length) return { empty: true };

  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const c = cards[safeIndex];
  const aura = getAura(c.character);

  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.character.rarity)} ${c.character.name}`)
    .setDescription(
      `🎌 Anime: **${c.character.anime}**\n` +
      `💎 Rarity: **${c.character.rarity}**\n` +
      `⚔️ Power: **${c.power}**\n` +
      `🌌 Technique: **${aura.name}**\n` +
      `🆔 Card ID: \`${c.id}\``
    )
    .setImage(c.character.imageUrl)
    .setColor(embedColor(aura.color))
    .setFooter({ text: `Card ${safeIndex + 1}/${cards.length}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv_prev_${safeIndex}`)
      .setLabel('◀')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`inv_next_${safeIndex}`)
      .setLabel('▶')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, row };
}

function itemColor(rarity) {
  return ({
    COMMON: 0x9ca3af,
    RARE: 0x3b82f6,
    EPIC: 0xa855f7,
    LEGENDARY: 0xf59e0b,
    MYTHIC: 0xef4444,
    DIVINE: 0xfacc15,
    SECRET: 0x7c3aed
  })[rarity] || 0x8b5cf6;
}

function itemReplyPayload(result, title, extraText = '') {
  const template = result.template;
  const item = result.item;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `⚔️ Item: **${template.name}**\n` +
      `🧩 Slot: **${template.slot}**\n` +
      `💎 Rarity: **${template.rarity}**\n` +
      `🔥 Power: **${item.power}**\n` +
      `🆔 Item ID: \`${item.id}\`` +
      (extraText ? `\n${extraText}` : '')
    )
    .setColor(itemColor(template.rarity));

  const imagePath = getItemImagePath(template);

  if (imagePath) {
    const fileName = `${template.id}.png`;
    const file = new AttachmentBuilder(imagePath, { name: fileName });
    embed.setImage(`attachment://${fileName}`);

    return { embeds: [embed], files: [file] };
  }

  return { embeds: [embed] };
}

async function showBattle(i, mode) {
  await i.deferReply();

  const result = await battle(i.user.id, mode);

  let text = `⚔️ **${mode.toUpperCase()} BATTLE**\nPower: ${money(result.power)} / Required: ${money(result.required)}\n\n`;

  await i.editReply(text + 'Battle starting...');

  for (const line of result.logs) {
    text += `${line}\n`;
    await new Promise(r => setTimeout(r, 650));
    await i.editReply(text.slice(-1900)).catch(() => {});
  }

  text += `\n**Your Team**\n${result.allyStatus}\n\n**Enemies**\n${result.enemyStatus}\n\n`;

  if (result.won) {
    text += `✅ Victory! Rewards: ${money(result.gold)} gold, ${result.tokens} tokens, ${result.rolls} rolls.`;

    if (result.itemDrop) {
      text += `\n🎁 Item Drop: ${result.itemDrop.template.name} • ${result.itemDrop.template.rarity} • PWR ${result.itemDrop.item.power}`;
    }
  } else {
    text += '❌ Defeat. Upgrade your team and equipment.';
  }

  return i.editReply(text.slice(-1900));
}

async function findBossEventChannel() {
  const configured = process.env.BOSS_EVENT_CHANNEL_ID;

  if (configured) {
    const ch = await client.channels.fetch(configured).catch(() => null);
    if (ch && ch.isTextBased()) return ch;
  }

  for (const [, guild] of client.guilds.cache) {
    if (guild.systemChannel && guild.systemChannel.isTextBased()) return guild.systemChannel;

    const channels = await guild.channels.fetch().catch(() => null);

    if (!channels) continue;

    const textChannel = channels.find(ch =>
      ch &&
      ch.type === ChannelType.GuildText &&
      ch.permissionsFor(guild.members.me)?.has('SendMessages')
    );

    if (textChannel && textChannel.isTextBased()) return textChannel;
  }

  return null;
}

function bossJoinRow(eventId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`boss_join_${eventId}`)
      .setLabel('Join Boss Event')
      .setStyle(ButtonStyle.Danger)
  );
}

async function postAutomaticBossEvent() {
  try {
    const channel = await findBossEventChannel();

    if (!channel) {
      console.log('Auto boss skipped: no boss channel found. Set BOSS_EVENT_CHANNEL_ID in Render Environment.');
      return;
    }

    const existing = await bossEvents.getActiveEvent();

    if (existing) return;

    const event = await bossEvents.createBossEvent();
    const image = bossEvents.bossImage(event.bossName);

    const embed = new EmbedBuilder()
      .setTitle(`🚨 WORLD BOSS SPAWNED: ${event.bossName}`)
      .setDescription(
        `A massive boss has appeared suddenly.\n\n` +
        `👹 Boss Power: **${money(event.bossPower)}**\n` +
        `❤️ Boss HP: **${money(event.bossHp)}**\n` +
        `🎁 Rewards: **${money(event.rewardGold)} gold**, **${event.rewardTokens} tokens**, rolls and rare drops.\n\n` +
        `Click **Join Boss Event** before <t:${Math.floor(event.joinEndsAt.getTime() / 1000)}:R>.\n` +
        `The fight starts automatically when the timer ends.`
      )
      .setColor(0x8b0000);

    if (image) embed.setImage(image);

    const msg = await channel.send({
      embeds: [embed],
      components: [bossJoinRow(event.id)]
    });

    const delay = Math.max(1000, event.joinEndsAt.getTime() - Date.now() + 1500);

    setTimeout(async () => {
      try {
        await msg.edit({ components: [] }).catch(() => {});

        const result = await bossEvents.runEventBattle(event.id);

        if (!result) return;
        if (result.waiting) return;

        const resultEmbed = new EmbedBuilder()
          .setTitle(`👹 BOSS EVENT RESULT: ${event.bossName}`)
          .setDescription(
            `${result.statusText}\n\n` +
            `${result.logs.join('\n').slice(0, 1600)}\n\n` +
            `${result.won ? '✅ **Boss defeated! Rewards were distributed automatically.**' : '❌ **The boss survived. Upgrade your teams and try next event.**'}`
          )
          .setColor(result.won ? 0x22c55e : 0xef4444);

        if (image) resultEmbed.setImage(image);

        await channel.send({ embeds: [resultEmbed] });
      } catch (err) {
        console.error('Auto boss resolve failed:', err);
      }
    }, delay);
  } catch (err) {
    console.error('Auto boss event failed:', err);
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  ensureItemTemplates(prisma)
    .then(() => console.log('Item templates synced'))
    .catch(console.error);

  applySecretCharacterBoosts().catch(console.error);

  const firstDelay = Number(process.env.BOSS_EVENT_FIRST_DELAY_SECONDS || 60) * 1000;
  const interval = Number(process.env.BOSS_EVENT_INTERVAL_MINUTES || 60) * 60 * 1000;

  setTimeout(postAutomaticBossEvent, firstDelay);
  setInterval(postAutomaticBossEvent, interval);
});

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      await ensureUser(i.user);

      if (i.customId.startsWith('boss_join_')) {
        const eventId = i.customId.replace('boss_join_', '');
        const event = await bossEvents.joinEvent(i.user.id, eventId);

        return i.reply({
          content: `⚔️ You joined the boss event against **${event.bossName}**. Current players: **${event.entries.length}**`,
          ephemeral: true
        });
      }

      if (i.customId.startsWith('inv_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await inventoryEmbed(i.user.id, next);

        if (data.empty) {
          return i.reply({
            content: 'You do not have any cards yet.',
            ephemeral: true
          });
        }

        return i.update({
          embeds: [data.embed],
          components: [data.row]
        });
      }
    }

    if (!i.isChatInputCommand()) return;

    await ensureUser(i.user);

    const userId = i.user.id;
    const commandName = i.commandName;

    if (commandName === 'help') {
      return i.reply(
        `📘 **VOIDROLL HELP**\n\n` +
        `🎴 /r - Quick character roll\n` +
        `⚔️ /i - Quick item roll\n` +
        `🎴 /roll type:character - Character roll\n` +
        `⚔️ /roll type:item - Item roll\n` +
        `🚀 /autoteam - Automatically equip your strongest 5 cards\n` +
        `📦 /pack - Open official shop packs\n` +
        `🛒 /shop - Official packs and event banners. No Random Pack.\n` +
        `🔁 /transfer - Player Transfer Market\n` +
        `💰 /list - List a card with FIFA-style price limits\n` +
        `🛍️ /buy - Buy from Transfer Market\n` +
        `🎒 /inventory - Image inventory with arrows\n` +
        `👥 /team - Set/show your 5-card team\n` +
        `📖 /story - Status/start your current story stage\n` +
        `🏰 /dungeon - Status/start your current dungeon floor\n` +
        `🗼 /tower - Status/start tower\n` +
        `👹 /boss-event - View automatic boss event\n` +
        `⚔️ /join-boss - Join boss event\n` +
        `🧬 /sacrifice - Sacrifice duplicate/weak cards to power up a main card\n` +
        `⚙️ /equipment - Show equipment\n` +
        `⬆️ /upgrade - Upgrade equipment\n` +
        `📜 /quests - Show quests`
      );
    }

    if (commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const next = new Date(new Date(u.lastRollRefillAt || Date.now()).getTime() + 60 * 60 * 1000);

      return i.reply(
        `👤 ${i.user.username}\n` +
        `Gold: ${money(u.gold)}\n` +
        `Tokens: ${money(u.tokens)}\n` +
        `Rolls: ${u.rolls}\n` +
        `Next Refill: <t:${Math.floor(next.getTime()/1000)}:R>\n` +
        `Level: ${u.level}`
      );
    }

    if (commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');

      if (cd) {
        return i.reply({
          content: `Daily reward is available <t:${Math.floor(cd.getTime()/1000)}:R>.`,
          ephemeral: true
        });
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: 1500 },
          tokens: { increment: 3 },
          dailyStreak: { increment: 1 }
        }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);

      return i.reply('🎁 Daily claimed: 1,500 gold + 3 tokens.');
    }

    if (commandName === 'roll' || commandName === 'r' || commandName === 'i') {
      await i.deferReply();

      let type = 'character';

      if (commandName === 'i') type = 'item';
      else if (commandName === 'r') type = 'character';
      else type = i.options.getString('type') || 'character';

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.rolls || 0) <= 0) {
        const next = new Date(new Date(user.lastRollRefillAt || Date.now()).getTime() + 60 * 60 * 1000);

        return i.editReply(
          `❌ You do not have any rolls left.\n` +
          `⏳ Next refill: <t:${Math.floor(next.getTime()/1000)}:R>\n` +
          `🎲 Refill amount: +15 Rolls`
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { rolls: { decrement: 1 } }
      });

      if (type === 'item') {
        const r = await rollRandomItem(userId);

        return i.editReply(
          itemReplyPayload(
            r,
            '⚔️ Item Roll!',
            `🎲 Rolls left: **${user.rolls - 1}**`
          )
        );
      }

      const result = await rollRandomCharacter(userId);
      const aura = getAura(result.character);

      const embed = new EmbedBuilder()
        .setTitle('🎴 New Character Roll!')
        .setDescription(
          `${rarityEmoji(result.character.rarity)} **${result.character.name}**\n\n` +
          `🎌 Anime: **${result.character.anime}**\n` +
          `💎 Rarity: **${result.character.rarity}**\n` +
          `🌌 Technique: **${aura.name}**\n` +
          `⚔️ Power: **${result.card.power}**\n` +
          `🎲 Rolls left: **${user.rolls - 1}**`
        )
        .setColor(embedColor(aura.color))
        .setFooter({ text: `Card ID: ${result.card.id}` });

      try {
        const png = await renderCard({
          card: result.card,
          character: result.character
        });

        const file = new AttachmentBuilder(png, { name: 'card.png' });

        embed.setImage('attachment://card.png');

        return i.editReply({
          embeds: [embed],
          files: [file]
        });
      } catch (_) {
        if (result.character.imageUrl) {
          embed.setImage(result.character.imageUrl);
        }

        return i.editReply({ embeds: [embed] });
      }
    }

    if (commandName === 'autoteam') {
      const cards = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { power: 'desc' },
        take: 5
      });

      if (!cards.length) {
        return i.reply('You do not have any cards yet.');
      }

      await prisma.teamSlot.deleteMany({
        where: { userId }
      });

      for (let x = 0; x < cards.length; x++) {
        await prisma.teamSlot.create({
          data: {
            id: `${userId}_${x + 1}`,
            userId,
            slot: x + 1,
            cardId: cards[x].id
          }
        });
      }

      return i.reply(
        `🚀 **Auto Team Equipped!**\n\n` +
        cards
          .map((c, idx) => `Slot ${idx + 1}: ${rarityEmoji(c.character.rarity)} **${c.character.name}** • PWR ${c.power}`)
          .join('\n')
      );
    }

    if (commandName === 'inventory') {
      const data = await inventoryEmbed(userId, 0);

      if (data.empty) {
        return i.reply('You do not have any cards yet.');
      }

      return i.reply({
        embeds: [data.embed],
        components: [data.row]
      });
    }

    if (commandName === 'team') {
      const action = i.options.getString('action', true);

      if (action === 'show') {
        return i.reply(`👥 **Your Team**\n${await showTeam(userId)}`);
      }

      const slot = i.options.getInteger('slot', true);
      const cardId = i.options.getString('card_id', true);

      await setTeamSlot(userId, slot, cardId);

      return i.reply(`✅ Team slot ${slot} updated.`);
    }

    if (['story', 'dungeon', 'tower'].includes(commandName)) {
      const action = i.options.getString('action') || 'status';
      const mode = commandName;

      if (action === 'start') {
        return showBattle(i, mode);
      }

      const p = await previewProgress(userId, mode);
      const label = mode === 'story'
        ? `Chapter ${p.chapter}, Stage ${p.stage}/30`
        : `${mode} Floor ${p.stage}`;

      return i.reply(
        `📍 **${mode.toUpperCase()} STATUS**\n` +
        `Current: **${label}**\n` +
        `Your Power: **${money(p.pwr)}**\n` +
        `Recommended Power: **${money(p.req)}**\n\n` +
        `Use **/${mode} action:start** to begin.`
      );
    }

    if (commandName === 'shop') {
      return i.reply(
        `🛒 **VOIDROLL SHOP**\n\n` +
        `🔥 Jujutsu Pack - 10 Tokens\n` +
        `🗡️ Demon Slayer Pack - 10 Tokens\n` +
        `🍥 Naruto Pack - 10 Tokens\n` +
        `🏴‍☠️ One Piece Pack - 10 Tokens\n` +
        `🧿 Bleach Pack - 10 Tokens\n` +
        `💥 My Hero Pack - 10 Tokens\n` +
        `🎣 Hunter x Hunter Pack - 10 Tokens\n` +
        `🐉 Dragon Ball Pack - 10 Tokens\n` +
        `🧱 Attack on Titan Pack - 10 Tokens\n` +
        `😈 Villains Pack - 18 Tokens\n` +
        `🕳️ Secret Pack - 50 Tokens\n` +
        `⚔️ Weapon Pack - 15 Tokens\n` +
        `🌌 Event Pack - 25 Tokens\n\n` +
        `Use /pack type:<pack>.`
      );
    }

    if (commandName === 'events') {
      return i.reply(
        `🌌 **ACTIVE EVENTS**\n\n` +
        `🔥 Sukuna Raid Event\n` +
        `• Boss event can appear anytime.\n` +
        `• Use /boss-event and /join-boss.\n\n` +
        `⚡ Limited Rate-Up Event\n` +
        `• Event Pack has better high-tier odds. Mythic/Divine are still very rare.\n\n` +
        `🛒 Transfer Market Tax: 5%`
      );
    }

    if (commandName === 'pack') {
      await i.deferReply();

      const type = i.options.getString('type', true);
      const r = await openPack(userId, type);

      if (r.item) {
        return i.editReply(
          itemReplyPayload(r, `📦 ${type.toUpperCase()} Pack`)
        );
      }

      const aura = getAura(r.character);

      const embed = new EmbedBuilder()
        .setTitle(`📦 ${type.toUpperCase()} Pack`)
        .setDescription(
          `${rarityEmoji(r.character.rarity)} **${r.character.name}**\n` +
          `🎌 Anime: **${r.character.anime}**\n` +
          `💎 Rarity: **${r.character.rarity}**\n` +
          `⚔️ Power: **${r.card.power}**\n` +
          `🌌 Technique: **${aura.name}**`
        )
        .setImage(r.character.imageUrl)
        .setColor(embedColor(aura.color))
        .setFooter({ text: `Card ID: ${r.card.id}` });

      return i.editReply({ embeds: [embed] });
    }

    if (commandName === 'transfer' || commandName === 'market') {
      const items = await transfer.latest(10);

      if (!items.length) {
        return i.reply('🔁 Transfer Market is empty.');
      }

      return i.reply(
        '🔁 **TRANSFER MARKET**\n' +
        items
          .map(x => `${x.id} • ${x.card.character.name} • ${x.card.character.rarity} • ${money(x.price)} gold`)
          .join('\n')
      );
    }

    if (commandName === 'list') {
      const listing = await transfer.listCard(
        userId,
        i.options.getString('card_id', true),
        i.options.getInteger('price', true)
      );

      return i.reply(`✅ Listed on Transfer Market. Listing ID: ${listing.id}`);
    }

    if (commandName === 'buy') {
      const r = await transfer.buy(
        userId,
        i.options.getString('listing_id', true)
      );

      return i.reply(`✅ Transfer complete. Market tax: ${money(r.tax)} gold.`);
    }

    if (commandName === 'boss-event') {
      const event = await bossEvents.eventStatus();

      return i.reply(
        `👹 **BOSS EVENT**\n` +
        `Boss: **${event.bossName}**\n` +
        `Power: **${money(event.bossPower)}**\n` +
        `HP: **${money(event.bossHp)}**\n` +
        `Status: **${event.status}**\n` +
        `Join ends: <t:${Math.floor(event.joinEndsAt.getTime()/1000)}:R>\n\n` +
        `You can join from the automatic event button when it appears.`
      );
    }

    if (commandName === 'join-boss') {
      const event = await bossEvents.joinEvent(userId);

      return i.reply(`⚔️ You joined the boss event against **${event.bossName}**.`);
    }

    if (commandName === 'quests') {
      return i.reply(
        '📜 **QUESTS**\n' +
        '• Roll 10 cards → 5 Tokens\n' +
        '• Clear 1 dungeon → 10 Tokens\n' +
        '• Defeat boss event → huge rewards\n' +
        '• Sacrifice 3 cards → 5 Tokens'
      );
    }

    if (commandName === 'sacrifice') {
      const r = await sacrifice(
        userId,
        i.options.getString('main_card', true),
        i.options.getString('sacrifice_card', true)
      );

      return i.reply(
        `🔥 Sacrificed **${r.food.character.name}** into **${r.main.character.name}**.\n` +
        `Power gained: +${r.gain}\n` +
        `New Power: ${r.newPower}`
      );
    }

    if (commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({
        where: { userId },
        include: { template: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      if (!eq.length) {
        return i.reply('You do not have any equipment yet.');
      }

      return i.reply(
        eq
          .map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${e.power}`)
          .join('\n')
      );
    }

        if (commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);

      return i.reply(
        r.success
          ? `✅ Upgrade successful. Equipment is now +${r.nextLevel}.`
          : `💥 Upgrade failed. You lost ${money(r.cost)} gold.`
      );
    }

    if (commandName === 'search') {
      const name = i.options.getString('name', true);

      const chars = await prisma.character.findMany({
        where: {
          name: {
            contains: name
          }
        },
        take: 10
      });

      if (!chars.length) {
        return i.reply('❌ No characters found.');
      }

      const first = chars[0];
      const aura = getAura(first);

      const embed = new EmbedBuilder()
        .setTitle(`🔎 ${first.name}`)
        .setDescription(
          `🎌 Anime: **${first.anime}**
` +
          `💎 Rarity: **${first.rarity}**
` +
          `⚔️ Base Power: **${first.basePower}**
` +
          `🌌 Technique: **${aura.name}**

` +
          `**Other results:**
` +
          chars.slice(1).map(c => `${rarityEmoji(c.rarity)} ${c.name} • ${c.anime} • PWR ${c.basePower}`).join('
')
        )
        .setImage(first.imageUrl)
        .setColor(embedColor(aura.color));

      try {
        const preview = await renderCard({
          card: { id: 'preview', serial: 0, power: first.basePower },
          character: first
        });

        const file = new AttachmentBuilder(preview, { name: 'search-preview.png' });
        embed.setImage('attachment://search-preview.png');

        return i.reply({ embeds: [embed], files: [file] });
      } catch (_) {
        return i.reply({ embeds: [embed] });
      }
    }

    if (commandName === 'secrets') {
      const chars = await prisma.character.findMany({
        where: { rarity: 'SECRET' },
        orderBy: { basePower: 'desc' },
        take: 50
      });

      if (!chars.length) {
        return i.reply('No SECRET characters found.');
      }

      return i.reply(
        '🕳️ **SECRET CHARACTERS**

' +
        chars.map(c => `🕳️ ${c.name} • ${c.anime} • PWR ${c.basePower}`).join('
')
      );
    }

    if (commandName === 'rarity') {
      return i.reply(
        `🎲 **NORMAL ROLL RATES**

` +

        `🎴 **Character Roll**
` +
        `⚪ Common: 72%
` +
        `🔵 Rare: 22%
` +
        `🟣 Epic: 5.65%
` +
        `🟡 Legendary: 1%
` +
        `🔴 Mythic: 0.75%
` +
        `🌈 Divine: 0.5%
` +
        `🕳️ Secret: 0.1%

` +

        `⚔️ **Item Roll**
` +
        `⚪ Common: 65%
` +
        `🔵 Rare: 26%
` +
        `🟣 Epic: 7.65%
` +
        `🟡 Legendary: 1%
` +
        `🔴 Mythic: 0.75%
` +
        `🌈 Divine: 0.5%
` +
        `🕳️ Secret: 0.1%`
      );
    }

    if (commandName === 'admin-give-rolls') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({
          content: 'Admin only.',
          ephemeral: true
        });
      }

      const target = i.options.getUser('user', true);
      const amount = i.options.getInteger('amount', true);

      if (amount <= 0) {
        return i.reply({
          content: 'Amount must be greater than 0.',
          ephemeral: true
        });
      }

      await ensureUser(target);

      const updated = await prisma.user.update({
        where: { id: target.id },
        data: {
          rolls: {
            increment: amount
          }
        }
      });

      return i.reply(
        `✅ Added **${amount} rolls** to **${target.username}**.\n` +
        `New rolls balance: **${updated.rolls}**`
      );
    }

    if (commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({
          content: 'Admin only.',
          ephemeral: true
        });
      }

      const eq = await equipment.dropEquipment(
        userId,
        i.options.getString('rarity') || 'COMMON'
      );

      return i.reply(
        eq
          ? `Equipment granted: ${eq.id}`
          : 'No equipment template exists for this rarity.'
      );
    }
  } catch (err) {
    console.error(err);

    if (i.deferred || i.replied) {
      return i.editReply({
        content: `Error: ${err.message}`
      }).catch(() => {});
    }

    return i.reply({
      content: `Error: ${err.message}`,
      ephemeral: true
    }).catch(() => {});
  }
});

const app = express();

app.get('/health', (_, res) => {
  res.json({
    ok: true,
    uptime: process.uptime()
  });
});

app.listen(config.port, () => {
  console.log(`Health server on ${config.port}`);
});

if (!config.token) {
  throw new Error('DISCORD_TOKEN missing');
}

client.login(config.token);