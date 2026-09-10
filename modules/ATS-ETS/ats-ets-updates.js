const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// ============================================================
// NARU GAMING COMMAND — ATS / ETS2 UPDATES
// ============================================================

const ATS_CHANNEL_ID = '1546773813864308786';
const ETS2_CHANNEL_ID = '1546774133294235688';

const CHECK_INTERVAL_MS =
  15 * 60 * 1000;

const DATA_DIR =
  path.join(
    __dirname,
    'data'
  );

const STATE_FILE =
  path.join(
    DATA_DIR,
    'updates-state.json'
  );

const GAMES = {
  ats: {
    key: 'ats',
    name: 'American Truck Simulator',
    shortName: 'ATS',
    appId: 270880,
    channelId: ATS_CHANNEL_ID,
    emoji: '🇺🇸'
  },

  ets2: {
    key: 'ets2',
    name: 'Euro Truck Simulator 2',
    shortName: 'ETS2',
    appId: 227300,
    channelId: ETS2_CHANNEL_ID,
    emoji: '🇪🇺'
  }
};

const UPDATE_KEYWORDS = [
  'update',
  'patch',
  'hotfix',
  'open beta',
  'experimental beta',
  'beta update',
  'release',
  'version'
];

// ============================================================
// FICHIERS
// ============================================================

function ensureDataDirectory() {
  if (
    !fs.existsSync(
      DATA_DIR
    )
  ) {
    fs.mkdirSync(
      DATA_DIR,
      {
        recursive: true
      }
    );
  }
}

function loadState() {
  ensureDataDirectory();

  if (
    !fs.existsSync(
      STATE_FILE
    )
  ) {
    return {
      ats: {
        initialized: false,
        seen: []
      },

      ets2: {
        initialized: false,
        seen: []
      }
    };
  }

  try {
    const parsed =
      JSON.parse(
        fs.readFileSync(
          STATE_FILE,
          'utf8'
        )
      );

    return {
      ats: {
        initialized:
          Boolean(
            parsed?.ats?.initialized
          ),

        seen:
          Array.isArray(
            parsed?.ats?.seen
          )
            ? parsed.ats.seen
            : []
      },

      ets2: {
        initialized:
          Boolean(
            parsed?.ets2?.initialized
          ),

        seen:
          Array.isArray(
            parsed?.ets2?.seen
          )
            ? parsed.ets2.seen
            : []
      }
    };

  } catch (error) {
    console.error(
      '❌ ATS/ETS2 Updates : erreur lecture du fichier de sauvegarde :',
      error
    );

    return {
      ats: {
        initialized: false,
        seen: []
      },

      ets2: {
        initialized: false,
        seen: []
      }
    };
  }
}

function saveState(
  state
) {
  ensureDataDirectory();

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      state,
      null,
      2
    ),
    'utf8'
  );
}

// ============================================================
// NETTOYAGE DU TEXTE
// ============================================================

function decodeHtmlEntities(
  text
) {
  return String(
    text || ''
  )
    .replace(
      /&nbsp;/gi,
      ' '
    )
    .replace(
      /&amp;/gi,
      '&'
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      '<'
    )
    .replace(
      /&gt;/gi,
      '>'
    );
}

function stripSteamFormatting(
  text
) {
  return decodeHtmlEntities(
    String(
      text || ''
    )
      .replace(
        /\[img\].*?\[\/img\]/gis,
        ' '
      )
      .replace(
        /\[url=.*?\](.*?)\[\/url\]/gis,
        '$1'
      )
      .replace(
        /\[url\](.*?)\[\/url\]/gis,
        '$1'
      )
      .replace(
        /\[(\/)?(b|i|u|h1|h2|h3|list|olist|quote|code|table|tr|td|th|spoiler|strike|center|right|left)(=[^\]]+)?\]/gi,
        ' '
      )
      .replace(
        /<[^>]+>/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim()
  );
}

function truncate(
  text,
  maxLength
) {
  const value =
    String(
      text || ''
    ).trim();

  if (
    value.length <=
    maxLength
  ) {
    return value;
  }

  return (
    value
      .slice(
        0,
        maxLength - 1
      )
      .trimEnd() +
    '…'
  );
}

// ============================================================
// TRADUCTION FRANÇAISE
// ============================================================

async function translateToFrench(
  text
) {
  const clean =
    String(
      text || ''
    ).trim();

  if (!clean) {
    return '';
  }

  try {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      '?client=gtx' +
      '&sl=auto' +
      '&tl=fr' +
      '&dt=t' +
      '&q=' +
      encodeURIComponent(
        clean
      );

    const response =
      await fetch(
        url,
        {
          headers: {
            'User-Agent':
              'Naru-Gaming-Command/1.0'
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      !Array.isArray(
        data?.[0]
      )
    ) {
      return clean;
    }

    const translated =
      data[0]
        .map(
          part =>
            Array.isArray(
              part
            )
              ? part[0]
              : ''
        )
        .join('')
        .trim();

    return (
      translated ||
      clean
    );

  } catch (error) {
    console.warn(
      '⚠️ Traduction impossible :',
      error.message
    );

    return clean;
  }
}

// ============================================================
// RÉCUPÉRATION DES NEWS STEAM
// ============================================================

async function fetchSteamNews(
  game
) {
  const url =
    'https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/' +
    `?appid=${game.appId}` +
    '&count=30' +
    '&maxlength=3500' +
    '&format=json';

  const response =
    await fetch(
      url,
      {
        headers: {
          'User-Agent':
            'Naru-Gaming-Command/1.0'
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `Steam HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  const news =
    data
      ?.appnews
      ?.newsitems;

  if (
    !Array.isArray(
      news
    )
  ) {
    return [];
  }

  return news;
}

function isUpdateNews(
  newsItem
) {
  const title =
    String(
      newsItem?.title ||
      ''
    ).toLowerCase();

  return UPDATE_KEYWORDS.some(
    keyword =>
      title.includes(
        keyword
      )
  );
}

// ============================================================
// DISCORD
// ============================================================

async function getDiscordChannel(
  client,
  channelId
) {
  let channel =
    client.channels.cache.get(
      channelId
    );

  if (!channel) {
    try {
      channel =
        await client.channels.fetch(
          channelId
        );
    } catch {
      return null;
    }
  }

  if (
    !channel ||
    !channel.isTextBased()
  ) {
    return null;
  }

  return channel;
}

function getSteamDate(
  newsItem
) {
  const seconds =
    Number(
      newsItem?.date ||
      0
    );

  if (!seconds) {
    return null;
  }

  return new Date(
    seconds * 1000
  );
}

async function buildUpdateEmbed(
  game,
  newsItem
) {
  const originalTitle =
    stripSteamFormatting(
      newsItem?.title
    );

  const originalBody =
    truncate(
      stripSteamFormatting(
        newsItem?.contents
      ),
      1200
    );

  const translatedTitle =
    await translateToFrench(
      originalTitle
    );

  const translatedBody =
    await translateToFrench(
      originalBody
    );

  const publishedAt =
    getSteamDate(
      newsItem
    );

  const embed =
    new EmbedBuilder()
      .setTitle(
        truncate(
          `${game.emoji} ${translatedTitle}`,
          256
        )
      )
      .setDescription(
        truncate(
          translatedBody ||
          'Nouvelle mise à jour disponible.',
          3800
        )
      )
      .addFields(
        {
          name: '🎮 Jeu',
          value: game.name,
          inline: true
        },
        {
          name: '📢 Source',
          value: 'Steam / SCS Software',
          inline: true
        }
      )
      .setURL(
        newsItem?.url ||
        `https://store.steampowered.com/app/${game.appId}/`
      )
      .setFooter({
        text:
          'Naru Gaming Command • Mise à jour officielle'
      });

  if (
    publishedAt
  ) {
    embed.setTimestamp(
      publishedAt
    );
  }

  return embed;
}

// ============================================================
// INITIALISATION
// ============================================================

async function initializeGame(
  client,
  state,
  game,
  updateNews
) {
  const gameState =
    state[
      game.key
    ];

  const ids =
    updateNews
      .map(
        item =>
          String(
            item.gid
          )
      )
      .filter(
        Boolean
      );

  gameState.seen =
    Array.from(
      new Set(
        ids
      )
    ).slice(
      0,
      100
    );

  gameState.initialized =
    true;

  saveState(
    state
  );

  if (
    updateNews.length ===
    0
  ) {
    console.log(
      `ℹ️ ${game.shortName} : aucune mise à jour trouvée.`
    );

    return;
  }

  const latest =
    updateNews[0];

  const channel =
    await getDiscordChannel(
      client,
      game.channelId
    );

  if (!channel) {
    console.error(
      `❌ ${game.shortName} : salon ${game.channelId} introuvable.`
    );

    return;
  }

  const embed =
    await buildUpdateEmbed(
      game,
      latest
    );

  await channel.send({
    embeds: [
      embed
    ]
  });

  console.log(
    `✅ ${game.shortName} : dernière mise à jour publiée.`
  );
}

// ============================================================
// VÉRIFICATION
// ============================================================

async function checkGameUpdates(
  client,
  state,
  game
) {
  console.log(
    `🔎 Vérification ${game.shortName}...`
  );

  const news =
    await fetchSteamNews(
      game
    );

  const updateNews =
    news
      .filter(
        isUpdateNews
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.date ||
            0
          ) -
          Number(
            b.date ||
            0
          )
      );

  const newestFirst =
    [
      ...updateNews
    ].sort(
      (
        a,
        b
      ) =>
        Number(
          b.date ||
          0
        ) -
        Number(
          a.date ||
          0
        )
    );

  if (
    !state[
      game.key
    ].initialized
  ) {
    await initializeGame(
      client,
      state,
      game,
      newestFirst
    );

    return;
  }

  const seen =
    new Set(
      state[
        game.key
      ].seen.map(
        String
      )
    );

  const pending =
    updateNews.filter(
      item =>
        !seen.has(
          String(
            item.gid
          )
        )
    );

  if (
    pending.length ===
    0
  ) {
    console.log(
      `✅ ${game.shortName} : rien de nouveau.`
    );

    return;
  }

  const channel =
    await getDiscordChannel(
      client,
      game.channelId
    );

  if (!channel) {
    throw new Error(
      `Salon Discord introuvable : ${game.channelId}`
    );
  }

  for (
    const newsItem
    of pending
  ) {
    const embed =
      await buildUpdateEmbed(
        game,
        newsItem
      );

    await channel.send({
      embeds: [
        embed
      ]
    });

    state[
      game.key
    ].seen.unshift(
      String(
        newsItem.gid
      )
    );

    state[
      game.key
    ].seen =
      Array.from(
        new Set(
          state[
            game.key
          ].seen
        )
      ).slice(
        0,
        100
      );

    saveState(
      state
    );

    console.log(
      `📨 ${game.shortName} : ${newsItem.title}`
    );
  }
}

// ============================================================
// VÉRIFICATION ATS + ETS2
// ============================================================

let checking =
  false;

async function checkAllUpdates(
  client,
  state
) {
  if (
    checking
  ) {
    return;
  }

  checking =
    true;

  try {
    await checkGameUpdates(
      client,
      state,
      GAMES.ats
    );
  } catch (error) {
    console.error(
      '❌ ATS Updates :',
      error
    );
  }

  try {
    await checkGameUpdates(
      client,
      state,
      GAMES.ets2
    );
  } catch (error) {
    console.error(
      '❌ ETS2 Updates :',
      error
    );
  }

  checking =
    false;
}

// ============================================================
// DÉMARRAGE
// ============================================================

function startAtsEtsUpdates(
  client
) {
  console.log(
    '🚛 ATS / ETS2 Updates : module chargé'
  );

  console.log(
    `🇺🇸 ATS → ${ATS_CHANNEL_ID}`
  );

  console.log(
    `🇪🇺 ETS2 → ${ETS2_CHANNEL_ID}`
  );

  const state =
    loadState();

  setTimeout(
    () => {
      checkAllUpdates(
        client,
        state
      );
    },
    5000
  );

  const interval =
    setInterval(
      () => {
        checkAllUpdates(
          client,
          state
        );
      },
      CHECK_INTERVAL_MS
    );

  if (
    typeof interval.unref ===
    'function'
  ) {
    interval.unref();
  }
}

module.exports = {
  startAtsEtsUpdates,
  checkAllUpdates
};
