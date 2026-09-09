const {
  SlashCommandBuilder
} = require('discord.js');

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ─────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────

const GTA_ROLE_ID =
  '1546760047105806366';

const LINK_CODE_DURATION =
  10 * 60 * 1000;

const DATA_FOLDER =
  path.join(
    __dirname,
    '../../data'
  );

const DATA_FILE =
  path.join(
    DATA_FOLDER,
    'gta-links.json'
  );

// Demandes temporaires en mémoire.
//
// requestId -> {
//   code,
//   createdAt,
//   expiresAt,
//   discordId,
//   token,
//   completed,
//   retrieved
// }

const pendingLinks =
  new Map();

// ─────────────────────────────────────
// FICHIER DE DONNÉES
// ─────────────────────────────────────

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
    return JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        'utf8'
      )
    );
  } catch (error) {
    console.error(
      '❌ Impossible de lire gta-links.json :',
      error
    );

    return {
      users: {}
    };
  }
}

function saveData(data) {
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
// OUTILS
// ─────────────────────────────────────

function generateCode() {
  const number =
    crypto.randomInt(
      100000,
      1000000
    );

  return `GTA-${number}`;
}

function generateRequestId() {
  return crypto.randomUUID();
}

function generateToken() {
  return crypto
    .randomBytes(32)
    .toString('hex');
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

function findRequestByCode(code) {
  const normalizedCode =
    code
      .trim()
      .toUpperCase();

  for (
    const [
      requestId,
      request
    ]
    of pendingLinks.entries()
  ) {
    if (
      request.code ===
        normalizedCode
    ) {
      return {
        requestId,
        request
      };
    }
  }

  return null;
}

function cleanExpiredRequests() {
  const now =
    Date.now();

  for (
    const [
      requestId,
      request
    ]
    of pendingLinks.entries()
  ) {
    if (
      now >
      request.expiresAt
    ) {
      pendingLinks.delete(
        requestId
      );
    }
  }
}

function createUniqueCode() {
  let code;

  do {
    code =
      generateCode();
  } while (
    findRequestByCode(
      code
    )
  );

  return code;
}

// ─────────────────────────────────────
// ENREGISTRER LE TOKEN
// ─────────────────────────────────────

function registerToken(
  discordId,
  token
) {
  const data =
    loadData();

  if (
    !data.users[
      discordId
    ]
  ) {
    data.users[
      discordId
    ] = {
      installations: []
    };
  }

  const installationId =
    `PC-${crypto
      .randomBytes(8)
      .toString('hex')
      .toUpperCase()}`;

  data.users[
    discordId
  ].installations.push({
    installationId,

    tokenHash:
      hashToken(
        token
      ),

    createdAt:
      new Date()
        .toISOString(),

    lastSeen:
      null
  });

  saveData(
    data
  );

  return installationId;
}

// ─────────────────────────────────────
// RÉPONSE HTTP JSON
// ─────────────────────────────────────

function sendJson(
  response,
  status,
  data
) {
  response.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        'Content-Type',

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

// ─────────────────────────────────────
// API
// ─────────────────────────────────────

function startHttpServer(
  client
) {
  const port =
    Number(
      process.env.PORT
    ) || 3000;

  const server =
    http.createServer(
      async (
        request,
        response
      ) => {
        try {
          cleanExpiredRequests();

          if (
            request.method ===
              'OPTIONS'
          ) {
            sendJson(
              response,
              200,
              {
                ok: true
              }
            );

            return;
          }

          const requestUrl =
            new URL(
              request.url,
              `http://${request.headers.host || 'localhost'}`
            );

          // ─────────────────────────
          // TEST API
          // ─────────────────────────

          if (
            request.method ===
              'GET' &&
            requestUrl.pathname ===
              '/gta/health'
          ) {
            sendJson(
              response,
              200,
              {
                ok: true,
                service:
                  'Naru GTA Bridge',
                status:
                  'online'
              }
            );

            return;
          }

          // ─────────────────────────
          // COMMENCER UNE LIAISON
          // ─────────────────────────

          if (
            request.method ===
              'POST' &&
            requestUrl.pathname ===
              '/gta/link/start'
          ) {
            const requestId =
              generateRequestId();

            const code =
              createUniqueCode();

            const createdAt =
              Date.now();

            pendingLinks.set(
              requestId,
              {
                code,

                createdAt,

                expiresAt:
                  createdAt +
                  LINK_CODE_DURATION,

                discordId:
                  null,

                token:
                  null,

                installationId:
                  null,

                completed:
                  false,

                retrieved:
                  false
              }
            );

            console.log(
              `🔗 Nouvelle demande GTA : ${code}`
            );

            sendJson(
              response,
              200,
              {
                ok: true,

                requestId,

                code,

                expiresIn:
                  600
              }
            );

            return;
          }

          // ─────────────────────────
          // ÉTAT D'UNE LIAISON
          // ─────────────────────────

          if (
            request.method ===
              'GET' &&
            requestUrl.pathname.startsWith(
              '/gta/link/status/'
            )
          ) {
            const requestId =
              requestUrl.pathname
                .split('/')
                .pop();

            const link =
              pendingLinks.get(
                requestId
              );

            if (!link) {
              sendJson(
                response,
                404,
                {
                  ok: false,
                  status:
                    'expired_or_unknown'
                }
              );

              return;
            }

            if (
              !link.completed
            ) {
              sendJson(
                response,
                200,
                {
                  ok: true,
                  status:
                    'waiting'
                }
              );

              return;
            }

            if (
              link.retrieved
            ) {
              sendJson(
                response,
                410,
                {
                  ok: false,
                  status:
                    'already_retrieved'
                }
              );

              return;
            }

            link.retrieved =
              true;

            sendJson(
              response,
              200,
              {
                ok: true,

                status:
                  'linked',

                discordId:
                  link.discordId,

                installationId:
                  link.installationId,

                token:
                  link.token
              }
            );

            // Le token en clair n'est gardé
            // que quelques secondes après
            // sa récupération.

            setTimeout(
              () => {
                pendingLinks.delete(
                  requestId
                );
              },
              5000
            );

            return;
          }

          // ─────────────────────────
          // ROUTE INCONNUE
          // ─────────────────────────

          sendJson(
            response,
            404,
            {
              ok: false,
              error:
                'Route inconnue'
            }
          );

        } catch (error) {
          console.error(
            '❌ Erreur API GTA :',
            error
          );

          sendJson(
            response,
            500,
            {
              ok: false,
              error:
                'Erreur serveur'
            }
          );
        }
      }
    );

  server.listen(
    port,
    '0.0.0.0',
    () => {
      console.log(
        `🌐 Naru GTA Bridge API active sur le port ${port}`
      );
    }
  );

  return server;
}

// ─────────────────────────────────────
// COMMANDE /LIER GTA
// ─────────────────────────────────────

async function registerCommands(
  client
) {
  const command =
    new SlashCommandBuilder()
      .setName('lier')
      .setDescription(
        'Lier un service Naru Gaming Command'
      )
      .addSubcommand(
        subcommand =>
          subcommand
            .setName('gta')
            .setDescription(
              'Lier Naru GTA Bridge'
            )
            .addStringOption(
              option =>
                option
                  .setName('code')
                  .setDescription(
                    'Code affiché par Naru GTA Bridge Installer'
                  )
                  .setRequired(
                    true
                  )
            )
      );

  for (
    const guild
    of client.guilds.cache.values()
  ) {
    try {
      const existing =
        await guild.commands.fetch();

      const current =
        existing.find(
          cmd =>
            cmd.name ===
            'lier'
        );

      if (current) {
        await guild.commands.edit(
          current.id,
          command.toJSON()
        );

        console.log(
          `🔄 Commande /lier mise à jour sur ${guild.name}`
        );

      } else {
        await guild.commands.create(
          command.toJSON()
        );

        console.log(
          `✅ Commande /lier créée sur ${guild.name}`
        );
      }

    } catch (error) {
      console.error(
        `❌ Impossible d'enregistrer /lier sur ${guild.name} :`,
        error
      );
    }
  }
}

// ─────────────────────────────────────
// TRAITER /LIER GTA
// ─────────────────────────────────────

async function handleInteraction(
  interaction
) {
  if (
    !interaction.isChatInputCommand()
  ) {
    return;
  }

  if (
    interaction.commandName !==
      'lier'
  ) {
    return;
  }

  const subcommand =
    interaction.options
      .getSubcommand();

  if (
    subcommand !==
      'gta'
  ) {
    return;
  }

  try {
    // Vérification rôle GTA

    if (
      !interaction.member.roles.cache.has(
        GTA_ROLE_ID
      )
    ) {
      await interaction.reply({
        content:
          '❌ Tu dois avoir le rôle **GTA V** pour utiliser Naru GTA Bridge.',

        ephemeral:
          true
      });

      return;
    }

    const code =
      interaction.options
        .getString(
          'code',
          true
        )
        .trim()
        .toUpperCase();

    cleanExpiredRequests();

    const result =
      findRequestByCode(
        code
      );

    if (!result) {
      await interaction.reply({
        content:
          '❌ Ce code GTA est invalide ou a expiré.',

        ephemeral:
          true
      });

      return;
    }

    const {
      request
    } = result;

    if (
      request.completed
    ) {
      await interaction.reply({
        content:
          '❌ Ce code a déjà été utilisé.',

        ephemeral:
          true
      });

      return;
    }

    const token =
      generateToken();

    const installationId =
      registerToken(
        interaction.user.id,
        token
      );

    request.discordId =
      interaction.user.id;

    request.token =
      token;

    request.installationId =
      installationId;

    request.completed =
      true;

    console.log(
      `✅ GTA Bridge lié à ${interaction.user.tag} (${installationId})`
    );

    await interaction.reply({
      content: [
        '✅ **Naru GTA Bridge connecté !**',
        '',
        `Ton installation \`${installationId}\` est maintenant liée à ton compte Discord.`,
        '',
        'Tu peux retourner dans **Naru GTA Bridge Installer**. La connexion sera détectée automatiquement.'
      ].join('\n'),

      ephemeral:
        true
    });

  } catch (error) {
    console.error(
      '❌ Erreur /lier gta :',
      error
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.followUp({
        content:
          '❌ Une erreur est survenue pendant la liaison GTA.',

        ephemeral:
          true
      });

    } else {
      await interaction.reply({
        content:
          '❌ Une erreur est survenue pendant la liaison GTA.',

        ephemeral:
          true
      });
    }
  }
}

// ─────────────────────────────────────
// MODULE PRINCIPAL
// ─────────────────────────────────────

function startGtaLink(
  client
) {
  console.log(
    '🔗 GTA Bridge Link : module chargé'
  );

  ensureDataFile();

  registerCommands(
    client
  );

  client.on(
    'interactionCreate',
    handleInteraction
  );

  startHttpServer(
    client
  );

  // Nettoyage périodique
  // des codes expirés.

  setInterval(
    cleanExpiredRequests,
    60 * 1000
  );
}

module.exports = {
  startGtaLink,
  hashToken,
  loadData,
  saveData
};
