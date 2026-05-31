# Phase 24 FORCE Battle Hook

## المشكلة
/story ما زال يعرض الشكل القديم:
Team Score / Required / Roles

هذا يعني أن الهاندلر القديم يمسك الأمر قبل battlePolishSystem.

## الحل
هذا الباتش يحط hook في أول `command(i)` مباشرة.

## التشغيل

```bash
cd ~/project/src
node scripts/phase24-force-battle-hook.js
npm start
```

## جرّب بعد التشغيل
```txt
/story
/dungeon type:normal
/world-boss
/raid-attack
/pvp opponent:...
```

لو /story لسه يطلع Team Score، معناها عندك أكثر من index.js أو Render يشغل نسخة ثانية.
