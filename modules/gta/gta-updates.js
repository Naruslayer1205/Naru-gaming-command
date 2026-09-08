const {
  EmbedBuilder
} = require('discord.js');

const puppeteer = require('puppeteer');

const fs = require('fs');
const path = require('path');

const config = require('./config');

let checking = false;
let interval = null;


// ======================================================
// OUTILS
// ======================================================

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function ensureDataFolder() {
  fs.mkdirSync(
    path.dirname(config.stateFile),
    {
      recursive: true
    }
  );
}


function truncate(text = '', max = 1000) {

  text = String(text).trim();

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


function decodeHtml(text = '') {

  return String(text)

    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&rsquo;/gi, '’')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .trim();
}


// ======================================================
// ETAT / ANTI DOUBLON
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

    const parsed =
      JSON.parse(
        fs.readFileSync(
          config.stateFile,
          'utf8'
        )
      );


    return {

      initialized:
        Boolean(
          parsed.initialized
        ),

      published:
        Array.isArray(
          parsed.published
        )
          ? parsed.published
          : []

    };


  } catch (error) {

    console.log(
      `⚠️ GTA : état impossible à lire : ${error.message}`
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
// NORMALISATION URL
// ======================================================

function normalizeArticleUrl(url) {

  try {

    const parsed =
      new URL(url);


    if (
      parsed.hostname !==
      'www.rockstargames.com'
    ) {
      return null;
    }


    if (
      !parsed.pathname.includes(
        '/newswire/article/'
      )
    ) {
      return null;
    }


    parsed.search = '';
    parsed.hash = '';


    return parsed.toString();


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


    return parsed.pathname;


  } catch {

    return url;
  }
}


// ======================================================
// CHROMIUM / PUPPETEER
// ======================================================

async function createBrowser() {

  console.log(
    '🌐 GTA : lancement du navigateur Rockstar...'
  );


  try {

    console.log(
      `🖥️ GTA : ${process.platform} • ${process.arch} • Node ${process.version}`
    );


    let executablePath;


    if (
      process.env.CHROME_EXECUTABLE_PATH
    ) {

      executablePath =
        process.env.CHROME_EXECUTABLE_PATH;


      console.log(
        `🌐 GTA : Chrome personnalisé : ${executablePath}`
      );

    } else {

      executablePath =
        puppeteer.executablePath();


      console.log(
        `🌐 GTA : Chrome Puppeteer : ${executablePath}`
      );
    }


    if (
      !fs.existsSync(
        executablePath
      )
    ) {

      throw new Error(
        `Exécutable Chrome introuvable : ${executablePath}`
      );
    }


    console.log(
      '🚀 GTA : tentative de lancement Chromium...'
    );


    const browser =
      await puppeteer.launch({

        headless: 'shell',

        executablePath,

        dumpio: true,

        userDataDir:
          '/tmp/naru-gta-chrome',

        timeout:
          60000,

        args: [

          '--no-sandbox',

          '--disable-setuid-sandbox',

          '--disable-dev-shm-usage',

          '--disable-gpu',

          '--no-zygote',

          '--single-process',

          '--disable-software-rasterizer',

          '--disable-extensions',

          '--disable-background-networking',

          '--disable-default-apps',

          '--disable-sync',

          '--metrics-recording-only',

          '--mute-audio',

          '--no-first-run',

          '--no-default-browser-check'

        ]

      });


    console.log(
      '✅ GTA : Chromium lancé avec succès.'
    );


    return browser;


  } catch (error) {

    console.error(
      '❌ GTA : impossible de lancer Chromium.'
    );


    console.error(
      '━━━━━━━━ ERREUR CHROMIUM ━━━━━━━━'
    );


    console.error(
      error
    );


    console.error(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    );


    throw error;
  }
}


// ======================================================
// NEWSWIRE ROCKSTAR
// ======================================================

async function getNewswireLinks(browser) {

  console.log(
    '🌴 GTA : ouverture du Newswire officiel Rockstar...'
  );


  const page =
    await browser.newPage();


  try {

    await page.setViewport({
      width: 1280,
      height: 900
    });


    await page.setUserAgent(

      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/140 Safari/537.36'

    );


    console.log(
      `🌐 GTA : ${config.newswireUrl}`
    );


    await page.goto(

      config.newswireUrl,

      {
        waitUntil:
          'domcontentloaded',

        timeout:
          60000
      }

    );


    console.log(
      '⏳ GTA : attente du chargement JavaScript Rockstar...'
    );


    try {

      await page.waitForFunction(

        () => {

          return Array.from(
            document.querySelectorAll(
              'a[href]'
            )
          )
            .some(
              element =>
                element.href.includes(
                  '/newswire/article/'
                )
            );
        },

        {
          timeout:
            30000
        }

      );


      console.log(
        '✅ GTA : articles Newswire chargés.'
      );


    } catch {

      console.log(
        '⚠️ GTA : aucun article détecté après 30 secondes.'
      );
    }


    // ==================================================
    // SCROLL
    // ==================================================

    for (
      let i = 0;
      i < 4;
      i++
    ) {

      await page.evaluate(() => {

        window.scrollBy(
          0,
          window.innerHeight
        );

      });


      await wait(
        1200
      );
    }


    await page.evaluate(() => {

      window.scrollTo(
        0,
        0
      );

    });


    // ==================================================
    // LIENS
    // ==================================================

    const rawLinks =
      await page.evaluate(() => {

        return Array.from(
          document.querySelectorAll(
            'a[href]'
          )
        )

          .map(
            element =>
              element.href
          )

          .filter(
            href =>
              href.includes(
                '/newswire/article/'
              )
          );

      });


    const links =
      [
        ...new Set(

          rawLinks

            .map(
              normalizeArticleUrl
            )

            .filter(
              Boolean
            )

        )
      ];


    console.log(
      `🔗 GTA : ${links.length} article(s) Newswire détecté(s).`
    );


    return links;


  } finally {

    await page.close();
  }
}


// ======================================================
// EXTRACTION ARTICLE
// ======================================================

async function extractArticle(
  browser,
  url
) {

  const page =
    await browser.newPage();


  try {

    await page.setUserAgent(

      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/140 Safari/537.36'

    );


    await page.goto(

      url,

      {
        waitUntil:
          'domcontentloaded',

        timeout:
          60000
      }

    );


    await wait(
      1000
    );


    const info =
      await page.evaluate(() => {

        function getMeta(name) {

          const element =

            document.querySelector(
              `meta[property="${name}"]`
            )

            ||

            document.querySelector(
              `meta[name="${name}"]`
            );


          return element
            ? element.getAttribute(
                'content'
              )
            : null;
        }


        const h1 =
          document.querySelector(
            'h1'
          );


        const time =
          document.querySelector(
            'time'
          );


        return {

          title:
            getMeta(
              'og:title'
            )
            ||
            h1?.innerText
            ||
            document.title
            ||
            '',


          description:
            getMeta(
              'og:description'
            )
            ||
            getMeta(
              'description'
            )
            ||
            '',


          image:
            getMeta(
              'og:image'
            )
            ||
            getMeta(
              'twitter:image'
            )
            ||
            null,


          published:
            getMeta(
              'article:published_time'
            )
            ||
            time?.getAttribute(
              'datetime'
            )
            ||
            null,


          finalUrl:
            window.location.href

        };

      });


    info.title =
      decodeHtml(
        info.title || ''
      )

        .replace(
          /\s*[-|]\s*Rockstar Games\s*$/i,
          ''
        )

        .trim();


    info.description =
      decodeHtml(
        info.description ||
        ''
      );


    return info;


  } finally {

    await page.close();
  }
}


// ======================================================
// DETECTION GTA V / GTA ONLINE
// ======================================================

function classifyArticle(
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


  const gtaOnline =

    /\bgta online\b/i.test(
      text
    )

    ||

    /grand theft auto online/i.test(
      text
    );


  const gtaVI =

    /\bgta vi\b/i.test(
      text
    )

    ||

    /grand theft auto vi/i.test(
      text
    );


  const gtaV =

    /\bgta v\b/i.test(
      text
    )

    ||

    /\bgtav\b/i.test(
      text
    )

    ||

    /grand theft auto v(?!i)/i.test(
      text
    );


  // GTA VI uniquement = refus
  if (
    gtaVI &&
    !gtaOnline
  ) {

    return false;
  }


  // GTA Online = accepté
  if (gtaOnline) {

    return true;
  }


  // GTA V = accepté
  if (
    gtaV &&
    !gtaVI
  ) {

    return true;
  }


  return false;
}


// ======================================================
// URL FRANCAISE
// ======================================================

function buildFrenchUrl(url) {

  try {

    const parsed =
      new URL(url);


    let pathname =
      parsed.pathname;


    pathname =
      pathname.replace(
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
// ARTICLE FRANCAIS
// ======================================================

async function getFrenchArticle(
  browser,
  sourceUrl,
  englishInfo
) {

  const frenchUrl =
    buildFrenchUrl(
      sourceUrl
    );


  try {

    console.log(
      '🇫🇷 GTA : recherche de la version française...'
    );


    const frenchInfo =
      await extractArticle(
        browser,
        frenchUrl
      );


    const lowerTitle =
      String(
        frenchInfo.title ||
        ''
      )
        .toLowerCase();


    const badPage =

      !frenchInfo.title

      ||

      lowerTitle ===
        'rockstar games'

      ||

      !frenchInfo.finalUrl
        ?.includes(
          '/fr/newswire/article/'
        );


    if (!badPage) {

      console.log(
        '🇫🇷 GTA : version française Rockstar trouvée.'
      );


      return {

        url:
          frenchInfo.finalUrl,

        title:
          frenchInfo.title,

        description:
          frenchInfo.description ||
          englishInfo.description,

        image:
          frenchInfo.image ||
          englishInfo.image,

        published:
          frenchInfo.published ||
          englishInfo.published,

        language:
          'official'

      };
    }


  } catch (error) {

    console.log(
      `⚠️ GTA FR : ${error.message}`
    );
  }


  console.log(
    '⚠️ GTA : version française indisponible.'
  );


  return {

    url:
      sourceUrl,

    title:
      englishInfo.title,

    description:
      englishInfo.description,

    image:
      englishInfo.image,

    published:
      englishInfo.published,

    language:
      'english'

  };
}


// ======================================================
// DATE
// ======================================================

function formatDate(value) {

  if (!value) {

    return 'Date non détectée';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return String(value);
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
// EMBED DISCORD
// ======================================================

function createEmbed(article) {

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
          article.title,
          250
        )
      )

      .setURL(
        article.url
      )

      .setDescription(

        truncate(

          article.description

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
            'official'

              ? 'Version française officielle Rockstar'

              : 'Article officiel Rockstar en anglais',

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
// RECHERCHE DES ARTICLES
// ======================================================

async function findGtaArticles(
  browser
) {

  const links =
    await getNewswireLinks(
      browser
    );


  if (
    links.length === 0
  ) {

    throw new Error(
      'Aucun lien Newswire Rockstar détecté après rendu JavaScript.'
    );
  }


  const gtaArticles =
    [];


  const candidates =
    links.slice(
      0,
      30
    );


  console.log(
    `🔎 GTA : analyse de ${candidates.length} article(s) Rockstar...`
  );


  for (
    const link
    of candidates
  ) {

    try {

      console.log(
        `🔎 GTA : ${link}`
      );


      const info =
        await extractArticle(
          browser,
          link
        );


      if (
        !classifyArticle(
          info
        )
      ) {

        console.log(
          `⏭️ Ignoré : ${truncate(info.title, 80)}`
        );

        continue;
      }


      console.log(
        `✅ GTA V / GTA Online : ${truncate(info.title, 100)}`
      );


      const french =
        await getFrenchArticle(
          browser,
          link,
          info
        );


      gtaArticles.push({

        key:
          getArticleKey(
            link
          ),

        canonicalUrl:
          link,

        ...french

      });


    } catch (error) {

      console.log(
        `⚠️ GTA article : ${error.message}`
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


  checking = true;


  let browser =
    null;


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

      throw new Error(
        `Salon GTA ${config.channelId} introuvable.`
      );
    }


    // ==================================================
    // CHROME
    // ==================================================

    browser =
      await createBrowser();


    // ==================================================
    // ROCKSTAR
    // ==================================================

    const articles =
      await findGtaArticles(
        browser
      );


    if (
      articles.length === 0
    ) {

      console.log(
        '⚠️ GTA : aucune actualité GTA V / GTA Online détectée.'
      );

      return;
    }


    console.log(
      `🌴 GTA : ${articles.length} actualité(s) GTA trouvée(s).`
    );


    // ==================================================
    // ETAT
    // ==================================================

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
        'ℹ️ GTA : aucun ancien article envoyé sur Discord.'
      );


      return;
    }


    // ==================================================
    // NOUVEAUTES
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


    // Plus ancien -> plus récent
    const ordered =
      [
        ...newArticles
      ]
        .reverse();


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
        `📢 GTA publiée : ${article.title}`
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

    if (browser) {

      try {

        await browser.close();


        console.log(
          '🌐 GTA : navigateur fermé.'
        );


      } catch (error) {

        console.log(
          `⚠️ GTA : erreur fermeture navigateur : ${error.message}`
        );
      }
    }


    checking = false;
  }
}


// ======================================================
// DEMARRAGE MODULE GTA
// ======================================================

function startGtaUpdates(
  client
) {

  console.log(
    '🌴 Module GTA Updates chargé.'
  );


  // Premier contrôle au lancement
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
