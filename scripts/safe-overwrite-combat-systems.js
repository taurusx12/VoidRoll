// VoidRoll Reborn — SAFE OVERWRITE Combat Systems
// This fixes the recurring SyntaxError in:
//   src/systems/battlePolishSystem.js
//   src/systems/characterCombatProfileSystem.js
//
// It replaces both files with clean, valid, compatible modules.
// Run:
//   node scripts/safe-overwrite-combat-systems.js
//   node --check src/systems/battlePolishSystem.js
//   node --check src/systems/characterCombatProfileSystem.js
//   node --check src/index.js
//   npm start

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function backup(file) {
  if (fs.existsSync(file)) {
    const b = `${file}.backup-safe-overwrite-${Date.now()}.js`;
    fs.copyFileSync(file, b);
    console.log(`Backup: ${path.relative(ROOT, b)}`);
  }
}

const profileSystem = `// VoidRoll Reborn — Clean Character Combat Profile System
// Safe launch version. No VOIDBORN. No generic DPS passive for main event characters.

function nameOf(c = {}) {
  return String(c.name || c.characterName || '').toLowerCase();
}

function roleOf(c = {}) {
  const n = nameOf(c);

  if (n.includes('lelouch') || n.includes('aizen') || n.includes('makima') || n.includes('gojo') || n.includes('gojou') || n.includes('itachi')) return 'CONTROL';
  if (n.includes('ainz')) return 'SUMMONER';
  if (n.includes('eren') || n.includes('all might') || n.includes('toshinori')) return 'TANK';
  if (n.includes('saber') || n.includes('rimuru')) return 'DPS';

  return c.role || c.combatRole || 'DPS';
}

function elementOf(c = {}) {
  const n = nameOf(c);

  if (n.includes('aizen') || n.includes('lelouch') || n.includes('rimuru')) return 'VOID';
  if (n.includes('ainz')) return 'DARK';
  if (n.includes('makima')) return 'CURSED';
  if (n.includes('itachi')) return 'SHADOW';
  if (n.includes('gojo') || n.includes('gojou') || n.includes('saber') || n.includes('all might') || n.includes('toshinori')) return 'LIGHT';
  if (n.includes('eren')) return 'BLOOD';

  return c.element || c.type || 'NEUTRAL';
}

function getAccuratePassive(c = {}) {
  const n = nameOf(c);

  if (n.includes('lelouch')) return {
    name: 'Geass Command',
    text: '30% chance to stun and reduce enemy damage.',
    effect: { stun: 30, enemyAtk: -12, control: 20 }
  };

  if (n.includes('aizen')) return {
    name: 'Kyoka Suigetsu',
    text: 'Illusion pressure: enemy miss chance, enemy ATK down, and higher control accuracy.',
    effect: { miss: 25, enemyAtk: -15, control: 22, dmg: 8 }
  };

  if (n.includes('itachi')) return {
    name: 'Tsukuyomi',
    text: 'Genjutsu control: enemy miss chance, control accuracy, and execute pressure.',
    effect: { miss: 18, control: 25, execute: 10, dmg: 8 }
  };

  if (n.includes('ainz')) return {
    name: 'The Goal of All Life',
    text: 'Dark magic dominance: boss damage, penetration, and death pressure.',
    effect: { bossDmg: 22, pen: 12, dmg: 10 }
  };

  if (n.includes('rimuru')) return {
    name: 'Predator',
    text: 'Adapts by absorbing power: lifesteal, penetration, and skill damage.',
    effect: { lifesteal: 14, pen: 10, dmg: 12 }
  };

  if (n.includes('makima')) return {
    name: 'Control Devil',
    text: 'Dominates enemies: enemy ATK down and team damage up.',
    effect: { teamDmg: 12, enemyAtk: -16, control: 18 }
  };

  if (n.includes('gojo') || n.includes('gojou')) return {
    name: 'Infinity',
    text: 'Nullifies the first heavy hit, increases dodge, and boosts burst damage.',
    effect: { shield: 1, dodge: 18, dmg: 10 }
  };

  if (n.includes('eren')) return {
    name: 'Titan Rage',
    text: 'Gains defense and damage under pressure, with bonus boss damage.',
    effect: { def: 14, dmg: 12, bossDmg: 10 }
  };

  if (n.includes('saber') || n.includes('artoria')) return {
    name: 'Excalibur',
    text: 'Light burst finisher: anti-boss damage and defensive barrier.',
    effect: { bossDmg: 18, def: 12, dmg: 8 }
  };

  if (n.includes('all might') || n.includes('toshinori')) return {
    name: 'Plus Ultra',
    text: 'Heroic last stand: defense, team protection, and smash damage.',
    effect: { def: 18, teamDmg: 8, dmg: 12 }
  };

  return null;
}

function passiveOf(c = {}) {
  const accurate = getAccuratePassive(c);
  if (accurate) return accurate;

  const role = roleOf(c);
  return {
    name: role + ' Combat Style',
    text: role + ' passive gives a real battle bonus.',
    effect: { dmg: 6 }
  };
}

function profileOf(c = {}) {
  return {
    role: roleOf(c),
    element: elementOf(c),
    passive: passiveOf(c)
  };
}

function applyPassiveStats(stats = {}, passive = {}) {
  const e = passive.effect || {};
  return {
    ...stats,
    dmg: Number(stats.dmg || 0) + Number(e.dmg || 0),
    def: Number(stats.def || 0) + Number(e.def || 0),
    bossDmg: Number(stats.bossDmg || 0) + Number(e.bossDmg || 0),
    dodge: Number(stats.dodge || 0) + Number(e.dodge || 0),
    control: Number(stats.control || 0) + Number(e.control || 0)
  };
}

module.exports = {
  nameOf,
  roleOf,
  elementOf,
  getAccuratePassive,
  passiveOf,
  profileOf,
  applyPassiveStats
};
`;

const battlePolish = `// VoidRoll Reborn — Clean Battle Polish System
// Safe launch version compatible with index.js.
// No broken syntax, no generic DPS Mastery text for main event characters.

const combatProfiles = require('./characterCombatProfileSystem');

function roleOf(c = {}) {
  return combatProfiles.roleOf(c);
}

function elementOf(c = {}) {
  return combatProfiles.elementOf(c);
}

function passiveOf(c = {}) {
  return combatProfiles.passiveOf(c);
}

function combatLine(c = {}) {
  const role = roleOf(c);
  const element = elementOf(c);
  const passive = passiveOf(c);
  return [
    'Role: **' + role + '**',
    'Element: **' + element + '**',
    'Passive: **' + passive.name + '** — ' + passive.text
  ].join('\\n');
}

async function handleBattlePolishCommand(i, prisma) {
  const name = i.options?.getString?.('name') || i.options?.getString?.('character') || '';
  if (!name) {
    return i.reply({
      content: 'اكتب اسم الشخصية. مثال: /battle-profile name:Corrupted Aizen',
      ephemeral: true
    });
  }

  const c = await prisma.character.findFirst({
    where: {
      name: { contains: name },
      active: true
    },
    orderBy: { basePower: 'desc' }
  }).catch(() => null);

  if (!c) {
    return i.reply({
      content: 'ما حصلت الشخصية.',
      ephemeral: true
    });
  }

  return i.reply({
    content:
      '**' + c.name + '**\\n' +
      'Rarity: **' + c.rarity + '**\\n' +
      'Power: **' + Number(c.basePower || 0).toLocaleString('en-US') + '**\\n' +
      combatLine(c)
  });
}

function commandDefinitions() {
  return [
    {
      name: 'battle-profile',
      description: 'Show character combat role, element, and passive',
      type: 1,
      options: [
        {
          name: 'name',
          description: 'Character name',
          type: 3,
          required: true
        }
      ]
    }
  ];
}

module.exports = {
  roleOf,
  elementOf,
  passiveOf,
  combatLine,
  handleBattlePolishCommand,
  commandDefinitions
};
`;

function main() {
  console.log('=== Safe overwrite combat systems ===');

  const profilePath = path.join(ROOT, 'src', 'systems', 'characterCombatProfileSystem.js');
  const polishPath = path.join(ROOT, 'src', 'systems', 'battlePolishSystem.js');

  backup(profilePath);
  backup(polishPath);

  fs.writeFileSync(profilePath, profileSystem, 'utf8');
  fs.writeFileSync(polishPath, battlePolish, 'utf8');

  console.log('✅ Wrote clean src/systems/characterCombatProfileSystem.js');
  console.log('✅ Wrote clean src/systems/battlePolishSystem.js');

  console.log('\\nNext:');
  console.log('node --check src/systems/battlePolishSystem.js');
  console.log('node --check src/systems/characterCombatProfileSystem.js');
  console.log('node --check src/index.js');
  console.log('npm start');
}

main();
