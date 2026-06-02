# Phase 30 — Role/Element Rebalance

## المشكلة
Phase 29 طلع فيه:
- NEUTRAL كثير جدًا
- DPS كثير جدًا
- SUPPORT قليل جدًا

## الحل
هذا الباتش يستبدل `characterCombatProfileSystem.js` بقواعد أذكى:
- exact profiles للشخصيات المشهورة.
- anime rules أكثر.
- name rules للدعم/الهيلر/التانك/الكنترول.
- fallback موزون بدل ما كل شيء DPS/NEUTRAL.

## التشغيل

```bash
cd ~/project/src
node --check src/systems/characterCombatProfileSystem.js
node scripts/phase30-role-element-rebalance-audit.js
cat reports/PHASE30_CHARACTER_COMBAT_REBALANCE.md
```

## تطبيق على الداتابيس

```bash
APPLY_DB=true node scripts/phase30-role-element-rebalance-audit.js
```

بعدها شغل:
```bash
npm start
```
