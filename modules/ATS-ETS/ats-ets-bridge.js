const { URL } = require('url');

const {
  authenticateTruck,
  handleAtsEtsRequest,
  loadData,
  saveData
} = require('./ats-ets-link');

const MAX_BODY_SIZE = 1024 * 1024;

let truckClient = null;

const playerStates = new Map();

// ============================================================
// JSON RESPONSE
// ============================================================

function sendJson(response, status, data) {
  const payload = JSON.stringify(data);

  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': [
      'Content-Type',
      'Authorization',
      'X-Naru-Truck-Token',
      'X-Naru-Installation-Id'
    ].join(', '),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });

  response.end(payload);
}

// ============================================================
// READ JSON BODY
// ============================================================

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let finished = false;

    request.on('data', chunk => {
      if (finished) {
        return;
      }

      size += chunk.length;

      if (size > MAX_BODY_SIZE) {
        finished = true;

        reject(
          new Error('BODY_TOO_LARGE')
        );

        return;
      }

      body += chunk.toString('utf8');
    });

    request.on('end', () => {
      if (finished) {
        return;
      }

      finished = true;

      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(
          JSON.parse(body)
        );
      } catch {
        reject(
          new Error('INVALID_JSON')
        );
      }
    });

    request.on('error', error => {
      if (finished) {
        return;
      }

      finished = true;

      reject(error);
    });
  });
}

// ============================================================
// NORMALISATION GAME
// ============================================================

function normalizeGame(value) {
  const game =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    game === 'ats' ||
    game === 'american truck simulator' ||
    game === 'americantrucksimulator'
  ) {
    return 'ats';
  }

  if (
    game === 'ets2' ||
    game === 'ets' ||
    game === 'euro truck simulator 2' ||
    game === 'eurotrucks2'
  ) {
    return 'ets2';
  }

  return null;
}

function getGameName(game) {
  if (game === 'ats') {
    return 'American Truck Simulator';
  }

  if (game === 'ets2') {
    return 'Euro Truck Simulator 2';
  }

  return 'Inconnu';
}

// ============================================================
// DISCORD MEMBER
// ============================================================

async function findDiscordMember(discordId) {
  if (
    !truckClient ||
    !discordId
  ) {
    return null;
  }

  for (
    const guild
    of truckClient.guilds.cache.values()
  ) {
    const cachedMember =
      guild.members.cache.get(discordId);

    if (cachedMember) {
      return cachedMember;
    }

    try {
      const fetchedMember =
        await guild.members.fetch(
          discordId
        );

      if (fetchedMember) {
        return fetchedMember;
      }
    } catch {
      // Le membre n'est pas dans cette guild.
    }
  }

  return null;
}

// ============================================================
// UPDATE INSTALLATION
// ============================================================

function updateInstallationActivity(
  discordId,
  installationId,
  telemetry
) {
  const data =
    loadData();

  const userData =
    data.users?.[discordId];

  if (
    !userData ||
    !Array.isArray(
      userData.installations
    )
  ) {
    return;
  }

  const installation =
    userData.installations.find(
      item =>
        item.installationId ===
        installationId
    );

  if (!installation) {
    return;
  }

  const now =
    new Date().toISOString();

  installation.lastSeen =
    now;

  installation.lastTelemetryAt =
    now;

  if (telemetry.bridgeVersion) {
    installation.bridgeVersion =
      String(
        telemetry.bridgeVersion
      );
  }

  if (telemetry.game) {
    installation.lastGame =
      telemetry.game;
  }

  installation.lastGameRunning =
    telemetry.gameRunning !== false;

  saveData(data);
}

// ============================================================
// PLAYER STATE
// ============================================================

function buildPlayerState(
  discordId,
  installationId,
  game,
  telemetry
) {
  return {
    discordId,

    installationId,

    game,

    gameName:
      getGameName(game),

    gameRunning:
      telemetry.gameRunning !== false,

    connected:
      true,

    lastSeen:
      new Date().toISOString(),

    bridgeVersion:
      telemetry.bridgeVersion ||
      null,

    profile: {
      name:
        telemetry.profile?.name ??
        telemetry.profileName ??
        null,

      companyName:
        telemetry.profile?.companyName ??
        telemetry.companyName ??
        null,

      money:
        telemetry.profile?.money ??
        telemetry.money ??
        null,

      level:
        telemetry.profile?.level ??
        telemetry.level ??
        null,

      xp:
        telemetry.profile?.xp ??
        telemetry.xp ??
        null
    },

    truck: {
      make:
        telemetry.truck?.make ??
        telemetry.truckMake ??
        null,

      model:
        telemetry.truck?.model ??
        telemetry.truckModel ??
        null,

      plate:
        telemetry.truck?.plate ??
        telemetry.licensePlate ??
        null,

      fuel:
        telemetry.truck?.fuel ??
        telemetry.fuel ??
        null,

      fuelCapacity:
        telemetry.truck?.fuelCapacity ??
        telemetry.fuelCapacity ??
        null,

      speed:
        telemetry.truck?.speed ??
        telemetry.speed ??
        null,

      odometer:
        telemetry.truck?.odometer ??
        telemetry.odometer ??
        null,

      engineDamage:
        telemetry.truck?.engineDamage ??
        telemetry.engineDamage ??
        null,

      transmissionDamage:
        telemetry.truck?.transmissionDamage ??
        telemetry.transmissionDamage ??
        null,

      cabinDamage:
        telemetry.truck?.cabinDamage ??
        telemetry.cabinDamage ??
        null,

      chassisDamage:
        telemetry.truck?.chassisDamage ??
        telemetry.chassisDamage ??
        null,

      wheelsDamage:
        telemetry.truck?.wheelsDamage ??
        telemetry.wheelsDamage ??
        null
    },

    trailer: {
      attached:
        telemetry.trailer?.attached ??
        telemetry.trailerAttached ??
        null,

      name:
        telemetry.trailer?.name ??
        telemetry.trailerName ??
        null,

      damage:
        telemetry.trailer?.damage ??
        telemetry.trailerDamage ??
        null
    },

    job: {
      active:
        telemetry.job?.active ??
        telemetry.jobActive ??
        null,

      cargo:
        telemetry.job?.cargo ??
        telemetry.cargo ??
        null,

      cargoMass:
        telemetry.job?.cargoMass ??
        telemetry.cargoMass ??
        null,

      sourceCity:
        telemetry.job?.sourceCity ??
        telemetry.sourceCity ??
        null,

      sourceCompany:
        telemetry.job?.sourceCompany ??
        telemetry.sourceCompany ??
        null,

      destinationCity:
        telemetry.job?.destinationCity ??
        telemetry.destinationCity ??
        null,

      destinationCompany:
        telemetry.job?.destinationCompany ??
        telemetry.destinationCompany ??
        null,

      income:
        telemetry.job?.income ??
        telemetry.income ??
        null,

      remainingDistance:
        telemetry.job?.remainingDistance ??
        telemetry.remainingDistance ??
        null
    },

    raw:
      telemetry
  };
}

function savePlayerState(state) {
  const key =
    `${state.discordId}:${state.game}`;

  playerStates.set(
    key,
    state
  );

  if (
    !truckClient?.truckBridge
  ) {
    return;
  }

  if (
    !truckClient.truckBridge.players
  ) {
    truckClient.truckBridge.players =
      new Map();
  }

  truckClient.truckBridge.players.set(
    key,
    state
  );
}

function getPlayerState(
  discordId,
  game
) {
  return (
    playerStates.get(
      `${discordId}:${game}`
    ) ||
    null
  );
}

// ============================================================
// TELEMETRY
// ============================================================

async function handleTelemetry(
  request,
  response
) {
  let body;

  try {
    body =
      await readJsonBody(
        request
      );
  } catch (error) {
    if (
      error.message ===
      'BODY_TOO_LARGE'
    ) {
      sendJson(
        response,
        413,
        {
          ok: false,
          error:
            'Données trop volumineuses'
        }
      );

      return;
    }

    sendJson(
      response,
      400,
      {
        ok: false,
        error:
          'JSON invalide'
      }
    );

    return;
  }

  const auth =
    authenticateTruck(
      request,
      body
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

    return;
  }

  const game =
    normalizeGame(
      body.game
    );

  if (!game) {
    sendJson(
      response,
      400,
      {
        ok: false,
        error:
          'Jeu invalide. Utilise ats ou ets2.'
      }
    );

    return;
  }

  const allowedGames =
    Array.isArray(
      auth.installation.allowedGames
    )
      ? auth.installation.allowedGames
      : [];

  if (
    !allowedGames.includes(game)
  ) {
    sendJson(
      response,
      403,
      {
        ok: false,
        error:
          `Cette installation n'est pas autorisée pour ${game}.`
      }
    );

    return;
  }

  const member =
    await findDiscordMember(
      auth.discordId
    );

  if (!member) {
    sendJson(
      response,
      404,
      {
        ok: false,
        error:
          'Compte Discord introuvable sur le serveur.'
      }
    );

    return;
  }

  const state =
    buildPlayerState(
      auth.discordId,
      auth.installationId,
      game,
      body
    );

  savePlayerState(
    state
  );

  updateInstallationActivity(
    auth.discordId,
    auth.installationId,
    {
      bridgeVersion:
        body.bridgeVersion,

      game,

      gameRunning:
        body.gameRunning
    }
  );

  console.log(
    `🚛 Truck Telemetry | ${member.user.username} | ${game.toUpperCase()} | ${
      state.gameRunning
        ? 'EN JEU'
        : 'HORS JEU'
    }`
  );

  sendJson(
    response,
    200,
    {
      ok: true,

      status:
        'telemetry_received',

      discordId:
        auth.discordId,

      installationId:
        auth.installationId,

      game,

      gameRunning:
        state.gameRunning
    }
  );
}

// ============================================================
// PLAYER STATUS
// ============================================================

async function handlePlayerStatus(
  request,
  response,
  requestUrl
) {
  const auth =
    authenticateTruck(
      request,
      {}
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

    return;
  }

  const game =
    normalizeGame(
      requestUrl.searchParams.get(
        'game'
      )
    );

  if (!game) {
    sendJson(
      response,
      400,
      {
        ok: false,
        error:
          'Paramètre game requis : ats ou ets2.'
      }
    );

    return;
  }

  sendJson(
    response,
    200,
    {
      ok: true,

      game,

      state:
        getPlayerState(
          auth.discordId,
          game
        )
    }
  );
}

// ============================================================
// HTTP ROUTER
// ============================================================

async function handleRequest(
  request,
  response
) {
  try {
    const requestUrl =
      new URL(
        request.url,
        `http://${request.headers.host || 'localhost'}`
      );

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

    if (
      request.method ===
        'POST' &&
      requestUrl.pathname ===
        '/truck/telemetry'
    ) {
      await handleTelemetry(
        request,
        response
      );

      return;
    }

    if (
      request.method ===
        'GET' &&
      requestUrl.pathname ===
        '/truck/player/status'
    ) {
      await handlePlayerStatus(
        request,
        response,
        requestUrl
      );

      return;
    }

    if (
      requestUrl.pathname.startsWith(
        '/truck/'
      )
    ) {
      const handled =
        await handleAtsEtsRequest(
          request,
          response
        );

      if (handled) {
        return;
      }
    }

    sendJson(
      response,
      404,
      {
        ok: false,
        error:
          'Route Naru Truck Bridge inconnue'
      }
    );
  } catch (error) {
    console.error(
      '❌ Erreur Truck Bridge :',
      error
    );

    if (
      !response.headersSent
    ) {
      sendJson(
        response,
        500,
        {
          ok: false,
          error:
            'Erreur serveur Truck Bridge'
        }
      );
    }
  }
}

// ============================================================
// START / ROUTEUR PARTAGÉ
// ============================================================

function startAtsEtsBridge(
  client
) {
  truckClient = client;

  if (
    !client.truckBridge
  ) {
    client.truckBridge = {
      players:
        new Map(),

      previousStates:
        new Map(),

      messages:
        new Map()
    };
  }

  console.log(
    '🚛 ATS / ETS2 Bridge : module chargé'
  );
}

async function handleAtsEtsBridgeRequest(
  request,
  response
) {
  if (
    !request.url ||
    !request.url.startsWith('/truck/')
  ) {
    return false;
  }

  await handleRequest(
    request,
    response
  );

  return true;
}

module.exports = {
  startAtsEtsBridge,
  handleAtsEtsBridgeRequest,
  handleRequest,
  handleTelemetry,
  getPlayerState
};
