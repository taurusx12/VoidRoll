# Kill Legacy Battle Handlers

## المشكلة
/story ما زال يظهر:
- STORY VICTORY
- Team Score
- Required
- Roles

هذا من الكود القديم `progressBattle`.

## الحل
هذا الباتش:
- يضيف Force Hook في أول command(i).
- يحذف خط story/dungeon القديم.
- يحذف pvp القديم.
- يحط guard داخل progressBattle نفسه.

## التشغيل

```bash
cd ~/project/src
node scripts/phase24-kill-legacy-battle.js
npm start
```

## تحقق

```bash
grep -n "progressBattle(i,commandName)\|STORY VICTORY\|Team Score\|PHASE24_KILL_LEGACY" src/index.js
```

المفروض ما يطلع `progressBattle(i,commandName)` ولا `Team Score`.
