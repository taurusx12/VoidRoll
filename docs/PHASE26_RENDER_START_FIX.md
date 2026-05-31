# Phase 26 — Render Start Fix

## السبب الحقيقي للمشكلة
Render يشغل عند كل Restart:

```txt
npm run commands:deploy && node src/index.js
```

و`commands:deploy` كان يشغل:

```txt
node scripts/deploy-commands.js
```

وهذا السكربت القديم كان ينشر الأوامر القديمة:
- auto-train
- tower
- boss-rush
- admin-dedupe-characters
- وغيرها

فكل ما نصلح الأوامر، Render يرجع يخربها عند التشغيل.

## الحل
هذا الباتش:
- يعدل `package.json`.
- يخلي `commands:deploy` يشغل `phase25-hard-command-reset.js`.
- يعطل `scripts/deploy-commands.js` القديم ويخليه يحول للسكريبت النظيف.
- يضيف حماية من Unknown Interaction crash.

## التشغيل

```bash
cd ~/project/src
node scripts/phase26-render-start-fix.js
GUILD_ID=1039274134296862801 npm run commands:deploy
npm start
```

## مهم في Render
الأفضل تغير Start Command من:

```txt
npm run commands:deploy && node src/index.js
```

إلى:

```txt
npm start
```

لكن حتى لو تركته، بعد هذا الباتش صار `commands:deploy` نظيف وما يرجع القديم.
