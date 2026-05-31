# Phase 28 — Replace progressBattle Completely

## التشغيل

```bash
cd ~/project/src
node scripts/phase28-replace-progressbattle.js
grep -n "PHASE28_PROGRESSBATTLE_REPLACED\|Team Score\|progressBattle(i,commandName)" src/index.js
npm start
```

إذا بقي /story يطلع Team Score بعد هذا، غالبًا فيه أكثر من بوت شغال بنفس التوكن أو Render يشغل نسخة ثانية.
