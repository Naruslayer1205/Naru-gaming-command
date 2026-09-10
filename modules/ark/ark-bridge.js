const http = require('http');

const {
  handleGtaRequest
} = require('../gta/gta-link');

const {
  findPlayerCategory
} = require('./player-spaces');

const {
  updateChallengeChannel
} = require('./ark-challenge-system');

const PORT =
  Number(
    process.env.ARK_BRIDGE_PORT
  ) ||
  Number(
    process.env.PORT
  ) ||
  3000;

const ARK_BRIDGE_SECRET =
  process.env.ARK_BRIDGE_SECRET;

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

// ─────────────────────────────────────
// SALONS
// ─────────────────────────────────────

const CHANNELS = {
  character:
    '👤・personnage',

  world:
    '🌍・monde',

  dinos:
    '🦕・dinos',

  challenges:
    '🎯・défis',

  journal:
    '💀・journal',

  commands:
    '⚙️・commandes',

  help:
    '🆘・aide'
};

// ─────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────

function startArkBridge(
  client
) {
  console.log(
    '🦖 ARK Bridge : module chargé'
  );

  if (!ARK_BRIDGE_SECRET) {
    console.error(
      '❌ Variable ARK_BRIDGE_SECRET manquante.'
    );

    return;
  }

  if (!ARK_ROLE_ID) {
    console.error(
      '❌ Variable ARK_ROLE_ID manquante.'
    );

    return;
  }

  if (!client.arkBridge) {
    client.arkBridge = {
      players:
        new Map(),

      previousStates:
        new Map(),

      messages:
        new Map()
    };
  }

  const server =
    http.createServer(
      async (
        req,
        res
      ) => {
        try {

          // ─────────────────────────
          // ROUTES GTA
          // ─────────────────────────

          if (
            req.url &&
            req.url.startsWith(
              '/gta/'
            )
          ) {
            const handled =
              await handleGtaRequest(
                req,
                res
              );

            if (handled) {
              return;
            }
          }

          // ─────────────────────────
          // STATUS API
          // ─────────────────────────

          if (
            req.method === 'GET' &&
            req.url ===
              '/api/ark/status'
          ) {
            return sendJson(
              res,
              200,
              {
                success:
                  true,

                service:
                  'Naru ARK Bridge',

                connectedPlayers:
                  client.arkBridge.players.size
              }
            );
          }

          // ─────────────────────────
          // UPDATE ARK
          // ─────────────────────────

          if (
            req.method === 'POST' &&
            req.url ===
              '/api/ark/update'
          ) {
            const authHeader =
              req.headers[
                'x-ark-bridge-secret'
              ];

            if (
              !authHeader ||
              authHeader !==
                ARK_BRIDGE_SECRET
            ) {
              console.log(
                '⛔ ARK Bridge : tentative non autorisée'
              );

              return sendJson(
                res,
                401,
                {
                  success:
                    false,

                  error:
                    'Unauthorized'
                }
              );
            }

            const body =
              await readJsonBody(
                req
              );

            if (!body) {
              return sendJson(
                res,
                400,
                {
                  success:
                    false,

                  error:
                    'JSON invalide'
                }
              );
            }

            const discordUserId =
              body.discordUserId;

            if (!discordUserId) {
              return sendJson(
                res,
                400,
                {
                  success:
                    false,

                  error:
                    'discordUserId manquant'
                }
              );
            }

            // ─────────────────────────
            // TROUVER LE MEMBRE
            // ─────────────────────────

            const memberResult =
              await findArkMember(
                client,
                discordUserId
              );

            if (!memberResult) {
              console.log(
                `⛔ ARK : utilisateur ${discordUserId} introuvable`
              );

              return sendJson(
                res,
                403,
                {
                  success:
                    false,

                  error:
                    'Utilisateur Discord introuvable'
                }
              );
            }

            const {
              guild,
              member
            } =
              memberResult;

            // ─────────────────────────
            // VÉRIFICATION RÔLE
            // ─────────────────────────

            if (
              !member.roles.cache.has(
                ARK_ROLE_ID
              )
            ) {
              console.log(
                `⛔ ARK : ${member.user.tag} ne possède pas le rôle ARK`
              );

              return sendJson(
                res,
                403,
                {
                  success:
                    false,

                  error:
                    'Rôle ARK requis'
                }
              );
            }

            // ─────────────────────────
            // CATÉGORIE
            // ─────────────────────────

            const category =
              findPlayerCategory(
                guild,
                member.id
              );

            if (!category) {
              console.log(
                `⚠️ Espace ARK absent pour ${member.user.tag}`
              );

              return sendJson(
                res,
                409,
                {
                  success:
                    false,

                  error:
                    'Espace ARK non créé'
                }
              );
            }

            const receivedAt =
              new Date().toISOString();

            const state = {
              ...body,
              receivedAt
            };

            const previous =
              client.arkBridge
                .previousStates
                .get(
                  discordUserId
                );

            client.arkBridge
              .players
              .set(
                discordUserId,
                state
              );

            await updateArkDiscord(
              client,
              member,
              category,
              state,
              previous
            );

            client.arkBridge
              .previousStates
              .set(
                discordUserId,
                state
              );

            console.log('');
            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            console.log(
              '📡 DONNÉES ARK REÇUES'
            );

            console.log(
              '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
            );

            console.log(
              `👤 Discord : ${member.user.tag}`
            );

            console.log(
              `🗺️ Map : ${
                body.map ||
                '?'
              }`
            );

            console.log(
              `👤 Joueurs : ${
                body.ark
                  ?.players
                  ?.length ?? 0
              }`
            );

            console.log(
              `🦖 Dinos tamés : ${
                body.ark
                  ?.dinos
                  ?.tamed
                  ?.length ?? 0
              }`
            );

            console.log(
              `🌿 Dinos sauvages : ${
                body.ark
                  ?.dinos
                  ?.wild
                  ?.length ?? 0
              }`
            );

            console.log(
              `🕒 ${receivedAt}`
            );

            return sendJson(
              res,
              200,
              {
                success:
                  true,

                message:
                  'Données ARK reçues et Discord mis à jour'
              }
            );
          }

          return sendJson(
            res,
            404,
            {
              success:
                false,

              error:
                'Not found'
            }
          );

        } catch (error) {
          console.error(
            '❌ Erreur ARK Bridge API :',
            error
          );

          return sendJson(
            res,
            500,
            {
              success:
                false,

              error:
                'Internal server error'
            }
          );
        }
      }
    );

  server.listen(
    PORT,
    '0.0.0.0',
    () => {
      console.log(
        `📡 ARK Bridge API : port ${PORT}`
      );
    }
  );

  client.arkBridge.server =
    server;
}

// ─────────────────────────────────────
// TROUVER MEMBRE ARK
// ─────────────────────────────────────

async function findArkMember(
  client,
  userId
) {
  for (
    const guild
    of client.guilds.cache.values()
  ) {
    try {
      const member =
        await guild.members.fetch(
          userId
        );

      if (member) {
        return {
          guild,
          member
        };
      }

    } catch {
      // pas sur ce serveur
    }
  }

  return null;
}

// ─────────────────────────────────────
// TROUVER SALON
// ─────────────────────────────────────

function getChannel(
  guild,
  category,
  name
) {
  return guild.channels.cache.find(
    channel =>
      channel.parentId ===
        category.id &&
      channel.name ===
        name
  );
}

// ─────────────────────────────────────
// UPDATE DISCORD
// ─────────────────────────────────────

async function updateArkDiscord(
  client,
  member,
  category,
  state,
  previous
) {
  const guild =
    member.guild;

  const character =
    getChannel(
      guild,
      category,
      CHANNELS.character
    );

  const world =
    getChannel(
      guild,
      category,
      CHANNELS.world
    );

  const dinos =
    getChannel(
      guild,
      category,
      CHANNELS.dinos
    );

  const challenges =
    getChannel(
      guild,
      category,
      CHANNELS.challenges
    );

  const journal =
    getChannel(
      guild,
      category,
      CHANNELS.journal
    );

  const commands =
    getChannel(
      guild,
      category,
      CHANNELS.commands
    );

  if (character) {
    await upsertMessage(
      client,
      member.id,
      character,
      'character',
      buildCharacterMessage(
        member,
        state
      )
    );
  }

  if (world) {
    await upsertMessage(
      client,
      member.id,
      world,
      'world',
      buildWorldMessage(
        state
      )
    );
  }

  if (dinos) {
    await upsertMultipleMessages(
      client,
      member.id,
      dinos,
      'dinos',
      buildDinoMessages(
        state
      )
    );
  }

  if (challenges) {
    const challengeMetrics =
      state.ark
        ?.challengeMetrics ||
      state.challengeMetrics ||
      {};

    await updateChallengeChannel(
      client,
      member,
      category,
      challengeMetrics
    );
  }

  if (commands) {
    await upsertMessage(
      client,
      member.id,
      commands,
      'commands',
      buildCommandsMessage(
        state
      )
    );
  }

  if (journal) {
    await updateJournal(
      journal,
      state,
      previous
    );
  }
}

// ─────────────────────────────────────
// MESSAGE UNIQUE
// ─────────────────────────────────────

async function upsertMessage(
  client,
  userId,
  channel,
  type,
  content
) {
  const key =
    `${userId}:${type}`;

  let messageId =
    client.arkBridge
      .messages
      .get(
        key
      );

  let message = null;

  if (messageId) {
    try {
      message =
        await channel.messages.fetch(
          messageId
        );
    } catch {
      message = null;
    }
  }

  if (!message) {
    try {
      const messages =
        await channel.messages.fetch({
          limit: 20
        });

      message =
        messages.find(
          msg =>
            msg.author.id ===
            channel.client.user.id
        );

    } catch {
      message = null;
    }
  }

  if (message) {
    await message.edit(
      content
    );

    client.arkBridge
      .messages
      .set(
        key,
        message.id
      );

    return;
  }

  const newMessage =
    await channel.send(
      content
    );

  client.arkBridge
    .messages
    .set(
      key,
      newMessage.id
    );
}

// ─────────────────────────────────────
// MESSAGES MULTIPLES
// ─────────────────────────────────────

async function upsertMultipleMessages(
  client,
  userId,
  channel,
  type,
  contents
) {
  const baseKey =
    `${userId}:${type}`;

  let existingMessages =
    [];

  try {
    const fetched =
      await channel.messages.fetch({
        limit: 100
      });

    existingMessages =
      Array.from(
        fetched.values()
      )
        .filter(
          message =>
            message.author.id ===
            client.user.id
        )
        .sort(
          (a, b) =>
            a.createdTimestamp -
            b.createdTimestamp
        );

  } catch {
    existingMessages =
      [];
  }

  for (
    let i = 0;
    i < contents.length;
    i++
  ) {
    const content =
      contents[i];

    const existing =
      existingMessages[i];

    if (existing) {
      await existing.edit(
        content
      );

      client.arkBridge
        .messages
        .set(
          `${baseKey}:${i}`,
          existing.id
        );

    } else {
      const created =
        await channel.send(
          content
        );

      client.arkBridge
        .messages
        .set(
          `${baseKey}:${i}`,
          created.id
        );
    }
  }

  if (
    existingMessages.length >
    contents.length
  ) {
    const extraMessages =
      existingMessages.slice(
        contents.length
      );

    for (
      const message
      of extraMessages
    ) {
      try {
        await message.delete();
      } catch {
        // rien
      }
    }
  }
}

// ─────────────────────────────────────
// PERSONNAGE
// ─────────────────────────────────────

function buildCharacterMessage(
  member,
  state
) {
  const ark =
    state.ark || {};

  const player =
    ark.players?.[0] || {};

  const stats =
    player.stats || {};

  return [
    '# 👤 Personnage ARK',
    '',
    `**Joueur Discord :** ${member}`,
    `**Personnage :** ${value(player.name)}`,
    `**Niveau :** ${value(player.level)}`,
    `**XP :** ${number(player.experience)}`,
    `**Sexe :** ${translateSex(player.sex)}`,
    `**Tribu :** ${value(player.tribe)}`,
    '',
    '## 📊 Statistiques actuelles',
    '',
    `❤️ **Santé :** ${number(stats.hp)}`,
    `⚡ **Endurance :** ${number(stats.stamina)}`,
    `🫁 **Oxygène :** ${number(stats.oxygen)}`,
    `🍖 **Nourriture :** ${number(stats.food)}`,
    `💧 **Eau :** ${number(stats.water)}`,
    `🏋️ **Poids :** ${number(stats.weight)}`,
    `⚔️ **Mêlée :** ${number(stats.melee)}`,
    `🛡️ **Fortitude :** ${number(stats.fortitude)}`,
    `🔨 **Artisanat :** ${number(stats.crafting)}`,
    '',
    '## 📍 Position',
    '',
    formatPosition(
      player.position
    ),
    '',
    `🗺️ **Map :** ${value(state.map)}`,
    '',
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  ].join('\n');
}

// ─────────────────────────────────────
// MONDE
// ─────────────────────────────────────

function buildWorldMessage(
  state
) {
  const ark =
    state.ark || {};

  const world =
    ark.world || {};

  return [
    '# 🌍 Monde ARK',
    '',
    `🗺️ **Map active :** ${value(state.map)}`,
    '',
    `📦 **Objets sauvegardés :** ${number(ark.save?.objectCount)}`,
    `🏠 **Structures :** ${number(world.structures)}`,
    `🦖 **Créatures totales :** ${number(world.creatures)}`,
    `🦕 **Dinos apprivoisés :** ${number(ark.dinos?.tamed?.length)}`,
    `🌿 **Créatures sauvages :** ${number(ark.dinos?.wild?.length)}`,
    `👤 **Joueurs détectés :** ${number(ark.players?.length)}`,
    '',
    `📄 **Sauvegarde :** ${value(ark.save?.file)}`,
    '',
    `🔄 **Dernière synchronisation :** <t:${unix(state.receivedAt)}:R>`,
    `🕒 **Heure :** <t:${unix(state.receivedAt)}:T>`
  ].join('\n');
}

// ─────────────────────────────────────
// DINOS
// ─────────────────────────────────────

function buildDinoMessages(
  state
) {
  const dinos =
    state.ark
      ?.dinos
      ?.tamed || [];

  if (!dinos.length) {
    return [
      [
        '# 🦕 Dinos apprivoisés',
        '',
        'Aucun dino apprivoisé détecté actuellement.',
        '',
        `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
      ].join('\n')
    ];
  }

  const messages =
    [];

  let currentLines = [
    '# 🦕 Dinos apprivoisés',
    '',
    `**Total : ${dinos.length}**`,
    ''
  ];

  const MAX_LENGTH =
    1850;

  for (
    let i = 0;
    i < dinos.length;
    i++
  ) {
    const dino =
      dinos[i] || {};

    const dinoName =
      firstAvailable(
        dino.name,
        dino.tamed_name,
        dino.tamedName
      );

    const species =
      firstAvailable(
        dino.species,
        dino.creature,
        dino.class,
        dino.class_name,
        dino.className
      );

    const level =
      firstAvailable(
        dino.level,
        dino.lvl
      );

    const owner =
      firstAvailable(
        dino.owner,
        dino.tamer,
        dino.tamer_name,
        dino.tamerName,
        dino.tribe,
        dino.tribe_name,
        dino.tribeName
      );

    const father =
      safeNumber(
        firstAvailable(
          dino.mutationsFather,
          dino.mutations_father,
          dino.mut_f,
          dino['mut-f']
        ),
        0
      );

    const mother =
      safeNumber(
        firstAvailable(
          dino.mutationsMother,
          dino.mutations_mother,
          dino.mut_m,
          dino['mut-m']
        ),
        0
      );

    const imprint =
      firstAvailable(
        dino.imprint,
        dino.imprinting,
        dino.imprinting_quality,
        dino.imprintingQuality
      );

    const position =
      getDinoPosition(
        dino
      );

    const dinoBlock = [
      `## ${i + 1}. ${value(dinoName, 'Sans nom')}`,
      `**Espèce :** ${cleanSpecies(species)}`,
      `**Niveau :** ${value(level)}`,
      `**Sexe :** ${translateSex(dino.sex)}`,
      `**Propriétaire :** ${value(owner)}`,
      `**Imprint :** ${formatPercent(imprint)}`,
      `**Mutations :** ${father + mother} (${father} père / ${mother} mère)`,
      `**Position :** ${formatPositionInline(position)}`,
      ''
    ];

    const footer =
      `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`;

    const projected =
      [
        ...currentLines,
        ...dinoBlock,
        footer
      ].join('\n');

    if (
      projected.length >
      MAX_LENGTH &&
      currentLines.length > 4
    ) {
      currentLines.push(
        footer
      );

      messages.push(
        currentLines.join('\n')
      );

      currentLines = [
        '# 🦕 Dinos apprivoisés',
        '',
        `**Suite — Total : ${dinos.length}**`,
        ''
      ];
    }

    currentLines.push(
      ...dinoBlock
    );
  }

  currentLines.push(
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  );

  messages.push(
    currentLines.join('\n')
  );

  return messages;
}

// ─────────────────────────────────────
// COMMANDES / BRIDGE
// ─────────────────────────────────────

function buildCommandsMessage(
  state
) {
  return [
    '# ⚙️ Naru ARK Bridge',
    '',
    '🟢 **Statut : CONNECTÉ**',
    '',
    `🗺️ **Map reçue :** ${value(state.map)}`,
    `📄 **Sauvegarde :** ${value(state.ark?.save?.file)}`,
    '',
    `📡 **Dernières données reçues :** <t:${unix(state.receivedAt)}:R>`,
    `💻 **Dernier envoi du client :** <t:${unix(state.sentAt)}:R>`,
    '',
    '## 🔧 Fonctionnement',
    '',
    'Le **Naru ARK Bridge Client** lit ta sauvegarde ARK sur ton PC et transmet les informations à Naru Gaming Command.',
    '',
    'Les données sont actualisées automatiquement environ toutes les **30 secondes** lorsque ton Bridge est lancé.',
    '',
    '⚠️ Si le Bridge est fermé, les informations Discord ne pourront plus être actualisées.',
    '',
    'Les futures commandes joueur seront ajoutées dans ce salon.'
  ].join('\n');
}

// ─────────────────────────────────────
// JOURNAL
// ─────────────────────────────────────

async function updateJournal(
  channel,
  state,
  previous
) {
  if (!previous) {
    const messages =
      await channel.messages.fetch({
        limit: 10
      });

    const existing =
      messages.find(
        message =>
          message.author.id ===
            channel.client.user.id &&
          message.content.includes(
            'Journal ARK initialisé'
          )
      );

    if (!existing) {
      await channel.send(
        [
          '## 💀 Journal ARK initialisé',
          '',
          `🗺️ Map : **${value(state.map)}**`,
          '',
          `🕒 <t:${unix(state.receivedAt)}:F>`
        ].join('\n')
      );
    }

    return;
  }

  const events = [];

  if (
    previous.map &&
    state.map &&
    previous.map !== state.map
  ) {
    events.push(
      `🗺️ Changement de map : **${previous.map} → ${state.map}**`
    );
  }

  const oldLevel =
    previous.ark
      ?.players
      ?.[0]
      ?.level;

  const newLevel =
    state.ark
      ?.players
      ?.[0]
      ?.level;

  if (
    oldLevel != null &&
    newLevel != null &&
    Number(newLevel) >
      Number(oldLevel)
  ) {
    events.push(
      `⬆️ Niveau gagné : **${oldLevel} → ${newLevel}**`
    );
  }

  const oldDinos =
    previous.ark
      ?.dinos
      ?.tamed
      ?.length ?? 0;

  const newDinos =
    state.ark
      ?.dinos
      ?.tamed
      ?.length ?? 0;

  if (
    newDinos >
    oldDinos
  ) {
    events.push(
      `🦕 Nouveau dino apprivoisé détecté. **${oldDinos} → ${newDinos}**`
    );
  }

  if (
    newDinos <
    oldDinos
  ) {
    events.push(
      `💀 Le nombre de dinos apprivoisés a diminué. **${oldDinos} → ${newDinos}**`
    );
  }

  const oldStructures =
    previous.ark
      ?.world
      ?.structures;

  const newStructures =
    state.ark
      ?.world
      ?.structures;

  if (
    oldStructures != null &&
    newStructures != null &&
    oldStructures !==
      newStructures
  ) {
    const difference =
      Number(
        newStructures
      ) -
      Number(
        oldStructures
      );

    if (
      difference > 0
    ) {
      events.push(
        `🏠 ${difference} nouvelle(s) structure(s) détectée(s).`
      );
    }
  }

  if (!events.length) {
    return;
  }

  await channel.send(
    [
      `## 📜 Événement ARK`,
      '',
      ...events,
      '',
      `🕒 <t:${unix(state.receivedAt)}:F>`
    ].join('\n')
  );
}

// ─────────────────────────────────────
// OUTILS AFFICHAGE
// ─────────────────────────────────────

function value(
  input,
  fallback = 'Non disponible'
) {
  if (
    input === null ||
    input === undefined ||
    input === ''
  ) {
    return fallback;
  }

  return String(
    input
  );
}

function number(
  input
) {
  if (
    input === null ||
    input === undefined
  ) {
    return 'Non disponible';
  }

  const numericValue =
    Number(
      input
    );

  if (
    Number.isNaN(
      numericValue
    )
  ) {
    return String(
      input
    );
  }

  return numericValue.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        2
    }
  );
}

function translateSex(
  sex
) {
  if (!sex) {
    return 'Non disponible';
  }

  const lower =
    String(
      sex
    ).toLowerCase();

  if (
    lower.includes(
      'female'
    )
  ) {
    return '♀️ Femelle';
  }

  if (
    lower.includes(
      'male'
    )
  ) {
    return '♂️ Mâle';
  }

  return String(
    sex
  );
}

function firstAvailable(
  ...values
) {
  for (
    const item
    of values
  ) {
    if (
      item !== null &&
      item !== undefined &&
      item !== ''
    ) {
      return item;
    }
  }

  return null;
}

function safeNumber(
  input,
  fallback = 0
) {
  const parsed =
    Number(
      input
    );

  if (
    Number.isNaN(
      parsed
    )
  ) {
    return fallback;
  }

  return parsed;
}

function getDinoPosition(
  dino
) {
  if (!dino) {
    return null;
  }

  if (dino.position) {
    return dino.position;
  }

  const hasLatLon =
    dino.lat != null ||
    dino.lon != null;

  const hasXYZ =
    dino.x != null ||
    dino.y != null ||
    dino.z != null;

  const raw =
    firstAvailable(
      dino.raw,
      dino.ccc
    );

  if (
    !hasLatLon &&
    !hasXYZ &&
    !raw
  ) {
    return null;
  }

  return {
    lat:
      dino.lat ?? null,

    lon:
      dino.lon ?? null,

    x:
      dino.x ?? null,

    y:
      dino.y ?? null,

    z:
      dino.z ?? null,

    raw:
      raw ?? null
  };
}

function formatPercent(
  input
) {
  if (
    input === null ||
    input === undefined ||
    input === ''
  ) {
    return 'Non disponible';
  }

  const numberValue =
    Number(
      input
    );

  if (
    Number.isNaN(
      numberValue
    )
  ) {
    return 'Non disponible';
  }

  const percent =
    numberValue <= 1
      ? numberValue * 100
      : numberValue;

  return `${percent.toFixed(1)} %`;
}

function formatPosition(
  position
) {
  if (!position) {
    return 'Position non disponible.';
  }

  if (
    position.lat != null ||
    position.lon != null
  ) {
    return [
      `**Latitude :** ${number(position.lat)}`,
      `**Longitude :** ${number(position.lon)}`
    ].join('\n');
  }

  if (
    position.x != null ||
    position.y != null ||
    position.z != null
  ) {
    return [
      `**X :** ${number(position.x)}`,
      `**Y :** ${number(position.y)}`,
      `**Z :** ${number(position.z)}`
    ].join('\n');
  }

  return value(
    position.raw,
    'Position non disponible.'
  );
}

function formatPositionInline(
  position
) {
  if (!position) {
    return 'Non disponible';
  }

  if (
    position.lat != null ||
    position.lon != null
  ) {
    return `${number(position.lat)} / ${number(position.lon)}`;
  }

  if (
    position.x != null ||
    position.y != null
  ) {
    return `X ${number(position.x)} / Y ${number(position.y)}`;
  }

  return value(
    position.raw
  );
}

function cleanSpecies(
  species
) {
  if (!species) {
    return 'Espèce inconnue';
  }

  return String(
    species
  )
    .replace(
      /_Character_BP.*$/i,
      ''
    )
    .replace(
      /_C$/i,
      ''
    )
    .replace(
      /_/g,
      ' '
    );
}

function unix(
  date
) {
  const timestamp =
    new Date(
      date || Date.now()
    ).getTime();

  if (
    Number.isNaN(
      timestamp
    )
  ) {
    return Math.floor(
      Date.now() /
      1000
    );
  }

  return Math.floor(
    timestamp /
    1000
  );
}

function limitDiscord(
  content
) {
  if (
    content.length <= 1950
  ) {
    return content;
  }

  return (
    content.slice(
      0,
      1850
    ) +
    '\n\n*Affichage réduit automatiquement.*'
  );
}

// ─────────────────────────────────────
// API
// ─────────────────────────────────────

function readJsonBody(
  req
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let data = '';

      req.on(
        'data',
        chunk => {
          data += chunk;

          if (
            data.length >
            10 *
            1024 *
            1024
          ) {
            reject(
              new Error(
                'Payload trop volumineux'
              )
            );

            req.destroy();
          }
        }
      );

      req.on(
        'end',
        () => {
          try {
            resolve(
              JSON.parse(
                data
              )
            );

          } catch {
            resolve(
              null
            );
          }
        }
      );

      req.on(
        'error',
        reject
      );
    }
  );
}

function sendJson(
  res,
  statusCode,
  data
) {
  const payload =
    JSON.stringify(
      data
    );

  res.writeHead(
    statusCode,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(
          payload
        )
    }
  );

  res.end(
    payload
  );
}

module.exports =
  startArkBridge;
