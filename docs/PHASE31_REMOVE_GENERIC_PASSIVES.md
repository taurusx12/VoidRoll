# Phase 31 — Remove Generic Passives

## المشكلة
الرسالة القديمة:
```txt
Passive: DPS Mastery — DPS passive affects real battle stats.
```

مصدرها `src/index.js`، لأن عرض `/character` و`/view-card` يستخدم دالة `passiveOf` القديمة.

## الحل
هذا الباتش يخلي `index.js` يستخدم:
```js
src/systems/characterCombatProfileSystem.js
```

وبكذا الباسيفات تصير مرتبطة بالأنمي/الشخصية وتظهر كتأثيرات حقيقية.

## التشغيل

```bash
cd ~/project/src
node scripts/phase31-remove-generic-passives.js
node --check src/index.js
grep -n "DPS Mastery\|passive affects real battle stats" src/index.js
npm start
```

المفروض grep ما يطلع شيء.
