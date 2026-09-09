const {
  SlashCommandBuilder
} = require('discord.js');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  findPlayerCategory
} = require('./player-spaces');

const {
  processGtaChallengeTelemetry
} = require('./gta-challenges');

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

// ─────────────────────────────────────
// DEMANDES TEMPORAIRES
// ─────────────────────────────────────

const pendingLinks =
  new Map();

let gtaClient =
  null;

const CHANNELS = {
  character:
    '👤・personnage',

  position:
    '📍・position',

  vehicle:
    '🚗・vehicule',

  statistics:
    '📊・statistiques',

  journal:
    '📜・journal',

  commands:
    '⚙️・commandes'
};

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
    String(code)
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
// TOKEN PERMANENT
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
// TÉLÉMÉTRIE — OUTILS
// ─────────────────────────────────────

function readJsonBody(
  request
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let data = '';

      request.on(
        'data',
        chunk => {
          data += chunk;

          if (
            data.length >
            1024 * 1024
          ) {
            reject(
              new Error(
                'Payload GTA trop volumineux'
              )
            );

            request.destroy();
          }
        }
      );

      request.on(
        'end',
        () => {
          if (!data) {
            resolve({});
            return;
          }

          try {
            resolve(
              JSON.parse(
                data
              )
            );
          } catch {
            resolve(null);
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

function findInstallation(
  installationId
) {
  if (!installationId) {
    return null;
  }

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

function authenticateTelemetry(
  request,
  body
) {
  const installationId =
    request.headers[
      'x-naru-installation-id'
    ] ||
    body?.installationId;

  let token =
    request.headers[
      'x-naru-gta-token'
    ] ||
    body?.token;

  const authorization =
    request.headers.authorization;

  if (
    !token &&
    typeof authorization ===
      'string' &&
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
        'Authentification GTA manquante'
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
        'Installation GTA inconnue'
    };
  }

  const receivedHash =
    hashToken(
      String(token)
    );

  const expectedHash =
    result.installation
      .tokenHash;

  const valid =
    typeof expectedHash ===
      'string' &&
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
      String(
        installationId
      )
  };
}

async function findGtaMember(
  client,
  discordId
) {
  if (!client) {
    return null;
  }

  for (
    const guild
    of client.guilds.cache.values()
  ) {
    let member =
      guild.members.cache.get(
        discordId
      );

    if (!member) {
      try {
        member =
          await guild.members.fetch(
            discordId
          );
      } catch {
        member = null;
      }
    }

    if (member) {
      return {
        guild,
        member
      };
    }
  }

  return null;
}

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

  return String(input);
}

function number(
  input,
  digits = 1
) {
  if (
    input === null ||
    input === undefined ||
    input === ''
  ) {
    return 'Non disponible';
  }

  const parsed =
    Number(input);

  if (
    Number.isNaN(
      parsed
    )
  ) {
    return String(input);
  }

  return parsed.toLocaleString(
    'fr-FR',
    {
      maximumFractionDigits:
        digits
    }
  );
}

function yesNo(
  input
) {
  if (
    input === null ||
    input === undefined
  ) {
    return 'Non disponible';
  }

  return input
    ? 'Oui'
    : 'Non';
}

function formatDuration(
  seconds
) {
  const total =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const hours =
    Math.floor(
      total / 3600
    );

  const minutes =
    Math.floor(
      (total % 3600) / 60
    );

  const remainingSeconds =
    total % 60;

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${remainingSeconds} s`;
  }

  return `${remainingSeconds} s`;
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
      Date.now() / 1000
    );
  }

  return Math.floor(
    timestamp / 1000
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

async function upsertGtaMessage(
  client,
  userId,
  channel,
  type,
  content
) {
  if (!client.gtaBridge) {
    client.gtaBridge = {
      players: new Map(),
      previousStates:
        new Map(),
      messages: new Map()
    };
  }

  const key =
    `${userId}:${type}`;

  let messageId =
    client.gtaBridge
      .messages
      .get(key);

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

    client.gtaBridge
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

  client.gtaBridge
    .messages
    .set(
      key,
      newMessage.id
    );
}

function buildCharacterMessage(
  member,
  state
) {
  const player =
    state.player || {};

  const weapon =
    state.weapon || {};

  return [
    '# 👤 Personnage GTA V',
    '',
    `**Joueur Discord :** ${member}`,
    `**Personnage / modèle :** ${value(player.name || player.model)}`,
    `❤️ **Santé :** ${number(player.health, 0)} / ${number(player.maxHealth, 0)}`,
    `🛡️ **Armure :** ${number(player.armor, 0)}`,
    `💀 **Mort :** ${yesNo(player.isDead)}`,
    `💵 **Argent :** ${number(player.money, 0)}`,
    '',
    '## 🔫 Arme actuelle',
    '',
    `**Nom :** ${value(weapon.name || weapon.label)}`,
    `**Hash :** ${value(weapon.hash)}`,
    `**Munitions :** ${number(weapon.ammo, 0)}`,
    '',
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  ].join('\n');
}

function buildPositionMessage(
  state
) {
  const position =
    state.position || {};

  return [
    '# 📍 Position GTA V',
    '',
    `🛣️ **Rue :** ${value(position.street)}`,
    `🏙️ **Zone :** ${value(position.zone || position.area)}`,
    `📌 **X :** ${number(position.x, 2)}`,
    `📌 **Y :** ${number(position.y, 2)}`,
    `📌 **Z :** ${number(position.z, 2)}`,
    `🧭 **Cap :** ${number(position.heading, 1)}°`,
    '',
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  ].join('\n');
}

function buildVehicleMessage(
  state
) {
  const vehicle =
    state.vehicle || {};

  if (
    vehicle.inVehicle ===
      false ||
    !vehicle.inVehicle
  ) {
    return [
      '# 🚗 Véhicule GTA V',
      '',
      'Le joueur est actuellement **à pied**.',
      '',
      `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
    ].join('\n');
  }

  return [
    '# 🚗 Véhicule GTA V',
    '',
    `**Modèle :** ${value(vehicle.displayName || vehicle.model)}`,
    `**Classe :** ${value(vehicle.className || vehicle.class)}`,
    `🔢 **Plaque :** ${value(vehicle.plate)}`,
    `💨 **Vitesse :** ${number(vehicle.speedKmh, 1)} km/h`,
    `🔧 **Moteur :** ${number(vehicle.engineHealth, 0)}`,
    `🚘 **Carrosserie :** ${number(vehicle.bodyHealth, 0)}`,
    `⛽ **Carburant :** ${number(vehicle.fuelLevel, 1)}`,
    `🪑 **Position :** ${value(vehicle.seat)}`,
    `👑 **Conducteur :** ${yesNo(vehicle.isDriver)}`,
    '',
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  ].join('\n');
}

function buildStatisticsMessage(
  state
) {
  const session =
    state.session || {};

  return [
    '# 📊 Statistiques GTA V',
    '',
    `🎮 **Édition :** ${value(state.edition)}`,
    `🧩 **Version GTA :** ${value(state.gameVersion)}`,
    `🔌 **Version Naru Bridge :** ${value(state.bridgeVersion)}`,
    '',
    `⏱️ **Durée de session :** ${formatDuration(session.durationSeconds)}`,
    `🛣️ **Distance parcourue :** ${number((Number(session.distanceMeters) || 0) / 1000, 2)} km`,
    `💀 **Morts :** ${number(session.deaths, 0)}`,
    `🚗 **Véhicules utilisés :** ${number(session.vehiclesUsed, 0)}`,
    '',
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  ].join('\n');
}

function buildCommandsMessage(
  state,
  installationId
) {
  return [
    '# ⚙️ Naru GTA Bridge',
    '',
    '🟢 **Statut : CONNECTÉ**',
    '',
    `💻 **Installation :** \`${installationId}\``,
    `🎮 **Édition détectée :** ${value(state.edition)}`,
    `🔌 **Bridge :** ${value(state.bridgeVersion)}`,
    '',
    `📡 **Dernières données reçues :** <t:${unix(state.receivedAt)}:R>`,
    `💻 **Dernier envoi du client :** <t:${unix(state.sentAt || state.receivedAt)}:R>`,
    '',
    'Le **Naru GTA Bridge** lit les informations du mode Histoire de GTA V et les transmet automatiquement à Naru Gaming Command.'
  ].join('\n');
}

async function updateGtaJournal(
  channel,
  state,
  previous
) {
  if (!previous) {
    await channel.send(
      [
        '## 📜 Journal GTA initialisé',
        '',
        `🎮 Édition : **${value(state.edition)}**`,
        '',
        `🕒 <t:${unix(state.receivedAt)}:F>`
      ].join('\n')
    );

    return;
  }

  const events = [];

  const oldDead =
    previous.player
      ?.isDead;

  const newDead =
    state.player
      ?.isDead;

  if (
    oldDead === false &&
    newDead === true
  ) {
    events.push(
      '💀 Le personnage est mort.'
    );
  }

  if (
    oldDead === true &&
    newDead === false
  ) {
    events.push(
      '❤️ Le personnage est réapparu.'
    );
  }

  const oldVehicle =
    previous.vehicle || {};

  const newVehicle =
    state.vehicle || {};

  if (
    !oldVehicle.inVehicle &&
    newVehicle.inVehicle
  ) {
    events.push(
      `🚗 Entrée dans **${value(newVehicle.displayName || newVehicle.model, 'un véhicule')}**.`
    );
  } else if (
    oldVehicle.inVehicle &&
    !newVehicle.inVehicle
  ) {
    events.push(
      '🚶 Sortie du véhicule.'
    );
  } else if (
    oldVehicle.inVehicle &&
    newVehicle.inVehicle &&
    value(
      oldVehicle.plate,
      ''
    ) !==
    value(
      newVehicle.plate,
      ''
    )
  ) {
    events.push(
      `🚘 Changement de véhicule : **${value(newVehicle.displayName || newVehicle.model)}**.`
    );
  }

  const oldWeapon =
    previous.weapon
      ?.name;

  const newWeapon =
    state.weapon
      ?.name;

  if (
    oldWeapon &&
    newWeapon &&
    oldWeapon !==
      newWeapon
  ) {
    events.push(
      `🔫 Arme équipée : **${newWeapon}**.`
    );
  }

  const oldZone =
    previous.position
      ?.zone;

  const newZone =
    state.position
      ?.zone;

  if (
    oldZone &&
    newZone &&
    oldZone !==
      newZone
  ) {
    events.push(
      `📍 Nouvelle zone : **${newZone}**.`
    );
  }

  if (!events.length) {
    return;
  }

  await channel.send(
    limitDiscord(
      [
        '## 📜 Événement GTA',
        '',
        ...events,
        '',
        `🕒 <t:${unix(state.receivedAt)}:F>`
      ].join('\n')
    )
  );
}

async function updateGtaDiscord(
  client,
  member,
  category,
  state,
  previous,
  installationId
) {
  const guild =
    member.guild;

  const character =
    getChannel(
      guild,
      category,
      CHANNELS.character
    );

  const position =
    getChannel(
      guild,
      category,
      CHANNELS.position
    );

  const vehicle =
    getChannel(
      guild,
      category,
      CHANNELS.vehicle
    );

  const statistics =
    getChannel(
      guild,
      category,
      CHANNELS.statistics
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
    await upsertGtaMessage(
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

  if (position) {
    await upsertGtaMessage(
      client,
      member.id,
      position,
      'position',
      buildPositionMessage(
        state
      )
    );
  }

  if (vehicle) {
    await upsertGtaMessage(
      client,
      member.id,
      vehicle,
      'vehicle',
      buildVehicleMessage(
        state
      )
    );
  }

  if (statistics) {
    await upsertGtaMessage(
      client,
      member.id,
      statistics,
      'statistics',
      buildStatisticsMessage(
        state
      )
    );
  }

  if (commands) {
    await upsertGtaMessage(
      client,
      member.id,
      commands,
      'commands',
      buildCommandsMessage(
        state,
        installationId
      )
    );
  }

  if (journal) {
    await updateGtaJournal(
      journal,
      state,
      previous
    );
  }
}

async function handleTelemetry(
  request,
  response
) {
  const body =
    await readJsonBody(
      request
    );

  if (!body) {
    sendJson(
      response,
      400,
      {
        ok: false,
        error:
          'JSON GTA invalide'
      }
    );

    return true;
  }

  const auth =
    authenticateTelemetry(
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

    return true;
  }

  if (!gtaClient) {
    sendJson(
      response,
      503,
      {
        ok: false,
        error:
          'Module Discord GTA non prêt'
      }
    );

    return true;
  }

  const telemetry =
    body.telemetry &&
    typeof body.telemetry ===
      'object'
      ? body.telemetry
      : body;

  const memberResult =
    await findGtaMember(
      gtaClient,
      auth.discordId
    );

  if (!memberResult) {
    sendJson(
      response,
      403,
      {
        ok: false,
        error:
          'Utilisateur Discord introuvable'
      }
    );

    return true;
  }

  const {
    guild,
    member
  } =
    memberResult;

  if (
    !member.roles.cache.has(
      GTA_ROLE_ID
    )
  ) {
    sendJson(
      response,
      403,
      {
        ok: false,
        error:
          'Rôle GTA V requis'
      }
    );

    return true;
  }

  const category =
    findPlayerCategory(
      guild,
      member.id
    );

  if (!category) {
    sendJson(
      response,
      409,
      {
        ok: false,
        error:
          'Espace GTA non créé'
      }
    );

    return true;
  }

  if (!gtaClient.gtaBridge) {
    gtaClient.gtaBridge = {
      players: new Map(),
      previousStates:
        new Map(),
      messages: new Map()
    };
  }

  const receivedAt =
    new Date()
      .toISOString();

  const state = {
    ...telemetry,
    installationId:
      auth.installationId,
    receivedAt
  };

  const previous =
    gtaClient.gtaBridge
      .previousStates
      .get(
        auth.discordId
      );

  gtaClient.gtaBridge
    .players
    .set(
      auth.discordId,
      state
    );

  await updateGtaDiscord(
    gtaClient,
    member,
    category,
    state,
    previous,
    auth.installationId
  );

  try {
    await processGtaChallengeTelemetry(
      gtaClient,
      member,
      category,
      state
    );
  } catch (error) {
    console.error(
      '❌ Erreur traitement défis GTA :',
      error
    );
  }

  gtaClient.gtaBridge
    .previousStates
    .set(
      auth.discordId,
      state
    );

  auth.installation.lastSeen =
    receivedAt;

  auth.installation.lastTelemetryAt =
    receivedAt;

  auth.installation.edition =
    state.edition || null;

  auth.installation.bridgeVersion =
    state.bridgeVersion || null;

  saveData(
    auth.data
  );

  console.log('');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );
  console.log(
    '📡 DONNÉES GTA REÇUES'
  );
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );
  console.log(
    `👤 Discord : ${member.user.tag}`
  );
  console.log(
    `💻 Installation : ${auth.installationId}`
  );
  console.log(
    `🎮 Édition : ${state.edition || '?'}`
  );
  console.log(
    `❤️ Santé : ${state.player?.health ?? '?'}`
  );
  console.log(
    `🚗 Véhicule : ${state.vehicle?.displayName || state.vehicle?.model || 'À pied'}`
  );
  console.log(
    `🕒 ${receivedAt}`
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
      receivedAt
    }
  );

  return true;
}

// ─────────────────────────────────────
// RÉPONSE JSON
// ─────────────────────────────────────

function sendJson(
  response,
  status,
  data
) {
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
        'Content-Type, Authorization, X-Naru-GTA-Token, X-Naru-Installation-Id',

      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    }
  );

  response.end(
    payload
  );
}

// ─────────────────────────────────────
// ROUTES GTA
// ─────────────────────────────────────

async function handleGtaRequest(
  request,
  response
) {
  try {
    cleanExpiredRequests();

    const requestUrl =
      new URL(
        request.url,
        `http://${request.headers.host || 'localhost'}`
      );

    // On ne prend que les routes GTA.

    if (
      !requestUrl.pathname.startsWith(
        '/gta/'
      )
    ) {
      return false;
    }

    // ─────────────────────────────
    // OPTIONS
    // ─────────────────────────────

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

    // ─────────────────────────────
    // HEALTH
    // ─────────────────────────────

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

      return true;
    }

    // ─────────────────────────────
    // COMMENCER LIAISON
    // ─────────────────────────────

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

      return true;
    }

    // ─────────────────────────────
    // ÉTAT LIAISON
    // ─────────────────────────────

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
              'waiting'
          }
        );

        return true;
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
            link.token
        }
      );

      setTimeout(
        () => {
          pendingLinks.delete(
            requestId
          );
        },
        5000
      );

      return true;
    }

    // ─────────────────────────────
    // TÉLÉMÉTRIE GTA
    // ─────────────────────────────

    if (
      request.method ===
        'POST' &&
      requestUrl.pathname ===
        '/gta/telemetry'
    ) {
      return await handleTelemetry(
        request,
        response
      );
    }

    // Route GTA inconnue.

    sendJson(
      response,
      404,
      {
        ok: false,

        error:
          'Route GTA inconnue'
      }
    );

    return true;

  } catch (error) {
    console.error(
      '❌ Erreur route GTA :',
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
            'Erreur serveur GTA'
        }
      );
    }

    return true;
  }
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
// DÉMARRAGE MODULE
// ─────────────────────────────────────

function startGtaLink(
  client
) {
  gtaClient =
    client;

  if (!client.gtaBridge) {
    client.gtaBridge = {
      players:
        new Map(),

      previousStates:
        new Map(),

      messages:
        new Map()
    };
  }

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

  setInterval(
    cleanExpiredRequests,
    60 * 1000
  );
}

// ─────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────

module.exports = {
  startGtaLink,
  handleGtaRequest,
  hashToken,
  loadData,
  saveData
};
