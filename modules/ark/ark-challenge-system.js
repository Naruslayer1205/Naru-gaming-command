const fs = require('fs');
const path = require('path');

const {
  getChallengesByDifficulty,
  getChallengeById
} = require('./ark-challenges');

const DATA_DIR =
  path.join(
    __dirname,
    'data'
  );

const DATA_FILE =
  path.join(
    DATA_DIR,
    'ark-challenges-data.json'
  );

const LEADERBOARD_CHANNEL_ID =
  '1547279360657195018';

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

// ─────────────────────────────────────
// DOSSIER / FICHIER
// ─────────────────────────────────────

function ensureDataFile() {
  if (
    !fs.existsSync(
      DATA_DIR
    )
  ) {
    fs.mkdirSync(
      DATA_DIR,
      {
        recursive: true
      }
    );
  }

  if (
    !fs.existsSync(
      DATA_FILE
    )
  ) {
    saveData({
      leaderboardMessageId:
        null,

      players:
        {},

      history:
        {}
    });
  }
}

function loadData() {
  ensureDataFile();

  try {
    const data =
      JSON.parse(
        fs.readFileSync(
          DATA_FILE,
          'utf8'
        )
      );

    data.players ??=
      {};

    data.history ??=
      {};

    data.leaderboardMessageId ??=
      null;

    return data;

  } catch {
    return {
      leaderboardMessageId:
        null,

      players:
        {},

      history:
        {}
    };
  }
}

function saveData(
  data
) {
  if (
    !fs.existsSync(
      DATA_DIR
    )
  ) {
    fs.mkdirSync(
      DATA_DIR,
      {
        recursive: true
      }
    );
  }

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

function getParisParts(
  date = new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        timeZone:
          'Europe/Paris',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit'
      }
    );

  const parts =
    formatter.formatToParts(
      date
    );

  const result = {};

  for (
    const part
    of parts
  ) {
    if (
      part.type !==
      'literal'
    ) {
      result[
        part.type
      ] =
        part.value;
    }
  }

  return result;
}

function getParisDateKey(
  date = new Date()
) {
  const parts =
    getParisParts(
      date
    );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getParisMonthKey(
  date = new Date()
) {
  const parts =
    getParisParts(
      date
    );

  return `${parts.year}-${parts.month}`;
}

// ─────────────────────────────────────
// CHOIX ALÉATOIRE
// ─────────────────────────────────────

function randomChallenge(
  difficulty,
  previousId = null
) {
  const available =
    getChallengesByDifficulty(
      difficulty
    );

  if (!available.length) {
    return null;
  }

  let candidates =
    available.filter(
      challenge =>
        challenge.id !==
        previousId
    );

  if (!candidates.length) {
    candidates =
      available;
  }

  return candidates[
    Math.floor(
      Math.random() *
      candidates.length
    )
  ];
}

// ─────────────────────────────────────
// JOUEUR
// ─────────────────────────────────────

function createPlayer(
  userId,
  displayName
) {
  return {
    userId,

    displayName,

    month:
      getParisMonthKey(),

    monthPoints:
      0,

    completed: {
      easy:
        0,

      medium:
        0,

      hard:
        0
    },

    currentDate:
      null,

    daily:
      [],

    previous: {
      easy:
        null,

      medium:
        null,

      hard:
        null
    },

    lastUpdatedAt:
      null
  };
}

function archiveMonth(
  data,
  player
) {
  if (
    !player.month
  ) {
    return;
  }

  data.history[
    player.month
  ] ??=
    {};

  data.history[
    player.month
  ][
    player.userId
  ] = {
    displayName:
      player.displayName,

    points:
      player.monthPoints,

    completed:
      {
        ...player.completed
      }
  };
}

function resetMonthIfNeeded(
  data,
  player
) {
  const currentMonth =
    getParisMonthKey();

  if (
    player.month ===
    currentMonth
  ) {
    return;
  }

  archiveMonth(
    data,
    player
  );

  player.month =
    currentMonth;

  player.monthPoints =
    0;

  player.completed = {
    easy:
      0,

    medium:
      0,

    hard:
      0
  };

  player.currentDate =
    null;

  player.daily =
    [];

  player.previous ??= {
    easy:
      null,

    medium:
      null,

    hard:
      null
  };
}

function assignDailyChallenges(
  player
) {
  const today =
    getParisDateKey();

  if (
    player.currentDate ===
      today &&
    Array.isArray(
      player.daily
    ) &&
    player.daily.length ===
      3
  ) {
    return false;
  }

  const easy =
    randomChallenge(
      'easy',
      player.previous?.easy
    );

  const medium =
    randomChallenge(
      'medium',
      player.previous?.medium
    );

  const hard =
    randomChallenge(
      'hard',
      player.previous?.hard
    );

  player.currentDate =
    today;

  player.daily =
    [
      easy,
      medium,
      hard
    ]
      .filter(
        Boolean
      )
      .map(
        challenge => ({
          challengeId:
            challenge.id,

          completed:
            false,

          rewarded:
            false,

          completedAt:
            null
        })
      );

  player.previous = {
    easy:
      easy?.id ??
      null,

    medium:
      medium?.id ??
      null,

    hard:
      hard?.id ??
      null
  };

  return true;
}

function ensurePlayer(
  data,
  member
) {
  let player =
    data.players[
      member.id
    ];

  if (!player) {
    player =
      createPlayer(
        member.id,
        member.displayName
      );

    data.players[
      member.id
    ] =
      player;
  }

  player.userId =
    member.id;

  player.displayName =
    member.displayName;

  player.completed ??= {
    easy:
      0,

    medium:
      0,

    hard:
      0
  };

  player.previous ??= {
    easy:
      null,

    medium:
      null,

    hard:
      null
  };

  player.daily ??=
    [];

  player.monthPoints =
    Number(
      player.monthPoints
    ) || 0;

  resetMonthIfNeeded(
    data,
    player
  );

  assignDailyChallenges(
    player
  );

  return player;
}

// ─────────────────────────────────────
// PROGRESSION
// ─────────────────────────────────────

function getMetric(
  metrics,
  metricName
) {
  const value =
    Number(
      metrics?.[
        metricName
      ]
    );

  return Number.isFinite(
    value
  )
    ? value
    : 0;
}

function challengeProgress(
  challenge,
  metrics
) {
  const current =
    getMetric(
      metrics,
      challenge.metric
    );

  return {
    current,

    target:
      challenge.target,

    completed:
      current >=
      challenge.target
  };
}

function processChallenges(
  player,
  metrics
) {
  let changed =
    false;

  const newlyCompleted =
    [];

  for (
    const item
    of player.daily
  ) {
    const challenge =
      getChallengeById(
        item.challengeId
      );

    if (!challenge) {
      continue;
    }

    const progress =
      challengeProgress(
        challenge,
        metrics
      );

    if (
      progress.completed &&
      !item.completed
    ) {
      item.completed =
        true;

      item.completedAt =
        new Date()
          .toISOString();

      changed =
        true;
    }

    if (
      progress.completed &&
      !item.rewarded
    ) {
      item.rewarded =
        true;

      player.monthPoints +=
        challenge.points;

      if (
        challenge.difficulty ===
        'easy'
      ) {
        player.completed.easy +=
          1;
      }

      if (
        challenge.difficulty ===
        'medium'
      ) {
        player.completed.medium +=
          1;
      }

      if (
        challenge.difficulty ===
        'hard'
      ) {
        player.completed.hard +=
          1;
      }

      newlyCompleted.push(
        challenge
      );

      changed =
        true;
    }
  }

  player.lastUpdatedAt =
    new Date()
      .toISOString();

  return {
    changed,
    newlyCompleted
  };
}

// ─────────────────────────────────────
// AFFICHAGE PROGRESSION
// ─────────────────────────────────────

function formatNumber(
  input
) {
  const value =
    Number(
      input
    );

  if (
    !Number.isFinite(
      value
    )
  ) {
    return '0';
  }

  return value.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        2
    }
  );
}

function formatProgress(
  challenge,
  metrics
) {
  const progress =
    challengeProgress(
      challenge,
      metrics
    );

  let current =
    progress.current;

  let target =
    progress.target;

  if (
    challenge.metric ===
    'distanceMeters'
  ) {
    current =
      current /
      1000;

    target =
      target /
      1000;

    return `${formatNumber(current)} / ${formatNumber(target)} km`;
  }

  if (
    challenge.metric ===
    'highestImprintPercent'
  ) {
    return `${formatNumber(current)} / ${formatNumber(target)} %`;
  }

  return `${formatNumber(
    Math.min(
      current,
      target
    )
  )} / ${formatNumber(target)}`;
}

function getDifficultyName(
  difficulty
) {
  switch (
    difficulty
  ) {
    case 'easy':
      return 'Facile';

    case 'medium':
      return 'Moyen';

    case 'hard':
      return 'Difficile';

    default:
      return difficulty;
  }
}

// ─────────────────────────────────────
// MESSAGE DÉFIS
// ─────────────────────────────────────

function buildChallengeMessage(
  player,
  metrics
) {
  const lines = [
    '# 🎯 Défis ARK',
    '',
    `📅 **Défis du ${player.currentDate}**`,
    `🏆 **Points ce mois : ${player.monthPoints} / 186 max théorique**`,
    '',
    'Chaque jour : **1 facile + 1 moyen + 1 difficile**',
    'Maximum journalier : **6 points**',
    ''
  ];

  for (
    const item
    of player.daily
  ) {
    const challenge =
      getChallengeById(
        item.challengeId
      );

    if (!challenge) {
      continue;
    }

    lines.push(
      `## ${challenge.emoji} ${getDifficultyName(challenge.difficulty)} — ${challenge.title}`
    );

    lines.push(
      challenge.description
    );

    lines.push('');

    lines.push(
      `🎯 **Progression :** ${formatProgress(challenge, metrics)}`
    );

    lines.push(
      `⭐ **Récompense :** ${challenge.points} point${challenge.points > 1 ? 's' : ''}`
    );

    if (
      item.completed
    ) {
      lines.push(
        '✅ **Défi terminé**'
      );
    } else {
      lines.push(
        '⏳ **En cours**'
      );
    }

    lines.push('');
  }

  lines.push(
    `📊 **Faciles terminés ce mois :** ${player.completed.easy}`
  );

  lines.push(
    `📊 **Moyens terminés ce mois :** ${player.completed.medium}`
  );

  lines.push(
    `📊 **Difficiles terminés ce mois :** ${player.completed.hard}`
  );

  lines.push('');

  lines.push(
    '🔄 Progression mise à jour automatiquement par **Naru ARK Bridge**.'
  );

  return lines.join(
    '\n'
  );
}

// ─────────────────────────────────────
// MESSAGE UNIQUE DU SALON DÉFIS
// ─────────────────────────────────────

async function upsertChallengeMessage(
  client,
  channel,
  content
) {
  let existing =
    null;

  try {
    const messages =
      await channel.messages.fetch({
        limit:
          20
      });

    existing =
      messages.find(
        message =>
          message.author.id ===
            client.user.id &&
          message.content.includes(
            '# 🎯 Défis ARK'
          )
      );

  } catch {
    existing =
      null;
  }

  if (existing) {
    await existing.edit(
      content
    );

    return existing;
  }

  return await channel.send(
    content
  );
}

// ─────────────────────────────────────
// CLASSEMENT
// ─────────────────────────────────────

function sortLeaderboard(
  entries
) {
  return entries.sort(
    (a, b) => {
      if (
        b.player.monthPoints !==
        a.player.monthPoints
      ) {
        return (
          b.player.monthPoints -
          a.player.monthPoints
        );
      }

      if (
        b.player.completed.hard !==
        a.player.completed.hard
      ) {
        return (
          b.player.completed.hard -
          a.player.completed.hard
        );
      }

      if (
        b.player.completed.medium !==
        a.player.completed.medium
      ) {
        return (
          b.player.completed.medium -
          a.player.completed.medium
        );
      }

      return (
        b.player.completed.easy -
        a.player.completed.easy
      );
    }
  );
}

async function buildLeaderboardMessage(
  client,
  data
) {
  const currentMonth =
    getParisMonthKey();

  const entries =
    [];

  for (
    const [
      userId,
      player
    ]
    of Object.entries(
      data.players
    )
  ) {
    if (
      player.month !==
      currentMonth
    ) {
      continue;
    }

    let memberFound =
      false;

    for (
      const guild
      of client.guilds.cache.values()
    ) {
      try {
        const member =
          await guild.members.fetch(
            userId
          );

        if (
          member &&
          !member.user.bot &&
          (
            !ARK_ROLE_ID ||
            member.roles.cache.has(
              ARK_ROLE_ID
            )
          )
        ) {
          entries.push({
            userId,
            player,
            member
          });

          memberFound =
            true;

          break;
        }

      } catch {
        // membre absent de ce serveur
      }
    }

    if (!memberFound) {
      continue;
    }
  }

  sortLeaderboard(
    entries
  );

  const lines = [
    '# 🏆 Classement ARK',
    '',
    `📅 **Classement mensuel — ${currentMonth}**`,
    '',
    'Les points sont gagnés grâce aux défis quotidiens.',
    ''
  ];

  if (!entries.length) {
    lines.push(
      'Aucun joueur classé pour le moment.'
    );

    return lines.join(
      '\n'
    );
  }

  entries.forEach(
    (
      entry,
      index
    ) => {
      let rank =
        `**${index + 1}.**`;

      if (
        index === 0
      ) {
        rank =
          '🥇';
      }

      if (
        index === 1
      ) {
        rank =
          '🥈';
      }

      if (
        index === 2
      ) {
        rank =
          '🥉';
      }

      lines.push(
        `${rank} ${entry.member} — **${entry.player.monthPoints} pts**`
      );

      lines.push(
        `└ 🟢 ${entry.player.completed.easy} • 🟠 ${entry.player.completed.medium} • 🔴 ${entry.player.completed.hard}`
      );

      lines.push('');
    }
  );

  lines.push(
    '🔄 **Reset automatique le 1er de chaque mois à 00:00 — heure de Paris.**'
  );

  return lines.join(
    '\n'
  );
}

async function updateLeaderboard(
  client,
  data = null
) {
  try {
    const challengeData =
      data ||
      loadData();

    const channel =
      await client.channels.fetch(
        LEADERBOARD_CHANNEL_ID
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      console.error(
        `❌ Salon classement ARK inaccessible : ${LEADERBOARD_CHANNEL_ID}`
      );

      return;
    }

    const content =
      await buildLeaderboardMessage(
        client,
        challengeData
      );

    let message =
      null;

    if (
      challengeData
        .leaderboardMessageId
    ) {
      try {
        message =
          await channel.messages.fetch(
            challengeData
              .leaderboardMessageId
          );

      } catch {
        message =
          null;
      }
    }

    if (!message) {
      try {
        const messages =
          await channel.messages.fetch({
            limit:
              50
          });

        message =
          messages.find(
            candidate =>
              candidate.author.id ===
                client.user.id &&
              candidate.content.includes(
                '# 🏆 Classement ARK'
              )
          );

      } catch {
        message =
          null;
      }
    }

    if (message) {
      await message.edit(
        content
      );

      challengeData
        .leaderboardMessageId =
        message.id;

    } else {
      const created =
        await channel.send(
          content
        );

      challengeData
        .leaderboardMessageId =
        created.id;
    }

    saveData(
      challengeData
    );

  } catch (error) {
    console.error(
      '❌ Erreur classement ARK :',
      error
    );
  }
}

// ─────────────────────────────────────
// UPDATE JOUEUR
// ─────────────────────────────────────

async function updateChallengeChannel(
  client,
  member,
  category,
  metrics
) {
  try {
    const channel =
      member.guild
        .channels
        .cache
        .find(
          item =>
            item.parentId ===
              category.id &&
            item.name ===
              '🎯・défis'
        );

    if (!channel) {
      console.log(
        `⚠️ Salon défis absent pour ${member.user.tag}`
      );

      return;
    }

    const data =
      loadData();

    const player =
      ensurePlayer(
        data,
        member
      );

    const result =
      processChallenges(
        player,
        metrics ||
          {}
      );

    saveData(
      data
    );

    const content =
      buildChallengeMessage(
        player,
        metrics ||
          {}
      );

    await upsertChallengeMessage(
      client,
      channel,
      content
    );

    if (
      result
        .newlyCompleted
        .length
    ) {
      for (
        const challenge
        of result.newlyCompleted
      ) {
        console.log(
          `🎯 Défi ARK terminé par ${member.user.tag} : ${challenge.title} (+${challenge.points})`
        );
      }
    }

    await updateLeaderboard(
      client,
      data
    );

  } catch (error) {
    console.error(
      `❌ Erreur défis ARK pour ${member.user.tag} :`,
      error
    );
  }
}


// ─────────────────────────────────────
// DÉMARRAGE AUTOMATIQUE
// ─────────────────────────────────────

function startArkChallengeSystem(
  client
) {
  if (
    client.__arkChallengeSystemStarted
  ) {
    return;
  }

  client.__arkChallengeSystemStarted =
    true;

  console.log(
    '🎯 Système de défis ARK démarré'
  );

  setTimeout(
    async () => {
      try {
        await updateLeaderboard(
          client
        );
      } catch (error) {
        console.error(
          '❌ Erreur initialisation classement ARK :',
          error
        );
      }
    },
    5000
  );

  const interval =
    setInterval(
      async () => {
        try {
          const data =
            loadData();

          let changed =
            false;

          for (
            const player
            of Object.values(
              data.players
            )
          ) {
            const previousMonth =
              player.month;

            resetMonthIfNeeded(
              data,
              player
            );

            if (
              previousMonth !==
              player.month
            ) {
              changed =
                true;
            }
          }

          if (changed) {
            saveData(
              data
            );

            await updateLeaderboard(
              client,
              data
            );
          }

        } catch (error) {
          console.error(
            '❌ Erreur timer défis ARK :',
            error
          );
        }
      },
      60 * 1000
    );

  if (
    typeof interval.unref ===
    'function'
  ) {
    interval.unref();
  }
}

module.exports = {
  startArkChallengeSystem,
  updateChallengeChannel,
  updateLeaderboard
};
