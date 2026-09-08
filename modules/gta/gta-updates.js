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
            'text/html,application/xhtml+xml,application/json',

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

  for (
    const pattern
    of patterns
  ) {
    const match =
      html.match(
        pattern
      );

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
// RECHERCHE DES ARTICLES DANS LES DONNEES DE LA PAGE
// ======================================================

function normalizeArticleUrl(url) {
  if (!url) {
    return null;
  }

  let clean =
    decodeHtml(url);

  clean =
    clean
      .replace(
        /\\u002F/g,
        '/'
      )
      .replace(
        /\\\//g,
        '/'
      );

  if (
    clean.startsWith('//')
  ) {
    clean =
      `https:${clean}`;
  }

  if (
    clean.startsWith('/')
  ) {
    clean =
      `https://www.rockstargames.com${clean}`;
  }

  if (
    !clean.startsWith(
      'http'
    )
  ) {
    return null;
  }

  clean =
    clean.replace(
      'https://www.rockstargames.com/fr/newswire/article/',
      'https://www.rockstargames.com/newswire/article/'
    );

  const queryIndex =
    clean.indexOf('?');

  if (
    queryIndex !== -1
  ) {
    clean =
      clean.slice(
        0,
        queryIndex
      );
  }

  return clean;
}


function extractArticleUrls(html) {

  const found =
    new Set();


  // ==================================================
  // 1. LIENS HTML CLASSIQUES
  // ==================================================

  const hrefRegex =
    /href=["']([^"']*\/newswire\/article\/[^"']+)["']/gi;

  for (
    const match
    of html.matchAll(
      hrefRegex
    )
  ) {
    const url =
      normalizeArticleUrl(
        match[1]
      );

    if (url) {
      found.add(url);
    }
  }


  // ==================================================
  // 2. URL ABSOLUES DANS LE JAVASCRIPT / JSON
  // ==================================================

  const absoluteRegex =
    /https?:\\?\/\\?\/(?:www\.)?rockstargames\.com\\?\/(?:fr\\?\/)?newswire\\?\/article\\?\/[a-zA-Z0-9]+\\?\/[a-zA-Z0-9\-_%]+/gi;

  for (
    const match
    of html.matchAll(
      absoluteRegex
    )
  ) {
    const url =
      normalizeArticleUrl(
        match[0]
      );

    if (url) {
      found.add(url);
    }
  }


  // ==================================================
  // 3. URL RELATIVES DANS LES DONNEES JSON
  // ==================================================

  const relativeRegex =
    /\\?\/(?:fr\\?\/)?newswire\\?\/article\\?\/[a-zA-Z0-9]+\\?\/[a-zA-Z0-9\-_%]+/gi;

  for (
    const match
    of html.matchAll(
      relativeRegex
    )
  ) {
    const url =
      normalizeArticleUrl(
        match[0]
      );

    if (url) {
      found.add(url);
    }
  }


  return [
    ...found
  ];
}


// ======================================================
// EXTRACTION ARTICLE
// ======================================================

function extractTitle(html) {

  const metaTitle =
    getMeta(
      html,
      'og:title'
    );

  if (metaTitle) {
    return metaTitle
      .replace(
        /\s*-\s*Rockstar Games\s*$/i,
        ''
      )
      .trim();
  }


  const h1 =
    html.match(
      /<h1[^>]*>([\s\S]*?)<\/h1>/i
    );

  if (
    h1 &&
    h1[1]
  ) {
    return stripHtml(
      h1[1]
    );
  }


  return (
    'Nouvelle actualité GTA Online'
  );
}


function extractDescription(html) {

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


  const paragraphs = [
    ...html.matchAll(
      /<p[^>]*>([\s\S]*?)<\/p>/gi
    )
  ];


  for (
    const paragraph
    of paragraphs
  ) {
    const text =
      stripHtml(
        paragraph[1]
      );

    if (
      text.length >= 80
    ) {
      return text;
    }
  }


  return (
    'Une nouvelle actualité officielle GTA V / GTA Online vient d’être publiée par Rockstar Games.'
  );
}


function extractImage(html) {

  return (
    getMeta(
      html,
      'og:image'
    ) ||

    getMeta(
      html,
      'twitter:image'
    )
  );
}


function extractPublishedDate(html) {

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


  const timeMatch =
    html.match(
      /<time[^>]+datetime=["']([^"']+)["']/i
    );

  if (
    timeMatch &&
    timeMatch[1]
  ) {

    const date =
      new Date(
        timeMatch[1]
      );

    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date;
    }
  }


  const text =
    stripHtml(
      html
    );


  const dateMatch =
    text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i
    );


  if (
    dateMatch
  ) {
    const date =
      new Date(
        dateMatch[0]
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
// FILTRE GTA V / GTA ONLINE
// ======================================================

function isGtaArticle(html) {

  const text =
    stripHtml(
      html
    ).toLowerCase();


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


  // GTA Online = accepté directement
  if (gtaOnline) {
    return true;
  }


  // GTA V accepté seulement si ce n'est pas juste GTA VI
  if (
    gtaV &&
    !gtaVI
  ) {
    return true;
  }


  return false;
}


// ======================================================
// VERSION FRANCAISE ROCKSTAR
// ======================================================

function getFrenchUrl(url) {

  return url.replace(
    'https://www.rockstargames.com/newswire/',
    'https://www.rockstargames.com/fr/newswire/'
  );
}


async function fetchArticle(url) {

  let html;

  let articleUrl =
    url;

  let language =
    'en';


  const frenchUrl =
    getFrenchUrl(
      url
    );


  // ==================================================
  // VERSION FR ROCKSTAR EN PREMIER
  // ==================================================

  try {

    const frenchHtml =
      await fetchPage(
        frenchUrl
      );


    if (
      frenchHtml &&
      frenchHtml.length >
        1000
    ) {

      html =
        frenchHtml;

      articleUrl =
        frenchUrl;

      language =
        'fr';
    }

  } catch (error) {

    // pas grave
  }


  // ==================================================
  // FALLBACK ANGLAIS
  // ==================================================

  if (!html) {

    html =
      await fetchPage(
        url
      );

    articleUrl =
      url;

    language =
      'en';
  }


  if (
    !isGtaArticle(
      html
    )
  ) {
    return null;
  }


  return {

    canonicalUrl:
      url,

    url:
      articleUrl,

    language,

    title:
      extractTitle(
        html
      ),

    description:
      extractDescription(
        html
      ),

    image:
      extractImage(
        html
      ),

    publishedAt:
      extractPublishedDate(
        html
      )
  };
}


// ======================================================
// TRADUCTION FALLBACK
// ======================================================

async function translateText(text) {

  if (
    !text ||
    text.length <
      2
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


    if (
      !response.ok
    ) {
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


async function ensureFrench(article) {

  if (
    article.language ===
    'fr'
  ) {
    return article;
  }


  console.log(
    '🇫🇷 GTA : traduction automatique...'
  );


  return {

    ...article,

    title:
      await translateText(
        truncate(
          article.title,
          450
        )
      ),

    description:
      await translateText(
        truncate(
          article.description,
          450
        )
      )
  };
}


// ======================================================
// DATE
// ======================================================

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
        day: '2-digit',

        month: 'long',

        year: 'numeric',

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
          '🌴 GTA V • GTA ONLINE • NEWSWIRE'
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
            article.language ===
            'fr'
              ? 'Version française Rockstar'
              : 'Traduction française',

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

  console.log(
    '🌐 GTA : récupération du Rockstar Newswire...'
  );


  const html =
    await fetchPage(
      config.newswireUrl
    );


  console.log(
    `📄 GTA : ${html.length} caractères récupérés.`
  );


  let urls =
    extractArticleUrls(
      html
    );


  console.log(
    `🔗 GTA : ${urls.length} lien(s) Newswire détecté(s).`
  );


  // ==================================================
  // FALLBACK PAGE FR
  // ==================================================

  if (
    urls.length ===
    0
  ) {

    console.log(
      '🇫🇷 GTA : tentative sur le Newswire français...'
    );


    try {

      const frenchHtml =
        await fetchPage(
          'https://www.rockstargames.com/fr/newswire'
        );


      urls =
        extractArticleUrls(
          frenchHtml
        );


      console.log(
        `🔗 GTA FR : ${urls.length} lien(s) détecté(s).`
      );

    } catch (error) {

      console.log(
        `⚠️ GTA FR : ${error.message}`
      );
    }
  }


  if (
    urls.length ===
    0
  ) {

    throw new Error(
      'Aucun lien Newswire détecté dans les données Rockstar.'
    );
  }


  urls =
    urls.slice(
      0,
      config.maxCandidates ||
      25
    );


  console.log(
    `🔎 GTA : analyse de ${urls.length} article(s)...`
  );


  for (
    const url
    of urls
  ) {

    try {

      console.log(
        `🔎 GTA : ${url}`
      );


      const article =
        await fetchArticle(
          url
        );


      if (article) {

        console.log(
          `✅ GTA détecté : ${article.title}`
        );

        return article;
      }


      console.log(
        '⏭️ GTA : article non GTA V / Online ignoré.'
      );

    } catch (error) {

      console.log(
        `⚠️ GTA : article inaccessible : ${error.message}`
      );
    }
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
    // PREMIER LANCEMENT
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
        'ℹ️ GTA : première initialisation, aucune ancienne actualité envoyée.'
      );

      return;
    }


    // ==================================================
    // DEJA PUBLIE
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
    // TRADUCTION
    // ==================================================

    const frenchArticle =
      await ensureFrench(
        latest
      );


    // ==================================================
    // PUBLICATION DISCORD
    // ==================================================

    await channel.send({

      embeds: [

        createGtaEmbed(
          frenchArticle
        )

      ]
    });


    console.log(
      `📢 GTA : "${frenchArticle.title}" publiée !`
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
// DEMARRAGE MODULE
// ======================================================

function startGtaUpdates(
  client
) {

  console.log(
    '🌴 Module GTA Updates chargé.'
  );


  // Vérification au démarrage
  checkGtaUpdates(
    client
  );


  // Vérification toutes les 15 minutes
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
