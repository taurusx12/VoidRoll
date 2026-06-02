# VoidRoll Reborn — Phase 29 Character Combat Audit

## الهدف
- باسيفات مرتبطة بالأنمي والشخصية.
- الباسيفات تؤثر فعليًا داخل القتال.
- ترتيب Rarity حسب القوة.
- Type / Role لكل شخصية.
- Element لكل شخصية مثل DARK / LIGHT / VOID / SOUL / CURSED / BLOOD.

## الملفات
- `src/systems/characterCombatProfileSystem.js`
- `scripts/phase29-character-combat-audit.js`
- `scripts/phase29-hook-combat-profiles.js`

## التشغيل

```bash
cd ~/project/src
node scripts/phase29-hook-combat-profiles.js
node --check src/systems/battlePolishSystem.js
node scripts/phase29-character-combat-audit.js
```

## تطبيق التعديلات على الداتابيس إذا الحقول موجودة

```bash
APPLY_DB=true node scripts/phase29-character-combat-audit.js
```

## التقارير
- `reports/CHARACTER_COMBAT_AUDIT.md`
- `reports/CHARACTER_COMBAT_AUDIT.json`
- `reports/CHARACTER_RARITY_ISSUES.json`
