const http = require('http');

const PORT =
  Number(process.env.ARK_BRIDGE_PORT) ||
  Number(process.env.PORT) ||
  3000;

const ARK_BRIDGE_SECRET =
  process.env.ARK_BRIDGE_SECRET;

function startArkBridge(client) {
  console.log('🦖 ARK Bridge : module chargé');

  if (!ARK_BRIDGE_SECRET) {
    console.error(
      '❌ Variable ARK_BRIDGE_SECRET manquante.'
    );
    return;
  }

  if (!client.arkBridge) {
    client.arkBridge = {
      players: new Map()
    };
  }

  const server = http.createServer(
    async (req, res) => {
      try {
        // ─────────────────────────────
        // HEALTH CHECK
        // ─────────────────────────────

        if (
          req.method === 'GET' &&
          req.url === '/api/ark/status'
        ) {
          return sendJson(
            res,
            200,
            {
              success: true,
              service: 'Naru ARK Bridge',
              connectedPlayers:
                client.arkBridge.players.size
            }
          );
        }

        // ─────────────────────────────
        // ARK UPDATE
        // ─────────────────────────────

        if (
          req.method === 'POST' &&
          req.url === '/api/ark/update'
        ) {
          const authHeader =
            req.headers[
              'x-ark-bridge-secret'
            ];

          if (
            !authHeader ||
            authHeader !== ARK_BRIDGE_SECRET
          ) {
            console.log(
              '⛔ ARK Bridge : tentative non autorisée'
            );

            return sendJson(
              res,
              401,
              {
                success: false,
                error: 'Unauthorized'
              }
            );
          }

          const body =
            await readJsonBody(req);

          if (!body) {
            return sendJson(
              res,
              400,
              {
                success: false,
                error: 'JSON invalide'
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
                success: false,
                error:
                  'discordUserId manquant'
              }
            );
          }

          const receivedAt =
            new Date().toISOString();

          const state = {
            ...body,
            receivedAt
          };

          client.arkBridge.players.set(
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
            `👤 Discord : ${discordUserId}`
          );

          console.log(
            `🗺️ Map : ${
              body.map || '?'
            }`
          );

          console.log(
            `👤 Joueurs : ${
              body.ark?.players?.length ?? 0
            }`
          );

          console.log(
            `🦖 Dinos tamés : ${
              body.ark?.dinos?.tamed?.length ?? 0
            }`
          );

          console.log(
            `🌿 Dinos sauvages : ${
              body.ark?.dinos?.wild?.length ?? 0
            }`
          );

          console.log(
            `🕒 ${receivedAt}`
          );

          return sendJson(
            res,
            200,
            {
              success: true,
              message:
                'Données ARK reçues'
            }
          );
        }

        return sendJson(
          res,
          404,
          {
            success: false,
            error: 'Not found'
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
            success: false,
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

function readJsonBody(req) {
  return new Promise(
    (resolve, reject) => {
      let data = '';

      req.on(
        'data',
        chunk => {
          data += chunk;

          if (
            data.length >
            10 * 1024 * 1024
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
            const json =
              JSON.parse(data);

            resolve(json);
          } catch {
            resolve(null);
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
    JSON.stringify(data);

  res.writeHead(
    statusCode,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(payload)
    }
  );

  res.end(payload);
}

module.exports = startArkBridge;
