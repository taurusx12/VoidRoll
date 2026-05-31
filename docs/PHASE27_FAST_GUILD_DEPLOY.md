# Phase 27 Fast Guild Deploy

## متى تستخدمه؟
إذا Phase 25 يعلق عند:
`Deploying clean GUILD commands only`

## وش يسوي؟
ينشر أوامر أساسية نظيفة فقط للسيرفر، بدون القديم وبدون سكربت Phase 25.

## التشغيل

```bash
cd ~/project/src
GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
npm start
```

## الأوامر اللي بيرجعها
- /help
- /wallet
- /profile
- /daily
- /roll
- /banner
- /pack
- /rates
- /inventory
- /character
- /anime
- /who-has
- /story
- /dungeon
- /pvp
- /world-boss
- /raid
- /raid-attack
- /raid-rank
- /formations
- /market

بعد ما نثبت أنها تشتغل، نرجع نضيف باقي الأوامر تدريجيًا.
