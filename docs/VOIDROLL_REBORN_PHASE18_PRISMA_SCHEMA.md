# VoidRoll Reborn — Phase 18 Prisma Schema Patch

## مهم جدًا
هذا الباتش آمن، وما يستبدل `prisma/schema.prisma` تلقائيًا.

السبب:
مشروعك الحالي غالبًا فيه Models جاهزة، ولو استبدلنا schema كامل ممكن نخرب قاعدة البيانات.

## الملفات المضافة

### prisma/VOIDROLL_REBORN_SCHEMA_PATCH.prisma
هذا ملف فيه الإضافات المطلوبة.

انسخ منه:
- حقول User الجديدة
- حقول Card/OwnedCard الجديدة
- الموديلات الجديدة

وحطها داخل `prisma/schema.prisma`.

### scripts/prisma-schema-audit.js
يفحص هل schema الحالي يحتوي الإضافات المطلوبة.

تشغيله:
```bash
node scripts/prisma-schema-audit.js
```

### src/config/prisma_schema_plan.json
خطة واضحة للي نحتاجه في قاعدة البيانات.

## الحقول المطلوبة في User
- essence
- voidCrystals
- soulFragments
- pvpRating
- pvpWins
- pvpLosses
- pvpWinStreak
- chapter
- stage

## الحقول المطلوبة في Card / OwnedCard
حسب اسم الموديل عندك، أضف:
- gearTier
- coreTier
- skillTier
- traitName
- traitTier
- bondTier
- transformationTier
- variantTier
- element
- role

## الموديلات الجديدة
- UserResource
- Formation
- FormationSlot
- Pity
- MarketPurchase
- DungeonRun
- RaidBoss
- RaidDamageLog
- PvpBattleLog

## بعد الدمج
شغل:

```bash
npx prisma format
npx prisma generate
npx prisma db push
```

## الخطوة القادمة
Phase 19 — index.js Real DB Wiring

بنربط البيانات الفعلية:
- ensureUser
- جلب الكروت
- جلب التشكيلات
- حفظ التشكيلات
- حفظ pity
- حفظ dungeon run
- حفظ raid damage
