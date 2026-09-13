const {
  EmbedBuilder,
  ChannelType
} = require('discord.js');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============================================================
// NARU GAMING COMMAND
// ACOLONY BRIDGE
// Liaison Discord <-> installation PC
// ============================================================

const ACOLONY_ROLE_ID =
  process.env.ACOLONY_ROLE_ID ||
  '1548387660517609572';

const CATEGORY_PREFIX =
  '🏭 AColony — ';

const CHANNEL_NAMES = {
  colonists:
    '👥・colons',

  connection:
    '🔗・connexion'
};

// ============================================================
// FICHIERS
// ============================================================

const DATA_FOLDER =
  path.join(
    __dirname,
    '../../data'
  );

const DATA_FILE =
  path.join(
    DATA_FOLDER,
    'acolony-links.json'
  );

// ============================================================
// ÉTAT
// ============================================================

let discordClient = null;

let scanInterval = null;

const playerStates =
  new Map();

// ============================================================
// FICHIER DE DONNÉES
// ============================================================

function ensureDataFile() {
  if (
    !fs.existsSync(
      DATA_FOLDER
    )
  ) {
    fs.mkdirSync(
      DATA_FOLDER,
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
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      'utf8'
    );
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

    if (
      !data.users ||
      typeof data.users !==
        'object'
    ) {
      data.users = {};
    }

    return data;

  } catch (
    error
  ) {
    console.error(
      '❌ AColony : lecture acolony-links.json impossible :',
      error
    );

    return {
      users: {}
    };
  }
}

function saveData(
  data
) {
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

// ============================================================
// OUTILS CRYPTO
// ============================================================

function randomBlock(
  length = 4
) {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let result =
    '';

  for (
    let i = 0;
    i < length;
    i++
  ) {
    result +=
      chars[
        crypto.randomInt(
          0,
          chars.length
        )
      ];
  }

  return result;
}

function generateLinkCode() {
  return (
    'ACOL-' +
    randomBlock(4) +
    '-' +
    randomBlock(4)
  );
}

function generateToken() {
  return crypto
    .randomBytes(32)
    .toString('hex');
}

function hashToken(
  token
) {
  return crypto
    .createHash('sha256')
    .update(
      String(token)
    )
    .digest('hex');
}

// ============================================================
// UTILISATEUR
// ============================================================

function getUserData(
  userId
) {
  const data =
    loadData();

  return (
    data.users[
      String(userId)
    ] ||
    null
  );
}

function ensureUserData(
  member
) {
  const data =
    loadData();

  const userId =
    String(
      member.id
    );

  let changed =
    false;

  if (
    !data.users[userId]
  ) {
    data.users[userId] = {
      discordUserId:
        userId,

      linkCode:
        generateLinkCode(),

      linked:
        false,

      installationId:
        null,

      tokenHash:
        null,

      linkedAt:
        null,

      lastSeenAt:
        null,

      createdAt:
        new Date()
          .toISOString()
    };

    changed =
      true;
  }

  if (
    !data.users[userId]
      .linkCode
  ) {
    data.users[userId]
      .linkCode =
        generateLinkCode();

    changed =
      true;
  }

  if (
    changed
  ) {
    saveData(
      data
    );
  }

  return data.users[
    userId
  ];
}

// ============================================================
// RECHERCHE PAR CODE
// ============================================================

function findUserByCode(
  code
) {
  const normalized =
    String(
      code || ''
    )
      .trim()
      .toUpperCase();

  const data =
    loadData();

  for (
    const [
      userId,
      user
    ]
    of Object.entries(
      data.users
    )
  ) {
    if (
      String(
        user.linkCode || ''
      )
        .toUpperCase() ===
      normalized
    ) {
      return {
        data,
        userId,
        user
      };
    }
  }

  return null;
}

// ============================================================
// AUTHENTIFICATION INSTALLATION
// ============================================================

function authenticateInstallation(
  request
) {
  const installationId =
    String(
      request.headers[
        'x-acolony-installation-id'
      ] || ''
    ).trim();

  const authorization =
    String(
      request.headers
        .authorization || ''
    );

  const match =
    /^Bearer\s+(.+)$/i.exec(
      authorization
    );

  if (
    !installationId ||
    !match
  ) {
    return null;
  }

  const token =
    match[1].trim();

  const tokenHash =
    hashToken(
      token
    );

  const data =
    loadData();

  for (
    const [
      userId,
      user
    ]
    of Object.entries(
      data.users
    )
  ) {
    if (
      !user.linked ||
      !user.installationId ||
      !user.tokenHash
    ) {
      continue;
    }

    if (
      user.installationId !==
        installationId
    ) {
      continue;
    }

    if (
      user.tokenHash !==
        tokenHash
    ) {
      continue;
    }

    return {
      data,
      userId,
      user
    };
  }

  return null;
}

// ============================================================
// HTTP
// ============================================================

function sendJson(
  response,
  status,
  data
) {
  if (
    response.headersSent
  ) {
    return;
  }

  const payload =
    JSON.stringify(
      data
    );

  response.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(
          payload
        ),

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        [
          'Content-Type',
          'Authorization',
          'X-AColony-Installation-Id'
        ].join(', '),

      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    }
  );

  response.end(
    payload
  );
}

function readJsonBody(
  request
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let body =
        '';

      let size =
        0;

      let finished =
        false;

      request.on(
        'data',
        chunk => {
          if (
            finished
          ) {
            return;
          }

          size +=
            chunk.length;

          if (
            size >
            5 * 1024 * 1024
          ) {
            finished =
              true;

            reject(
              new Error(
                'Payload trop volumineux'
              )
            );

            return;
          }

          body +=
            chunk.toString(
              'utf8'
            );
        }
      );

      request.on(
        'end',
        () => {
          if (
            finished
          ) {
            return;
          }

          finished =
            true;

          if (
            !body.trim()
          ) {
            resolve(
              {}
            );

            return;
          }

          try {
            resolve(
              JSON.parse(
                body
              )
            );

          } catch {
            reject(
              new Error(
                'JSON invalide'
              )
            );
          }
        }
      );

      request.on(
        'error',
        error => {
          if (
            finished
          ) {
            return;
          }

          finished =
            true;

          reject(
            error
          );
        }
      );
    }
  );
}

// ============================================================
// MEMBRE DISCORD
// ============================================================

async function findDiscordMember(
  userId
) {
  if (
    !discordClient
  ) {
    return null;
  }

  for (
    const guild
    of discordClient
      .guilds
      .cache
      .values()
  ) {
    try {
      const member =
        await guild.members.fetch(
          userId
        );

      if (
        member
      ) {
        return {
          guild,
          member
        };
      }

    } catch {
      // absent du serveur
    }
  }

  return null;
}

// ============================================================
// CATÉGORIE PERSONNELLE
// ============================================================

function findAColonyCategory(
  guild,
  member
) {
  const categories =
    guild.channels.cache.filter(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        channel.name.startsWith(
          CATEGORY_PREFIX
        )
    );

  const byPermission =
    categories.find(
      category =>
        category
          .permissionOverwrites
          .cache
          .has(
            member.id
          )
    );

  if (
    byPermission
  ) {
    return byPermission;
  }

  const displayName =
    member.displayName
      .toLowerCase();

  return (
    categories.find(
      category =>
        category.name
          .toLowerCase()
          .includes(
            displayName
          )
    ) ||
    null
  );
}

// ============================================================
// SALON
// ============================================================

function findChannel(
  guild,
  category,
  name
) {
  return (
    guild.channels.cache.find(
      channel =>
        channel.parentId ===
          category.id &&
        channel.name ===
          name
    ) ||
    null
  );
}

// ============================================================
// PANNEAU DE LIAISON
// ============================================================

async function findLinkMessage(
  channel
) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 50
      });

    return (
      messages.find(
        message =>
          message.author.id ===
            channel.client.user.id &&
          message.embeds?.[0]
            ?.footer
            ?.text ===
            'Naru AColony Bridge • Liaison'
      ) ||
      null
    );

  } catch {
    return null;
  }
}

async function updateLinkPanel(
  member,
  category
) {
  const channel =
    findChannel(
      member.guild,
      category,
      CHANNEL_NAMES.connection
    );

  if (
    !channel
  ) {
    return;
  }

  const user =
    ensureUserData(
      member
    );

  const embed =
    new EmbedBuilder()
      .setTitle(
        '🔗 Liaison AColony'
      )
      .setColor(
        user.linked
          ? 0x57F287
          : 0xFEE75C
      )
      .setDescription(
        [
          `Bienvenue <@${member.id}>.`,
          '',
          'Ce code permet de relier **ton installation AColony** à ton espace Discord personnel.',
          '',
          '### 🔑 Ton code personnel',
          `\`${user.linkCode}\``,
          '',
          user.linked
            ? '🟢 **Statut : LIÉ**'
            : '🟠 **Statut : EN ATTENTE DE LIAISON**',
          '',
          user.linked
            ? (
                `💻 Installation : \`${user.installationId || '?'}\`\n` +
                `🕒 Dernière connexion : ${
                  user.lastSeenAt
                    ? `<t:${Math.floor(
                        new Date(
                          user.lastSeenAt
                        ).getTime() /
                        1000
                      )}:R>`
                    : 'En attente'
                }`
              )
            : (
                '1. Installe le **Naru AColony Bridge** sur ton PC.\n' +
                '2. Lance-le.\n' +
                '3. Entre le code affiché ci-dessus.\n' +
                '4. La liaison se fera automatiquement.'
              ),
          '',
          '⚠️ **Ne partage pas ce code.** Il donne accès à la liaison de ton espace AColony.'
        ].join(
          '\n'
        )
      )
      .setFooter({
        text:
          'Naru AColony Bridge • Liaison'
      })
      .setTimestamp();

  const oldMessage =
    await findLinkMessage(
      channel
    );

  if (
    oldMessage
  ) {
    await oldMessage.edit({
      content:
        null,

      embeds:
        [
          embed
        ]
    });

  } else {
    await channel.send({
      embeds:
        [
          embed
        ]
    });
  }
}

// ============================================================
// SYNCHRO PANNEAUX DE LIAISON
// ============================================================

async function syncLinkPanels() {
  if (
    !discordClient
  ) {
    return;
  }

  for (
    const guild
    of discordClient
      .guilds
      .cache
      .values()
  ) {
    let members;

    try {
      members =
        await guild.members.fetch();

    } catch (
      error
    ) {
      console.error(
        '❌ AColony : récupération membres impossible :',
        error.message
      );

      continue;
    }

    for (
      const member
      of members.values()
    ) {
      if (
        member.user.bot
      ) {
        continue;
      }

      if (
        !member.roles.cache.has(
          ACOLONY_ROLE_ID
        )
      ) {
        continue;
      }

      const category =
        findAColonyCategory(
          guild,
          member
        );

      if (
        !category
      ) {
        continue;
      }

      try {
        await updateLinkPanel(
          member,
          category
        );

      } catch (
        error
      ) {
        console.error(
          `❌ AColony : panneau liaison ${member.user.tag} :`,
          error.message
        );
      }
    }
  }
}

// ============================================================
// FORMAT
// ============================================================

function number(
  value,
  fallback = 0
) {
  return (
    typeof value ===
      'number'
      ? value
      : fallback
  );
}

function formatPercent(
  value
) {
  if (
    typeof value !==
      'number'
  ) {
    return '?';
  }

  return (
    `${Math.round(
      value
    )}%`
  );
}

function healthEmoji(
  value
) {
  if (
    typeof value !==
      'number'
  ) {
    return '❔';
  }

  if (
    value >= 75
  ) {
    return '💚';
  }

  if (
    value >= 40
  ) {
    return '💛';
  }

  return '❤️‍🩹';
}

function moodEmoji(
  value
) {
  if (
    typeof value !==
      'number'
  ) {
    return '❔';
  }

  if (
    value >= 75
  ) {
    return '😄';
  }

  if (
    value >= 50
  ) {
    return '🙂';
  }

  if (
    value >= 25
  ) {
    return '😕';
  }

  return '😫';
}

function talentStars(
  value
) {
  const amount =
    Math.max(
      0,
      Math.min(
        5,
        Number(value) || 0
      )
    );

  if (
    amount === 0
  ) {
    return '';
  }

  return (
    ' ' +
    '⭐'.repeat(
      amount
    )
  );
}

// ============================================================
// COMPÉTENCES
// ============================================================

function buildSkillsText(
  colonist
) {
  const skills =
    Array.isArray(
      colonist.skills
    )
      ? colonist.skills
      : [];

  if (
    skills.length === 0
  ) {
    return 'Aucune donnée.';
  }

  return [...skills]
    .sort(
      (a, b) =>
        number(
          b.level
        ) -
        number(
          a.level
        )
    )
    .map(
      skill =>
        `**${skill.name || 'Inconnue'}** — Niv. ${number(skill.level)}${talentStars(skill.talent)}`
    )
    .join('\n')
    .slice(
      0,
      1024
    );
}

// ============================================================
// TRAITS
// ============================================================

function buildTraitsText(
  colonist
) {
  const traits =
    Array.isArray(
      colonist.traits
    )
      ? colonist.traits
      : [];

  if (
    traits.length === 0
  ) {
    return 'Aucun trait.';
  }

  return traits
    .map(
      trait => {
        if (
          typeof trait ===
          'string'
        ) {
          return (
            `• ${trait}`
          );
        }

        return (
          `• ${
            trait.name ||
            `Trait ${trait.id ?? '?'}`
          }`
        );
      }
    )
    .join('\n')
    .slice(
      0,
      1024
    );
}

// ============================================================
// JOBS
// ============================================================

function buildJobsText(
  colonist
) {
  const jobs =
    Array.isArray(
      colonist.jobs
    )
      ? colonist.jobs
      : [];

  const important =
    jobs
      .filter(
        job =>
          number(
            job.priority
          ) > 1 ||
          number(
            job.talent
          ) > 0
      )
      .sort(
        (a, b) => {
          const diff =
            number(
              b.priority
            ) -
            number(
              a.priority
            );

          if (
            diff !== 0
          ) {
            return diff;
          }

          return (
            number(
              b.talent
            ) -
            number(
              a.talent
            )
          );
        }
      );

  if (
    important.length === 0
  ) {
    return (
      'Aucune spécialisation particulière.'
    );
  }

  return important
    .map(
      job =>
        `• **${job.name || 'Travail'}** — Priorité ${number(job.priority)}${talentStars(job.talent)}`
    )
    .join('\n')
    .slice(
      0,
      1024
    );
}

// ============================================================
// RELATIONS
// ============================================================

function buildRelationsText(
  colonist
) {
  const relations =
    Array.isArray(
      colonist.relations
    )
      ? colonist.relations
      : [];

  if (
    relations.length === 0
  ) {
    return 'Aucune donnée.';
  }

  return relations
    .map(
      relation => {
        const special =
          number(
            relation.special
          );

        const temporary =
          number(
            relation.temporary
          );

        let details =
          `${special} spéciale(s)`;

        if (
          temporary > 0
        ) {
          details +=
            ` • ${temporary} temporaire(s)`;
        }

        return (
          `• **${relation.name || 'Inconnu'}** — ${details}`
        );
      }
    )
    .join('\n')
    .slice(
      0,
      1024
    );
}

// ============================================================
// EMBED COLON
// ============================================================

function createColonistEmbed(
  colonist,
  state
) {
  const health =
    number(
      colonist.health
    );

  const maxHealth =
    number(
      colonist.maxHealth
    );

  const healthPercent =
    typeof colonist.healthPercent ===
      'number'
      ? colonist.healthPercent
      : (
          maxHealth > 0
            ? (
                health /
                maxHealth
              ) * 100
            : null
        );

  const injuries =
    number(
      colonist.injuries
    );

  const diseases =
    number(
      colonist.diseases
    );

  const poisonings =
    number(
      colonist.poisonings
    );

  const danger =
    injuries > 0 ||
    diseases > 0 ||
    poisonings > 0 ||
    colonist.breakdown ===
      true;

  const embed =
    new EmbedBuilder()
      .setTitle(
        `👤 ${colonist.name || 'Colon inconnu'}`
      )
      .setColor(
        danger
          ? 0xED4245
          : 0x57F287
      )
      .setDescription(
        [
          `🆔 **ID :** ${colonist.id ?? '?'}`,
          `🎂 **Âge :** ${colonist.age ?? '?'} ans`,
          `🚻 **Sexe :** ${colonist.gender || 'Inconnu'}`
        ].join(
          '\n'
        )
      )
      .addFields(
        {
          name:
            '❤️ État',

          value:
            [
              `${healthEmoji(healthPercent)} **Santé :** ${health} / ${maxHealth} (${formatPercent(healthPercent)})`,

              `${moodEmoji(colonist.mood)} **Humeur :** ${
                typeof colonist.mood ===
                  'number'
                  ? Math.round(
                      colonist.mood *
                      10
                    ) / 10
                  : '?'
              }`,

              `🍖 **Nourriture :** ${formatPercent(colonist.foodPercent)}`,

              `😴 **Sommeil :** ${formatPercent(colonist.sleepPercent)}`
            ].join(
              '\n'
            )
        },

        {
          name:
            '🩺 Santé détaillée',

          value:
            [
              `🩸 Blessures : **${injuries}**`,
              `🦠 Maladies : **${diseases}**`,
              `☠️ Empoisonnements : **${poisonings}**`,
              `🧠 Crise mentale : **${
                colonist.breakdown
                  ? '⚠️ Oui'
                  : '✅ Non'
              }**`
            ].join(
              '\n'
            )
        },

        {
          name:
            '📚 Compétences',

          value:
            buildSkillsText(
              colonist
            )
        },

        {
          name:
            '🧬 Traits',

          value:
            buildTraitsText(
              colonist
            ),

          inline:
            true
        },

        {
          name:
            '🛠️ Spécialisations',

          value:
            buildJobsText(
              colonist
            ),

          inline:
            true
        },

        {
          name:
            '🤝 Relations',

          value:
            buildRelationsText(
              colonist
            )
        }
      )
      .setFooter({
        text:
          `AColony • Colon ID ${colonist.id ?? '?'}`
      })
      .setTimestamp();

  if (
    state.world
  ) {
    embed.setAuthor({
      name:
        `${state.colonyName || 'Colonie'} • ${state.world}`
    });
  }

  return embed;
}

// ============================================================
// MESSAGES COLONS EXISTANTS
// ============================================================

async function getExistingColonistMessages(
  channel
) {
  const map =
    new Map();

  try {
    const messages =
      await channel.messages.fetch({
        limit: 100
      });

    for (
      const message
      of messages.values()
    ) {
      if (
        message.author.id !==
        channel.client.user.id
      ) {
        continue;
      }

      const footer =
        message.embeds?.[0]
          ?.footer
          ?.text;

      if (
        !footer
      ) {
        continue;
      }

      const match =
        /^AColony • Colon ID (.+)$/.exec(
          footer
        );

      if (
        !match
      ) {
        continue;
      }

      map.set(
        String(
          match[1]
        ),
        message
      );
    }

  } catch (
    error
  ) {
    console.error(
      '❌ AColony : lecture fiches colons impossible :',
      error.message
    );
  }

  return map;
}

// ============================================================
// MAJ SALON COLONS
// ============================================================

async function updateColonistsChannel(
  channel,
  state
) {
  const colonists =
    Array.isArray(
      state.colonists
    )
      ? state.colonists
      : [];

  const existing =
    await getExistingColonistMessages(
      channel
    );

  const activeIds =
    new Set();

  for (
    const colonist
    of colonists
  ) {
    const colonistId =
      String(
        colonist.id ??
        colonist.name
      );

    activeIds.add(
      colonistId
    );

    const embed =
      createColonistEmbed(
        colonist,
        state
      );

    const oldMessage =
      existing.get(
        colonistId
      );

    if (
      oldMessage
    ) {
      await oldMessage.edit({
        content:
          null,

        embeds:
          [
            embed
          ]
      });

    } else {
      await channel.send({
        embeds:
          [
            embed
          ]
      });
    }
  }

  for (
    const [
      colonistId,
      message
    ]
    of existing.entries()
  ) {
    if (
      activeIds.has(
        colonistId
      )
    ) {
      continue;
    }

    try {
      await message.delete();

    } catch {
      // rien
    }
  }
}

// ============================================================
// ROUTE LINK
// ============================================================

async function handleLink(
  request,
  response
) {
  let body;

  try {
    body =
      await readJsonBody(
        request
      );

  } catch (
    error
  ) {
    return sendJson(
      response,
      400,
      {
        ok:
          false,

        error:
          error.message
      }
    );
  }

  const code =
    String(
      body.code || ''
    )
      .trim()
      .toUpperCase();

  const installationId =
    String(
      body.installationId || ''
    )
      .trim();

  if (
    !code
  ) {
    return sendJson(
      response,
      400,
      {
        ok:
          false,

        error:
          'Code AColony manquant'
      }
    );
  }

  if (
    !installationId
  ) {
    return sendJson(
      response,
      400,
      {
        ok:
          false,

        error:
          'installationId manquant'
      }
    );
  }

  const found =
    findUserByCode(
      code
    );

  if (
    !found
  ) {
    return sendJson(
      response,
      404,
      {
        ok:
          false,

        error:
          'Code AColony invalide'
      }
    );
  }

  const discordFound =
    await findDiscordMember(
      found.userId
    );

  if (
    !discordFound
  ) {
    return sendJson(
      response,
      404,
      {
        ok:
          false,

        error:
          'Compte Discord introuvable'
      }
    );
  }

  const {
    member
  } =
    discordFound;

  if (
    !member.roles.cache.has(
      ACOLONY_ROLE_ID
    )
  ) {
    return sendJson(
      response,
      403,
      {
        ok:
          false,

        error:
          'Rôle AColony manquant'
      }
    );
  }

  const token =
    generateToken();

  found.user.linked =
    true;

  found.user.installationId =
    installationId;

  found.user.tokenHash =
    hashToken(
      token
    );

  found.user.linkedAt =
    new Date()
      .toISOString();

  found.user.lastSeenAt =
    found.user.linkedAt;

  found.data.users[
    found.userId
  ] =
    found.user;

  saveData(
    found.data
  );

  const category =
    findAColonyCategory(
      member.guild,
      member
    );

  if (
    category
  ) {
    try {
      await updateLinkPanel(
        member,
        category
      );

    } catch (
      error
    ) {
      console.error(
        '⚠️ AColony : panneau liaison non actualisé :',
        error.message
      );
    }
  }

  console.log(
    `🔗 AColony lié : ${member.user.tag} → ${installationId}`
  );

  return sendJson(
    response,
    200,
    {
      ok:
        true,

      linked:
        true,

      token,

      discordUserId:
        member.id,

      message:
        'Installation AColony liée avec succès'
    }
  );
}

// ============================================================
// ROUTE UPDATE
// ============================================================

async function handleUpdate(
  request,
  response
) {
  const auth =
    authenticateInstallation(
      request
    );

  if (
    !auth
  ) {
    return sendJson(
      response,
      401,
      {
        ok:
          false,

        error:
          'Installation AColony non authentifiée'
      }
    );
  }

  let body;

  try {
    body =
      await readJsonBody(
        request
      );

  } catch (
    error
  ) {
    return sendJson(
      response,
      400,
      {
        ok:
          false,

        error:
          error.message
      }
    );
  }

  if (
    !Array.isArray(
      body.colonists
    )
  ) {
    return sendJson(
      response,
      400,
      {
        ok:
          false,

        error:
          'colonists manquant'
      }
    );
  }

  const found =
    await findDiscordMember(
      auth.userId
    );

  if (
    !found
  ) {
    return sendJson(
      response,
      404,
      {
        ok:
          false,

        error:
          'Membre Discord introuvable'
      }
    );
  }

  const {
    guild,
    member
  } =
    found;

  if (
    !member.roles.cache.has(
      ACOLONY_ROLE_ID
    )
  ) {
    return sendJson(
      response,
      403,
      {
        ok:
          false,

        error:
          'Rôle AColony manquant'
      }
    );
  }

  const category =
    findAColonyCategory(
      guild,
      member
    );

  if (
    !category
  ) {
    return sendJson(
      response,
      404,
      {
        ok:
          false,

        error:
          'Catégorie personnelle AColony introuvable'
      }
    );
  }

  const colonistsChannel =
    findChannel(
      guild,
      category,
      CHANNEL_NAMES.colonists
    );

  if (
    !colonistsChannel
  ) {
    return sendJson(
      response,
      404,
      {
        ok:
          false,

        error:
          'Salon 👥・colons introuvable'
      }
    );
  }

  const state = {
    discordUserId:
      member.id,

    installationId:
      auth.user.installationId,

    receivedAt:
      new Date()
        .toISOString(),

    saveName:
      body.saveName ||
      null,

    colonyName:
      body.colonyName ||
      null,

    world:
      body.world ||
      null,

    version:
      body.version ||
      null,

    saveDate:
      body.saveDate ||
      null,

    playTime:
      body.playTime ||
      null,

    sciences:
      body.sciences ??
      null,

    mapSize:
      body.mapSize ??
      null,

    colonists:
      body.colonists
  };

  playerStates.set(
    member.id,
    state
  );

  if (
    discordClient
      ?.acolonyBridge
  ) {
    discordClient
      .acolonyBridge
      .players
      .set(
        member.id,
        state
      );
  }

  await updateColonistsChannel(
    colonistsChannel,
    state
  );

  const data =
    loadData();

  if (
    data.users[
      member.id
    ]
  ) {
    data.users[
      member.id
    ].lastSeenAt =
      new Date()
        .toISOString();

    saveData(
      data
    );
  }

  console.log('');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );
  console.log(
    '🏭 DONNÉES ACOLONY REÇUES'
  );
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );
  console.log(
    `👤 Discord : ${member.user.tag}`
  );
  console.log(
    `🏠 Colonie : ${state.colonyName || '?'}`
  );
  console.log(
    `🌍 Monde : ${state.world || '?'}`
  );
  console.log(
    `👥 Colons : ${state.colonists.length}`
  );
  console.log(
    `💾 Save : ${state.saveName || '?'}`
  );
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  return sendJson(
    response,
    200,
    {
      ok:
        true,

      message:
        'Données AColony reçues',

      colonists:
        state.colonists.length
    }
  );
}

// ============================================================
// ROUTEUR
// ============================================================

async function handleAColonyRequest(
  request,
  response
) {
  const requestUrl =
    new URL(
      request.url,
      `http://${request.headers.host || 'localhost'}`
    );

  if (
    request.method ===
      'OPTIONS' &&
    requestUrl.pathname
      .startsWith(
        '/acolony/'
      )
  ) {
    sendJson(
      response,
      200,
      {
        ok:
          true
      }
    );

    return true;
  }

  // ==========================================================
  // STATUS PUBLIC
  // ==========================================================

  if (
    request.method ===
      'GET' &&
    requestUrl.pathname ===
      '/acolony/status'
  ) {
    sendJson(
      response,
      200,
      {
        ok:
          true,

        service:
          'Naru AColony Bridge',

        ready:
          Boolean(
            discordClient
          ),

        connectedPlayers:
          playerStates.size
      }
    );

    return true;
  }

  // ==========================================================
  // LIAISON
  // ==========================================================

  if (
    request.method ===
      'POST' &&
    requestUrl.pathname ===
      '/acolony/link'
  ) {
    await handleLink(
      request,
      response
    );

    return true;
  }

  // ==========================================================
  // TÉLÉMÉTRIE / SAVE
  // ==========================================================

  if (
    request.method ===
      'POST' &&
    requestUrl.pathname ===
      '/acolony/update'
  ) {
    await handleUpdate(
      request,
      response
    );

    return true;
  }

  return false;
}

// ============================================================
// ÉTAT JOUEUR
// ============================================================

function getAColonyPlayerState(
  discordUserId
) {
  return (
    playerStates.get(
      String(
        discordUserId
      )
    ) ||
    null
  );
}

// ============================================================
// START
// ============================================================

function startAColonyBridge(
  client
) {
  discordClient =
    client;

  if (
    !client.acolonyBridge
  ) {
    client.acolonyBridge = {
      players:
        new Map(),

      previousStates:
        new Map(),

      messages:
        new Map()
    };
  }

  ensureDataFile();

  console.log(
    '🏭 AColony Bridge : module chargé'
  );

  // Première vérification après démarrage.
  setTimeout(
    () => {
      syncLinkPanels()
        .catch(
          error => {
            console.error(
              '❌ AColony : synchro initiale :',
              error
            );
          }
        );
    },
    10000
  );

  // Permet également de détecter automatiquement
  // les nouveaux joueurs ayant reçu le rôle AColony.
  if (
    !scanInterval
  ) {
    scanInterval =
      setInterval(
        () => {
          syncLinkPanels()
            .catch(
              error => {
                console.error(
                  '❌ AColony : synchro panneaux :',
                  error
                );
              }
            );
        },
        30000
      );
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startAColonyBridge,
  handleAColonyRequest,
  getAColonyPlayerState
};
