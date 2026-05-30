# VoidRoll Reborn — Deploy Commands Fix

## المشكلة
Discord رفض نشر الأوامر لأن أمر `/upgrade` كان فيه خيار اختياري قبل خيار إجباري.

## الحل
شغل:

```bash
cd ~/project/src
node scripts/fix-deploy-command-options.js
node scripts/deploy-commands-voidroll-reborn.js
```

بعدها:

```bash
npm start
```
