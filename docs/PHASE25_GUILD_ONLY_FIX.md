# Phase 25 Guild-Only Command Fix

## المشكلة
السكريبت يعلق عند:
`Deploying clean GLOBAL commands only`

## الحل
نخلي النشر Guild-only بدل Global، يعني الأوامر تظهر فورًا في سيرفرك.

## التشغيل

```bash
cd ~/project/src
node scripts/phase25-patch-guild-only.js
GUILD_ID=1039274134296862801 node scripts/phase25-hard-command-reset.js
npm start
```

لا تضغط Ctrl+C إلا بعد ما تشوف:

```txt
✅ CLEAN GUILD commands deployed
Done. Old commands removed from API.
```
