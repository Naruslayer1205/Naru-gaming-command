const http = require('http');

const {
  handleArkRequest
} = require('../ark/ark-bridge');

const {
  handleGtaBridgeRequest
} = require('../gta/gta-bridge');

const {
  handleAtsEtsBridgeRequest
} = require('../ATS-ETS/ats-ets-bridge');

const PORT =
  Number(process.env.SERVER_PORT) ||
  Number(process.env.BRIDGE_PORT) ||
  Number(process.env.PORT) ||
  25070;

const HOST = '0.0.0.0';

let server = null;

// ============================================================
// ENVOI JSON
// ============================================================

function sendJson(
  response,
  statusCode,
  data
) {
  if (
    response.headersSent
  ) {
    return;
  }

  const payload =
    JSON.stringify(
      data
    );

  response.writeHead(
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

  response.end(
    payload
  );
}

// ============================================================
// DÉMARRAGE DU BRIDGE HTTP COMMUN
// ============================================================

function startBridgeServer(
  client
) {
  if (
    server
  ) {
    console.log(
      '⚠️ Bridge HTTP commun déjà démarré.'
    );

    return server;
  }

  server =
    http.createServer(
      async (
        request,
        response
      ) => {
        try {

          // ==================================================
          // GTA V
          // ==================================================

          const gtaHandled =
            await handleGtaBridgeRequest(
              request,
              response
            );

          if (
            gtaHandled
          ) {
            return;
          }

          // ==================================================
          // ARK
          // ==================================================

          const arkHandled =
            await handleArkRequest(
              request,
              response
            );

          if (
            arkHandled
          ) {
            return;
          }

          // ==================================================
          // ATS / ETS2
          // ==================================================

          const truckHandled =
            await handleAtsEtsBridgeRequest(
              request,
              response
            );

          if (
            truckHandled
          ) {
            return;
          }

          // ==================================================
          // ROUTE INCONNUE
          // ==================================================

          sendJson(
            response,
            404,
            {
              ok:
                false,

              error:
                'Route Naru Gaming Command inconnue'
            }
          );

        } catch (
          error
        ) {
          console.error(
            '❌ Erreur Bridge HTTP commun :',
            error
          );

          if (
            !response.headersSent
          ) {
            sendJson(
              response,
              500,
              {
                ok:
                  false,

                error:
                  'Erreur interne Bridge HTTP commun'
              }
            );
          }
        }
      }
    );

  // ==========================================================
  // ERREURS SERVEUR
  // ==========================================================

  server.on(
    'error',
    error => {
      console.error(
        '❌ Bridge HTTP commun :',
        error
      );
    }
  );

  // ==========================================================
  // LISTEN
  // ==========================================================

  server.listen(
    PORT,
    HOST,
    () => {
      console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );

      console.log(
        '🌐 NARU GAMING COMMAND — BRIDGE HTTP'
      );

      console.log(
        `✅ Port public unique : ${PORT}`
      );

      console.log(
        '🦖 ARK      → /api/ark/...'
      );

      console.log(
        '🚘 GTA V    → /gta/...'
      );

      console.log(
        '🚛 ATS/ETS2 → /truck/...'
      );

      console.log(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );
    }
  );

  // ==========================================================
  // STOCKAGE SUR LE CLIENT DISCORD
  // ==========================================================

  client.bridgeServer =
    server;

  return server;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startBridgeServer
};
