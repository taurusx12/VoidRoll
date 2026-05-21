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
const market = require('./services/market');
const equipment = require('./services/equipment');
const { getAura, embedColor } = require('./lib/aura');
const { renderCard } = require('./services/cardRender');
const gameplay = require('./services/gameplay');

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
      const u = await prisma.user.findUnique({ where: { id: userId } });
      const last = new Date(u.lastRollRefillAt || Date.now());
      const next = new Date(last.getTime() + (60 * 60 * 1000));

      return i.reply(
        `👤 ${i.user.username}\n` +
        `Gold: ${money(u.gold)}\n` +
        `Gems: ${u.gems}\n` +
        `Rolls: ${u.rolls ?? 0}\n` +
        `Next Refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
        `Tokens: ${u.tokens ?? 0}\n` +
        `Level: ${u.level}\n` +
        `Story: Chapter ${u.storyChapter || 1}, Stage ${u.storyStage || 1}\n` +
        `Tower Floor: ${u.towerFloor || 1}\n` +
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
      const tokens = 3;
      const rolls = 5;

      await prisma.user.update({
        where: { id: userId },
        data: {
          gold: { increment: reward },
          tokens: { increment: tokens },
          rolls: { increment: rolls },
          dailyStreak: { increment: 1 }
        }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);

      return i.reply(`🎁 Daily reward claimed: ${money(reward)} gold • ${tokens} Tokens • ${rolls} Rolls.`);
    }

    if (i.commandName === 'roll') {
      await i.deferReply();

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if ((user.rolls ?? 0) <= 0) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));

        return i.editReply(
          `❌ You do not have any rolls left.\n` +
          `⏳ Next refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n` +
          `🎲 Refill amount: +15 Rolls`
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { rolls: { decrement: 1 } }
      });

      const result = await rollCard(userId);
      const aura = getAura(result.character);

      const embed = new EmbedBuilder()
        .setTitle('🎴 New Roll!')
        .setDescription(
          `${result.text}\n\n` +
          `🎌 Anime: **${result.character.anime}**\n` +
          `🌌 Technique: **${aura.name}**\n` +
          `🎲 Rolls left: **${(user.rolls ?? 1) - 1}**`
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

        return i.editReply({ embeds: [embed], files: [file] });
      } catch (err) {
        console.error(err);

        if (result.character.imageUrl) {
          embed.setImage(result.character.imageUrl);
        }

        return i.editReply({ embeds: [embed] });
      }
    }

    if (i.commandName === 'inventory') {
      const cards = await prisma.userCard.findMany({
        where: { userId },
        include: { character: true },
        orderBy: { obtainedAt: 'desc' },
        take: 10
      });

      if (!cards.length) return i.reply('You do not have any cards yet. Use /roll to get your first card.');
      return i.reply(cards.map(cardLine).join('\n'));
    }

    if (i.commandName === 'team') {
      const sub = i.options.getSubcommand();

      if (sub === 'auto') {
        const cards = await gameplay.autoTeam(userId);
        if (!cards.length) return i.reply('You need cards first. Use /roll.');
        const team = await gameplay.showTeam(userId);
        return i.reply(`✅ Auto team created.\n\nTeam Power: **${team.power.toLocaleString('en-US')}**\n${team.text}`);
      }

      if (sub === 'show') {
        const team = await gameplay.showTeam(userId);
        return i.reply(team.power ? `⚔️ Your Team\nPower: **${team.power.toLocaleString('en-US')}**\n\n${team.text}` : team.text);
      }

      if (sub === 'set') {
        const slot = i.options.getInteger('slot', true);
        const cardId = i.options.getString('card_id', true);
        const card = await gameplay.setTeamSlot(userId, slot, cardId);
        return i.reply(`✅ Slot ${slot} set to ${card.character.name} • PWR ${card.power}.`);
      }
    }

    if (i.commandName === 'claim') {
      const r = await gameplay.claimPassiveFarm(userId);
      return i.reply(
        `📦 Passive farm claimed.\n` +
        `Cards farming: ${r.count}\n` +
        `Gold earned: ${money(r.gold)}\n` +
        `Tokens earned: ${r.tokens}`
      );
    }

    if (i.commandName === 'market') {
      const items = await market.latest(10);

      if (!items.length) return i.reply('The market is currently empty. Use /sell to list a card.');

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

      if (!eq.length) return i.reply('You do not have any equipment yet. Equipment can drop from raids, events, and bosses.');

      return i.reply(eq.map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${e.power}`).join('\n'));
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);

      if (r.success) return i.reply(`✅ Upgrade successful. Equipment is now +${r.nextLevel}.`);
      return i.reply(`💥 Upgrade failed. You lost ${money(r.cost)} gold.`);
    }

    if (i.commandName === 'help') {
      return i.reply(
        `📘 **VOIDROLL COMMANDS**\n\n` +
        `🎴 /roll - Roll a random anime card\n` +
        `👤 /profile - Show your profile, rolls, tokens, story progress, and refill timer\n` +
        `🎁 /daily - Claim your daily reward\n` +
        `🎒 /inventory - Show your latest cards\n` +
        `⚔️ /team auto/show/set - Manage your 5-card battle team\n\n` +
        `📖 /story fight/status - Play 60 chapters, 30 stages each, boss every 5 stages\n` +
        `🏰 /dungeon - Enter a dungeon with HP/Damage combat\n` +
        `🗼 /tower - Climb the tower\n` +
        `👹 /limited-boss - Fight the limited boss\n` +
        `⚔️ /bosses - Show active bosses\n` +
        `📜 /quests - Show quests\n\n` +
        `🔥 /sacrifice - Sacrifice cards to power up another card\n` +
        `🛒 /market - View market listings\n` +
        `💰 /sell - Sell a card\n` +
        `🛍️ /buy - Buy a card from the market\n` +
        `⚙️ /equipment - Show your equipment\n` +
        `⬆️ /upgrade - Upgrade equipment`
      );
    }

    if (i.commandName === 'quests') {
      return i.reply(
        `📜 **DAILY QUESTS**\n\n` +
        `• Roll 10 cards → 5 Tokens\n` +
        `• Clear 1 dungeon → 10 Tokens\n` +
        `• Defeat 1 boss → 15 Tokens\n` +
        `• Sacrifice 3 cards → 5 Tokens\n` +
        `• Clear 5 story stages → 10 Rolls\n\n` +
        `Quest tracking is the next upgrade. Rewards are already available through battle modes.`
      );
    }

    if (i.commandName === 'bosses') {
      const bosses = gameplay.bossList();
      return i.reply(
        `⚔️ **ACTIVE BOSSES**\n\n` +
        bosses.map(b => `• ${b.name}\nRecommended Power: ${money(b.power)}\nRewards: ${money(b.gold)} Gold • ${b.tokens} Tokens`).join('\n\n')
      );
    }

    if (i.commandName === 'limited-boss') {
      await i.deferReply();
      const result = await gameplay.runLimitedBoss(userId);
      return i.editReply(`👑 **LIMITED BOSS: ${result.enemy.name}**\n\n${gameplay.battleText(result)}`);
    }

    if (i.commandName === 'dungeon') {
      await i.deferReply();
      const type = i.options.getString('type', true);
      const result = await gameplay.runDungeon(userId, type);
      return i.editReply(`🏰 **${result.enemy.name}**\n\n${gameplay.battleText(result)}`);
    }

    if (i.commandName === 'tower') {
      await i.deferReply();
      const result = await gameplay.runTower(userId);
      return i.editReply(`🗼 **${result.enemy.name}**\n\n${gameplay.battleText(result)}`);
    }

    if (i.commandName === 'story') {
      const sub = i.options.getSubcommand();

      if (sub === 'status') {
        const u = await prisma.user.findUnique({ where: { id: userId } });
        return i.reply(
          `📖 **Story Progress**\n\n` +
          `Chapter: ${u.storyChapter || 1}/60\n` +
          `Stage: ${u.storyStage || 1}/30\n` +
          `Boss stages: 5, 10, 15, 20, 25, 30`
        );
      }

      await i.deferReply();
      const result = await gameplay.runStoryFight(userId);
      return i.editReply(
        `📖 **Story Mode**\n` +
        `Chapter ${result.enemy.chapter}/60 • Stage ${result.enemy.stage}/30\n` +
        `${result.enemy.isBoss ? '👹 Boss Stage\n' : ''}\n` +
        `${gameplay.battleText(result)}`
      );
    }

    if (i.commandName === 'sacrifice') {
      const mainCard = i.options.getString('main_card', true);
      const sacrificeCard = i.options.getString('sacrifice_card', true);
      const r = await gameplay.sacrificeCard(userId, mainCard, sacrificeCard);

      return i.reply(
        `🔥 **Sacrifice Complete**\n\n` +
        `Main Card: ${r.main.character.name}\n` +
        `Sacrificed: ${r.sacrificed.character.name}\n` +
        `XP Gained: ${money(r.xpGain)}\n` +
        `Power Gained: ${money(r.powerGain)}\n` +
        `New Power: ${money(r.main.power)}`
      );
    }

    if (i.commandName === 'admin-give-equipment') {
      if (!config.adminIds.includes(userId)) {
        return i.reply({ content: 'Admin only.', ephemeral: true });
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
      return i.editReply({ content: `Error: ${err.message}` }).catch(() => {});
    }

    return i.reply({
      content: `Error: ${err.message}`,
      ephemeral: true
    }).catch(() => {});
  }
});

const app = express();

app.get('/health', (_, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

app.listen(config.port, () => {
  console.log(`Health server on ${config.port}`);
});

if (!config.token) {
  throw new Error('DISCORD_TOKEN missing');
}

client.login(config.token);
