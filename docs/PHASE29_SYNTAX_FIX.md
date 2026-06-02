# Phase 29 Syntax Fix

## المشكلة
بعد hook صار `battlePolishSystem.js` فيه:
```js
function roleOf(c={}) { return combatProfiles.roleOf(c); }) {
```

## التشغيل

```bash
cd ~/project/src
node scripts/phase29-fix-battle-syntax.js
node --check src/systems/battlePolishSystem.js
npm start
```
