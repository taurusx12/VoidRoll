# Phase 33 — Character Display Consistency

## المشكلة
لو تبحث باسم أول للشخصية يطلع Passive، ولو تكتب الاسم كامل يطلع Passive ثاني.

مثال:
- Inosuke
- Inosuke Hashibira

## السبب
`/character` و`/view-card` يستخدمون أحيانًا:
- دوال عرض قديمة داخل `index.js`
- أو يبحثون عن Record مختلف بسبب تطابق جزئي

## الحل
هذا الباتش:
- يجبر `index.js` يستخدم `characterCombatProfileSystem`.
- يحسن البحث بالاسم الكامل والاسم الأول.
- يخلي `statBlock` يعرض نفس Passive/Type/Element دائمًا.
- يمنع ظهور `DPS Mastery` و`passive affects real battle stats`.

## التشغيل

```bash
cd ~/project/src
node scripts/phase33-character-display-consistency.js
node --check src/index.js
grep -n "DPS Mastery\|passive affects real battle stats" src/index.js
npm start
```

المفروض `grep` ما يطلع شيء.
