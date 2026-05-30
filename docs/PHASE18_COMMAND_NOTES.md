# Phase 18 Command Notes — Prisma Schema

## لا توجد كوماندات جديدة
هذا الباتش خاص بقاعدة البيانات.

## بعد التركيب
شغل:
```bash
node scripts/prisma-schema-audit.js
```

لو طلع نقص:
افتح:
`prisma/VOIDROLL_REBORN_SCHEMA_PATCH.prisma`

وانسخ الإضافات إلى:
`prisma/schema.prisma`

ثم:
```bash
npx prisma format
npx prisma generate
npx prisma db push
```
