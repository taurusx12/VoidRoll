# Phase 32 — Purge Old Mastery Passives

## المشكلة
بعض الشخصيات ما زالت تعرض:
```txt
DPS Mastery — DPS passive affects real battle stats.
```

## السبب
إما:
- نصوص قديمة موجودة في ملفات source.
- أو بيانات قديمة مخزنة في DB داخل passive/passiveName.

## التشغيل

```bash
cd ~/project/src
node scripts/phase32-purge-old-mastery-passives.js
node --check src/index.js
node --check src/systems/battlePolishSystem.js
grep -R -n "DPS Mastery\|passive affects real battle stats" src || true
cat reports/PHASE32_PASSIVES_CLEANUP.md
npm start
```

## لو تبغى تجبر تحديث كل الشخصيات
```bash
FORCE_ALL=true node scripts/phase32-purge-old-mastery-passives.js
```
