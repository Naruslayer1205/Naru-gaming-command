const { URL } = require('url');
const { ChannelType } = require('discord.js');

const {
  findPlayerCategory
} = require('./player-spaces');

const {
  processGtaChallengeTelemetry
} = require('./gta-challenges');

const {
  handleGtaLinkRequest,
  authenticateGta,
  saveData
} = require('./gta-link');

// ============================================================
// NARU GAMING COMMAND
// GTA V — BRIDGE HTTP / TELEMETRY
// ============================================================

const GTA_ROLE_ID =
  '1546760047105806366';

const MAX_BODY_SIZE = 1024 * 1024;

let gtaClient = null;

const CHANNELS = {
  character:
    '👤・personnage',
  position:
    '📍・position',
  vehicle:
    '🚗・vehicule',
  statistics:
    '📊・statistiques',
  mods:
    '🧩・mods',
  journal:
    '📜・journal',
  commands:
    '⚙️・commandes'
};

// ============================================================
// JSON / BODY
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

function readJsonBody(
  request
) {
  return new Promise(
    (resolve, reject) => {
      let body = '';
      let size = 0;
      let finished = false;

      request.on(
        'data',
        chunk => {
          if (finished) {
            return;
          }

          size += chunk.length;

          if (size > MAX_BODY_SIZE) {
            finished = true;
            reject(
              new Error(
                'BODY_TOO_LARGE'
              )
            );
            request.destroy();
            return;
          }

          body +=
            chunk.toString('utf8');
        }
      );

      request.on(
        'end',
        () => {
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
            resolve(null);
          }
        }
      );

      request.on(
        'error',
        error => {
          if (finished) {
            return;
          }

          finished = true;
          reject(error);
        }
      );
    }
  );
}

// ============================================================
// DISCORD HELPERS
// ============================================================

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

  const parsed = Number(input);

  if (Number.isNaN(parsed)) {
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

function yesNo(input) {
  if (
    input === null ||
    input === undefined
  ) {
    return 'Non disponible';
  }

  return input ? 'Oui' : 'Non';
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
    Math.floor(total / 3600);

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

function unix(date) {
  const timestamp =
    new Date(
      date || Date.now()
    ).getTime();

  if (Number.isNaN(timestamp)) {
    return Math.floor(
      Date.now() / 1000
    );
  }

  return Math.floor(
    timestamp / 1000
  );
}

function limitDiscord(content) {
  if (content.length <= 1950) {
    return content;
  }

  return (
    content.slice(0, 1850) +
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
      previousStates: new Map(),
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
    await message.edit(content);

    client.gtaBridge
      .messages
      .set(
        key,
        message.id
      );

    return;
  }

  const newMessage =
    await channel.send(content);

  client.gtaBridge
    .messages
    .set(
      key,
      newMessage.id
    );
}

// ============================================================
// DISCORD MESSAGES
// ============================================================

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
    `⭐ **Recherche :** ${number(player.wantedLevel, 0)} / 5`,
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

  if (!vehicle.inVehicle) {
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

function buildModsMessage(
  state
) {
  const mods =
    state.mods || {};

  const root =
    Array.isArray(mods.root)
      ? mods.root
      : [];

  const scripts =
    Array.isArray(mods.scripts)
      ? mods.scripts
      : [];

  const total =
    Number.isFinite(
      Number(mods.count)
    )
      ? Number(mods.count)
      : root.length + scripts.length;

  const lines = [
    '# 🧩 Mods GTA V',
    '',
    `📦 **Mods détectés : ${total}**`,
    ''
  ];

  if (root.length) {
    lines.push(
      '## 📁 Racine GTA',
      ''
    );

    for (
      const mod
      of root.slice(0, 25)
    ) {
      const name =
        value(
          mod?.name || mod?.file,
          'Mod inconnu'
        );

      const type =
        value(
          mod?.type,
          'Mod'
        );

      lines.push(
        `• **${name}** — ${type}`
      );
    }

    if (root.length > 25) {
      lines.push(
        `• … +${root.length - 25} autre(s)`
      );
    }

    lines.push('');
  }

  if (scripts.length) {
    lines.push(
      '## 📜 Dossier scripts',
      ''
    );

    for (
      const mod
      of scripts.slice(0, 25)
    ) {
      const name =
        value(
          mod?.name || mod?.file,
          'Mod inconnu'
        );

      const type =
        value(
          mod?.type,
          'Script'
        );

      lines.push(
        `• **${name}** — ${type}`
      );
    }

    if (scripts.length > 25) {
      lines.push(
        `• … +${scripts.length - 25} autre(s)`
      );
    }

    lines.push('');
  }

  if (!root.length && !scripts.length) {
    lines.push(
      'Aucun mod détecté actuellement.',
      ''
    );
  }

  lines.push(
    `🔄 Dernière synchronisation : <t:${unix(state.receivedAt)}:R>`
  );

  return limitDiscord(
    lines.join('\n')
  );
}

async function ensureModsChannel(
  guild,
  category
) {
  let channel =
    getChannel(
      guild,
      category,
      CHANNELS.mods
    );

  if (channel) {
    return channel;
  }

  try {
    channel =
      await guild.channels.create({
        name:
          CHANNELS.mods,
        type:
          ChannelType.GuildText,
        parent:
          category.id,
        reason:
          'Naru GTA Bridge — salon mods automatique'
      });

    console.log(
      `✅ GTA : salon ${CHANNELS.mods} créé dans ${category.name}`
    );

    return channel;
  } catch (error) {
    console.error(
      '❌ GTA : impossible de créer le salon mods :',
      error
    );

    return null;
  }
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
    previous.player?.isDead;

  const newDead =
    state.player?.isDead;

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
    value(oldVehicle.plate, '') !==
      value(newVehicle.plate, '')
  ) {
    events.push(
      `🚘 Changement de véhicule : **${value(newVehicle.displayName || newVehicle.model)}**.`
    );
  }

  const oldWeapon =
    previous.weapon?.name;

  const newWeapon =
    state.weapon?.name;

  if (
    oldWeapon &&
    newWeapon &&
    oldWeapon !== newWeapon
  ) {
    events.push(
      `🔫 Arme équipée : **${newWeapon}**.`
    );
  }

  const oldZone =
    previous.position?.zone;

  const newZone =
    state.position?.zone;

  if (
    oldZone &&
    newZone &&
    oldZone !== newZone
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
  const guild = member.guild;

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

  const mods =
    await ensureModsChannel(
      guild,
      category
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
      buildPositionMessage(state)
    );
  }

  if (vehicle) {
    await upsertGtaMessage(
      client,
      member.id,
      vehicle,
      'vehicle',
      buildVehicleMessage(state)
    );
  }

  if (statistics) {
    await upsertGtaMessage(
      client,
      member.id,
      statistics,
      'statistics',
      buildStatisticsMessage(state)
    );
  }

  if (mods) {
    await upsertGtaMessage(
      client,
      member.id,
      mods,
      'mods',
      buildModsMessage(
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
      await readJsonBody(request);
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
            'Payload GTA trop volumineux'
        }
      );
      return;
    }

    throw error;
  }

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
    return;
  }

  const auth =
    authenticateGta(
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
    return;
  }

  const telemetry =
    body.telemetry &&
    typeof body.telemetry === 'object'
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
    return;
  }

  const {
    guild,
    member
  } = memberResult;

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
    return;
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
    return;
  }

  if (!gtaClient.gtaBridge) {
    gtaClient.gtaBridge = {
      players: new Map(),
      previousStates: new Map(),
      messages: new Map()
    };
  }

  const receivedAt =
    new Date().toISOString();

  const state = {
    ...telemetry,
    installationId:
      auth.installationId,
    receivedAt
  };

  const previous =
    gtaClient.gtaBridge
      .previousStates
      .get(auth.discordId);

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

  saveData(auth.data);

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
    `🔌 Bridge : ${state.bridgeVersion || '?'}`
  );
  console.log(
    `⭐ Recherche : ${state.player?.wantedLevel ?? 0}`
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
      !requestUrl.pathname.startsWith(
        '/gta/'
      )
    ) {
      sendJson(
        response,
        404,
        {
          ok: false,
          error:
            'Route Naru GTA Bridge inconnue'
        }
      );
      return;
    }

    if (request.method === 'OPTIONS') {
      sendJson(
        response,
        200,
        { ok: true }
      );
      return;
    }

    if (
      request.method === 'GET' &&
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

    if (
      requestUrl.pathname.startsWith(
        '/gta/link/'
      )
    ) {
      const handled =
        await handleGtaLinkRequest(
          request,
          response
        );

      if (handled) {
        return;
      }
    }

    if (
      request.method === 'POST' &&
      requestUrl.pathname ===
        '/gta/telemetry'
    ) {
      await handleTelemetry(
        request,
        response
      );
      return;
    }

    sendJson(
      response,
      404,
      {
        ok: false,
        error:
          'Route GTA inconnue'
      }
    );
  } catch (error) {
    console.error(
      '❌ Erreur GTA Bridge :',
      error
    );

    if (!response.headersSent) {
      sendJson(
        response,
        500,
        {
          ok: false,
          error:
            'Erreur serveur GTA Bridge'
        }
      );
    }
  }
}

// ============================================================
// START / ROUTEUR PARTAGÉ
// ============================================================

function startGtaBridge(
  client
) {
  gtaClient = client;

  if (!client.gtaBridge) {
    client.gtaBridge = {
      players: new Map(),
      previousStates: new Map(),
      messages: new Map()
    };
  }

  console.log(
    '🚘 GTA Bridge : module chargé'
  );
}

async function handleGtaBridgeRequest(
  request,
  response
) {
  if (
    !request.url ||
    !request.url.startsWith('/gta/')
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
  startGtaBridge,
  handleGtaBridgeRequest,
  handleRequest,
  handleTelemetry
};
