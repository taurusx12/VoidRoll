# Phase 19 Command Notes — DB Wiring

## لا توجد أوامر جديدة
هذا الباتش يربط الأوامر الموجودة بقاعدة البيانات.

## أهم ملفين
- src/systems/dbAdapter.js
- src/VOIDROLL_INDEX_HOOK_SNIPPET.js

## بعد التركيب
لازم تعدل index.js يدويًا وتضيف hook.

## إذا طلع خطأ في card model
عدّل env:
```env
VOIDROLL_CARD_MODEL=userCard
```
أو:
```env
VOIDROLL_CARD_MODEL=ownedCard
```
حسب اسم موديل الكروت عندك.
