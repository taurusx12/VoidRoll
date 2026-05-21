require('dotenv').config();

const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('./lib/config');
const { prisma } = require('./lib/db');
const { ensureUser } = require('./services/users');
const { rollCard } = require('./services/gacha');
const { checkCooldown, setCooldown } = require('./services/cooldowns');
const market = require('./services/market');
const equipment = require('./services/equipment');
const { getAura, embedColor } = require('./lib/aura');
const { renderCard } = require('./services/cardRender');
const { rollItem, equipItem, itemLine, seedItemTemplates } = require('./services/itemSystem');
const { renderItemCard } = require('./services/itemCardRender');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function money(n) { return Number(n || 0).toLocaleString('en-US'); }
function cardLine(c) { return `${c.id} • ${c.character.name} #${c.serial} • ${c.character.rarity} • PWR ${c.power}${c.shiny ? ' ✨' : ''}${c.trait ? ` • ${c.trait}` : ''}`; }

function priceRange(rarity) {
  const ranges = {
    COMMON: [100, 5000],
    RARE: [5000, 25000],
    EPIC: [25000, 120000],
    LEGENDARY: [120000, 600000],
    MYTHIC: [600000, 2500000],
    DIVINE: [2500000, 15000000],
    SECRET: [10000000, 50000000]
  };
  return ranges[rarity] || [100, 5000];
}

async function getRollUser(userId) {
  return prisma.user.findUnique({ where: { id: userId } });
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  try { await seedItemTemplates(); } catch (e) { console.error('Item seed failed:', e); }
});

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    await ensureUser(i.user);
    const userId = i.user.id;

    if (i.commandName === 'help') {
      return i.reply(
        `📘 **VOIDROLL COMMANDS**\n\n` +
        `🎴 /roll type:character - Roll an anime character\n` +
        `⚔️ /roll type:item - Roll weapons, armor, rings, and artifacts\n` +
        `👤 /profile - Show gold, rolls, tokens, and timer\n` +
        `🎒 /inventory - Show your latest character cards\n` +
        `⚙️ /equipment - Show your items\n` +
        `🧩 /equip - Equip an item to a character\n\n` +
        `🛒 /shop - Official packs and events\n` +
        `🔁 /transfer - Transfer Market listings\n` +
        `💰 /list - List a card on Transfer Market\n` +
        `🛍️ /buy - Buy a listing\n\n` +
        `📖 /story - Story progress\n` +
        `🏰 /dungeon - Dungeon progress\n` +
        `🗼 /tower - Tower progress\n` +
        `👹 /bosses - Active bosses\n` +
        `🔥 /sacrifice - Sacrifice cards to power up`
      );
    }

    if (i.commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const last = new Date(u.lastRollRefillAt || Date.now());
      const next = new Date(last.getTime() + (60 * 60 * 1000));
      return i.reply(
        `👤 ${i.user.username}\n` +
        `Gold: ${money(u.gold)}\n` +
        `Tokens: ${u.tokens ?? 0}\n` +
        `Rolls: ${u.rolls ?? 0}\n` +
        `Next Refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
        `Level: ${u.level}\n` +
        `Story: Chapter ${u.storyChapter || 1}, Stage ${u.storyStage || 1}\n` +
        `Dungeon Stage: ${u.dungeonStage || 1}\n` +
        `Tower Floor: ${u.towerFloor || 1}`
      );
    }

    if (i.commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');
      if (cd) return i.reply({ content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`, ephemeral: true });
      const reward = 1500;
      await prisma.user.update({ where: { id: userId }, data: { gold: { increment: reward }, dailyStreak: { increment: 1 } } });
      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);
      return i.reply(`🎁 Daily reward claimed: ${money(reward)} gold.`);
    }

    if (i.commandName === 'roll') {
      await i.deferReply();
      const type = i.options.getString('type') || 'character';
      const user = await getRollUser(userId);

      if ((user.rolls ?? 0) <= 0) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));
        return i.editReply(`❌ You do not have any rolls left.\n⏳ Next refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n🎲 Refill amount: +15 Rolls`);
      }

      await prisma.user.update({ where: { id: userId }, data: { rolls: { decrement: 1 } } });

      if (type === 'item') {
        const eq = await rollItem(userId);
        const embed = new EmbedBuilder()
          .setTitle('⚔️ New Item Roll!')
          .setDescription(
            `**${eq.template.name}**\n` +
            `Slot: **${eq.template.slot}**\n` +
            `Rarity: **${eq.template.rarity}**\n` +
            `Power: **${eq.power}**\n` +
            `Bonus: **${eq.template.bonusType || 'POWER'} +${eq.template.bonusValue || 0}**\n` +
            `${eq.template.characterHint ? `Best on: **${eq.template.characterHint}**\n` : ''}` +
            `🎲 Rolls left: **${(user.rolls ?? 1) - 1}**`
          )
          .setColor(embedColor(eq.template.rarity === 'DIVINE' ? '#F472B6' : eq.template.rarity === 'MYTHIC' ? '#EF4444' : '#8B5CF6'))
          .setFooter({ text: `Item ID: ${eq.id}` });
        const png = await renderItemCard(eq);
        const file = new AttachmentBuilder(png, { name: 'item.png' });
        embed.setImage('attachment://item.png');
        return i.editReply({ embeds: [embed], files: [file] });
      }

      const result = await rollCard(userId);
      const aura = getAura(result.character);
      const embed = new EmbedBuilder()
        .setTitle('🎴 New Character Roll!')
        .setDescription(`${result.text}\n\n🎌 Anime: **${result.character.anime}**\n🌌 Technique: **${aura.name}**\n🎲 Rolls left: **${(user.rolls ?? 1) - 1}**`)
        .setColor(embedColor(aura.color))
        .setFooter({ text: `Card ID: ${result.card.id}` });
      try {
        const png = await renderCard({ card: result.card, character: result.character });
        const file = new AttachmentBuilder(png, { name: 'card.png' });
        embed.setImage('attachment://card.png');
        return i.editReply({ embeds: [embed], files: [file] });
      } catch (err) {
        console.error(err);
        if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        return i.editReply({ embeds: [embed] });
      }
    }

    if (i.commandName === 'inventory') {
      const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true, equipment: { include: { template: true } } }, orderBy: { obtainedAt: 'desc' }, take: 10 });
      if (!cards.length) return i.reply('You do not have any cards yet. Use /roll type:character.');
      const c = cards[0];
      const aura = getAura(c.character);
      const embed = new EmbedBuilder()
        .setTitle(`🎴 ${c.character.name}`)
        .setDescription(
          `Anime: **${c.character.anime}**\n` +
          `Rarity: **${c.character.rarity}**\n` +
          `Power: **${c.power}**\n` +
          `Technique: **${aura.name}**\n` +
          `Equipped Items: **${c.equipment.length}**\n` +
          `Card ID: \`${c.id}\``
        )
        .setColor(embedColor(aura.color))
        .setImage(c.character.imageUrl || null)
        .setFooter({ text: `Showing latest card. Total shown: ${cards.length}` });
      return i.reply({ embeds: [embed] });
    }

    if (i.commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({ where: { userId }, include: { template: true, card: { include: { character: true } } }, take: 15, orderBy: { createdAt: 'desc' } });
      if (!eq.length) return i.reply('You do not have any items yet. Use /roll type:item.');
      const first = eq[0];
      const png = await renderItemCard(first);
      const file = new AttachmentBuilder(png, { name: 'item.png' });
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Equipment Inventory')
        .setDescription(eq.map(itemLine).join('\n').slice(0, 3500))
        .setImage('attachment://item.png')
        .setFooter({ text: 'Use /equip item_id card_id to equip an item.' });
      return i.reply({ embeds: [embed], files: [file] });
    }

    if (i.commandName === 'equip') {
      const itemId = i.options.getString('item_id', true);
      const cardId = i.options.getString('card_id', true);
      const r = await equipItem(userId, itemId, cardId);
      return i.reply(`✅ Equipped **${r.item.template.name}** to **${r.card.character.name}**. ${r.item.template.characterHint && r.card.character.name.toLowerCase().includes(r.item.template.characterHint.toLowerCase()) ? '🔥 Set Bonus activated!' : ''}`);
    }

    if (i.commandName === 'shop') {
      return i.reply(
        `🛒 **VOIDROLL SHOP**\n\n` +
        `No Random Pack here. Random rolls are handled by /roll.\n\n` +
        `Current Packs:\n` +
        `🔥 Jujutsu Event Pack - 25 Tokens\n` +
        `⚔️ Weapon Pack - 15 Tokens\n` +
        `🛡️ Armor Pack - 15 Tokens\n` +
        `👑 Limited Banner Pack - 50 Tokens\n\n` +
        `Use /events to see active banners.`
      );
    }

    if (i.commandName === 'events') {
      return i.reply(`🎉 **ACTIVE EVENTS**\n\n👑 Sukuna Raid Event\n⚡ Divine Rate Up: 0.45%\n⚔️ Bosses drop high rarity equipment\n🔁 Transfer Market tax: 5%`);
    }

    if (i.commandName === 'market' || i.commandName === 'transfer') {
      const items = await market.latest(10);
      if (!items.length) return i.reply('The Transfer Market is currently empty.');
      return i.reply(`🔁 **TRANSFER MARKET**\n\n` + items.map(x => `${x.id} • ${x.card.character.name} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n'));
    }

    if (i.commandName === 'sell' || i.commandName === 'list') {
      const cardId = i.options.getString('card_id', true);
      const price = i.options.getInteger('price', true);
      const card = await prisma.userCard.findFirst({ where: { id: cardId, userId }, include: { character: true } });
      if (!card) return i.reply({ content: 'Card not found in your inventory.', ephemeral: true });
      const [min, max] = priceRange(card.character.rarity);
      if (price < min || price > max) return i.reply({ content: `Price range for ${card.character.rarity}: ${money(min)} - ${money(max)} gold.`, ephemeral: true });
      const l = await market.sell(userId, cardId, price);
      return i.reply(`✅ Listed on Transfer Market.\nListing ID: ${l.id}\nPrice: ${money(price)} gold`);
    }

    if (i.commandName === 'buy') {
      const listingId = i.options.getString('listing_id', true);
      const r = await market.buy(userId, listingId);
      return i.reply(`✅ Purchase complete.\nMarket tax: ${money(r.tax)} gold.`);
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);
      return i.reply(r.success ? `✅ Upgrade successful. Equipment is now +${r.nextLevel}.` : `💥 Upgrade failed. You lost ${money(r.cost)} gold.`);
    }

    if (i.commandName === 'quests') return i.reply(`📜 **QUESTS**\n• Roll 10 cards → 5 Tokens\n• Clear 1 dungeon → 10 Tokens\n• Defeat a boss → 25 Tokens\n• Equip an anime item → 5 Tokens`);
    if (i.commandName === 'bosses') return i.reply(`👹 **BOSSES**\nAuto boss events can spawn in the configured channel. Join them when the bot announces one.`);
    if (i.commandName === 'limited-boss') return i.reply(`👑 **LIMITED BOSS**\nWait for the automatic event announcement, then join from the event message.`);
    if (i.commandName === 'dungeon') return i.reply(`🏰 **DUNGEON**\nYour current dungeon stage will be used automatically. Items can drop after wins.`);
    if (i.commandName === 'tower') return i.reply(`🗼 **TOWER**\nYour current tower floor will be used automatically. Rewards scale with floor.`);
    if (i.commandName === 'story') return i.reply(`📖 **STORY**\nYou progress forward only. Wins can drop gold, rolls, tokens, and equipment.`);
    if (i.commandName === 'sacrifice') return i.reply(`🔥 **SACRIFICE**\nSacrifice weak cards to power up strong cards. Full visual selector is coming next.`);

    if (i.commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) return i.reply({ content: 'Admin only.', ephemeral: true });
      const eq = await equipment.dropEquipment(userId, i.options.getString('rarity') || 'COMMON');
      return i.reply(eq ? `Equipment granted: ${eq.id}` : 'No equipment template exists for this rarity.');
    }
  } catch (err) {
    console.error(err);
    if (i.deferred || i.replied) return i.editReply({ content: `Error: ${err.message}` }).catch(() => {});
    return i.reply({ content: `Error: ${err.message}`, ephemeral: true }).catch(() => {});
  }
});

const app = express();
app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));
app.listen(config.port, () => console.log(`Health server on ${config.port}`));

if (!config.token) throw new Error('DISCORD_TOKEN missing');
client.login(config.token);
