require('dotenv').config();
const env = process.env;
module.exports = {
  token: env.DISCORD_TOKEN,
  clientId: env.DISCORD_CLIENT_ID,
  guildId: env.DISCORD_GUILD_ID || null,
  adminIds: (env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean),
  marketTaxBps: Number(env.MARKET_TAX_BPS || 500),
  rollCooldownSeconds: Number(env.ROLL_COOLDOWN_SECONDS || 45),
  dailyCooldownHours: Number(env.DAILY_COOLDOWN_HOURS || 20),
  maxDeployHours: Number(env.MAX_DEPLOY_HOURS || 12),
  port: Number(env.PORT || 3000)
};
