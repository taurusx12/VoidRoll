// VoidRoll Reborn - Phase 16 Launch Guard
// Final command/system cleanup helpers.
// Blocks removed systems and provides launch checklist helpers.

const launchConfig = require('../config/launch_cleanup_config.json');

function normalizeCommand(command = '') {
  const value = String(command || '').trim().toLowerCase();
  return value.startsWith('/') ? value : `/${value}`;
}

function isBlockedCommand(command = '') {
  return launchConfig.blockedCommands.includes(normalizeCommand(command));
}

function getBlockedReason(command = '') {
  if (!isBlockedCommand(command)) return null;
  return [
    `❌ **${normalizeCommand(command)} is disabled in VoidRoll Reborn.**`,
    '',
    'Removed systems:',
    '- Fusion',
    '- Stars',
    '- Item Rolls',
    '- Relic/Aura Pulls as gacha',
    '- Character-specific shards',
    '',
    'Use Character Evolution Tree, Built-in Gear, Traits, Markets, Dungeons, PvP, and Raids instead.'
  ].join('\n');
}

function flattenAllowedCommands() {
  const out = [];
  for (const group of Object.values(launchConfig.allowedCommands || {})) {
    out.push(...group);
  }
  return out;
}

function isAllowedCommand(command = '') {
  return flattenAllowedCommands().includes(normalizeCommand(command));
}

function getCommandCategory(command = '') {
  const normalized = normalizeCommand(command);
  for (const [category, commands] of Object.entries(launchConfig.allowedCommands || {})) {
    if (commands.includes(normalized)) return category;
  }
  return null;
}

function formatAllowedCommands() {
  const lines = ['🌌 **VoidRoll Reborn Commands**', ''];
  for (const [category, commands] of Object.entries(launchConfig.allowedCommands || {})) {
    lines.push(`**${category.toUpperCase()}**`);
    lines.push(commands.join(' '));
    lines.push('');
  }
  return lines.join('\n').slice(0, 3900);
}

function formatLaunchChecklist(status = {}) {
  const lines = ['🚀 **VoidRoll Reborn Launch Checklist**', ''];
  for (const item of launchConfig.mustVerifyBeforeLaunch || []) {
    const ok = Boolean(status[item]);
    lines.push(`${ok ? '✅' : '⬜'} ${item}`);
  }
  return lines.join('\n');
}

function getLaunchReadiness(status = {}) {
  const required = launchConfig.mustVerifyBeforeLaunch || [];
  const completed = required.filter(item => Boolean(status[item])).length;
  const percent = required.length ? Math.floor((completed / required.length) * 100) : 0;

  return {
    completed,
    total: required.length,
    percent,
    ready: completed === required.length
  };
}

function formatLaunchReadiness(status = {}) {
  const readiness = getLaunchReadiness(status);
  return [
    `🚀 **Launch Readiness**`,
    `Completed: **${readiness.completed}/${readiness.total}**`,
    `Progress: **${readiness.percent}%**`,
    `Ready: **${readiness.ready ? 'YES' : 'NO'}**`
  ].join('\n');
}

function formatRemovedSystems() {
  return [
    '🧹 **Removed / Disabled Systems**',
    ...(launchConfig.removedSystems || []).map(x => `- ${x}`)
  ].join('\n');
}

function formatPostLaunchBacklog() {
  return [
    '📌 **Post-Launch Backlog**',
    ...(launchConfig.postLaunchBacklog || []).map(x => `- ${x}`)
  ].join('\n');
}

function formatProjectIdentity() {
  const id = launchConfig.launchIdentity || {};
  return [
    `🌌 **${id.name || 'VoidRoll Reborn'}**`,
    id.genre || '',
    '',
    '**Core Loop**',
    ...((id.coreLoop || []).map(x => `- ${x}`))
  ].join('\n');
}

module.exports = {
  normalizeCommand,
  isBlockedCommand,
  getBlockedReason,
  flattenAllowedCommands,
  isAllowedCommand,
  getCommandCategory,
  formatAllowedCommands,
  formatLaunchChecklist,
  getLaunchReadiness,
  formatLaunchReadiness,
  formatRemovedSystems,
  formatPostLaunchBacklog,
  formatProjectIdentity
};
