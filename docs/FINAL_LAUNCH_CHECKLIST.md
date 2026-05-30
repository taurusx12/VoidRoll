# VoidRoll Reborn — Final Launch Checklist

## 1. Install
```bash
npm install
```

## 2. Prisma
```bash
npx prisma generate
```

## 3. Deploy Commands
```bash
node scripts/deploy-commands.js
```

## 4. Smoke Test
```bash
node scripts/launch-smoke-test.js
```

## 5. Start Bot
```bash
npm start
```

## 6. Test Core Commands
- /help
- /profile
- /wallet
- /inventory
- /roll
- /banner
- /pack
- /market
- /formations
- /story
- /character-tree
- /upgrade
- /traits
- /dungeon
- /pvp-rank
- /world-boss

## 7. Check Disabled Commands
These should not exist or should return disabled message:
- /fuse
- /fusion
- /star-upgrade
- /item-roll
- /relic-pull
- /aura-pull
- /character-shards

## 8. Admin Safety
Make sure admin commands are protected:
- /admin-reset-all
- /admin-give-gold
- /admin-give-tokens
- /admin-give-essence
- /admin-give-void-crystals
- /admin-give-resource
