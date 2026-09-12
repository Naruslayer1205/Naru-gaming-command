const {
  SlashCommandBuilder
} = require('discord.js');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ============================================================
// NARU GAMING COMMAND
// GTA V — LINK SYSTEM
// ============================================================

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

const pendingLinks =
  new Map();

// ============================================================
// DATA
// ============================================================

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
        { users: {} },
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

    return { users: {} };
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

// ============================================================
// SECURITY / CODES
// ============================================================

function generateCode() {
  return (
    'GTA-' +
    crypto.randomInt(
      100000,
      1000000
    )
  );
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
    String(code || '')
      .trim()
      .toUpperCase();

  for (
    const [requestId, request]
    of pendingLinks.entries()
  ) {
    if (request.code === normalizedCode) {
      return {
        requestId,
        request
      };
    }
  }

  return null;
}

function cleanExpiredRequests() {
  const now = Date.now();

  for (
    const [requestId, request]
    of pendingLinks.entries()
  ) {
    if (now > request.expiresAt) {
      pendingLinks.delete(requestId);
    }
  }
}

function createUniqueCode() {
  let code;

  do {
    code = generateCode();
  } while (findRequestByCode(code));

  return code;
}

// ============================================================
// INSTALLATIONS
// ============================================================

function registerToken(
  discordId,
  token
) {
  const data = loadData();

  if (!data.users[discordId]) {
    data.users[discordId] = {
      installations: []
    };
  }

  if (
    !Array.isArray(
      data.users[discordId].installations
    )
  ) {
    data.users[discordId].installations = [];
  }

  const installationId =
    `PC-${crypto
      .randomBytes(8)
      .toString('hex')
      .toUpperCase()}`;

  data.users[discordId]
    .installations
    .push({
      installationId,

      tokenHash:
        hashToken(token),

      createdAt:
        new Date().toISOString(),

      lastSeen:
        null,

      lastTelemetryAt:
        null,

      edition:
        null,

      bridgeVersion:
        null
    });

  saveData(data);

  return installationId;
}

function findInstallation(
  installationId
) {
  if (!installationId) {
    return null;
  }

  const data = loadData();

  for (
    const [discordId, userData]
    of Object.entries(
      data.users || {}
    )
  ) {
    const installations =
      Array.isArray(
        userData.installations
      )
        ? userData.installations
        : [];

    const installation =
      installations.find(
        item =>
          item.installationId ===
          installationId
      );

    if (installation) {
      return {
        data,
        discordId,
        userData,
        installation
      };
    }
  }

  return null;
}

function authenticateGta(
  request,
  body = {}
) {
  const installationId =
    request.headers[
      'x-naru-installation-id'
    ] ||
    body.installationId;

  let token =
    request.headers[
      'x-naru-gta-token'
    ] ||
    body.token;

  const authorization =
    request.headers.authorization;

  if (
    !token &&
    typeof authorization === 'string' &&
    authorization
      .toLowerCase()
      .startsWith('bearer ')
  ) {
    token = authorization.slice(7);
  }

  if (!installationId || !token) {
    return {
      ok: false,
      status: 401,
      error:
        'Authentification GTA manquante'
    };
  }

  const result =
    findInstallation(
      String(installationId)
    );

  if (!result) {
    return {
      ok: false,
      status: 401,
      error:
        'Installation GTA inconnue'
    };
  }

  const receivedHash =
    hashToken(String(token));

  const expectedHash =
    result.installation.tokenHash;

  const valid =
    typeof expectedHash === 'string' &&
    expectedHash.length ===
      receivedHash.length &&
    crypto.timingSafeEqual(
      Buffer.from(
        expectedHash,
        'utf8'
      ),
      Buffer.from(
        receivedHash,
        'utf8'
      )
    );

  if (!valid) {
    return {
      ok: false,
      status: 401,
      error:
        'Token GTA invalide'
    };
  }

  return {
    ok: true,
    ...result,
    installationId:
      String(installationId)
  };
}

// ============================================================
// HTTP LINK ROUTES
// Le serveur HTTP est démarré dans gta-bridge.js.
// ============================================================

function sendJson(
  response,
  status,
  data
) {
  const payload =
    JSON.stringify(data);

  response.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(payload),

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Naru-GTA-Token, X-Naru-Installation-Id',

      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    }
  );

  response.end(payload);
}

async function handleGtaLinkRequest(
  request,
  response
) {
  cleanExpiredRequests();

  const requestUrl =
    new URL(
      request.url,
      `http://${request.headers.host || 'localhost'}`
    );

  if (
    !requestUrl.pathname.startsWith(
      '/gta/link/'
    )
  ) {
    return false;
  }

  if (
    request.method === 'POST' &&
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

        discordId: null,
        token: null,
        installationId: null,
        completed: false,
        retrieved: false
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
        expiresIn: 600
      }
    );

    return true;
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname.startsWith(
      '/gta/link/status/'
    )
  ) {
    const requestId =
      requestUrl.pathname
        .split('/')
        .pop();

    const link =
      pendingLinks.get(requestId);

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

      return true;
    }

    if (Date.now() > link.expiresAt) {
      pendingLinks.delete(requestId);

      sendJson(
        response,
        404,
        {
          ok: false,
          status:
            'expired_or_unknown'
        }
      );

      return true;
    }

    if (!link.completed) {
      sendJson(
        response,
        200,
        {
          ok: true,
          status: 'waiting'
        }
      );

      return true;
    }

    if (link.retrieved) {
      sendJson(
        response,
        410,
        {
          ok: false,
          status:
            'already_retrieved'
        }
      );

      return true;
    }

    link.retrieved = true;

    sendJson(
      response,
      200,
      {
        ok: true,
        status: 'linked',
        discordId:
          link.discordId,
        installationId:
          link.installationId,
        token:
          link.token
      }
    );

    // Le token n'est renvoyé qu'une seule fois.
    link.token = null;

    setTimeout(
      () => {
        pendingLinks.delete(requestId);
      },
      5000
    );

    return true;
  }

  return false;
}

// ============================================================
// COMMANDE /LIER GTA
// ============================================================

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
                  .setRequired(true)
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
          cmd => cmd.name === 'lier'
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

async function handleInteraction(
  interaction
) {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName !== 'lier') {
    return;
  }

  const subcommand =
    interaction.options.getSubcommand();

  if (subcommand !== 'gta') {
    return;
  }

  try {
    if (
      !interaction.member.roles.cache.has(
        GTA_ROLE_ID
      )
    ) {
      await interaction.reply({
        content:
          '❌ Tu dois avoir le rôle **GTA V** pour utiliser Naru GTA Bridge.',
        ephemeral: true
      });

      return;
    }

    const code =
      interaction.options
        .getString('code', true)
        .trim()
        .toUpperCase();

    cleanExpiredRequests();

    const result =
      findRequestByCode(code);

    if (!result) {
      await interaction.reply({
        content:
          '❌ Ce code GTA est invalide ou a expiré.',
        ephemeral: true
      });

      return;
    }

    const { request } = result;

    if (request.completed) {
      await interaction.reply({
        content:
          '❌ Ce code a déjà été utilisé.',
        ephemeral: true
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

    request.token = token;

    request.installationId =
      installationId;

    request.completed = true;

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
      ephemeral: true
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
        ephemeral: true
      });
    } else {
      await interaction.reply({
        content:
          '❌ Une erreur est survenue pendant la liaison GTA.',
        ephemeral: true
      });
    }
  }
}

// ============================================================
// START
// ============================================================

function startGtaLink(
  client
) {
  console.log(
    '🔗 GTA Bridge Link : module chargé'
  );

  ensureDataFile();

  registerCommands(client);

  client.on(
    'interactionCreate',
    handleInteraction
  );

  setInterval(
    cleanExpiredRequests,
    60 * 1000
  );
}

module.exports = {
  startGtaLink,
  handleGtaLinkRequest,
  authenticateGta,
  findInstallation,
  hashToken,
  loadData,
  saveData
};
