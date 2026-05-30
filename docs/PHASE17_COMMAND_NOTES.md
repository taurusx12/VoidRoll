# Phase 17 Command Notes — Integration

## بعد تركيب الباتش
شغل:

```bash
node scripts/deploy-commands-voidroll-reborn.js
```

## لازم تضيف في .env
- BOT_TOKEN
- CLIENT_ID
- GUILD_ID اختياري للتجربة

## الكوماندات القديمة المحذوفة
لا ترجع:
- /fuse
- /star-upgrade
- /item-roll
- /relic-pull
- /aura-pull
- /character-shards

## ملاحظة
الـCommand Router يجهز الربط، لكنه يحتاج index.js يمرر البيانات من Prisma.
