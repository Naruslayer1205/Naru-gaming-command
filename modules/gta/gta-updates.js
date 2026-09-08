const {
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const config = require('./config');

let checking = false;
let interval = null;


// ======================================================
// OUTILS
// ======================================================

function ensureDataFolder() {
  fs.mkdirSync(
    path.dirname(config.stateFile),
    {
      recursive: true
    }
  );
}


function decodeHtml(text = '') {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x27;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .trim();
}


function stripHtml(html = '') {
  return decodeHtml(
    html
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        ' '
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        ' '
      )
      .replace(
        /<[^>]+>/g,
        ' '
      )
  )
    .replace(/\s+/g, ' ')
    .trim();
}


function truncate(
  text,
  max
) {
  if (!text) {
    return '';
  }

  if (text.length <= max) {
    return text;
  }

  return (
    text
      .slice(
        0,
        max - 1
      )
      .trim() +
    '…'
  );
}


// ======================================================
// ETAT / ANTI DOUBLON
// ======================================================

function defaultState() {
  return {
    initialized: false,

    lastArticleUrl: null,

    published: []
  };
}


function loadState() {
  ensureDataFolder();

  if (
    !fs.existsSync(
      config.stateFile
    )
  ) {
    return defaultState();
  }

  try {
    const state =
      JSON.parse(
        fs.readFileSync(
          config.stateFile,
          'utf8'
        )
      );

    return {
      initialized:
        Boolean(
          state.initialized
        ),

      lastArticleUrl:
        state.lastArticleUrl ||
        null,

      published:
        Array.isArray(
          state.published
        )
          ? state.published
          : []
    };
  } catch (error) {
    console.log(
      `⚠️ GTA : impossible de lire l'état : ${error.message}`
    );

    return defaultState();
  }
}


function saveState(state) {
  ensureDataFolder();

  try {
    fs.writeFileSync(
      config.stateFile,

      JSON.stringify(
        state,
        null,
        2
      )
    );
  } catch (error) {
    console.log(
      `⚠️ GTA : impossible de sauvegarder l'état : ${error.message}`
    );
  }
}


// ======================================================
// GRAPHQL ROCKSTAR
// ======================================================

async function fetchNewswireGraphQL() {

  console.log(
    '🌐 GTA : connexion au GraphQL Rockstar...'
  );

  const query = `
    query NewswireList(
      $locale: String!,
      $page: Int!,
      $pageSize: Int!
    ) {
      posts(
        locale: $locale,
        page: $page,
        pageSize: $pageSize
      ) {
        results {
          id
          title
          slug
          url
          excerpt
          publishDate
          category {
            name
          }
          primaryImage {
            url
          }
        }
      }
    }
  `;


  const body = {
    query,

    variables: {
      locale: 'en_us',
      page: 1,
      pageSize: 30
    }
  };


  const response =
    await fetch(
      'https://graph.rockstargames.com/',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'Origin':
            'https://www.rockstargames.com',

          'Referer':
            'https://www.rockstargames.com/',

          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },

        body:
          JSON.stringify(
            body
          )
      }
    );


  if (!response.ok) {

    const text =
      await response.text();

    throw new Error(
      `GraphQL HTTP ${response.status} : ${text.slice(0, 300)}`
    );
  }


  const data =
    await response.json();


  if (data.errors) {

    console.log(
      '❌ GTA GraphQL errors :',
      JSON.stringify(
        data.errors,
        null,
        2
      )
    );

    throw new Error(
      'Le GraphQL Rockstar a refusé la requête.'
    );
  }


  return data;
}


// ======================================================
// EXTRACTION FLEXIBLE
// ======================================================

function findPostArray(obj) {

  if (!obj) {
    return null;
  }


  if (Array.isArray(obj)) {

    if (
      obj.length > 0 &&
      typeof obj[0] ===
        'object'
    ) {
      return obj;
    }

    return null;
  }


  if (
    typeof obj !==
    'object'
  ) {
    return null;
  }


  for (
    const value
    of Object.values(obj)
  ) {

    const result =
      findPostArray(value);

    if (result) {
      return result;
    }
  }


  return null;
}


// ======================================================
// DETECTION GTA
// ======================================================

function getArticleCategory(article) {

  return (
    article?.category?.name ||
    article?.category ||
    article?.game?.title ||
    article?.game ||
    ''
  )
    .toString()
    .toLowerCase();
}


function getArticleTitle(article) {

  return (
    article.title ||
    article.name ||
    ''
  )
    .toString();
}


function getArticleText(article) {

  return stripHtml(
    [
      getArticleTitle(article),

      article.excerpt ||
      article.description ||
      article.summary ||
      '',

      getArticleCategory(article)
    ]
      .join(' ')
  )
    .toLowerCase();
}


function isGtaVOrOnline(article) {

  const text =
    getArticleText(
      article
    );


  const gtaOnline =
    text.includes(
      'gta online'
    ) ||
    text.includes(
      'grand theft auto online'
    );


  const gtaV =
    text.includes(
      'grand theft auto v'
    ) ||
    text.includes(
      'gtav'
    ) ||
    text.includes(
      'gta v'
    );


  const gtaVI =
    text.includes(
      'grand theft auto vi'
    ) ||
    text.includes(
      'gta vi'
    );


  if (gtaOnline) {
    return true;
  }


  if (
    gtaV &&
    !gtaVI
  ) {
    return true;
  }


  return false;
}


// ======================================================
// URL ARTICLE
// ======================================================

function buildArticleUrl(article) {

  if (
    article.url &&
    article.url.startsWith(
      'http'
    )
  ) {
    return article.url;
  }


  if (
    article.url &&
    article.url.startsWith(
      '/'
    )
  ) {
    return (
      'https://www.rockstargames.com' +
      article.url
    );
  }


  if (
    article.id &&
    article.slug
  ) {
    return (
      'https://www.rockstargames.com/newswire/article/' +
      article.id +
      '/' +
      article.slug
    );
  }


  return null;
}


// ======================================================
// IMAGE
// ======================================================

function getImage(article) {

  return (
    article?.primaryImage?.url ||
    article?.image?.url ||
    article?.image ||
    article?.heroImage?.url ||
    null
  );
}


// ======================================================
// DATE
// ======================================================

function getDate(article) {

  const value =
    article.publishDate ||
    article.publishedAt ||
    article.date ||
    article.createdAt;


  if (!value) {
    return null;
  }


  const date =
    new Date(
      value
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }


  return date;
}


function formatDate(date) {

  if (!date) {
    return (
      'Date Rockstar non détectée'
    );
  }


  return (
    new Intl.DateTimeFormat(
      'fr-FR',
      {
        day:
          '2-digit',

        month:
          'long',

        year:
          'numeric',

        timeZone:
          'Europe/Paris'
      }
    )
      .format(
        date
      )
  );
}


// ======================================================
// TRADUCTION
// ======================================================

async function translateText(text) {

  if (
    !text ||
    text.length < 2
  ) {
    return text;
  }


  try {

    const response =
      await fetch(
        'https://api.mymemory.translated.net/get' +
        `?q=${encodeURIComponent(text)}` +
        '&langpair=en%7Cfr',
        {
          headers: {
            'User-Agent':
              'NaruGamingCommand/3.0'
          }
        }
      );


    if (!response.ok) {
      return text;
    }


    const data =
      await response.json();


    const translated =
      data?.responseData
        ?.translatedText;


    if (!translated) {
      return text;
    }


    return decodeHtml(
      translated
    );

  } catch (error) {

    console.log(
      `⚠️ GTA traduction : ${error.message}`
    );

    return text;
  }
}


// ======================================================
// CREATION ARTICLE
// ======================================================

async function normalizeArticle(
  article
) {

  const url =
    buildArticleUrl(
      article
    );


  if (!url) {
    return null;
  }


  const title =
    getArticleTitle(
      article
    );


  const rawDescription =
    stripHtml(
      article.excerpt ||
      article.description ||
      article.summary ||
      ''
    );


  console.log(
    `🇫🇷 GTA : traduction de "${title}"...`
  );


  const translatedTitle =
    await translateText(
      title
    );


  const translatedDescription =
    rawDescription
      ? await translateText(
          truncate(
            rawDescription,
            450
          )
        )
      : (
          'Une nouvelle actualité officielle GTA Online vient d’être publiée par Rockstar Games.'
        );


  return {
    canonicalUrl:
      url,

    url:
      url.replace(
        'https://www.rockstargames.com/newswire/',
        'https://www.rockstargames.com/fr/newswire/'
      ),

    title:
      translatedTitle,

    description:
      translatedDescription,

    image:
      getImage(
        article
      ),

    publishedAt:
      getDate(
        article
      )
  };
}


// ======================================================
// EMBED
// ======================================================

function createGtaEmbed(
  article
) {

  const embed =
    new EmbedBuilder()

      .setColor(
        config.color
      )

      .setAuthor({
        name:
          '🌴 GRAND THEFT AUTO V • GTA ONLINE'
      })

      .setTitle(
        truncate(
          article.title,
          250
        )
      )

      .setURL(
        article.url
      )

      .setDescription(
        truncate(
          article.description,
          3500
        )
      )

      .addFields(

        {
          name:
            '🎮 Jeu',

          value:
            'Grand Theft Auto V • GTA Online',

          inline:
            true
        },


        {
          name:
            '📅 Publication',

          value:
            formatDate(
              article.publishedAt
            ),

          inline:
            true
        },


        {
          name:
            '🇫🇷 Langue',

          value:
            'Traduction française',

          inline:
            false
        },


        {
          name:
            '⭐ Source officielle',

          value:
            `[Rockstar Games Newswire](${article.url})`,

          inline:
            false
        }

      )

      .setFooter({
        text:
          '🌴 Los Santos • Naru Gaming Command • GTA Updates'
      })

      .setTimestamp();


  if (
    article.image &&
    /^https?:\/\//i.test(
      article.image
    )
  ) {

    embed.setImage(
      article.image
    );
  }


  return embed;
}


// ======================================================
// RECHERCHE DERNIER ARTICLE GTA
// ======================================================

async function findLatestGtaArticle() {

  const data =
    await fetchNewswireGraphQL();


  console.log(
    '📦 GTA : réponse GraphQL reçue.'
  );


  const articles =
    findPostArray(
      data?.data
    );


  if (
    !articles ||
    articles.length === 0
  ) {

    console.log(
      '📦 GTA GraphQL brut :',
      JSON.stringify(
        data,
        null,
        2
      ).slice(
        0,
        3000
      )
    );


    throw new Error(
      'Aucun article trouvé dans la réponse GraphQL Rockstar.'
    );
  }


  console.log(
    `📰 GTA : ${articles.length} article(s) Rockstar reçu(s).`
  );


  for (
    const article
    of articles
  ) {

    const title =
      getArticleTitle(
        article
      );


    console.log(
      `🔎 GTA : ${title}`
    );


    if (
      !isGtaVOrOnline(
        article
      )
    ) {

      console.log(
        '⏭️ GTA : hors GTA V / GTA Online.'
      );

      continue;
    }


    console.log(
      `✅ GTA Online détecté : ${title}`
    );


    return (
      await normalizeArticle(
        article
      )
    );
  }


  return null;
}


// ======================================================
// CHECK PRINCIPAL
// ======================================================

async function checkGtaUpdates(
  client
) {

  if (checking) {

    console.log(
      '⏳ GTA : vérification déjà en cours.'
    );

    return;
  }


  checking =
    true;


  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    '🌴 GTA UPDATES • Vérification'
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );


  try {

    const channel =
      await client.channels.fetch(
        config.channelId
      );


    if (
      !channel ||
      !channel.isTextBased()
    ) {

      console.log(
        `❌ GTA : salon ${config.channelId} introuvable.`
      );

      return;
    }


    const latest =
      await findLatestGtaArticle();


    if (!latest) {

      console.log(
        '❌ GTA : aucune actualité GTA V / GTA Online trouvée.'
      );

      return;
    }


    const state =
      loadState();


    // ==================================================
    // PREMIER DEMARRAGE
    // ==================================================

    if (
      !state.initialized
    ) {

      state.initialized =
        true;


      state.lastArticleUrl =
        latest.canonicalUrl;


      state.published =
        [
          latest.canonicalUrl
        ];


      saveState(
        state
      );


      console.log(
        `✅ GTA initialisé sur : ${latest.title}`
      );


      console.log(
        'ℹ️ GTA : aucune ancienne actualité envoyée.'
      );


      return;
    }


    // ==================================================
    // ANTI DOUBLON
    // ==================================================

    if (
      state.lastArticleUrl ===
        latest.canonicalUrl ||

      state.published.includes(
        latest.canonicalUrl
      )
    ) {

      console.log(
        `✅ GTA : "${latest.title}" déjà publiée.`
      );


      return;
    }


    // ==================================================
    // ENVOI
    // ==================================================

    await channel.send({

      embeds: [

        createGtaEmbed(
          latest
        )

      ]
    });


    console.log(
      `📢 GTA : "${latest.title}" publiée !`
    );


    // ==================================================
    // SAUVEGARDE
    // ==================================================

    state.lastArticleUrl =
      latest.canonicalUrl;


    state.published.unshift(
      latest.canonicalUrl
    );


    state.published =
      [
        ...new Set(
          state.published
        )
      ]
        .slice(
          0,
          100
        );


    saveState(
      state
    );


  } catch (error) {

    console.error(
      `❌ Erreur GTA : ${error.message}`
    );

  } finally {

    checking =
      false;
  }
}


// ======================================================
// DEMARRAGE
// ======================================================

function startGtaUpdates(
  client
) {

  console.log(
    '🌴 Module GTA Updates chargé.'
  );


  checkGtaUpdates(
    client
  );


  if (!interval) {

    interval =
      setInterval(

        () =>
          checkGtaUpdates(
            client
          ),

        config.checkInterval

      );
  }
}


module.exports =
  startGtaUpdates;
