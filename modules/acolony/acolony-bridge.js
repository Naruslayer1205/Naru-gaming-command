const {
  EmbedBuilder,
  ChannelType
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND — ACOLONY BRIDGE
// Réception des données AColony + mise à jour Discord
// ============================================================

const ACOLONY_ROLE_ID =
  process.env.ACOLONY_ROLE_ID ||
  '1548387660517609572';

const ACOLONY_BRIDGE_SECRET =
  process.env.ACOLONY_BRIDGE_SECRET ||
  '';

const CHANNEL_NAMES = {
  colonists:
    '👥・colons',

  connection:
    '🔗・connexion'
};

// Client Discord fourni par index.js / bridge-server.js
let discordClient = null;

// État mémoire
const playerStates =
  new Map();

// ============================================================
// INITIALISATION
// ============================================================

function startAColonyBridge(client) {
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

  console.log(
    '🏭 AColony Bridge : module chargé'
  );

  if (
    !ACOLONY_BRIDGE_SECRET
  ) {
    console.warn(
      '⚠️ ACOLONY_BRIDGE_SECRET non défini.'
    );
  }
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

  response.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        'Content-Type, x-acolony-bridge-secret',

      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    }
  );

  response.end(
    JSON.stringify(
      data
    )
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

      request.on(
        'data',
        chunk => {
          body +=
            chunk.toString();

          if (
            body.length >
            5_000_000
          ) {
            reject(
              new Error(
                'Payload trop volumineux'
              )
            );

            request.destroy();
          }
        }
      );

      request.on(
        'end',
        () => {
          try {
            if (!body) {
              resolve(
                {}
              );

              return;
            }

            resolve(
              JSON.parse(
                body
              )
            );

          } catch (
            error
          ) {
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
        reject
      );
    }
  );
}

// ============================================================
// AUTHENTIFICATION BRIDGE
// ============================================================

function checkSecret(
  request
) {
  if (
    !ACOLONY_BRIDGE_SECRET
  ) {
    return false;
  }

  const received =
    request.headers[
      'x-acolony-bridge-secret'
    ];

  return (
    received ===
    ACOLONY_BRIDGE_SECRET
  );
}

// ============================================================
// TROUVER LE MEMBRE DISCORD
// ============================================================

async function findDiscordMember(
  discordUserId
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
          discordUserId
        );

      if (!member) {
        continue;
      }

      return {
        guild,
        member
      };

    } catch {
      // utilisateur absent de ce serveur
    }
  }

  return null;
}

// ============================================================
// TROUVER CATÉGORIE ACOLONY DU JOUEUR
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
          '🏭 AColony — '
        )
    );

  // D'abord grâce aux permissions personnelles
  const byPermission =
    categories.find(
      category =>
        category.permissionOverwrites
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

  // Fallback avec le nom du joueur
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
// TROUVER UN SALON DANS L'ESPACE JOUEUR
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
// OUTILS AFFICHAGE
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

  return `${Math.round(
    value
  )}%`;
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
      trait =>
        `• ${
          typeof trait ===
          'string'
            ? trait
            : (
                trait.name ||
                `Trait ${trait.id ?? '?'}`
              )
        }`
    )
    .join('\n')
    .slice(
      0,
      1024
    );
}

// ============================================================
// TRAVAUX
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
        (
          a,
          b
        ) => {
          const priority =
            number(
              b.priority
            ) -
            number(
              a.priority
            );

          if (
            priority !== 0
          ) {
            return priority;
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
    state?.world
  ) {
    embed.setAuthor({
      name:
        `${state.colonyName || 'Colonie'} • ${state.world}`
    });
  }

  return embed;
}

// ============================================================
// RÉCUPÉRER LES MESSAGES DU BOT
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

      const embed =
        message.embeds?.[0];

      const footer =
        embed?.footer?.text;

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
      '❌ AColony : impossible de lire les anciens messages :',
      error.message
    );
  }

  return map;
}

// ============================================================
// SYNCHRONISATION SALON COLONS
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
      try {
        await oldMessage.edit({
          content:
            null,

          embeds:
            [
              embed
            ]
        });

      } catch (
        error
      ) {
        console.error(
          `❌ AColony : modification de ${colonist.name} impossible :`,
          error.message
        );
      }

    } else {
      try {
        await channel.send({
          embeds:
            [
              embed
            ]
        });

      } catch (
        error
      ) {
        console.error(
          `❌ AColony : création de ${colonist.name} impossible :`,
          error.message
        );
      }
    }
  }

  // Supprime uniquement les anciennes fiches AColony
  // correspondant à des colons qui ne sont plus présents.

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

    } catch (
      error
    ) {
      console.error(
        `❌ AColony : ancienne fiche ${colonistId} impossible à supprimer :`,
        error.message
      );
    }
  }
}

// ============================================================
// SALON CONNEXION
// ============================================================

async function updateConnectionChannel(
  channel,
  member,
  state
) {
  if (
    !channel
  ) {
    return;
  }

  const marker =
    'ACOLONY_BRIDGE_STATUS';

  let statusMessage =
    null;

  try {
    const messages =
      await channel.messages.fetch({
        limit: 50
      });

    statusMessage =
      messages.find(
        message =>
          message.author.id ===
            channel.client.user.id &&
          message.content.includes(
            marker
          )
      ) ||
      null;

  } catch {
    // rien
  }

  const content =
    [
      `<!-- ${marker} -->`,
      '# 🏭 AColony Bridge',
      '',
      `👤 <@${member.id}>`,
      '',
      '🟢 **Bridge connecté**',
      '',
      `🏠 **Colonie :** ${state.colonyName || '?'}`,
      `🌍 **Monde :** ${state.world || '?'}`,
      `🎮 **Version :** ${state.version || '?'}`,
      `👥 **Colons :** ${state.colonists?.length ?? 0}`,
      '',
      `💾 **Sauvegarde :** ${state.saveName || '?'}`,
      '',
      '🔄 Les données sont synchronisées automatiquement avec AColony.'
    ].join(
      '\n'
    );

  if (
    statusMessage
  ) {
    await statusMessage.edit({
      content
    });

  } else {
    await channel.send({
      content
    });
  }
}

// ============================================================
// TRAITEMENT D'UNE MISE À JOUR
// ============================================================

async function handleUpdate(
  request,
  response
) {
  if (
    !checkSecret(
      request
    )
  ) {
    return sendJson(
      response,
      401,
      {
        ok: false,
        error:
          'Unauthorized'
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
        ok: false,
        error:
          error.message
      }
    );
  }

  const discordUserId =
    body.discordUserId;

  if (
    !discordUserId
  ) {
    return sendJson(
      response,
      400,
      {
        ok: false,
        error:
          'discordUserId manquant'
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
        ok: false,
        error:
          'colonists manquant'
      }
    );
  }

  const found =
    await findDiscordMember(
      discordUserId
    );

  if (
    !found
  ) {
    return sendJson(
      response,
      404,
      {
        ok: false,
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
        ok: false,
        error:
          'Le membre ne possède pas le rôle AColony'
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
        ok: false,
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
        ok: false,
        error:
          'Salon 👥・colons introuvable'
      }
    );
  }

  const connectionChannel =
    findChannel(
      guild,
      category,
      CHANNEL_NAMES.connection
    );

  const state = {
    discordUserId,

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
    discordUserId,
    state
  );

  if (
    discordClient?.acolonyBridge
  ) {
    discordClient
      .acolonyBridge
      .players
      .set(
        discordUserId,
        state
      );
  }

  await updateColonistsChannel(
    colonistsChannel,
    state
  );

  if (
    connectionChannel
  ) {
    try {
      await updateConnectionChannel(
        connectionChannel,
        member,
        state
      );

    } catch (
      error
    ) {
      console.error(
        '⚠️ AColony : mise à jour connexion impossible :',
        error.message
      );
    }
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
      ok: true,

      message:
        'Données AColony reçues et Discord mis à jour',

      colonists:
        state.colonists.length
    }
  );
}

// ============================================================
// ROUTEUR ACOLONY
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
    'OPTIONS'
  ) {
    if (
      requestUrl.pathname.startsWith(
        '/acolony/'
      )
    ) {
      sendJson(
        response,
        200,
        {
          ok: true
        }
      );

      return true;
    }

    return false;
  }

  // ==========================================================
  // STATUS
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
        ok: true,

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
  // UPDATE
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
// EXPORTS
// ============================================================

module.exports = {
  startAColonyBridge,
  handleAColonyRequest,
  getAColonyPlayerState
};
