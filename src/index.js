require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const config = require('./lib/config');
const { prisma } = require('./lib/db');
const { ensureUser } = require('./services/users');
const { rollCard } = require('./services/gacha');
const { checkCooldown, setCooldown } = require('./services/cooldowns');
const { deploy, claim, zones } = require('./services/farm');
const market = require('./services/market');
const equipment = require('./services/equipment');
const { getAura, embedColor } = require('./lib/aura');
const { renderCard } = require('./services/cardRender');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function money(n) { return Number(n).toLocaleString('en-US'); }
function cardLine(c) { return `${c.id} • ${c.character.name} #${c.serial} • ${c.character.rarity} • PWR ${c.power}${c.shiny?' ✨':''}${c.trait?` • ${c.trait}`:''}`; }

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;
  try {
    await ensureUser(i.user);
    const userId = i.user.id;

    if (i.commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      return i.reply(`👤 ${i.user.username}\nGold: ${money(u.gold)}\nGems: ${u.gems}\nLevel: ${u.level}\nStreak: ${u.dailyStreak}`);
    }

    if (i.commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');
      if (cd) return i.reply({ content: `Daily باقي له: <t:${Math.floor(cd.getTime()/1000)}:R>`, ephemeral: true });
      const reward = 1500;
      await prisma.user.update({ where: { id: userId }, data: { gold: { increment: reward }, dailyStreak: { increment: 1 } } });
      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);
      return i.reply(`🎁 أخذت daily: ${reward} gold`);
    }

    if (i.commandName === 'roll') {


  await i.deferReply();


  const result = await rollCard(userId);

  const aura = getAura(result.character);

  const embed = new EmbedBuilder()
    .setTitle('🎴 New Roll!')
    .setDescription(`${result.text}

🌌 Aura: **${aura.name}**`)
    .setColor(embedColor(aura.color))
    .setFooter({ text: `Card ID: ${result.card.id}` });

  try {

    const png = await renderCard({
      card: result.card,
      character: result.character
    });

    const file = new AttachmentBuilder(png, {
      name: 'card.png'
    });

    embed.setImage('attachment://card.png');

    return i.editReply({
      embeds: [embed],
      files: [file]
    });

  } catch (_) {

    if (result.character.imageUrl) {
      embed.setImage(result.character.imageUrl);
    }

    return i.editReply({
      embeds: [embed]
    });

  }

}

    if (i.commandName === 'inventory') {
      const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { obtainedAt: 'desc' }, take: 10 });
      if (!cards.length) return i.reply('ما عندك كروت. استخدم /roll');
      return i.reply(cards.map(cardLine).join('\n'));
    }

    if (i.commandName === 'deploy') {
      const cardId = i.options.getString('card_id', true);
      const zone = i.options.getString('zone', true);
      const hours = i.options.getInteger('hours') || 1;
      const dep = await deploy(userId, cardId, zone, hours);
      return i.reply(`⚒️ تم إرسال الكرت للفارم في ${zones[zone].name}. ينتهي <t:${Math.floor(dep.endsAt.getTime()/1000)}:R>`);
    }

    if (i.commandName === 'claim') {
      const r = await claim(userId);
      return i.reply(`📦 جمعت ${r.count} فارم وحصلت ${money(r.total)} gold`);
    }

    if (i.commandName === 'market') {
      const items = await market.latest(10);
      if (!items.length) return i.reply('السوق فاضي حاليًا.');
      return i.reply(items.map(x => `${x.id} • ${x.card.character.name} #${x.card.serial} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n'));
    }

    if (i.commandName === 'sell') {
      const cardId = i.options.getString('card_id', true);
      const price = i.options.getInteger('price', true);
      const l = await market.sell(userId, cardId, price);
      return i.reply(`✅ انعرض الكرت بالسوق. Listing: ${l.id}`);
    }

    if (i.commandName === 'buy') {
      const listingId = i.options.getString('listing_id', true);
      const r = await market.buy(userId, listingId);
      return i.reply(`✅ تم الشراء. ضريبة السوق: ${money(r.tax)} gold`);
    }

    if (i.commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({ where: { userId }, include: { template: true }, take: 10, orderBy: { createdAt: 'desc' } });
      if (!eq.length) return i.reply('ما عندك معدات. تجيك من raids/events أو seed للتجربة.');
      return i.reply(eq.map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${e.power}`).join('\n'));
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);
      return i.reply(r.success ? `✅ نجح التطوير إلى +${r.nextLevel}` : `💥 فشل التطوير وخسرت ${money(r.cost)} gold`);
    }

    if (i.commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) return i.reply({ content: 'Admin only', ephemeral: true });
      const eq = await equipment.dropEquipment(userId, i.options.getString('rarity') || 'COMMON');
      return i.reply(eq ? `تم إعطاء معدة: ${eq.id}` : 'ما فيه template للندرة هذه');
    }
  } catch (err) {
    console.error(err);
    return i.reply({ content: `خطأ: ${err.message}`, ephemeral: true }).catch(()=>{});
  }
});

const app = express();
app.get('/health', (_, res) => res.json({ ok: true, uptime: process.uptime() }));
app.listen(config.port, () => console.log(`Health server on ${config.port}`));

if (!config.token) throw new Error('DISCORD_TOKEN missing');
client.login(config.token);
