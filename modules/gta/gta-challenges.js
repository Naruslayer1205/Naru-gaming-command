const {
  ChannelType
} = require('discord.js');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────

const GTA_ROLE_ID =
  '1546760047105806366';

const LEADERBOARD_CHANNEL_ID =
  '1547259267512279081';

const CHALLENGE_CHANNEL_NAME =
  '🎯・défis';

const TIME_ZONE =
  'Europe/Paris';

const DATA_FOLDER =
  path.join(
    __dirname,
    '../../data'
  );

const DATA_FILE =
  path.join(
    DATA_FOLDER,
    'gta-challenges.json'
  );

const POINTS = {
  easy: 1,
  medium: 2,
  hard: 3
};

// ─────────────────────────────────────
// 30 DÉFIS — 10 PAR DIFFICULTÉ
// ─────────────────────────────────────

const CHALLENGES = [
  // FACILE
  {
    id: 'E01',
    difficulty: 'easy',
    name: 'Petit coup de gaz',
    description: 'Atteindre **120 km/h**.',
    metric: 'maxSpeedKmh',
    target: 120,
    unit: 'speed'
  },
  {
    id: 'E02',
    difficulty: 'easy',
    name: 'Petite virée',
    description: 'Parcourir **5 km**.',
    metric: 'distanceMeters',
    target: 5000,
    unit: 'distance'
  },
  {
    id: 'E03',
    difficulty: 'easy',
    name: 'À pied',
    description: 'Parcourir **1 km à pied**.',
    metric: 'footDistanceMeters',
    target: 1000,
    unit: 'distance'
  },
  {
    id: 'E04',
    difficulty: 'easy',
    name: 'Change de caisse',
    description: 'Utiliser **2 véhicules différents**.',
    metric: 'uniqueVehicles',
    target: 2,
    unit: 'count'
  },
  {
    id: 'E05',
    difficulty: 'easy',
    name: 'Touriste',
    description: 'Visiter **3 zones différentes**.',
    metric: 'uniqueZones',
    target: 3,
    unit: 'count'
  },
  {
    id: 'E06',
    difficulty: 'easy',
    name: 'Petite session',
    description: 'Jouer pendant **15 minutes**.',
    metric: 'playSeconds',
    target: 15 * 60,
    unit: 'time'
  },
  {
    id: 'E07',
    difficulty: 'easy',
    name: 'Biker du jour',
    description: 'Parcourir **3 km à moto**.',
    metric: 'motorcycleDistanceMeters',
    target: 3000,
    unit: 'distance'
  },
  {
    id: 'E08',
    difficulty: 'easy',
    name: 'Décollage vertical',
    description: 'Piloter **un hélicoptère**.',
    metric: 'usedHelicopter',
    target: 1,
    unit: 'boolean'
  },
  {
    id: 'E09',
    difficulty: 'easy',
    name: 'Prêt au décollage',
    description: 'Piloter **un avion**.',
    metric: 'usedPlane',
    target: 1,
    unit: 'boolean'
  },
  {
    id: 'E10',
    difficulty: 'easy',
    name: 'Petit arsenal',
    description: 'Utiliser **2 armes différentes**.',
    metric: 'uniqueWeapons',
    target: 2,
    unit: 'count'
  },

  // MOYEN
  {
    id: 'M01',
    difficulty: 'medium',
    name: 'Ça commence à pousser',
    description: 'Atteindre **180 km/h**.',
    metric: 'maxSpeedKmh',
    target: 180,
    unit: 'speed'
  },
  {
    id: 'M02',
    difficulty: 'medium',
    name: 'Road trip',
    description: 'Parcourir **20 km**.',
    metric: 'distanceMeters',
    target: 20000,
    unit: 'distance'
  },
  {
    id: 'M03',
    difficulty: 'medium',
    name: 'Collectionneur',
    description: 'Utiliser **5 véhicules différents**.',
    metric: 'uniqueVehicles',
    target: 5,
    unit: 'count'
  },
  {
    id: 'M04',
    difficulty: 'medium',
    name: 'Explorateur',
    description: 'Visiter **7 zones différentes**.',
    metric: 'uniqueZones',
    target: 7,
    unit: 'count'
  },
  {
    id: 'M05',
    difficulty: 'medium',
    name: 'Ça chauffe',
    description: 'Atteindre **3 étoiles de recherche**.',
    metric: 'maxWantedLevel',
    target: 3,
    unit: 'wanted'
  },
  {
    id: 'M06',
    difficulty: 'medium',
    name: 'Fugitif',
    description: 'Échapper à la police après avoir atteint **au moins 3 étoiles**.',
    metric: 'escapedWanted3',
    target: 1,
    unit: 'boolean'
  },
  {
    id: 'M07',
    difficulty: 'medium',
    name: 'Dans le viseur',
    description: 'Cumuler **5 minutes recherché**.',
    metric: 'wantedSeconds',
    target: 5 * 60,
    unit: 'time'
  },
  {
    id: 'M08',
    difficulty: 'medium',
    name: 'Longue route en deux roues',
    description: 'Parcourir **10 km à moto**.',
    metric: 'motorcycleDistanceMeters',
    target: 10000,
    unit: 'distance'
  },
  {
    id: 'M09',
    difficulty: 'medium',
    name: 'Capitaine',
    description: 'Parcourir **5 km en bateau**.',
    metric: 'boatDistanceMeters',
    target: 5000,
    unit: 'distance'
  },
  {
    id: 'M10',
    difficulty: 'medium',
    name: 'Arsenal varié',
    description: 'Utiliser **4 armes différentes**.',
    metric: 'uniqueWeapons',
    target: 4,
    unit: 'count'
  },

  // DIFFICILE
  {
    id: 'H01',
    difficulty: 'hard',
    name: 'Pied au plancher',
    description: 'Atteindre **250 km/h**.',
    metric: 'maxSpeedKmh',
    target: 250,
    unit: 'speed'
  },
  {
    id: 'H02',
    difficulty: 'hard',
    name: 'Marathon routier',
    description: 'Parcourir **50 km**.',
    metric: 'distanceMeters',
    target: 50000,
    unit: 'distance'
  },
  {
    id: 'H03',
    difficulty: 'hard',
    name: 'Ennemi public',
    description: 'Atteindre **5 étoiles de recherche**.',
    metric: 'maxWantedLevel',
    target: 5,
    unit: 'wanted'
  },
  {
    id: 'H04',
    difficulty: 'hard',
    name: 'Introuvable',
    description: 'Échapper à la police après avoir atteint **5 étoiles**.',
    metric: 'escapedWanted5',
    target: 1,
    unit: 'boolean'
  },
  {
    id: 'H05',
    difficulty: 'hard',
    name: 'Survivant',
    description: 'Jouer **45 minutes sans mourir**.',
    metric: 'survivalSeconds',
    target: 45 * 60,
    unit: 'time'
  },
  {
    id: 'H06',
    difficulty: 'hard',
    name: 'Garage complet',
    description: 'Utiliser **10 véhicules différents**.',
    metric: 'uniqueVehicles',
    target: 10,
    unit: 'count'
  },
  {
    id: 'H07',
    difficulty: 'hard',
    name: 'Grand explorateur',
    description: 'Visiter **15 zones différentes**.',
    metric: 'uniqueZones',
    target: 15,
    unit: 'count'
  },
  {
    id: 'H08',
    difficulty: 'hard',
    name: 'Ride longue distance',
    description: 'Parcourir **25 km à moto**.',
    metric: 'motorcycleDistanceMeters',
    target: 25000,
    unit: 'distance'
  },
  {
    id: 'H09',
    difficulty: 'hard',
    name: 'Touche-à-tout',
    description: 'Utiliser **4 classes de véhicules différentes**.',
    metric: 'uniqueVehicleClasses',
    target: 4,
    unit: 'count'
  },
  {
    id: 'H10',
    difficulty: 'hard',
    name: 'Toujours recherché',
    description: 'Cumuler **15 minutes recherché**.',
    metric: 'wantedSeconds',
    target: 15 * 60,
    unit: 'time'
  }
];

const CHALLENGE_BY_ID =
  new Map(
    CHALLENGES.map(
      challenge => [
        challenge.id,
        challenge
      ]
    )
  );

const DIFFICULTY_META = {
  easy: {
    emoji: '🟢',
    label: 'Facile',
    points: POINTS.easy
  },
  medium: {
    emoji: '🟠',
    label: 'Moyen',
    points: POINTS.medium
  },
  hard: {
    emoji: '🔴',
    label: 'Difficile',
    points: POINTS.hard
  }
};

// ─────────────────────────────────────
// DONNÉES
// ─────────────────────────────────────

function ensureDataFile() {
  if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(
      DATA_FOLDER,
      { recursive: true }
    );
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          version: 1,
          leaderboardMessageId: null,
          users: {}
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

function loadChallengeData() {
  ensureDataFile();

  try {
    const data = JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        'utf8'
      )
    );

    if (!data.users) {
      data.users = {};
    }

    return data;
  } catch (error) {
    console.error(
      '❌ Impossible de lire gta-challenges.json :',
      error
    );

    return {
      version: 1,
      leaderboardMessageId: null,
      users: {}
    };
  }
}

function saveChallengeData(data) {
  ensureDataFile();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

// ─────────────────────────────────────
// DATE PARIS
// ─────────────────────────────────────

function getParisParts(date = new Date()) {
  const formatter =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    );

  const parts = {};

  for (
    const item
    of formatter.formatToParts(date)
  ) {
    if (
      item.type === 'year' ||
      item.type === 'month' ||
      item.type === 'day'
    ) {
      parts[item.type] = item.value;
    }
  }

  return {
    dateKey:
      `${parts.year}-${parts.month}-${parts.day}`,
    monthKey:
      `${parts.year}-${parts.month}`,
    year:
      Number(parts.year),
    month:
      Number(parts.month),
    day:
      Number(parts.day)
  };
}

function monthLabel(monthKey) {
  const [year, month] =
    monthKey
      .split('-')
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        1
      )
    );

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }
  ).format(date);
}

// ─────────────────────────────────────
// ÉTAT JOUEUR
// ─────────────────────────────────────

function createEmptyMetrics() {
  return {
    distanceMeters: 0,
    footDistanceMeters: 0,
    motorcycleDistanceMeters: 0,
    boatDistanceMeters: 0,
    maxSpeedKmh: 0,
    maxWantedLevel: 0,
    escapedWanted3: 0,
    escapedWanted5: 0,
    wantedSeconds: 0,
    playSeconds: 0,
    survivalSeconds: 0,
    vehicles: [],
    zones: [],
    weapons: [],
    vehicleClasses: [],
    usedHelicopter: false,
    usedPlane: false,
    lastSessionDurationSeconds: null,
    lastSessionDistanceMeters: null,
    lastSessionDeaths: null,
    lastWantedLevel: null,
    wantedPeakCurrentPursuit: 0
  };
}

function createMonthlyState(monthKey) {
  return {
    month: monthKey,
    easy: 0,
    medium: 0,
    hard: 0,
    points: 0
  };
}

function ensureUserState(
  data,
  userId
) {
  const now =
    getParisParts();

  if (!data.users[userId]) {
    data.users[userId] = {
      daily: null,
      monthly:
        createMonthlyState(
          now.monthKey
        ),
      lifetime: {
        easy: 0,
        medium: 0,
        hard: 0,
        points: 0
      }
    };
  }

  const user =
    data.users[userId];

  if (
    !user.monthly ||
    user.monthly.month !==
      now.monthKey
  ) {
    user.monthly =
      createMonthlyState(
        now.monthKey
      );
  }

  if (!user.lifetime) {
    user.lifetime = {
      easy: 0,
      medium: 0,
      hard: 0,
      points: 0
    };
  }

  return user;
}

function chooseRandomChallenge(
  difficulty,
  previousId
) {
  let pool =
    CHALLENGES.filter(
      challenge =>
        challenge.difficulty ===
          difficulty
    );

  if (
    previousId &&
    pool.length > 1
  ) {
    const withoutPrevious =
      pool.filter(
        challenge =>
          challenge.id !==
            previousId
      );

    if (withoutPrevious.length) {
      pool = withoutPrevious;
    }
  }

  return pool[
    crypto.randomInt(
      0,
      pool.length
    )
  ];
}

function ensureDailyChallenges(
  data,
  userId
) {
  const user =
    ensureUserState(
      data,
      userId
    );

  const now =
    getParisParts();

  if (
    user.daily &&
    user.daily.date ===
      now.dateKey
  ) {
    if (!user.daily.metrics) {
      user.daily.metrics =
        createEmptyMetrics();
    }

    if (!user.daily.completed) {
      user.daily.completed = {};
    }

    return {
      user,
      changed: false
    };
  }

  const previousIds =
    user.daily &&
    Array.isArray(
      user.daily.challengeIds
    )
      ? user.daily.challengeIds
      : [];

  const easy =
    chooseRandomChallenge(
      'easy',
      previousIds.find(
        id => id.startsWith('E')
      )
    );

  const medium =
    chooseRandomChallenge(
      'medium',
      previousIds.find(
        id => id.startsWith('M')
      )
    );

  const hard =
    chooseRandomChallenge(
      'hard',
      previousIds.find(
        id => id.startsWith('H')
      )
    );

  user.daily = {
    date: now.dateKey,
    challengeIds: [
      easy.id,
      medium.id,
      hard.id
    ],
    completed: {},
    metrics:
      createEmptyMetrics(),
    challengeMessageId:
      user.daily?.challengeMessageId ||
      null
  };

  return {
    user,
    changed: true
  };
}

// ─────────────────────────────────────
// MÉTRIQUES
// ─────────────────────────────────────

function safeNumber(
  value,
  fallback = 0
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function pushUnique(
  array,
  value
) {
  if (
    !value ||
    value === 'Non disponible' ||
    value === 'Aucune'
  ) {
    return;
  }

  const normalized =
    String(value).trim();

  if (
    normalized &&
    !array.includes(
      normalized
    )
  ) {
    array.push(
      normalized
    );
  }
}

function sessionDelta(
  current,
  previous
) {
  if (!Number.isFinite(current)) {
    return 0;
  }

  if (!Number.isFinite(previous)) {
    return 0;
  }

  if (current >= previous) {
    return Math.max(
      0,
      current - previous
    );
  }

  // Nouvelle session GTA.
  return Math.max(
    0,
    current
  );
}

function getVehicleClassNumber(
  vehicle
) {
  const parsed =
    Number(
      vehicle?.class
    );

  return Number.isFinite(parsed)
    ? parsed
    : -1;
}

function updateMetrics(
  metrics,
  state
) {
  const session =
    state.session || {};

  const vehicle =
    state.vehicle || {};

  const player =
    state.player || {};

  const weapon =
    state.weapon || {};

  const position =
    state.position || {};

  const currentDuration =
    safeNumber(
      session.durationSeconds,
      NaN
    );

  const currentDistance =
    safeNumber(
      session.distanceMeters,
      NaN
    );

  const currentDeaths =
    safeNumber(
      session.deaths,
      NaN
    );

  const durationDelta =
    sessionDelta(
      currentDuration,
      safeNumber(
        metrics.lastSessionDurationSeconds,
        NaN
      )
    );

  const distanceDelta =
    sessionDelta(
      currentDistance,
      safeNumber(
        metrics.lastSessionDistanceMeters,
        NaN
      )
    );

  let deathsDelta = 0;

  if (
    Number.isFinite(
      currentDeaths
    ) &&
    Number.isFinite(
      safeNumber(
        metrics.lastSessionDeaths,
        NaN
      )
    )
  ) {
    const previousDeaths =
      Number(
        metrics.lastSessionDeaths
      );

    deathsDelta =
      currentDeaths >= previousDeaths
        ? currentDeaths - previousDeaths
        : currentDeaths;
  }

  metrics.playSeconds +=
    durationDelta;

  metrics.distanceMeters +=
    distanceDelta;

  if (
    deathsDelta > 0 ||
    player.isDead === true
  ) {
    metrics.survivalSeconds = 0;
  } else {
    metrics.survivalSeconds +=
      durationDelta;
  }

  const vehicleClass =
    getVehicleClassNumber(
      vehicle
    );

  if (
    vehicle.inVehicle
  ) {
    const vehicleKey =
      `${vehicle.model || 'unknown'}|${vehicle.plate || ''}`;

    pushUnique(
      metrics.vehicles,
      vehicleKey
    );

    if (vehicleClass >= 0) {
      pushUnique(
        metrics.vehicleClasses,
        String(vehicleClass)
      );
    }

    if (vehicleClass === 8) {
      metrics.motorcycleDistanceMeters +=
        distanceDelta;
    }

    if (vehicleClass === 14) {
      metrics.boatDistanceMeters +=
        distanceDelta;
    }

    if (vehicleClass === 15) {
      metrics.usedHelicopter = true;
    }

    if (vehicleClass === 16) {
      metrics.usedPlane = true;
    }

    metrics.maxSpeedKmh =
      Math.max(
        metrics.maxSpeedKmh,
        safeNumber(
          vehicle.speedKmh
        )
      );
  } else {
    metrics.footDistanceMeters +=
      distanceDelta;
  }

  pushUnique(
    metrics.zones,
    position.zone ||
      position.area
  );

  const weaponName =
    weapon.name ||
    weapon.label;

  if (
    weaponName &&
    !String(weaponName)
      .toLowerCase()
      .includes('unarmed')
  ) {
    pushUnique(
      metrics.weapons,
      weaponName
    );
  }

  const wantedRaw =
    player.wantedLevel;

  const hasWantedLevel =
    wantedRaw !== undefined &&
    wantedRaw !== null &&
    Number.isFinite(
      Number(wantedRaw)
    );

  if (hasWantedLevel) {
    const wantedLevel =
      Math.max(
        0,
        Math.min(
          5,
          Number(wantedRaw)
        )
      );

    metrics.maxWantedLevel =
      Math.max(
        metrics.maxWantedLevel,
        wantedLevel
      );

    if (wantedLevel > 0) {
      metrics.wantedSeconds +=
        durationDelta;

      metrics.wantedPeakCurrentPursuit =
        Math.max(
          metrics.wantedPeakCurrentPursuit,
          wantedLevel
        );
    }

    if (
      Number.isFinite(
        Number(
          metrics.lastWantedLevel
        )
      ) &&
      Number(
        metrics.lastWantedLevel
      ) > 0 &&
      wantedLevel === 0
    ) {
      if (
        metrics.wantedPeakCurrentPursuit >=
          3
      ) {
        metrics.escapedWanted3 += 1;
      }

      if (
        metrics.wantedPeakCurrentPursuit >=
          5
      ) {
        metrics.escapedWanted5 += 1;
      }

      metrics.wantedPeakCurrentPursuit = 0;
    }

    metrics.lastWantedLevel =
      wantedLevel;
  }

  if (Number.isFinite(currentDuration)) {
    metrics.lastSessionDurationSeconds =
      currentDuration;
  }

  if (Number.isFinite(currentDistance)) {
    metrics.lastSessionDistanceMeters =
      currentDistance;
  }

  if (Number.isFinite(currentDeaths)) {
    metrics.lastSessionDeaths =
      currentDeaths;
  }
}

function metricValue(
  challenge,
  metrics
) {
  switch (challenge.metric) {
    case 'uniqueVehicles':
      return metrics.vehicles.length;

    case 'uniqueZones':
      return metrics.zones.length;

    case 'uniqueWeapons':
      return metrics.weapons.length;

    case 'uniqueVehicleClasses':
      return metrics.vehicleClasses.length;

    case 'usedHelicopter':
      return metrics.usedHelicopter
        ? 1
        : 0;

    case 'usedPlane':
      return metrics.usedPlane
        ? 1
        : 0;

    default:
      return safeNumber(
        metrics[challenge.metric]
      );
  }
}

function isChallengeComplete(
  challenge,
  metrics
) {
  return metricValue(
    challenge,
    metrics
  ) >= challenge.target;
}

// ─────────────────────────────────────
// AFFICHAGE
// ─────────────────────────────────────

function formatSeconds(seconds) {
  const total =
    Math.max(
      0,
      Math.floor(
        safeNumber(seconds)
      )
    );

  const minutes =
    Math.floor(
      total / 60
    );

  const remaining =
    total % 60;

  if (minutes >= 60) {
    const hours =
      Math.floor(
        minutes / 60
      );

    const mins =
      minutes % 60;

    return `${hours} h ${mins} min`;
  }

  return `${minutes} min ${remaining} s`;
}

function formatProgress(
  challenge,
  metrics
) {
  const current =
    Math.min(
      metricValue(
        challenge,
        metrics
      ),
      challenge.target
    );

  switch (challenge.unit) {
    case 'distance':
      return `${(current / 1000).toFixed(1)} / ${(challenge.target / 1000).toFixed(1)} km`;

    case 'speed':
      return `${Math.round(current)} / ${challenge.target} km/h`;

    case 'time':
      return `${formatSeconds(current)} / ${formatSeconds(challenge.target)}`;

    case 'wanted':
      return `${Math.round(current)} / ${challenge.target} étoile(s)`;

    case 'boolean':
      return current >= challenge.target
        ? 'Terminé'
        : 'Non terminé';

    default:
      return `${Math.floor(current)} / ${challenge.target}`;
  }
}

function buildChallengeMessage(
  member,
  daily
) {
  const lines = [
    '# 🎯 Défis GTA V du jour',
    '',
    `**Joueur :** ${member}`,
    '',
    'Chaque jour : **1 facile + 1 moyen + 1 difficile**.',
    '🟢 Facile = **1 pt** • 🟠 Moyen = **2 pts** • 🔴 Difficile = **3 pts**',
    ''
  ];

  let completedCount = 0;
  let pointsToday = 0;

  for (
    const challengeId
    of daily.challengeIds
  ) {
    const challenge =
      CHALLENGE_BY_ID.get(
        challengeId
      );

    if (!challenge) {
      continue;
    }

    const meta =
      DIFFICULTY_META[
        challenge.difficulty
      ];

    const completed =
      Boolean(
        daily.completed[
          challenge.id
        ]
      );

    if (completed) {
      completedCount += 1;
      pointsToday +=
        meta.points;
    }

    lines.push(
      `${meta.emoji} **${meta.label} — ${challenge.name}**`,
      challenge.description,
      completed
        ? `✅ **Terminé — +${meta.points} pt${meta.points > 1 ? 's' : ''}**`
        : `📈 Progression : **${formatProgress(challenge, daily.metrics)}**`,
      ''
    );
  }

  lines.push(
    `🏆 **Aujourd'hui : ${completedCount}/3 défis • ${pointsToday}/6 points**`,
    '',
    '🔄 Nouveaux défis chaque jour à **00h00 (heure de Paris)**.'
  );

  return lines.join('\n');
}

function findChallengeChannel(
  guild,
  category
) {
  return guild.channels.cache.find(
    channel =>
      channel.type ===
        ChannelType.GuildText &&
      channel.parentId ===
        category.id &&
      channel.name ===
        CHALLENGE_CHANNEL_NAME
  );
}

async function upsertChallengeMessage(
  client,
  member,
  category,
  daily,
  force = false
) {
  const channel =
    findChallengeChannel(
      member.guild,
      category
    );

  if (!channel) {
    return;
  }

  if (!client.gtaChallenges) {
    client.gtaChallenges = {
      renders: new Map()
    };
  }

  const content =
    buildChallengeMessage(
      member,
      daily
    );

  const renderState =
    client.gtaChallenges
      .renders
      .get(member.id);

  const now =
    Date.now();

  if (
    !force &&
    renderState &&
    now - renderState.at < 30000
  ) {
    return;
  }

  let message = null;

  if (daily.challengeMessageId) {
    try {
      message =
        await channel.messages.fetch(
          daily.challengeMessageId
        );
    } catch {
      message = null;
    }
  }

  if (!message) {
    try {
      const recent =
        await channel.messages.fetch({
          limit: 20
        });

      message =
        recent.find(
          item =>
            item.author.id ===
              client.user.id &&
            item.content.startsWith(
              '# 🎯 Défis GTA V du jour'
            )
        ) || null;
    } catch {
      message = null;
    }
  }

  if (message) {
    if (
      force ||
      message.content !== content
    ) {
      await message.edit(
        content
      );
    }
  } else {
    message =
      await channel.send(
        content
      );
  }

  daily.challengeMessageId =
    message.id;

  client.gtaChallenges
    .renders
    .set(
      member.id,
      {
        at: now,
        content
      }
    );
}

function buildLeaderboardContent(
  rows,
  monthKey
) {
  const lines = [
    `# 🏆 Classement Défis GTA V — ${monthLabel(monthKey)}`,
    '',
    'Classement mensuel des membres possédant le rôle **GTA V**.',
    '',
    '🟢 **Facile = 1 pt** • 🟠 **Moyen = 2 pts** • 🔴 **Difficile = 3 pts**',
    ''
  ];

  if (!rows.length) {
    lines.push(
      '*Aucun défi terminé pour le moment.*'
    );
  } else {
    const medals = [
      '🥇',
      '🥈',
      '🥉'
    ];

    for (
      let index = 0;
      index < rows.length;
      index++
    ) {
      const row = rows[index];

      const prefix =
        medals[index] ||
        `**${index + 1}.**`;

      const block = [
        `${prefix} **${row.name} — ${row.points} pts**`,
        `🟢 ${row.easy} facile(s) • 🟠 ${row.medium} moyen(s) • 🔴 ${row.hard} difficile(s)`,
        ''
      ];

      if (
        [...lines, ...block]
          .join('\n')
          .length > 1850
      ) {
        lines.push(
          '*Classement tronqué pour respecter la limite Discord.*'
        );
        break;
      }

      lines.push(
        ...block
      );
    }
  }

  lines.push(
    '',
    '🔄 **Reset automatique le 1er de chaque mois à 00h00 (heure de Paris).**'
  );

  return lines.join('\n');
}

async function getLeaderboardRows(
  client,
  data
) {
  const now =
    getParisParts();

  const rows = [];

  for (
    const guild
    of client.guilds.cache.values()
  ) {
    const members =
      guild.members.cache.filter(
        member =>
          !member.user.bot &&
          member.roles.cache.has(
            GTA_ROLE_ID
          )
      );

    for (
      const member
      of members.values()
    ) {
      const user =
        ensureUserState(
          data,
          member.id
        );

      const monthly =
        user.monthly.month ===
          now.monthKey
          ? user.monthly
          : createMonthlyState(
              now.monthKey
            );

      rows.push({
        userId: member.id,
        name: member.displayName,
        easy:
          safeNumber(
            monthly.easy
          ),
        medium:
          safeNumber(
            monthly.medium
          ),
        hard:
          safeNumber(
            monthly.hard
          ),
        points:
          safeNumber(
            monthly.points
          )
      });
    }
  }

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      (
        b.easy +
        b.medium +
        b.hard
      ) -
      (
        a.easy +
        a.medium +
        a.hard
      ) ||
      a.name.localeCompare(
        b.name,
        'fr'
      )
  );

  return rows;
}

async function updateLeaderboard(
  client,
  data = null
) {
  try {
    const workingData =
      data ||
      loadChallengeData();

    let channel =
      client.channels.cache.get(
        LEADERBOARD_CHANNEL_ID
      );

    if (!channel) {
      try {
        channel =
          await client.channels.fetch(
            LEADERBOARD_CHANNEL_ID
          );
      } catch {
        channel = null;
      }
    }

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      console.error(
        `❌ Salon classement GTA introuvable : ${LEADERBOARD_CHANNEL_ID}`
      );
      return;
    }

    const now =
      getParisParts();

    const rows =
      await getLeaderboardRows(
        client,
        workingData
      );

    const content =
      buildLeaderboardContent(
        rows,
        now.monthKey
      );

    let message = null;

    if (
      workingData.leaderboardMessageId
    ) {
      try {
        message =
          await channel.messages.fetch(
            workingData.leaderboardMessageId
          );
      } catch {
        message = null;
      }
    }

    if (!message) {
      try {
        const recent =
          await channel.messages.fetch({
            limit: 20
          });

        message =
          recent.find(
            item =>
              item.author.id ===
                client.user.id &&
              item.content.startsWith(
                '# 🏆 Classement Défis GTA V'
              )
          ) || null;
      } catch {
        message = null;
      }
    }

    if (message) {
      if (
        message.content !==
          content
      ) {
        await message.edit(
          content
        );
      }
    } else {
      message =
        await channel.send(
          content
        );
    }

    workingData.leaderboardMessageId =
      message.id;

    saveChallengeData(
      workingData
    );
  } catch (error) {
    console.error(
      '❌ Erreur mise à jour classement GTA :',
      error
    );
  }
}

// ─────────────────────────────────────
// TRAITEMENT TÉLÉMÉTRIE
// ─────────────────────────────────────

async function processGtaChallengeTelemetry(
  client,
  member,
  category,
  state
) {
  const data =
    loadChallengeData();

  const {
    user,
    changed: newDay
  } =
    ensureDailyChallenges(
      data,
      member.id
    );

  const daily =
    user.daily;

  updateMetrics(
    daily.metrics,
    state
  );

  const newlyCompleted = [];

  for (
    const challengeId
    of daily.challengeIds
  ) {
    if (
      daily.completed[
        challengeId
      ]
    ) {
      continue;
    }

    const challenge =
      CHALLENGE_BY_ID.get(
        challengeId
      );

    if (
      !challenge ||
      !isChallengeComplete(
        challenge,
        daily.metrics
      )
    ) {
      continue;
    }

    const meta =
      DIFFICULTY_META[
        challenge.difficulty
      ];

    daily.completed[
      challenge.id
    ] = {
      completedAt:
        new Date()
          .toISOString(),
      points:
        meta.points
    };

    user.monthly[
      challenge.difficulty
    ] += 1;

    user.monthly.points +=
      meta.points;

    user.lifetime[
      challenge.difficulty
    ] += 1;

    user.lifetime.points +=
      meta.points;

    newlyCompleted.push(
      challenge
    );
  }

  saveChallengeData(
    data
  );

  await upsertChallengeMessage(
    client,
    member,
    category,
    daily,
    newDay ||
      newlyCompleted.length > 0
  );

  if (newlyCompleted.length) {
    const channel =
      findChallengeChannel(
        member.guild,
        category
      );

    if (channel) {
      for (
        const challenge
        of newlyCompleted
      ) {
        const meta =
          DIFFICULTY_META[
            challenge.difficulty
          ];

        await channel.send(
          [
            '## ✅ Défi terminé !',
            '',
            `${meta.emoji} **${challenge.name}**`,
            `${challenge.description}`,
            '',
            `🏆 **+${meta.points} point${meta.points > 1 ? 's' : ''}** au classement mensuel.`
          ].join('\n')
        );
      }
    }

    await updateLeaderboard(
      client,
      data
    );
  }
}

// ─────────────────────────────────────
// SYNCHRONISATION QUOTIDIENNE / MENSUELLE
// ─────────────────────────────────────

async function syncChallenges(
  client,
  forceLeaderboard = false
) {
  const data =
    loadChallengeData();

  let changed = false;

  for (
    const guild
    of client.guilds.cache.values()
  ) {
    const members =
      guild.members.cache.filter(
        member =>
          !member.user.bot &&
          member.roles.cache.has(
            GTA_ROLE_ID
          )
      );

    for (
      const member
      of members.values()
    ) {
      const result =
        ensureDailyChallenges(
          data,
          member.id
        );

      changed =
        changed ||
        result.changed;

      const category =
        guild.channels.cache.find(
          channel =>
            channel.type ===
              ChannelType.GuildCategory &&
            channel.permissionOverwrites.cache.has(
              member.id
            ) &&
            channel.name.startsWith(
              '🚘 GTA V — '
            )
        );

      if (category) {
        await upsertChallengeMessage(
          client,
          member,
          category,
          result.user.daily,
          result.changed
        );
      }
    }
  }

  if (changed) {
    saveChallengeData(
      data
    );
  }

  if (
    changed ||
    forceLeaderboard
  ) {
    await updateLeaderboard(
      client,
      data
    );
  }
}

function startGtaChallenges(
  client
) {
  console.log(
    '🎯 GTA V Challenges : module chargé'
  );

  ensureDataFile();

  if (!client.gtaChallenges) {
    client.gtaChallenges = {
      renders: new Map()
    };
  }

  setTimeout(
    () => {
      syncChallenges(
        client,
        true
      );
    },
    8000
  );

  setTimeout(
    () => {
      syncChallenges(
        client,
        true
      );
    },
    20000
  );

  // Vérifie le changement de jour/mois toutes les minutes.
  setInterval(
    () => {
      syncChallenges(
        client,
        false
      );
    },
    60 * 1000
  );

  // Rafraîchissement de sécurité du classement toutes les 10 minutes.
  setInterval(
    () => {
      updateLeaderboard(
        client
      );
    },
    10 * 60 * 1000
  );
}

module.exports = {
  startGtaChallenges,
  processGtaChallengeTelemetry,
  updateLeaderboard,
  CHALLENGES
};
