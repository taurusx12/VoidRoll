# Phase 39 — Variant System + Cinematic Reveals

## يضيف
- فصل الأصل عن النسخ الخاصة مثل:
  - Lelouch
  - Absolute Lelouch
  - Corrupted Lelouch
- `/variants`
- Reveal سينمائي من 5 خطوات للشخصيات الخاصة:
  1. Darkness
  2. Distortion
  3. Quote Appears
  4. Secret Flash
  5. Character Reveal
- بحث يمنع أن `/character Lelouch` يجيب Corrupted/Absolute بالغلط.
- تقرير للصور المكررة بين الأصل والنسخة الخاصة.

## التشغيل

```bash
cd ~/project/src
node scripts/phase39-variant-system-reveals.js
node --check src/index.js
node scripts/phase39-variant-audit.js
cat reports/PHASE39_VARIANT_AUDIT.md
GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
npm start
```

## الاختبار في Discord

```txt
/character name:Lelouch
/character name:Absolute Lelouch
/variants name:Lelouch
/pack
/roll amount:10
```

## ملاحظة الصور
السكربت لا يقدر يخترع imageUrl رسمي لكل شخصية.
هو يطلع تقرير:
`PHASE39_VARIANT_IMAGE_WARNINGS.json`
عشان تعرف أي Variant يحتاج صورة مختلفة.
