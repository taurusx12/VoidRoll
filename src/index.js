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
const gameplay = require('./services/gameplay');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function money(n) { return Number(n).toLocaleString('en-US'); }
function cardLine(c) { return `${c.id} • ${c.character.name} #${c.serial} • ${c.character.rarity} • PWR ${money(c.power)}${c.shiny ? ' ✨' : ''}${c.trait ? ` • ${c.trait}` : ''}`; }

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    await ensureUser(i.user);
    const userId = i.user.id;

    if (i.commandName === 'profile') {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const teamPower = await gameplay.getTeamPower(userId);
      const last = new Date(u.lastRollRefillAt || Date.now());
      const next = new Date(last.getTime() + (60 * 60 * 1000));

      return i.reply(
        `👤 **${i.user.username}**\n` +
        `Gold: **${money(u.gold)}**\n` +
        `Gems: **${u.gems}**\n` +
        `Tokens: **${u.tokens ?? 0}**\n` +
        `Rolls: **${u.rolls ?? 0}**\n` +
        `Next Refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
        `Team Power: **${money(teamPower)}**\n` +
        `Level: **${u.level}**\n` +
        `Streak: **${u.dailyStreak}**`
      );
    }

    if (i.commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');
      if (cd) return i.reply({ content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`, ephemeral: true });

      const reward = 1500;
      await prisma.user.update({ where: { id: userId }, data: { gold: { increment: reward }, dailyStreak: { increment: 1 }, tokens: { increment: 2 }, rolls: { increment: 5 } } });
      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);
      return i.reply(`🎁 Daily reward claimed: **${money(reward)} gold**, **2 Tokens**, **5 Rolls**.`);
    }

    if (i.commandName === 'roll') {
      await i.deferReply();
      const amount = Math.max(1, Math.min(10, i.options.getInteger('amount') || 1));
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.rolls ?? 0) < amount) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));
        return i.editReply(`❌ Not enough rolls.\nYou have **${user.rolls ?? 0}** rolls.\nNext refill: <t:${Math.floor(next.getTime() / 1000)}:R>\nRefill amount: **+15 Rolls**`);
      }

      await prisma.user.update({ where: { id: userId }, data: { rolls: { decrement: amount } } });

      if (amount > 1) {
        const results = [];
        for (let r = 0; r < amount; r++) results.push(await rollCard(userId));
        return i.editReply(
          `🎴 **Multi Roll x${amount}**\n` +
          results.map((x, idx) => `${idx + 1}. **${x.character.name}** • ${x.character.anime} • ${x.character.rarity} • PWR ${money(x.card.power)}`).join('\n') +
          `\n\n🎲 Rolls left: **${(user.rolls ?? amount) - amount}**`
        );
      }

      const result = await rollCard(userId);
      const aura = getAura(result.character);
      const embed = new EmbedBuilder()
        .setTitle('🎴 New Roll!')
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
      const cards = await prisma.userCard.findMany({ where: { userId }, include: { character: true }, orderBy: { obtainedAt: 'desc' }, take: 15 });
      if (!cards.length) return i.reply('You do not have any cards yet. Use /roll to get your first card.');
      return i.reply(cards.map(cardLine).join('\n'));
    }

    if (i.commandName === 'team') {
      const action = i.options.getString('action', true);
      if (action === 'show') {
        const team = await gameplay.getTeam(userId);
        if (!team.length) return i.reply('Your team is empty. Use `/team action:set slot:1 card_id:YOUR_CARD_ID`.');
        const power = await gameplay.getTeamPower(userId);
        return i.reply(`⚔️ **Your Team**\nTeam Power: **${money(power)}**\n\n` + team.map(s => `Slot ${s.slot}: ${s.card.character.name} • ${s.card.character.rarity} • PWR ${money(s.card.power)}`).join('\n'));
      }

      if (action === 'set') {
        const slot = i.options.getInteger('slot', true);
        const cardId = i.options.getString('card_id', true);
        await gameplay.setTeamSlot(userId, slot, cardId);
        return i.reply(`✅ Team slot **${slot}** updated.`);
      }

      return i.reply('Unknown team action. Use set or show.');
    }

    if (i.commandName === 'claim') {
      const r = await gameplay.claimPassiveFarm(userId);
      return i.reply(r.message);
    }

    if (i.commandName === 'story') {
      const chapter = i.options.getInteger('chapter') || 1;
      const stage = i.options.getInteger('stage') || 1;
      const r = await gameplay.playStory(userId, chapter, stage);
      return i.reply(r.message);
    }

    if (i.commandName === 'dungeon') {
      const type = i.options.getString('type', true);
      return i.reply(await gameplay.runDungeon(userId, type));
    }

    if (i.commandName === 'bosses') {
      return i.reply(await gameplay.fightBoss(userId, false));
    }

    if (i.commandName === 'limited-boss') {
      return i.reply(await gameplay.fightBoss(userId, true));
    }

    if (i.commandName === 'tower') {
      return i.reply(await gameplay.climbTower(userId));
    }

    if (i.commandName === 'sacrifice') {
      const mainCard = i.options.getString('main_card', true);
      const sacrificeCard = i.options.getString('sacrifice_card', true);
      return i.reply(await gameplay.sacrificeCard(userId, mainCard, sacrificeCard));
    }

    if (i.commandName === 'quests') {
      return i.reply(
        `📜 **Daily Quests**\n\n` +
        `• Roll 10 cards → 5 Tokens\n` +
        `• Clear 1 dungeon → 10 Tokens\n` +
        `• Defeat 1 boss → 15 Tokens\n` +
        `• Sacrifice 3 cards → 5 Tokens\n\n` +
        `Quest tracking will be fully automated in the next patch.`
      );
    }

    if (i.commandName === 'market') {
      const items = await market.latest(10);
      if (!items.length) return i.reply('The market is currently empty. Use `/sell` to list your cards.');
      return i.reply(items.map(x => `${x.id} • ${x.card.character.name} #${x.card.serial} • ${x.card.character.rarity} • ${money(x.price)} gold`).join('\n'));
    }

    if (i.commandName === 'sell') {
      const cardId = i.options.getString('card_id', true);
      const price = i.options.getInteger('price', true);
      const l = await market.sell(userId, cardId, price);
      return i.reply(`✅ Card listed on the market.\nListing ID: ${l.id}`);
    }

    if (i.commandName === 'buy') {
      const listingId = i.options.getString('listing_id', true);
      const r = await market.buy(userId, listingId);
      return i.reply(`✅ Purchase complete.\nMarket tax: ${money(r.tax)} gold.`);
    }

    if (i.commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({ where: { userId }, include: { template: true }, take: 10, orderBy: { createdAt: 'desc' } });
      if (!eq.length) return i.reply('You do not have any equipment yet. Equipment can drop from raids, events, and bosses.');
      return i.reply(eq.map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${money(e.power)}`).join('\n'));
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);
      return i.reply(r.success ? `✅ Upgrade successful. Equipment is now +${r.nextLevel}.` : `💥 Upgrade failed. You lost ${money(r.cost)} gold.`);
    }

    if (i.commandName === 'help') {
      return i.reply(
        `📘 **VOIDROLL COMMANDS**\n\n` +
        `🎴 /roll amount:1-10 - Roll anime cards\n` +
        `👤 /profile - Show profile, rolls, tokens, and team power\n` +
        `🎒 /inventory - Show latest cards\n` +
        `⚔️ /team action:set/show - Build a 5-card team\n` +
        `📦 /claim - Claim passive farming from all owned cards\n\n` +
        `📖 /story chapter stage - Play story mode. 60 chapters, 30 stages each, boss every 5 stages\n` +
        `🏰 /dungeon type - Enter dungeon\n` +
        `👹 /bosses - Fight normal boss\n` +
        `👑 /limited-boss - Fight limited boss\n` +
        `🗼 /tower - Climb tower based on team power\n` +
        `📜 /quests - Show quests\n\n` +
        `🔥 /sacrifice - Sacrifice weak cards to power up strong cards\n` +
        `🛒 /market /sell /buy - Player market\n` +
        `⚙️ /equipment /upgrade - Equipment system`
      );
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
