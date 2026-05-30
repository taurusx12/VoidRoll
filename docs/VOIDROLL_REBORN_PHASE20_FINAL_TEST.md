# VoidRoll Reborn — Phase 20 Final Test

## الهدف
آخر اختبار قبل الإطلاق.

## بعد تركيب الباتش شغل الأوامر بالترتيب

```bash
cd ~/project/src
npm install
npx prisma format
npx prisma generate
node scripts/prisma-schema-audit.js
node scripts/voidroll-final-test.js
node scripts/voidroll-launch-report.js
node scripts/deploy-commands-voidroll-reborn.js
npm start
```

## لو final test فشل
ارسل لي الناتج كامل.

## لو deploy commands فشل
غالبًا المشكلة من:
- BOT_TOKEN
- CLIENT_ID
- صلاحيات البوت
- Discord application id

## لو npm start فشل
ارسل لي أول Error يظهر.

## اختبارات Discord اليدوية
جرب:
- /help
- /wallet
- /inventory
- /market
- /banner
- /formations
- /story
- /pvp-rank
- /dungeon
- /world-boss

## أوامر لازم تكون محذوفة أو معطلة
- /fuse
- /fusion
- /star-upgrade
- /item-roll
- /relic-pull
- /aura-pull
- /character-shards

## إذا كل شيء اشتغل
نقدر بعدها نسوي Final Launch Zip.
