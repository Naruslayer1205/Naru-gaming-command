const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} = require('discord.js');

const startArkUpdates =
  require('./modules/ark/ark-updates');

const startArkBridge =
  require('./modules/ark/ark-bridge');

const startGtaUpdates =
  require('./modules/gta/gta-updates');

const {
  startGtaChallenges
} =
  require('./modules/gta/gta-challenges');

const {
  startGtaLink
} =
  require('./modules/gta/gta-link');

const {
  startGtaBridge
} =
  require('./modules/gta/gta-bridge');

const {
  startAtsEtsUpdates
} =
  require('./modules/ATS-ETS/ats-ets-updates');

const {
  startAtsEtsLink
} =
  require('./modules/ATS-ETS/ats-ets-link');

const {
  startAtsEtsBridge
} =
  require('./modules/ATS-ETS/ats-ets-bridge');

const {
  startPlayerSpaces
} =
  require('./modules/player-spaces');

// ============================================================
// CLIENT DISCORD
// ============================================================

const client =
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers
    ]
  });

// ============================================================
// READY
// ============================================================

client.once(
  Events.ClientReady,
  async readyClient => {
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    console.log(
      '🎮 NARU GAMING COMMAND'
    );

    console.log(
      `✅ Connecté en tant que ${readyClient.user.tag}`
    );

    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );

    readyClient.user.setActivity({
      name:
        'Naru Gaming Command',
      type:
        ActivityType.Watching
    });

    // ========================================================
    // ARK
    // ========================================================

    startArkUpdates(
      readyClient
    );

    startArkBridge(
      readyClient
    );

    // ========================================================
    // GTA V
    // ========================================================

    startGtaUpdates(
      readyClient
    );

    startGtaChallenges(
      readyClient
    );

    startGtaLink(
      readyClient
    );

    startGtaBridge(
      readyClient
    );

    // ========================================================
    // ATS / ETS2
    // ========================================================

    startAtsEtsUpdates(
      readyClient
    );

    startAtsEtsLink(
      readyClient
    );

    startAtsEtsBridge(
      readyClient
    );

    // ========================================================
    // PLAYER SPACES GÉNÉRAL
    // ========================================================

    startPlayerSpaces(
      readyClient
    );
  }
);

client.on(
  'error',
  error => {
    console.error(
      '❌ Erreur Discord :',
      error
    );
  }
);

process.on(
  'unhandledRejection',
  error => {
    console.error(
      '❌ Promesse rejetée :',
      error
    );
  }
);

process.on(
  'uncaughtException',
  error => {
    console.error(
      '❌ Exception non gérée :',
      error
    );
  }
);

if (!process.env.DISCORD_TOKEN) {
  console.error(
    '❌ Variable DISCORD_TOKEN manquante.'
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);
