# VoidRoll Reborn — Phase 17 Integration Patch

## الهدف
تجهيز ربط الأنظمة داخل البوت بعد ما خلصنا Phase 1 إلى Phase 16.

## المضاف

### 1. Command Router
`src/systems/commandRouter.js`

هذا ملف وسيط يربط الأوامر بالأنظمة الجديدة:
- Wallet
- Inventory
- Anime Database
- Market
- Banner
- Formations
- Story
- Evolution Tree
- Traits
- PvP
- Dungeons
- Raids
- Launch Guard

### 2. Final Commands Config
`src/config/final_commands.json`

فيه:
- الكوماندات النهائية المعتمدة
- الكوماندات المحذوفة
- ترتيب ربط الأنظمة

### 3. Deploy Commands Script
`scripts/deploy-commands-voidroll-reborn.js`

ينشر أوامر VoidRoll Reborn الجديدة على Discord.

## طريقة الربط داخل index.js

داخل event:
```js
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { handleVoidRollCommand } = require('./systems/commandRouter');

  const handled = await handleVoidRollCommand(interaction, {
    user,
    cards,
    allCharacters,
    formations,
    cardsById,
    activeBanner,
    pity,
    activeDungeon,
    activeRaidBoss,
    players,
    serverCards
  });

  if (handled) return;

  // old fallback commands here
});
```

## مهم
هذا الباتش لا يعرف تلقائيًا كيف تجيب بيانات اللاعب من قاعدة البيانات.
لازم في index.js تمرر:
- user
- cards
- allCharacters
- formations
- cardsById
- activeBanner
- pity
- activeDungeon
- activeRaidBoss

## الخطوة القادمة
Prisma Schema Patch:
- إضافة أعمدة وجداول النظام الجديد
- تجهيز migrations
