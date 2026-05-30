// VoidRoll Reborn - Phase 17 Command Router
// Integration helper to route commands to the new systems.
// This file is intentionally safe: it does not delete old code.
// Connect it inside src/index.js interactionCreate handler.

const { EmbedBuilder } = require('discord.js');

const launchGuard = require('./launchGuard');
const economySystem = require('./economySystem');
const inventorySystem = require('./inventorySystem');
const animeDatabaseSystem = require('./animeDatabaseSystem');
const marketSystem = require('./marketSystem');
const bannerSystem = require('./bannerSystem');
const revealSystem = require('./revealSystem');
const formationSystem = require('./formationSystem');
const storyFormationSystem = require('./storyFormationSystem');
const evolutionTreeSystem = require('./evolutionTreeSystem');
const traitSystem = require('./traitSystem');
const pvpSystem = require('./pvpSystem');
const dungeonSystem = require('./dungeonSystem');
const worldBossSystem = require('./worldBossSystem');

function safeReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
  return interaction.reply(payload).catch(() => {});
}

function embed(title, description, color = 0x7c3aed) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(String(description || '').slice(0, 3900))
    .setColor(color);
}

function getCommandName(interaction) {
  return interaction.commandName || interaction.customId || '';
}

async function handleVoidRollCommand(interaction, context = {}) {
  const commandName = getCommandName(interaction);
  const blocked = launchGuard.getBlockedReason(commandName);
  if (blocked) {
    return safeReply(interaction, { embeds: [embed('Command Disabled', blocked, 0xef4444)], ephemeral: true });
  }

  const user = context.user || {};
  const cards = context.cards || [];
  const allCharacters = context.allCharacters || [];
  const formations = context.formations || [];
  const cardsById = context.cardsById || {};
  const activeDungeon = context.activeDungeon || null;
  const activeRaidBoss = context.activeRaidBoss || null;

  switch (commandName) {
    case 'help':
      return safeReply(interaction, { embeds: [embed('VoidRoll Reborn Help', launchGuard.formatAllowedCommands())] });

    case 'wallet':
      return safeReply(interaction, { embeds: [embed('Wallet', economySystem.formatWallet(user))] });

    case 'inventory': {
      const filters = {
        name: interaction.options?.getString?.('name') || undefined,
        anime: interaction.options?.getString?.('anime') || undefined,
        rarity: interaction.options?.getString?.('rarity') || undefined,
        element: interaction.options?.getString?.('element') || undefined,
        role: interaction.options?.getString?.('role') || undefined,
        variant: interaction.options?.getString?.('variant') || undefined,
        sort: interaction.options?.getString?.('sort') || 'power',
        page: interaction.options?.getInteger?.('page') || 1
      };
      const output = inventorySystem.formatInventory(cards, filters);
      return safeReply(interaction, { embeds: [embed('Inventory', output.content)] });
    }

    case 'anime': {
      const animeName = interaction.options?.getString?.('name') || interaction.options?.getString?.('anime') || '';
      const summary = animeDatabaseSystem.getAnimeSummary(allCharacters, animeName);
      return safeReply(interaction, { embeds: [embed('Anime Database', animeDatabaseSystem.formatAnimeSummary(summary))] });
    }

    case 'collection': {
      const animeName = interaction.options?.getString?.('anime') || '';
      const completion = animeDatabaseSystem.getAnimeCompletion(allCharacters, cards, animeName);
      return safeReply(interaction, { embeds: [embed('Collection', animeDatabaseSystem.formatAnimeCompletion(completion))] });
    }

    case 'character': {
      const name = interaction.options?.getString?.('name') || '';
      const found = animeDatabaseSystem.findCharacters(allCharacters, name)[0];
      const text = found ? animeDatabaseSystem.formatCharacterDatabaseEntry(found) : `No character found for **${name}**.`;
      return safeReply(interaction, { embeds: [embed('Character Database', text)] });
    }

    case 'who-has': {
      const name = interaction.options?.getString?.('name') || '';
      const results = animeDatabaseSystem.buildWhoHasResults(context.serverCards || cards, name);
      return safeReply(interaction, { embeds: [embed('Who Has', animeDatabaseSystem.formatWhoHasResults(results, name))] });
    }

    case 'market': {
      const type = interaction.options?.getString?.('type') || 'daily';
      const market = marketSystem.formatMarket(type);
      return safeReply(interaction, { embeds: [embed(market.title, market.description)] });
    }

    case 'banner': {
      const banner = context.activeBanner || {};
      const pity = context.pity || {};
      return safeReply(interaction, { embeds: [embed('Banner', bannerSystem.formatBanner(banner, pity))] });
    }

    case 'rates': {
      const normal = bannerSystem.getRollConfig('normal');
      const lines = Object.entries(normal.rates).map(([r, v]) => `${r}: **${v}%**`).join('\n');
      return safeReply(interaction, { embeds: [embed('Normal Roll Rates', lines)] });
    }

    case 'formations': {
      const required = context.requiredFormations || 6;
      return safeReply(interaction, { embeds: [embed('Formations', formationSystem.formatFormations(formations, required))] });
    }

    case 'story': {
      const chapter = interaction.options?.getInteger?.('chapter') || Number(user.chapter || 1);
      const stage = interaction.options?.getInteger?.('stage') || Number(user.stage || 1);
      const text = storyFormationSystem.formatStoryRequirement(chapter, stage);
      return safeReply(interaction, { embeds: [embed('Story', text)] });
    }

    case 'character-tree': {
      const card = context.selectedCard || cards[0];
      const text = card ? evolutionTreeSystem.formatCharacterTree(card) : 'No selected card.';
      return safeReply(interaction, { embeds: [embed('Character Tree', text)] });
    }

    case 'upgrade': {
      const branch = interaction.options?.getString?.('branch') || 'core';
      const card = context.selectedCard || cards[0];
      const text = card ? evolutionTreeSystem.formatUpgradePreview(card, branch) : 'No selected card.';
      return safeReply(interaction, { embeds: [embed('Upgrade Preview', text)] });
    }

    case 'traits':
      return safeReply(interaction, { embeds: [embed('Traits', traitSystem.formatTraitList(interaction.options?.getString?.('role') || null))] });

    case 'trait': {
      const name = interaction.options?.getString?.('name') || '';
      const trait = traitSystem.getTrait(name);
      return safeReply(interaction, { embeds: [embed('Trait', trait ? traitSystem.formatTrait(trait, 1) : `No trait found for **${name}**.`)] });
    }

    case 'pvp-rank':
      return safeReply(interaction, { embeds: [embed('PvP Rank', pvpSystem.formatPvpProfile(user))] });

    case 'pvp-leaderboard':
      return safeReply(interaction, { embeds: [embed('PvP Leaderboard', pvpSystem.formatLeaderboard(context.players || []))] });

    case 'dungeon': {
      const type = interaction.options?.getString?.('type') || 'normal';
      const run = dungeonSystem.generateDungeonRun({ type, userId: interaction.user?.id || 'user' });
      return safeReply(interaction, { embeds: [embed('Dungeon Started', dungeonSystem.formatDungeonRun(run))] });
    }

    case 'dungeon-status': {
      const text = activeDungeon ? dungeonSystem.formatDungeonRun(activeDungeon) : 'No active dungeon.';
      return safeReply(interaction, { embeds: [embed('Dungeon Status', text)] });
    }

    case 'world-boss':
    case 'raid': {
      const boss = activeRaidBoss || worldBossSystem.createRaidBoss({ serverId: interaction.guildId || 'server' });
      return safeReply(interaction, { embeds: [embed('World Boss', worldBossSystem.formatRaidBoss(boss))] });
    }

    case 'raid-rank': {
      const boss = activeRaidBoss || { name: 'No Active Boss', damageLog: [] };
      return safeReply(interaction, { embeds: [embed('Raid Ranking', worldBossSystem.formatDamageRanking(boss))] });
    }

    default:
      return null;
  }
}

module.exports = {
  safeReply,
  embed,
  getCommandName,
  handleVoidRollCommand
};
