require('dotenv').config();

const express = require('express');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  AttachmentBuilder
} = require('discord.js');

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

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function money(n) {
  return Number(n).toLocaleString('en-US');
}

function cardLine(c) {
  return `${c.id} • ${c.character.name} #${c.serial} • ${c.character.rarity} • PWR ${c.power}${c.shiny ? ' ✨' : ''}${c.trait ? ` • ${c.trait}` : ''}`;
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (i) => {
  if (!i.isChatInputCommand()) return;

  try {
    await ensureUser(i.user);
    const userId = i.user.id;

    if (i.commandName === 'profile') {
      const u = await prisma.user.findUnique({
        where: { id: userId }
      });

      return i.reply(
        `👤 ${i.user.username}\n` +
        `Gold: ${money(u.gold)}\n` +
        `Gems: ${u.gems}\n` +
        `Rolls: ${u.rolls ?? 0}\n` +
        `Tokens: ${u.tokens ?? 0}\n` +
        `Level: ${u.level}\n` +
        `Streak: ${u.dailyStreak}`
      );
    }

    if (i.commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');

      if (cd) {
        return i.reply({
          content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`,
          ephemeral: true
        });
      }

      const reward = 1500;

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: reward },
          dailyStreak: { increment: 1 }
        }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);

      return i.reply(`🎁 Daily reward claimed: ${money(reward)} gold.`);
    }

    if (i.commandName === 'roll') {
      await i.deferReply();

      const result = await rollCard(userId);
      const aura = getAura(result.character);

      const embed = new EmbedBuilder()
        .setTitle('🎴 New Roll!')
        .setDescription(`${result.text}\n\n🌌 Aura: **${aura.name}**`)
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
      } catch (err) {
        console.error(err);

        if (result.character.imageUrl) {
          embed.setImage(result.character.imageUrl);
        }

        return i.editReply({
          embeds: [embed]
        });
      }
    }

    if (i.commandName === 'inventory') {
      const cards = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { obtainedAt: 'desc' },
        take: 10
      });

      if (!cards.length) {
        return i.reply('You do not have any cards yet. Use /roll to get your first card.');
      }

      return i.reply(cards.map(cardLine).join('\n'));
    }

    if (i.commandName === 'deploy') {
      const cardId = i.options.getString('card_id', true);
      const zone = i.options.getString('zone', true);
      const hours = i.options.getInteger('hours') || 1;

      const dep = await deploy(userId, cardId, zone, hours);

      return i.reply(
        `⚒️ Card deployed to **${zones[zone].name}**.\n` +
        `It will finish <t:${Math.floor(dep.endsAt.getTime() / 1000)}:R>.`
      );
    }

    if (i.commandName === 'claim') {
      const r = await claim(userId);

      return i.reply(
        `📦 Claim complete.\n` +
        `Deployments claimed: ${r.count}\n` +
        `Gold earned: ${money(r.total)}`
      );
    }

    if (i.commandName === 'market') {
      const items = await market.latest(10);

      if (!items.length) {
        return i.reply('The market is currently empty.');
      }

      return i.reply(
        items
          .map(x => `${x.id} • ${x.card.character.name} #${x.card.serial} • ${x.card.character.rarity} • ${money(x.price)} gold`)
          .join('\n')
      );
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
      const eq = await prisma.userEquipment.findMany({
        where: { userId },
        include: { template: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      if (!eq.length) {
        return i.reply('You do not have any equipment yet. Equipment can drop from raids, events, and bosses.');
      }

      return i.reply(
        eq
          .map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${e.power}`)
          .join('\n')
      );
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);

      if (r.success) {
        return i.reply(`✅ Upgrade successful. Equipment is now +${r.nextLevel}.`);
      }

      return i.reply(`💥 Upgrade failed. You lost ${money(r.cost)} gold.`);
    }

    if (i.commandName === 'admin-give-equipment') {
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

      return i.reply(eq ? `Equipment granted: ${eq.id}` : 'No equipment template exists for this rarity.');
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
