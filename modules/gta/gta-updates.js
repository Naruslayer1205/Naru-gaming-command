const {
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const config = require('./config');

let checking = false;
let interval = null;

function ensureDataFolder() {
  fs.mkdirSync(
    path.dirname(config.stateFile),
    { recursive: true }
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
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
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
      .slice(0, max - 1)
      .trim() +
    '…'
  );
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NaruGamingCommand/3.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} sur ${url}`
    );
  }

  return await response.text();
}

function defaultState() {
  return {
    initialized: false,
    lastArticleUrl: null,
    published: []
  };
}

function loadState() {
  ensureDataFolder();

  if (!fs.existsSync(config.stateFile)) {
    return defaultState();
  }

  try {
    const oldState = JSON.parse(
      fs.readFileSync(
        config.stateFile,
        'utf8'
      )
    );

    return {
      initialized:
        Boolean(oldState.initialized),

      lastArticleUrl:
        oldState.lastArticleUrl || null,

      published:
        Array.isArray(oldState.published)
          ? oldState.published
          : []
    };
  } catch (error) {
    console.log(
      `⚠️ GTA : impossible de lire l’état : ${error.message}`
    );

    return defaultState();
  }
}

function saveState(state) {
  ensureDataFolder();

  try {
    fs.writeFileSync(
      config.stateFile,
      JSON.stringify(state, null, 2)
    );
  } catch (error) {
    console.log(
      `⚠️ GTA : impossible de sauvegarder l’état : ${error.message}`
    );
  }
}

function normalizeArticleUrl(url) {
  if (!url) {
    return null;
  }

  let clean = decodeHtml(url);

  if (clean.startsWith('//')) {
    clean = `https:${clean}`;
  }

  if (clean.startsWith('/')) {
    clean =
      `https://www.rockstargames.com${clean}`;
  }

  clean = clean.replace(
    'https://www.rockstargames.com/fr/newswire/article/',
    'https://www.rockstargames.com/newswire/article/'
  );

  return clean.split('?')[0];
}

function extractArticleUrls(html) {
  const urls = [];
  const seen = new Set();

  const regex =
    /href=["']([^"']*\/newswire\/article\/[^"']+)["']/gi;

  for (const match of html.matchAll(regex)) {
    const url =
      normalizeArticleUrl(match[1]);

    if (
      !url ||
      seen.has(url)
    ) {
      continue;
    }

    seen.add(url);
    urls.push(url);
  }

  return urls;
}

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
    const match = html.match(pattern);

    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function extractTitle(html) {
  const title =
    getMeta(html, 'og:title');

  if (title) {
    return title
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

  return h1?.[1]
    ? stripHtml(h1[1])
    : 'Nouvelle actualité GTA';
}

function extractDescription(html) {
  const description =
    getMeta(html, 'og:description') ||
    getMeta(html, 'description');

  if (description) {
    return stripHtml(description);
  }

  const paragraphs = [
    ...html.matchAll(
      /<p[^>]*>([\s\S]*?)<\/p>/gi
    )
  ];

  for (const paragraph of paragraphs) {
    const text =
      stripHtml(paragraph[1]);

    if (text.length >= 80) {
      return text;
    }
  }

  return (
    'Une nouvelle actualité officielle concernant GTA V / GTA Online vient d’être publiée par Rockstar Games.'
  );
}

function extractImage(html) {
  return (
    getMeta(html, 'og:image') ||
    getMeta(html, 'twitter:image')
  );
}

function extractPublishedDate(html) {
  const iso =
    getMeta(
      html,
      'article:published_time'
    );

  if (iso) {
    const date = new Date(iso);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const timeMatch =
    html.match(
      /<time[^>]+datetime=["']([^"']+)["']/i
    );

  if (timeMatch?.[1]) {
    const date =
      new Date(timeMatch[1]);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Rockstar expose souvent une date visible sans <time>.
  const text = stripHtml(html);

  const englishDate =
    text.match(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/i
    );

  if (englishDate) {
    const date =
      new Date(englishDate[0]);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function isGtaVOrOnline(html) {
  const plain =
    stripHtml(html).toLowerCase();

  const hasAcceptedTerm =
    config.acceptedTerms.some(term =>
      plain.includes(term)
    );

  // Refus explicite des articles uniquement GTA VI.
  const hasGtaVI =
    plain.includes('grand theft auto vi') ||
    plain.includes('gta vi');

  if (!hasAcceptedTerm) {
    return false;
  }

  // Un article peut comparer GTA V et GTA VI.
  // On l'accepte seulement si GTA V / Online est clairement présent.
  if (hasGtaVI) {
    const hasStrongGtaV =
      plain.includes('gta online') ||
      plain.includes('grand theft auto online') ||
      plain.includes('grand theft auto v') ||
      plain.includes('gtav');

    return hasStrongGtaV;
  }

  return true;
}

function toFrenchUrl(articleUrl) {
  return articleUrl.replace(
    'https://www.rockstargames.com/newswire/',
    config.frenchNewswireBase
  );
}

async function fetchArticle(articleUrl) {
  const frUrl =
    toFrenchUrl(articleUrl);

  let html;
  let displayUrl = frUrl;
  let language = 'fr';

  try {
    html = await fetchPage(frUrl);

    if (
      !html ||
      html.length < 1000
    ) {
      throw new Error(
        'Version française vide'
      );
    }
  } catch (error) {
    html =
      await fetchPage(articleUrl);

    displayUrl = articleUrl;
    language = 'en';
  }

  if (!isGtaVOrOnline(html)) {
    return null;
  }

  return {
    canonicalUrl: articleUrl,
    url: displayUrl,
    language,
    title: extractTitle(html),
    description:
      extractDescription(html),
    image: extractImage(html),
    publishedAt:
      extractPublishedDate(html)
  };
}

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
      data?.responseData?.translatedText;

    return translated
      ? decodeHtml(translated)
      : text;
  } catch (error) {
    return text;
  }
}

async function ensureFrench(article) {
  if (article.language === 'fr') {
    return article;
  }

  console.log(
    '🇫🇷 GTA : version FR Rockstar indisponible, traduction automatique.'
  );

  return {
    ...article,
    title:
      await translateText(
        truncate(article.title, 450)
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

function formatDate(date) {
  if (!date) {
    return 'Date Rockstar non détectée';
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Paris'
    }
  ).format(date);
}

function createGtaEmbed(article) {
  const embed =
    new EmbedBuilder()
      .setColor(config.color)
      .setAuthor({
        name:
          'GRAND THEFT AUTO V • GTA ONLINE • NEWSWIRE'
      })
      .setTitle(
        `🌴 ${truncate(article.title, 240)}`
      )
      .setURL(article.url)
      .setDescription(
        truncate(
          article.description,
          3500
        )
      )
      .addFields(
        {
          name: '🎮 Jeu',
          value:
            'Grand Theft Auto V • GTA Online',
          inline: true
        },
        {
          name: '📅 Publication',
          value:
            formatDate(
              article.publishedAt
            ),
          inline: true
        },
        {
          name: '🇫🇷 Version',
          value:
            article.language === 'fr'
              ? 'Français officiel Rockstar'
              : 'Traduction française automatique',
          inline: false
        },
        {
          name: '⭐ Source officielle',
          value:
            `[Rockstar Games Newswire](${article.url})`,
          inline: false
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
    embed.setImage(article.image);
  }

  return embed;
}

async function findLatestGtaArticle() {
  const homepage =
    await fetchPage(
      config.newswireUrl
    );

  const urls =
    extractArticleUrls(homepage)
      .slice(
        0,
        config.maxCandidates
      );

  if (urls.length === 0) {
    throw new Error(
      'Aucun lien Newswire détecté'
    );
  }

  for (const url of urls) {
    try {
      const article =
        await fetchArticle(url);

      if (article) {
        return article;
      }
    } catch (error) {
      console.log(
        `⚠️ GTA : article ignoré (${error.message})`
      );
    }
  }

  return null;
}

async function checkGtaUpdates(client) {
  if (checking) {
    console.log(
      '⏳ GTA : une vérification est déjà en cours.'
    );
    return;
  }

  checking = true;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌴 GTA UPDATES • Vérification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
        '❌ GTA : aucune actualité GTA V / GTA Online détectée.'
      );
      return;
    }

    const state = loadState();

    // Premier lancement : on mémorise sans republier les anciennes actualités.
    if (!state.initialized) {
      state.initialized = true;
      state.lastArticleUrl =
        latest.canonicalUrl;
      state.published = [
        latest.canonicalUrl
      ];

      saveState(state);

      console.log(
        `✅ GTA initialisé sur : ${latest.title}`
      );
      console.log(
        'ℹ️ GTA : aucune ancienne actualité envoyée.'
      );
      return;
    }

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

    const frenchArticle =
      await ensureFrench(latest);

    await channel.send({
      embeds: [
        createGtaEmbed(
          frenchArticle
        )
      ]
    });

    state.lastArticleUrl =
      latest.canonicalUrl;

    state.published.unshift(
      latest.canonicalUrl
    );

    state.published = [
      ...new Set(
        state.published
      )
    ].slice(0, 100);

    saveState(state);

    console.log(
      `📢 GTA : "${frenchArticle.title}" publiée !`
    );
  } catch (error) {
    console.error(
      '❌ Erreur GTA :',
      error.message
    );
  } finally {
    checking = false;
  }
}

function startGtaUpdates(client) {
  console.log(
    '🌴 Module GTA Updates chargé.'
  );

  // Immédiatement au démarrage.
  checkGtaUpdates(client);

  // Puis toutes les 15 minutes.
  if (!interval) {
    interval = setInterval(
      () => checkGtaUpdates(client),
      config.checkInterval
    );
  }
}

module.exports = startGtaUpdates;
