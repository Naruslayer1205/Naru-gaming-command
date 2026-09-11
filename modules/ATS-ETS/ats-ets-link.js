const {
  SlashCommandBuilder
} = require('discord.js');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ============================================================
// NARU GAMING COMMAND
// ATS / ETS2 — LINK SYSTEM
// ============================================================

const ATS_ROLE_ID = '1546760053741064242';
const ETS2_ROLE_ID = '1546760060879765544';

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
    'truck-links.json'
  );

const pendingLinks =
  new Map();

// ============================================================
// DATA
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
    return JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        'utf8'
      )
    );
  } catch (error) {
    console.error(
      '❌ Truck Link : erreur lecture données :',
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

// ============================================================
// SECURITY
// ============================================================

function generateCode() {
  return (
    'TRUCK-' +
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

function generateInstallationId() {
  return (
    'TRUCK-PC-' +
    crypto
      .randomBytes(8)
      .toString('hex')
      .toUpperCase()
  );
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

// ============================================================
// PENDING LINKS
// ============================================================

function findRequestByCode(code) {
  const normalized =
    String(code || '')
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
      normalized
    ) {
      return {
        requestId,
        request
      };
    }
  }

  return null;
}

function createUniqueCode() {
  let code;

  do {
    code =
      generateCode();
  } while (
    findRequestByCode(code)
  );

  return code;
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

// ============================================================
// GAME ACCESS
// ============================================================

function getAllowedGames(member) {
  const games = [];

  if (
    member.roles.cache.has(
      ATS_ROLE_ID
    )
  ) {
    games.push('ats');
  }

  if (
    member.roles.cache.has(
      ETS2_ROLE_ID
    )
  ) {
    games.push('ets2');
  }

  return games;
}

// ============================================================
// INSTALLATION
// ============================================================

function registerInstallation(
  discordId,
  token,
  allowedGames
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

  if (
    !Array.isArray(
      data.users[
        discordId
      ].installations
    )
  ) {
    data.users[
      discordId
    ].installations = [];
  }

  const installationId =
    generateInstallationId();

  data.users[
    discordId
  ].installations.push({
    installationId,

    tokenHash:
      hashToken(token),

    allowedGames,

    createdAt:
      new Date()
        .toISOString(),

    lastSeen:
      null,

    lastTelemetryAt:
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
  const data =
    loadData();

  for (
    const [
      discordId,
      userData
    ]
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

// ============================================================
// AUTH
// ============================================================

function authenticateTruck(
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
      'x-naru-truck-token'
    ] ||
    body.token;

  const authorization =
    request.headers.authorization;

  if (
    !token &&
    authorization &&
    authorization
      .toLowerCase()
      .startsWith(
        'bearer '
      )
  ) {
    token =
      authorization.slice(7);
  }

  if (
    !installationId ||
    !token
  ) {
    return {
      ok: false,
      status: 401,
      error:
        'Authentification Truck manquante'
    };
  }

  const result =
    findInstallation(
      String(
        installationId
      )
    );

  if (!result) {
    return {
      ok: false,
      status: 401,
      error:
        'Installation inconnue'
    };
  }

  const receivedHash =
    hashToken(
      String(token)
    );

  const expectedHash =
    result.installation
      .tokenHash;

  if (
    typeof expectedHash !==
      'string'
  ) {
    return {
      ok: false,
      status: 401,
      error:
        'Token invalide'
    };
  }

  if (
    expectedHash.length !==
    receivedHash.length
  ) {
    return {
      ok: false,
      status: 401,
      error:
        'Token invalide'
    };
  }

  const valid =
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
        'Token invalide'
    };
  }

  return {
    ok: true,

    ...result,

    installationId:
      String(
        installationId
      )
  };
}

// ============================================================
// JSON RESPONSE
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
        Buffer.byteLength(
          payload
        ),

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        [
          'Content-Type',
          'Authorization',
          'X-Naru-Truck-Token',
          'X-Naru-Installation-Id'
        ].join(', '),

      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    }
  );

  response.end(payload);
}

// ============================================================
// HTTP LINK ROUTES
// ============================================================

async function handleAtsEtsRequest(
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
    !requestUrl.pathname
      .startsWith(
        '/truck/'
      )
  ) {
    return false;
  }

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

    return true;
  }

  // ==========================================================
  // HEALTH
  // ==========================================================

  if (
    request.method ===
      'GET' &&
    requestUrl.pathname ===
      '/truck/health'
  ) {
    sendJson(
      response,
      200,
      {
        ok: true,
        service:
          'Naru Truck Bridge',
        status:
          'online'
      }
    );

    return true;
  }

  // ==========================================================
  // LINK START
  // ==========================================================

  if (
    request.method ===
      'POST' &&
    requestUrl.pathname ===
      '/truck/link/start'
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
        requestId,
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

        allowedGames:
          [],

        completed:
          false,

        retrieved:
          false
      }
    );

    console.log(
      `🔗 Truck Link : nouveau code ${code}`
    );

    sendJson(
      response,
      200,
      {
        ok: true,

        status:
          'waiting_for_discord',

        requestId,

        code,

        expiresInSeconds:
          LINK_CODE_DURATION /
          1000,

        command:
          `/lier-truck code:${code}`
      }
    );

    return true;
  }

  // ==========================================================
  // LINK STATUS
  // ==========================================================

  if (
    request.method ===
      'GET' &&
    requestUrl.pathname
      .startsWith(
        '/truck/link/status/'
      )
  ) {
    const requestId =
      decodeURIComponent(
        requestUrl.pathname.slice(
          '/truck/link/status/'
            .length
        )
      );

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

      return true;
    }

    if (
      Date.now() >
      link.expiresAt
    ) {
      pendingLinks.delete(
        requestId
      );

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

    if (
      !link.completed
    ) {
      sendJson(
        response,
        200,
        {
          ok: true,

          status:
            'waiting_for_discord',

          code:
            link.code
        }
      );

      return true;
    }

    if (
      link.retrieved
    ) {
      sendJson(
        response,
        200,
        {
          ok: true,

          status:
            'already_retrieved',

          installationId:
            link.installationId,

          allowedGames:
            link.allowedGames
        }
      );

      return true;
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
          link.token,

        allowedGames:
          link.allowedGames
      }
    );

    link.token =
      null;

    return true;
  }

  // ==========================================================
  // INSTALL STATUS
  // ==========================================================

  if (
    request.method ===
      'GET' &&
    requestUrl.pathname ===
      '/truck/install/status'
  ) {
    const auth =
      authenticateTruck(
        request
      );

    if (!auth.ok) {
      sendJson(
        response,
        auth.status,
        {
          ok: false,
          error:
            auth.error
        }
      );

      return true;
    }

    sendJson(
      response,
      200,
      {
        ok: true,

        status:
          'connected',

        discordId:
          auth.discordId,

        installationId:
          auth.installationId,

        allowedGames:
          auth.installation
            .allowedGames ||
          []
      }
    );

    return true;
  }

  return false;
}

// ============================================================
// DISCORD COMMAND
// ============================================================

async function registerCommands(
  client
) {
  const command =
    new SlashCommandBuilder()
      .setName(
        'lier-truck'
      )
      .setDescription(
        'Lier Naru ATS / ETS2 Bridge'
      )
      .addStringOption(
        option =>
          option
            .setName(
              'code'
            )
            .setDescription(
              'Code affiché par Naru Truck Bridge'
            )
            .setRequired(
              true
            )
      );

  for (
    const guild
    of client.guilds.cache.values()
  ) {
    try {
      const commands =
        await guild.commands.fetch();

      const existing =
        commands.find(
          item =>
            item.name ===
            'lier-truck'
        );

      if (existing) {
        await guild.commands.edit(
          existing.id,
          command.toJSON()
        );

        console.log(
          `🔄 /lier-truck mise à jour sur ${guild.name}`
        );
      } else {
        await guild.commands.create(
          command.toJSON()
        );

        console.log(
          `✅ /lier-truck créée sur ${guild.name}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Truck Link : impossible d'enregistrer la commande sur ${guild.name} :`,
        error
      );
    }
  }
}

// ============================================================
// INTERACTION
// ============================================================

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
    'lier-truck'
  ) {
    return;
  }

  try {
    const allowedGames =
      getAllowedGames(
        interaction.member
      );

    if (
      allowedGames.length === 0
    ) {
      await interaction.reply({
        content:
          '❌ Tu dois avoir le rôle ATS ou ETS2 pour utiliser le Truck Bridge.',

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
          '❌ Code Truck Bridge invalide ou expiré.',

        ephemeral:
          true
      });

      return;
    }

    const request =
      result.request;

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
      registerInstallation(
        interaction.user.id,
        token,
        allowedGames
      );

    request.discordId =
      interaction.user.id;

    request.token =
      token;

    request.installationId =
      installationId;

    request.allowedGames =
      allowedGames;

    request.completed =
      true;

    console.log(
      `✅ Truck Bridge lié : ${interaction.user.tag} → ${installationId}`
    );

    await interaction.reply({
      content:
        [
          '✅ **Naru Truck Bridge connecté !**',
          '',
          `💻 Installation : \`${installationId}\``,
          '',
          `🎮 Jeux autorisés : **${allowedGames.join(', ').toUpperCase()}**`,
          '',
          'Tu peux retourner dans le programme Naru Truck Bridge.'
        ].join('\n'),

      ephemeral:
        true
    });
  } catch (error) {
    console.error(
      '❌ Erreur /lier-truck :',
      error
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction.followUp({
        content:
          '❌ Une erreur est survenue pendant la liaison.',

        ephemeral:
          true
      });
    } else {
      await interaction.reply({
        content:
          '❌ Une erreur est survenue pendant la liaison.',

        ephemeral:
          true
      });
    }
  }
}

// ============================================================
// START
// ============================================================

function startAtsEtsLink(
  client
) {
  console.log(
    '🔗 ATS / ETS2 Link : module chargé'
  );

  ensureDataFile();

  registerCommands(
    client
  );

  client.on(
    'interactionCreate',
    handleInteraction
  );

  setInterval(
    cleanExpiredRequests,
    60 * 1000
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startAtsEtsLink,
  handleAtsEtsRequest,
  authenticateTruck,
  findInstallation,
  loadData,
  saveData,
  hashToken
};
