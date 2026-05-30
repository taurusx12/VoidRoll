# VoidRoll Reborn — Phase 5 Inventory Rework

## الهدف
تجهيز Inventory نظيف يناسب النظام الجديد.

## الجديد
- فلترة بالأنمي.
- فلترة بالندرة.
- فلترة بالعنصر.
- فلترة بالدور.
- فلترة بالـVariant.
- بحث بالاسم.
- ترتيب حسب Power / Rarity / Level / Name / Anime / Gear.
- عرض Built-in Gear Tier.
- عرض Passive / Leader Passive / Collection Passive.
- دعم التكرار كنسخ مستقلة.

## أمثلة
/inventory anime:Bleach
/inventory rarity:SECRET
/inventory element:VOID
/inventory role:CONTROL
/inventory name:Makima

## قواعد مهمة
لا نعرض:
- Stars
- Fusion
- Character Shards
- Makima Shards

لأنها محذوفة من النظام.

## Inventory Display
كل كرت يظهر فيه:
- الاسم
- Variant
- Anime
- Rarity
- Element
- Role
- Level
- Power
- Gear Tier

## View Card Display
يعرض تفاصيل أعمق:
- Stats
- Passive
- Leader Passive
- Collection Passive

## الملفات المضافة
- src/config/inventory_config.json
- src/systems/inventorySystem.js
- docs/VOIDROLL_REBORN_PHASE5_INVENTORY.md
- docs/PHASE5_COMMAND_NOTES.md
- PHASE5_APPLIED.txt
- INSTALL_PHASE5_PATCH.txt

## الخطوة القادمة
Phase 6 — Search by Anime + Character Database

راح نضيف:
- /anime
- /collection anime:Bleach
- Anime Completion %
- Anime Collection Bonus
- Character Database formatting
- /who-has foundation
