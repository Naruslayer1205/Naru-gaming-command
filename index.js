const {
  Client,
  GatewayIntentBits,
  Events,
  ActivityType
} = require('discord.js');

// ─────────────────────────────
// ARK
// ─────────────────────────────

const startArkUpdates =
  require('./modules/ark/ark-updates');

const startArkBridge =
  require('./modules/ark/ark-bridge');

const {
  startArkPlayerSpaces
} =
  require('./modules/ark/player-spaces');

// ─────────────────────────────
// GTA V
// ─────────────────────────────

const startGtaUpdates =
  require('./modules/gta/gta-updates');

const {
  startGtaPlayerSpaces
} =
  require('./modules/gta/player-spaces');

const {
  startGtaChallenges
} =
  require('./modules/gta/gta-challenges');

const {
  startGtaLink
} =
  require('./modules/gta/gta-link');

// ─────────────────────────────
// ATS / ETS2
// ─────────────────────────────

const {
  startAtsEtsUpdates
} =
  require('./modules/ATS-ETS/ats-ets-updates');

const {
  startAtsEtsPlayerSpaces
} =
  require('./modules/ATS-ETS/player-spaces');

// ─────────────────────────────
// CLIENT DISCORD
// ─────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

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

    // ─────────────────────────────
    // ARK
    // ─────────────────────────────

    startArkUpdates(
      readyClient
    );

    startArkBridge(
      readyClient
    );

    startArkPlayerSpaces(
      readyClient
    );

    // ─────────────────────────────
    // GTA V
    // ─────────────────────────────

    startGtaUpdates(
      readyClient
    );

    startGtaPlayerSpaces(
      readyClient
    );

    startGtaChallenges(
      readyClient
    );

    startGtaLink(
      readyClient
    );

    // ─────────────────────────────
    // ATS / ETS2
    // ─────────────────────────────

    startAtsEtsUpdates(
      readyClient
    );

    startAtsEtsPlayerSpaces(
      readyClient
    );
  }
);

// ─────────────────────────────
// GESTION DES ERREURS
// ─────────────────────────────

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

// ─────────────────────────────
// TOKEN DISCORD
// ─────────────────────────────

if (
  !process.env.DISCORD_TOKEN
) {
  console.error(
    '❌ Variable DISCORD_TOKEN manquante.'
  );

  process.exit(1);
}

client.login(
  process.env.DISCORD_TOKEN
);
