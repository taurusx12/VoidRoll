# Phase 16 Command Notes — Launch Cleanup

## Main new helper
`src/systems/launchGuard.js`

Use it to:
- block removed commands
- show allowed command list
- show launch checklist
- show removed systems

## Suggested /help behavior
Use allowed commands from:
`src/config/launch_cleanup_config.json`

## Blocked commands
If any old command exists, return a disabled message:
- /item-roll
- /relic-pull
- /aura-pull
- /fuse
- /fusion
- /star-upgrade
- /merge
- /duplicate-fuse
- /character-shards
- /shards

## Next after this
After installing this patch, the next work is not another feature phase.
Next work is:
- connect all helper systems into index.js
- update deploy-commands.js
- update Prisma schema if needed
- run full test
- create launch build
