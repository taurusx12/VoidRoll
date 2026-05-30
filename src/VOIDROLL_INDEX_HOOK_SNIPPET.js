// VoidRoll Reborn - index.js Hook Snippet
// Paste this near your interactionCreate handler in src/index.js.
// If you already have an interactionCreate handler, put the body inside it.

// Add near top of index.js:
// const { handleVoidRollCommand } = require('./systems/commandRouter');
// const { buildCommandContext } = require('./systems/dbAdapter');

// Inside client.on('interactionCreate', async interaction => { ... })

async function voidRollRebornInteractionHook(interaction) {
  if (!interaction.isChatInputCommand()) return false;

  const { handleVoidRollCommand } = require('./systems/commandRouter');
  const { buildCommandContext } = require('./systems/dbAdapter');

  const context = await buildCommandContext(interaction);
  const handled = await handleVoidRollCommand(interaction, context);

  return Boolean(handled);
}

module.exports = { voidRollRebornInteractionHook };
