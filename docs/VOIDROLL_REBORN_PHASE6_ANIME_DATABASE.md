# VoidRoll Reborn — Phase 6 Anime Database

## الهدف
تجهيز البحث حسب الأنمي وقاعدة الشخصيات قبل بناء القتال والسيكرت.

## المضاف

### /anime
يعرض معلومات الأنمي:
- عدد الشخصيات
- توزيع الندرات
- توزيع الأدوار
- توزيع العناصر

### /collection anime:
يعرض نسبة إكمال اللاعب للأنمي.

مثال:
`/collection anime:Bleach`

يعرض:
- Completion %
- Owned unique
- Total characters
- Next milestone

### /character
يعرض بيانات الشخصية:
- الاسم
- Variant
- Anime
- Rarity
- Element
- Role
- Base Power
- Passive
- Lore

### /who-has
أساس أمر البحث عن من يملك الشخصية.

يعرض:
- اللاعب
- الشخصية
- النسخة/Variant
- الندرة
- المستوى
- القوة

## Anime Completion Bonus
تم تجهيز قواعد المكافآت:
- 10%
- 25%
- 50%
- 75%
- 100%

المكافآت تكون خفيفة ولا تكسر التوازن.

## قواعد مهمة
- الإكمال يحسب الشخصيات الفريدة، وليس النسخ المكررة.
- الـVariants تحسب كإدخالات مستقلة إذا كانت شخصيات منفصلة.
- لا Stars.
- لا Fusion.
- لا Character Shards.

## الملفات المضافة
- src/config/anime_database_config.json
- src/systems/animeDatabaseSystem.js
- docs/VOIDROLL_REBORN_PHASE6_ANIME_DATABASE.md
- docs/PHASE6_COMMAND_NOTES.md
- INSTALL_PHASE6_PATCH.txt
- PHASE6_APPLIED.txt

## الخطوة القادمة
Phase 7 — Battle Engine Foundation

راح نضيف:
- Stats-based battle foundation
- Crit
- Dodge
- Counter
- Bleed
- Burn
- Freeze
- Silence
- Shield
- Healing
- Mana / Energy
- Ultimate Bar
