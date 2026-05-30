# VoidRoll Reborn — Phase 21 Character Library Cleanup

## الهدف
ترتيب مكتبة الشخصيات كاملة من A إلى Z، وتنظيف قاعدة الشخصيات المرتبطة بـ MyAnimeList.

## هذا الباتش يعالج
- ترتيب 6000 شخصية A-Z.
- تنظيف أسماء الشخصيات من الزيادات.
- كشف التكرارات.
- كشف الشخصيات المشهورة الناقصة.
- تجهيز تقارير كاملة.
- تجهيز Variants مثل:
  - Corrupted Makima
  - Corrupted Aizen
  - Corrupted Gojo
  - True Form Sukuna
  - Voidborn Rimuru
  - Eclipse Madara
  - Abyssal Ichigo
  - Awakened Naruto

## التشغيل الآمن
أول شيء شغل:

```bash
cd ~/project/src
node scripts/voidroll-character-library-cleanup.js
```

هذا لا يغير قاعدة البيانات، فقط يطلع Reports.

## التقارير
بتطلع هنا:

```txt
reports/characters_A_TO_Z.json
reports/characters_BY_LETTER.json
reports/characters_DUPLICATES.json
reports/characters_MISSING_FAMOUS.json
reports/characters_VARIANT_PLAN_RESULTS.json
reports/CHARACTER_LIBRARY_REPORT.md
```

## تطبيق التنظيف فعليًا
بعد ما تشوف التقرير:

```bash
APPLY_CHANGES=true node scripts/voidroll-character-library-cleanup.js
```

هذا يحدث:
- role
- element
- variant
- ويعطل التكرارات

## إنشاء شخصيات Voidborn/Secret Variants
بعدها:

```bash
APPLY_VARIANTS=true node scripts/voidroll-character-library-cleanup.js
```

## ملاحظة مهمة
هذا لا يرمي قاعدة بياناتك ولا يحذفها.
التكرارات يتم تعطيلها فقط عندما تشغل APPLY_CHANGES=true.
