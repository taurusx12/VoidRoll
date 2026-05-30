# VoidRoll Reborn — Phase 4 Daily Market

## الهدف
إضافة نظام السوق اليومي والمتاجر النادرة بدون الرجوع لرولات الأيتمات.

## المتاجر

### Daily Market
يتحدث كل 24 ساعة.

يبيع:
- Essence
- Soul Fragments
- Gear Materials
- Trait Dust
- Bond Points

### Black Market
متجر نادر للمواد الأقوى.

يبيع:
- Large Essence
- Cursed Metal
- Role Sigils
- Trait Crystal
- Divine Fragment

### Void Market
أندر متجر.

يبيع:
- Void Alloy
- Void Core
- Voidborn Shard
- Secret Core
- Secret Frame Token

### Traveling Merchant
تاجر يظهر أحيانًا.

يبيع:
- عروض مخفضة
- Role Sigils عشوائية
- Element Cores عشوائية
- Transformation Core Cache
- Void Crystal Fragment

## Dynamic Prices
تمت إضافة نسخة مبدئية بسيطة.

الأسعار تتغير حسب نوع المتجر وقيمة العنصر:
- Daily عادي
- Black أغلى قليلًا
- Void أغلى
- Traveling أرخص قليلًا أحيانًا

النسخة الكاملة حسب طلب اللاعبين تنضاف بعد توفر بيانات استخدام حقيقية.

## المحذوف
السوق لا يحتوي:
- Item Rolls
- Relic Pulls
- Aura Pulls
- Character-specific shards

## الملفات المضافة
- src/config/market_config.json
- src/systems/marketSystem.js
- docs/VOIDROLL_REBORN_PHASE4_MARKET.md
- docs/PHASE4_COMMAND_NOTES.md
- PHASE4_APPLIED.txt
- INSTALL_PHASE4_PATCH.txt

## الخطوة القادمة
Phase 5 — Inventory Rework

راح نضيف:
- عرض الشخصية بشكل أنظف
- فلترة بالأنمي
- فلترة بالندرة
- عرض Role / Element / Passive / Gear tier
- تجهيز Search by Anime
