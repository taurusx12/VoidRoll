# VoidRoll Reborn — Phase 2

## الهدف
تنظيف نظام التطوير والكوماندات قبل الدخول على Secret Card Reveal.

## القرارات المعتمدة

### حذف أنظمة
- لا Item Rolls.
- لا Relic Pull مستقل.
- لا Aura Pull مستقل.
- لا Fusion.
- لا Stars.
- لا Duplicate Fusion.

### النظام البديل
كل شخصية عندها **Character Evolution Tree**.

الشجرة تحتوي:
- Core Tree
- Skill Tree
- Built-in Gear Tree
- Trait Tree
- Bond Tree
- Transformation Tree
- Variant Tree

### Built-in Gear
كل شخصية تبدأ بمعدات Common مدمجة داخلها، وتتطور كالتالي:

Common → Rare → Epic → Legendary → Mythic → Divine → Voidborn → Secret

### Duplicates
إذا اللاعب سحب شخصية مكررة، ما يدمجها ولا تزيد نجومها.

بدل ذلك تتحول إلى:
- Character Shards
- Essence
- Gold
- Void Crystals للشخصيات النادرة جدًا

## ترتيب الرياريتي الرسمي
COMMON → RARE → EPIC → LEGENDARY → MYTHIC → DIVINE → VOIDBORN → SECRET

## تنظيف الكوماندات
الكوماندات القديمة الخاصة بالأيتمات والدمج والنجوم لازم تنحذف أو تتعطل.

محذوف:
- /item-roll
- /relic-pull
- /aura-pull
- /fuse
- /fusion
- /star-upgrade
- /merge
- /duplicate-fuse

## الملفات المضافة
- src/config/progression_rules.json
- src/config/command_cleanup_plan.json
- src/systems/progressionSystem.js
- docs/VOIDROLL_REBORN_PHASE2.md
- scripts/audit-famous-characters.js

## الخطوة القادمة
Phase 3:
- Economy Rework الفعلي
- /wallet
- Gold / Tokens / Essence / Void Crystals
- تحديث أوامر الأدمن للعملات الجديدة
- تجهيز قاعدة البيانات لو احتاجت أعمدة جديدة
