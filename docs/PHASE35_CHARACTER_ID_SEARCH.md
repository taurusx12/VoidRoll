# Phase 35 — Character ID Search / Autocomplete Fix

## المشكلة
مو بس Inosuke؛ أغلب الشخصيات يطلع لها شخصية غلط لأن البحث يعتمد على نص الاسم والتخمين.

## الحل
بدل ما autocomplete يرجع اسم الشخصية، صار يرجع Character ID.
يعني إذا اخترت الشخصية من القائمة، البوت يجيب نفس الشخصية 100% بدون تخمين.

وبرضو البحث اليدوي صار strict:
1. Character ID
2. exact full name
3. exact clean name
4. exact first token
5. startsWith
6. all name tokens
7. بعدها القوة كـ tie-breaker فقط

## التشغيل

```bash
cd ~/project/src
node scripts/phase35-character-id-search.js
node --check src/index.js
node scripts/phase35-test-character-search.js "Inosuke"
node scripts/phase35-test-character-search.js "Eren"
node scripts/phase35-test-character-search.js "Gojo"
npm start
```

## مهم
بعدها جرّب في ديسكورد واختَر من autocomplete بدل كتابة النص فقط:
```txt
/character name:Inosuke
```

إذا Discord autocomplete كان كاش قديم، أعد نشر أوامر Guild السريعة:
```bash
GUILD_ID=1039274134296862801 node scripts/phase27-fast-guild-deploy.js
```
