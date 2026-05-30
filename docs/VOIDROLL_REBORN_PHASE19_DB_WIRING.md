# VoidRoll Reborn — Phase 19 index.js Real DB Wiring

## الهدف
ربط الأنظمة الجديدة مع Prisma فعليًا.

## المضاف

### src/systems/dbAdapter.js
يربط:
- User
- Cards
- Characters
- Formations
- Pity
- DungeonRun
- RaidBoss
- RaidDamageLog
- UserResource

### src/systems/adminDbHelpers.js
مساعدات للأدمن:
- giveGold
- giveTokens
- giveEssence
- giveVoidCrystals
- giveGenericResource

### src/VOIDROLL_INDEX_HOOK_SNIPPET.js
Snippet جاهز تحطه داخل index.js.

## مهم جدًا
إذا موديل الكروت عندك مو اسمه `Card` في Prisma، عدل هذا السطر في:

`src/systems/dbAdapter.js`

```js
const CARD_MODEL_NAME = process.env.VOIDROLL_CARD_MODEL || 'card';
```

مثلاً لو الموديل عندك اسمه UserCard:
```env
VOIDROLL_CARD_MODEL=userCard
```

## طريقة الربط داخل index.js

أضف فوق:
```js
const { handleVoidRollCommand } = require('./systems/commandRouter');
const { buildCommandContext } = require('./systems/dbAdapter');
```

داخل interactionCreate:
```js
const context = await buildCommandContext(interaction);
const handled = await handleVoidRollCommand(interaction, context);
if (handled) return;
```

## بعد التركيب
شغل:
```bash
npx prisma generate
node scripts/deploy-commands-voidroll-reborn.js
npm start
```

## الخطوة القادمة
Phase 20 — Final Test + Launch Zip
