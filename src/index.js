require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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
const { PRICE_LIMITS } = require('./services/economy');
const { battle, sacrifice, setTeamSlot, showTeam, previewProgress } = require('./services/gameplay');
const bossEvents = require('./services/events');

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
    data: { id: nanoid(), userId, characterId: character.id, serial: updated.globalPrint, power, shiny }
  });
}

async function openPack(userId, type) {
  const pack = String(type || 'random').toLowerCase();
  const costs = { random: { rolls: 1 }, jjk: { tokens: 10 }, demon: { tokens: 10 }, naruto: { tokens: 10 }, onepiece: { tokens: 10 }, event: { tokens: 25 }, weapon: { tokens: 15 } };
  const cost = costs[pack] || costs.random;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (cost.rolls && user.rolls < cost.rolls) throw new Error('Not enough rolls.');
  if (cost.tokens && user.tokens < cost.tokens) throw new Error('Not enough tokens.');

  if (pack === 'weapon') {
    const templates = await prisma.equipmentTemplate.findMany({ where: { active: true } });
    if (!templates.length) throw new Error('No weapon/equipment templates found.');
    const t = templates[Math.floor(Math.random() * templates.length)];
    const item = await prisma.userEquipment.create({ data: { id: nanoid(), userId, templateId: t.id, power: t.basePower + Math.floor(Math.random() * 80) } });
    await prisma.user.update({ where: { id: userId }, data: cost.tokens ? { tokens: { decrement: cost.tokens } } : { rolls: { decrement: cost.rolls } } });
    return { equipment: item, template: t, cost };
  }

  const where = { active: true };
  if (pack === 'jjk') where.anime = { contains: 'Jujutsu', mode: 'insensitive' };
  if (pack === 'demon') where.OR = [{ anime: { contains: 'Demon Slayer', mode: 'insensitive' } }, { anime: { contains: 'Kimetsu', mode: 'insensitive' } }];
  if (pack === 'naruto') where.anime = { contains: 'Naruto', mode: 'insensitive' };
  if (pack === 'onepiece') where.OR = [{ anime: { contains: 'One Piece', mode: 'insensitive' } }, { anime: { contains: 'ONE PIECE', mode: 'insensitive' } }];

  if (pack === 'random') where.rarity = { in: ['COMMON', 'RARE', 'EPIC'] }; // official random drops max Epic
  if (pack === 'event') where.rarity = { in: ['EPIC', 'LEGENDARY', 'MYTHIC', 'DIVINE'] };

  let chars = await prisma.character.findMany({ where, take: 250 });
  if (!chars.length) chars = await prisma.character.findMany({ where: { active: true }, take: 250 });

  // harder rates for high rarity
  const weighted = [];
  for (const c of chars) {
    const w = { COMMON: 60, RARE: 28, EPIC: 10, LEGENDARY: 3, MYTHIC: 1, DIVINE: 0.15, SECRET: 0.05 }[c.rarity] || 10;
    for (let i = 0; i < Math.max(1, Math.floor(w * 10)); i++) weighted.push(c);
  }
  const character = weighted[Math.floor(Math.random() * weighted.length)];
  const card = await createCardForUser(userId, character);
  await prisma.user.update({ where: { id: userId }, data: cost.tokens ? { tokens: { decrement: cost.tokens } } : { rolls: { decrement: cost.rolls } } });
  return { card, character, cost };
}

async function inventoryEmbed(userId, index = 0) {
  const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { obtainedAt: 'desc' }, take: 50 });
  if (!cards.length) return { empty: true };
  const safeIndex = Math.max(0, Math.min(index, cards.length - 1));
  const c = cards[safeIndex];
  const aura = getAura(c.character);
  const embed = new EmbedBuilder()
    .setTitle(`${rarityEmoji(c.character.rarity)} ${c.character.name}`)
    .setDescription(`🎌 Anime: **${c.character.anime}**\n💎 Rarity: **${c.character.rarity}**\n⚔️ Power: **${c.power}**\n🌌 Technique: **${aura.name}**\n🆔 Card ID: \`${c.id}\``)
    .setImage(c.character.imageUrl)
    .setColor(embedColor(aura.color))
    .setFooter({ text: `Card ${safeIndex + 1}/${cards.length}` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`inv_prev_${safeIndex}`).setLabel('◀').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`inv_next_${safeIndex}`).setLabel('▶').setStyle(ButtonStyle.Secondary)
  );
  return { embed, row };
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
  text += result.won ? `✅ Victory! Rewards: ${money(result.gold)} gold, ${result.tokens} tokens, ${result.rolls} rolls.` : '❌ Defeat. Upgrade your team and equipment.';
  return i.editReply(text.slice(-1900));
}

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      await ensureUser(i.user);
      if (i.customId.startsWith('inv_')) {
        const [, dir, raw] = i.customId.split('_');
        const current = Number(raw || 0);
        const next = dir === 'next' ? current + 1 : current - 1;
        const data = await inventoryEmbed(i.user.id, next);
        if (data.empty) return i.reply({ content: 'You do not have any cards yet.', ephemeral: true });
        return i.update({ embeds: [data.embed], components: [data.row] });
      }
    }

    if (!i.isChatInputCommand()) return;
    await ensureUser(i.user);
    const userId = i.user.id;

    if (i.commandName === 'help') {
      return i.reply(`📘 **VOIDROLL HELP**\n\n🎴 /roll - Free random roll\n📦 /pack - Open official shop packs\n🛒 /shop - Official packs and event banners\n🔁 /transfer - Player Transfer Market\n💰 /list - List a card with FIFA-style price limits\n🛍️ /buy - Buy from Transfer Market\n🎒 /inventory - Image inventory with arrows\n👥 /team - Set/show your 5-card team\n📖 /story - Status/start your current story stage\n🏰 /dungeon - Status/start your current dungeon floor\n🗼 /tower - Status/start tower\n👹 /boss-event - View automatic boss event\n⚔️ /join-boss - Join boss event\n🔥 /start-boss - Resolve event after join timer\n🧬 /sacrifice - Sacrifice duplicate/weak cards to power up a main card\n⚙️ /equipment - Show equipment\n⬆️ /upgrade - Upgrade equipment\n📜 /quests - Show quests`);
    }

    if (i.commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const next = new Date(new Date(u.lastRollRefillAt || Date.now()).getTime() + 60 * 60 * 1000);
      return i.reply(`👤 ${i.user.username}\nGold: ${money(u.gold)}\nTokens: ${money(u.tokens)}\nRolls: ${u.rolls}\nNext Refill: <t:${Math.floor(next.getTime()/1000)}:R>\nLevel: ${u.level}`);
    }

    if (i.commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');
      if (cd) return i.reply({ content: `Daily reward is available <t:${Math.floor(cd.getTime()/1000)}:R>.`, ephemeral: true });
      await prisma.user.update({ where: { id: userId }, data: { gold: { increment: 1500 }, tokens: { increment: 3 }, dailyStreak: { increment: 1 } } });
      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);
      return i.reply('🎁 Daily claimed: 1,500 gold + 3 tokens.');
    }

    if (i.commandName === 'roll') {
      await i.deferReply();
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if ((user.rolls || 0) <= 0) {
        const next = new Date(new Date(user.lastRollRefillAt || Date.now()).getTime() + 60 * 60 * 1000);
        return i.editReply(`❌ You do not have any rolls left.\n⏳ Next refill: <t:${Math.floor(next.getTime()/1000)}:R>\n🎲 Refill amount: +15 Rolls`);
      }
      await prisma.user.update({ where: { id: userId }, data: { rolls: { decrement: 1 } } });
      const result = await rollCard(userId);
      const aura = getAura(result.character);
      const embed = new EmbedBuilder().setTitle('🎴 New Roll!').setDescription(`${result.text}\n\n🎌 Anime: **${result.character.anime}**\n🌌 Technique: **${aura.name}**\n🎲 Rolls left: **${user.rolls - 1}**`).setColor(embedColor(aura.color)).setFooter({ text: `Card ID: ${result.card.id}` });
      try {
        const png = await renderCard({ card: result.card, character: result.character });
        const file = new AttachmentBuilder(png, { name: 'card.png' });
        embed.setImage('attachment://card.png');
        return i.editReply({ embeds: [embed], files: [file] });
      } catch (_) {
        if (result.character.imageUrl) embed.setImage(result.character.imageUrl);
        return i.editReply({ embeds: [embed] });
      }
    }

    if (i.commandName === 'inventory') {
      const data = await inventoryEmbed(userId, 0);
      if (data.empty) return i.reply('You do not have any cards yet.');
      return i.reply({ embeds: [data.embed], components: [data.row] });
    }

    if (i.commandName === 'team') {
      const action = i.options.getString('action', true);
      if (action === 'show') return i.reply(`👥 **Your Team**\n${await showTeam(userId)}`);
      const slot = i.options.getInteger('slot', true);
      const cardId = i.options.getString('card_id', true);
      await setTeamSlot(userId, slot, cardId);
      return i.reply(`✅ Team slot ${slot} updated.`);
    }

    if (['story', 'dungeon', 'tower'].includes(i.commandName)) {
      const action = i.options.getString('action') || 'status';
      const mode = i.commandName;
      if (action === 'start') return showBattle(i, mode);
      const p = await previewProgress(userId, mode);
      const label = mode === 'story' ? `Chapter ${p.chapter}, Stage ${p.stage}/30` : `${mode} Floor ${p.stage}`;
      return i.reply(`📍 **${mode.toUpperCase()} STATUS**\nCurrent: **${label}**\nYour Power: **${money(p.pwr)}**\nRecommended Power: **${money(p.req)}**\n\nUse **/${mode} action:start** to begin.`);
    }

    if (i.commandName === 'shop') {
      return i.reply(`🛒 **VOIDROLL SHOP**\n\n📦 Random Pack - 1 Roll - Max drop: EPIC\n🔥 Jujutsu Pack - 10 Tokens\n🗡️ Demon Slayer Pack - 10 Tokens\n🍥 Naruto Pack - 10 Tokens\n🏴‍☠️ One Piece Pack - 10 Tokens\n⚔️ Weapon Pack - 15 Tokens\n🌌 Event Pack - 25 Tokens\n\nUse /pack type:<pack>.`);
    }

    if (i.commandName === 'events') {
      return i.reply(`🌌 **ACTIVE EVENTS**\n\n🔥 Sukuna Raid Event\n• Boss event can appear anytime.\n• Use /boss-event and /join-boss.\n\n⚡ Mythic Rate-Up Event\n• Event Pack has better high-tier odds.\n\n🛒 Transfer Market Tax: 5%`);
    }

    if (i.commandName === 'pack') {
      await i.deferReply();
      const type = i.options.getString('type', true);
      const r = await openPack(userId, type);
      if (r.equipment) return i.editReply(`⚔️ Weapon Pack opened! You got **${r.template.name}**. Equipment ID: ${r.equipment.id}`);
      const aura = getAura(r.character);
      const embed = new EmbedBuilder().setTitle(`📦 ${type.toUpperCase()} Pack`).setDescription(`${rarityEmoji(r.character.rarity)} **${r.character.name}**\n🎌 Anime: **${r.character.anime}**\n💎 Rarity: **${r.character.rarity}**\n⚔️ Power: **${r.card.power}**\n🌌 Technique: **${aura.name}**`).setImage(r.character.imageUrl).setColor(embedColor(aura.color)).setFooter({ text: `Card ID: ${r.card.id}` });
      return i.editReply({ embeds: [embed] });
    }

    if (i.commandName === 'transfer' || i.commandName === 'market') {
      const items = await transfer.latest(10);
      if (!items.length) return i.reply('🔁 Transfer Market is empty.');
      return i.reply('🔁 **TRANSFER MARKET**\n' + items.map(x => `${x.id} • ${x.card.character.name} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n'));
    }

    if (i.commandName === 'list') {
      const listing = await transfer.listCard(userId, i.options.getString('card_id', true), i.options.getInteger('price', true));
      return i.reply(`✅ Listed on Transfer Market. Listing ID: ${listing.id}`);
    }

    if (i.commandName === 'buy') {
      const r = await transfer.buy(userId, i.options.getString('listing_id', true));
      return i.reply(`✅ Transfer complete. Market tax: ${money(r.tax)} gold.`);
    }

    if (i.commandName === 'boss-event') {
      const event = await bossEvents.eventStatus();
      return i.reply(`👹 **BOSS EVENT**\nBoss: **${event.bossName}**\nPower: **${money(event.bossPower)}**\nHP: **${money(event.bossHp)}**\nStatus: **${event.status}**\nJoin ends: <t:${Math.floor(event.joinEndsAt.getTime()/1000)}:R>\n\nUse /join-boss to enter.`);
    }

    if (i.commandName === 'join-boss') {
      const event = await bossEvents.joinEvent(userId);
      return i.reply(`⚔️ You joined the boss event against **${event.bossName}**.`);
    }

    if (i.commandName === 'start-boss') {
      const r = await bossEvents.runEventBattle();
      if (!r) return i.reply('No boss event is active.');
      if (r.waiting) return i.reply(`Boss event is still accepting players. Starts <t:${Math.floor(r.event.joinEndsAt.getTime()/1000)}:R>.`);
      return i.reply(`👹 **BOSS EVENT RESULT**\n${r.statusText}\n\n${r.logs.join('\n')}\n\n${r.won ? '✅ Boss defeated! Rewards distributed.' : '❌ Boss survived.'}`.slice(0, 1900));
    }

    if (i.commandName === 'quests') {
      return i.reply('📜 **QUESTS**\n• Roll 10 cards → 5 Tokens\n• Clear 1 dungeon → 10 Tokens\n• Defeat boss event → huge rewards\n• Sacrifice 3 cards → 5 Tokens');
    }

    if (i.commandName === 'sacrifice') {
      const r = await sacrifice(userId, i.options.getString('main_card', true), i.options.getString('sacrifice_card', true));
      return i.reply(`🔥 Sacrificed **${r.food.character.name}** into **${r.main.character.name}**.\nPower gained: +${r.gain}\nNew Power: ${r.newPower}`);
    }

    if (i.commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({ where: { userId }, include: { template: true }, take: 10, orderBy: { createdAt: 'desc' } });
      if (!eq.length) return i.reply('You do not have any equipment yet.');
      return i.reply(eq.map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${e.power}`).join('\n'));
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);
      return i.reply(r.success ? `✅ Upgrade successful. Equipment is now +${r.nextLevel}.` : `💥 Upgrade failed. You lost ${money(r.cost)} gold.`);
    }

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
