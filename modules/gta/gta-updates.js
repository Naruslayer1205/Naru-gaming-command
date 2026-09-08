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
  return String(text)
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
    String(html)
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        ' '
      )
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        ' '
      )
      .replace(
        /<br\s*\/?>/gi,
        '\n'
      )
      .replace(
        /<\/p>/gi,
        '\n'
      )
      .replace(
        /<[^>]+>/g,
        ' '
      )
  )
    .replace(/\s+/g, ' ')
    .trim();
}


function truncate(text, max) {
  if (!text) {
    return '';
  }

  if (text.length <= max) {
    return text;
  }

  return (
    text
      .slice(0, max - 1)
      .trim() +
    '…'
  );
}


async function wait(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}


async function fetchPage(url) {
  const response =
    await fetch(
      url,
      {
        redirect: 'follow',

        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36',

          'Accept':
            'text/html,application/xhtml+xml',

          'Accept-Language':
            'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',

          'Cache-Control':
            'no-cache'
        }
      }
    );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} sur ${url}`
    );
  }

  return await response.text();
}


// ======================================================
// ANTI-DOUBLON
// ======================================================

function defaultState() {
  return {
    initialized: false,

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

      published:
        Array.isArray(
          state.published
        )
          ? state.published
          : []
    };

  } catch (error) {

    console.log(
      `⚠️ GTA : état illisible : ${error.message}`
    );

    return defaultState();
  }
}


function saveState(state) {
  ensureDataFolder();

  fs.writeFileSync(
    config.stateFile,

    JSON.stringify(
      state,
      null,
      2
    )
  );
}


// ======================================================
// GRAPHQL ROCKSTAR
//
// IMPORTANT :
//
// Rockstar accepte actuellement :
// id
// title
// slug
//
// On ne demande RIEN D'AUTRE.
// ======================================================

async function fetchNewswirePage(page = 1) {

  console.log(
    `🌐 GTA : récupération GraphQL Rockstar • page ${page}...`
  );


  const query = `
    query NewswirePosts(
      $locale: String!,
      $page: Int!
    ) {
      posts(
        locale: $locale,
        page: $page
      ) {
        results {
          id
          title
          slug
        }
      }
    }
  `;


  const response =
    await fetch(
      'https://graph.rockstargames.com/',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'Origin':
            'https://www.rockstargames.com',

          'Referer':
            'https://www.rockstargames.com/newswire',

          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'
        },

        body:
          JSON.stringify({
            query,

            variables: {
              locale: 'en_us',
              page
            }
          })
      }
    );


  const raw =
    await response.text();


  if (!response.ok) {
    throw new Error(
      `GraphQL HTTP ${response.status} : ${raw.slice(0, 500)}`
    );
  }


  let data;

  try {
    data =
      JSON.parse(raw);
  } catch {
    throw new Error(
      `Réponse GraphQL non JSON : ${raw.slice(0, 500)}`
    );
  }


  if (
    Array.isArray(data.errors) &&
    data.errors.length > 0
  ) {

    console.log(
      '❌ GTA GraphQL :',
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


  const results =
    data?.data?.posts?.results;


  if (!Array.isArray(results)) {

    console.log(
      '📦 GTA réponse GraphQL :',
      JSON.stringify(
        data,
        null,
        2
      ).slice(0, 3000)
    );

    throw new Error(
      'Format de réponse GraphQL inattendu.'
    );
  }


  console.log(
    `📰 GTA : ${results.length} article(s) reçu(s) sur la page ${page}.`
  );


  return results;
}


// ======================================================
// META HTML
// ======================================================

function getMeta(
  html,
  property
) {

  const escaped =
    property.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );


  const patterns = [

    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      'i'
    ),

    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${escaped}["'][^>]*>`,
      'i'
    ),

    new RegExp(
      `<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      'i'
    ),

    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${escaped}["'][^>]*>`,
      'i'
    )

  ];


  for (const pattern of patterns) {

    const match =
      html.match(pattern);

    if (
      match &&
      match[1]
    ) {
      return decodeHtml(
        match[1]
      );
    }
  }


  return null;
}


// ======================================================
// URL ARTICLE
// ======================================================

function buildArticleUrl(article) {

  if (
    !article ||
    !article.id ||
    !article.slug
  ) {
    return null;
  }


  return (
    'https://www.rockstargames.com/newswire/article/' +
    article.id +
    '/' +
    article.slug
  );
}


function buildFrenchArticleUrl(article) {

  if (
    !article ||
    !article.id ||
    !article.slug
  ) {
    return null;
  }


  return (
    'https://www.rockstargames.com/fr/newswire/article/' +
    article.id +
    '/' +
    article.slug
  );
}


// ======================================================
// DETECTION GTA V / GTA ONLINE
// ======================================================

function isGtaVOrOnline(
  html,
  graphqlTitle = ''
) {

  const title =
    (
      getMeta(
        html,
        'og:title'
      ) ||
      graphqlTitle ||
      ''
    )
      .toLowerCase();


  const description =
    (
      getMeta(
        html,
        'og:description'
      ) ||
      getMeta(
        html,
        'description'
      ) ||
      ''
    )
      .toLowerCase();


  const text =
    stripHtml(
      `${title} ${description} ${html}`
    )
      .toLowerCase();


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
      'gta v'
    ) ||
    text.includes(
      'gtav'
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
// EXTRACTION ARTICLE
// ======================================================

function extractTitle(
  html,
  fallback
) {

  const title =
    getMeta(
      html,
      'og:title'
    );


  if (title) {

    return title
      .replace(
        /\s*-\s*Rockstar Games\s*$/i,
        ''
      )
      .trim();
  }


  return (
    fallback ||
    'Nouvelle actualité GTA Online'
  );
}


function extractDescription(
  html
) {

  const description =
    getMeta(
      html,
      'og:description'
    ) ||
    getMeta(
      html,
      'description'
    );


  if (description) {

    return stripHtml(
      description
    );
  }


  return (
    'Une nouvelle actualité officielle GTA Online vient d’être publiée par Rockstar Games.'
  );
}


function extractImage(
  html
) {

  return (
    getMeta(
      html,
      'og:image'
    ) ||
    getMeta(
      html,
      'twitter:image'
    ) ||
    null
  );
}


function extractDate(
  html
) {

  const published =
    getMeta(
      html,
      'article:published_time'
    );


  if (published) {

    const date =
      new Date(
        published
      );


    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  const time =
    html.match(
      /<time[^>]+datetime=["']([^"']+)["']/i
    );


  if (
    time &&
    time[1]
  ) {

    const date =
      new Date(
        time[1]
      );


    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  const plain =
    stripHtml(
      html
    );


  const englishDate =
    plain.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i
    );


  if (englishDate) {

    const date =
      new Date(
        englishDate[0]
      );


    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  return null;
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
// LECTURE D'UN ARTICLE
// ======================================================

async function loadArticle(
  article
) {

  const englishUrl =
    buildArticleUrl(
      article
    );


  const frenchUrl =
    buildFrenchArticleUrl(
      article
    );


  if (!englishUrl) {
    return null;
  }


  console.log(
    `🔎 GTA : ${article.title}`
  );


  // --------------------------------------------------
  // On récupère d'abord la version anglaise pour
  // identifier correctement GTA Online / GTA V.
  // --------------------------------------------------

  let englishHtml;


  try {

    englishHtml =
      await fetchPage(
        englishUrl
      );

  } catch (error) {

    console.log(
      `⚠️ GTA : article inaccessible : ${error.message}`
    );

    return null;
  }


  if (
    !isGtaVOrOnline(
      englishHtml,
      article.title
    )
  ) {

    console.log(
      '⏭️ GTA : pas GTA V / GTA Online.'
    );

    return null;
  }


  console.log(
    '✅ GTA V / GTA Online détecté.'
  );


  // --------------------------------------------------
  // Version FR officielle Rockstar
  // --------------------------------------------------

  try {

    const frenchHtml =
      await fetchPage(
        frenchUrl
      );


    const frenchTitle =
      extractTitle(
        frenchHtml,
        article.title
      );


    const frenchDescription =
      extractDescription(
        frenchHtml
      );


    // On vérifie qu'on n'est pas tombé sur une page
    // générique/404 déguisée.
    if (
      frenchHtml.length > 1000 &&
      frenchTitle
    ) {

      console.log(
        '🇫🇷 GTA : version française Rockstar trouvée.'
      );


      return {

        canonicalUrl:
          englishUrl,

        url:
          frenchUrl,

        title:
          frenchTitle,

        description:
          frenchDescription,

        image:
          extractImage(
            frenchHtml
          ) ||
          extractImage(
            englishHtml
          ),

        publishedAt:
          extractDate(
            frenchHtml
          ) ||
          extractDate(
            englishHtml
          ),

        translation:
          'official'
      };
    }

  } catch (error) {

    console.log(
      '⚠️ GTA : version FR Rockstar indisponible.'
    );
  }


  // --------------------------------------------------
  // Fallback traduction automatique
  // --------------------------------------------------

  console.log(
    '🇫🇷 GTA : traduction automatique.'
  );


  const englishTitle =
    extractTitle(
      englishHtml,
      article.title
    );


  const englishDescription =
    extractDescription(
      englishHtml
    );


  return {

    canonicalUrl:
      englishUrl,

    url:
      englishUrl,

    title:
      await translateText(
        englishTitle
      ),

    description:
      await translateText(
        truncate(
          englishDescription,
          450
        )
      ),

    image:
      extractImage(
        englishHtml
      ),

    publishedAt:
      extractDate(
        englishHtml
      ),

    translation:
      'automatic'
  };
}


// ======================================================
// DATE FR
// ======================================================

function formatDate(date) {

  if (!date) {
    return (
      'Date non détectée'
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
// EMBED GTA
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
            '🇫🇷 Français',

          value:
            article.translation ===
            'official'
              ? 'Version officielle Rockstar'
              : 'Traduction automatique',

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
// RECHERCHE DES ARTICLES GTA
// ======================================================

async function findRecentGtaArticles() {

  // Page 1 du Newswire.
  // Elle contient les publications les plus récentes.

  const posts =
    await fetchNewswirePage(
      1
    );


  const gtaArticles = [];


  console.log(
    `🔎 GTA : analyse de ${posts.length} article(s)...`
  );


  for (
    const post
    of posts
  ) {

    try {

      const article =
        await loadArticle(
          post
        );


      if (article) {

        gtaArticles.push(
          article
        );
      }


      // Petite pause entre les requêtes Rockstar.
      await wait(
        300
      );

    } catch (error) {

      console.log(
        `⚠️ GTA : ${error.message}`
      );
    }
  }


  return gtaArticles;
}


// ======================================================
// VERIFICATION PRINCIPALE
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


    const articles =
      await findRecentGtaArticles();


    if (
      articles.length ===
      0
    ) {

      console.log(
        '❌ GTA : aucune actualité GTA V / GTA Online trouvée.'
      );

      return;
    }


    console.log(
      `🌴 GTA : ${articles.length} actualité(s) GTA V / Online trouvée(s).`
    );


    const state =
      loadState();


    // ==================================================
    // PREMIERE INITIALISATION
    //
    // Tous les articles actuellement présents sont
    // mémorisés afin de ne pas spammer Discord.
    // ==================================================

    if (
      !state.initialized
    ) {

      state.initialized =
        true;


      state.published =
        articles
          .map(
            article =>
              article.canonicalUrl
          )
          .slice(
            0,
            100
          );


      saveState(
        state
      );


      console.log(
        `✅ GTA initialisé avec ${state.published.length} article(s).`
      );


      console.log(
        'ℹ️ GTA : aucun ancien article envoyé.'
      );


      return;
    }


    // ==================================================
    // NOUVELLES ACTUS
    // ==================================================

    const newArticles =
      articles.filter(
        article =>
          !state.published.includes(
            article.canonicalUrl
          )
      );


    if (
      newArticles.length ===
      0
    ) {

      console.log(
        '✅ GTA : aucune nouvelle actualité.'
      );

      return;
    }


    console.log(
      `🆕 GTA : ${newArticles.length} nouvelle(s) actualité(s).`
    );


    // On publie de la plus ancienne à la plus récente.
    const ordered =
      [...newArticles]
        .reverse();


    for (
      const article
      of ordered
    ) {

      await channel.send({
        embeds: [
          createGtaEmbed(
            article
          )
        ]
      });


      console.log(
        `📢 GTA publiée : ${article.title}`
      );


      state.published.unshift(
        article.canonicalUrl
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


      await wait(
        1000
      );
    }


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
