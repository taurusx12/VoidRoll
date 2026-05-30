# VoidRoll Reborn — Phase 23 Polish Commands

## يصلح
- تكرار الأوامر القديمة في Discord.
- `/banner` البدائي.
- `/roll amount:10` بدون صور.
- `/pack` بدون صور.
- رجوع خطأ ترتيب `/upgrade` في deploy commands.
- يضيف سكربت يمسح Global + Guild commands كلها.

## التشغيل

```bash
cd ~/project/src
node scripts/phase23-apply-polish.js
node scripts/clear-all-discord-commands.js
node scripts/deploy-commands-voidroll-reborn.js
npm start
```

## ملاحظة مهمة
بعد مسح Global commands وإعادة نشرها، Discord أحيانًا يحتاج دقائق حتى تختفي التكرارات من الواجهة.
Guild commands تختفي أسرع.

## التجربة
بعد التشغيل جرّب:
- /help
- /banner
- /roll amount:10
- /pack
- /pvp
- /story
