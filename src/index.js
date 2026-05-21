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

function money(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function buildInventoryEmbed(card, index, total) {
  return new EmbedBuilder()
    .setTitle(`🎴 ${card.character.name}`)
    .setDescription(
      `🎌 Anime: **${card.character.anime}**\n` +
      `💎 Rarity: **${card.character.rarity}**\n` +
      `⚔️ Power: **${money(card.power)}**\n` +
      `📈 Level: **${card.level}**\n` +
      `🆔 Card ID: \`${card.id}\``
    )
    .setImage(card.character.imageUrl || null)
    .setFooter({ text: `Card ${index + 1}/${total}` });
}

function buildInventoryButtons(userId, index, total) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`inv:${userId}:${Math.max(0, index - 1)}`)
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(index <= 0),
    new ButtonBuilder()
      .setCustomId(`inv:${userId}:${Math.min(total - 1, index + 1)}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(index >= total - 1)
  );
}

async function getInventoryCards(userId) {
  return prisma.userCard.findMany({
    where: { userId },
    include: { character: true },
    orderBy: { obtainedAt: 'desc' },
    take: 100
  });
}

function statusEmbed(title, lines) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(lines.join('\n'))
    .setColor(0x7c3aed);
}

async function playLiveBattle(interaction, mode, label) {
  await interaction.deferReply();

  const prepared = await gameplay.prepareBattle(interaction.user.id, mode);
  const snapshots = prepared.battle.snapshots;
  const maxFrames = Math.min(snapshots.length, 12);

  for (let idx = 0; idx < maxFrames; idx++) {
    const snap = snapshots[idx];
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${label}`)
      .setDescription(gameplay.formatSnapshot(snap, { label: `Enemy: **${prepared.enemy.enemyName}**` }))
      .setColor(snap.final ? (prepared.battle.win ? 0x22c55e : 0xef4444) : 0xf59e0b)
      .setFooter({ text: `Live Battle • Frame ${idx + 1}/${maxFrames}` });

    await interaction.editReply({ embeds: [embed] });

    if (idx < maxFrames - 1) {
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }

  const rewards = await prepared.finalize();
  const final = snapshots[snapshots.length - 1];

  const finalEmbed = new EmbedBuilder()
    .setTitle(prepared.battle.win ? `🏆 ${label} Cleared` : `💀 ${label} Failed`)
    .setDescription(
      gameplay.formatSnapshot(final, { label: `Enemy: **${prepared.enemy.enemyName}**` }) +
      `\n\n🎁 Rewards: ${gameplay.rewardsText(rewards)}`
    )
    .setColor(prepared.battle.win ? 0x22c55e : 0xef4444);

  return interaction.editReply({ embeds: [finalEmbed] });
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (i) => {
  try {
    if (i.isButton()) {
      const [type, ownerId, indexText] = i.customId.split(':');
      if (type !== 'inv') return;

      if (i.user.id !== ownerId) {
        return i.reply({ content: 'This inventory is not yours.', ephemeral: true });
      }

      const cards = await getInventoryCards(ownerId);
      if (!cards.length) return i.update({ content: 'You do not have any cards yet.', embeds: [], components: [] });

      const index = Math.max(0, Math.min(cards.length - 1, Number(indexText) || 0));
      return i.update({ embeds: [buildInventoryEmbed(cards[index], index, cards.length)], components: [buildInventoryButtons(ownerId, index, cards.length)] });
    }

    if (!i.isChatInputCommand()) return;

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
        `Dungeon Stage: ${u.dungeonStage || 1}\n` +
        `Tower Floor: ${u.towerFloor || 1}\n` +
        `Streak: ${u.dailyStreak}`
      );
    }

    if (i.commandName === 'daily') {
      const cd = await checkCooldown(userId, 'daily');
      if (cd) return i.reply({ content: `Daily reward is available <t:${Math.floor(cd.getTime() / 1000)}:R>.`, ephemeral: true });

      const reward = 1500;
      const tokens = 3;
      const rolls = 5;

      await prisma.user.update({
        where: { id: userId },
        data: { gold: { increment: reward }, tokens: { increment: tokens }, rolls: { increment: rolls }, dailyStreak: { increment: 1 } }
      });

      await setCooldown(userId, 'daily', config.dailyCooldownHours * 3600);
      return i.reply(`🎁 Daily reward claimed: ${money(reward)} Gold • ${tokens} Tokens • ${rolls} Rolls.`);
    }

    if (i.commandName === 'roll') {
      await i.deferReply();

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if ((user.rolls ?? 0) <= 0) {
        const last = new Date(user.lastRollRefillAt || Date.now());
        const next = new Date(last.getTime() + (60 * 60 * 1000));
        return i.editReply(`❌ You do not have any rolls left.\n⏳ Next refill: <t:${Math.floor(next.getTime() / 1000)}:R>\n🎲 Refill amount: +15 Rolls`);
      }

      await prisma.user.update({ where: { id: userId }, data: { rolls: { decrement: 1 } } });

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
      const cards = await getInventoryCards(userId);
      if (!cards.length) return i.reply('You do not have any cards yet. Use /roll to get your first card.');
      return i.reply({ embeds: [buildInventoryEmbed(cards[0], 0, cards.length)], components: [buildInventoryButtons(userId, 0, cards.length)] });
    }

    if (i.commandName === 'team') {
      const sub = i.options.getSubcommand();

      if (sub === 'auto') {
        const cards = await gameplay.autoTeam(userId);
        if (!cards.length) return i.reply('You need cards first. Use /roll.');
        const team = await gameplay.showTeam(userId);
        return i.reply(`✅ Auto team created.\n\nTeam Power: **${money(team.power)}**\n${team.text}`);
      }

      if (sub === 'show') {
        const team = await gameplay.showTeam(userId);
        return i.reply(team.power ? `⚔️ Your Team\nPower: **${money(team.power)}**\n\n${team.text}` : team.text);
      }

      if (sub === 'set') {
        const slot = i.options.getInteger('slot', true);
        const cardId = i.options.getString('card_id', true);
        const card = await gameplay.setTeamSlot(userId, slot, cardId);
        return i.reply(`✅ Slot ${slot} set to ${card.character.name} • PWR ${money(card.power)}.`);
      }
    }

    if (i.commandName === 'claim') {
      const r = await gameplay.claimPassiveFarm(userId);
      return i.reply(`📦 Passive farm claimed.\nCards farming: ${r.count}\nHours: ${r.hours}\nGold earned: ${money(r.gold)}\nTokens earned: ${r.tokens}`);
    }

    if (i.commandName === 'market') {
      const items = await market.latest(10);
      if (!items.length) return i.reply('The market is currently empty. Use /sell to list a card.');
      return i.reply(items.map(x => `${x.id} • ${x.card.character.name} #${x.card.serial} • ${x.card.character.rarity} • ${money(x.price)} Gold`).join('\n'));
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
      return i.reply(`✅ Purchase complete.\nMarket tax: ${money(r.tax)} Gold.`);
    }

    if (i.commandName === 'equipment') {
      const eq = await prisma.userEquipment.findMany({ where: { userId }, include: { template: true }, take: 10, orderBy: { createdAt: 'desc' } });
      if (!eq.length) return i.reply('You do not have any equipment yet. Equipment can drop from raids, events, and bosses.');
      return i.reply(eq.map(e => `${e.id} • ${e.template.name} • ${e.template.rarity} • +${e.level} • PWR ${money(e.power)}`).join('\n'));
    }

    if (i.commandName === 'upgrade') {
      const id = i.options.getString('equipment_id', true);
      const r = await equipment.upgradeEquipment(userId, id);
      if (r.success) return i.reply(`✅ Upgrade successful. Equipment is now +${r.nextLevel}.`);
      return i.reply(`💥 Upgrade failed. You lost ${money(r.cost)} Gold.`);
    }

    if (i.commandName === 'story') {
      const action = i.options.getString('action') || 'status';
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const s = gameplay.storyStatus(user);

      if (action === 'status') {
        return i.reply({
          embeds: [statusEmbed('📖 Story Mode', [
            `Current Progress: **Chapter ${s.chapter}/60 • Stage ${s.stage}/30**`,
            `Enemy: **${s.enemyName}**`,
            `Enemy Power: **${money(s.enemyPower)}**`,
            `Boss Stage: **${s.isBoss ? 'Yes' : 'No'}**`,
            '',
            'Start this stage with `/story action:start`.'
          ])]
        });
      }

      return playLiveBattle(i, 'story', `Story • Chapter ${s.chapter} Stage ${s.stage}`);
    }

    if (i.commandName === 'dungeon') {
      const action = i.options.getString('action') || 'status';
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const d = gameplay.dungeonStatus(user);

      if (action === 'status') {
        return i.reply({
          embeds: [statusEmbed('🏰 Dungeon Mode', [
            `Current Stage: **${d.stage}**`,
            `Enemy: **${d.enemyName}**`,
            `Enemy Power: **${money(d.enemyPower)}**`,
            `Boss Stage: **${d.isBoss ? 'Yes' : 'No'}**`,
            `Possible Rewards: **${money(d.gold)} Gold • ${d.tokens} Tokens • ${d.rolls} Rolls**`,
            '',
            'Start this dungeon with `/dungeon action:start`.'
          ])]
        });
      }

      return playLiveBattle(i, 'dungeon', `Dungeon • Stage ${d.stage}`);
    }

    if (i.commandName === 'tower') {
      const action = i.options.getString('action') || 'status';
      const user = await prisma.user.findUnique({ where: { id: userId } });
      const t = gameplay.towerStatus(user);

      if (action === 'status') {
        return i.reply({
          embeds: [statusEmbed('🗼 Tower Mode', [
            `Current Floor: **${t.floor}**`,
            `Enemy: **${t.enemyName}**`,
            `Enemy Power: **${money(t.enemyPower)}**`,
            `Possible Rewards: **${money(t.gold)} Gold • ${t.tokens} Tokens • ${t.rolls} Rolls**`,
            '',
            'Start this floor with `/tower action:start`.'
          ])]
        });
      }

      return playLiveBattle(i, 'tower', `Tower • Floor ${t.floor}`);
    }

    if (i.commandName === 'limited-boss') {
      const action = i.options.getString('action') || 'status';
      const b = gameplay.limitedBoss();

      if (action === 'status') {
        return i.reply({
          embeds: [statusEmbed('👑 Limited Boss', [
            `Current Boss: **${b.name}**`,
            `Enemy Power: **${money(b.enemyPower)}**`,
            `Possible Rewards: **${money(b.gold)} Gold • ${b.tokens} Tokens • ${b.rolls} Rolls**`,
            '',
            'Start this boss with `/limited-boss action:start`.'
          ])]
        });
      }

      return playLiveBattle(i, 'limited-boss', `Limited Boss • ${b.name}`);
    }

    if (i.commandName === 'bosses') {
      const bosses = gameplay.bossList();
      return i.reply(`⚔️ **ACTIVE BOSSES**\n\n${bosses.map(b => `• ${b.name}\nRecommended Power: ${money(b.enemyPower)}\nRewards: ${money(b.gold)} Gold • ${b.tokens} Tokens`).join('\n\n')}\n\nUse Limited Boss for live combat right now. Standard boss selection comes next.`);
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

    if (i.commandName === 'sacrifice') {
      const mainCard = i.options.getString('main_card', true);
      const sacrificeCard = i.options.getString('sacrifice_card', true);
      const r = await gameplay.sacrificeCard(userId, mainCard, sacrificeCard);
      return i.reply(
        `🔥 Sacrifice complete.\n` +
        `Sacrificed: **${r.sacrificed.character.name}**\n` +
        `Main Card: **${r.main.character.name}**\n` +
        `Power gained: **+${money(r.powerGain)}**\n` +
        `XP gained: **+${money(r.xpGain)}**\n` +
        `New Power: **${money(r.main.power)}**`
      );
    }

    if (i.commandName === 'help') {
      return i.reply(
        `📘 **VOIDROLL COMMANDS**\n\n` +
        `🎴 /roll - Roll a random anime card\n` +
        `👤 /profile - Show profile, rolls, tokens, story, dungeon, tower\n` +
        `🎒 /inventory - Image inventory with buttons\n` +
        `⚔️ /team auto/show/set - Manage your 5-card team\n\n` +
        `📖 /story - Show current story stage\n` +
        `📖 /story action:start - Start live story battle\n` +
        `🏰 /dungeon - Show current dungeon stage\n` +
        `🏰 /dungeon action:start - Start live dungeon battle\n` +
        `🗼 /tower - Show current tower floor\n` +
        `🗼 /tower action:start - Start live tower battle\n` +
        `👑 /limited-boss - Show limited boss\n` +
        `👑 /limited-boss action:start - Start live limited boss battle\n\n` +
        `🔥 /sacrifice - Sacrifice weak cards to power up a main card\n` +
        `📦 /claim - Claim passive farming from all owned cards\n` +
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
