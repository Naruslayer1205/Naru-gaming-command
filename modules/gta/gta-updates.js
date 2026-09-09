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

function wait(ms) {

  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function ensureDataFolder() {

  fs.mkdirSync(
    path.dirname(
      config.stateFile
    ),
    {
      recursive: true
    }
  );
}


// ======================================================
// DECODAGE HTML COMPLET
// ======================================================

function decodeHtmlOnce(text = '') {

  const entities = {

    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' ',

    // Français
    agrave: 'à',
    aacute: 'á',
    acirc: 'â',
    atilde: 'ã',
    auml: 'ä',
    aring: 'å',

    aelig: 'æ',

    ccedil: 'ç',

    egrave: 'è',
    eacute: 'é',
    ecirc: 'ê',
    euml: 'ë',

    igrave: 'ì',
    iacute: 'í',
    icirc: 'î',
    iuml: 'ï',

    ntilde: 'ñ',

    ograve: 'ò',
    oacute: 'ó',
    ocirc: 'ô',
    otilde: 'õ',
    ouml: 'ö',

    oelig: 'œ',

    ugrave: 'ù',
    uacute: 'ú',
    ucirc: 'û',
    uuml: 'ü',

    yacute: 'ý',
    yuml: 'ÿ',

    // Majuscules
    Agrave: 'À',
    Aacute: 'Á',
    Acirc: 'Â',
    Atilde: 'Ã',
    Auml: 'Ä',
    Aring: 'Å',

    AElig: 'Æ',

    Ccedil: 'Ç',

    Egrave: 'È',
    Eacute: 'É',
    Ecirc: 'Ê',
    Euml: 'Ë',

    Igrave: 'Ì',
    Iacute: 'Í',
    Icirc: 'Î',
    Iuml: 'Ï',

    Ntilde: 'Ñ',

    Ograve: 'Ò',
    Oacute: 'Ó',
    Ocirc: 'Ô',
    Otilde: 'Õ',
    Ouml: 'Ö',

    OElig: 'Œ',

    Ugrave: 'Ù',
    Uacute: 'Ú',
    Ucirc: 'Û',
    Uuml: 'Ü',

    Yacute: 'Ý',

    // Ponctuation
    rsquo: '’',
    lsquo: '‘',

    rdquo: '”',
    ldquo: '“',

    ndash: '–',
    mdash: '—',

    hellip: '…',

    bull: '•',

    middot: '·',

    copy: '©',
    reg: '®',
    trade: '™',

    euro: '€',
    pound: '£',
    yen: '¥',

    times: '×',
    divide: '÷'
  };


  return String(text)

    // Unicode échappé
    .replace(
      /\\u([0-9a-fA-F]{4})/g,
      (_, hex) =>
        String.fromCharCode(
          parseInt(
            hex,
            16
          )
        )
    )

    // Slash échappé
    .replace(
      /\\\//g,
      '/'
    )

    // Entités numériques HEX
    .replace(
      /&#x([0-9a-fA-F]+);?/g,
      (_, hex) => {

        try {

          return String.fromCodePoint(
            parseInt(
              hex,
              16
            )
          );

        } catch {

          return _;
        }
      }
    )

    // Entités numériques décimales
    .replace(
      /&#([0-9]+);?/g,
      (_, number) => {

        try {

          return String.fromCodePoint(
            parseInt(
              number,
              10
            )
          );

        } catch {

          return _;
        }
      }
    )

    // Entités HTML nommées
    .replace(
      /&([a-zA-Z]+);/g,
      (
        full,
        name
      ) => {

        if (
          Object.prototype.hasOwnProperty.call(
            entities,
            name
          )
        ) {

          return entities[name];
        }


        const lower =
          name.toLowerCase();


        if (
          Object.prototype.hasOwnProperty.call(
            entities,
            lower
          )
        ) {

          return entities[lower];
        }


        return full;
      }
    );
}


function decodeHtml(text = '') {

  let value =
    String(text);


  // Rockstar peut renvoyer certaines entités
  // encodées plusieurs fois.
  //
  // Exemple :
  //
  // &amp;eacute;
  // ↓
  // &eacute;
  // ↓
  // é

  for (
    let i = 0;
    i < 5;
    i++
  ) {

    const decoded =
      decodeHtmlOnce(
        value
      );


    if (
      decoded === value
    ) {

      break;
    }


    value =
      decoded;
  }


  return value
    .replace(
      /\u00A0/g,
      ' '
    )
    .trim();
}


function stripHtml(text = '') {

  return decodeHtml(
    String(text)

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

    .replace(
      /\s+/g,
      ' '
    )

    .trim();
}


function truncate(
  text = '',
  max = 1000
) {

  text =
    String(text)
      .trim();


  if (
    text.length <= max
  ) {

    return text;
  }


  return (
    text
      .slice(
        0,
        max - 1
      )
      .trim()
    +
    '…'
  );
}


// ======================================================
// FETCH
// ======================================================

async function fetchText(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        redirect:
          'follow',

        signal:
          AbortSignal.timeout(
            30000
          ),

        headers: {

          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/140 Safari/537.36',

          'Accept':
            'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',

          'Accept-Language':
            'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',

          ...options.headers

        },

        ...options

      }
    );


  if (!response.ok) {

    throw new Error(
      `HTTP ${response.status} sur ${url}`
    );
  }


  return {

    text:
      await response.text(),

    finalUrl:
      response.url,

    headers:
      response.headers

  };
}


// ======================================================
// ETAT
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

    const data =
      JSON.parse(

        fs.readFileSync(
          config.stateFile,
          'utf8'
        )

      );


    return {

      initialized:
        Boolean(
          data.initialized
        ),

      published:
        Array.isArray(
          data.published
        )
          ? data.published
          : []

    };


  } catch (error) {

    console.log(
      `⚠️ GTA : fichier état illisible : ${error.message}`
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
// META HTML
// ======================================================

function getMeta(
  html,
  name
) {

  const tags =
    String(html)
      .match(
        /<meta\b[^>]*>/gi
      )
    || [];


  for (
    const tag
    of tags
  ) {

    const property =
      tag.match(
        /\b(?:property|name)\s*=\s*(["'])(.*?)\1/i
      );


    if (
      !property ||
      property[2]
        .toLowerCase() !==
        name.toLowerCase()
    ) {

      continue;
    }


    const content =
      tag.match(
        /\bcontent\s*=\s*(["'])(.*?)\1/i
      );


    if (
      content &&
      content[2]
    ) {

      return decodeHtml(
        content[2]
      );
    }
  }


  return null;
}


// ======================================================
// URL
// ======================================================

function normalizeArticleUrl(url) {

  if (!url) {

    return null;
  }


  try {

    url =
      decodeURIComponent(
        decodeHtml(url)
      );


  } catch {

    url =
      decodeHtml(url);
  }


  const rockstarMatch =
    String(url)
      .match(
        /https?:\/\/(?:www\.)?rockstargames\.com\/(?:fr\/)?newswire\/article\/[^"'&<>\s]+/i
      );


  if (rockstarMatch) {

    url =
      rockstarMatch[0];
  }


  try {

    const parsed =
      new URL(url);


    if (
      parsed.hostname !==
      'www.rockstargames.com'
      &&
      parsed.hostname !==
      'rockstargames.com'
    ) {

      return null;
    }


    let pathname =
      parsed.pathname;


    pathname =
      pathname.replace(
        /^\/fr\//i,
        '/'
      );


    if (
      !pathname.includes(
        '/newswire/article/'
      )
    ) {

      return null;
    }


    parsed.hostname =
      'www.rockstargames.com';


    parsed.pathname =
      pathname;


    parsed.search = '';
    parsed.hash = '';


    return (
      parsed.origin +
      parsed.pathname
    );


  } catch {

    return null;
  }
}


function getArticleKey(url) {

  try {

    const parsed =
      new URL(url);


    const match =
      parsed.pathname.match(
        /\/newswire\/article\/([^/]+)/i
      );


    if (
      match &&
      match[1]
    ) {

      return match[1];
    }


  } catch {}


  return url;
}


function buildFrenchUrl(url) {

  try {

    const parsed =
      new URL(url);


    const pathname =
      parsed.pathname.replace(
        /^\/fr\//i,
        '/'
      );


    return (
      'https://www.rockstargames.com/fr' +
      pathname
    );


  } catch {

    return url;
  }
}


// ======================================================
// DECOUVERTE 1 : NEWSWIRE DIRECT
// ======================================================

async function discoverFromNewswire() {

  console.log(
    '🌐 GTA : tentative Newswire Rockstar direct...'
  );


  try {

    const result =
      await fetchText(
        config.newswireUrl
      );


    console.log(
      `📄 GTA : ${result.text.length} caractères récupérés du Newswire.`
    );


    const html =
      decodeHtml(
        result.text
      );


    const matches =
      html.match(
        /https?:\/\/(?:www\.)?rockstargames\.com\/(?:fr\/)?newswire\/article\/[^"'<>\\\s]+|\/(?:fr\/)?newswire\/article\/[^"'<>\\\s]+/gi
      )
      || [];


    const links =
      [];


    for (
      let match
      of matches
    ) {

      if (
        match.startsWith('/')
      ) {

        match =
          'https://www.rockstargames.com' +
          match;
      }


      const normalized =
        normalizeArticleUrl(
          match
        );


      if (normalized) {

        links.push(
          normalized
        );
      }
    }


    const unique =
      [
        ...new Set(
          links
        )
      ];


    console.log(
      `🔗 GTA : ${unique.length} lien(s) trouvé(s) directement.`
    );


    return unique;


  } catch (error) {

    console.log(
      `⚠️ GTA Newswire direct : ${error.message}`
    );


    return [];
  }
}


// ======================================================
// DECOUVERTE 2 : DUCKDUCKGO
// ======================================================

async function discoverFromDuckDuckGo() {

  console.log(
    '🔎 GTA : recherche de secours via index web...'
  );


  const queries = [

    'site:rockstargames.com/newswire/article "GTA Online"',

    'site:rockstargames.com/newswire/article "Grand Theft Auto V"',

    'site:rockstargames.com/fr/newswire/article "GTA Online"'

  ];


  const results =
    [];


  for (
    const query
    of queries
  ) {

    try {

      const url =
        'https://html.duckduckgo.com/html/?q=' +
        encodeURIComponent(
          query
        );


      const {
        text
      } =
        await fetchText(
          url,
          {
            headers: {
              'Accept-Language':
                'en-US,en;q=0.9'
            }
          }
        );


      const html =
        decodeHtml(
          text
        );


      const directMatches =
        html.match(
          /https?:\/\/(?:www\.)?rockstargames\.com\/(?:fr\/)?newswire\/article\/[^"'&<>\s]+/gi
        )
        || [];


      for (
        const match
        of directMatches
      ) {

        const normalized =
          normalizeArticleUrl(
            match
          );


        if (normalized) {

          results.push(
            normalized
          );
        }
      }


      const uddgMatches =
        [
          ...html.matchAll(
            /[?&]uddg=([^"'&<>]+)/gi
          )
        ];


      for (
        const match
        of uddgMatches
      ) {

        try {

          const decoded =
            decodeURIComponent(
              match[1]
            );


          const normalized =
            normalizeArticleUrl(
              decoded
            );


          if (normalized) {

            results.push(
              normalized
            );
          }


        } catch {}
      }


      await wait(
        750
      );


    } catch (error) {

      console.log(
        `⚠️ GTA recherche web : ${error.message}`
      );
    }
  }


  const unique =
    [
      ...new Set(
        results
      )
    ];


  console.log(
    `🔎 GTA : ${unique.length} lien(s) Rockstar trouvé(s) via l'index web.`
  );


  return unique;
}


// ======================================================
// DECOUVERTE COMPLETE
// ======================================================

async function discoverArticleLinks() {

  const direct =
    await discoverFromNewswire();


  const search =
    await discoverFromDuckDuckGo();


  const links =
    [
      ...new Set([
        ...direct,
        ...search
      ])
    ];


  console.log(
    `📰 GTA : ${links.length} lien(s) Rockstar unique(s) à analyser.`
  );


  return links.slice(
    0,
    config.maxCandidates
  );
}


// ======================================================
// EXTRACTION DATE JSON-LD
// ======================================================

function extractJsonLdDate(
  html
) {

  const scripts =
    [
      ...String(html)
        .matchAll(
          /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
        )
    ];


  for (
    const match
    of scripts
  ) {

    try {

      const data =
        JSON.parse(
          match[1]
        );


      const objects =
        Array.isArray(data)
          ? data
          : [data];


      for (
        const object
        of objects
      ) {

        if (
          object?.datePublished
        ) {

          return object.datePublished;
        }


        if (
          Array.isArray(
            object?.['@graph']
          )
        ) {

          for (
            const child
            of object['@graph']
          ) {

            if (
              child?.datePublished
            ) {

              return child.datePublished;
            }
          }
        }
      }


    } catch {}
  }


  return null;
}


// ======================================================
// ARTICLE ROCKSTAR
// ======================================================

async function fetchArticle(
  url
) {

  const {
    text,
    finalUrl
  } =
    await fetchText(
      url
    );


  const title =
    (
      getMeta(
        text,
        'og:title'
      )
      ||
      ''
    )

      .replace(
        /\s*[-|]\s*Rockstar Games\s*$/i,
        ''
      )

      .trim();


  const description =
    getMeta(
      text,
      'og:description'
    )

    ||

    getMeta(
      text,
      'description'
    )

    ||

    '';


  const image =
    getMeta(
      text,
      'og:image'
    )

    ||

    getMeta(
      text,
      'twitter:image'
    )

    ||

    null;


  const published =
    getMeta(
      text,
      'article:published_time'
    )

    ||

    extractJsonLdDate(
      text
    )

    ||

    null;


  return {

    html:
      text,

    finalUrl,

    title:
      decodeHtml(
        title
      ),

    description:
      stripHtml(
        description
      ),

    image:
      decodeHtml(
        image || ''
      )
      || null,

    published

  };
}


// ======================================================
// FILTRE GTA
// ======================================================

function classifyGtaArticle(
  article
) {

  const title =
    String(
      article.title ||
      ''
    )
      .toLowerCase();


  const description =
    String(
      article.description ||
      ''
    )
      .toLowerCase();


  const text =
    `${title} ${description}`;


  const gtaVI =

    /\bgrand theft auto vi\b/i.test(
      text
    )

    ||

    /\bgta vi\b/i.test(
      text
    );


  const gtaOnline =

    /\bgta online\b/i.test(
      text
    )

    ||

    /\bgrand theft auto online\b/i.test(
      text
    );


  const gtaV =

    /\bgrand theft auto v(?!i)\b/i.test(
      text
    )

    ||

    /\bgta v\b/i.test(
      text
    )

    ||

    /\bgtav\b/i.test(
      text
    );


  if (
    gtaVI &&
    !gtaOnline
  ) {

    return false;
  }


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
// VERSION FRANCAISE ROCKSTAR
// ======================================================

async function getPreferredArticle(
  englishUrl
) {

  console.log(
    `🔎 GTA : ${englishUrl}`
  );


  let english;


  try {

    english =
      await fetchArticle(
        englishUrl
      );


  } catch (error) {

    console.log(
      `⚠️ GTA article inaccessible : ${error.message}`
    );


    return null;
  }


  if (
    !english.title
  ) {

    console.log(
      '⏭️ GTA : page Rockstar sans titre exploitable.'
    );


    return null;
  }


  if (
    !classifyGtaArticle(
      english
    )
  ) {

    console.log(
      `⏭️ Ignoré : ${truncate(english.title, 90)}`
    );


    return null;
  }


  console.log(
    `✅ GTA V / GTA Online : ${truncate(english.title, 100)}`
  );


  const frenchUrl =
    buildFrenchUrl(
      englishUrl
    );


  try {

    const french =
      await fetchArticle(
        frenchUrl
      );


    const validFrenchPage =

      french.title

      &&

      french.finalUrl.includes(
        '/fr/newswire/article/'
      )

      &&

      french.finalUrl.includes(
        getArticleKey(
          englishUrl
        )
      );


    if (
      validFrenchPage
    ) {

      console.log(
        '🇫🇷 GTA : version française officielle Rockstar trouvée.'
      );


      return {

        key:
          getArticleKey(
            englishUrl
          ),

        canonicalUrl:
          englishUrl,

        url:
          french.finalUrl,

        title:
          decodeHtml(
            french.title
          ),

        description:
          decodeHtml(
            french.description
            ||
            english.description
          ),

        image:
          french.image
          ||
          english.image,

        published:
          french.published
          ||
          english.published,

        language:
          'official-fr'

      };
    }


  } catch (error) {

    console.log(
      `⚠️ GTA FR : ${error.message}`
    );
  }


  console.log(
    '🇬🇧 GTA : version anglaise Rockstar utilisée.'
  );


  return {

    key:
      getArticleKey(
        englishUrl
      ),

    canonicalUrl:
      englishUrl,

    url:
      english.finalUrl,

    title:
      decodeHtml(
        english.title
      ),

    description:
      decodeHtml(
        english.description
      ),

    image:
      english.image,

    published:
      english.published,

    language:
      'official-en'

  };
}


// ======================================================
// DATE
// ======================================================

function formatDate(
  value
) {

  if (!value) {

    return 'Date non détectée';
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

    return String(
      value
    );
  }


  return new Intl.DateTimeFormat(

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
    );
}


// ======================================================
// TRI DATE
// ======================================================

function articleTime(
  article
) {

  if (
    !article.published
  ) {

    return 0;
  }


  const time =
    new Date(
      article.published
    )
      .getTime();


  return Number.isNaN(time)
    ? 0
    : time;
}


// ======================================================
// EMBED
// ======================================================

function createEmbed(
  article
) {

  const cleanTitle =
    decodeHtml(
      article.title
    );


  const cleanDescription =
    decodeHtml(
      article.description
    );


  const embed =
    new EmbedBuilder()

      .setColor(
        config.color
      )

      .setAuthor({
        name:
          '🌴 GRAND THEFT AUTO V • GTA ONLINE • NEWSWIRE'
      })

      .setTitle(

        truncate(
          cleanTitle,
          250
        )

      )

      .setURL(
        article.url
      )

      .setDescription(

        truncate(

          cleanDescription

          ||

          'Une nouvelle actualité officielle GTA vient d’être publiée par Rockstar Games.',

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
              article.published
            ),

          inline:
            true
        },

        {
          name:
            '🇫🇷 Langue',

          value:
            article.language ===
            'official-fr'

              ? 'Version française officielle Rockstar'

              : 'Version anglaise officielle Rockstar',

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
    article.image
    &&
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
// RECUPERATION GTA
// ======================================================

async function findRecentGtaArticles() {

  const links =
    await discoverArticleLinks();


  if (
    links.length === 0
  ) {

    throw new Error(
      'Impossible de découvrir des articles Rockstar Newswire.'
    );
  }


  console.log(
    `🔎 GTA : analyse de ${links.length} candidat(s)...`
  );


  const articles =
    [];


  const seenKeys =
    new Set();


  for (
    const link
    of links
  ) {

    try {

      const key =
        getArticleKey(
          link
        );


      if (
        seenKeys.has(
          key
        )
      ) {

        continue;
      }


      seenKeys.add(
        key
      );


      const article =
        await getPreferredArticle(
          link
        );


      if (article) {

        articles.push(
          article
        );
      }


      await wait(
        350
      );


    } catch (error) {

      console.log(
        `⚠️ GTA : ${error.message}`
      );
    }
  }


  articles.sort(
    (a, b) =>
      articleTime(b)
      -
      articleTime(a)
  );


  return articles;
}


// ======================================================
// VERIFICATION
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
      !channel
      ||
      !channel.isTextBased()
    ) {

      throw new Error(
        `Salon GTA ${config.channelId} introuvable.`
      );
    }


    const articles =
      await findRecentGtaArticles();


    if (
      articles.length === 0
    ) {

      console.log(
        '⚠️ GTA : aucun article GTA V / GTA Online trouvé.'
      );


      return;
    }


    console.log(
      `🌴 GTA : ${articles.length} actualité(s) GTA V / GTA Online trouvée(s).`
    );


    const state =
      loadState();


    // ==================================================
    // PREMIERE INITIALISATION
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
              article.key
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
            article.key
          )

      );


    if (
      newArticles.length === 0
    ) {

      console.log(
        '✅ GTA : aucune nouvelle actualité.'
      );


      return;
    }


    console.log(
      `🆕 GTA : ${newArticles.length} nouvelle(s) actualité(s).`
    );


    const ordered =
      [
        ...newArticles
      ]

        .sort(
          (a, b) =>
            articleTime(a)
            -
            articleTime(b)
        );


    for (
      const article
      of ordered
    ) {

      await channel.send({

        embeds: [

          createEmbed(
            article
          )

        ]

      });


      console.log(
        `📢 GTA publiée : ${decodeHtml(article.title)}`
      );


      state.published.unshift(
        article.key
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
