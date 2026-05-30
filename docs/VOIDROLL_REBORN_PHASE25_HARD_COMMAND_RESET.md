# VoidRoll Reborn — Phase 25 HARD Command Reset

## المشكلة
الأوامر القديمة رجعت لأن سكربت نشر أو Guild Commands قديمة ما زالت مسجلة.

## الحل
سكريبت واحد:
- يمسح Global commands.
- يمسح Guild commands لكل السيرفرات اللي البوت داخلها.
- يعيد نشر قائمة نظيفة فقط.
- ما ينشر:
  - /auto-train
  - /tower
  - /boss-rush
  - /fuse
  - /fusion
  - /star-upgrade
  - /item-roll
  - /relic-pull
  - /aura-pull
  - /character-shards
  - /shards

## التشغيل

أوقف البوت أولًا بـ CTRL+C ثم:

```bash
cd ~/project/src
node scripts/phase25-hard-command-reset.js
npm start
```

## إذا بقيت الأوامر في سيرفر واحد
أضف في Render Environment:

```env
GUILD_ID=ايدي_السيرفر
```

ثم شغل:

```bash
node scripts/phase25-hard-command-reset.js
npm start
```

## ملاحظة
Global commands أحيانًا تحتاج دقائق حتى تختفي من واجهة Discord.
Guild commands تختفي أسرع.
